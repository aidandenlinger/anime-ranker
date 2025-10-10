// @ts-check

/* eslint-disable @eslint-community/eslint-comments/disable-enable-pair -- we want to disable some rules filewide because this is a config file */
/* eslint-disable n/no-unpublished-import -- this file is a config, not a part of the actual project */
/* eslint-disable @typescript-eslint/naming-convention -- the strings for rules are not camelcase, this is a config file without variables */

import { defineConfig } from "eslint/config";
import eslint from "@eslint/js";
import { jsdoc } from "eslint-plugin-jsdoc";
import pluginEslintComments from "@eslint-community/eslint-plugin-eslint-comments/configs";
import pluginNode from "eslint-plugin-n";
import pluginUnicorn from "eslint-plugin-unicorn";
import tseslint from "typescript-eslint";

export default defineConfig(
  {
    ignores: [
      // I like creating placeholder files without committing them
      "**/todo_*",
    ],
  },
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  pluginUnicorn.configs.recommended,
  pluginNode.configs["flat/recommended"],
  // @ts-expect-error -- https://github.com/eslint-community/eslint-plugin-eslint-comments/pull/246 will add a proper declaration file
  pluginEslintComments.recommended,
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
            "PropertyDefinition",
            "TSTypeAliasDeclaration",
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
      // enforce curly braces even for one-line if blocks, makes refactoring easier
      curly: "error",

      // unexpected behavior if case detault isn't last
      "default-case-last": "error",

      // Especially with unicorn/no-null, not using === is almost certainly an error
      eqeqeq: "error",

      // Ban some practices - inspired by biome's recommended lints
      "no-constructor-return": "error", // unneeded and undesired
      "no-eval": "error", // eval is a huge code smell
      "no-extra-label": "error", // don't use labels if you don't have to
      "no-label-var": "error", // warn if there's a label with the same name as a variable
      "no-lonely-if": "error", // enforce usage of "else if" instead of "else { if { }}"
      "no-sequences": "error", // i have never intentionally used the comma operator
      "no-template-curly-in-string": "error", // flag when i'm using template syntax in a regular string
      "no-undef-init": "error", // don't explicitly set variables to undefined
      "no-unneeded-ternary": "error", // "bar ? bar : 1" => "bar || 1"
      "no-useless-concat": "error", // avoid adding string literals
      "no-useless-rename": "error", // remove renames of "a" to "a"

      // These enforce modern code practices that I'm using anyways
      "prefer-arrow-callback": "error", // arrow funcs over func expressions
      "prefer-exponentiation-operator": "error", // use ** instead of Math.pow
      "prefer-regex-literals": "error", // use inline regexes
      "prefer-template": "error", // use string templates

      // Keep imports consistent.
      // I don't love the settings and lack of autofixing, but something is better than nothing :shrug:
      "sort-imports": "error",

      // If a default param isn't last, it can't be omitted
      "@typescript-eslint/default-param-last": "error",

      // I like a consistent standard and I'm prone to flipflopping without enforcement
      "@typescript-eslint/naming-convention": "error",

      // Enforce documentation of numbers
      "@typescript-eslint/no-magic-numbers": [
        "error",
        {
          // Common values that don't need documentation
          ignore: [0, 1],
          // jsdoc enforces documentation of these
          ignoreReadonlyClassProperties: true,
        },
      ],

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

      // Enforces modern async node functions
      "n/no-sync": "error",
      // Similar to no-sync, also enforces on an import level
      "n/prefer-promises/fs": "error",
      "n/prefer-promises/dns": "error",
      // Import node libraries with a prefix, makes it easy to find node deps
      "n/prefer-node-protocol": "error",
      // Enforce current habits with global objects - web APIs can be global, node specific classes should be imported
      "n/prefer-global/console": "error",
      "n/prefer-global/url": "error",
      "n/prefer-global/url-search-params": "error",
      "n/prefer-global/process": ["error", "never"],

      // Explanations are essential when disabling an eslint rule
      "@eslint-community/eslint-comments/require-description": "error",
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
        projectService: {
          // https://typescript-eslint.io/packages/parser#allowdefaultproject
          // Lint this file without adding it to a typescript project
          allowDefaultProject: ["eslint.config.mjs"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);
