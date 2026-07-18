'use client';

/**
 * Theme + appearance preferences.
 *
 * Provides:
 *   - `theme`        : 'light' | 'dark' | 'system'   → toggles the `dark` class on <html>
 *   - `density`      : 'comfortable' | 'compact'     → sets `data-density` on <body>
 *   - `animations`   : boolean                       → sets `data-animations` on <body>
 *
 * All preferences persist to localStorage. The provider also listens to
 * `prefers-color-scheme` for the 'system' theme option so the UI follows the
 * OS in real time.
 *
 * Wiring:
 *   - `app/layout.tsx` wraps children in <ThemeProvider>
 *   - `globals.css` has the dark-mode body bg + density/animations CSS
 *   - Tailwind config has `darkMode: 'class'`
 *
 * Components consume via `useAppearance()`.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';

export type Theme = 'light' | 'dark' | 'system';
export type Density = 'comfortable' | 'compact';

interface AppearanceContextValue {
  theme: Theme;
  density: Density;
  animations: boolean;
  setTheme: (t: Theme) => void;
  setDensity: (d: Density) => void;
  setAnimations: (v: boolean) => void;
  /** The resolved theme after accounting for 'system' (always 'light' or 'dark'). */
  resolvedTheme: 'light' | 'dark';
}

const STORAGE_KEY_THEME = 'appearance:theme';
const STORAGE_KEY_DENSITY = 'appearance:density';
const STORAGE_KEY_ANIMATIONS = 'appearance:animations';
const DEFAULT_NAVIGATION_COLOR = '#3676E0';

const AppearanceContext = createContext<AppearanceContextValue | undefined>(undefined);

function getStored<T extends string>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw as T;
  } catch {
    return fallback;
  }
}

function getStoredBool(key: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === 'true';
  } catch {
    return fallback;
  }
}

let transitionTimer: ReturnType<typeof setTimeout> | undefined;

function applyTheme(theme: Theme, animate = false): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'light';
  const isSystemDark = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const resolved = theme === 'system' ? (isSystemDark ? 'dark' : 'light') : theme;
  const html = document.documentElement;

  if (animate) {
    // Add the transitioning class FIRST, on its own frame, so every element
    // gets `transition-property: ...` applied. Then on the NEXT frame, toggle
    // the `.dark` class — now the CSS-variable swap interpolates instead of
    // snapping. Without this two-frame split, the new theme would paint first
    // and the transition would have nothing to animate.
    html.classList.add('theme-transitioning');
    clearTimeout(transitionTimer);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        html.classList.toggle('dark', resolved === 'dark');
      });
    });

    // Total transition envelope is ~600ms (longest property: box-shadow).
    // Hold the class slightly longer than that so the tail of the easing
    // doesn't snap when the class is removed.
    transitionTimer = setTimeout(() => {
      html.classList.remove('theme-transitioning');
    }, 700);
  } else {
    // No animation: toggle immediately (used on initial hydration).
    html.classList.toggle('dark', resolved === 'dark');
  }

  return resolved;
}

function applyDensity(density: Density) {
  if (typeof document === 'undefined') return;
  document.body.setAttribute('data-density', density);
}

function applyAnimations(animations: boolean) {
  if (typeof document === 'undefined') return;
  document.body.setAttribute('data-animations', animations ? 'on' : 'off');
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // On first render we don't know what's in localStorage yet (SSR). We default
  // to sensible values and re-sync after mount in the effect below.
  const [localTheme, setLocalThemeState] = useState<Theme>('light');
  const [density, setDensityState] = useState<Density>('comfortable');
  const [animations, setAnimationsState] = useState(true);
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  const [hydrated, setHydrated] = useState(false);

  const pathname = usePathname();

  const theme: Theme = localTheme;

  // Hydrate from localStorage on mount.
  useEffect(() => {
    const stored = getStored<Theme>(STORAGE_KEY_THEME, 'system');
    const d = getStored<Density>(STORAGE_KEY_DENSITY, 'comfortable');
    const a = getStoredBool(STORAGE_KEY_ANIMATIONS, true);

    setLocalThemeState(stored);
    setDensityState(d);
    setAnimationsState(a);
    setHydrated(true);
  }, [pathname]);

  // Enforce appearance rules based on route
  useEffect(() => {
    if (!hydrated) return;
    const isDashboard = pathname?.startsWith('/retailer') || pathname?.startsWith('/manufacturer');
    const isAuth = pathname?.startsWith('/login') || pathname?.startsWith('/signup') || pathname?.startsWith('/new-login') || pathname?.startsWith('/new-signup');
    const shouldForceLight = !isDashboard && !isAuth;
    const targetTheme = shouldForceLight ? 'light' : theme;
    const targetDensity = shouldForceLight ? 'comfortable' : density;
    const targetAnimations = shouldForceLight ? true : animations;

    setResolvedTheme(applyTheme(targetTheme));
    applyDensity(targetDensity);
    applyAnimations(targetAnimations);
  }, [hydrated, pathname, theme, density, animations]);

  // Listen to system color-scheme changes when theme === 'system'.
  useEffect(() => {
    const isDashboard = pathname?.startsWith('/retailer') || pathname?.startsWith('/manufacturer');
    const isAuth = pathname?.startsWith('/login') || pathname?.startsWith('/signup') || pathname?.startsWith('/new-login') || pathname?.startsWith('/new-signup');
    const shouldForceLight = !isDashboard && !isAuth;
    if (!hydrated || theme !== 'system' || shouldForceLight) return;
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (!shouldForceLight) setResolvedTheme(applyTheme('system', true));
    };
    // Older Safari uses `addListener`; modern uses `addEventListener`.
    media.addEventListener?.('change', onChange);
    media.addListener?.(onChange);
    return () => {
      media.removeEventListener?.('change', onChange);
      media.removeListener?.(onChange);
    };
  }, [hydrated, theme, pathname]);

  const setTheme = useCallback((t: Theme) => {
    setLocalThemeState(t);
    try {
      window.localStorage.setItem(STORAGE_KEY_THEME, t);
    } catch {}
  }, []);

  const setDensity = useCallback((d: Density) => {
    setDensityState(d);
    try {
      window.localStorage.setItem(STORAGE_KEY_DENSITY, d);
    } catch {}
  }, []);

  const setAnimations = useCallback((v: boolean) => {
    setAnimationsState(v);
    try {
      window.localStorage.setItem(STORAGE_KEY_ANIMATIONS, String(v));
    } catch {}
  }, []);

  const value = useMemo<AppearanceContextValue>(
    () => ({ theme, density, animations, setTheme, setDensity, setAnimations, resolvedTheme }),
    [theme, density, animations, setTheme, setDensity, setAnimations, resolvedTheme]
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance(): AppearanceContextValue {
  const ctx = useContext(AppearanceContext);
  if (!ctx) {
    throw new Error('useAppearance must be used inside <ThemeProvider>');
  }
  return ctx;
}
