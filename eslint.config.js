// eslint.config.js
const globals = require('globals');
const js = require('@eslint/js');
const prettierConfig = require('eslint-config-prettier'); // Prettier競合ルール無効化用
const nodePlugin = require('eslint-plugin-node');
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
  // デフォルト設定 (Node.js + Jest + プラグイン)
  {
    files: ['**/*.js'],
    plugins: {
      // プラグインを登録
      node: nodePlugin,
      jest: jestPlugin,
      promise: promisePlugin,
      security: securityPlugin,
      prettier: prettierPlugin,
    },
    languageOptions: {
      ecmaVersion: 12,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    rules: {
      // 基本ルール
      ...js.configs.recommended.rules,
      // プラグイン推奨ルール
      ...nodePlugin.configs.recommended.rules,
      ...jestPlugin.configs.recommended.rules,
      ...promisePlugin.configs.recommended.rules,
      ...securityPlugin.configs.recommended.rules,
      // Prettier連携 (競合無効化 + Prettierルール適用)
      ...prettierConfig.rules, // Prettierと競合するESLintルールを無効化
      'prettier/prettier': 'warn', // Prettierのルール違反をESLintの警告として報告
      // プロジェクト固有のルール調整
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'warn',
      // 必要に応じてプラグインのルールを個別に調整
      // 例: 'jest/no-disabled-tests': 'off',
      // 例: nodePlugin は sourceType: module を期待するルールがあるため commonjs では調整が必要な場合がある
      'node/no-unsupported-features/es-syntax': [
        'error',
        { ignores: ['modules'] },
      ], // CommonJSなのでES Modules構文はエラー
      'node/no-missing-require': 'error', // require() のパスが存在しない場合にエラー
      // --- 修正箇所 ---
      'node/no-deprecated-api': 'off', // ESLint v9 との互換性問題のため一時的に無効化
      'node/no-extraneous-require': 'off', // ESLint v9 との互換性問題のため一時的に無効化
      // --- 修正箇所 ---
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
