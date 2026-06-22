"""Per-jewellery-type prompt profiles (the "har jewellery ka alag" layer).

Each profile declares ONLY policy/data — no prompt text and no openai_service import — so it
can be reused by both the initial and the refine builders. The builders read these policies
to decide which coherent opening and which opt-in capability modules a given type gets, so a
ring never receives nameplate rules and a pendant always gets a coherent bail instruction.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import FrozenSet


# Capability-module keys (opt-in rule blocks the builders may attach for text-only renders).
MODULE_TEXT = "text"        # nameplate / lettering rules (DOT_CONNECTION etc.)
MODULE_STONE = "stone"      # stone-setting quality + default arrangement
MODULE_SKETCH = "sketch"    # sketch -> real jewelry normalization
MODULE_BACKING = "backing"  # backing-plate handling
MODULE_LAYERED = "layered"  # stepped / two-layer structure


# Bail policy values
BAIL_NONE = "none"                  # this type never gets a bail (ring, earring, watch...)
BAIL_ADD_IF_MISSING = "add_if_missing"  # pendant-like: keep reference bail, else add one
BAIL_PRESERVE = "preserve"          # keep a bail only if present, never add

# Text policy values
TEXT_NEVER = "never"          # never attach lettering rules
TEXT_IF_DETECTED = "if_detected"  # attach only when letters/numbers are detected in the prompt
TEXT_PRIMARY = "primary"      # this type is lettering-first (pendants, signet, grillz)


@dataclass(frozen=True)
class JewelleryProfile:
    """Policy for one jewellery type. Pure data — safe to import anywhere."""

    key: str
    bail_policy: str = BAIL_NONE
    text_policy: str = TEXT_IF_DETECTED
    default_metal: str = "yellow gold"     # used for text-only generation
    stones_by_default: bool = False
    modules: FrozenSet[str] = frozenset({MODULE_STONE})
    front_view_default: bool = True        # text-only default camera

    def allows(self, module: str) -> bool:
        return module in self.modules


def _p(key, bail, text, modules, front=True, metal="yellow gold"):
    return JewelleryProfile(
        key=key,
        bail_policy=bail,
        text_policy=text,
        default_metal=metal,
        modules=frozenset(modules),
        front_view_default=front,
    )


# ---------------------------------------------------------------------------
# The registry. Add a new jewellery type here = one entry, no builder changes.
# ---------------------------------------------------------------------------
JEWELLERY_PROFILES = {
    # Hanging pieces — bail required, lettering-first.
    "pendant": _p("pendant", BAIL_ADD_IF_MISSING, TEXT_PRIMARY,
                  {MODULE_TEXT, MODULE_STONE, MODULE_SKETCH, MODULE_BACKING, MODULE_LAYERED}, front=False),
    "necklace": _p("necklace", BAIL_ADD_IF_MISSING, TEXT_IF_DETECTED,
                   {MODULE_TEXT, MODULE_STONE, MODULE_LAYERED}, front=False),

    # Rings (signet / class rings are just rings — no separate profile).
    "ring": _p("ring", BAIL_NONE, TEXT_IF_DETECTED,
               {MODULE_TEXT, MODULE_STONE, MODULE_SKETCH}),

    # Other wearables.
    "earring": _p("earring", BAIL_NONE, TEXT_NEVER, {MODULE_STONE, MODULE_SKETCH}),
    "bracelet": _p("bracelet", BAIL_NONE, TEXT_IF_DETECTED, {MODULE_STONE, MODULE_LAYERED}),
    "grill": _p("grill", BAIL_NONE, TEXT_IF_DETECTED, {MODULE_TEXT, MODULE_STONE}),
    "watch": _p("watch", BAIL_NONE, TEXT_NEVER, {MODULE_STONE}),
    "anklet": _p("anklet", BAIL_NONE, TEXT_NEVER, {MODULE_STONE}),

    # Fallback for "Custom" / unknown free-text types.
    "custom": _p("custom", BAIL_NONE, TEXT_IF_DETECTED, {MODULE_TEXT, MODULE_STONE, MODULE_SKETCH}),
}


def resolve_profile(item_type: str) -> JewelleryProfile:
    """Map a free-text jewellery_type to a profile.

    Ordering mirrors openai_service._type_form_clause: check collision-prone substrings
    (earring/cufflink/signet contain "ring") BEFORE the bare "ring" check.
    """
    t = (item_type or "").strip().lower()

    if "earring" in t or "ear ring" in t:
        return JEWELLERY_PROFILES["earring"]
    # Signet / class rings are just rings — they resolve to the ring profile below.
    if "ring" in t and "earring" not in t:
        return JEWELLERY_PROFILES["ring"]
    if "bracelet" in t or "bangle" in t or ("cuff" in t and "link" not in t):
        return JEWELLERY_PROFILES["bracelet"]
    if "grill" in t or "grillz" in t:
        return JEWELLERY_PROFILES["grill"]
    if "watch" in t:
        return JEWELLERY_PROFILES["watch"]
    if "anklet" in t:
        return JEWELLERY_PROFILES["anklet"]
    if any(k in t for k in ["pendant", "necklace", "charm"]):
        return JEWELLERY_PROFILES["pendant"] if ("pendant" in t or "charm" in t) else JEWELLERY_PROFILES["necklace"]

    # Generic / blank / custom -> the product is predominantly pendants, but we do NOT force a
    # bail onto a named custom object; the "custom" profile is bail-less and lettering-on-detect.
    if t in ("", "jewelry", "jewellery", "custom", "custom object", "other"):
        return JEWELLERY_PROFILES["pendant"]
    return JEWELLERY_PROFILES["custom"]
