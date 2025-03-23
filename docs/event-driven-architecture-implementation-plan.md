# コンポーネント間の連携方法の統一：実装計画

## 1. 現状分析

### 1.1 イベント駆動アーキテクチャの実装状況
- 基盤となるコンポーネント（EnhancedEventEmitter、EventCatalog、EventMigrationHelper）は既に実装されている
- イベント名の標準化機能（emitStandardized）は実装されているが、一部のコンポーネントでしか使用されていない
- 一部のコンポーネントでは従来のemitメソッドを使用している

### 1.2 イベント名の標準化の状況
- イベントカタログには標準的なイベント名が定義されている
- 実際のコード内では非標準のイベント名が使用されている場合がある
- 特にStorageServiceでは、`storage:file:read:before`のような非標準形式が使用されている

### 1.3 イベントデータの標準化の状況
- emitStandardizedメソッドではtimestampフィールドが自動的に追加される
- 従来のemitメソッドではtimestampフィールドが追加されない

### 1.4 現在の問題点
1. イベント名の標準化が不完全
   - `storage:file:read:before` や `storage:file:read:after` などのイベント名が非標準として警告されている
   - StorageServiceの`_emitEvent`メソッドでは、イベント名に`storage:`プレフィックスを追加しているが、`emitStandardized`メソッドを使用していない

2. イベントデータの検証エラー
   - `必須フィールド timestamp がありません`というエラーが発生している
   - これはイベントデータに`timestamp`フィールドが含まれていないことを示している

3. ファイル読み込みエラー
   - `JSONファイルの読み込みに失敗しました: ai-context/feedback/pending-feedback.json`というエラーが発生している
   - これはファイルが存在しないか、JSONとして解析できない内容であることを示している

4. フィードバックオブジェクトの検証エラー
   - `フィードバックオブジェクトが不正です`というエラーが発生している
   - FeedbackManagerの`validateFeedback`メソッドで、フィードバックオブジェクトの構造が期待通りでないことを検出している

## 2. 解決策

### 2.1 イベント名の標準化（改訂版）

#### 2.1.1 命名規則の詳細化
- 基本形式: `component:entity_action`
  - component: システムのコンポーネント（storage, task, session, feedback など）
  - entity: 操作対象のエンティティ（file, directory, task, session など）
  - action: 実行されるアクション（created, updated, deleted, started, ended など）

- ライフサイクルイベント: `component:entity_lifecycle`
  - 例: `task:task_lifecycle`, `session:session_lifecycle`

- 複合アクション: アンダースコアで区切る
  - 例: `storage:file_read_before`, `storage:file_read_after`

- エラーイベント: `component:error`
  - 例: `storage:error`, `task:error`

#### 2.1.2 イベントメタデータの標準化
- 優先度: `priority` フィールド（high, medium, low）
- トレーサビリティ: `traceId` と `requestId` フィールド
- タイムスタンプ: `timestamp` フィールド（ISO 8601形式）
- バージョン: `version` フィールド

```javascript
// 標準化されたイベント発行の例
this.eventEmitter.emitStandardized('storage', 'file_read_completed', {
  path: filePath,
  type: 'json',
  success: true,
  priority: 'medium',
  size: content.length
});
```

### 2.2 イベントカタログの拡充（改訂版）

#### 2.2.1 カテゴリ分類の詳細化
- システムカテゴリ: system, data, user, error, lifecycle, monitoring
- 各カテゴリの目的と使用ガイドラインを定義

#### 2.2.2 イベント関連性の定義
```javascript
eventCatalog.registerEvent('task:task_created', {
  description: '新しいタスクが作成されたときに発行されます',
  category: 'data',
  version: 1,
  schema: {
    id: 'タスクID',
    title: 'タスクのタイトル',
    // ...
  },
  relatedEvents: [
    { name: 'workflow:task_added', relationship: 'triggers' },
    { name: 'integration:sync_needed', relationship: 'may_trigger' }
  ],
  examples: [
    `emitter.emitStandardized('task', 'task_created', { 
      id: 'T001', 
      title: '基本ディレクトリ構造の設計',
      status: 'pending'
    });`
  ]
});
```

#### 2.2.3 バージョニングとマイグレーションパス
```javascript
eventCatalog.registerEvent('storage:file_read', {
  description: 'ファイルが読み込まれたときに発行されます',
  category: 'data',
  version: 2,
  previousVersions: [
    {
      version: 1,
      schemaChanges: ['added size field', 'renamed type to fileType'],
      migrationPath: 'v1データにsizeフィールドを追加し、typeフィールドをfileTypeにリネーム'
    }
  ],
  schema: {
    path: 'ファイルパス',
    fileType: 'ファイルタイプ',
    size: 'ファイルサイズ',
    success: '成功したかどうか'
  },
  examples: [
    `emitter.emitStandardized('storage', 'file_read', { 
      path: 'ai-context/feedback/pending-feedback.json',
      fileType: 'json',
      size: 1024,
      success: true
    });`
  ]
});
```

### 2.3 移行戦略の強化（改訂版）

#### 2.3.1 EventMigrationHelperの拡張
```javascript
// src/lib/core/event-migration-helper.js に追加

/**
 * イベントバージョン間の変換を行う
 * @param {string} eventName - イベント名
 * @param {Object} data - 古いバージョンのイベントデータ
 * @param {number} fromVersion - 変換元のバージョン
 * @param {number} toVersion - 変換先のバージョン
 * @returns {Object} 新しいバージョンのイベントデータ
 */
migrateEventData(eventName, data, fromVersion, toVersion) {
  const eventDefinition = this.eventCatalog.getEventDefinition(eventName);
  
  if (!eventDefinition) {
    this.logger.warn(`イベント定義が見つかりません: ${eventName}`);
    return data;
  }
  
  if (fromVersion === toVersion) {
    return data;
  }
  
  // バージョン間の変換ロジック
  let migratedData = { ...data };
  
  // 各バージョンの変更を適用
  for (let v = fromVersion; v < toVersion; v++) {
    const versionInfo = eventDefinition.previousVersions.find(pv => pv.version === v);
    
    if (versionInfo && versionInfo.migrationFunction) {
      migratedData = versionInfo.migrationFunction(migratedData);
    }
  }
  
  return migratedData;
}
```

#### 2.3.2 フィーチャーフラグの導入
```javascript
// src/lib/core/feature-flags.js
class FeatureFlags {
  constructor(options = {}) {
    this.flags = options.flags || {};
    this.logger = options.logger || console;
  }
  
  isEnabled(flagName, defaultValue = false) {
    if (flagName in this.flags) {
      return this.flags[flagName];
    }
    return defaultValue;
  }
  
  enable(flagName) {
    this.flags[flagName] = true;
    this.logger.info(`フィーチャーフラグを有効化: ${flagName}`);
  }
  
  disable(flagName) {
    this.flags[flagName] = false;
    this.logger.info(`フィーチャーフラグを無効化: ${flagName}`);
  }
}

// 使用例
const featureFlags = new FeatureFlags({
  flags: {
    'use-standardized-events': true,
    'use-event-catalog': true,
    'validate-event-schema': true
  }
});

// イベント発行時にフラグをチェック
if (featureFlags.isEnabled('use-standardized-events')) {
  this.eventEmitter.emitStandardized('storage', 'file_read', data);
} else {
  this.eventEmitter.emit('storage:file:read', data);
}
```

### 2.4 エラーイベントの標準化

#### 2.4.1 エラーイベントの構造
```javascript
// エラーイベントの標準構造
{
  component: 'storage', // エラーが発生したコンポーネント
  operation: 'readJSON', // 実行中の操作
  errorCode: 'ERR_FILE_NOT_FOUND', // エラーコード
  errorMessage: 'ファイルが見つかりません', // エラーメッセージ
  severity: 'error', // エラーの重大度（error, warning, info）
  timestamp: '2025-03-23T05:12:31.535Z', // 発生時刻
  traceId: 'trace-1742706751540-mrg1hyvmf', // トレースID
  requestId: 'req-1742706751540-98ymsi92c', // リクエストID
  context: { // エラーのコンテキスト情報
    path: 'ai-context/feedback/pending-feedback.json',
    attempt: 1
  },
  recoverable: true, // 回復可能かどうか
  stack: '...' // スタックトレース（開発環境のみ）
}
```

#### 2.4.2 エラーイベント発行の標準化
```javascript
// src/lib/core/error-handler.js に追加

/**
 * 標準化されたエラーイベントを発行
 * @param {Error} error - エラーオブジェクト
 * @param {string} component - コンポーネント名
 * @param {string} operation - 操作名
 * @param {Object} context - コンテキスト情報
 */
emitErrorEvent(error, component, operation, context = {}) {
  if (!this.eventEmitter) {
    return;
  }
  
  const errorData = {
    component,
    operation,
    errorCode: error.code || 'ERR_UNKNOWN',
    errorMessage: error.message,
    severity: error.severity || 'error',
    timestamp: new Date().toISOString(),
    traceId: context.traceId || this.generateTraceId(),
    requestId: context.requestId || this.generateRequestId(),
    context,
    recoverable: error.recoverable !== undefined ? error.recoverable : true
  };
  
  // 開発環境ではスタックトレースも含める
  if (process.env.NODE_ENV === 'development') {
    errorData.stack = error.stack;
  }
  
  this.eventEmitter.emitStandardized(component, 'error', errorData);
}
```

### 2.5 イベントスキーマ検証

#### 2.5.1 スキーマ検証機能の追加
```javascript
// src/lib/core/event-system.js に追加

/**
 * イベントデータをスキーマに対して検証
 * @param {string} eventName - イベント名
 * @param {Object} data - イベントデータ
 * @returns {boolean} 検証結果
 */
validateEventData(eventName, data) {
  const eventDefinition = this.eventCatalog.getEventDefinition(eventName);
  
  if (!eventDefinition || !eventDefinition.schema) {
    return true; // スキーマがない場合は検証をスキップ
  }
  
  const schema = eventDefinition.schema;
  const errors = [];
  
  // 必須フィールドの検証
  for (const [field, description] of Object.entries(schema)) {
    if (description.startsWith('*') && (data[field] === undefined || data[field] === null)) {
      errors.push(`必須フィールド ${field} がありません`);
    }
  }
  
  // 型の検証（簡易版）
  for (const [field, description] of Object.entries(schema)) {
    if (data[field] !== undefined) {
      if (description.includes('(number)') && typeof data[field] !== 'number') {
        errors.push(`フィールド ${field} は数値である必要があります`);
      } else if (description.includes('(boolean)') && typeof data[field] !== 'boolean') {
        errors.push(`フィールド ${field} は真偽値である必要があります`);
      } else if (description.includes('(array)') && !Array.isArray(data[field])) {
        errors.push(`フィールド ${field} は配列である必要があります`);
      }
    }
  }
  
  if (errors.length > 0) {
    this.logger.warn(`イベントデータの検証エラー (${eventName}):`, errors);
    return false;
  }
  
  return true;
}

/**
 * スキーマ検証付きのイベント発行
 * @param {string} component - コンポーネント名
 * @param {string} action - アクション名
 * @param {Object} data - イベントデータ
 */
emitValidated(component, action, data = {}) {
  const eventName = `${component}:${action}`;
  
  if (!this.validateEventData(eventName, data)) {
    this.logger.error(`イベントデータがスキーマに準拠していません: ${eventName}`);
    return false;
  }
  
  return this.emitStandardized(component, action, data);
}
```

### 2.6 モニタリングと可視化

#### 2.6.1 イベントモニタリングの実装
```javascript
// src/lib/core/event-monitor.js
class EventMonitor {
  constructor(eventEmitter, options = {}) {
    this.eventEmitter = eventEmitter;
    this.logger = options.logger || console;
    this.metrics = {
      eventCounts: new Map(),
      errorCounts: new Map(),
      latency: new Map()
    };
    
    // すべてのイベントをモニタリング
    this.eventEmitter.on('*', this._handleEvent.bind(this));
  }
  
  _handleEvent(data, eventName) {
    // イベント数のカウント
    this.metrics.eventCounts.set(
      eventName,
      (this.metrics.eventCounts.get(eventName) || 0) + 1
    );
    
    // エラーイベントの場合はエラー数もカウント
    if (eventName.endsWith(':error')) {
      const errorCode = data.errorCode || 'unknown';
      const errorKey = `${eventName}:${errorCode}`;
      
      this.metrics.errorCounts.set(
        errorKey,
        (this.metrics.errorCounts.get(errorKey) || 0) + 1
      );
    }
  }
  
  getMetrics() {
    return {
      eventCounts: Object.fromEntries(this.metrics.eventCounts),
      errorCounts: Object.fromEntries(this.metrics.errorCounts),
      latency: Object.fromEntries(this.metrics.latency)
    };
  }
  
  resetMetrics() {
    this.metrics.eventCounts.clear();
    this.metrics.errorCounts.clear();
    this.metrics.latency.clear();
  }
}
```

#### 2.6.2 イベントビジュアライザーの実装（開発環境用）
```javascript
// src/dev-tools/event-visualizer.js
class EventVisualizer {
  constructor(eventEmitter, options = {}) {
    this.eventEmitter = eventEmitter;
    this.events = [];
    this.maxEvents = options.maxEvents || 100;
    
    // すべてのイベントを記録
    this.eventEmitter.on('*', this._recordEvent.bind(this));
  }
  
  _recordEvent(data, eventName) {
    this.events.push({
      timestamp: new Date().toISOString(),
      eventName,
      data
    });
    
    // 最大イベント数を超えたら古いものから削除
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }
  }
  
  getEvents() {
    return this.events;
  }
  
  clear() {
    this.events = [];
  }
  
  // イベントフローを可視化（開発環境用）
  visualizeFlow() {
    // mermaidフォーマットでイベントフローを生成
    let mermaid = 'sequenceDiagram\n';
    
    const components = new Set();
    
    // コンポーネントの抽出
    this.events.forEach(event => {
      const [component] = event.eventName.split(':');
      components.add(component);
    });
    
    // コンポーネントの定義
    components.forEach(component => {
      mermaid += `    participant ${component}\n`;
    });
    
    // イベントフローの生成
    this.events.forEach(event => {
      const [source, action] = event.eventName.split(':');
      
      // イベントデータから宛先コンポーネントを推測
      let target = 'System';
      if (event.data && event.data.component) {
        target = event.data.component;
      }
      
      if (source !== target) {
        mermaid += `    ${source}->>+${target}: ${action}\n`;
      }
    });
    
    return mermaid;
  }
}
```

## 3. 実装計画

### 3.1 フェーズ1: イベントタクソノミーの確立（2日間）
1. 既存イベントの洗い出しと分類
2. 標準命名規則の策定と文書化
3. イベントカテゴリの定義
4. イベント間の関連性の定義

### 3.2 フェーズ2: イベントカタログの拡充（3日間）
1. 既存イベントのカタログ登録
2. スキーマ定義の追加
3. バージョニング情報の追加
4. 関連イベント情報の追加

### 3.3 フェーズ3: 基盤コンポーネントの強化（3日間）
1. EnhancedEventEmitterの拡張
   - スキーマ検証機能の追加
   - バージョン変換機能の追加
2. EventMigrationHelperの拡張
   - イベントバージョン間の変換機能の追加
3. FeatureFlagsの実装
   - フィーチャーフラグ管理機能の追加

### 3.4 フェーズ4: コンポーネントの移行（5日間）
1. StorageServiceの移行
   - `_emitEvent`メソッドの修正
   - イベント名の標準化
2. FeedbackManagerの移行
   - イベント発行の標準化
   - エラーイベントの標準化
3. IntegrationManagerの移行
   - イベント発行の標準化
   - エラーイベントの標準化
4. その他のマネージャーの移行
   - TaskManager、SessionManagerなどの移行

### 3.5 フェーズ5: テストとドキュメント（3日間）
1. 単体テストの実装
   - イベント発行のテスト
   - スキーマ検証のテスト
2. 統合テストの実装
   - コンポーネント間の連携テスト
3. ドキュメントの作成
   - イベント駆動アーキテクチャのガイドライン
   - イベントカタログの使用方法
   - 移行ガイド

## 4. 実装例

### 4.1 StorageServiceのイベント発行メソッドの修正（詳細版）

```javascript
// src/lib/utils/storage.js

/**
 * イベントを発行
 * @param {string} eventName - イベント名
 * @param {Object} data - イベントデータ
 * @private
 */
_emitEvent(eventName, data) {
  if (!this.eventEmitter) {
    return;
  }
  
  try {
    // イベント名のパース
    let component = 'storage';
    let action;
    
    if (eventName.includes(':')) {
      // 'file:read:before' → 'file_read_before'
      const parts = eventName.split(':');
      action = parts.join('_');
    } else {
      action = eventName;
    }
    
    // トレースIDとリクエストIDの生成
    const traceId = data.traceId || `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const requestId = data.requestId || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // 標準化されたイベントデータ
    const standardizedData = {
      ...data,
      traceId,
      requestId,
      component: 'storage'
    };
    
    // フィーチャーフラグのチェック
    if (this.featureFlags && this.featureFlags.isEnabled('use-event-catalog')) {
      // イベントカタログを使用
      this.eventEmitter.emitCataloged(`${component}:${action}`, standardizedData);
    } else if (this.featureFlags && this.featureFlags.isEnabled('validate-event-schema')) {
      // スキーマ検証付きイベント発行
      this.eventEmitter.emitValidated(component, action, standardizedData);
    } else {
      // 標準化されたイベント発行
      this.eventEmitter.emitStandardized(component, action, standardizedData);
    }
  } catch (error) {
    this.logger.warn(`イベント発行中にエラーが発生しました: ${eventName}`, error);
  }
}
```

### 4.2 FeedbackManagerの移行（詳細版）

```javascript
// src/lib/managers/feedback-manager.js

/**
 * 保留中のフィードバックを取得
 * @returns {Promise<Object|null>} 保留中のフィードバック
 */
async getPendingFeedback() {
  // トレースIDとリクエストIDの生成
  const traceId = `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    // イベント発行: 取得開始
    if (this.eventEmitter) {
      this.eventEmitter.emitStandardized('feedback', 'pending_fetch_started', {
        feedbackDir: this.feedbackDir,
        traceId,
        requestId
      });
    }
    
    const pendingFeedbackPath = `${this.feedbackDir}/pending-feedback.json`;
    
    // ファイルの存在確認
    if (!this.storageService.fileExists(pendingFeedbackPath)) {
      // イベント発行: ファイルなし
      if (this.eventEmitter) {
        this.eventEmitter.emitStandardized('feedback', 'pending_fetch_completed', {
          success: false,
          reason: 'file_not_found',
          traceId,
          requestId
        });
      }
      return null;
    }
    
    // JSONファイルの読み込み
    const feedback = await this.storageService.readJSON(pendingFeedbackPath);
    
    // フィードバックの検証
    if (!feedback || !this.validateFeedback(feedback)) {
      // イベント発行: 検証失敗
      if (this.eventEmitter) {
        this.eventEmitter.emitStandardized('feedback', 'pending_fetch_completed', {
          success: false,
          reason: 'validation_failed',
          traceId,
          requestId
        });
      }
      return null;
    }
    
    // イベント発行: 取得成功
    if (this.eventEmitter) {
      this.eventEmitter.emitStandardized('feedback', 'pending_fetch_completed', {
        success: true,
        feedbackCount: feedback.feedback_loop.feedback_items.length,
        traceId,
        requestId
      });
    }
    
    return feedback;
  } catch (error) {
    // エラーイベント発行
    if (this.eventEmitter) {
      this.eventEmitter.emitStandardized('feedback', 'error', {
        operation: 'getPendingFeedback',
        errorMessage: error.message,
        errorCode: error.code || 'ERR_UNKNOWN',
        traceId,
        requestId
      });
    }
    
    // エラーハンドリング
    if (this.errorHandler) {
      this.errorHandler.handle(error, 'FeedbackManager', 'getPendingFeedback', {
        traceId,
        requestId
      });
    } else {
      this.logger.error('保留中のフィードバックの取得に失敗しました:', error);
    }
    
    return null;
  }
}
```

## 5. ドキュメントとガイドライン

### 5.1 イベント駆動アーキテクチャガイド
- イベント駆動アーキテクチャの概要
- イベント名の命名規則
- イベントデータの構造
- イベントカタログの使用方法
- イベントリスナーの実装パターン
- エラーハンドリングのベストプラクティス

### 5.2 移行ガイド
- 直接メソッド呼び出しからイベントベースへの移行手順
- EventMigrationHelperの使用方法
- 移行の検証方法
- 問題発生時のロールバック手順

### 5.3 開発者向けチートシート
- よく使用されるイベント一覧
- イベント発行のコードスニペット
- イベントリスナーのコードスニペット
- デバッグのヒント

## 6. リスク管理

### 6.1 移行中のリスク
- 既存機能の回帰
- 移行中の部分的機能停止
- 移行の遅延
- テスト不足による品質低下
- 開発者の知識不足

### 6.2 リスク緩和策
1. **段階的移行アプローチ**:
   - コンポーネントごとに段階的に移行
   - 各ステップで機能検証を実施
   - 問題発生時に部分的なロールバックが可能な設計

2. **フィーチャーフラグの使用**:
   - 新旧両方の実装を並行して維持
   - 問題発生時に旧実装に切り替え可能

3. **並行動作期間の設定**:
   - 一定期間、新旧両方の実装を維持
   - 結果の比較と検証
   - 問題がなければ古い実装を削除

4. **包括的なテスト戦略**:
   - 移行前の包括的なテストスイートの整備
   - 移行中の並行テスト
   - 移行後の回帰テスト

5. **知識共有の強化**:
   - ドキュメント整備
   - ペアプログラミングの推進
   - 定期的な知識共有セッションの開催

## 7. 成功基準

### 7.1 機能的基準
- すべての既存機能が正常に動作すること
- イベント駆動アーキテクチャが完全に採用されていること
- イベント名が標準化されていること
- イベントカタログが完全に実装されていること

### 7.2 非機能的基準
- テストカバレッジ: 全体で80%以上、コアコンポーネントで90%以上
- パフォーマンス: リファクタリング前と比較して同等以上
- コードの重複率: 50%以上削減
- ドキュメント: すべてのコンポーネントとパターンが文書化されていること

### 7.3 プロセス基準
- CI/CDパイプラインが正常に動作していること
- すべてのプルリクエストがテストを通過していること
- コードレビューのプロセスが確立されていること

## 8. まとめ

「コンポーネント間の連携方法の統一」の実装計画では、以下の点に焦点を当てます：

1. イベント駆動アーキテクチャの完全採用
   - すべてのコンポーネントでイベント駆動アーキテクチャを採用
   - 直接メソッド呼び出しからイベントベースの連携に移行

2. イベント名の標準化の徹底
   - すべてのコンポーネントでemitStandardizedメソッドを使用
   - イベント名の命名規則を統一

3. イベントカタログの完全実装と使用
   - すべてのイベントをEventCatalogに登録
   - イベント発行時にはカタログを参照

4. エラーイベントの標準化
   - エラーイベントの構造を統一
   - エラーハンドリングの一元化

5. イベントスキーマ検証
   - イベントデータの検証機能の追加
   - スキーマ違反の早期検出

6. モニタリングと可視化
   - イベントモニタリングの実装
   - イベントフローの可視化

この計画を実行することで、コンポーネント間の連携方法が統一され、より堅牢で保守性の高いシステムを構築することができます。また、イベント駆動アーキテクチャの採用により、コンポーネント間の疎結合が実現され、将来の拡張性も向上します。