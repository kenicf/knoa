# Logger 利用ガイド (`src/lib/utils/logger.js`)

## 1. 目的

アプリケーション全体のログ記録を一元管理し、デバッグ、監視、および問題追跡を容易にします。異なるログレベル（debug, info, warn, error, fatal）をサポートし、複数の出力先（トランスポート）にログを送信できます。

## 2. コンストラクタ (`new Logger(options)`)

*   **`options`** (Object): 設定オプション。
    *   **`logger` (Object): 必須。** Logger インスタンス自体。通常、他のコンポーネントに渡す際に使用します。（注: Logger自身のコンストラクタでは不要ですが、DIパターンとして他のクラスでは必須です）
    *   **`level` (string):** オプション。記録する最低ログレベル。デフォルトは `'info'`。指定可能なレベル: `'debug'`, `'info'`, `'warn'`, `'error'`, `'fatal'`。
    *   **`transports` (Array<Object>):** オプション。ログ出力先トランスポートの配列。デフォルトはコンソール出力。各トランスポートは `type` (文字列、識別用) と `write(entry)` (ログエントリを受け取る関数) を持つ必要があります。
    *   **`contextProviders` (Object):** オプション。ログエントリに自動的に追加されるコンテキスト情報を提供する関数のマップ。キーがコンテキスト名、値が値を返す関数です。
    *   **`eventEmitter` (Object):** オプション。イベント発行に使用する EventEmitter インスタンス。ログイベント（`log:message_created` など）を発行するために使用されます。
    *   **`traceIdGenerator` (Function):** オプション。トレースIDを生成する関数。デフォルトは内部のジェネレーター。
    *   **`requestIdGenerator` (Function):** オプション。リクエストIDを生成する関数。デフォルトは内部のジェネレーター。

*   **例:**
    ```javascript
    const EventEmitter = require('./event-emitter'); // 仮
    const { generateTraceId, generateRequestId } = require('./id-generators'); // 仮
    const myTransport = {
      type: 'file',
      write: (entry) => { /* ファイル書き込み処理 */ }
    };
    const eventEmitter = new EventEmitter({ logger: console }); // LoggerはEventEmitterに必要

    const logger = new Logger({
      level: 'debug',
      transports: [myTransport],
      contextProviders: {
        appName: () => 'MyApplication',
        pid: () => process.pid
      },
      eventEmitter: eventEmitter,
      traceIdGenerator: generateTraceId, // 注入例
      requestIdGenerator: generateRequestId // 注入例
    });
    ```

## 3. 主要メソッド

### 3.1 ログ出力メソッド

以下のメソッドは、指定されたレベルでログメッセージを記録します。

*   `debug(message, [context])`
*   `info(message, [context])`
*   `warn(message, [context])`
*   `error(message, [context])`
*   `fatal(message, [context])`

*   **`message` (string):** ログメッセージ本体。
*   **`context` (Object):** オプション。そのログエントリ固有の追加情報を含むオブジェクト。`traceId` や `requestId` を含めることができます。**ここで指定された `traceId`/`requestId` は、Logger インスタンスのジェネレーターよりも優先されます。** ★★★ 修正 ★★★

*   **ログエントリ構造:** トランスポートの `write` 関数やイベントリスナーには、以下の構造を持つ `entry` オブジェクトが渡されます。
    ```json
    {
      "timestamp": "2025-03-29T12:10:00.123Z", // ISO 8601 形式
      "level": "info",
      "message": "User logged in",
      "context": {
        "userId": "user-123",
        "ipAddress": "192.168.1.100",
        // contextProviders からの情報
        "appName": "MyApplication",
        "pid": 12345,
        // 自動生成または context から引き継がれた ID
        "traceId": "trace-...", // ★★★ Loggerのジェネレーターまたはcontext引数から取得 ★★★
        "requestId": "req-...", // ★★★ Loggerのジェネレーターまたはcontext引数から取得 ★★★
        "trace_id": "trace-...", // 後方互換性 (削除検討)
        "request_id": "req-..." // 後方互換性 (削除検討)
      }
    }
    ```

*   **例:**
    ```javascript
    logger.info('User login attempt', { userId: 'user-abc', ipAddress: '10.0.0.5' });
    try {
      // ... some operation ...
    } catch (error) {
      // 既存のトレースIDを引き継ぐ場合
      logger.error('Operation failed', { error: error.message, traceId: currentTraceId });
    }
    ```

### 3.2 設定メソッド

*   **`addTransport(transport)`:** 新しいログ出力先トランスポートを追加します。
    *   `transport` (Object): `type` (string) と `write(entry)` (Function) を持つオブジェクト。
*   **`addContextProvider(key, provider)`:** 新しいコンテキストプロバイダーを追加します。
    *   `key` (string): ログエントリの `context` 内で使用されるキー。
    *   `provider` (Function): 呼び出されるとコンテキスト値を返す関数。

## 4. 発行されるイベント (EventEmitter が指定されている場合)

`eventEmitter.emitStandardized()` を通じて以下のイベントが発行されます。**これらのイベントデータにも、`timestamp`, `traceId`, `requestId` が自動的に含まれます。** ★★★ 修正 ★★★

*   **`log:message_created`:** ログレベルに関わらず、ログメッセージが記録されるたびに発行されます。データには完全なログエントリが含まれます。
*   **`log:alert_created`:** `error` または `fatal` レベルのログが記録されたときに発行されます。データには完全なログエントリが含まれます。外部の監視・通知システムとの連携に使用できます。
*   **`log:transport_added`:** `addTransport()` によって新しいトランスポートが追加されたときに発行されます。データには追加されたトランスポートの `type` が含まれます。
*   **`log:context_provider_added`:** `addContextProvider()` によって新しいコンテキストプロバイダーが追加されたときに発行されます。データには追加されたプロバイダーの `key` が含まれます。

## 5. 注意点とベストプラクティス

*   **ログレベルの適切な設定:** 開発環境では `debug`、本番環境では `info` や `warn` など、環境に応じて適切なログレベルを設定してください。
*   **コンテキスト情報の活用:** 問題追跡を容易にするため、ログメッセージには関連するコンテキスト情報（ユーザーID、リクエストID、関連データなど）を積極的に含めてください。`traceId` と `requestId` は、一連の操作やリクエストを追跡するために特に重要です。
*   **IDジェネレーター:** `traceIdGenerator` と `requestIdGenerator` はオプションですが、アプリケーション全体で一貫したトレースを行うために、外部から共通のジェネレーターを注入することを推奨します。★★★ 追加 ★★★
*   **個人情報・機密情報のマスキング:** ログにパスワード、APIキー、個人情報などの機密情報が含まれないように注意してください。必要に応じてマスキング処理を行うか、専用のセキュアなログシステムを検討してください。
*   **パフォーマンス:** 大量のログを頻繁に出力すると、アプリケーションのパフォーマンスに影響を与える可能性があります。特に `debug` レベルのログは、本番環境では抑制することを検討してください。非同期トランスポートを使用することも有効です。
*   **トランスポートの選択:** ログの量や重要度に応じて、適切なトランスポート（コンソール、ファイル、外部ログサービスなど）を選択してください。