# 依存性注入パターンの実装ガイド

## 概要

このガイドでは、knoaプロジェクトにおける依存性注入パターンの実装方法について説明します。依存性注入パターンは、コンポーネント間の依存関係を外部から注入することで、コンポーネントの結合度を下げ、テスト容易性、柔軟性、再利用性を向上させるデザインパターンです。

## 目次

1. [基本概念](#基本概念)
2. [実装手順](#実装手順)
3. [サービスコンテナの実装](#サービスコンテナの実装)
4. [サービス定義の実装](#サービス定義の実装)
5. [コンポーネントの移行](#コンポーネントの移行)
6. [テストの実装](#テストの実装)
7. [ベストプラクティス](#ベストプラクティス)
8. [よくある問題と解決策](#よくある問題と解決策)

## 基本概念

依存性注入パターンは、以下の3つの基本概念に基づいています：

1. **サービス**: 特定の機能を提供するコンポーネント
2. **クライアント**: サービスを使用するコンポーネント
3. **インジェクター**: クライアントにサービスを注入するコンポーネント

依存性注入パターンでは、クライアントはサービスの具体的な実装に依存せず、インターフェースに依存します。インジェクターは、クライアントにサービスの具体的な実装を注入します。

## 実装手順

依存性注入パターンを実装するための手順は以下の通りです：

1. サービスコンテナの実装
2. サービス定義の実装
3. コンポーネントの移行
4. テストの実装

## サービスコンテナの実装

サービスコンテナは、サービスの登録と解決を担当するコンポーネントです。以下は、knoaプロジェクトで使用しているサービスコンテナの実装例です：

```javascript
// src/lib/core/service-container.js
class ServiceContainer {
  constructor() {
    this.services = new Map();
    this.factories = new Map();
    this.resolving = new Set(); // 循環参照検出用
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
    // サービスが既に登録されているか確認
    if (this.services.has(name)) {
      return this.services.get(name);
    }
    
    // ファクトリーが登録されているか確認
    if (this.factories.has(name)) {
      // 循環参照のチェック
      if (this.resolving.has(name)) {
        throw new Error(`循環参照が検出されました: ${Array.from(this.resolving).join(' -> ')} -> ${name}`);
      }
      
      // 解決中のサービスとしてマーク
      this.resolving.add(name);
      
      try {
        // ファクトリー関数を実行してインスタンスを作成
        const factory = this.factories.get(name);
        const instance = factory(this);
        
        // インスタンスをキャッシュ
        this.services.set(name, instance);
        
        return instance;
      } finally {
        // 解決中のマークを解除
        this.resolving.delete(name);
      }
    }
    
    throw new Error(`サービス '${name}' が見つかりません`);
  }

  // サービスが登録されているか確認
  has(name) {
    return this.services.has(name) || this.factories.has(name);
  }

  // サービスを削除
  remove(name) {
    const serviceRemoved = this.services.delete(name);
    const factoryRemoved = this.factories.delete(name);
    return serviceRemoved || factoryRemoved;
  }

  // すべてのサービスをクリア
  clear() {
    this.services.clear();
    this.factories.clear();
    this.resolving.clear();
  }

  // 登録されているすべてのサービス名を取得
  getRegisteredServiceNames() {
    return [
      ...new Set([
        ...Array.from(this.services.keys()),
        ...Array.from(this.factories.keys())
      ])
    ];
  }
}

module.exports = ServiceContainer;
```

## サービス定義の実装

サービス定義は、アプリケーションで使用するサービスを定義し、依存関係を解決するコンポーネントです。以下は、knoaプロジェクトで使用しているサービス定義の実装例です：

```javascript
// src/lib/core/service-definitions.js
const ServiceContainer = require('./service-container');
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
    const stateManager = container.get('stateManager');
    const cacheManager = container.get('cacheManager');
    
    return new IntegrationManager({
      taskManager,
      sessionManager,
      feedbackManager,
      eventEmitter,
      errorHandler,
      stateManager,
      cacheManager
    });
  });
  
  return container;
}

module.exports = { createContainer };
```

## コンポーネントの移行

既存のコンポーネントを依存性注入パターンに移行するには、以下の手順を実施します：

1. コンストラクタで依存関係を受け取るように修正
2. 依存関係のバリデーションを追加
3. 内部実装を依存性注入パターンに対応

以下は、`IntegrationManager`クラスを依存性注入パターンに移行した例です：

```javascript
// src/utils/integration-manager.js
const { ValidationError, StateError, DataConsistencyError, LockTimeoutError } = require('./errors');

class IntegrationManager {
  /**
   * コンストラクタ
   * @param {Object} options - オプション
   * @param {Object} options.taskManager - タスク管理アダプター（必須）
   * @param {Object} options.sessionManager - セッション管理アダプター（必須）
   * @param {Object} options.feedbackManager - フィードバック管理アダプター（必須）
   * @param {Object} options.eventEmitter - イベントエミッター（必須）
   * @param {Object} options.errorHandler - エラーハンドラー（必須）
   * @param {Object} options.stateManager - 状態管理（必須）
   * @param {Object} options.cacheManager - キャッシュ管理（必須）
   */
  constructor(options) {
    // 必須パラメータのバリデーション
    if (!options.taskManager) throw new ValidationError('taskManager is required');
    if (!options.sessionManager) throw new ValidationError('sessionManager is required');
    if (!options.feedbackManager) throw new ValidationError('feedbackManager is required');
    if (!options.eventEmitter) throw new ValidationError('eventEmitter is required');
    if (!options.errorHandler) throw new ValidationError('errorHandler is required');
    if (!options.stateManager) throw new ValidationError('stateManager is required');
    if (!options.cacheManager) throw new ValidationError('cacheManager is required');
    
    // 依存関係の設定
    this.taskManager = options.taskManager;
    this.sessionManager = options.sessionManager;
    this.feedbackManager = options.feedbackManager;
    this.eventEmitter = options.eventEmitter;
    this.errorHandler = options.errorHandler;
    this.stateManager = options.stateManager;
    this.cacheManager = options.cacheManager;
    
    // イベントリスナーの登録
    this._registerEventListeners();
  }
  
  // メソッドの実装...
  
  /**
   * イベントリスナーを登録
   * @private
   */
  _registerEventListeners() {
    this.eventEmitter.on('task:created', (data) => {
      // タスク作成時の処理
    });
    
    this.eventEmitter.on('session:started', (data) => {
      // セッション開始時の処理
    });
    
    this.eventEmitter.on('feedback:collected', (data) => {
      // フィードバック収集時の処理
    });
  }
}

module.exports = IntegrationManager;
```

## テストの実装

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
  let mockStateManager;
  let mockCacheManager;
  
  beforeEach(() => {
    // モックを作成
    mockTaskManager = createMockTaskManager();
    mockSessionManager = createMockSessionManager();
    mockFeedbackManager = createMockFeedbackManager();
    mockEventEmitter = { emit: jest.fn(), on: jest.fn() };
    mockErrorHandler = { handle: jest.fn() };
    mockStateManager = { getCurrentState: jest.fn(), transitionTo: jest.fn() };
    mockCacheManager = { get: jest.fn(), set: jest.fn(), clear: jest.fn() };
    
    // IntegrationManagerを作成
    integrationManager = new IntegrationManager({
      taskManager: mockTaskManager,
      sessionManager: mockSessionManager,
      feedbackManager: mockFeedbackManager,
      eventEmitter: mockEventEmitter,
      errorHandler: mockErrorHandler,
      stateManager: mockStateManager,
      cacheManager: mockCacheManager
    });
  });
  
  test('コンストラクタで依存関係を正しく設定する', () => {
    expect(integrationManager.taskManager).toBe(mockTaskManager);
    expect(integrationManager.sessionManager).toBe(mockSessionManager);
    expect(integrationManager.feedbackManager).toBe(mockFeedbackManager);
    expect(integrationManager.eventEmitter).toBe(mockEventEmitter);
    expect(integrationManager.errorHandler).toBe(mockErrorHandler);
    expect(integrationManager.stateManager).toBe(mockStateManager);
    expect(integrationManager.cacheManager).toBe(mockCacheManager);
  });
  
  test('必須の依存関係が欠けている場合はエラーをスローする', () => {
    expect(() => {
      new IntegrationManager({
        // taskManagerを省略
        sessionManager: mockSessionManager,
        feedbackManager: mockFeedbackManager,
        eventEmitter: mockEventEmitter,
        errorHandler: mockErrorHandler,
        stateManager: mockStateManager,
        cacheManager: mockCacheManager
      });
    }).toThrow('taskManager is required');
  });
  
  // 他のテスト...
});
```

## ベストプラクティス

依存性注入パターンを使用する際のベストプラクティスは以下の通りです：

1. **インターフェースに依存する**: 具体的な実装ではなく、インターフェースに依存するようにしましょう。
2. **必須パラメータのバリデーション**: コンストラクタで必須パラメータのバリデーションを行いましょう。
3. **デフォルト値の提供**: オプションパラメータにはデフォルト値を提供しましょう。
4. **イミュータブルな依存関係**: 依存関係は変更不可能にしましょう。
5. **単一責任の原則**: 各クラスは単一の責任を持つようにしましょう。
6. **依存関係の最小化**: 依存関係は必要最小限にしましょう。

## よくある問題と解決策

### 循環参照

循環参照は、2つ以上のコンポーネントが互いに依存している場合に発生します。例えば、AがBに依存し、BがAに依存している場合です。

**解決策**:
- サービスコンテナで循環参照を検出し、エラーをスローする
- 依存関係を再設計し、循環参照を解消する
- イベント駆動アーキテクチャを使用して、直接的な依存関係を減らす

### 過剰な依存関係

過剰な依存関係は、コンポーネントが多くの依存関係を持っている場合に発生します。これは、コンポーネントの責任が大きすぎることを示している可能性があります。

**解決策**:
- コンポーネントを分割し、責任を分散する
- ファサードパターンを使用して、複数の依存関係を1つのインターフェースにまとめる
- 依存関係を最小限に抑える

### テスト時の依存関係の管理

テスト時に多くの依存関係をモックする必要がある場合、テストが複雑になる可能性があります。

**解決策**:
- モックファクトリーを使用して、モックの作成を簡素化する
- テスト用のサービスコンテナを使用して、依存関係を一元管理する
- テスト用のヘルパー関数を作成して、テストの設定を簡素化する