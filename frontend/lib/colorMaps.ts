/**
 * Centralized color token maps.
 *
 * WHY: Colors are a UI concern, not a data concern. Data files should store
 * semantic keys (status strings, action types) and components resolve them
 * to Tailwind token class names via these maps. This keeps dark-mode support
 * automatic and prevents raw hex/rgba from leaking into the data layer.
 *
 * USAGE:
 *   import { requestStatusStyle, activityActionStyle } from '@/lib/colorMaps';
 *   const s = requestStatusStyle(request.status);
 *   <span className={`${s.bg} ${s.text}`}>...</span>
 */

// ─── Request / Design Status ─────────────────────────────────────────────────

interface StatusStyle {
  bg: string;
  text: string;
  dot: string;
}

const REQUEST_STATUS: Record<string, StatusStyle> = {
  'Draft':                 { bg: 'bg-tint-gray',          text: 'text-ink-500',         dot: 'bg-ink-400' },
  'Generating':            { bg: 'bg-tint-gray',          text: 'text-ink-500',         dot: 'bg-ink-400' },
  'Ready for Review':      { bg: 'bg-tint-brand',         text: 'text-brand',           dot: 'bg-brand' },
  'Sent to Customer':      { bg: 'bg-tint-warning',       text: 'text-warning-medium',  dot: 'bg-warning-medium' },
  'Awaiting Approval':     { bg: 'bg-tint-danger',        text: 'text-danger',          dot: 'bg-danger' },
  'Approved':              { bg: 'bg-tint-success',       text: 'text-success',         dot: 'bg-success' },
  'Rejected':              { bg: 'bg-tint-danger',        text: 'text-danger',          dot: 'bg-danger' },
  'Sent to Manufacturer':  { bg: 'bg-tint-violet',        text: 'text-violet-deep',     dot: 'bg-violet-deep' },
  'Completed':             { bg: 'bg-tint-emerald',       text: 'text-success-deep',    dot: 'bg-success-deep' },
  'Shared with Customer':  { bg: 'bg-tint-emerald',       text: 'text-success-medium',  dot: 'bg-success-medium' },
  'In Production':         { bg: 'bg-tint-violet',        text: 'text-violet-deep',     dot: 'bg-violet-deep' },
  'Delivered':             { bg: 'bg-tint-gray',          text: 'text-ink-500',         dot: 'bg-ink-400' },
};

const FALLBACK_STATUS: StatusStyle = { bg: 'bg-tint-gray', text: 'text-ink-500', dot: 'bg-ink-400' };

export function requestStatusStyle(status: string): StatusStyle {
  return REQUEST_STATUS[status] ?? FALLBACK_STATUS;
}

// ─── Manufacturer Status ─────────────────────────────────────────────────────

const MANUFACTURER_STATUS: Record<string, StatusStyle> = {
  'Active':          { bg: 'bg-tint-emerald',   text: 'text-success-deep',   dot: 'bg-success-bright' },
  'Inactive':        { bg: 'bg-tint-gray',      text: 'text-ink-500',        dot: 'bg-ink-400' },
  'Sent':            { bg: 'bg-tint-brand-soft', text: 'text-brand',          dot: 'bg-brand' },
  'Viewed':          { bg: 'bg-tint-indigo-soft',text: 'text-indigo-accent',  dot: 'bg-indigo-accent' },
  'Quote Received':  { bg: 'bg-tint-warning',    text: 'text-warning-medium', dot: 'bg-warning' },
  'Approved':        { bg: 'bg-tint-success',    text: 'text-success',        dot: 'bg-success' },
  'In Production':   { bg: 'bg-tint-violet',     text: 'text-violet-deep',    dot: 'bg-violet-deep' },
  'Completed':       { bg: 'bg-tint-emerald',    text: 'text-success-deep',   dot: 'bg-success-deep' },
};

export function manufacturerStatusStyle(status: string): StatusStyle {
  return MANUFACTURER_STATUS[status] ?? FALLBACK_STATUS;
}

// ─── Customer Active/Inactive ────────────────────────────────────────────────

export function customerActiveStyle(status: 'active' | 'inactive') {
  return status === 'active'
    ? { dot: 'bg-success-medium', text: 'text-success-deep', bg: 'bg-tint-emerald-soft' }
    : { dot: 'bg-ink-200', text: 'text-ink-400', bg: 'bg-tint-gray-soft' };
}

// ─── Activity / Timeline Icons ───────────────────────────────────────────────

interface IconStyle {
  color: string;
  bg: string;
}

const ACTION_ICON: Record<string, IconStyle> = {
  'Render completed':      { color: 'text-brand',          bg: 'bg-tint-brand' },
  'Design started':        { color: 'text-violet-accent',  bg: 'bg-tint-violet' },
  'New request':           { color: 'text-violet-accent',  bg: 'bg-tint-violet' },
  'Design shared':         { color: 'text-brand',          bg: 'bg-tint-brand' },
  'Design modified':       { color: 'text-warning',        bg: 'bg-tint-warning' },
  'Feedback received':     { color: 'text-warning',        bg: 'bg-tint-warning' },
  'Design approved':       { color: 'text-success',        bg: 'bg-tint-success' },
  'Manufacturer approved': { color: 'text-success',        bg: 'bg-tint-success' },
  'Quote received':        { color: 'text-warning',        bg: 'bg-tint-warning' },
  'In production':         { color: 'text-violet-deep',    bg: 'bg-tint-violet' },
  'Production started':    { color: 'text-violet-deep',    bg: 'bg-tint-violet' },
  'Sheet generated':       { color: 'text-brand',          bg: 'bg-tint-brand' },
  'Shipped':               { color: 'text-brand',          bg: 'bg-tint-brand' },
  'Delivered':             { color: 'text-ink-500',        bg: 'bg-tint-gray' },
};

const FALLBACK_ICON: IconStyle = { color: 'text-ink-500', bg: 'bg-tint-gray' };

export function activityActionStyle(action: string): IconStyle {
  return ACTION_ICON[action] ?? FALLBACK_ICON;
}

// ─── Specialty Tags (Manufacturers) ──────────────────────────────────────────

const SPECIALTY: Record<string, { bg: string; color: string }> = {
  'Gold Specialist':     { bg: 'bg-tint-warning-soft', color: 'text-warning-dark' },
  'Diamond Setting':     { bg: 'bg-tint-brand-soft',   color: 'text-brand' },
  'Custom Engraving':    { bg: 'bg-tint-violet-soft',  color: 'text-violet-accent' },
  'Platinum Expert':     { bg: 'bg-tint-gray-soft',    color: 'text-ink-600' },
  'Stone Setting':       { bg: 'bg-tint-emerald-soft', color: 'text-success-deep' },
  'Chain Work':          { bg: 'bg-tint-brand-soft',   color: 'text-brand' },
  'Casting':             { bg: 'bg-tint-warning-soft', color: 'text-warning-dark' },
  'Filigree Work':       { bg: 'bg-tint-violet-soft',  color: 'text-violet-accent' },
  'Polishing & Finish':  { bg: 'bg-tint-emerald-soft', color: 'text-success-deep' },
  'Pearl Specialist':    { bg: 'bg-tint-warning-soft', color: 'text-warning-dark' },
  'CAD Modeling':        { bg: 'bg-tint-brand-soft',   color: 'text-brand' },
};

const FALLBACK_SPECIALTY = { bg: 'bg-tint-gray-soft', color: 'text-ink-600' };

export function specialtyStyle(specialty: string) {
  return SPECIALTY[specialty] ?? FALLBACK_SPECIALTY;
}

// ─── Customer Role Tags ──────────────────────────────────────────────────────

const ROLE: Record<string, { bg: string; text: string; dot: string }> = {
  'VIP':        { bg: 'bg-tint-warning-soft', text: 'text-warning-dark',  dot: 'bg-warning' },
  'Returning':  { bg: 'bg-tint-brand-soft',   text: 'text-brand',         dot: 'bg-brand' },
  'New':        { bg: 'bg-tint-emerald-soft',  text: 'text-success-deep',  dot: 'bg-success-medium' },
  'Wholesale':  { bg: 'bg-tint-violet-soft',   text: 'text-violet-accent', dot: 'bg-violet-accent' },
  'Inactive':   { bg: 'bg-tint-gray-soft',     text: 'text-ink-500',       dot: 'bg-ink-400' },
};

const FALLBACK_ROLE = { bg: 'bg-tint-gray-soft', text: 'text-ink-600', dot: 'bg-ink-400' };

export function customerRoleStyle(role: string) {
  return ROLE[role] ?? FALLBACK_ROLE;
}

// ─── Avatar Color Palette ────────────────────────────────────────────────────
// Instead of arbitrary hex, pick from a fixed palette of Tailwind classes.

const AVATAR_PALETTE = [
  'bg-surface-avatar-blue',  // #BFDBFE
  'bg-violet-accent',        // #8B5CF6
  'bg-brand',                // #3B82F6
  'bg-success-medium',       // #10B981
  'bg-warning',              // #F59E0B
  'bg-danger-bright',        // #EF4444
  'bg-indigo-accent',        // #6366F1
] as const;

/** Deterministic avatar color from a string (name or id). */
export function avatarClass(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

// ─── Metal / Material Colors ─────────────────────────────────────────────────
// Used in RenderCard for metal variant selector.

export interface MetalStyle {
  bg: string;
  border: string;
  label: string;
  filter: string;
  dot: string;
}

export const METALS: MetalStyle[] = [
  { bg: 'bg-gold',       border: 'border-gold', label: 'Yellow Gold', filter: 'none',                                    dot: 'bg-gold' },
  { bg: 'bg-stone-300',  border: 'border-stone-300', label: 'White Gold', filter: 'saturate(0) brightness(1.1)',          dot: 'bg-stone-300' },
  { bg: 'bg-stone-400',  border: 'border-stone-400', label: 'Platinum',   filter: 'saturate(0) brightness(1.05)',        dot: 'bg-stone-400' },
  { bg: 'bg-gold-muted', border: 'border-gold-muted', label: 'Rose Gold', filter: 'hue-rotate(-15deg) saturate(1.2)',    dot: 'bg-gold-muted' },
];

// ─── Customer-role tag (used in ShareCustomerModal) ─────────────────────────
// Maps a customer's role string to a short display tag + badge styling.
// Multiple roles can map to the same tag (e.g. VIP and Elite both become "VIP").

export interface CustomerTag {
  label: string;
  bg: string;
  text: string;
}

export function customerTag(role: string): CustomerTag {
  if (role.includes('VIP') || role.includes('Elite'))
    return { label: 'VIP',            bg: 'bg-tint-brand',   text: 'text-brand' };
  if (role.includes('Premium'))
    return { label: 'Repeat Client',  bg: 'bg-tint-success', text: 'text-success' };
  if (role.includes('New'))
    return { label: 'New',            bg: 'bg-tint-gray',    text: 'text-ink-500' };
  if (role.includes('Regular'))
    return { label: 'Budget',         bg: 'bg-tint-warning', text: 'text-warning-medium' };
  if (role.includes('Fashion') || role.includes('Wholesale'))
    return { label: 'Wholesale',      bg: 'bg-tint-violet',  text: 'text-violet-deep' };
  return { label: role, bg: 'bg-tint-gray', text: 'text-ink-500' };
}
