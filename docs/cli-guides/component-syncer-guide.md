# CliComponentSyncer 利用ガイド (`src/cli/component-syncer.js`)

## 1. 目的

`CliComponentSyncer` は、CLIにおけるコンポーネント間の同期処理を実行するクラスです。`IntegrationManagerAdapter` を通じて、具体的な同期ロジックを呼び出します。

## 2. コンストラクタ (`new CliComponentSyncer(options)`)

*   **`options`** (Object): 設定オプション。
    *   **`logger` (Object): 必須。** Logger インスタンス。
    *   **`eventEmitter` (Object): 必須。** EventEmitter インスタンス。
    *   **`integrationManagerAdapter` (Object): 必須。** `IntegrationManagerAdapter` インスタンス。コンポーネント同期処理の実体を提供します。
    *   **`errorHandler` (Object):** オプション。エラーハンドラー。
    *   **`traceIdGenerator` (Function): 必須。** トレースID生成関数。
    *   **`requestIdGenerator` (Function): 必須。** リクエストID生成関数。

*   **初期化:** コンストラクタは、渡された依存関係をインスタンス変数に格納します。必須の依存関係が不足している場合は `ApplicationError` をスローします。

## 3. 主要メソッド

*   **`syncComponents()`:**
    *   コンポーネント間の同期を実行します。`integrationManagerAdapter.syncComponents` を呼び出します。
    *   **機能:**
        1.  `cli:sync_before` イベントを発行します。
        2.  同期開始のログを出力します。
        3.  `integrationManagerAdapter.syncComponents` を呼び出します。
        4.  アダプターからの戻り値（boolean を期待）を検証します。
            *   boolean 以外が返された場合は `ApplicationError` (コード: `ERR_SYNC_UNEXPECTED`) をスローします。
            *   `false` が返された場合は `ApplicationError` (コード: `ERR_SYNC_FAILED`) をスローします。
        5.  成功した場合 (`true` が返された場合):
            *   `cli:sync_after` イベントを発行します（`success: true` を含む）。
            *   成功ログを出力します。
            *   `true` を返します。
        6.  エラーが発生した場合:
            *   `_handleError` メソッドを呼び出してエラー処理を行います。
            *   `errorHandler` がない場合、または `errorHandler` が値を返さない場合は `false` を返します。
    *   **戻り値:** `Promise<boolean>` - 同期に成功したかどうか。エラーハンドラーの挙動によっては、失敗時も `false` 以外の値が返る可能性があります。
    *   **スローされるエラー:** `CliError`, `ApplicationError` - 同期処理中にエラーが発生した場合（`errorHandler` がない場合など）。
    *   **イベント:** `cli:sync_before`, `cli:sync_after`

## 4. 発行されるイベント

`CliComponentSyncer` は、`syncComponents` メソッドの実行中に以下の標準化イベントを発行します。

*   **`cli:sync_before`:** 同期処理開始前に発行されます。
*   **`cli:sync_after`:** 同期処理成功後に発行されます。データには `{ success: true }` が含まれます。
*   **`app:error`:** 同期処理中にエラーが発生した場合に `_handleError` メソッド経由で発行されます。

## 5. 注意点とベストプラクティス

*   **アダプターへの依存:** 具体的な同期処理の内容は `IntegrationManagerAdapter` の `syncComponents` メソッドの実装に依存します。
*   **戻り値:** `syncComponents` メソッドは成功時に `true` を返しますが、エラー発生時に `errorHandler` が設定されている場合、そのハンドラーの戻り値が返されるか、`false` が返される可能性があります。エラーハンドラーがない場合は例外がスローされます。
*   **エラーハンドリング:** `_handleError` メソッドでエラー処理を集約しています。`errorHandler` オプションを提供することで、エラー発生時の挙動をカスタマイズできます。