
function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === "") {
    // Throw during module load so misconfiguration is caught early.
    throw new Error(
      `[env] Missing required environment variable: ${name}. ` +
        `Add it to your .env.local file (see .env.example for the full list).`,
    );
  }
  return value;
}

function optional(value: string | undefined): string | undefined {
  return value && value.trim() !== "" ? value : undefined;
}

/**
 * Public environment variables — safe to use in client components.
 * These are inlined into the JS bundle at build time, so they end up in the browser.
 * Never put secrets here.
 */
export const env = {
  NEXT_PUBLIC_BACKEND_URL: required("NEXT_PUBLIC_BACKEND_URL", process.env.NEXT_PUBLIC_BACKEND_URL),
} as const;

/**
 * Server-only environment variables. Importing this module on the client
 * is safe (the values will be undefined), but you should only USE them in
 * Server Components, Route Handlers, or server actions.
 */
export const serverEnv = {
  NODE_ENV: (process.env.NODE_ENV ?? "development") as
    | "development"
    | "production"
    | "test",
} as const;

/**
 * Call this from a server entry point (e.g. a route handler or middleware)
 * if you want a hard fail when required server env is missing in production.
 *
 * Example:
 *   if (serverEnv.NODE_ENV === "production") assertServerEnv();
 */
export function assertServerEnv(): void {
  // Add required() checks here as your backend integration lands. For example:
  //   required("DATABASE_URL", process.env.DATABASE_URL);
  //   required("STRIPE_SECRET_KEY", process.env.STRIPE_SECRET_KEY);
  void required; // keep `required` referenced so it's not tree-shaken as unused
}
