# アダプターパターン実装ガイド

## 1. 概要

アダプターパターンは、既存のクラスのインターフェースを、クライアントが期待する別のインターフェースに変換するデザインパターンです。このパターンを使用することで、互換性のないインターフェースを持つクラス同士を連携させることができます。

システム統合リファクタリング（T011）では、アダプターパターンを活用して、ビジネスロジックを実装するマネージャークラスと外部インターフェース（CLI、API）の間の橋渡しを行います。これにより、マネージャークラスの実装詳細を隠蔽し、一貫したインターフェースを提供することができます。

## 2. 目的と利点

### 2.1 目的

- **インターフェースの提供**: 外部からのアクセスに一貫したインターフェースを提供する
- **実装詳細の隠蔽**: マネージャークラスの内部実装詳細を隠蔽する
- **バリデーションの一元化**: 入力パラメータの検証を一元的に行う
- **エラー処理の統一**: エラー処理を一貫した方法で行う
- **ログ記録の標準化**: 操作のログ記録を標準化する

### 2.2 利点

- **関心の分離**: ビジネスロジックとインターフェースの関心を分離できる
- **テスト容易性**: マネージャークラスとアダプターを個別にテストできる
- **変更の局所化**: マネージャークラスの変更がクライアントに影響しない
- **一貫性**: 外部インターフェースの一貫性を確保できる
- **再利用性**: 同じマネージャークラスに対して複数のアダプターを作成できる

## 3. 現状の課題

現在のシステムでは、アダプターパターンに関して以下の課題が存在します：

### 3.1 アクセス方法の混在

- CLIコードの一部では直接マネージャークラスを使用
- 他の部分ではアダプター経由でアクセス

```javascript
// 直接マネージャーを使用する例
const sessionManager = new SessionManager(/* ... */);

// アダプター経由でアクセスする例
const sessionManagerAdapter = container.get('sessionManagerAdapter');
```

### 3.2 アダプターの責任範囲の不明確さ

- 単純な委譲のみを行うアダプター
- バリデーションや変換も行うアダプター
- エラー処理を追加するアダプター

### 3.3 アダプターの実装の不一致

- 一部のアダプターはすべてのメソッドを公開
- 他のアダプターは限定的なメソッドのみを公開

### 3.4 アダプターとマネージャー間のインターフェース不一致

- メソッド名やパラメータの違い
- 戻り値の形式の違い

## 4. アダプターパターンの設計原則

### 4.1 単一責任の原則

アダプターは以下の責任を持ちます：

1. **インターフェースの提供**: クライアントが期待するインターフェースを提供する
2. **入力バリデーション**: 入力パラメータの検証を行う
3. **エラー処理**: エラーを捕捉し、適切に処理する
4. **ログ記録**: 操作のログを記録する
5. **データ変換**: 必要に応じてデータ形式を変換する

### 4.2 インターフェース分離の原則

- クライアントが必要とするメソッドのみを公開する
- 内部実装の詳細を隠蔽する

### 4.3 依存関係逆転の原則

- アダプターはマネージャークラスに依存するが、マネージャークラスはアダプターに依存しない
- 依存性注入を使用してマネージャークラスをアダプターに注入する

## 5. アダプターベースクラスの設計

アダプターの実装を標準化するために、ベースクラスを作成します。

```javascript
// src/lib/adapters/base-adapter.js
class BaseAdapter {
  /**
   * コンストラクタ
   * @param {Object} manager - 対象のマネージャーインスタンス
   * @param {Object} options - オプション
   * @param {Object} options.logger - ロガー
   * @param {Object} options.errorHandler - エラーハンドラー
   */
  constructor(manager, options = {}) {
    if (!manager) {
      throw new Error('Manager is required');
    }
    
    this.manager = manager;
    this.logger = options.logger || console;
    this.errorHandler = options.errorHandler;
  }
  
  /**
   * エラーを処理
   * @protected
   * @param {Error} error - エラー
   * @param {string} operation - 操作名
   * @param {Object} context - コンテキスト
   * @returns {*} エラー処理の結果
   */
  _handleError(error, operation, context = {}) {
    if (this.errorHandler && typeof this.errorHandler.handle === 'function') {
      return this.errorHandler.handle(error, this.constructor.name, operation, context);
    }
    
    this.logger.error(`Error in ${this.constructor.name}.${operation}:`, error);
    throw error;
  }
  
  /**
   * 入力パラメータを検証
   * @protected
   * @param {Object} params - パラメータ
   * @param {Array<string>} required - 必須パラメータ
   * @throws {ValidationError} 検証エラー
   */
  _validateParams(params, required = []) {
    if (!params) {
      throw new ValidationError('Parameters are required');
    }
    
    for (const param of required) {
      if (params[param] === undefined) {
        throw new ValidationError(`Parameter '${param}' is required`);
      }
    }
  }
}

module.exports = BaseAdapter;
```

## 6. 具体的なアダプター実装例

### 6.1 TaskManagerAdapter

```javascript
// src/lib/adapters/task-manager-adapter.js
const { ValidationError } = require('../core/error-framework');
const BaseAdapter = require('./base-adapter');

class TaskManagerAdapter extends BaseAdapter {
  /**
   * タスクを作成
   * @param {Object} taskData - タスクデータ
   * @returns {Promise<Object>} 作成されたタスク
   */
  async createTask(taskData) {
    try {
      this._validateParams(taskData, ['title']);
      
      return await this.manager.createTask(taskData);
    } catch (error) {
      return this._handleError(error, 'createTask', { taskData });
    }
  }
  
  /**
   * タスクを取得
   * @param {string} taskId - タスクID
   * @returns {Promise<Object>} タスク
   */
  async getTask(taskId) {
    try {
      this._validateParams({ taskId }, ['taskId']);
      
      return await this.manager.getTask(taskId);
    } catch (error) {
      return this._handleError(error, 'getTask', { taskId });
    }
  }
  
  /**
   * タスクを更新
   * @param {string} taskId - タスクID
   * @param {Object} updateData - 更新データ
   * @returns {Promise<Object>} 更新されたタスク
   */
  async updateTask(taskId, updateData) {
    try {
      this._validateParams({ taskId, updateData }, ['taskId', 'updateData']);
      
      return await this.manager.updateTask(taskId, updateData);
    } catch (error) {
      return this._handleError(error, 'updateTask', { taskId, updateData });
    }
  }
  
  /**
   * タスクを削除
   * @param {string} taskId - タスクID
   * @returns {Promise<boolean>} 削除結果
   */
  async deleteTask(taskId) {
    try {
      this._validateParams({ taskId }, ['taskId']);
      
      return await this.manager.deleteTask(taskId);
    } catch (error) {
      return this._handleError(error, 'deleteTask', { taskId });
    }
  }
  
  /**
   * すべてのタスクを取得
   * @returns {Promise<Array<Object>>} タスクの配列
   */
  async getAllTasks() {
    try {
      return await this.manager.getAllTasks();
    } catch (error) {
      return this._handleError(error, 'getAllTasks', {});
    }
  }
}

module.exports = TaskManagerAdapter;
```

### 6.2 SessionManagerAdapter

```javascript
// src/lib/adapters/session-manager-adapter.js
const { ValidationError } = require('../core/error-framework');
const BaseAdapter = require('./base-adapter');

class SessionManagerAdapter extends BaseAdapter {
  /**
   * 新しいセッションを作成
   * @returns {Promise<Object>} 作成されたセッション
   */
  async createNewSession() {
    try {
      return await this.manager.createNewSession();
    } catch (error) {
      return this._handleError(error, 'createNewSession', {});
    }
  }
  
  /**
   * セッションを取得
   * @param {string} sessionId - セッションID
   * @returns {Promise<Object>} セッション
   */
  async getSession(sessionId) {
    try {
      this._validateParams({ sessionId }, ['sessionId']);
      
      return await this.manager.getSession(sessionId);
    } catch (error) {
      return this._handleError(error, 'getSession', { sessionId });
    }
  }
  
  /**
   * 最新のセッションを取得
   * @returns {Promise<Object>} 最新のセッション
   */
  async getLatestSession() {
    try {
      return await this.manager.getLatestSession();
    } catch (error) {
      return this._handleError(error, 'getLatestSession', {});
    }
  }
  
  /**
   * セッションを終了
   * @param {string} sessionId - セッションID
   * @returns {Promise<Object>} 終了したセッション
   */
  async endSession(sessionId) {
    try {
      this._validateParams({ sessionId }, ['sessionId']);
      
      return await this.manager.endSession(sessionId);
    } catch (error) {
      return this._handleError(error, 'endSession', { sessionId });
    }
  }
}

module.exports = SessionManagerAdapter;
```

## 7. サービス定義の更新

アダプターをサービスコンテナに登録します。

```javascript
// src/lib/core/service-definitions.js
const TaskManagerAdapter = require('../adapters/task-manager-adapter');
const SessionManagerAdapter = require('../adapters/session-manager-adapter');
const FeedbackManagerAdapter = require('../adapters/feedback-manager-adapter');
const IntegrationManagerAdapter = require('../adapters/integration-manager-adapter');

// アダプターの登録
container.registerFactory('taskManagerAdapter', (c) => {
  return new TaskManagerAdapter(
    c.get('taskManager'),
    {
      logger: c.get('logger'),
      errorHandler: c.get('errorHandler')
    }
  );
});

container.registerFactory('sessionManagerAdapter', (c) => {
  return new SessionManagerAdapter(
    c.get('sessionManager'),
    {
      logger: c.get('logger'),
      errorHandler: c.get('errorHandler')
    }
  );
});

container.registerFactory('feedbackManagerAdapter', (c) => {
  return new FeedbackManagerAdapter(
    c.get('feedbackManager'),
    {
      logger: c.get('logger'),
      errorHandler: c.get('errorHandler')
    }
  );
});

container.registerFactory('integrationManagerAdapter', (c) => {
  return new IntegrationManagerAdapter(
    c.get('integrationManager'),
    {
      logger: c.get('logger'),
      errorHandler: c.get('errorHandler')
    }
  );
});
```

## 8. CLIからのアクセス方法

CLIからはアダプター経由でマネージャークラスにアクセスします。

```javascript
// src/cli/task.js
const ServiceContainer = require('../lib/core/service-container');
const { registerServices } = require('../lib/core/service-definitions');

// サービスコンテナの初期化
const container = new ServiceContainer();
registerServices(container);

// アダプター経由でアクセス
const taskManager = container.get('taskManagerAdapter');

// コマンド実装
async function createTask(args) {
  try {
    const task = await taskManager.createTask({
      title: args.title,
      description: args.description
    });
    
    console.log('Task created:', task);
  } catch (error) {
    console.error('Failed to create task:', error.message);
    process.exit(1);
  }
}

// 他のコマンド...
```

## 9. テスト戦略

### 9.1 アダプターの単体テスト

```javascript
// tests/lib/adapters/task-manager-adapter.test.js
const TaskManagerAdapter = require('../../../src/lib/adapters/task-manager-adapter');
const { ValidationError } = require('../../../src/lib/core/error-framework');

describe('TaskManagerAdapter', () => {
  let adapter;
  let mockManager;
  let mockLogger;
  let mockErrorHandler;
  
  beforeEach(() => {
    mockManager = {
      createTask: jest.fn(),
      getTask: jest.fn(),
      updateTask: jest.fn(),
      deleteTask: jest.fn(),
      getAllTasks: jest.fn()
    };
    
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };
    
    mockErrorHandler = {
      handle: jest.fn()
    };
    
    adapter = new TaskManagerAdapter(mockManager, {
      logger: mockLogger,
      errorHandler: mockErrorHandler
    });
  });
  
  describe('createTask', () => {
    test('should validate required parameters', async () => {
      await expect(adapter.createTask()).rejects.toThrow(ValidationError);
      await expect(adapter.createTask({})).rejects.toThrow(ValidationError);
    });
    
    test('should call manager.createTask with correct parameters', async () => {
      const taskData = { title: 'Test Task', description: 'Test Description' };
      mockManager.createTask.mockResolvedValue(taskData);
      
      const result = await adapter.createTask(taskData);
      
      expect(mockManager.createTask).toHaveBeenCalledWith(taskData);
      expect(result).toEqual(taskData);
    });
    
    test('should handle errors using errorHandler', async () => {
      const taskData = { title: 'Test Task' };
      const error = new Error('Test error');
      mockManager.createTask.mockRejectedValue(error);
      mockErrorHandler.handle.mockReturnValue({ error: true, message: 'Handled error' });
      
      const result = await adapter.createTask(taskData);
      
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        error,
        'TaskManagerAdapter',
        'createTask',
        { taskData }
      );
      expect(result).toEqual({ error: true, message: 'Handled error' });
    });
  });
  
  // 他のメソッドのテスト...
});
```

### 9.2 統合テスト

```javascript
// tests/lib/integration/adapter-manager-integration.test.js
const ServiceContainer = require('../../../src/lib/core/service-container');
const { registerServices } = require('../../../src/lib/core/service-definitions');

describe('Adapter-Manager Integration', () => {
  let container;
  let taskManagerAdapter;
  let taskManager;
  
  beforeEach(() => {
    container = new ServiceContainer();
    registerServices(container);
    
    taskManagerAdapter = container.get('taskManagerAdapter');
    taskManager = container.get('taskManager');
    
    // マネージャーのメソッドをスパイ
    jest.spyOn(taskManager, 'createTask');
    jest.spyOn(taskManager, 'getTask');
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  test('taskManagerAdapter.createTask should call taskManager.createTask', async () => {
    const taskData = { title: 'Test Task', description: 'Test Description' };
    
    await taskManagerAdapter.createTask(taskData);
    
    expect(taskManager.createTask).toHaveBeenCalledWith(taskData);
  });
  
  test('taskManagerAdapter.getTask should call taskManager.getTask', async () => {
    const taskId = 'test-task-id';
    
    await taskManagerAdapter.getTask(taskId);
    
    expect(taskManager.getTask).toHaveBeenCalledWith(taskId);
  });
  
  // 他のテスト...
});
```

## 10. 移行手順

### 10.1 アダプターベースクラスの作成

1. `src/lib/adapters/base-adapter.js`を作成
2. 共通機能（エラー処理、バリデーション）を実装

### 10.2 具体的なアダプターの実装

1. 各マネージャークラスに対応するアダプターを作成
2. ベースクラスを継承し、マネージャーのメソッドをラップ
3. 入力バリデーションとエラー処理を追加

### 10.3 サービス定義の更新

1. アダプターをサービスコンテナに登録
2. 依存関係を設定

### 10.4 CLIコードの更新

1. 直接マネージャーを使用している箇所をアダプター経由に変更
2. エラー処理を統一

### 10.5 テストの追加

1. アダプターの単体テストを作成
2. アダプターとマネージャーの統合テストを作成

## 11. 移行チェックリスト

- [ ] アダプターベースクラスの作成
- [ ] TaskManagerAdapterの実装
- [ ] SessionManagerAdapterの実装
- [ ] FeedbackManagerAdapterの実装
- [ ] IntegrationManagerAdapterの実装
- [ ] サービス定義の更新
- [ ] CLIコードの更新
- [ ] 単体テストの作成
- [ ] 統合テストの作成
- [ ] ドキュメントの更新

## 12. 結論

アダプターパターンを一貫して適用することで、マネージャークラスとクライアント間の橋渡しを行い、関心の分離、テスト容易性、変更の局所化、一貫性、再利用性などの利点を得ることができます。

アダプターベースクラスを作成し、共通機能を提供することで、アダプターの実装を標準化し、コードの重複を削減することができます。また、入力バリデーションとエラー処理を一元化することで、堅牢性と保守性を向上させることができます。

CLIからはアダプター経由でマネージャークラスにアクセスすることで、マネージャークラスの実装詳細を隠蔽し、一貫したインターフェースを提供することができます。