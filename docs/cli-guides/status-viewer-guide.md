# CliStatusViewer 利用ガイド (`src/cli/status-viewer.js`)

## 1. 目的

`CliStatusViewer` は、CLIにおける現在のワークフロー状態（全体の状態、タスク統計、現在のセッション情報など）を取得し、整形して提供するクラスです。`StateManagerAdapter`, `TaskManagerAdapter`, `SessionManagerAdapter` から情報を収集します。

## 2. コンストラクタ (`new CliStatusViewer(options)`)

*   **`options`** (Object): 設定オプション。
    *   **`logger` (Object): 必須。** Logger インスタンス。
    *   **`eventEmitter` (Object): 必須。** EventEmitter インスタンス。
    *   **`stateManagerAdapter` (Object): 必須。** `StateManagerAdapter` インスタンス。現在のワークフロー状態を取得します。
    *   **`taskManagerAdapter` (Object): 必須。** `TaskManagerAdapter` インスタンス。タスク情報を取得します。
    *   **`sessionManagerAdapter` (Object): 必須。** `SessionManagerAdapter` インスタンス。現在のセッション情報を取得します。
    *   **`errorHandler` (Object):** オプション。エラーハンドラー。
    *   **`traceIdGenerator` (Function): 必須。** トレースID生成関数。
    *   **`requestIdGenerator` (Function): 必須。** リクエストID生成関数。

*   **初期化:** コンストラクタは、渡された依存関係をインスタンス変数に格納します。必須の依存関係が不足している場合は `ApplicationError` をスローします。

## 3. 主要メソッド

*   **`getWorkflowStatus()`:**
    *   現在のワークフローの状態、タスク統計、および現在のセッション情報を取得し、整形されたオブジェクトとして返します。
    *   **機能:**
        1.  `cli:status_get_before` イベントを発行します。
        2.  状態取得開始のログを出力します。
        3.  `stateManagerAdapter.getCurrentState()` を呼び出して現在の状態を取得します。
        4.  `taskManagerAdapter.getAllTasks()` を呼び出して全タスク情報を取得します。
        5.  `sessionManagerAdapter.getLatestSession()` を呼び出して最新のセッション情報を取得します。
        6.  取得した情報から、タスクの総数、状態別カウント、フォーカス中のタスク情報、現在のセッション情報を計算・整形します（内部ヘルパー `_calculateTaskStatusCounts`, `_findFocusTask` を使用）。
        7.  整形した `statusInfo` オブジェクトを作成します。
        8.  成功した場合:
            *   `cli:status_get_after` イベントを発行します（`statusInfo` を含む）。
            *   成功ログを出力します。
            *   `statusInfo` オブジェクトを返します。
        9.  いずれかのアダプター呼び出しでエラーが発生した場合:
            *   `_handleError` メソッドを呼び出してエラー処理を行います。
            *   `errorHandler` がない場合、または `errorHandler` が値を返さない場合は、`{ error: errorMessage }` 形式のオブジェクトを返します。
    *   **戻り値:** `Promise<object>` - ワークフロー状態情報オブジェクト。エラー発生時は `{ error: string }` 形式のオブジェクトを返すことがあります。
    *   **スローされるエラー:** `CliError` - エラーハンドラーがない場合にアダプター呼び出しでエラーが発生した場合。
    *   **イベント:** `cli:status_get_before`, `cli:status_get_after`

## 4. 発行されるイベント

`CliStatusViewer` は、`getWorkflowStatus` メソッドの実行中に以下の標準化イベントを発行します。

*   **`cli:status_get_before`:** 状態取得開始前に発行されます。
*   **`cli:status_get_after`:** 状態取得成功後に発行されます。データには `{ statusInfo }` が含まれます。
*   **`app:error`:** 状態取得中にエラーが発生した場合に `_handleError` メソッド経由で発行されます。

## 5. 注意点とベストプラクティス

*   **アダプターへの依存:** ワークフロー状態の各要素（状態、タスク、セッション）は、それぞれ対応するアダプター (`StateManagerAdapter`, `TaskManagerAdapter`, `SessionManagerAdapter`) から取得されます。
*   **情報集約:** このクラスは、複数のアダプターから情報を集約し、CLIでの表示に適した形式に整形する役割を担います。
*   **エラーハンドリング:** `_handleError` メソッドでエラー処理を集約しています。デフォルトでは、アダプターのエラーが発生しても例外をスローせず、`{ error: ... }` 形式のオブジェクトを返すことがあります。エラー時に例外を期待する場合は、`errorHandler` を適切に設定する必要があります。