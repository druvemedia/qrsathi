import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  { ignores: [".next/**", ".next-*/**", "node_modules/**", "public/**", "prisma/**", "uploads/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Allowed: existing code uses `any` at library boundaries (recharts, zxing).
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" }],
      // Security-relevant rules stay errors.
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "react/no-danger-with-children": "error",
    },
  },
  {
    files: ["scripts/**", "*.mjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
];

export default config;
