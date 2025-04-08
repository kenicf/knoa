// eslint.config.js
const globals = require('globals');
const js = require('@eslint/js');
const prettierConfig = require('eslint-config-prettier'); // Prettier競合ルール無効化用
const nPlugin = require('eslint-plugin-n'); // eslint-plugin-n に変更
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
      n: nPlugin, // プラグイン名を n に変更
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
      ...nPlugin.configs.recommended.rules, // 推奨ルールを nPlugin から取得
      ...jestPlugin.configs.recommended.rules,
      ...promisePlugin.configs.recommended.rules,
      ...securityPlugin.configs.recommended.rules,
      // Prettier連携 (競合無効化 + Prettierルール適用)
      ...prettierConfig.rules, // Prettierと競合するESLintルールを無効化
      'prettier/prettier': ['warn', { endOfLine: 'auto' }], // Prettierのルール違反をESLintの警告として報告 (改行コード自動判定)
      // プロジェクト固有のルール調整
      'no-unused-vars': 'off',
      'no-console': 'warn',
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
  // CLIツール用設定
  {
    files: ['src/cli/**/*.js'],
    rules: {
      'no-console': 'off', // CLIではコンソール出力は許可
    },
  },
  // サンプルコード用設定
  {
    files: ['src/examples/**/*.js'],
    rules: {
      'no-console': 'off', // サンプルコードではコンソール出力は許可
    },
  },
  // src/lib/core/constants.js の module.exports を許可
  {
    files: ['src/lib/core/constants.js'],
    rules: {
      // node/ プレフィックスを n/ に変更し、一時的な無効化を解除（nPluginで問題ないか確認するため）
      // 'n/no-exports-assign': 'off',
      // 'n/no-deprecated-api': 'off',
      // 'n/no-extraneous-require': 'off',
    },
  },
];
