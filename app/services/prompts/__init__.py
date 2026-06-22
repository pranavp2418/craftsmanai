"""Config-registry prompt system for jewelry image generation.

This package replaces the old monolithic prompt builders with a layered design so
contradictory / duplicate instructions can no longer stack:

    LAYER 1  common.py   -> COMMON core, priority order, metal logic (shared by ALL types)
    LAYER 2  profiles.py -> per-jewellery-type policy (bail / text / stones / modules)
    LAYER 3  modules      -> opt-in capability rule-blocks (attached only when relevant)
    LAYER 4  initial.py  -> assembles an initial-generation prompt

Design rules:
  * These modules import NOTHING from openai_service at import time (no circular imports).
    The actual rule-block TEXT and detection helpers live in openai_service and are read
    via a lazy `import app.services.openai_service as svc` inside the build functions, so
    there is a single source of truth for every rule string.
  * The image-input prompt is intentionally kept SHORT (empirically gpt-image-2 reproduces
    dense pavé only with minimal prompts); profile capability modules apply to text-only.
  * `common.py` and `profiles.py` are written to be reused by the refine builder too.
"""

from .profiles import JewelleryProfile, JEWELLERY_PROFILES, resolve_profile
from .common import COMMON_SYSTEM_PROMPT, PRIORITY_HEADER, OUTPUT_CONTRACT, metal_lock_clause
from .initial import build_initial_prompt
from .refine import build_refine_prompt

__all__ = [
    "JewelleryProfile",
    "JEWELLERY_PROFILES",
    "resolve_profile",
    "COMMON_SYSTEM_PROMPT",
    "PRIORITY_HEADER",
    "OUTPUT_CONTRACT",
    "metal_lock_clause",
    "build_initial_prompt",
    "build_refine_prompt",
]
