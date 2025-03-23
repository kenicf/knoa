# 依存性注入 開発者向けチートシート

> **難易度: 基本** | 所要時間: 10分

このチートシートでは、knoaプロジェクトにおける依存性注入パターンの日常的な使用方法を簡潔にまとめています。よく使用される依存性注入パターンとコードスニペットを提供し、開発作業の効率化を支援します。

## 目次

- [1. 基本的な依存関係の登録と解決](#1-基本的な依存関係の登録と解決)
- [2. コンストラクタインジェクション](#2-コンストラクタインジェクション)
- [3. プロパティインジェクション](#3-プロパティインジェクション)
- [4. メソッドインジェクション](#4-メソッドインジェクション)
- [5. テスト用のモック登録](#5-テスト用のモック登録)
- [6. コンポーネント固有のユースケース](#6-コンポーネント固有のユースケース)
- [7. よくあるエラーと解決策](#7-よくあるエラーと解決策)

## 1. 基本的な依存関係の登録と解決

### 1.1 サービスコンテナの作成

```javascript
// サービスコンテナの作成
const { createContainer } = require('./lib/core/service-definitions');
const container = createContainer();
```

### 1.2 値の登録

```javascript
// 値の登録
container.register('logger', console);
container.register('config', { basePath: '/path/to/base', debug: true });
container.register('apiKey', 'your-api-key');
```

### 1.3 ファクトリー関数の登録

```javascript
// ファクトリー関数の登録
container.registerFactory('storageService', (container) => {
  const logger = container.get('logger');
  const config = container.get('config');
  
  return new StorageService({
    basePath: config.basePath,
    logger
  });
});
```

### 1.4 サービスの取得

```javascript
// サービスの取得
const logger = container.get('logger');
const storageService = container.get('storageService');
const taskManager = container.get('taskManager');
```

### 1.5 サービスの存在確認

```javascript
// サービスの存在確認
if (container.has('storageService')) {
  // サービスが存在する場合の処理
}
```

### 1.6 サービスの削除

```javascript
// サービスの削除
container.remove('temporaryService');
```

## 2. コンストラクタインジェクション

### 2.1 オプションオブジェクトパターン（推奨）

```javascript
// オプションオブジェクトパターン
class TaskManager {
  constructor(options) {
    // 必須依存関係の検証
    if (!options.storageService) throw new Error('storageService is required');
    if (!options.eventEmitter) throw new Error('eventEmitter is required');
    
    // 依存関係の設定
    this.storageService = options.storageService;
    this.eventEmitter = options.eventEmitter;
    this.errorHandler = options.errorHandler;
    this.gitService = options.gitService;
    this.logger = options.logger || console;
  }
}

// 使用例
const taskManager = new TaskManager({
  storageService: container.get('storageService'),
  eventEmitter: container.get('eventEmitter'),
  errorHandler: container.get('errorHandler'),
  gitService: container.get('gitService'),
  logger: container.get('logger')
});
```

### 2.2 個別パラメータパターン

```javascript
// 個別パラメータパターン
class SimpleService {
  constructor(logger, config) {
    this.logger = logger;
    this.config = config;
  }
}

// 使用例
const simpleService = new SimpleService(
  container.get('logger'),
  container.get('config')
);
```

### 2.3 デフォルト値の設定

```javascript
// デフォルト値の設定
class ConfigurableService {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.debug = options.debug || false;
    this.timeout = options.timeout || 1000;
  }
}

// 使用例
const service1 = new ConfigurableService(); // デフォルト値を使用
const service2 = new ConfigurableService({ debug: true, timeout: 2000 }); // 一部のオプションを上書き
```

## 3. プロパティインジェクション

### 3.1 基本的なプロパティインジェクション

```javascript
// 基本的なプロパティインジェクション
class SimpleComponent {
  constructor() {
    // 依存関係は後から設定
  }
}

// 使用例
const component = new SimpleComponent();
component.logger = container.get('logger');
component.config = container.get('config');
```

### 3.2 遅延プロパティインジェクション

```javascript
// 遅延プロパティインジェクション
class LazyComponent {
  constructor(container) {
    this.container = container;
    this._logger = null;
  }
  
  // ゲッターを使用した遅延ロード
  get logger() {
    if (!this._logger) {
      this._logger = this.container.get('logger');
    }
    return this._logger;
  }
}

// 使用例
const component = new LazyComponent(container);
// loggerは最初に使用されるときにロードされる
component.logger.info('Hello, world!');
```

## 4. メソッドインジェクション

### 4.1 セッターインジェクション

```javascript
// セッターインジェクション
class ConfigurableComponent {
  constructor() {
    this.logger = console;
    this.config = {};
  }
  
  setLogger(logger) {
    this.logger = logger;
    return this; // メソッドチェーン用
  }
  
  setConfig(config) {
    this.config = config;
    return this; // メソッドチェーン用
  }
}

// 使用例
const component = new ConfigurableComponent()
  .setLogger(container.get('logger'))
  .setConfig(container.get('config'));
```

### 4.2 メソッド引数インジェクション

```javascript
// メソッド引数インジェクション
class ApiClient {
  constructor() {
    // 依存関係なし
  }
  
  // メソッド呼び出し時に依存関係を注入
  fetchData(httpClient, logger) {
    logger.info('Fetching data...');
    return httpClient.get('/api/data');
  }
}

// 使用例
const apiClient = new ApiClient();
apiClient.fetchData(
  container.get('httpClient'),
  container.get('logger')
);
```

## 5. テスト用のモック登録

### 5.1 モックの作成と登録

```javascript
// モックの作成
const mockStorageService = {
  readJSON: jest.fn().mockResolvedValue({ data: 'test' }),
  writeJSON: jest.fn().mockResolvedValue(true),
  fileExists: jest.fn().mockReturnValue(true),
  ensureDirectoryExists: jest.fn()
};

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

// モックの登録
container.register('storageService', mockStorageService);
container.register('logger', mockLogger);
```

### 5.2 モックファクトリーの作成

```javascript
// モックファクトリーの作成
function createMockContainer() {
  const container = new ServiceContainer();
  
  // モックの登録
  container.register('logger', {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  });
  
  container.register('storageService', {
    readJSON: jest.fn().mockResolvedValue({ data: 'test' }),
    writeJSON: jest.fn().mockResolvedValue(true),
    fileExists: jest.fn().mockReturnValue(true),
    ensureDirectoryExists: jest.fn()
  });
  
  // 他のモックを登録...
  
  return container;
}

// 使用例
const mockContainer = createMockContainer();
const taskManager = new TaskManager({
  storageService: mockContainer.get('storageService'),
  logger: mockContainer.get('logger')
});
```

### 5.3 テスト用のサービス定義

```javascript
// テスト用のサービス定義
function createTestContainer() {
  const container = new ServiceContainer();
  
  // 基本サービスの登録
  container.register('logger', createMockLogger());
  container.register('config', { basePath: '/tmp/test', debug: true });
  
  // ユーティリティサービスの登録
  container.register('storageService', createMockStorageService());
  container.register('gitService', createMockGitService());
  
  // マネージャーサービスの登録
  container.registerFactory('taskManager', (container) => {
    return new TaskManager({
      storageService: container.get('storageService'),
      eventEmitter: container.get('eventEmitter'),
      logger: container.get('logger'),
      gitService: container.get('gitService')
    });
  });
  
  // 他のサービスを登録...
  
  return container;
}
```

## 6. コンポーネント固有のユースケース

### 6.1 TaskManager

```javascript
// TaskManagerの依存関係
container.registerFactory('taskManager', (container) => {
  const storageService = container.get('storageService');
  const eventEmitter = container.get('eventEmitter');
  const errorHandler = container.get('errorHandler');
  const gitService = container.get('gitService');
  const logger = container.get('logger');
  
  return new TaskManager({
    storageService,
    eventEmitter,
    errorHandler,
    gitService,
    logger
  });
});

// TaskManagerの使用例
const taskManager = container.get('taskManager');

// タスクの作成
await taskManager.createTask({
  title: 'タスクのタイトル',
  description: 'タスクの説明',
  priority: 'high'
});

// タスクの取得
const tasks = await taskManager.getTasks();

// タスクの更新
await taskManager.updateTask('task-id', {
  status: 'in-progress'
});
```

### 6.2 SessionManager

```javascript
// SessionManagerの依存関係
container.registerFactory('sessionManager', (container) => {
  const storageService = container.get('storageService');
  const eventEmitter = container.get('eventEmitter');
  const errorHandler = container.get('errorHandler');
  const gitService = container.get('gitService');
  const logger = container.get('logger');
  
  return new SessionManager({
    storageService,
    eventEmitter,
    errorHandler,
    gitService,
    logger
  });
});

// SessionManagerの使用例
const sessionManager = container.get('sessionManager');

// セッションの開始
await sessionManager.startSession({
  name: 'セッション名',
  description: 'セッションの説明'
});

// 現在のセッションを取得
const currentSession = await sessionManager.getCurrentSession();

// セッションにタスクを追加
await sessionManager.addTaskToSession(currentSession.id, 'task-id');

// セッションを終了
await sessionManager.endSession(currentSession.id);
```

### 6.3 FeedbackManager

```javascript
// FeedbackManagerの依存関係
container.registerFactory('feedbackManager', (container) => {
  const storageService = container.get('storageService');
  const eventEmitter = container.get('eventEmitter');
  const errorHandler = container.get('errorHandler');
  const gitService = container.get('gitService');
  const logger = container.get('logger');
  
  return new FeedbackManager({
    storageService,
    eventEmitter,
    errorHandler,
    gitService,
    logger
  });
});

// FeedbackManagerの使用例
const feedbackManager = container.get('feedbackManager');

// フィードバックの作成
await feedbackManager.createFeedback({
  content: 'フィードバックの内容',
  type: 'suggestion',
  priority: 'medium'
});

// フィードバックの取得
const feedbacks = await feedbackManager.getFeedbacks();

// フィードバックの更新
await feedbackManager.updateFeedback('feedback-id', {
  status: 'resolved'
});
```

### 6.4 IntegrationManager

```javascript
// IntegrationManagerの依存関係
container.registerFactory('integrationManager', (container) => {
  const taskManager = container.get('taskManager');
  const sessionManager = container.get('sessionManager');
  const feedbackManager = container.get('feedbackManager');
  const eventEmitter = container.get('eventEmitter');
  const errorHandler = container.get('errorHandler');
  const logger = container.get('logger');
  
  return new IntegrationManager({
    taskManager,
    sessionManager,
    feedbackManager,
    eventEmitter,
    errorHandler,
    logger
  });
});

// IntegrationManagerの使用例
const integrationManager = container.get('integrationManager');

// ワークフローの初期化
await integrationManager.initializeWorkflow();

// セッションの開始
await integrationManager.startSession({
  name: 'セッション名',
  description: 'セッションの説明'
});

// タスクの作成とセッションへの関連付け
await integrationManager.createTaskAndAddToSession({
  title: 'タスクのタイトル',
  description: 'タスクの説明',
  priority: 'high'
});

// Gitコミットの追加
await integrationManager.addGitCommit('commit-hash', 'コミットメッセージ');
```

## 7. よくあるエラーと解決策

### 7.1 サービスが見つからない

**エラー**: `サービス 'xxx' が見つかりません`

**解決策**:
1. サービス名のスペルミスを確認する
2. サービスが正しく登録されているか確認する
3. サービス定義ファイルが正しくインポートされているか確認する

```javascript
// サービスの存在確認
if (!container.has('xxx')) {
  console.error('サービスが登録されていません: xxx');
  // サービスを登録
  container.register('xxx', new XxxService());
}
```

### 7.2 循環参照

**エラー**: `循環参照が検出されました: serviceA -> serviceB -> serviceA`

**解決策**:
1. 依存関係を再設計する
2. 遅延初期化を使用する
3. イベント駆動アーキテクチャを使用する

```javascript
// 遅延初期化の例
container.registerFactory('serviceA', (container) => {
  return new ServiceA({
    getServiceB: () => container.get('serviceB')
  });
});
```

### 7.3 必須依存関係がない

**エラー**: `storageService is required`

**解決策**:
1. 必須依存関係を提供する
2. デフォルト値を設定する
3. オプショナルな依存関係に変更する

```javascript
// 必須依存関係の検証
constructor(options) {
  if (!options.storageService) throw new Error('storageService is required');
  
  this.storageService = options.storageService;
  this.logger = options.logger || console; // デフォルト値を設定
}
```

### 7.4 型の不一致

**エラー**: `Cannot read property 'xxx' of undefined`

**解決策**:
1. 依存関係の型を確認する
2. 型チェックを追加する
3. デフォルト値を設定する

```javascript
// 型チェックの追加
constructor(options) {
  this.storageService = options.storageService;
  
  // loggerが正しい型かチェック
  if (options.logger && typeof options.logger.info !== 'function') {
    throw new Error('logger must have info method');
  }
  
  this.logger = options.logger || console;
}
```

## 関連ドキュメント

- [依存性注入クイックスタートガイド](./dependency-injection-quickstart.md) - 依存性注入の基本的な概念と使用方法
- [依存性注入アーキテクチャガイド](./dependency-injection-architecture-guide.md) - 依存性注入アーキテクチャの詳細な実装と使用方法
- [依存性注入のベストプラクティス](./dependency-injection-best-practices.md) - 依存性注入パターンを効果的に使用するためのベストプラクティス
- [依存性注入のテストガイド](./dependency-injection-testing-guide.md) - 依存性注入パターンを使用したコードのテスト方法
- [依存性注入とイベント駆動アーキテクチャの統合ガイド](./dependency-injection-event-driven-integration.md) - 依存性注入とイベント駆動アーキテクチャの連携方法