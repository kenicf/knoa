# 依存性注入のベストプラクティス

> **難易度: 中級** | 所要時間: 20分

このドキュメントでは、knoaプロジェクトにおける依存性注入パターンを効果的に使用するためのベストプラクティスを説明します。依存関係の粒度、インターフェース設計、循環参照の回避など、実践的なガイドラインを提供します。

## 目次

- [1. 依存関係の粒度の最適化](#1-依存関係の粒度の最適化)
- [2. インターフェースの設計](#2-インターフェースの設計)
- [3. 命名規則](#3-命名規則)
- [4. パフォーマンス最適化](#4-パフォーマンス最適化)
- [5. 一般的な落とし穴と回避方法](#5-一般的な落とし穴と回避方法)
- [6. コードレビューチェックリスト](#6-コードレビューチェックリスト)
- [7. よくある問題と解決策](#7-よくある問題と解決策)
- [8. まとめと次のステップ](#8-まとめと次のステップ)

## 1. 依存関係の粒度の最適化

依存関係の粒度は、コンポーネントの再利用性、テスト容易性、保守性に大きな影響を与えます。適切な粒度を選択することで、より柔軟で堅牢なシステムを構築できます。

### 1.1 粒度が細かすぎる場合の問題

依存関係の粒度が細かすぎると、以下の問題が発生する可能性があります：

- **コンストラクタの肥大化**: 多数の依存関係を注入する必要があり、コンストラクタが複雑になる
- **管理の複雑化**: 多数の小さなサービスを管理する必要があり、全体像が把握しにくくなる
- **オーバーヘッドの増加**: サービス解決のオーバーヘッドが増加する

```javascript
// 粒度が細かすぎる例
class TaskManager {
  constructor(options) {
    this.fileReader = options.fileReader;
    this.fileWriter = options.fileWriter;
    this.jsonParser = options.jsonParser;
    this.jsonStringifier = options.jsonStringifier;
    this.directoryCreator = options.directoryCreator;
    this.pathResolver = options.pathResolver;
    this.logger = options.logger;
    this.eventEmitter = options.eventEmitter;
    this.errorHandler = options.errorHandler;
    this.validator = options.validator;
    // ...他の依存関係
  }
}
```

### 1.2 粒度が粗すぎる場合の問題

依存関係の粒度が粗すぎると、以下の問題が発生する可能性があります：

- **結合度の増加**: コンポーネントが密結合になり、変更の影響範囲が広がる
- **テスト困難性**: 大きな依存関係をモックすることが難しくなる
- **責任の不明確化**: コンポーネントの責任が不明確になり、単一責任の原則に違反する

```javascript
// 粒度が粗すぎる例
class TaskManager {
  constructor(options) {
    this.utilityService = options.utilityService; // 多くの機能を持つ巨大なサービス
  }
  
  createTask(taskData) {
    // utilityServiceの多くのメソッドに依存
    this.utilityService.validateData(taskData);
    this.utilityService.createDirectory('tasks');
    this.utilityService.writeJsonFile('tasks/task.json', taskData);
    this.utilityService.logInfo('Task created');
    this.utilityService.emitEvent('task:created', taskData);
  }
}
```

### 1.3 適切な粒度の選択

適切な粒度を選択するためのガイドラインは以下の通りです：

1. **単一責任の原則に従う**: 各サービスは明確に定義された単一の責任を持つべき
2. **関連する機能をグループ化する**: 密接に関連する機能は同じサービスにグループ化する
3. **インターフェースの安定性を考慮する**: 変更頻度の低いインターフェースを持つサービスを設計する
4. **テスト容易性を考慮する**: モックしやすいサイズのサービスを設計する

```javascript
// 適切な粒度の例
class TaskManager {
  constructor(options) {
    this.storageService = options.storageService; // ファイル操作を抽象化
    this.logger = options.logger; // ログ機能
    this.eventEmitter = options.eventEmitter; // イベント発行
    this.validator = options.validator; // バリデーション
  }
  
  createTask(taskData) {
    this.validator.validate(taskData);
    this.storageService.writeJSON('tasks', 'task.json', taskData);
    this.logger.info('Task created');
    this.eventEmitter.emit('task:created', taskData);
  }
}
```

### 1.4 ファサードパターンの活用

複数の小さなサービスを使用する必要がある場合は、ファサードパターンを使用して、それらを単一のインターフェースの背後に隠すことを検討してください。

```javascript
// ファサードパターンの例
class StorageServiceFacade {
  constructor(options) {
    this.fileReader = options.fileReader;
    this.fileWriter = options.fileWriter;
    this.jsonParser = options.jsonParser;
    this.jsonStringifier = options.jsonStringifier;
    this.directoryCreator = options.directoryCreator;
    this.pathResolver = options.pathResolver;
  }
  
  // シンプルなインターフェースを提供
  readJSON(directory, filename) {
    const path = this.pathResolver.resolve(directory, filename);
    const content = this.fileReader.read(path);
    return this.jsonParser.parse(content);
  }
  
  writeJSON(directory, filename, data) {
    const path = this.pathResolver.resolve(directory, filename);
    this.directoryCreator.create(directory);
    const content = this.jsonStringifier.stringify(data);
    this.fileWriter.write(path, content);
  }
}

// 使用例
class TaskManager {
  constructor(options) {
    this.storageService = options.storageService; // ファサード
    this.logger = options.logger;
    this.eventEmitter = options.eventEmitter;
  }
}
```

## 2. インターフェースの設計

依存性注入パターンを効果的に使用するためには、適切なインターフェースの設計が重要です。インターフェースは、コンポーネント間の契約を定義し、実装の詳細を隠蔽します。

### 2.1 インターフェースの安定性

インターフェースは、できるだけ安定していることが望ましいです。頻繁に変更されるインターフェースは、依存するコンポーネントに影響を与え、保守性を低下させます。

```javascript
// 安定したインターフェースの例
class StorageService {
  // 基本的なCRUD操作のみを提供
  read(path) { /* ... */ }
  write(path, content) { /* ... */ }
  delete(path) { /* ... */ }
  exists(path) { /* ... */ }
}
```

### 2.2 インターフェースの明確性

インターフェースは、その目的と使用方法が明確であることが重要です。メソッド名、引数、戻り値は、直感的で理解しやすいものにしましょう。

```javascript
// 明確なインターフェースの例
class TaskRepository {
  // 明確なメソッド名と引数
  async findById(id) { /* ... */ }
  async findAll() { /* ... */ }
  async create(taskData) { /* ... */ }
  async update(id, taskData) { /* ... */ }
  async delete(id) { /* ... */ }
}
```

### 2.3 インターフェースの最小化

インターフェースは、必要最小限のメソッドのみを提供することが望ましいです。不要なメソッドを含むインターフェースは、使用者を混乱させ、誤用を招く可能性があります。

```javascript
// 最小化されたインターフェースの例
class Logger {
  // 基本的なログメソッドのみを提供
  debug(message, ...args) { /* ... */ }
  info(message, ...args) { /* ... */ }
  warn(message, ...args) { /* ... */ }
  error(message, ...args) { /* ... */ }
}
```

### 2.4 インターフェースの分離

インターフェースの分離原則（Interface Segregation Principle）に従い、クライアントが使用しないメソッドに依存しないようにしましょう。大きなインターフェースは、小さな特化したインターフェースに分割することを検討してください。

```javascript
// インターフェースの分離の例
// 読み取り専用インターフェース
class TaskReader {
  async findById(id) { /* ... */ }
  async findAll() { /* ... */ }
}

// 書き込み専用インターフェース
class TaskWriter {
  async create(taskData) { /* ... */ }
  async update(id, taskData) { /* ... */ }
  async delete(id) { /* ... */ }
}

// 両方のインターフェースを実装するクラス
class TaskRepository {
  async findById(id) { /* ... */ }
  async findAll() { /* ... */ }
  async create(taskData) { /* ... */ }
  async update(id, taskData) { /* ... */ }
  async delete(id) { /* ... */ }
}

// 読み取り専用の操作のみを必要とするクライアント
class TaskViewer {
  constructor(taskReader) {
    this.taskReader = taskReader;
  }
  
  async viewTask(id) {
    return this.taskReader.findById(id);
  }
}
```

## 3. 命名規則

一貫した命名規則は、コードの可読性と保守性を向上させます。knoaプロジェクトでは、以下の命名規則を採用しています。

### 3.1 サービス名

サービス名は、以下の規則に従って命名します：

1. **基本サービス**: `logger`, `config`, `eventEmitter`, `errorHandler`
2. **ユーティリティサービス**: `storageService`, `gitService`, `lockManager`
3. **マネージャーサービス**: `taskManager`, `sessionManager`, `feedbackManager`, `integrationManager`
4. **アダプターサービス**: `taskManagerAdapter`, `sessionManagerAdapter`, `feedbackManagerAdapter`

### 3.2 ファイル名

ファイル名は、以下の規則に従って命名します：

1. **コアコンポーネント**: `service-container.js`, `service-definitions.js`, `error-framework.js`
2. **ユーティリティ**: `storage.js`, `git.js`, `lock-manager.js`
3. **マネージャー**: `task-manager.js`, `session-manager.js`, `feedback-manager.js`, `integration-manager.js`
4. **アダプター**: `base-adapter.js`, `task-manager-adapter.js`, `session-manager-adapter.js`, `feedback-manager-adapter.js`

### 3.3 クラス名

クラス名は、以下の規則に従って命名します：

1. **コアコンポーネント**: `ServiceContainer`, `ErrorHandler`
2. **ユーティリティ**: `StorageService`, `GitService`, `LockManager`
3. **マネージャー**: `TaskManager`, `SessionManager`, `FeedbackManager`, `IntegrationManager`
4. **アダプター**: `BaseAdapter`, `TaskManagerAdapter`, `SessionManagerAdapter`, `FeedbackManagerAdapter`

### 3.4 メソッド名

メソッド名は、以下の規則に従って命名します：

1. **取得メソッド**: `get`, `find`, `retrieve`, `fetch`
2. **作成メソッド**: `create`, `add`, `register`
3. **更新メソッド**: `update`, `modify`, `change`
4. **削除メソッド**: `delete`, `remove`, `unregister`
5. **検証メソッド**: `validate`, `verify`, `check`
6. **ユーティリティメソッド**: `format`, `parse`, `convert`

### 3.5 プライベートメソッド

プライベートメソッドは、アンダースコアプレフィックスを使用して命名します：

```javascript
class TaskManager {
  constructor(options) {
    this.storageService = options.storageService;
  }
  
  // パブリックメソッド
  async createTask(taskData) {
    this._validateTaskData(taskData);
    const task = this._formatTask(taskData);
    await this._saveTask(task);
    return task;
  }
  
  // プライベートメソッド
  _validateTaskData(taskData) {
    // バリデーションロジック
  }
  
  _formatTask(taskData) {
    // フォーマットロジック
  }
  
  async _saveTask(task) {
    // 保存ロジック
  }
}
```

## 4. パフォーマンス最適化

依存性注入パターンを使用する際のパフォーマンス最適化について説明します。

### 4.1 サービス解決の遅延評価（Lazy Loading）

サービスが実際に使用されるまで初期化を遅らせることで、起動時間を短縮できます。

```javascript
// 遅延初期化の実装
class LazyServiceContainer extends ServiceContainer {
  registerLazy(name, factory) {
    this.registerFactory(name, (container) => {
      // 遅延初期化用のプロキシ
      return new Proxy({}, {
        get: (target, prop) => {
          if (!target._instance) {
            // 実際に使用されるまでインスタンス化を遅延
            target._instance = factory(container);
          }
          return target._instance[prop];
        }
      });
    });
    
    return this;
  }
}

// 使用例
container.registerLazy('expensiveService', (container) => {
  // 重い初期化処理
  return new ExpensiveService();
});
```

### 4.2 キャッシング戦略

サービスインスタンスをキャッシュすることで、再解決のオーバーヘッドを削減できます。

```javascript
// キャッシングの実装
class CachingServiceContainer extends ServiceContainer {
  constructor() {
    super();
    this.cache = new Map();
  }
  
  get(name) {
    // キャッシュからサービスを取得
    if (this.cache.has(name)) {
      return this.cache.get(name);
    }
    
    // サービスを解決
    const service = super.get(name);
    
    // サービスをキャッシュ
    this.cache.set(name, service);
    
    return service;
  }
  
  // キャッシュをクリア
  clearCache() {
    this.cache.clear();
  }
  
  // 特定のサービスのキャッシュをクリア
  clearCacheFor(name) {
    this.cache.delete(name);
  }
}
```

### 4.3 メモリ使用量の最適化

メモリ使用量を最適化するには、以下の方法があります：

#### 4.3.1 不要なサービスの破棄

不要になったサービスを破棄することで、メモリを解放できます。

```javascript
// サービスの破棄
class DisposableServiceContainer extends ServiceContainer {
  dispose(name) {
    if (!this.services.has(name)) {
      return false;
    }
    
    const service = this.services.get(name);
    
    // サービスが破棄可能な場合は破棄
    if (typeof service.dispose === 'function') {
      service.dispose();
    }
    
    // サービスを削除
    this.services.delete(name);
    
    return true;
  }
}
```

#### 4.3.2 スコープ付きサービス

スコープ付きサービスを使用することで、特定のスコープが終了したときにサービスを自動的に破棄できます。

```javascript
// スコープ付きサービスの実装
class ScopedServiceContainer extends ServiceContainer {
  constructor(parentContainer, scopeId) {
    super();
    this.parentContainer = parentContainer;
    this.scopeId = scopeId;
  }
  
  // スコープを破棄
  dispose() {
    for (const [name, service] of this.services.entries()) {
      if (typeof service.dispose === 'function') {
        service.dispose();
      }
    }
    
    this.services.clear();
    this.factories.clear();
  }
}
```

#### 4.3.3 循環参照の回避

循環参照を回避することで、メモリリークを防止できます。

```javascript
// 循環参照の回避
class ServiceA {
  constructor(container) {
    this.container = container;
  }
  
  // 必要になった時点でServiceBを取得
  useServiceB() {
    const serviceB = this.container.get('serviceB');
    // serviceB を使用...
  }
}

class ServiceB {
  constructor(container) {
    this.container = container;
  }
  
  // 必要になった時点でServiceAを取得
  useServiceA() {
    const serviceA = this.container.get('serviceA');
    // serviceA を使用...
  }
}
```

## 5. 一般的な落とし穴と回避方法

依存性注入パターンを使用する際の一般的な落とし穴と、その回避方法について説明します。

### 5.1 コンストラクタの肥大化

多数の依存関係を注入すると、コンストラクタが肥大化し、可読性が低下します。

**回避方法**:
1. **オプションオブジェクトパターンを使用する**: 依存関係をオプションオブジェクトとして渡す
2. **ファサードパターンを使用する**: 関連する依存関係をファサードの背後に隠す
3. **依存関係の粒度を見直す**: 依存関係の粒度が適切かどうかを検討する

```javascript
// オプションオブジェクトパターン
class TaskManager {
  constructor(options) {
    this.storageService = options.storageService;
    this.logger = options.logger || console;
    this.eventEmitter = options.eventEmitter;
    this.errorHandler = options.errorHandler;
  }
}
```

### 5.2 サービスロケーターの誤用

サービスコンテナを直接コンポーネントに渡すと、サービスロケーターパターンになり、依存関係が不明確になります。

**回避方法**:
1. **必要なサービスのみを注入する**: サービスコンテナではなく、必要なサービスのみを注入する
2. **ファクトリー関数を使用する**: サービスコンテナはファクトリー関数内でのみ使用する

```javascript
// 悪い例（サービスロケーター）
class TaskManager {
  constructor(container) {
    this.container = container;
  }
  
  createTask(taskData) {
    const storageService = this.container.get('storageService');
    const logger = this.container.get('logger');
    // ...
  }
}

// 良い例（依存性注入）
class TaskManager {
  constructor(options) {
    this.storageService = options.storageService;
    this.logger = options.logger;
  }
  
  createTask(taskData) {
    // ...
  }
}
```

### 5.3 過剰な抽象化

不必要に多くの抽象化レイヤーを導入すると、コードが理解しにくくなります。

**回避方法**:
1. **YAGNI原則に従う**: You Aren't Gonna Need It（必要になるまで作らない）
2. **抽象化の目的を明確にする**: 抽象化の目的と利点を明確にする
3. **コードの複雑さとのバランスを取る**: 抽象化による利点と複雑さのバランスを考慮する

```javascript
// 過剰な抽象化の例
interface ITaskDataValidator {
  validate(data: any): boolean;
}

interface ITaskDataFormatter {
  format(data: any): any;
}

interface ITaskStorage {
  save(task: any): Promise<any>;
}

class TaskManager {
  constructor(
    private validator: ITaskDataValidator,
    private formatter: ITaskDataFormatter,
    private storage: ITaskStorage
  ) {}
  
  // ...
}

// 適切な抽象化の例
class TaskManager {
  constructor(options) {
    this.storageService = options.storageService;
    this.validator = options.validator;
  }
  
  // ...
}
```

### 5.4 循環参照

循環参照は、2つ以上のサービスが互いに依存している場合に発生します。

**回避方法**:
1. **依存関係の再設計**: 依存関係を再設計し、循環参照を解消する
2. **遅延初期化**: サービスが実際に使用されるまで依存関係の解決を遅らせる
3. **イベント駆動アーキテクチャ**: 直接的な依存関係をイベントベースの通信に置き換える

```javascript
// 循環参照の例
class ServiceA {
  constructor(serviceB) {
    this.serviceB = serviceB;
  }
}

class ServiceB {
  constructor(serviceA) {
    this.serviceA = serviceA;
  }
}

// 遅延初期化による解決
class ServiceA {
  constructor(container) {
    this.container = container;
  }
  
  useServiceB() {
    const serviceB = this.container.get('serviceB');
    // serviceB を使用...
  }
}
```

## 6. コードレビューチェックリスト

依存性注入パターンを使用したコードをレビューする際のチェックリストです。

### 6.1 依存関係の粒度

- [ ] 依存関係の粒度は適切か？
- [ ] コンストラクタに多すぎる依存関係が注入されていないか？
- [ ] 依存関係が少なすぎて、コンポーネントが多くの責任を持っていないか？

### 6.2 インターフェースの設計

- [ ] インターフェースは明確で理解しやすいか？
- [ ] インターフェースは最小限のメソッドのみを提供しているか？
- [ ] インターフェースは安定しているか？
- [ ] インターフェースの分離原則に従っているか？

### 6.3 命名規則

- [ ] サービス名は命名規則に従っているか？
- [ ] ファイル名は命名規則に従っているか？
- [ ] クラス名は命名規則に従っているか？
- [ ] メソッド名は命名規則に従っているか？

### 6.4 パフォーマンス

- [ ] サービス解決のパフォーマンスは最適化されているか？
- [ ] 不要なサービスは適切に破棄されているか？
- [ ] メモリリークの可能性はないか？

### 6.5 一般的な落とし穴

- [ ] コンストラクタの肥大化を避けているか？
- [ ] サービスロケーターの誤用を避けているか？
- [ ] 過剰な抽象化を避けているか？
- [ ] 循環参照を避けているか？

### 6.6 テスト容易性

- [ ] コンポーネントは単体テスト可能か？
- [ ] 依存関係はモック可能か？
- [ ] テストコードは依存性注入を活用しているか？

## 7. よくある問題と解決策

依存性注入パターンを使用する際によくある問題と、その解決策について説明します。

### 7.1 サービスの初期化順序の問題

**問題**: サービスの初期化順序が重要な場合、依存関係の解決順序によっては問題が発生する可能性があります。

**解決策**:
1. **明示的な初期化メソッド**: サービスに明示的な初期化メソッドを追加し、依存関係の解決後に呼び出す
2. **初期化イベント**: サービスの初期化完了時にイベントを発行し、他のサービスがそれを購読する
3. **非同期初期化**: 非同期初期化を使用し、依存関係の初期化が完了するのを待つ

```javascript
// 明示的な初期化メソッド
class DatabaseService {
  constructor(config) {
    this.config = config;
    this.connection = null;
  }
  
  async initialize() {
    this.connection = await createDatabaseConnection(this.config);
    return this;
  }
}

// 使用例
container.registerFactory('databaseService', async (container) => {
  const config = container.get('config');
  const service = new DatabaseService(config);
  return await service.initialize();
});
```

### 7.2 テスト時のモック作成の複雑さ

**問題**: 複雑な依存関係を持つコンポーネントのテストでは、多数のモックを作成する必要があり、テストコードが複雑になる可能性があります。

**解決策**:
1. **モックファクトリー**: 一般的なモックを作成するファクトリー関数を用意する
2. **テスト用のサービス定義**: テスト用のサービス定義を用意し、モックを一元管理する
3. **テストヘルパー**: テストヘルパーを用意し、モックの作成と設定を簡略化する

```javascript
// モックファクトリー
function createMockStorageService() {
  return {
    readJSON: jest.fn().mockResolvedValue({ data: 'test' }),
    writeJSON: jest.fn().mockResolvedValue(true),
    fileExists: jest.fn().mockReturnValue(true),
    ensureDirectoryExists: jest.fn()
  };
}

// テスト用のサービス定義
function createTestContainer() {
  const container = new ServiceContainer();
  
  container.register('logger', createMockLogger());
  container.register('storageService', createMockStorageService());
  container.register('eventEmitter', createMockEventEmitter());
  
  return container;
}

// テストヘルパー
class TestHelper {
  constructor() {
    this.container = createTestContainer();
  }
  
  // モックの振る舞いを設定
  mockStorageServiceReadJSON(data) {
    const storageService = this.container.get('storageService');
    storageService.readJSON.mockResolvedValue(data);
  }
  
  // テスト対象のコンポーネントを作成
  createTaskManager() {
    return new TaskManager({
      storageService: this.container.get('storageService'),
      logger: this.container.get('logger'),
      eventEmitter: this.container.get('eventEmitter')
    });
  }
}
```

### 7.3 依存関係の変更による影響範囲の把握

**問題**: 依存関係の変更（インターフェースの変更など）が、どのコンポーネントに影響するかを把握することが難しい場合があります。

**解決策**:
1. **依存関係グラフの可視化**: 依存関係グラフを可視化し、影響範囲を把握する
2. **インターフェースの安定性**: インターフェースの変更を最小限に抑え、安定したインターフェースを設計する
3. **バージョニング**: インターフェースの変更時にはバージョニングを行い、互換性を維持する

```javascript
// 依存関係グラフの可視化
function visualizeDependencies(container) {
  const services = container.getRegisteredServiceNames();
  const dependencies = new Map();
  
  // 依存関係の収集
  for (const name of services) {
    if (container.factories.has(name)) {
      const factory = container.factories.get(name);
      const factoryStr = factory.toString();
      
      // ファクトリー関数から依存関係を抽出
      const deps = services.filter(service => 
        factoryStr.includes(`container.get('${service}')`) ||
        factoryStr.includes(`container.get("${service}")`)
      );
      
      dependencies.set(name, deps);
    }
  }
  
  // Mermaid形式で出力
  let mermaid = 'graph TD\n';
  
  for (const [service, deps] of dependencies.entries()) {
    for (const dep of deps) {
      mermaid += `    ${dep}-->${service}\n`;
    }
  }
  
  return mermaid;
}
```

## 8. まとめと次のステップ

### 8.1 まとめ

依存性注入パターンを効果的に使用するためのベストプラクティスを紹介しました。主なポイントは以下の通りです：

1. **依存関係の粒度の最適化**: 適切な粒度を選択し、コンポーネントの再利用性、テスト容易性、保守性を向上させる
2. **インターフェースの設計**: 安定した、明確で最小限のインターフェースを設計する
3. **命名規則**: 一貫した命名規則を採用し、コードの可読性と保守性を向上させる
4. **パフォーマンス最適化**: サービス解決の遅延評価、キャッシング戦略、メモリ使用量の最適化を行う
5. **一般的な落とし穴と回避方法**: コンストラクタの肥大化、サービスロケーターの誤用、過剰な抽象化、循環参照を避ける
6. **コードレビューチェックリスト**: 依存性注入パターンを使用したコードをレビューする際のチェックリスト
7. **よくある問題と解決策**: サービスの初期化順序の問題、テスト時のモック作成の複雑さ、依存関係の変更による影響範囲の把握

### 8.2 次のステップ

依存性注入パターンをさらに理解し、活用するための次のステップは以下の通りです：

1. **依存性注入アーキテクチャガイドを読む**: [依存性注入アーキテクチャガイド](./dependency-injection-architecture-guide.md)を参照して、依存性注入アーキテクチャの詳細な実装と使用方法を学ぶ
2. **テスト方法を学ぶ**: [依存性注入のテストガイド](./dependency-injection-testing-guide.md)を参照して、依存性注入パターンを使用したコードのテスト方法を学ぶ
3. **既存コードの移行方法を学ぶ**: [依存性注入移行ガイド](./dependency-injection-migration-guide.md)を参照して、既存コードを依存性注入パターンに移行する方法を学ぶ
4. **イベント駆動アーキテクチャとの連携方法を学ぶ**: [依存性注入とイベント駆動アーキテクチャの統合ガイド](./dependency-injection-event-driven-integration.md)を参照して、依存性注入とイベント駆動アーキテクチャの連携方法を学ぶ
5. **サンプルプロジェクトを確認する**: [依存性注入サンプルプロジェクトガイド](./dependency-injection-sample-project.md)を参照して、完全な依存性注入実装を示すサンプルプロジェクトを確認する

## 関連ドキュメント

- [依存性注入クイックスタートガイド](./dependency-injection-quickstart.md) - 依存性注入の基本的な概念と使用方法
- [依存性注入アーキテクチャガイド](./dependency-injection-architecture-guide.md) - 依存性注入アーキテクチャの詳細な実装と使用方法
- [開発者向けチートシート](./dependency-injection-cheatsheet.md) - よく使用される依存性注入パターンとコードスニペット
- [依存性注入のテストガイド](./dependency-injection-testing-guide.md) - 依存性注入パターンを使用したコードのテスト方法
- [依存性注入移行ガイド](./dependency-injection-migration-guide.md) - 既存コードを依存性注入パターンに移行する方法
- [依存性注入とイベント駆動アーキテクチャの統合ガイド](./dependency-injection-event-driven-integration.md) - 依存性注入とイベント駆動アーキテクチャの連携方法