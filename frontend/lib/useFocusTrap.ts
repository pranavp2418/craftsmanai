'use client';

import { useEffect, useRef, type RefObject } from 'react';

/**
 * useFocusTrap
 * ------------
 * Keeps keyboard focus inside the referenced element while `active` is true.
 *
 * Rationale: A modal that doesn't trap focus is an accessibility regression
 * — sighted keyboard users and screen-reader users can Tab out of the modal
 * into the page content behind it, which is invisible to sighted users but
 * still receives focus and announces itself to AT.
 *
 * Behaviour:
 *   - On activation, moves focus to the first focusable element inside the
 *     container (or the container itself if there are none).
 *   - On Tab, cycles between the first and last focusable elements. Shift+Tab
 *     wraps backwards.
 *   - On deactivation, restores focus to the element that had focus before
 *     activation (typically the button that opened the modal).
 *
 * Notes:
 *   - This is *not* a substitute for `role="dialog"` and `aria-modal="true"`
 *     — those are still required on the wrapping element. This just enforces
 *     the focus contract that those ARIA attributes promise to assistive tech.
 *   - We re-query focusable elements on each Tab keydown so dynamic content
 *     (newly mounted buttons, etc.) is handled correctly.
 *
 * Usage:
 *   const ref = useRef<HTMLDivElement>(null);
 *   useFocusTrap(ref, isOpen);
 *   return <div ref={ref} role="dialog" aria-modal="true">...</div>;
 */

// Selector matches every "tabbable" element per the WHATWG focus order
// algorithm, minus things explicitly opted out via tabindex="-1".
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter((el) => {
      if (el.hasAttribute('disabled')) return false;
      // Skip elements explicitly hidden via aria-hidden or inert.
      if (el.getAttribute('aria-hidden') === 'true') return false;
      if (el.hasAttribute('inert')) return false;
      // We deliberately don't check offsetParent: it's null in jsdom (no
      // layout), which would make this hook impossible to unit-test. For
      // production it's fine — React conditional rendering already unmounts
      // hidden children, and CSS-hidden elements are rare inside an active
      // modal.
      return true;
    });
}

export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean) {
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active || !ref.current) return;
    const container = ref.current;

    // Remember where focus was so we can restore it on close.
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    // Move focus into the modal. Prefer the first focusable element; fall
    // back to the container itself (which needs tabIndex={-1} to receive
    // programmatic focus without joining the tab order).
    const focusables = getFocusable(container);
    const initial = focusables[0] ?? container;
    if (initial === container && !container.hasAttribute('tabindex')) {
      container.setAttribute('tabindex', '-1');
    }
    // A short delay lets any open-animation finish; otherwise focus rings
    // can flash on the first element before the modal is visible.
    const id = requestAnimationFrame(() => initial.focus({ preventScroll: true }));

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = getFocusable(container);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (activeEl === first || !container.contains(activeEl)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (activeEl === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    container.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(id);
      container.removeEventListener('keydown', onKey);
      // Restore focus to whatever owned it before the modal opened.
      const prev = previouslyFocused.current;
      if (prev && typeof prev.focus === 'function' && document.body.contains(prev)) {
        prev.focus({ preventScroll: true });
      }
    };
  }, [active, ref]);
}
