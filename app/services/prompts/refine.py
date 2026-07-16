"""Refinement prompt assembler (config-registry driven).

`build_refine_prompt(...)` is a drop-in for `openai_service._build_concise_refine_prompt`,
plus an `image_count` argument so it can handle the "refine WITH an extra reference image" case.

Two refine cases the client hits — both handled explicitly here:

  CASE 1  Text / name / number update on an uploaded image.
          -> focused text-replacement instruction (exact spelling, char count, font/case).
             Generic preservation ("keep everything else", "never de-gem") now lives in
             COMMON_SYSTEM_PROMPT, so the old 10-block stack is trimmed to the text-specific
             essentials — this removes the long-prompt inconsistency the code itself warned about.

  CASE 2  Refine WITH an additional reference image (combine / add an element from image 2).
          -> NEW: an explicit MULTIPLE-IMAGES instruction (image 1 = base to edit/keep,
             image 2+ = source of ONLY the requested element). The old live refine path had NO
             handling for this, so the model received the extra image with no idea what to do.

Shared with the initial builder: COMMON_SYSTEM_PROMPT (system layer) and metal_lock_clause.
All rule TEXT / detection helpers are read lazily from openai_service (single source of truth);
no openai_service import at module load time (no circular imports).
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from .common import MASTER_REFINE, metal_lock_clause, diamond_cut_clause, metal_conversion_clause


def _text_replacement_block(svc, replacements, user_prompt, forced_case) -> str:
    """Faithful, focused text-replacement instruction (exact spelling + count + font + case)."""
    parts = []
    for old_txt, raw_new_txt in replacements:
        new_txt = svc._apply_case(raw_new_txt, forced_case)
        guide = svc._spelling_guide(new_txt)
        char_count = len((new_txt or "").strip())
        generic_old = old_txt.strip().lower() in (
            "name", "text", "word", "the name", "the text",
            "number", "numbers", "the number", "digit", "digits", "the digits",
        )
        if generic_old:
            parts.append(
                f"Completely REPLACE the entire existing number/text on the piece with a brand-new one that reads "
                f"EXACTLY {guide}. Erase ALL of the original characters first — do NOT keep, reuse, carry over, or "
                f"blend ANY digit or letter from the original. The final result must contain EXACTLY {char_count} "
                f"character(s) total and nothing else."
            )
        else:
            parts.append(
                f"Completely REPLACE \"{old_txt}\" with EXACTLY {guide}. Erase all of the original characters — do "
                f"NOT keep or blend any of them. The final result must contain EXACTLY {char_count} character(s) "
                f"total and nothing else."
            )
    # No-stray-marks rule — always.
    parts.append(
        "Render that EXACT number of characters in that exact order — do NOT add an extra character, drop one, or "
        "duplicate one. Do NOT add any extra vertical bars, strokes, lines, dividers, separators, dots, or "
        "decorative characters between or around them. EVERY character must be correctly oriented and readable "
        "left-to-right — NEVER mirrored, flipped, reversed, or backwards."
    )
    # Font rule — preserve the reference font unless the user asked to change it.
    if svc._user_requests_font_change(user_prompt):
        parts.append(
            "Apply the font / character-style change exactly as the user requested; keep the same stone setting and "
            "all other design details."
        )
    else:
        parts.append(
            "CRITICAL — KEEP THE EXACT SAME FONT / STYLE as the original characters (letters AND numbers): same "
            "character style, slant, curves, stroke shapes, thickness, 3D depth, casing and stone-setting style. If "
            "the original is cursive/script keep cursive; if block keep block. NEVER convert one to the other — only "
            "the actual letters/digits change, never the style."
        )
    # Case rule.
    parts.append(svc._case_clause(user_prompt))
    return " ".join(parts)


def _combine_block(image_count: int) -> str:
    """CASE 2 — explicit multi-image instruction (was entirely missing in the live refine path)."""
    if not image_count or image_count <= 1:
        return ""
    return (
        "\n\nMULTIPLE IMAGES — the FIRST attached image is the BASE piece you are editing: keep it as the master and "
        "preserve it exactly except for the requested change. The ADDITIONAL image(s) are a visual SOURCE for the "
        "user's request ONLY — take ONLY the specific element, motif, component, or style the USER REQUEST refers to "
        "from them and integrate it cleanly into the FIRST piece. Do NOT output the images separately or side by "
        "side, and do NOT copy the additional image's background, metal colour, or any unrelated part. The result is "
        "ONE single edited version of the FIRST piece."
    )


def build_refine_prompt(
    user_prompt: str,
    refinement_intent: Optional[Dict[str, Any]],
    attempt: int,
    forced_case: Optional[str] = None,
    ref_metal: Optional[str] = None,
    image_count: int = 1,
) -> str:
    """Build the refinement prompt. Drop-in for _build_concise_refine_prompt (+ image_count)."""
    from app.services import openai_service as svc

    # LOVABLE-EXACT refine prompt (single-image edit) — client's strict rule: use the prototype's VERBATIM
    # prompt with NO regex / custom clauses. The dynamic target / region / attribute / change are filled from
    # the refinement intent (interpret_refinement already understood the request). The multi-image combine /
    # component-swap case keeps its dedicated path below; every normal refine returns Lovable's prompt directly.
    if (image_count or 1) <= 1:
        from app.services.prompts.lovable_prompts import LOVABLE_REFINE_PROMPT
        ri = refinement_intent or {}
        target = ", ".join(ri.get("target_components") or []) or "the requested component"
        region = ", ".join(ri.get("target_regions") or []) or "the relevant region"
        attribute = (ri.get("attribute_to_change") or "the requested attribute").strip()
        frm = (ri.get("from_state") or "").strip()
        to = (ri.get("to_state") or "").strip()
        normalized = (ri.get("normalized_prompt") or user_prompt or "").strip()
        if frm and to:
            change_line = f'Change {attribute} from "{frm}" to "{to}".'
        elif to:
            change_line = f'Change {attribute} to "{to}".'
        else:
            change_line = f"Apply this change: {normalized}"
        # Lovable-style edge-case directives (iced = every-surface, metal-only, stone rows, bail-freeze, …)
        # apply to refines too — append them after the verbatim prompt (this is NOT the rename regex, which
        # stays LLM-driven via interpret_refinement; these are the deterministic retailer-language handlers).
        from app.services.prompts.common import normalize_retailer_language as _nrl
        _edge = _nrl(user_prompt)
        # CAD_FINISH_LINE appended the same way as the edge directives (client 2026-07: every output in
        # the jewellery-CAD render look) — finish only, it never touches the edit/preserve rules above.
        from app.services.prompts.common import CAD_FINISH_LINE as _cadfin
        return (LOVABLE_REFINE_PROMPT
                .replace("{attempt}", str(attempt))
                .replace("{target}", target)
                .replace("{region}", region)
                .replace("{attribute}", attribute)
                .replace("{change_line}", change_line)
                .replace("{normalized}", normalized or (user_prompt or ""))
                .replace("{base_prompt}", "") + _edge + "\n\n" + _cadfin)

    # Detect a genuine TEXT change (regex + LLM intent gate).
    replacements = svc.extract_text_replacements(user_prompt)
    if replacements and not svc._llm_is_text_change(user_prompt):
        replacements = []

    metal_lock = metal_lock_clause(ref_metal, svc._user_wants_metal_change(user_prompt))
    combine_block = _combine_block(image_count)
    # "diamond cut" = metal finish (not diamonds); metal conversion when the user asks for a metal change.
    dcut = diamond_cut_clause(user_prompt)
    _metal_named = svc._detected_metal_phrase(user_prompt)
    metal_convert = metal_conversion_clause(_metal_named) if (_metal_named and svc._user_wants_metal_change(user_prompt)) else ""

    wants_front = svc._user_wants_front(user_prompt)
    angle_rule = svc.FRONT_FACING_RULE if wants_front else svc.PRESERVE_ANGLE_RULE
    centering = "Front-facing, upright, and centered." if wants_front else "Keep the reference's camera angle; centered."
    layered_block = f"\n\n{svc.LAYERED_RULE}" if svc._user_wants_layered(user_prompt) else ""

    # MULTI-IMAGE refine (combine / component swap): the user attached an EXTRA image showing a component
    # (e.g. a new BAIL) to put on the base piece. The preserve-heavy MASTER_REFINE stack made the model
    # NO-OP. Lead with the CHANGE — take that element from the additional image and place it correctly on
    # the FIRST piece, replacing the existing one. (Mirrors the proven lean change-dominant fix.)
    if image_count and image_count > 1:
        _what = (user_prompt or "").strip() or "the component shown in the additional image"
        _mi_intensity = ("" if attempt <= 1 else
                         " CRITICAL CORRECTION: the previous attempt did NOT visibly apply the swap. Redraw the target "
                         "component now using the additional image; do NOT keep the original one.")
        return (
            "REFINEMENT — COMBINE / COMPONENT SWAP. The FIRST attached image is the CURRENT piece (the master). "
            "The ADDITIONAL image(s) show a COMPONENT / element to use.\n\n"
            "PRIORITY ORDER (do not violate): "
            f"1) APPLY THE CHANGE — {_what}: take that specific component / element from the ADDITIONAL image and "
            "integrate it into the FIRST piece at the CORRECT, natural position (a bail / hook goes at the "
            "TOP-CENTRE facing forward; a centre stone / motif goes in the centre), REPLACING the existing one "
            "there. The swap MUST be clearly and visibly applied. "
            "2) Preserve everything else on the FIRST piece exactly — same design, silhouette, metal colour, stones, "
            "proportions and camera angle. NEVER let preservation cancel the edit. Do NOT copy the additional "
            f"image's background, metal colour or any unrelated part — use ONLY the element the request refers to.{_mi_intensity}\n\n"
            "Clean CAD-style render (jewellery-CAD software look — matte digital metal, idealized stones, NOT a photograph) on a pure solid white (#FFFFFF) background. One image only."
        )

    # BIG ADDITIVE COVERAGE refine (plain -> fully iced / add full diamonds): the heavy, preserve-laden
    # MASTER_REFINE stack makes the model NO-OP (it keeps the clean reference). Mirror the proven initial
    # fix — a LEAN, CHANGE-DOMINANT prompt where "add 100% diamonds" leads and preservation is minimal.
    _p_low = (user_prompt or "").lower()
    _iced_refine = (any(w in _p_low for w in ("iced", "ice out", "bust down", "bustdown", "flooded",
                                              "fully covered", "full diamond", "all diamond", "cover the whole",
                                              "cover the entire", "cover the pendant", "in diamonds", "all over"))
                    or "stone_coverage" in str((refinement_intent or {}).get("attribute_to_change", "")).lower())
    if _iced_refine and not replacements:
        # Mirror Lovable's focused-refinement structure: lead with the CHANGE as priority #1, explicitly say
        # preservation applies ONLY to non-target regions and must never cancel the edit, and frame it as a
        # structured attribute change. (A preservation-first prompt made the model no-op.)
        _intensity = ("" if attempt <= 1 else
                      " CRITICAL CORRECTION: the previous attempt was too conservative and did NOT visibly add the "
                      "diamonds. Do NOT preserve the plain surface — redraw the whole face fully covered in diamonds now.")
        return (
            "REFINEMENT — TARGETED EDIT. The attached image is the CURRENT render; this is an IMAGE EDIT, not a "
            "redesign.\n\n"
            "PRIORITY ORDER (do not violate): "
            "1) APPLY THE CHANGE — cover the ENTIRE front surface of the piece with a SOLID SHEET of small micro-pavé "
            "diamonds: fully iced out, 100% coverage, edge to edge, the whole face becomes diamonds, metal showing "
            "ONLY as the thin prong walls between touching stones. "
            "2) Preserve ONLY the non-target parts — the same silhouette, outline, proportions, metal colour and bail. "
            "NEVER let preservation cancel the edit.\n\n"
            "ATTRIBUTE TO CHANGE: stone coverage — change it from PLAIN / bare metal to FULLY ICED (covered in "
            "diamonds). Apply this CLEARLY and OBVIOUSLY — the edit must be unmistakable, not subtle: the plain metal "
            f"surface MUST become fully diamond-covered. Never return the image unchanged.{_intensity}\n\n"
            "Clean CAD-style render (jewellery-CAD software look — matte digital metal, idealized stones, NOT a photograph) on a pure solid white (#FFFFFF) background. One image only."
        )

    # BAIL RE-DRIFT GUARD: the model tends to "complete" a pendant by re-adding a bail even when the
    # reference has none (e.g. after a previous refine removed it). Unless THIS refine is about the
    # bail, tell it to preserve the exact top/bail state of the reference.
    _bail_in_prompt = any(w in (user_prompt or "").lower() for w in ["bail", "hook", "loop"])
    bail_state = "" if _bail_in_prompt else (
        " BAIL / TOP STATE (do NOT change unless asked): keep the top of the piece EXACTLY as in the reference. If "
        "the reference has NO bail / hook / top loop, the piece MUST stay bail-less — do NOT add a bail, hook, loop, "
        "crown-bail or any hanging element. If it already has a bail, keep that exact same bail. NEVER add or "
        "re-create a bail the reference does not have."
    )

    # ---------------- CASE 1: text / name / number update ----------------
    if replacements:
        replacement_block = _text_replacement_block(svc, replacements, user_prompt, forced_case)

        # Secondary design change in a compound prompt ("change name to X AND add red diamonds").
        residual = svc.refine_residual_instruction(user_prompt, replacements)
        residual_block = ""
        if residual:
            residual_block = (
                f"\n\nALSO MAKE THIS ADDITIONAL CHANGE (a DESIGN / MATERIAL change, NOT text — do NOT write these "
                f"words as letters): \"{residual}\"."
            )

        if attempt == 2:
            intensity = " The previous attempt misspelled the text — render the EXACT spelling shown above, every letter correct."
        elif attempt >= 3:
            intensity = " FINAL attempt — the lettering MUST be spelled exactly as shown above, letter for letter, no errors."
        else:
            intensity = ""

        return f"""{MASTER_REFINE}

USER REQUEST — TEXT CHANGE ONLY: {replacement_block} Keep the exact same design, backing plate, stones, shape, font style, borders, underlines/lines and metal colour unchanged — ONLY the text/number content changes.{residual_block}{metal_lock}{combine_block}{bail_state}{dcut}

{svc.BACKING_PLATE_RULE} If (and only if) the reference has a backing plate, re-cut it to follow the NEW text's shape, keeping the same border and layered look. If it has none, do not add one.

{svc.PHOTO_PRESERVE_RULE}{layered_block}

{angle_rule}

{centering} Pure white background (#FFFFFF).{intensity}

One image only."""

    # ---------------- CASE 2 / general refine ----------------
    # PROMPT FIDELITY: the user's LITERAL refine words dominate, so named fonts, quoted text and exact
    # colours survive (jewelry needs the client's exact request — never an LLM paraphrase). The
    # LLM-interpreted normalized_prompt is used ONLY as a fallback when the user gave no usable words;
    # a detected font-change directive is APPENDED, never used to replace the user's words.
    # (refinement_intent's structured fields are still consumed by the QA step, just not here.)
    change_desc = (user_prompt or "").strip()
    if not change_desc and refinement_intent and refinement_intent.get("normalized_prompt"):
        change_desc = refinement_intent["normalized_prompt"]
    _font_dir = svc._font_change_directive(user_prompt)
    if _font_dir and _font_dir not in change_desc:
        change_desc = f"{change_desc} {_font_dir}".strip()

    # CASE 4 — empty refine (user gave only an uploaded image and/or style tags, no text edit).
    # Without this the USER REQUEST would be blank. Give a sensible default so the render is useful.
    if not (change_desc or "").strip():
        if image_count and image_count > 1:
            change_desc = (
                "Incorporate the element shown in the additional reference image(s) into this piece "
                "(that is the intent of providing them); keep everything else identical to the base."
            )
        else:
            change_desc = (
                "Re-render this exact piece cleanly and faithfully — keep the design, every stone, "
                "metal colour and proportions identical to the reference."
            )

    if attempt == 2:
        intensity = (" CRITICAL CORRECTION: the previous attempt returned a near-identical image and did NOT apply the "
                     "requested change. You MUST visibly and obviously apply it now — redraw the target area fully if "
                     "needed. Preserve only the parts the user did not ask to change.")
    elif attempt >= 3:
        intensity = (" FINAL attempt — the previous attempts FAILED to apply the change. The requested change MUST be "
                     "clearly and unmistakably visible now; fully re-render the target area. Keep only the untouched parts identical.")
    else:
        intensity = ""

    # FULLY-ICED / add-full-diamonds refine: turning a plain piece iced is a BIG additive edit that
    # MASTER_REFINE's "preserve / change less" bias tends to NO-OP. Inject a strong, positive coverage
    # instruction so the diamonds are actually added across the whole surface.
    _p = (user_prompt or "").lower()
    _iced_refine = (any(w in _p for w in ("iced", "ice out", "bust down", "bustdown", "flooded", "fully covered",
                                          "full diamond", "all diamond", "pave the whole", "cover the whole",
                                          "cover the entire", "cover the pendant", "in diamonds", "all over"))
                    or "stone_coverage" in str((refinement_intent or {}).get("attribute_to_change", "")).lower()
                    or "stone_coverage" in str((refinement_intent or {}).get("change_type", "")).lower())
    iced_clause = ""
    if _iced_refine:
        iced_clause = (" FULLY ICED — ADD 100% DIAMOND COVERAGE: cover the ENTIRE surface of the piece with a SOLID "
                       "SHEET of small micro-pavé diamonds (the whole face becomes diamonds edge to edge), metal "
                       "showing ONLY as the thin prong walls between touching stones. This is a STRONG, OBVIOUS "
                       "change from the plain piece — you MUST visibly add the diamonds, never return it unchanged. "
                       "Keep the SAME silhouette, outline, metal colour and bail.")

    return f"""{MASTER_REFINE}

USER REQUEST (apply exactly, change nothing else): {change_desc}{iced_clause}{combine_block}{metal_lock}{metal_convert}{bail_state}{dcut}

{svc._font_clause(user_prompt, True)}{layered_block}

{angle_rule}

{centering} Pure white background (#FFFFFF).{intensity}

One image only."""
