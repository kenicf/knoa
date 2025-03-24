# ユーティリティテスト改善計画 - フェーズ2

## 概要

本文書は、ユーティリティライブラリのテストコード改善計画のフェーズ2として、`git.test.js`と`storage.test.js`の改修戦略を詳細に記述したものです。これらのファイルの改修により、テストコードの品質と保守性を向上させ、将来の開発やバグ修正の効率化を図ります。

フェーズ1で整備された共通モックファクトリやテストヘルパー関数を活用し、テストコードの標準化と品質向上を進めます。

## 対象ファイル

1. **storage.test.js**
   - ファイルシステム操作のテスト
   - `fs`と`path`のモック化
   - JSONデータとテキストデータの読み書きテスト

2. **git.test.js**
   - Gitコマンド実行のテスト
   - `child_process`の`execSync`のモック化
   - コミット情報の取得と解析のテスト

## 改修方針

### 優先順位

1. **storage.test.js**から着手
   - モックの一貫性問題がより顕著
   - `fs`と`path`のモック化は他のテストファイルでも参考になる可能性が高い
   - デバッグ用コンソールログの存在など、クリーンアップ効果が大きい

2. **git.test.js**に続いて着手
   - storage.test.jsでの経験を活かす
   - 環境変数テストの追加など、特有の改善を実施

### 共通改修アプローチ

1. **共通モックファクトリの活用**
   - `createMockLogger`, `createMockEventEmitter`, `createMockErrorHandler`, `mockTimestamp`関数を使用
   - モックオブジェクトの作成を標準化し、コードの重複を削減

2. **テストヘルパー関数の活用**
   - `expectEventEmitted`, `expectStandardizedEventEmitted`, `expectErrorHandled`, `expectLogged`関数を使用
   - イベント発行やエラー処理の検証を標準化し、可読性を向上

3. **テストケースのパラメータ化**
   - 段階的パラメータ化アプローチ
   - 第一段階: 明らかな重複が存在するケース（例：`fileExists`のようなシンプルなメソッド）
   - 第二段階: 類似構造だが異なる入力/出力を持つケース
   - 過度なパラメータ化によるテストの可読性低下を避ける

4. **Arrange-Act-Assertパターンの適用**
   - テストコードを準備（Arrange）、実行（Act）、検証（Assert）の3つのセクションに明確に分割
   - コメントを追加して各セクションを明示

5. **テスト命名の英語への統一**
   - 構造的な改修を完了した後に実施
   - 一貫性のある翻訳のために用語集を作成

## 具体的な改修内容

### storage.test.js改修内容

1. **モックファクトリとテストヘルパーの導入**

```javascript
const { createMockLogger, createMockEventEmitter, createMockErrorHandler, mockTimestamp } = require('../../helpers/mock-factory');
const { expectStandardizedEventEmitted, expectErrorHandled } = require('../../helpers/test-helpers');
```

2. **テストデータファクトリの導入**

```javascript
function createStorageServiceTestOptions(overrides = {}) {
  return {
    basePath: '/test/base/path',
    logger: createMockLogger(),
    eventEmitter: createMockEventEmitter(),
    errorHandler: createMockErrorHandler(),
    ...overrides
  };
}
```

3. **beforeEachの改善**

```javascript
beforeEach(() => {
  // モックのリセット（一度だけ実行）
  jest.clearAllMocks();
  jest.restoreAllMocks();
  
  // fsとpathのモックを取得
  fs = require('fs');
  path = require('path');
  
  // パスの結合をシミュレート
  path.join.mockImplementation((...args) => args.join('/'));
  
  // 時間のモック
  mockTimestamp('2025-03-24T00:00:00.000Z');
  
  // 共通モックファクトリを使用
  mockLogger = createMockLogger();
  mockEventEmitter = createMockEventEmitter();
  mockErrorHandler = createMockErrorHandler();
  
  // StorageServiceのインスタンス作成
  storageService = new StorageService(createStorageServiceTestOptions());
});
```

4. **イベント検証の標準化**

```javascript
// 変更前
expect(mockEventEmitter.emitStandardized).toHaveBeenCalled();
expect(mockEventEmitter.emitStandardized.mock.calls[0][0]).toBe('storage');
expect(mockEventEmitter.emitStandardized.mock.calls[0][1]).toBe('directory:created');
expect(mockEventEmitter.emitStandardized.mock.calls[0][2]).toEqual(expect.objectContaining({
  path: '/test/base/path/test-dir'
}));

// 変更後
expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'directory:created', {
  path: '/test/base/path/test-dir'
});
```

5. **テストケースのパラメータ化例**

```javascript
// 変更前
test('ファイルが存在する場合、trueを返す', () => {
  fs.existsSync.mockReturnValue(true);
  
  const result = storageService.fileExists('test-dir', 'test-file.txt');
  
  expect(result).toBe(true);
  expect(fs.existsSync).toHaveBeenCalledWith('/test/base/path/test-dir/test-file.txt');
});

test('ファイルが存在しない場合、falseを返す', () => {
  fs.existsSync.mockReturnValue(false);
  
  const result = storageService.fileExists('test-dir', 'test-file.txt');
  
  expect(result).toBe(false);
  expect(fs.existsSync).toHaveBeenCalledWith('/test/base/path/test-dir/test-file.txt');
});

// 変更後
test.each([
  ['ファイルが存在する場合', true, true],
  ['ファイルが存在しない場合', false, false]
])('%s、%sを返す', (_, fileExists, expected) => {
  // Arrange
  fs.existsSync.mockReturnValue(fileExists);
  
  // Act
  const result = storageService.fileExists('test-dir', 'test-file.txt');
  
  // Assert
  expect(result).toBe(expected);
  expect(fs.existsSync).toHaveBeenCalledWith('/test/base/path/test-dir/test-file.txt');
});
```

6. **Arrange-Act-Assertパターンの適用例**

```javascript
test('ディレクトリが存在しない場合、ディレクトリを作成して正しいパスを返す', () => {
  // Arrange
  fs.existsSync.mockReturnValue(false);
  
  // Act
  const result = storageService.getFilePath('test-dir', 'test-file.json');
  
  // Assert
  expect(result).toBe('/test/base/path/test-dir/test-file.json');
  expect(fs.existsSync).toHaveBeenCalledWith('/test/base/path/test-dir');
  expect(fs.mkdirSync).toHaveBeenCalledWith('/test/base/path/test-dir', { recursive: true });
  expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'directory:created', {
    path: '/test/base/path/test-dir'
  });
});
```

### git.test.js改修内容

1. **モックファクトリとテストヘルパーの導入**

```javascript
const { createMockLogger, createMockEventEmitter, createMockErrorHandler, mockTimestamp } = require('../../helpers/mock-factory');
const { expectEventEmitted, expectErrorHandled } = require('../../helpers/test-helpers');
```

2. **テストデータファクトリの導入**

```javascript
function createGitServiceTestOptions(overrides = {}) {
  return {
    repoPath: '/test/repo/path',
    logger: createMockLogger(),
    eventEmitter: createMockEventEmitter(),
    errorHandler: createMockErrorHandler(),
    ...overrides
  };
}
```

3. **beforeEachの改善**

```javascript
beforeEach(() => {
  // モックのリセット
  jest.clearAllMocks();
  jest.restoreAllMocks();
  
  // execSyncのモックを取得
  execSync = require('child_process').execSync;
  
  // 時間のモック
  mockTimestamp('2025-03-24T00:00:00.000Z');
  
  // 共通モックファクトリを使用
  mockLogger = createMockLogger();
  mockEventEmitter = createMockEventEmitter();
  mockErrorHandler = createMockErrorHandler();
  
  // GitServiceのインスタンス作成
  gitService = new GitService(createGitServiceTestOptions());
});
```

4. **イベント検証の標準化**

```javascript
// 変更前
expect(mockEventEmitter.emit).toHaveBeenCalledWith(
  'git:commit:get_hash:after',
  expect.objectContaining({
    hash: mockHash,
    success: true
  })
);

// 変更後
expectEventEmitted(mockEventEmitter, 'git:commit:get_hash:after', {
  hash: mockHash,
  success: true
});
```

5. **環境変数テストの追加**

```javascript
describe('環境変数に依存するイベント発行', () => {
  let originalNodeEnv;
  let originalConsoleWarn;
  
  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
    originalConsoleWarn = console.warn;
    console.warn = jest.fn();
  });
  
  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    console.warn = originalConsoleWarn;
  });
  
  test('開発環境では非推奨警告を表示する', () => {
    // Arrange
    process.env.NODE_ENV = 'development';
    
    // Act
    gitService._emitEvent('event:name', { data: 'value' });
    
    // Assert
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('非推奨のイベント名')
    );
  });
  
  test('本番環境では非推奨警告を表示しない', () => {
    // Arrange
    process.env.NODE_ENV = 'production';
    
    // Act
    gitService._emitEvent('event:name', { data: 'value' });
    
    // Assert
    expect(console.warn).not.toHaveBeenCalled();
  });
});
```

6. **テストケースのパラメータ化例**

```javascript
// 変更前
test('コミットメッセージからタスクIDを抽出する', () => {
  const message = 'Fix bug #T001 and implement feature #T002';
  
  const result = gitService.extractTaskIdsFromCommitMessage(message);
  
  expect(result).toEqual(['T001', 'T002']);
  // イベント検証...
});

test('タスクIDがない場合、空配列を返す', () => {
  const message = 'Fix bug and implement feature';
  
  const result = gitService.extractTaskIdsFromCommitMessage(message);
  
  expect(result).toEqual([]);
  // イベント検証...
});

// 変更後
test.each([
  ['タスクIDがある場合', 'Fix bug #T001 and implement feature #T002', ['T001', 'T002']],
  ['タスクIDがない場合', 'Fix bug and implement feature', []]
])('%s、適切な結果を返す', (_, message, expected) => {
  // Arrange
  
  // Act
  const result = gitService.extractTaskIdsFromCommitMessage(message);
  
  // Assert
  expect(result).toEqual(expected);
  expectEventEmitted(mockEventEmitter, 'git:commit:extract_task_ids:before', {
    message
  });
  expectEventEmitted(mockEventEmitter, 'git:commit:extract_task_ids:after', {
    message,
    taskIds: expected,
    success: true
  });
});
```

7. **エラー検証の強化**

```javascript
// エラー検証の強化関数
function expectServiceError(mockErrorHandler, { 
  errorName = 'Error',
  messageContains = '',
  operation = '',
  contextIncludes = {}
} = {}) {
  expect(mockErrorHandler.handle).toHaveBeenCalledWith(
    expect.objectContaining({
      name: errorName,
      message: expect.stringContaining(messageContains)
    }),
    expect.any(String),
    operation,
    expect.objectContaining({
      additionalContext: expect.objectContaining(contextIncludes)
    })
  );
}

// テスト内での使用例
test('コマンド実行時にエラーが発生した場合、エラーハンドラーを呼び出す', () => {
  // Arrange
  const error = new Error('コマンド実行エラー');
  execSync.mockImplementation(() => {
    throw error;
  });
  mockErrorHandler.handle.mockReturnValue('');
  
  // Act
  const result = gitService._executeCommand('git status');
  
  // Assert
  expect(result).toBe('');
  expectEventEmitted(mockEventEmitter, 'git:command:execute:before', {
    command: 'git status'
  });
  expectEventEmitted(mockEventEmitter, 'git:command:execute:after', {
    command: 'git status',
    success: false,
    error
  });
  expectServiceError(mockErrorHandler, {
    errorName: 'GitError',
    messageContains: 'コマンド実行に失敗しました',
    operation: '_executeCommand',
    contextIncludes: {
      command: 'git status',
      operation: '_executeCommand'
    }
  });
});
```

## 実装スケジュール

### 週1: storage.test.jsの改修（3日間）

1. **Day 1**: モックファクトリとテストヘルパーの導入、beforeEachの改善
   - モックファクトリとテストヘルパーのインポート追加
   - テストデータファクトリの導入
   - beforeEachの改修
   - テスト実行と検証

2. **Day 2**: イベント検証の標準化、テストケースのパラメータ化
   - イベント検証を`expectStandardizedEventEmitted`に置き換え
   - エラー処理検証を`expectErrorHandled`に置き換え
   - シンプルなメソッドのテストケースをパラメータ化
   - テスト実行と検証

3. **Day 3**: Arrange-Act-Assertパターンの適用、最終確認
   - 各テストケースをAAA構造に変更
   - コメントの追加
   - 最終テスト実行と検証
   - 必要に応じた修正

### 週2: git.test.jsの改修（3日間）

1. **Day 1**: モックファクトリとテストヘルパーの導入、beforeEachの改善
   - モックファクトリとテストヘルパーのインポート追加
   - テストデータファクトリの導入
   - beforeEachの改修
   - 時間関連のモック追加
   - テスト実行と検証

2. **Day 2**: イベント検証の標準化、環境変数テストの追加
   - イベント検証を`expectEventEmitted`に置き換え
   - エラー処理検証を`expectErrorHandled`に置き換え
   - 環境変数テストの追加
   - テスト実行と検証

3. **Day 3**: テストケースのパラメータ化、Arrange-Act-Assertパターンの適用
   - シンプルなメソッドのテストケースをパラメータ化
   - 各テストケースをAAA構造に変更
   - コメントの追加
   - 最終テスト実行と検証
   - 必要に応じた修正

### 週3: テスト命名の英語への統一とドキュメント更新（2日間）

1. **Day 1**: テスト命名の英語への統一
   - 用語集の作成
   - テスト命名の英語への統一
   - テスト実行と検証
   - 必要に応じた修正

2. **Day 2**: ドキュメント更新
   - `docs/test-improvement-implementation-status.md`の更新
   - 改修内容と効果の記録
   - 次のフェーズの計画立案

## 成功基準

1. **コードの品質向上**
   - 共通モックファクトリとテストヘルパー関数が適切に活用されている
   - テストケースが適切にパラメータ化されている
   - Arrange-Act-Assertパターンが適用されている
   - テスト命名が一貫している

2. **テストの信頼性向上**
   - 時間関連のモックが適切に使用されている
   - 環境変数テストが追加されている
   - エラー処理が適切にテストされている

3. **テストの保守性向上**
   - テストコードの重複が削減されている
   - テストの意図が明確になっている
   - テストケースの追加が容易になっている

4. **テストの実行効率**
   - テスト実行時間が短縮されている（または同等）
   - テストの依存関係が最適化されている

5. **ドキュメントの充実**
   - 改修内容と効果が適切に記録されている
   - 次のフェーズの計画が立案されている

これらの基準を満たすことで、テストコードの品質と保守性が大幅に向上し、将来の開発やバグ修正の効率化につながります。