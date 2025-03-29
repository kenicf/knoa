# EventHelpers 利用ガイド (`src/lib/utils/event-helpers.js`)

## 1. 目的

イベント駆動アーキテクチャにおけるイベントデータの標準化と、イベント発行の統一的な方法を提供するためのヘルパー関数群です。`EventEmitter` と連携して使用されることを想定しています。

## 2. 主要メソッド

*   **`createStandardizedEventData(data = {}, component)`:**
    *   与えられた `data` オブジェクトに、標準的なイベントメタデータ（`timestamp`, `traceId`, `requestId`, `component`）を追加または上書きして返します。
    *   `timestamp`: `data` に `timestamp` がなければ現在時刻 (ISO 8601) を設定します。
    *   `traceId`, `requestId`: `data` に `traceId`/`requestId` (または `trace_id`/`request_id`) がなければ、内部ジェネレーターで生成したIDを設定します。既存のIDがあればそれを優先します（camelCase が優先される可能性があります）。
    *   `component`: 引数で渡された `component` 文字列を設定します。
    *   戻り値: `Object` (標準化されたイベントデータ)
    *   **利用場面:** `EventEmitter.emitStandardized` を直接使用する代わりに、手動で標準化データを作成したい場合や、イベントデータを加工する中間処理などで使用できますが、通常は `emitStandardizedEvent` ヘルパーまたは `EventEmitter.emitStandardized` メソッドの利用が推奨されます。

*   **`emitStandardizedEvent(eventEmitter, component, action, data = {})`:**
    *   指定された `eventEmitter` インスタンスの `emitStandardized` メソッドを呼び出して、標準化されたイベントを発行するための推奨ヘルパー関数です。
    *   内部で `createStandardizedEventData` を呼び出してデータを標準化します。
    *   `eventEmitter` に `emitStandardized` メソッドが存在しない場合や、発行中にエラーが発生した場合は、エラーログを出力（またはコンソールエラー）し、`false` を返します。
    *   `eventEmitter` の `debugMode` が `true` の場合、イベント発行に関するデバッグログを出力します。
    *   戻り値: `boolean` (イベント発行が試行され、`emitStandardized` がエラーをスローしなかった場合は `true`、それ以外は `false`)
    *   **利用場面:** `EventEmitter` インスタンスへの参照があり、標準化されたイベントを簡単に発行したい場合に推奨されます。

*   **例:**
    ```javascript
    const EventEmitter = require('./event-emitter'); // 仮
    const Logger = require('./logger'); // 仮
    const { emitStandardizedEvent, createStandardizedEventData } = require('./event-helpers');

    const logger = new Logger();
    const eventEmitter = new EventEmitter({ logger });

    // emitStandardizedEvent を使用 (推奨)
    const success = emitStandardizedEvent(eventEmitter, 'user', 'login_success', { userId: 'user-123' });
    if (!success) {
      logger.error('Failed to emit user login event');
    }

    // createStandardizedEventData を手動で使用 (通常は不要)
    const rawData = { customField: 'abc' };
    const standardizedData = createStandardizedEventData(rawData, 'custom_component');
    // eventEmitter.emit('custom_component:some_action', standardizedData); // emit を直接使う場合など
    ```

## 3. 発行されるイベント

このモジュール自体はイベントを発行しません。`emitStandardizedEvent` は、渡された `eventEmitter` インスタンスを通じてイベントを発行します。

## 4. 注意点とベストプラクティス

*   **`EventEmitter.emitStandardized` の利用:** 多くの場合、`EventEmitter` インスタンスが利用可能であれば、`eventEmitter.emitStandardized()` メソッドを直接呼び出す方がシンプルです。`emitStandardizedEvent` ヘルパーは、`EventEmitter` インスタンスへのアクセスが容易でない場合や、イベント発行ロジックを共通化したい場合に役立ちます。
*   **ID生成:** `createStandardizedEventData` は、`traceId` や `requestId` がデータに含まれていない場合に内部でIDを生成します。アプリケーション全体で一貫したID生成戦略（例: OperationContext から取得）がある場合は、`createStandardizedEventData` を呼び出す前に `data` オブジェクトにそれらのIDを設定しておくことが推奨されます。
*   **エラーハンドリング:** `emitStandardizedEvent` は、イベント発行自体のエラー（例: `eventEmitter` が不正）は捕捉してログに出力しますが、リスナー内で発生したエラーは捕捉しません（これは `EventEmitter` の責務です）。