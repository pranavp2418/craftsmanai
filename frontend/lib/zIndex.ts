/**
 * Centralized z-index scale.
 *
 * WHY: Without a system, z-indexes get added ad-hoc and competing layers
 * (modals, drawers, dropdowns, toasts) end up fighting each other. The
 * scale below allocates clear ranges per layer category so two engineers
 * can pick a z-index without coordination.
 *
 * USAGE:
 *   import { Z_INDEX } from '@/lib/zIndex';
 *   style={{ zIndex: Z_INDEX.modal }}
 *   // or in Tailwind className:
 *   className={`z-[${Z_INDEX.modal}]`}
 *
 * RANGES (don't cross these):
 *   0–9       base content
 *   10–19     elevated content (sticky headers, scroll shadows)
 *   20–29     dropdowns + popovers
 *   30–39     drawers (mobile nav, side panels)
 *   40–49     overlays (modal backdrops)
 *   50–59     modals
 *   60–69     toasts + snackbars (always on top of modals)
 *   70+       reserved for full-screen loading / debug overlays
 */
export const Z_INDEX = {
  // Base
  base:           0,
  raised:         1,

  // Sticky / pinned elements
  stickyHeader:   10,
  scrollShadow:   11,

  // Dropdowns + popovers (above sticky, below drawers)
  dropdown:       20,
  popover:        21,
  tooltip:        22,

  // Drawers (mobile nav, side panels)
  drawerBackdrop: 30,
  drawer:         31,

  // Modal infrastructure (above drawers)
  modalBackdrop:  40,
  modal:          50,
  modalDropdown:  55, // dropdowns inside modals

  // Toasts always sit above everything user-interactive
  toast:          60,

  // Loading / fullscreen overlays
  loading:        70,
  fullscreen:     80,
} as const;

export type ZIndexKey = keyof typeof Z_INDEX;
