# Font library (glyph templates)

Drop `.ttf` / `.otf` files here for every named font the client offers.

The file name (minus extension, `_`/`-` -> space, lowercased) is the lookup name:
  road_rage.ttf  -> matches "Road Rage Font"
  old_english.otf -> matches "Old English"

Add synonyms in app/services/font_template_service.py -> FONT_ALIASES.

When a user prompt names a font we have here, the text is rendered in that EXACT font
and passed to the image model as a reference, guaranteeing identical letterforms every run.
If we DON'T have the font file, the pipeline falls back to the text-description path.
