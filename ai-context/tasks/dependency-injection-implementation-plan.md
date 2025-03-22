# 依存性注入の導入計画

## 1. 現状分析

### 1.1 実装済みの内容

以下の内容は既に実装されています：

1. `ServiceContainer`クラス（`src/lib/core/service-container.js`）
   - サービスの登録と取得
   - ファクトリー関数のサポート
   - 循環参照の検出

2. `service-definitions.js`（`src/lib/core/service-definitions.js`）
   - 各種サービスの定義と登録
   - 依存関係の解決

3. `config.js`（`src/config.js`）
   - アプリケーション設定の管理

4. `integration.js`（`src/cli/integration.js`）
   - 依存性注入を使用したCLIの実装

### 1.2 現状の課題

1. **ファイルシステム操作の重複**
   - 各マネージャークラスで直接ファイルシステム操作が行われている
   - パス構築とディレクトリ作成のロジックが重複している

2. **Git操作の断片化**
   - Git関連機能が複数のコンポーネントに分散している
   - コミット情報取得やタスクID抽出のロジックが重複している

3. **エラー処理の分散**
   - エラー処理が各コンポーネントで独自に実装されている
   - 一貫したエラーハンドリングが行われていない

4. **イベント管理の非一貫性**
   - イベント名の命名規則が統一されていない
   - エラーハンドリングが構造化されていない

## 2. 実装戦略

### 2.1 StorageServiceの実装

#### インターフェース定義
```javascript
/**
 * @interface IStorageService
 * ファイルシステム操作を抽象化するサービス
 */
```

#### 実装クラス
```javascript
class StorageService {
  constructor(options = {}) {
    this.basePath = options.basePath || process.cwd();
    this.fs = require('fs');
    this.path = require('path');
    this.logger = options.logger || console;
    this.eventEmitter = options.eventEmitter;
    this.errorHandler = options.errorHandler;
  }

  // ファイルパスの取得
  getFilePath(directory, filename) { ... }

  // ディレクトリの存在確認と作成
  ensureDirectoryExists(dirPath) { ... }

  // JSONファイルの読み込み
  readJSON(directory, filename) { ... }

  // JSONファイルの書き込み
  writeJSON(directory, filename, data) { ... }

  // テキストファイルの読み込み
  readText(directory, filename) { ... }

  // テキストファイルの書き込み
  writeText(directory, filename, content) { ... }

  // ファイルの存在確認
  fileExists(directory, filename) { ... }

  // ディレクトリ内のファイル一覧取得
  listFiles(directory, pattern) { ... }
}
```

#### エラー処理
```javascript
class StorageError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'StorageError';
    this.cause = cause;
  }
}
```

#### イベント発行
- ファイル操作前後にイベントを発行
- エラー発生時にイベントを発行

### 2.2 GitServiceの実装

#### インターフェース定義
```javascript
/**
 * @interface IGitService
 * Git操作を抽象化するサービス
 */
```

#### 実装クラス
```javascript
class GitService {
  constructor(options = {}) {
    this.execSync = require('child_process').execSync;
    this.logger = options.logger || console;
    this.repoPath = options.repoPath || process.cwd();
    this.eventEmitter = options.eventEmitter;
    this.errorHandler = options.errorHandler;
  }

  // 現在のコミットハッシュを取得
  getCurrentCommitHash() { ... }

  // コミットメッセージからタスクIDを抽出
  extractTaskIdsFromCommitMessage(message) { ... }

  // コミット間のコミット情報を取得
  getCommitsBetween(startCommit, endCommit) { ... }

  // コミットで変更されたファイルを取得
  getChangedFilesInCommit(commitHash) { ... }

  // コミットの差分統計を取得
  getCommitDiffStats(commitHash) { ... }

  // ブランチ一覧を取得
  getBranches() { ... }

  // 現在のブランチを取得
  getCurrentBranch() { ... }
}
```

#### エラー処理
```javascript
class GitError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'GitError';
    this.cause = cause;
  }
}
```

#### イベント発行
- Git操作前後にイベントを発行
- エラー発生時にイベントを発行

### 2.3 ErrorHandlerの修正

#### インターフェース定義
```javascript
/**
 * @interface IErrorHandler
 * エラー処理を一元管理するサービス
 */
```

#### クラス修正
- コンストラクタで依存関係を受け取るように修正
- エラー処理の一元化
- エラーイベントの発行
- エラー回復戦略の実装
- エラー統計の収集

#### エラー階層の整理
```javascript
class ApplicationError extends Error { ... }
class ValidationError extends ApplicationError { ... }
class StateError extends ApplicationError { ... }
class DataConsistencyError extends ApplicationError { ... }
class StorageError extends ApplicationError { ... }
class GitError extends ApplicationError { ... }
```

### 2.4 EventEmitterの修正

#### インターフェース定義
```javascript
/**
 * @interface IEventEmitter
 * イベント管理を抽象化するサービス
 */
```

#### クラス修正
- コンストラクタで依存関係を受け取るように修正
- イベント名の標準化
- ワイルドカードリスナーのサポート
- 非同期イベント処理のサポート
- イベントバスの実装

#### イベントカタログの実装
```javascript
class EventCatalog {
  constructor() {
    this.events = new Map();
    this.categories = new Map();
  }

  // イベント定義を登録
  registerEvent(name, description, category) { ... }

  // カテゴリを登録
  registerCategory(name, description) { ... }

  // イベント定義を取得
  getEvent(name) { ... }

  // カテゴリ内のすべてのイベントを取得
  getEventsByCategory(category) { ... }
}
```

## 3. 実装計画

### 3.1 フェーズ1: 基本実装（1-2日）
1. StorageServiceの基本実装
2. GitServiceの基本実装
3. ErrorHandlerの修正
4. EventEmitterの修正

### 3.2 フェーズ2: テスト実装（1日）
1. StorageServiceのテスト
2. GitServiceのテスト
3. 修正したErrorHandlerのテスト
4. 修正したEventEmitterのテスト

### 3.3 フェーズ3: 既存コードの移行（2-3日）
1. SessionManagerの移行
2. FeedbackManagerの移行
3. TaskManagerの移行
4. IntegrationManagerの移行

### 3.4 フェーズ4: 検証とドキュメント（1日）
1. 統合テストの実行
2. パフォーマンス検証
3. ドキュメント作成

## 4. 実装の優先順位

1. **StorageService**: 多くのコンポーネントがファイルシステム操作に依存しているため、最優先で実装
2. **GitService**: コミット情報の取得など、重要な機能を提供するため、次に実装
3. **ErrorHandler**: エラー処理の一元化は重要だが、既存の実装がある程度機能しているため、3番目に実装
4. **EventEmitter**: イベント管理も重要だが、既存の実装がある程度機能しているため、最後に実装

## 5. リスクと対策

1. **既存コードとの互換性**: 既存のコードが新しいサービスに依存するようになるため、互換性の問題が発生する可能性がある
   - **対策**: 段階的な移行と十分なテストを実施

2. **パフォーマンスへの影響**: 依存性注入によるオーバーヘッドが発生する可能性がある
   - **対策**: パフォーマンス測定と必要に応じた最適化

3. **複雑性の増加**: 依存性注入により、コードの複雑性が増加する可能性がある
   - **対策**: 明確なドキュメントと適切な抽象化レベルの維持

## 6. 依存性注入の利点

1. **疎結合**: コンポーネント間の依存関係を減らし、変更の影響範囲を限定できる
2. **テスト容易性**: モックやスタブを使用して依存関係を置き換えることができる
3. **柔軟性**: 実装の詳細を隠蔽し、インターフェースに依存することで、実装の変更が容易になる
4. **再利用性**: コンポーネントを再利用しやすくなる
5. **ライフサイクル管理**: コンポーネントのライフサイクルを一元管理できる

## 7. まとめ

依存性注入の導入により、コードの保守性と拡張性を向上させることができます。既存のコードを段階的に移行し、新しいサービスを導入することで、より堅牢なシステムを構築することができます。

```mermaid
graph TD
    A[依存性注入の導入] --> B[基盤の実装]
    A --> C[コアサービスの修正]
    A --> D[既存コードの移行]
    A --> E[検証とドキュメント]
    
    B --> B1[ServiceContainer実装]
    B --> B2[サービス定義実装]
    B --> B3[基本的なテスト作成]
    
    C --> C1[StorageService実装]
    C --> C2[GitService実装]
    C --> C3[ErrorHandler修正]
    C --> C4[EventEmitter修正]
    
    D --> D1[SessionManager移行]
    D --> D2[FeedbackManager移行]
    D --> D3[TaskManager移行]
    D --> D4[IntegrationManager移行]
    
    E --> E1[統合テスト実行]
    E --> E2[パフォーマンス検証]
    E --> E3[ドキュメント作成]