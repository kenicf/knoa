// eslint.config.js
const globals = require('globals');
const js = require('@eslint/js');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
  // グローバル無視設定
  {
    ignores: [
      'node_modules/',
      'coverage/',
      'backup/',
      '*.config.js',
      '*.md',
      'docs/',
      'ai-context/',
      'repomix-output.txt',
      'tests/templates/test-template.js', // Parsing Error 回避
    ],
  },
  // デフォルト設定 (Node.js + Jest)
  {
    files: ['**/*.js'], // すべての JS ファイルに適用
    languageOptions: {
      ecmaVersion: 12,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    rules: {
      ...js.configs.recommended.rules, // eslint:recommended 相当
      ...prettierConfig.rules, // Prettier との競合ルールを無効化
      'prettier/prettier': 'off', // eslint-plugin-prettier は不要
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
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
  },
  // テスト用設定 (no-undef エラー回避)
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: {
        fail: 'readonly', // tests/lib/core/error-framework.test.js
        performance: 'readonly', // tests/lib/performance/*
        originalConsoleWarn: 'readonly', // tests/lib/utils/event-helpers.test.js (要調査)
      },
    },
  },
];