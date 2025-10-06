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
      // I like a consistent standard and I'm prone to flipflopping without enforcement
      "@typescript-eslint/naming-convention": "error",

      // Keep imports consistent.
      // I don't love the settings and lack of autofixing, but something is better than nothing :shrug:
      "sort-imports": "error",

      // If it can be a readonly private variable, I'd prefer it to
      "@typescript-eslint/prefer-readonly": "error",

      // This is too strict for me, using third party libraries and URL types
      // without a builtin "DeepReadonly" type in Typescript.
      // It's also enforced on arrow functions which is really verbose for my usecase
      // https://github.com/typescript-eslint/typescript-eslint/issues/3615
      // I like it in principal, but it's more annoying than useful
      // "@typescript-eslint/prefer-readonly-parameter-types": "error",

      // I want my switch cases exhaustive
      "@typescript-eslint/switch-exhaustiveness-check": "error",

      /// I want to ignore this error for vars that start with _
      // config from https://typescript-eslint.io/rules/no-unused-vars/#faqs
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "all",
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    files: ["**/**.test.ts"],
    rules: {
      // https://github.com/nodejs/node/issues/51292#issuecomment-3151271587
      // the node test suite issues dangling promises which the runner handles
      "@typescript-eslint/no-floating-promises": [
        "error",
        {
          allowForKnownSafeCalls: [
            { from: "package", name: ["suite", "test"], package: "node:test" },
          ],
        },
      ],
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
