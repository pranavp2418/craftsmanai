"""Parse-first structured intent (Lovable-style).

Converts a raw retailer request (note + optional reference image[s]) into a STRUCTURED jewelry
design state via Gemini forced tool-calling, so the image prompt is built from clean typed fields
instead of raw user language. This is the master-prompt's CORE RULE: "Never generate directly from
raw user language alone — first convert the request into a structured jewelry design state."

Returns a dict (parsedData). Fail-open: returns a sensible minimal dict on any error so generation
never blocks.
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, List, Optional

import requests

from app.core.config import settings

logger = logging.getLogger(__name__)

_GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
_PARSE_MODEL = "gemini-2.5-flash"

PARSE_SYSTEM_PROMPT = (
    "You are a jewelry request parser for CraftsmanAI. Analyze the user's note and any uploaded "
    "image(s) and extract a STRUCTURED design intent. Do NOT generate images — only classify and "
    "extract.\n\n"
    "SOURCE_KIND — classify the PRIMARY input: jewelry_reference (photo/screenshot of real "
    "jewelry), non_jewelry_reference (logo/photo/artwork/object to convert into jewelry), sketch "
    "(hand-drawn/CAD wireframe), cad_render, logo_text_asset (a name/letter/logo), "
    "screenshot_request (a chat/text request screenshot), mixed_reference (one base + one style/"
    "instruction image), text_only (no image), unknown.\n\n"
    "INTENT: render_as_is (reproduce the piece cleanly — DEFAULT for a jewelry_reference with no "
    "modification note; do NOT redesign/improve/enlarge), modify_existing (same piece with "
    "specific changes), image_enhancement_only (same design but cleaner/sharper/metal-only), "
    "convert_to_jewelry (turn a non-jewelry image into jewelry), combine_references (merge "
    "multiple references), sketch_to_render (sketch -> clean CAD render), text_to_render (from "
    "text only).\n\n"
    "CRITICAL: if source is jewelry_reference and the user gave NO meaningful modification note, "
    "intent MUST be render_as_is — reproduce the SAME piece, do not redesign or 'improve'.\n\n"
    "Also normalize casual retailer slang in the note into a precise technical sentence "
    "(normalized_note): e.g. 'bust down/iced' = full stone coverage; '3 rows' = stone_row_count 3; "
    "'diamond cut edge' = faceted metal edge (NOT a stone border); 'same as ref' = preserve all "
    "unspecified geometry/material. Default to small-to-mid stones unless the user asks for large."
)

_PARSE_TOOL = [{
    "type": "function",
    "function": {
        "name": "parse_jewelry_request",
        "description": "Emit the structured jewelry design intent.",
        "parameters": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "source_kind": {"type": "string", "enum": [
                    "jewelry_reference", "non_jewelry_reference", "screenshot_request",
                    "logo_text_asset", "sketch", "cad_render", "mixed_reference", "text_only", "unknown",
                ]},
                "item_type": {"type": "string", "enum": [
                    "ring", "pendant", "chain", "bracelet", "earring", "grill", "watch", "other",
                ]},
                "render_class": {"type": "string", "description": "routing hint, e.g. flat_pendant, dimensional_pendant, solitaire_ring, signet_ring, band_ring, cuban_chain, tennis_chain, nameplate, stud_earring"},
                "intent": {"type": "string", "enum": [
                    "render_as_is", "modify_existing", "image_enhancement_only",
                    "convert_to_jewelry", "combine_references", "sketch_to_render", "text_to_render",
                ]},
                "is_class_or_signet": {"type": "boolean"},
                "metal_tone": {"type": "string", "description": "yellow_gold | white_gold | rose_gold | two_tone | platinum | silver | unspecified"},
                "stone_presence": {"type": "boolean"},
                "stone_coverage": {"type": "string", "description": "none | accent | partial | full/iced | unspecified"},
                "stone_row_count": {"type": ["integer", "null"]},
                "lettering_text": {"type": "string", "description": "any name/initials/number/word that must appear, exactly; empty if none"},
                "target_regions": {"type": "array", "items": {"type": "string"}},
                "normalized_note": {"type": "string", "description": "the user's request rewritten as a precise technical instruction"},
            },
            "required": ["source_kind", "item_type", "intent", "normalized_note"],
        },
    },
}]


def _fallback(note: str, image_urls: Optional[List[str]], item_type_hint: str) -> Dict[str, Any]:
    has_img = bool(image_urls)
    return {
        "source_kind": "unknown" if has_img else "text_only",
        "item_type": (item_type_hint or "").strip().lower() or "other",
        "intent": ("render_as_is" if (has_img and not (note or "").strip()) else
                   ("modify_existing" if has_img else "text_to_render")),
        "is_class_or_signet": False,
        "metal_tone": "unspecified",
        "normalized_note": note or "",
        "_parsed": False,
    }


def parse_request(note: str, image_urls: Optional[List[str]] = None, item_type_hint: str = "") -> Dict[str, Any]:
    """Return a structured parsedData dict. Fail-open to a minimal dict on any error/no-key."""
    api_key = os.getenv("GEMINI_API_KEY") or getattr(settings, "GEMINI_API_KEY", None)
    if not api_key:
        return _fallback(note, image_urls, item_type_hint)

    user_content: List[Dict[str, Any]] = [{
        "type": "text",
        "text": f"User selected jewelry type: {item_type_hint or '(none)'}\nUser note: {note or '(none)'}",
    }]
    for u in (image_urls or [])[:4]:
        if u:
            user_content.append({"type": "image_url", "image_url": {"url": u}})

    try:
        resp = requests.post(
            _GEMINI_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": _PARSE_MODEL,
                "temperature": 0,
                "messages": [
                    {"role": "system", "content": PARSE_SYSTEM_PROMPT},
                    {"role": "user", "content": user_content},
                ],
                "tools": _PARSE_TOOL,
                "tool_choice": {"type": "function", "function": {"name": "parse_jewelry_request"}},
            },
            timeout=30,
        )
        if not resp.ok:
            logger.warning("[parse_request] gateway HTTP %d: %s", resp.status_code, resp.text[:200])
            return _fallback(note, image_urls, item_type_hint)
        args = resp.json().get("choices", [{}])[0].get("message", {}).get("tool_calls", [{}])[0].get("function", {}).get("arguments")
        if not args:
            return _fallback(note, image_urls, item_type_hint)
        parsed = args if isinstance(args, dict) else json.loads(args)
        # Ensure required keys + sensible defaults; carry the hint if the model left item_type blank.
        parsed.setdefault("source_kind", "unknown")
        if not parsed.get("item_type"):
            parsed["item_type"] = (item_type_hint or "").strip().lower() or "other"
        parsed.setdefault("intent", "render_as_is" if image_urls else "text_to_render")
        parsed.setdefault("normalized_note", note or "")
        parsed["_parsed"] = True
        logger.info("[parse_request] source=%s item=%s intent=%s metal=%s",
                    parsed.get("source_kind"), parsed.get("item_type"), parsed.get("intent"), parsed.get("metal_tone"))
        return parsed
    except Exception as e:
        logger.warning("[parse_request] failed: %s", e)
        return _fallback(note, image_urls, item_type_hint)
