# イベント駆動アーキテクチャのテスト改善計画

## 現状分析

### 1. テスト失敗の原因

#### 1.1 エラーケースのテスト失敗
- `TaskManagerAdapter`、`SessionManagerAdapter`、`FeedbackManagerAdapter`のエラーハンドリングテストが失敗
- 原因：`_handleError`メソッドの実装が期待と異なる動作をしている
  - テストでは`{ error: true, message: 'エラーメッセージ' }`のようなオブジェクトを返すことを期待
  - 実際の実装では例外をスローしている

#### 1.2 後方互換性のテスト失敗
- 古いイベント名と新しいイベント名の両方が発行されることを確認するテストが失敗
- 原因：`emitStandardizedEvent`関数の実装に問題がある
  - 古いイベント名のマッピングが不完全
  - イベントブリッジが正しく機能していない

#### 1.3 バリデーションのテスト失敗
- `_validateParams`メソッドをモックしてエラーをスローするテストが失敗
- 原因：モックの実装方法に問題がある
  - モックが正しく適用されていない
  - エラーハンドリングの期待値が調整されていない

### 2. 実装上の問題点

#### 2.1 BaseAdapterの`_handleError`メソッド
- 現在の実装ではエラーをスローしているが、テストでは特定の形式のオブジェクトを返すことを期待
- エラーハンドラーが存在する場合の処理が不明確

#### 2.2 イベントヘルパーの`emitStandardizedEvent`関数
- 古いイベント名のマッピングが不完全
- 特に各アダプターで使用されるイベント名が網羅されていない

#### 2.3 アダプターの`_validateParams`メソッド
- テストでモックする方法が適切でない
- エラーハンドリングの期待値が実装と一致していない

## 改善された実装計画

### フェーズ1: エラーハンドリングの修正

#### 1.1 BaseAdapterの`_handleError`メソッドの修正
```javascript
/**
 * エラー処理メソッド
 * @param {Error} error - エラーオブジェクト
 * @param {string} operation - 操作名
 * @param {Object} context - コンテキスト情報
 * @returns {Object} 処理されたエラー情報
 * @protected
 */
_handleError(error, operation, context = {}) {
  // エラーハンドラーが存在する場合はそちらに委譲
  if (this.errorHandler && typeof this.errorHandler.handle === 'function') {
    return this.errorHandler.handle(error, this.constructor.name, operation, context);
  }
  
  // エラーログを出力
  this.logger.error(`Error in ${this.constructor.name}.${operation}:`, error);
  
  // 構造化されたエラー情報を返す
  return {
    error: true,
    message: error.message,
    code: error.code || 'UNKNOWN_ERROR',
    operation,
    name: error.name || 'Error',
    timestamp: new Date().toISOString(),
    context: JSON.stringify(context)
  };
}
```

#### 1.2 エラーハンドラーの戻り値の確認
- エラーハンドラーの`handle`メソッドの戻り値の形式を確認
- 必要に応じてエラーハンドラーの実装も修正

#### 1.3 各アダプターのエラーハンドリングテストの修正
- 期待値を新しいエラー情報の形式に合わせて修正
- エラーコードやタイムスタンプなどの追加情報も検証

### フェーズ2: イベント名管理の改善とイベントヘルパーの修正

#### 2.1 イベント名の定数化
```javascript
// src/lib/core/event-constants.js
/**
 * イベント名の定数定義
 * 新旧のイベント名のマッピングを提供
 */
const EVENT_NAMES = {
  TASK: {
    CREATED: { new: 'task:task_created', old: 'task:created' },
    UPDATED: { new: 'task:task_updated', old: 'task:updated' },
    PROGRESS_UPDATED: { new: 'task:task_progress_updated', old: 'task:progress' },
    GIT_COMMIT_ADDED: { new: 'task:git_commit_added', old: 'task:commit' },
    TASKS_INITIALIZED: { new: 'task:tasks_initialized', old: 'task:initialized' }
  },
  SESSION: {
    CREATED: { new: 'session:session_created', old: 'session:started' },
    UPDATED: { new: 'session:session_updated', old: 'session:updated' },
    ENDED: { new: 'session:session_ended', old: 'session:ended' },
    TASK_ADDED: { new: 'session:task_added', old: 'session:task:added' },
    TASK_REMOVED: { new: 'session:task_removed', old: 'session:task:removed' },
    GIT_COMMIT_ADDED: { new: 'session:git_commit_added', old: 'session:commit:added' }
  },
  FEEDBACK: {
    CREATED: { new: 'feedback:feedback_created', old: 'feedback:created' },
    TEST_RESULTS_COLLECTED: { new: 'feedback:test_results_collected', old: 'feedback:test:collected' },
    PRIORITIZED: { new: 'feedback:feedback_prioritized', old: 'feedback:prioritized' },
    STATUS_UPDATED: { new: 'feedback:status_updated', old: 'feedback:status:updated' },
    INTEGRATED_WITH_SESSION: { new: 'feedback:integrated_with_session', old: 'feedback:integrated:session' },
    INTEGRATED_WITH_TASK: { new: 'feedback:integrated_with_task', old: 'feedback:integrated:task' }
  },
  SYSTEM: {
    INITIALIZED: { new: 'system:initialized', old: 'system:init' },
    SHUTDOWN: { new: 'system:shutdown', old: 'system:exit' }
  },
  STORAGE: {
    FILE_READ: { new: 'storage:file_read', old: 'storage:file:read' },
    FILE_WRITE: { new: 'storage:file_write', old: 'storage:file:write' },
    FILE_DELETE: { new: 'storage:file_delete', old: 'storage:file:delete' }
  },
  INTEGRATION: {
    MANAGER_INITIALIZED: { new: 'integration:manager_initialized', old: 'integration:manager:initialized' }
  }
};

// イベント名のマッピングを生成
function generateEventMap() {
  const eventMap = {};
  
  Object.values(EVENT_NAMES).forEach(category => {
    Object.values(category).forEach(eventPair => {
      eventMap[eventPair.new] = eventPair.old;
    });
  });
  
  return eventMap;
}

const EVENT_MAP = generateEventMap();

module.exports = {
  EVENT_NAMES,
  EVENT_MAP
};
```

#### 2.2 イベントヘルパーの`emitStandardizedEvent`関数の修正
```javascript
const { EVENT_MAP } = require('./event-constants');

/**
 * 標準化されたイベントを発行
 * @param {Object} eventEmitter - イベントエミッターインスタンス
 * @param {string} component - コンポーネント名
 * @param {string} action - アクション名
 * @param {Object} data - イベントデータ
 * @param {boolean} [bridgeOldEvents=true] - 古いイベント名もサポートするかどうか
 * @returns {boolean} 発行結果
 */
function emitStandardizedEvent(eventEmitter, component, action, data = {}, bridgeOldEvents = true) {
  if (!eventEmitter) {
    return false;
  }
  
  try {
    // 標準化されたイベントデータを生成
    const standardizedData = createStandardizedEventData(data, component);
    
    // 標準化されたイベント名
    const standardEvent = `${component}:${action}`;
    
    // デバッグ情報
    const debugInfo = {
      component,
      action,
      standardEvent,
      timestamp: standardizedData.timestamp
    };
    
    // 標準化されたイベント発行
    if (typeof eventEmitter.emitStandardized === 'function') {
      eventEmitter.emitStandardized(component, action, standardizedData);
      
      if (eventEmitter.debugMode) {
        eventEmitter.logger.debug(`標準化されたイベントを発行: ${standardEvent}`, debugInfo);
      }
    } else {
      // 後方互換性のため
      eventEmitter.emit(standardEvent, standardizedData);
      
      if (eventEmitter.debugMode) {
        eventEmitter.logger.debug(`イベントを発行: ${standardEvent}`, debugInfo);
      }
    }
    
    // 古いイベント名のサポート（オプション）
    if (bridgeOldEvents) {
      const oldEventName = EVENT_MAP[standardEvent];
      
      if (oldEventName) {
        eventEmitter.emit(oldEventName, standardizedData);
        
        // デバッグ情報を拡張
        debugInfo.oldEventName = oldEventName;
        debugInfo.bridged = true;
        
        if (eventEmitter.debugMode) {
          eventEmitter.logger.debug(`古いイベント名でも発行: ${oldEventName}`, debugInfo);
        }
        
        // 警告ログを出力（開発環境のみ）
        if (process.env.NODE_ENV === 'development' && eventEmitter.logger) {
          eventEmitter.logger.warn(`非推奨のイベント名 ${oldEventName} が使用されています。代わりに ${standardEvent} を使用してください。`, debugInfo);
        }
      } else if (eventEmitter.debugMode) {
        eventEmitter.logger.debug(`古いイベント名のマッピングが見つかりません: ${standardEvent}`, debugInfo);
      }
    }
    
    return true;
  } catch (error) {
    if (eventEmitter.logger) {
      eventEmitter.logger.error(`イベント発行中にエラーが発生しました: ${component}:${action}`, error);
    } else {
      console.error(`イベント発行中にエラーが発生しました: ${component}:${action}`, error);
    }
    return false;
  }
}
```

#### 2.3 イベント名の使用箇所の修正
- 各アダプターでハードコードされたイベント名を定数に置き換える
- 例：`this._emitEvent('task', 'task_created', data)` → `this._emitEvent('task', EVENT_NAMES.TASK.CREATED.new.split(':')[1], data)`

### フェーズ3: バリデーションテストの修正

#### 3.1 モックの実装方法の改善
```javascript
// テストの修正例
test('必須パラメータがない場合はエラーを返す', async () => {
  // _validateParamsをスパイ
  const validateParamsSpy = jest.spyOn(adapter, '_validateParams');
  validateParamsSpy.mockImplementationOnce(() => {
    throw new ValidationError('必須パラメータがありません');
  });
  
  const result = await adapter.createTask(undefined);
  
  // 修正された期待値
  expect(result).toMatchObject({ 
    error: true, 
    message: '必須パラメータがありません',
    operation: 'createTask'
  });
  
  // タイムスタンプなどの動的な値は部分一致で検証
  expect(result.timestamp).toBeDefined();
  expect(mockLogger.error).toHaveBeenCalled();
  
  // スパイが呼び出されたことを確認
  expect(validateParamsSpy).toHaveBeenCalled();
});
```

#### 3.2 各アダプターのバリデーションテストの修正
- TaskManagerAdapter、SessionManagerAdapter、FeedbackManagerAdapterのバリデーションテストを修正
- 期待値を新しいエラー情報の形式に合わせて調整

### フェーズ4: 統合テストの確認と修正

#### 4.1 アダプター統合テストの確認
- 修正後に統合テストを実行
- イベント連鎖のテストが正しく動作することを確認

#### 4.2 後方互換性テストの確認
- 古いイベント名と新しいイベント名の両方が発行されることを確認
- 警告ログが適切に出力されることを確認

### フェーズ5: ドキュメント更新とテストカバレッジの向上

#### 5.1 イベント駆動アーキテクチャのドキュメント更新
- イベント名の標準化に関するガイドラインを更新
- 古いイベント名と新しいイベント名のマッピング表を作成
- エラーハンドリングのパターンを文書化

#### 5.2 テストカバレッジの向上
- エッジケースのテストを追加
- 特に後方互換性とエラーハンドリングのテストを強化

#### 5.3 開発者向けチートシートの作成
- よく使用されるイベント名の一覧
- イベント発行のコードスニペット
- エラーハンドリングのベストプラクティス

## 実装の進め方

1. **段階的なアプローチ**:
   - 各フェーズを順番に実装し、テストで確認
   - 各ステップで回帰テストを実行して、他の機能に影響がないことを確認

2. **テスト駆動開発**:
   - 各修正の前に失敗するテストを確認
   - 修正後にテストがパスすることを確認

3. **コードレビュー**:
   - 各フェーズの実装後にコードレビューを実施
   - 特にイベント名の標準化とエラーハンドリングの一貫性を確認