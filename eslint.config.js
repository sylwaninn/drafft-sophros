// Lint: correctness, hooks and accessibility. Formatting is Prettier's job. shadcn/ui components
// (app/components/ui) are vendored as generated: linted for correctness only.
import js from "@eslint/js";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["build/", ".react-router/", ".wrangler/", "worker-configuration.d.ts", "node_modules/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["**/.server/*"], message: "Server-only module: import it from loaders and actions only.", allowTypeImports: true },
          ],
        },
      ],
    },
  },
  {
    files: ["app/**/*.tsx"],
    ignores: ["app/components/ui/**"],
    ...jsxA11y.flatConfigs.recommended,
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      // Members' photos, videos and voice intros come without captions; there is nothing to caption them with.
      "jsx-a11y/media-has-caption": "off",
    },
  },
  {
    // Server code may import server modules.
    files: ["app/routes/**", "app/lib/.server/**", "app/root.tsx", "app/entry.server.tsx", "workers/**"],
    rules: { "no-restricted-imports": "off" },
  },
);
