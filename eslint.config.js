// eslint.config.js
const globals = require('globals');
const js = require('@eslint/js');
const prettierConfig = require('eslint-config-prettier'); // Prettier競合ルール無効化用
// const nodePlugin = require('eslint-plugin-node'); // 一時的に削除
const jestPlugin = require('eslint-plugin-jest');
const promisePlugin = require('eslint-plugin-promise');
const securityPlugin = require('eslint-plugin-security');
const prettierPlugin = require('eslint-plugin-prettier'); // Prettierルール用

module.exports = [
  // グローバル無視設定
  {
    ignores: [
      'node_modules/',
      'coverage/',
      'backup/',
      '*.config.js', // eslint.config.js 自体は無視
      '*.md',
      'docs/',
      'ai-context/',
      'repomix-output.txt',
      'tests/templates/test-template.js', // Parsing Error 回避
    ],
  },
  // デフォルト設定 (Jest + 他プラグイン)
  {
    files: ['**/*.js'],
    plugins: {
      // プラグインを登録
      // node: nodePlugin, // 一時的に削除
      jest: jestPlugin,
      promise: promisePlugin,
      security: securityPlugin,
      prettier: prettierPlugin,
    },
    languageOptions: {
      ecmaVersion: 12,
      sourceType: 'commonjs',
      globals: {
        ...globals.node, // Node.js のグローバル変数は維持
        ...globals.jest,
      },
    },
    rules: {
      // 基本ルール
      ...js.configs.recommended.rules,
      // プラグイン推奨ルール
      // ...nodePlugin.configs.recommended.rules, // 一時的に削除
      ...jestPlugin.configs.recommended.rules,
      ...promisePlugin.configs.recommended.rules,
      ...securityPlugin.configs.recommended.rules,
      // Prettier連携 (競合無効化 + Prettierルール適用)
      ...prettierConfig.rules, // Prettierと競合するESLintルールを無効化
      'prettier/prettier': 'warn', // Prettierのルール違反をESLintの警告として報告
      // プロジェクト固有のルール調整
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'warn',
      // node/* ルールも一時的に削除
    },
  },
  // フロントエンド用設定
  {
    files: ['src/templates/frontend/js/main.js'],
    languageOptions: {
      globals: {
        ...globals.browser, // ブラウザ環境のグローバル変数を追加
      },
    },
    // 必要であればフロントエンド固有のルールを追加
  },
  // テスト用設定 (no-undef エラー回避など)
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: {
        fail: 'readonly', // tests/lib/core/error-framework.test.js
        performance: 'readonly', // tests/lib/performance/*
        originalConsoleWarn: 'readonly', // tests/lib/utils/event-helpers.test.js (要調査)
      },
    },
    rules: {
      // テストファイルでは console.log を許可するなど、ルールを緩和する場合
      'no-console': 'off',
      // jest/expect-expect など、テスト固有のルールを強化する場合
      'jest/expect-expect': 'warn',
    },
  },
];
