"""Font-template (glyph reference) service.

Text-to-image models cannot reproduce a NAMED font consistently from words alone — every
generation invents slightly different letterforms (the "har baar font alag" problem). The reliable
fix is to stop describing the font in words and instead give the model a VISUAL template: render the
requested text in the ACTUAL font file (TTF/OTF) as a clean black-on-white image, and pass that as a
reference so the model TRACES the exact letter shapes into 3D metal.

How it degrades:
  * Font file present  -> exact, run-to-run-identical letterforms (glyph template used).
  * Font file absent   -> returns None; the caller falls back to the existing text-description path.

Adding fonts: drop a `.ttf`/`.otf` into app/assets/fonts/. The file name (minus extension, with
`_`/`-` -> space, lowercased) becomes the lookup name, e.g. `road_rage.ttf` -> "road rage". Extra
synonyms can be added to FONT_ALIASES below.
"""

from __future__ import annotations

import io
import logging
import os
import re
from typing import Dict, Optional, Tuple

logger = logging.getLogger(__name__)

FONT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "assets", "fonts")

# Synonyms / common ways a customer might name a font -> the canonical lookup name (the bundled
# file's normalized name). Keys and values are lowercase. Bundled fonts (app/assets/fonts/):
#   script, block, gothic, bubble, graffiti, old english, brush, sans serif, road rage, baguette
# The client can drop additional .ttf files in that folder and add aliases here.
FONT_ALIASES: Dict[str, str] = {
    # script / cursive
    "cursive": "script",
    "handwriting": "script",
    "handwritten": "script",
    "signature": "script",
    # sans serif
    "sans": "sans serif",
    "sans-serif": "sans serif",
    "sanserif": "sans serif",
    "plain": "sans serif",
    "modern": "sans serif",
    # old english / blackletter
    "olde english": "old english",
    "blackletter": "old english",
    "medieval": "old english",
    # gothic (also blackletter family)
    "goth": "gothic",
    # road rage / graffiti tags
    "roadrage": "road rage",
    "road-rage": "road rage",
    "tag": "graffiti",
    "spray paint": "graffiti",
    "spray": "graffiti",
    # bubble
    "bubbly": "bubble",
    "balloon": "bubble",
    # brush
    "paint brush": "brush",
    "paintbrush": "brush",
    # baguette
    "elegant": "baguette",
}


def _normalize(name: str) -> str:
    n = (name or "").strip().lower()
    n = re.sub(r"\.(ttf|otf|ttc)$", "", n)
    n = n.replace("_", " ").replace("-", " ")
    n = re.sub(r"\bfont\b", "", n)       # drop a trailing/leading "font" word
    n = re.sub(r"\s+", " ", n).strip()
    return n


def discover_fonts() -> Dict[str, str]:
    """Map normalized font name -> absolute file path for every font file in FONT_DIR."""
    out: Dict[str, str] = {}
    try:
        for fn in os.listdir(FONT_DIR):
            if fn.lower().endswith((".ttf", ".otf", ".ttc")):
                out[_normalize(fn)] = os.path.join(FONT_DIR, fn)
    except FileNotFoundError:
        pass
    return out


def find_font_file(font_name: str) -> Optional[str]:
    """Resolve a requested font name (possibly a synonym) to an installed font file, or None."""
    if not font_name:
        return None
    fonts = discover_fonts()
    if not fonts:
        return None
    key = _normalize(font_name)
    if key in fonts:
        return fonts[key]
    alias = FONT_ALIASES.get(key)
    if alias and alias in fonts:
        return fonts[alias]
    # loose contains-match (e.g. "road rage tag" -> "road rage")
    for name, path in fonts.items():
        if name and (name in key or key in name):
            return path
    return None


# --- request parsing -------------------------------------------------------
_FONT_NAME_RE = re.compile(
    r"(?:\bin\b|\busing\b|\bwith\b|\bfont\s*[:=]|\bfont\b)\s*(?:the\s+)?"
    r"['\"]?([A-Za-z0-9 .&'-]+?)['\"]?\s*(?:\bfont\b|\bstyle\b|$|[,.;])",
    re.I,
)
_QUOTED_RE = re.compile(r"[\"'“‘]([^\"'“”‘’]{1,40})[\"'”’]")
_SAYS_RE = re.compile(r"\b(?:says?|reads?|name(?:d)?|spelling|spell)\b[:\s]+['\"]?([A-Za-z0-9 .&'-]{1,40})", re.I)


def extract_font_name(prompt: str) -> Optional[str]:
    """Pull the requested font name out of the prompt (e.g. 'in Road Rage Font' -> 'Road Rage')."""
    if not prompt:
        return None
    m = _FONT_NAME_RE.search(prompt)
    if m:
        cand = m.group(1).strip()
        # avoid matching bare determiners (but DO allow real style names like "block", "bold")
        if cand and cand.lower() not in ("the", "a", "an", "this", "that", "same", "new", "your"):
            return cand
    return None


def extract_text(prompt: str) -> Optional[str]:
    """Pull the lettering to render (quoted text, or after 'says'/'name')."""
    if not prompt:
        return None
    m = _QUOTED_RE.search(prompt)
    if m:
        return m.group(1).strip()
    m = _SAYS_RE.search(prompt)
    if m:
        return m.group(1).strip()
    return None


# --- glyph rendering -------------------------------------------------------
# How much to pull adjacent letters together, as a fraction of the font size. Letters are drawn
# character-by-character with this much shaved off each advance so neighbouring letters sit CLOSE /
# touching in the template itself — the model then traces a naturally CONNECTED word (one wearable
# piece) instead of separate floating letters. Connection is thus driven by the reference image, not
# by any prompt instruction (so it never wrongly forces connection on unrelated designs).
LETTER_TIGHTEN = 0.10


def _tight_width(draw, text: str, font, tighten: float) -> float:
    total = sum(draw.textlength(ch, font=font) for ch in text)
    return total - tighten * font.size * max(0, len(text) - 1)


def render_text_template(text: str, font_path: str, canvas: Tuple[int, int] = (1280, 640),
                         tighten: float = LETTER_TIGHTEN) -> Optional[bytes]:
    """Render `text` in the given font as a clean, centered, high-contrast black-on-white PNG.

    Letters are drawn one-by-one with slightly reduced spacing (``tighten``) so neighbouring letters
    sit close / touching — the model then traces a single CONNECTED word. The font size is auto-scaled
    to fill the canvas with padding. Returns PNG bytes, or None on failure (e.g. PIL missing)."""
    try:
        from PIL import Image, ImageDraw, ImageFont
    except Exception as e:  # pragma: no cover
        logger.warning("[font-template] PIL unavailable: %s", e)
        return None
    try:
        W, H = canvas
        probe = Image.new("RGB", (W, H), "white")
        draw = ImageDraw.Draw(probe)
        best_font = None
        # grow the font size until the (tightened) text would exceed the safe area, then step back
        for trial in range(24, 900, 6):
            f = ImageFont.truetype(font_path, trial)
            bbox = draw.textbbox((0, 0), text, font=f)
            w = _tight_width(draw, text, f, tighten)
            h = bbox[3] - bbox[1]
            if w <= W * 0.86 and h <= H * 0.62:
                best_font = f
            else:
                break
        if best_font is None:
            best_font = ImageFont.truetype(font_path, 120)
        f = best_font
        img = Image.new("RGB", (W, H), "white")
        d = ImageDraw.Draw(img)
        full_bbox = d.textbbox((0, 0), text, font=f)
        total_w = _tight_width(d, text, f, tighten)
        fh = full_bbox[3] - full_bbox[1]
        x = (W - total_w) / 2
        y = (H - fh) / 2 - full_bbox[1]
        # draw character-by-character, shaving the advance so adjacent letters sit close/touching
        for ch in text:
            d.text((x, y), ch, fill="black", font=f)
            x += d.textlength(ch, font=f) - tighten * f.size
        buf = io.BytesIO()
        img.save(buf, "PNG")
        return buf.getvalue()
    except Exception as e:
        logger.warning("[font-template] render failed for font=%s: %s", font_path, e)
        return None


def build_font_template(prompt: str) -> Optional[Dict[str, str]]:
    """If the prompt names a font we HAVE a file for AND we can find the text to render, return a
    glyph template: {'b64': <png base64>, 'font': <name>, 'text': <text>}. Else None (caller falls
    back to the text-description path)."""
    font_name = extract_font_name(prompt)
    text = extract_text(prompt)
    if not font_name or not text:
        return None
    font_path = find_font_file(font_name)
    if not font_path:
        logger.info("[font-template] no font file for '%s' — falling back to text description", font_name)
        return None
    png = render_text_template(text, font_path)
    if not png:
        return None
    import base64
    logger.info("[font-template] rendered '%s' in font '%s' (%s)", text, font_name, os.path.basename(font_path))
    return {"b64": base64.b64encode(png).decode("utf-8"), "font": font_name, "text": text}
