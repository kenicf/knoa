# CliWorkflowManager 利用ガイド (`src/cli/workflow-manager.js`)

## 1. 目的

`CliWorkflowManager` は、CLIにおけるワークフロー全体の初期化プロセスを担当するクラスです。`init` コマンドが実行された際に、`IntegrationManagerAdapter` を通じてワークフローの初期化処理を呼び出します。

## 2. コンストラクタ (`new CliWorkflowManager(options)`)

*   **`options`** (Object): 設定オプション。
    *   **`logger` (Object): 必須。** Logger インスタンス。
    *   **`eventEmitter` (Object): 必須。** EventEmitter インスタンス。
    *   **`integrationManagerAdapter` (Object): 必須。** `IntegrationManagerAdapter` インスタンス。ワークフロー初期化処理の実体を提供します。
    *   **`stateManagerAdapter` (Object): 必須。** `StateManagerAdapter` インスタンス。（注: 現在の実装では `initializeWorkflow` 内で直接使用されていませんが、将来的な状態遷移管理のために依存関係として含まれている可能性があります。）
    *   **`errorHandler` (Object):** オプション。エラーハンドラー。
    *   **`traceIdGenerator` (Function): 必須。** トレースID生成関数。
    *   **`requestIdGenerator` (Function): 必須。** リクエストID生成関数。

*   **初期化:** コンストラクタは、渡された依存関係をインスタンス変数に格納します。必須の依存関係が不足している場合は `ApplicationError` をスローします。

## 3. 主要メソッド

*   **`initializeWorkflow(projectId, request)`:**
    *   指定された `projectId` と `request` を使用して、`integrationManagerAdapter` の `initializeWorkflow` メソッドを呼び出し、ワークフローを初期化します。
    *   **機能:**
        1.  `cli:workflow_init_before` イベントを発行します。
        2.  初期化開始のログを出力します。
        3.  `integrationManagerAdapter.initializeWorkflow` を呼び出します。
        4.  アダプターからの戻り値を検証します。
            *   結果に `error` プロパティが含まれる場合は `ApplicationError` (コード: `ERR_WORKFLOW_INIT`) をスローします。
            *   結果が期待される形式（`project` プロパティを持つオブジェクト）でない場合は `ApplicationError` (コード: `ERR_WORKFLOW_INIT_UNEXPECTED`) をスローします。
        5.  成功した場合:
            *   `cli:workflow_init_after` イベントを発行します（結果データを含む）。
            *   成功ログを出力します。
            *   アダプターからの結果を返します。
        6.  エラーが発生した場合:
            *   `_handleError` メソッドを呼び出してエラー処理を行います（エラーイベント発行、`errorHandler` 呼び出し、またはエラー再スロー）。
    *   **引数:**
        *   `projectId` (string): プロジェクトID。
        *   `request` (string): 元のリクエスト。
    *   **戻り値:** `Promise<object>` - 初期化結果オブジェクト。
    *   **スローされるエラー:** `CliError`, `ApplicationError` - 初期化処理中にエラーが発生した場合。

## 4. 発行されるイベント

`CliWorkflowManager` は、`initializeWorkflow` メソッドの実行中に以下の標準化イベントを発行します。

*   **`cli:workflow_init_before`:** ワークフロー初期化開始前に発行されます。データには `{ projectId, request }` が含まれます。
*   **`cli:workflow_init_after`:** ワークフロー初期化成功後に発行されます。データには `{ projectId, request, result }` が含まれます。
*   **`app:error`:** 初期化処理中にエラーが発生した場合に `_handleError` メソッド経由で発行されます。

## 5. 注意点とベストプラクティス

*   **依存アダプター:** このクラスの主要なロジックは `IntegrationManagerAdapter` に依存しています。実際の初期化処理の内容はアダプターの実装を確認してください。
*   **状態管理:** コンストラクタで `StateManagerAdapter` を受け取りますが、現在の `initializeWorkflow` メソッドでは直接使用されていません。将来的に初期化に伴う状態遷移が追加される可能性があります。
*   **エラー処理:** `_handleError` メソッドでエラー処理を集約しています。`errorHandler` オプションを提供することで、エラー発生時の挙動をカスタマイズできます。