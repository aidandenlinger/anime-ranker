// @ts-check

import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import { jsdoc } from "eslint-plugin-jsdoc";
import eslintPluginUnicorn from "eslint-plugin-unicorn";

export default defineConfig(
  {
    ignores: [
      // This config file isn't part of the TypeScript project
      "eslint.config.mjs",
      // I like creating placeholder files without committing them
      "**/todo_*",
    ],
  },
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  eslintPluginUnicorn.configs.recommended,
  jsdoc({
    config: "flat/recommended-typescript-error",
    rules: {
      // Force jsdocs on all relevant pieces of code
      "jsdoc/require-jsdoc": [
        "error",
        {
          require: {
            ClassDeclaration: true,
            FunctionDeclaration: true,
            MethodDefinition: true,
          },
          // Also force on Typescript types/interfaces/properties
          contexts: [
            "TSTypeAliasDeclaratin",
            "TSInterfaceDeclaration",
            "TSMethodSignature",
            "TSPropertySignature",
          ],
        },
      ],
    },
  }),
  {
    rules: {
      // I want my switch cases exhaustive
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      // Keep imports consistent.
      // I don't love the settings and lack of autofixing, but something is better than nothing :shrug:
      "sort-imports": "error",
    },
  },
  {
    // Enable typechecked lints
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);
