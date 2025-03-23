# IntegrationManagerエラー調査計画

## 1. 問題の概要

IntegrationManagerの定期同期処理（`_syncComponents`メソッド）で以下のエラーが発生しています：

```
{"timestamp":"2025-03-23T03:54:46.891Z","level":"error","message":"コンポーネント同期中にエラーが発生しました:","context":{}}
```

エラーログには「コンポーネント同期中にエラーが発生しました:」というメッセージしか表示されておらず、エラーオブジェクトの詳細情報が適切に出力されていないため、エラーの原因を特定することが困難です。

## 2. 調査計画

### 2.1 ログ強化

エラーの詳細を把握するために、以下のようにログを強化します：

#### 2.1.1 _syncComponentsメソッドの修正

```javascript
async _syncComponents() {
  this.logger.debug('コンポーネント同期を開始します');
  
  try {
    // 依存関係の状態をログに出力
    this.logger.debug('依存関係の状態:', {
      hasCacheManager: !!this.cacheManager,
      hasLockManager: !!this.lockManager,
      hasTaskManager: !!this.taskManager,
      hasSessionManager: !!this.sessionManager,
      hasFeedbackManager: !!this.feedbackManager
    });

    // 必要な依存関係がなければ同期しない
    if (!this.cacheManager || !this.lockManager) {
      throw new Error('同期に必要な依存関係がありません');
    }
    
    // ロックの取得
    this.logger.debug('ロックの取得を試みます: sync:components');
    const lock = await this.lockManager.acquire('sync:components', 5000);
    this.logger.debug('ロックの取得に成功しました: sync:components');
    
    try {
      // タスクの同期
      this.logger.debug('タスクの同期を開始します');
      const tasks = await this.taskManager.getAllTasks();
      this.cacheManager.set('tasks', tasks);
      this.logger.debug('タスクの同期が完了しました');
      
      // セッションの同期
      this.logger.debug('セッションの同期を開始します');
      const latestSession = await this.sessionManager.getLatestSession();
      if (latestSession) {
        this.cacheManager.set('latest-session', latestSession);
        this.logger.debug('最新セッションをキャッシュに設定しました');
      } else {
        this.logger.debug('最新セッションが見つかりませんでした');
      }
      
      // フィードバックの同期
      this.logger.debug('フィードバックの同期を開始します');
      const pendingFeedback = await this.feedbackManager.getPendingFeedback();
      if (pendingFeedback) {
        this.cacheManager.set('pending-feedback', pendingFeedback);
        this.logger.debug('保留中のフィードバックをキャッシュに設定しました');
      } else {
        this.logger.debug('保留中のフィードバックが見つかりませんでした');
      }
      
      this.logger.debug('コンポーネント同期が完了しました');
    } finally {
      // ロックの解放
      this.logger.debug('ロックの解放を試みます: sync:components');
      await lock.release();
      this.logger.debug('ロックの解放に成功しました: sync:components');
    }
  } catch (error) {
    if (error instanceof LockTimeoutError) {
      this.logger.warn('同期ロックの取得がタイムアウトしました');
    } else {
      // エラーの詳細情報をログに出力
      this.logger.error('コンポーネント同期中にエラーが発生しました:', {
        errorMessage: error.message,
        errorName: error.name,
        errorStack: error.stack,
        errorContext: error.context || {},
        errorCode: error.code
      });
      throw error;
    }
  }
}
```

#### 2.1.2 _startPeriodicSyncメソッドの修正

```javascript
_startPeriodicSync(interval) {
  this.syncTimer = setInterval(() => {
    this._syncComponents().catch(error => {
      // エラーの詳細情報をログに出力
      this.logger.error('コンポーネント同期中にエラーが発生しました:', {
        errorMessage: error.message,
        errorName: error.name,
        errorStack: error.stack,
        errorContext: error.context || {},
        errorCode: error.code
      });
    });
  }, interval);
  
  this.logger.info(`定期同期を開始しました（間隔: ${interval}ms）`);
}
```

### 2.2 テスト実行

修正後のコードでテストを実行し、詳細なログを収集します。以下のコマンドを実行します：

```bash
set NODE_ENV=test && node -e "const ServiceContainer = require('./src/lib/core/service-container'); const { registerServices } = require('./src/lib/core/service-definitions'); const container = new ServiceContainer(); registerServices(container); const integrationManager = container.get('integrationManager'); console.log('IntegrationManager initialized:', integrationManager.constructor.name); console.log('Periodic sync enabled:', integrationManager.enablePeriodicSync);"
```

### 2.3 エラー分析

収集したログからエラーの原因を特定します。以下の可能性を検討します：

1. **依存関係の問題**
   - 必要な依存関係（cacheManager、lockManager、taskManager、sessionManager、feedbackManager）が正しく注入されていない
   - 依存関係のメソッドが存在しない、または期待通りに動作していない

2. **メソッドの呼び出しエラー**
   - `acquire`、`getAllTasks`、`getLatestSession`、`getPendingFeedback`、`set`、`release`などのメソッド呼び出しでエラーが発生している

3. **データ形式の不一致**
   - 返されるデータの形式が期待と異なる
   - nullやundefinedが返される場合の処理が適切でない

4. **非同期処理の問題**
   - Promiseの処理が適切でない
   - awaitの使用が不適切

5. **テスト環境特有の問題**
   - テスト環境では存在しないリソースにアクセスしようとしている
   - テスト環境では無効な操作を実行しようとしている

### 2.4 修正案の作成

エラーの原因に基づいて修正案を作成します。以下の可能性を検討します：

1. **依存関係の問題の修正**
   - 必要な依存関係が正しく注入されるように、サービス定義を修正
   - 依存関係のメソッドが存在することを確認し、必要に応じて実装を修正

2. **メソッドの呼び出しエラーの修正**
   - エラーが発生するメソッド呼び出しを修正
   - 必要に応じて、エラーハンドリングを追加

3. **データ形式の不一致の修正**
   - データ形式を期待通りに変換
   - nullやundefinedの場合の処理を追加

4. **非同期処理の問題の修正**
   - Promiseの処理を修正
   - awaitの使用を修正

5. **テスト環境特有の問題の修正**
   - テスト環境では特定の処理をスキップするように修正
   - テスト環境用のモックを作成

## 3. 実装手順

1. **ログ強化の実装**
   - `src/lib/managers/integration-manager.js`ファイルを修正し、上記の変更を適用

2. **テスト実行**
   - 修正後のコードでテストを実行し、詳細なログを収集

3. **エラー分析**
   - 収集したログからエラーの原因を特定

4. **修正案の実装**
   - エラーの原因に基づいて修正案を実装
   - 必要に応じて単体テストも追加

5. **検証**
   - 修正後のコードでテストを実行し、エラーが解消されたことを確認

## 4. 次のステップ

1. Codeモードに切り替えて、上記の実装を行う
2. エラーの原因を特定し、修正する
3. 修正後のコードでテストを実行し、エラーが解消されたことを確認
4. フェーズ4の残りのタスクに進む