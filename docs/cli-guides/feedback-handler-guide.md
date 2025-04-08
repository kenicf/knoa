# CliFeedbackHandler 利用ガイド (`src/cli/feedback-handler.js`)

## 1. 目的

`CliFeedbackHandler` は、CLIにおけるフィードバックループ関連の操作（収集、解決、状態取得、再オープン、レポート生成、優先順位付け、関連付け、統合）を管理するクラスです。`IntegrationManagerAdapter`, `FeedbackManagerAdapter`, `StorageService`, `Validator` と連携して、フィードバックに関する一連の操作を実行します。

## 2. コンストラクタ (`new CliFeedbackHandler(options)`)

*   **`options`** (Object): 設定オプション。
    *   **`logger` (Object): 必須。** Logger インスタンス。
    *   **`eventEmitter` (Object): 必須。** EventEmitter インスタンス。
    *   **`integrationManagerAdapter` (Object): 必須。** `IntegrationManagerAdapter` インスタンス。フィードバックの収集・解決処理の実体を提供します。
    *   **`feedbackManagerAdapter` (Object): 必須。** `FeedbackManagerAdapter` インスタンス。フィードバック情報の取得、状態更新、レポート生成などを担当します。
    *   **`storageService` (Object): 必須。** `StorageService` インスタンス。フィードバックレポートの保存に使用します。
    *   **`validator` (Object): 必須。** `Validator` インスタンス。フィードバックデータのバリデーションに使用します。
    *   **`errorHandler` (Object):** オプション。エラーハンドラー。
    *   **`traceIdGenerator` (Function): 必須。** トレースID生成関数。
    *   **`requestIdGenerator` (Function): 必須。** リクエストID生成関数。

*   **初期化:** コンストラクタは、渡された依存関係をインスタンス変数に格納します。必須の依存関係が不足している場合は `ApplicationError` をスローします。

## 3. 主要メソッド

*   **`collectFeedback(taskId, testCommand)`:**
    *   指定されたタスクIDとテストコマンドに基づいてフィードバックを収集します。`integrationManagerAdapter.collectFeedback` を呼び出し、結果を `validator.validateFeedbackInput` で検証します。
    *   引数:
        *   `taskId` (string): タスクID。
        *   `testCommand` (string): 実行するテストコマンド。
    *   戻り値: `Promise<object>` - 生成されたフィードバック情報。
    *   スローされるエラー: `CliError`, `ValidationError` - 収集またはバリデーションに失敗した場合。
    *   イベント: `cli:feedback_collect_before`, `cli:feedback_collect_after`
*   **`resolveFeedback(feedbackId)`:**
    *   指定されたフィードバックID（通常はタスクID）のフィードバックを解決済みにします。`integrationManagerAdapter.resolveFeedback` を呼び出します。
    *   引数: `feedbackId` (string): フィードバックID。
    *   戻り値: `Promise<object>` - 更新されたフィードバック情報。
    *   スローされるエラー: `CliError` - 解決に失敗した場合。
    *   イベント: `cli:feedback_resolve_before`, `cli:feedback_resolve_after`
*   **`getFeedbackStatus(taskId)`:**
    *   指定されたタスクIDに対応するフィードバックの状態を取得します。`feedbackManagerAdapter.getFeedbackByTaskId` を呼び出します。
    *   引数: `taskId` (string): タスクID。
    *   戻り値: `Promise<object>` - フィードバック情報。
    *   スローされるエラー: `CliError`, `NotFoundError` - 取得に失敗した場合、またはフィードバックが見つからない場合。
    *   イベント: `cli:feedback_status_get_before`, `cli:feedback_status_get_after`
*   **`reopenFeedback(taskId)`:**
    *   指定されたタスクIDのフィードバックを再オープン（状態を 'open' に更新）します。`feedbackManagerAdapter.getFeedbackByTaskId` で取得後、`feedbackManagerAdapter.updateFeedbackStatus` を呼び出します。
    *   引数: `taskId` (string): タスクID。
    *   戻り値: `Promise<object>` - 更新されたフィードバック情報。
    *   スローされるエラー: `CliError`, `NotFoundError` - 更新に失敗した場合、またはフィードバックが見つからない場合。
    *   イベント: `cli:feedback_reopen_before`, `cli:feedback_reopen_after`
*   **`generateFeedbackReport(taskId, outputPath = null)`:**
    *   指定されたタスクIDのフィードバックレポート（Markdown形式）を生成します。`feedbackManagerAdapter.generateFeedbackMarkdown` を呼び出し、`outputPath` が指定されていれば `storageService.writeText` でファイルに保存します。
    *   引数:
        *   `taskId` (string): タスクID。
        *   `outputPath` (string|null): オプション。出力ファイルパス。指定しない場合はレポート内容を文字列として返します。
    *   戻り値: `Promise<string>` - 生成されたレポート内容、または保存されたファイルパス。
    *   スローされるエラー: `CliError`, `StorageError` - レポート生成またはファイル書き込みに失敗した場合。
    *   イベント: `cli:feedback_report_generate_before`, `cli:feedback_report_generate_after`
*   **`prioritizeFeedback(taskId)`:**
    *   指定されたタスクIDのフィードバックの優先順位付けを行います。`feedbackManagerAdapter.getFeedbackByTaskId` で取得後、`feedbackManagerAdapter.prioritizeFeedback` を呼び出します。
    *   引数: `taskId` (string): タスクID。
    *   戻り値: `Promise<object>` - 更新されたフィードバック情報。
    *   スローされるエラー: `CliError`, `NotFoundError` - 優先順位付けに失敗した場合、またはフィードバックが見つからない場合。
    *   イベント: `cli:feedback_prioritize_before`, `cli:feedback_prioritize_after`
*   **`linkFeedbackToCommit(taskId, commitHash)`:**
    *   指定されたタスクIDのフィードバックにGitコミットハッシュを関連付けます。`feedbackManagerAdapter.getFeedbackByTaskId` で取得後、`feedbackManagerAdapter.linkFeedbackToGitCommit` を呼び出します。
    *   引数:
        *   `taskId` (string): タスクID。
        *   `commitHash` (string): コミットハッシュ。
    *   戻り値: `Promise<void>`
    *   スローされるエラー: `CliError`, `NotFoundError` - 関連付けに失敗した場合、またはフィードバックが見つからない場合。
    *   イベント: `cli:feedback_link_commit_before`, `cli:feedback_link_commit_after`
*   **`linkFeedbackToSession(taskId, sessionId)`:**
    *   指定されたタスクIDのフィードバックにセッションIDを関連付けます。`feedbackManagerAdapter.getFeedbackByTaskId` で取得後、`feedbackManagerAdapter.linkFeedbackToSession` を呼び出します。
    *   引数:
        *   `taskId` (string): タスクID。
        *   `sessionId` (string): セッションID。
    *   戻り値: `Promise<void>`
    *   スローされるエラー: `CliError`, `NotFoundError` - 関連付けに失敗した場合、またはフィードバックが見つからない場合。
    *   イベント: `cli:feedback_link_session_before`, `cli:feedback_link_session_after`
*   **`integrateFeedbackWithTask(taskId)`:**
    *   指定されたタスクIDのフィードバックをタスクに統合します。`feedbackManagerAdapter.integrateFeedbackWithTask` を呼び出します。
    *   引数: `taskId` (string): タスクID。
    *   戻り値: `Promise<boolean>` - 統合に成功したかどうか。アダプターが `false` を返した場合やエラー時は `false` を返すことがあります（`errorHandler` の実装による）。
    *   スローされるエラー: `CliError` - 統合に失敗した場合（`errorHandler` がない場合、またはアダプターが `false` を返した場合）。
    *   イベント: `cli:feedback_integrate_task_before`, `cli:feedback_integrate_task_after`
*   **`integrateFeedbackWithSession(taskId, sessionId)`:**
    *   指定されたタスクIDのフィードバックをセッションに統合します。`feedbackManagerAdapter.integrateFeedbackWithSession` を呼び出します。
    *   引数:
        *   `taskId` (string): タスクID。
        *   `sessionId` (string): セッションID。
    *   戻り値: `Promise<boolean>` - 統合に成功したかどうか。アダプターが `false` を返した場合やエラー時は `false` を返すことがあります（`errorHandler` の実装による）。
    *   スローされるエラー: `CliError` - 統合に失敗した場合（`errorHandler` がない場合、またはアダプターが `false` を返した場合）。
    *   イベント: `cli:feedback_integrate_session_before`, `cli:feedback_integrate_session_after`

## 4. 発行されるイベント

`CliFeedbackHandler` は、各メソッドの実行中に以下の標準化イベントを発行します。

*   **`cli:feedback_collect_before`**, **`cli:feedback_collect_after`**
*   **`cli:feedback_resolve_before`**, **`cli:feedback_resolve_after`**
*   **`cli:feedback_status_get_before`**, **`cli:feedback_status_get_after`**
*   **`cli:feedback_reopen_before`**, **`cli:feedback_reopen_after`**
*   **`cli:feedback_report_generate_before`**, **`cli:feedback_report_generate_after`**
*   **`cli:feedback_prioritize_before`**, **`cli:feedback_prioritize_after`**
*   **`cli:feedback_link_commit_before`**, **`cli:feedback_link_commit_after`**
*   **`cli:feedback_link_session_before`**, **`cli:feedback_link_session_after`**
*   **`cli:feedback_integrate_task_before`**, **`cli:feedback_integrate_task_after`**
*   **`cli:feedback_integrate_session_before`**, **`cli:feedback_integrate_session_after`**
*   **`app:error`:** 各操作中にエラーが発生した場合に `_handleError` メソッド経由で発行されます。

## 5. 注意点とベストプラクティス

*   **アダプターへの依存:** フィードバックの具体的な収集・解決ロジックは `IntegrationManagerAdapter` に、データの永続化、取得、レポート生成などは `FeedbackManagerAdapter` に依存します。
*   **バリデーション:** `collectFeedback` メソッドでは、収集したフィードバックデータに対して `validator.validateFeedbackInput` を使用してバリデーションを行います。
*   **レポート保存:** `generateFeedbackReport` で `outputPath` を指定した場合、レポートは `StorageService` を介してファイルシステムに保存されます。
*   **エラーハンドリング:** `_handleError` メソッドでエラー処理を集約しています。`errorHandler` オプションを提供することで、エラー発生時の挙動をカスタマイズできます。