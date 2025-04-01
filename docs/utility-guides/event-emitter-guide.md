# EventEmitter 利用ガイド (`src/lib/utils/event-emitter.js`)

## 1. 目的

アプリケーション内の異なるコンポーネント間で、疎結合な通信を実現するためのイベント駆動メカニズムを提供します。`src/lib/core/event-system.js` の `EnhancedEventEmitter` を継承し、標準化されたイベント発行機能を追加しています。

## 2. コンストラクタ (`new EventEmitter(options)`)

*   **`options`** (Object): 設定オプション。
    *   **`logger` (Object): 必須。** イベントの発行やリスナー登録に関するログを出力するために使用される Logger インスタンス。
    *   **`debugMode` (boolean):** オプション。デバッグモードを有効にするかどうか。デフォルトは `false`。有効にすると、イベント発行時などにデバッグログが出力されます。
    *   **`keepHistory` (boolean):** オプション。発行されたイベントの履歴を保持するかどうか。デフォルトは `false`。デバッグやテストに役立ちますが、メモリ使用量が増加します。
    *   **`historyLimit` (number):** オプション。`keepHistory` が `true` の場合に保持するイベント履歴の最大数。デフォルトは `100`。
    *   **`traceIdGenerator` (Function):** オプション。トレースIDを生成する関数。デフォルトは内部のジェネレーター。★★★ 追加 ★★★
    *   **`requestIdGenerator` (Function):** オプション。リクエストIDを生成する関数。デフォルトは内部のジェネレーター。★★★ 追加 ★★★

*   **例:**
    ```javascript
    const Logger = require('./logger'); // 仮
    const { generateTraceId, generateRequestId } = require('./id-generators'); // 仮
    const logger = new Logger();

    const eventEmitter = new EventEmitter({
      logger: logger,
      debugMode: true,
      keepHistory: true,
      historyLimit: 50,
      traceIdGenerator: generateTraceId, // 注入例
      requestIdGenerator: generateRequestId // 注入例
    });
    ```

## 3. 主要メソッド

### 3.1 イベント購読・解除

*   **`on(eventName, listener)`:** 指定された `eventName` のイベントが発生したときに `listener` 関数を呼び出すように登録します。
    *   `eventName` (string): 購読するイベント名 (例: `'git:commit_created'`, `'user:updated'`)。
    *   `listener` (Function): イベント発生時に呼び出される関数。イベントデータが引数として渡されます。
*   **`once(eventName, listener)`:** 指定された `eventName` のイベントが**一度だけ**発生したときに `listener` 関数を呼び出すように登録します。一度呼び出されると自動的に解除されます。
*   **`off(eventName, listener)`:** 指定された `eventName` に登録された `listener` 関数を解除します。
*   **`removeAllListeners([eventName])`:** 指定された `eventName` のすべてのリスナーを解除します。`eventName` を省略すると、**すべてのイベント**の**すべてのリスナー**を解除します。

*   **例:**
    ```javascript
    function handleUserUpdate(eventData) {
      logger.info(`User updated: ${eventData.userId}`);
      logger.debug(`Trace ID: ${eventData.traceId}`); // traceId などが利用可能
    }

    // イベント購読
    eventEmitter.on('user:updated', handleUserUpdate);

    // 一度だけ購読
    eventEmitter.once('app:initialized', () => {
      logger.info('Application initialized!');
    });

    // イベント購読解除
    eventEmitter.off('user:updated', handleUserUpdate);

    // 特定イベントの全リスナー解除
    eventEmitter.removeAllListeners('user:updated');

    // 全イベントの全リスナー解除 (注意して使用)
    // eventEmitter.removeAllListeners();
    ```

### 3.2 イベント発行 (標準化)

*   **`emitStandardized(component, action, [data={}])`:** 標準化された形式で同期的にイベントを発行します。
    *   `component` (string): イベントを発行するコンポーネント名 (例: `'git'`, `'storage'`)。
    *   `action` (string): 発生したアクション (例: `'commit_created'`, `'file_read_after'`)。
    *   `data` (Object): オプション。イベントに関連するデータ。
    *   **発行されるイベント名:** `${component}:${action}`
    *   **イベントデータ:** `data` オブジェクトに `timestamp`, `component`, `action`, **`traceId`, `requestId` が自動的に追加されます。** ★★★ 修正 ★★★
    *   **グローバルイベント:** 標準化されたイベント (`component:action`) に加えて、常に `'event'` という名前のグローバルイベントも発行されます。このグローバルイベントのデータには、`type: '${component}:${action}'` が追加されます。
    *   **戻り値:** (boolean) 少なくとも1つのリスナーが呼び出された場合は `true`、そうでなければ `false`。
*   **`emitStandardizedAsync(component, action, [data={}])`:** 標準化された形式で非同期的にイベントを発行します。リスナーが Promise を返す場合、すべてのリスナーの Promise が解決されるのを待ちます。
    *   引数、発行されるイベント名、イベントデータ、グローバルイベントは `emitStandardized` と同様です。**イベントデータには `traceId`, `requestId` が自動的に付与されます。** ★★★ 修正 ★★★
    *   **戻り値:** (Promise<boolean>) すべてのリスナーの処理が完了した後、少なくとも1つのリスナーが呼び出された場合は `true`、そうでなければ `false` を解決する Promise。

*   **例:**
    ```javascript
    // 同期発行
    const emitted = eventEmitter.emitStandardized('cache', 'item_set', { key: 'user:1', ttl: 300 });
    if (emitted) {
      logger.debug('Cache set event was handled.');
    }

    // 非同期発行
    try {
      await eventEmitter.emitStandardizedAsync('user', 'registered', { userId: 'newUser' });
      logger.info('User registration event handled successfully.');
    } catch (error) {
      logger.error('Error handling user registration event:', error);
    }
    ```

### 3.3 その他

*   **`listenerCount(eventName)`:** 指定された `eventName` に登録されているリスナーの数を返します。
*   **`getRegisteredEvents()`:** 現在リスナーが登録されているすべてのイベント名の配列を返します。
*   **`getHistory()`:** (`keepHistory: true` の場合) 保持されているイベント履歴の配列を返します。

## 4. 注意点とベストプラクティス

*   **標準化された発行:** イベントの発行には、原則として `emitStandardized` または `emitStandardizedAsync` を使用してください。これにより、イベント構造の一貫性が保たれます。
*   **IDジェネレーターの注入:** アプリケーション全体で一貫したトレースを行うために、`traceIdGenerator` と `requestIdGenerator` をコンストラクタオプションで注入することを推奨します。
*   **イベント名の規約:** イベント名は `component:action` 形式 ([コーディング規約](coding-standards.md) 参照) を厳守してください。
*   **疎結合の維持:** イベントリスナー内で、イベント発行元のコンポーネントに直接依存する処理を書かないように注意してください。イベントデータに必要な情報を含めるように設計します。
*   **エラーハンドリング:** 非同期リスナー (`async` 関数) 内でエラーが発生した場合、`emitStandardizedAsync` はそのエラーで拒否 (reject) されます。呼び出し元で適切に `try...catch` を使用してください。同期リスナー内で発生したエラーは、`emitStandardized` の呼び出し元には伝播しません（`EnhancedEventEmitter` の仕様）。リスナー内で適切にエラーハンドリングを行うか、エラーイベントを別途発行することを検討してください。
*   **リスナーの解除:** 不要になったリスナーは `off()` または `removeAllListeners()` で適切に解除し、メモリリークを防いでください。特に、クラスのインスタンスメソッドをリスナーとして登録した場合、インスタンスが破棄される際にリスナーも解除する必要があります。
*   **`removeAllListeners()` の注意:** 引数なしで `removeAllListeners()` を呼び出すと、すべてのイベントのリスナーが解除されるため、意図しない影響がないか十分に確認してから使用してください。
*   **ユーティリティクラス内での発行:** ユーティリティクラス (例: `StorageService`, `CacheManager`) 内でイベントを発行する場合は、`_emitEvent` という内部ヘルパーメソッドを定義し、その中で `traceId`, `requestId` の生成と `emitStandardized` の呼び出しを行うパターンを推奨します ([設計原則](design-principles.md) 参照)。これにより、イベント発行ロジックが統一され、テストも容易になります。