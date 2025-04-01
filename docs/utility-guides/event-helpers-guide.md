# EventHelpers 利用ガイド (`src/lib/utils/event-helpers.js`)

## 1. 目的

イベント駆動アーキテクチャにおけるイベントデータの標準化と、イベント発行の統一的な方法を提供するためのヘルパー関数群です。`EventEmitter` と連携して使用されることを想定しています。

## 2. 主要メソッド

*   **`createStandardizedEventData(data = {}, component)`:**
    *   与えられた `data` オブジェクトに、標準的なイベントメタデータ（`timestamp`, `component`）を追加または上書きして返します。★★★ 修正: traceId, requestId の言及を削除 ★★★
    *   `timestamp`: `data` に `timestamp` がなければ現在時刻 (ISO 8601) を設定します。
    *   `component`: 引数で渡された `component` 文字列を設定します。
    *   `traceId`, `requestId`: **この関数では生成・追加されません。** ★★★ 修正 ★★★ 既存の `traceId`/`requestId` (または `trace_id`/`request_id`) が `data` に含まれていれば、それは保持されます。
    *   戻り値: `Object` (標準化されたイベントデータ)
    *   **利用場面:** 通常は `EventEmitter.emitStandardized` メソッドの利用が推奨されます。このヘルパーは、イベントデータを `emitStandardized` に渡す前に手動で `timestamp` や `component` を付与したい、あるいはデータを加工する中間処理などで限定的に使用できます。★★★ 修正 ★★★

*   **`emitStandardizedEvent(eventEmitter, component, action, data = {})`:**
    *   指定された `eventEmitter` インスタンスの `emitStandardized` メソッドを呼び出して、標準化されたイベントを発行するためのヘルパー関数です。★★★ 修正: 「推奨」を削除 ★★★
    *   内部で `createStandardizedEventData` を呼び出して `timestamp` と `component` をデータに追加します。★★★ 修正 ★★★
    *   `eventEmitter` に `emitStandardized` メソッドが存在しない場合や、発行中にエラーが発生した場合は、エラーログを出力（またはコンソールエラー）し、`false` を返します。
    *   `eventEmitter` の `debugMode` が `true` の場合、イベント発行に関するデバッグログを出力します。
    *   戻り値: `boolean` (イベント発行が試行され、`emitStandardized` がエラーをスローしなかった場合は `true`、それ以外は `false`)
    *   **利用場面:** `EventEmitter` インスタンスへの参照があり、イベント発行ロジックを共通化したい場合に役立ちますが、多くの場合 `eventEmitter.emitStandardized()` を直接呼び出す方がシンプルです。★★★ 修正 ★★★

*   **例:**
    ```javascript
    const EventEmitter = require('./event-emitter'); // 仮
    const Logger = require('./logger'); // 仮
    const { emitStandardizedEvent, createStandardizedEventData } = require('./event-helpers');

    const logger = new Logger();
    const eventEmitter = new EventEmitter({ logger });

    // emitStandardizedEvent を使用
    const success = emitStandardizedEvent(eventEmitter, 'user', 'login_success', { userId: 'user-123' });
    if (!success) {
      logger.error('Failed to emit user login event');
    }
    // 発行されるイベントデータには、EventEmitter によって traceId, requestId が自動付与される

    // createStandardizedEventData を手動で使用 (通常は EventEmitter.emitStandardized を直接使う方が良い)
    const rawData = { customField: 'abc' };
    const standardizedData = createStandardizedEventData(rawData, 'custom_component');
    // eventEmitter.emitStandardized('custom_component', 'some_action', standardizedData); // EventEmitter が ID を付与
    ```

## 3. 発行されるイベント

このモジュール自体はイベントを発行しません。`emitStandardizedEvent` は、渡された `eventEmitter` インスタンスを通じてイベントを発行します。

## 4. 注意点とベストプラクティス

*   **`EventEmitter.emitStandardized` の利用:** 多くの場合、`EventEmitter` インスタンスが利用可能であれば、`eventEmitter.emitStandardized()` メソッドを直接呼び出す方が、ID生成も含めて処理が完結するためシンプルです。`emitStandardizedEvent` ヘルパーの利用は、特定の共通化が必要な場合に限定することを検討してください。★★★ 修正 ★★★
*   **ID生成:** `traceId` と `requestId` の生成と付与は `EventEmitter.emitStandardized` (および `emitStandardizedAsync`) の責務です。これらのヘルパー関数を使用する場合、ID は `EventEmitter` によって自動的に処理されます。★★★ 修正 ★★★
*   **エラーハンドリング:** `emitStandardizedEvent` は、イベント発行自体のエラー（例: `eventEmitter` が不正）は捕捉してログに出力しますが、リスナー内で発生したエラーは捕捉しません（これは `EventEmitter` の責務です）。