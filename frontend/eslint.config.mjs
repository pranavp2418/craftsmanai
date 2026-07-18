import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Catch accidental `any` types — was disabled in the prototype, now enforced.
      "@typescript-eslint/no-explicit-any": "error",

      // Warn on unused imports/vars so the codebase stays tidy.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],

      // `console.log` is fine in dev but should not ship to prod. Allow `warn`/`error`.
      "no-console": ["warn", { allow: ["warn", "error"] }],

      // Mandatory `rel="noopener noreferrer"` on target="_blank" links.
      "react/jsx-no-target-blank": [
        "error",
        { allowReferrer: false, enforceDynamicLinks: "always" },
      ],
    },
  },
  {
    // The Next.js plugin warns on `<img>` — we keep them intentionally for now
    // (see README "Mock data & images" section). Downgrade to warn so it doesn't
    // block builds, and so the developer knows to migrate to `next/image` later.
    rules: {
      "@next/next/no-img-element": "warn",
    },
  },
];

export default eslintConfig;
