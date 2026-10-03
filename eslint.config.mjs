import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

/**
 * Flat ESLint config enforcing the CLAUDE.md code-style rules across the monorepo:
 *  - curly (always braces, no single-line if/else)
 *  - booleans read as a question (is/has/can/should/… prefix) — typed rule on source
 */
export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "**/.turbo/**", "prototypes/**"] },

  // Base rules for all TS/TSX.
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      curly: ["error", "all"],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },

  // Typed rules — boolean naming — on package/app source only (not tests or config files,
  // which the package tsconfigs exclude).
  {
    files: ["packages/*/src/**/*.ts", "apps/*/src/**/*.{ts,tsx}"],
    ignores: ["**/*.test.ts", "**/*.test.tsx"],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: "variable",
          types: ["boolean"],
          format: ["PascalCase"],
          prefix: ["is", "has", "can", "should", "will", "did", "was", "are", "allow"],
        },
      ],
    },
  },
);
