# 依存性注入パターン

## 概要

依存性注入（Dependency Injection）は、コンポーネント間の依存関係を外部から注入することで、コンポーネントの結合度を下げ、テスト容易性、柔軟性、再利用性を向上させるデザインパターンです。このドキュメントでは、knoaプロジェクトにおける依存性注入パターンの実装と使用方法について説明します。

## 目的

依存性注入パターンの導入には、以下の目的があります：

1. **疎結合**: コンポーネント間の依存関係を減らし、変更の影響範囲を限定する
2. **テスト容易性**: モックやスタブを使用して依存関係を置き換え、単体テストを容易にする
3. **柔軟性**: 実装の詳細を隠蔽し、インターフェースに依存することで、実装の変更を容易にする
4. **再利用性**: コンポーネントを再利用しやすくする
5. **ライフサイクル管理**: コンポーネントのライフサイクルを一元管理する

## 実装

knoaプロジェクトでは、以下のコンポーネントを使用して依存性注入パターンを実装しています：

### 1. ServiceContainer

`ServiceContainer`クラスは、サービスの登録と解決を担当します。

```javascript
// src/lib/core/service-container.js
class ServiceContainer {
  constructor() {
    this.services = new Map();
    this.factories = new Map();
    this.resolutionStack = [];
  }

  // サービスを登録
  register(name, instance) {
    this.services.set(name, instance);
    return this;
  }

  // ファクトリー関数を登録
  registerFactory(name, factory) {
    this.factories.set(name, factory);
    return this;
  }

  // サービスを取得
  get(name) {
    // 循環参照の検出
    if (this.resolutionStack.includes(name)) {
      throw new Error(`循環参照が検出されました: ${this.resolutionStack.join(' -> ')} -> ${name}`);
    }

    // サービスが既に登録されているか確認
    if (this.services.has(name)) {
      return this.services.get(name);
    }
    
    // ファクトリーが登録されているか確認
    if (this.factories.has(name)) {
      this.resolutionStack.push(name);
      const factory = this.factories.get(name);
      const instance = factory(this);
      this.services.set(name, instance);
      this.resolutionStack.pop();
      return instance;
    }
    
    throw new Error(`サービス '${name}' が見つかりません`);
  }
}
```

### 2. サービス定義

`service-definitions.js`ファイルでは、アプリケーションで使用するサービスを定義し、依存関係を解決します。

```javascript
// src/lib/core/service-definitions.js
const { ServiceContainer } = require('./service-container');
const { EnhancedEventEmitter } = require('./event-system');
const { ErrorHandler } = require('./error-framework');
const StorageService = require('../utils/storage');
const GitService = require('../utils/git');
const TaskManager = require('../../utils/task-manager');
const SessionManager = require('../../utils/session-manager');
const FeedbackManager = require('../../utils/feedback-manager');
const IntegrationManager = require('../../utils/integration-manager');
const config = require('../../config');

function createContainer() {
  const container = new ServiceContainer();
  
  // ロガーの登録
  container.register('logger', console);
  
  // 設定の登録
  container.register('config', config);
  
  // イベントエミッターの登録
  container.registerFactory('eventEmitter', (container) => {
    const logger = container.get('logger');
    return new EnhancedEventEmitter({ logger, keepHistory: true });
  });
  
  // エラーハンドラーの登録
  container.registerFactory('errorHandler', (container) => {
    const logger = container.get('logger');
    const eventEmitter = container.get('eventEmitter');
    return new ErrorHandler(logger, eventEmitter);
  });
  
  // ストレージサービスの登録
  container.registerFactory('storageService', (container) => {
    const logger = container.get('logger');
    const eventEmitter = container.get('eventEmitter');
    const errorHandler = container.get('errorHandler');
    const config = container.get('config');
    
    return new StorageService({
      basePath: config.basePath || process.cwd(),
      logger,
      eventEmitter,
      errorHandler
    });
  });
  
  // Gitサービスの登録
  container.registerFactory('gitService', (container) => {
    const logger = container.get('logger');
    const eventEmitter = container.get('eventEmitter');
    const errorHandler = container.get('errorHandler');
    const config = container.get('config');
    
    return new GitService({
      repoPath: config.repoPath || process.cwd(),
      logger,
      eventEmitter,
      errorHandler
    });
  });
  
  // タスクマネージャーの登録
  container.registerFactory('taskManager', (container) => {
    const storageService = container.get('storageService');
    const eventEmitter = container.get('eventEmitter');
    const errorHandler = container.get('errorHandler');
    const gitService = container.get('gitService');
    
    return new TaskManager({
      storageService,
      eventEmitter,
      errorHandler,
      gitService
    });
  });
  
  // セッションマネージャーの登録
  container.registerFactory('sessionManager', (container) => {
    const storageService = container.get('storageService');
    const eventEmitter = container.get('eventEmitter');
    const errorHandler = container.get('errorHandler');
    const gitService = container.get('gitService');
    
    return new SessionManager({
      storageService,
      eventEmitter,
      errorHandler,
      gitService
    });
  });
  
  // フィードバックマネージャーの登録
  container.registerFactory('feedbackManager', (container) => {
    const storageService = container.get('storageService');
    const eventEmitter = container.get('eventEmitter');
    const errorHandler = container.get('errorHandler');
    const gitService = container.get('gitService');
    
    return new FeedbackManager({
      storageService,
      eventEmitter,
      errorHandler,
      gitService
    });
  });
  
  // 統合マネージャーの登録
  container.registerFactory('integrationManager', (container) => {
    const taskManager = container.get('taskManager');
    const sessionManager = container.get('sessionManager');
    const feedbackManager = container.get('feedbackManager');
    const eventEmitter = container.get('eventEmitter');
    const errorHandler = container.get('errorHandler');
    
    return new IntegrationManager({
      taskManager,
      sessionManager,
      feedbackManager,
      eventEmitter,
      errorHandler
    });
  });
  
  return container;
}

module.exports = { createContainer };
```

## 使用方法

### 1. サービスコンテナの作成

```javascript
const { createContainer } = require('./lib/core/service-definitions');

// サービスコンテナを作成
const container = createContainer();
```

### 2. サービスの取得

```javascript
// サービスを取得
const integrationManager = container.get('integrationManager');
const taskManager = container.get('taskManager');
const sessionManager = container.get('sessionManager');
const feedbackManager = container.get('feedbackManager');
```

### 3. CLIでの使用例

```javascript
// src/cli/integration.js
const { createContainer } = require('../lib/core/service-definitions');

async function main() {
  try {
    // サービスコンテナを作成
    const container = createContainer();
    
    // 統合マネージャーを取得
    const integrationManager = container.get('integrationManager');
    
    // コマンドライン引数を解析
    const command = process.argv[2];
    
    // コマンドに応じた処理を実行
    switch (command) {
      case 'init':
        await integrationManager.initializeWorkflow();
        break;
      case 'start-session':
        await integrationManager.startSession();
        break;
      // 他のコマンド...
      default:
        console.log('Unknown command');
        break;
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
```

## テスト

依存性注入パターンを使用することで、テストが容易になります。以下は、モックを使用したテストの例です：

```javascript
// tests/integration-manager.test.js
const IntegrationManager = require('../src/utils/integration-manager');
const { createMockTaskManager, createMockSessionManager, createMockFeedbackManager } = require('./helpers/mock-factory');

describe('IntegrationManager', () => {
  let integrationManager;
  let mockTaskManager;
  let mockSessionManager;
  let mockFeedbackManager;
  let mockEventEmitter;
  let mockErrorHandler;
  
  beforeEach(() => {
    // モックを作成
    mockTaskManager = createMockTaskManager();
    mockSessionManager = createMockSessionManager();
    mockFeedbackManager = createMockFeedbackManager();
    mockEventEmitter = { emit: jest.fn(), on: jest.fn() };
    mockErrorHandler = { handle: jest.fn() };
    
    // IntegrationManagerを作成
    integrationManager = new IntegrationManager({
      taskManager: mockTaskManager,
      sessionManager: mockSessionManager,
      feedbackManager: mockFeedbackManager,
      eventEmitter: mockEventEmitter,
      errorHandler: mockErrorHandler
    });
  });
  
  test('initializeWorkflow should initialize the workflow', async () => {
    // テストコード...
  });
  
  // 他のテスト...
});
```

## パフォーマンスへの影響

依存性注入パターンの導入により、以下のパフォーマンスへの影響が考えられます：

1. **初期化時間**: サービスコンテナの初期化とサービスの登録に時間がかかる
2. **メモリ使用量**: サービスコンテナとサービスインスタンスの保持によるメモリ使用量の増加
3. **サービス解決のオーバーヘッド**: サービスの取得時に依存関係の解決が必要

しかし、これらの影響は一般的に小さく、依存性注入パターンの利点を考えると許容範囲内です。また、以下の最適化を行うことで、パフォーマンスへの影響を最小限に抑えることができます：

1. **遅延初期化**: サービスは必要になった時点で初期化する
2. **キャッシング**: 一度解決したサービスはキャッシュする
3. **循環参照の検出**: 循環参照を検出し、無限ループを防止する

## 利点

依存性注入パターンの導入により、以下の利点が得られます：

1. **疎結合**: コンポーネント間の依存関係が明確になり、変更の影響範囲が限定される
2. **テスト容易性**: モックやスタブを使用して依存関係を置き換えることができ、単体テストが容易になる
3. **柔軟性**: 実装の詳細を隠蔽し、インターフェースに依存することで、実装の変更が容易になる
4. **再利用性**: コンポーネントを再利用しやすくなる
5. **ライフサイクル管理**: コンポーネントのライフサイクルを一元管理できる

## 注意点

依存性注入パターンを使用する際の注意点は以下の通りです：

1. **複雑性の増加**: 依存性注入パターンを導入することで、コードの複雑性が増加する可能性がある
2. **学習コスト**: 依存性注入パターンを理解し、適切に使用するための学習コストがかかる
3. **オーバーエンジニアリング**: 小規模なプロジェクトでは、依存性注入パターンの導入がオーバーエンジニアリングになる可能性がある

## まとめ

依存性注入パターンは、コンポーネント間の依存関係を外部から注入することで、コンポーネントの結合度を下げ、テスト容易性、柔軟性、再利用性を向上させるデザインパターンです。knoaプロジェクトでは、`ServiceContainer`クラスを使用して依存性注入パターンを実装しています。

依存性注入パターンの導入により、コードの保守性と拡張性が向上し、テストが容易になります。また、パフォーマンスへの影響は一般的に小さく、依存性注入パターンの利点を考えると許容範囲内です。

## 参考資料

- [Dependency Injection in JavaScript](https://www.freecodecamp.org/news/a-quick-intro-to-dependency-injection-what-it-is-and-when-to-use-it-7578c84fa88f/)
- [InversifyJS - A powerful and lightweight inversion of control container for JavaScript & Node.js apps powered by TypeScript](https://inversify.io/)
- [Dependency Injection in Node.js](https://blog.risingstack.com/dependency-injection-in-node-js/)