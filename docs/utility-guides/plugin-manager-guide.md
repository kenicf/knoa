# PluginManager 利用ガイド (`src/lib/utils/plugin-manager.js`)

## 1. 目的

アプリケーションの機能を拡張可能にするためのプラグイン機構を提供します。異なるタイプのプラグインを登録し、それらのメソッドを動的に呼び出すことができます。

## 2. コンストラクタ (`new PluginManager(options)`)

*   **`options`** (Object): 設定オプション。
    *   **`logger` (Object): 必須。** プラグインの登録、呼び出し、エラーなどに関するログを出力するために使用される Logger インスタンス。
    *   **`eventEmitter` (Object):** オプション。プラグイン関連のイベントを発行するために使用する EventEmitter インスタンス。
    *   **`traceIdGenerator` (Function):** オプション。トレースIDを生成する関数。デフォルトは内部のジェネレーター。
    *   **`requestIdGenerator` (Function):** オプション。リクエストIDを生成する関数。デフォルトは内部のジェネレーター。

*   **例:**
    ```javascript
    const Logger = require('./logger'); // 仮
    const EventEmitter = require('./event-emitter'); // 仮
    const { generateTraceId, generateRequestId } = require('./id-generators'); // 仮

    const logger = new Logger();
    const eventEmitter = new EventEmitter({ logger });

    const pluginManager = new PluginManager({
      logger: logger,
      eventEmitter: eventEmitter,
      traceIdGenerator: generateTraceId, // 注入例
      requestIdGenerator: generateRequestId // 注入例
    });
    ```

## 3. 主要メソッド

*   **`registerPlugin(pluginType, pluginImplementation)`:**
    *   指定された `pluginType` (文字列) で、`pluginImplementation` (オブジェクト) をプラグインとして登録します。
    *   登録前に、プラグイン実装が基本的な要件（オブジェクトであること、特定のタイプでは必須メソッドを持つこと）を満たしているか検証します (`_validatePlugin`)。
    *   検証に失敗した場合は `false` を返し、`plugin:validation_failed` イベントを発行します。
    *   登録に成功した場合:
        *   プラグインを内部の Map に保存します。
        *   `pluginImplementation` に `initialize` メソッドがあれば呼び出します。初期化中にエラーが発生しても登録自体は成功しますが、エラーログと `plugin:initialization_error` イベントが発行されます。
        *   `true` を返します。
        *   `plugin:registered` イベントを発行します。
    *   戻り値: `boolean` (登録に成功したかどうか)
*   **`unregisterPlugin(pluginType)`:**
    *   指定された `pluginType` のプラグインを削除します。
    *   削除前に、プラグイン実装に `cleanup` メソッドがあれば呼び出します。クリーンアップ中にエラーが発生しても削除処理は続行されますが、エラーログと `plugin:cleanup_error` イベントが発行されます。
    *   削除に成功した場合は `true` を返し、`plugin:unregistered` イベントを発行します。
    *   指定された `pluginType` のプラグインが存在しない場合は `false` を返します。
    *   戻り値: `boolean` (削除に成功したかどうか)
*   **`invokePlugin(pluginType, methodName, ...args)`:**
    *   指定された `pluginType` のプラグインが持つ `methodName` メソッドを、指定された `args` で呼び出します。
    *   プラグインまたはメソッドが存在しない場合は `null` を返し、`plugin:method_not_found` イベントを発行します。
    *   メソッド呼び出しが成功した場合、その結果を解決する Promise を返します。`plugin:method_invoked` と `plugin:method_completed` イベントが発行されます。
    *   メソッド呼び出し中にエラーが発生した場合、そのエラーを拒否 (reject) する Promise を返します。`plugin:method_invoked` と `plugin:method_error` イベントが発行されます。
    *   戻り値: `Promise<*|null>` (メソッドの戻り値、またはプラグイン/メソッドが見つからない場合は null)
*   **`hasPlugin(pluginType)`:**
    *   指定された `pluginType` のプラグインが登録されているかどうかを確認します。
    *   戻り値: `boolean`
*   **`getRegisteredPlugins()`:**
    *   現在登録されているすべてのプラグインの `pluginType` の配列を返します。
    *   戻り値: `Array<string>`

*   **例:**
    ```javascript
    // プラグインの実装例 (通知プラグイン)
    const notificationPlugin = {
      // 必須メソッド (検証用)
      sendNotification: async (message, recipient) => {
        pluginManager.logger.info(`Sending notification to ${recipient}: ${message}`);
        // ... 実際の通知処理 (例: API呼び出し) ...
        await new Promise(resolve => setTimeout(resolve, 100)); // ダミーの非同期処理
        return { success: true, messageId: 'msg-123' };
      },
      initialize: () => {
        pluginManager.logger.info('Notification plugin initialized.');
      },
      cleanup: () => {
        pluginManager.logger.info('Notification plugin cleaned up.');
      }
    };

    // プラグイン登録
    const registered = pluginManager.registerPlugin('notification', notificationPlugin);

    if (registered) {
      // プラグインメソッド呼び出し
      try {
        const result = await pluginManager.invokePlugin('notification', 'sendNotification', 'Hello!', 'user@example.com');
        if (result && result.success) {
          pluginManager.logger.info(`Notification sent, ID: ${result.messageId}`);
        } else {
          pluginManager.logger.warn('Notification sending might have failed.');
        }
      } catch (error) {
        pluginManager.logger.error('Failed to invoke notification plugin:', error);
      }

      // プラグイン削除
      pluginManager.unregisterPlugin('notification');
    }
    ```

## 4. 発行されるイベント (EventEmitter が指定されている場合)

プラグインのライフサイクルやメソッド呼び出しに応じて、`plugin:` プレフィックスを持つ以下のイベントが発行されます。**これらのイベントデータには自動的に `timestamp`, `traceId`, `requestId` が含まれます。** ★★★ 修正 ★★★

*   `plugin:registered`: プラグイン登録成功時。
*   `plugin:validation_failed`: プラグイン登録時の検証失敗時。
*   `plugin:initialization_error`: 登録時の `initialize` メソッド実行エラー時。
*   `plugin:unregistered`: プラグイン削除成功時。
*   `plugin:cleanup_error`: 削除時の `cleanup` メソッド実行エラー時。
*   `plugin:method_invoked`: `invokePlugin` でメソッド呼び出し開始時。
*   `plugin:method_completed`: `invokePlugin` でメソッド呼び出し成功時。
*   `plugin:method_not_found`: `invokePlugin` でプラグインまたはメソッドが見つからない時。
*   `plugin:method_error`: `invokePlugin` でメソッド実行エラー時。

イベントデータには、関連する `pluginType`, `methodName`, エラーメッセージなどが含まれます。

## 5. 注意点とベストプラクティス

*   **必須依存関係:** `PluginManager` は `logger` を**必須**とします。
*   **IDジェネレーター:** `traceIdGenerator` と `requestIdGenerator` はオプションですが、アプリケーション全体で一貫したトレースを行うために、外部から共通のジェネレーターを注入することを推奨します。★★★ 追加 ★★★
*   **プラグインインターフェース:** 特定の `pluginType` に対して期待されるメソッドシグネチャ（必須メソッド、引数、戻り値）を定義し、ドキュメント化することを推奨します。`_validatePlugin` メソッドは基本的な検証を行いますが、より厳密なインターフェースチェックが必要な場合は、登録前に追加の検証を行うか、TypeScript などの型システムを利用することを検討してください。
*   **非同期メソッド:** `invokePlugin` は常に Promise を返します。プラグインメソッドが同期的であっても非同期的であっても、呼び出し側は `await` または `.then()` で処理する必要があります。
*   **エラーハンドリング:** `invokePlugin` で発生したエラーは、呼び出し元にそのままスローされます。呼び出し側で適切に `try...catch` を使用してエラーを処理してください。`initialize` や `cleanup` でのエラーは PluginManager 内部でログに出力され、イベントが発行されますが、呼び出し元には直接スローされません。
*   **ライフサイクル管理:** アプリケーションの起動時に必要なプラグインを `registerPlugin` で登録し、終了時に `unregisterPlugin` で（必要であれば）クリーンアップ処理を実行するようにしてください。