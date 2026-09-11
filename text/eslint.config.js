import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import sonarjs from "eslint-plugin-sonarjs";
import prettierRecommended from "eslint-plugin-prettier/recommended";

// chaff は文章の抑制債務を測る道具なので、自分のコードに抑制が無いことに意味がある。
// 段は ~/ss/llm/ever-better から取っている。coding/ の scoria と同じ構成。
export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "test/fixtures/**"] },

  {
    linterOptions: {
      reportUnusedDisableDirectives: "error",
      // eslint-disable は linter からも suppression の集計からも違反を消す。
      // そのどちらも数えられない免除を、このリポジトリでは持たない。
      noInlineConfig: true,
    },
  },

  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  sonarjs.configs.recommended,
  // 最後に置く。formatter と争うルールを全部切るため。
  prettierRecommended,

  {
    languageOptions: {
      globals: globals.node,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },

  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/consistent-type-assertions": ["error", { assertionStyle: "never" }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^__" }],
      "@typescript-eslint/prefer-readonly": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "no-console": "off",
    },
  },

  {
    rules: {
      "no-var": "error",
      "prefer-const": "error",
      "no-param-reassign": "error",
      "no-else-return": ["error", { allowElseIf: false }],
      "sonarjs/no-collapsible-if": "error",
    },
  },

  {
    rules: {
      "max-lines": ["error", { max: 300, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["error", { max: 60, skipBlankLines: true, skipComments: true }],
      complexity: ["error", 15],
      "max-depth": ["error", 4],
      "max-nested-callbacks": ["error", 4],
      "max-params": ["error", 6],
      "sonarjs/cognitive-complexity": ["error", 15],
    },
  },

  {
    // arrange ブロックは性質として重複し、その長さは理解の問題ではない。
    files: ["test/**/*.ts"],
    rules: {
      "max-lines": "off",
      "max-lines-per-function": "off",
      "sonarjs/no-duplicate-string": "off",
      // node:test の describe / it が返す promise は runner が持つ。await するのは誤りで、
      // 全ブロックに void を付けるのは全行のノイズになる。
      "@typescript-eslint/no-floating-promises": "off",
    },
  },

  {
    // 設定ファイルと bin のラッパーは TypeScript program の一部ではない。
    files: ["eslint.config.js", "packages/*/bin/*.js"],
    languageOptions: { parserOptions: { projectService: false } },
    ...tseslint.configs.disableTypeChecked,
  },
);
