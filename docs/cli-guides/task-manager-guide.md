# CliTaskManager 利用ガイド (`src/cli/task-manager.js`)

## 1. 目的

`CliTaskManager` は、CLIにおけるタスク関連の操作（作成、更新、一覧取得、情報取得、進捗更新、削除、コミットへの関連付け、エクスポート、インポート）を管理するクラスです。`IntegrationManagerAdapter`, `TaskManagerAdapter`, `StorageService`, `Validator` と連携して、タスクに関する一連の操作を実行します。

## 2. コンストラクタ (`new CliTaskManager(options)`)

*   **`options`** (Object): 設定オプション。
    *   **`logger` (Object): 必須。** Logger インスタンス。
    *   **`eventEmitter` (Object): 必須。** EventEmitter インスタンス。
    *   **`integrationManagerAdapter` (Object): 必須。** `IntegrationManagerAdapter` インスタンス。タスク作成・更新処理の実体を提供します。
    *   **`taskManagerAdapter` (Object): 必須。** `TaskManagerAdapter` インスタンス。タスク情報の取得や永続化を担当します。
    *   **`storageService` (Object): 必須。** `StorageService` インスタンス。タスクのエクスポート/インポートに使用します。
    *   **`validator` (Object): 必須。** `Validator` インスタンス。タスクデータのバリデーションに使用します。
    *   **`errorHandler` (Object):** オプション。エラーハンドラー。
    *   **`traceIdGenerator` (Function): 必須。** トレースID生成関数。
    *   **`requestIdGenerator` (Function): 必須。** リクエストID生成関数。

*   **初期化:** コンストラクタは、渡された依存関係をインスタンス変数に格納します。必須の依存関係が不足している場合は `ApplicationError` をスローします。

## 3. 主要メソッド

*   **`createTask(title, description, taskOptions = {})`:**
    *   新しいタスクを作成します。入力データを `validator.validateTaskInput` で検証後、`integrationManagerAdapter.createTask` を呼び出します。
    *   引数:
        *   `title` (string): タスクタイトル。
        *   `description` (string): タスク説明。
        *   `taskOptions` (Object): オプション。`status`, `priority`, `estimatedHours`, `dependencies` (カンマ区切り文字列または配列) を含めることができます。
    *   戻り値: `Promise<object>` - 作成されたタスク情報。
    *   スローされるエラー: `CliError`, `ValidationError` - バリデーションエラーまたはタスク作成に失敗した場合。
    *   イベント: `cli:task_create_before`, `cli:task_create_after`
*   **`updateTask(taskId, status, progress)`:**
    *   指定されたタスクの状態と進捗率を更新します。入力値を検証後、`integrationManagerAdapter.updateTaskStatus` を呼び出します。
    *   引数:
        *   `taskId` (string): タスクID。
        *   `status` (string): 新しい状態 (`'pending'`, `'in_progress'`, `'completed'`, `'blocked'`)。
        *   `progress` (number|undefined): 進捗率 (0-100)。
    *   戻り値: `Promise<object>` - 更新されたタスク情報。
    *   スローされるエラー: `CliError`, `ValidationError` - バリデーションエラーまたは更新に失敗した場合。
    *   イベント: `cli:task_update_before`, `cli:task_update_after`
*   **`listTasks()`:**
    *   すべてのタスク情報の一覧を取得します。`taskManagerAdapter.getAllTasks` を呼び出します。
    *   戻り値: `Promise<object>` - タスク一覧データ (`{ decomposed_tasks: Array<object> }` 形式)。エラー時は `{ decomposed_tasks: [] }` を返すことがあります（`errorHandler` の実装による）。
    *   スローされるエラー: `CliError` - 取得に失敗した場合（`errorHandler` がない場合）。
    *   イベント: `cli:task_list_before`, `cli:task_list_after`
*   **`getTaskInfo(taskId)`:**
    *   指定された `taskId` のタスク情報を取得します。`taskManagerAdapter.getTaskById` を呼び出します。
    *   引数: `taskId` (string) - 取得するタスクID。
    *   戻り値: `Promise<object>` - タスク情報。
    *   スローされるエラー: `CliError`, `NotFoundError` - 取得に失敗した場合、またはタスクが見つからない場合。
    *   イベント: `cli:task_info_get_before`, `cli:task_info_get_after`
*   **`updateTaskProgress(taskId, progress)`:**
    *   指定されたタスクの進捗率を更新します。入力値を検証後、`taskManagerAdapter.updateTaskProgress` を呼び出します。進捗率に応じて内部的に状態 (`progressState`) も決定されます。
    *   引数:
        *   `taskId` (string): タスクID。
        *   `progress` (number): 進捗率 (0-100)。
    *   戻り値: `Promise<object>` - 更新されたタスク情報。
    *   スローされるエラー: `CliError`, `ValidationError` - バリデーションエラーまたは更新に失敗した場合。
    *   イベント: `cli:task_progress_update_before`, `cli:task_progress_update_after`
*   **`deleteTask(taskId)`:**
    *   指定された `taskId` のタスクを削除します。`taskManagerAdapter.deleteTask` を呼び出します。
    *   引数: `taskId` (string) - 削除するタスクID。
    *   戻り値: `Promise<boolean>` - 削除に成功したかどうか。アダプターが `false` を返した場合やエラー時は `false` を返すことがあります（`errorHandler` の実装による）。
    *   スローされるエラー: `CliError` - 削除に失敗した場合（`errorHandler` がない場合、またはアダプターが `false` を返した場合）。
    *   イベント: `cli:task_delete_before`, `cli:task_delete_after`
*   **`linkTaskToCommit(taskId, commitHash)`:**
    *   指定されたタスクにGitコミットハッシュを関連付けます。`taskManagerAdapter.addGitCommitToTask` を呼び出します。
    *   引数:
        *   `taskId` (string): タスクID。
        *   `commitHash` (string): コミットハッシュ。
    *   戻り値: `Promise<object>` - 更新されたタスク情報。
    *   スローされるエラー: `CliError`, `NotFoundError` - 関連付けに失敗した場合、またはタスクが見つからない場合。
    *   イベント: `cli:task_link_commit_before`, `cli:task_link_commit_after`
*   **`exportTask(taskId, outputPath = null)`:**
    *   指定された `taskId` のタスク情報を取得し、JSON ファイルとしてエクスポートします。`taskManagerAdapter.getTaskById` と `storageService.writeJSON` を使用します。
    *   引数:
        *   `taskId` (string) - エクスポートするタスクID。
        *   `outputPath` (string|null) - オプション。出力ファイルパス。指定しない場合は `task-<taskId>-export.json` という名前でカレントディレクトリに保存されます。
    *   戻り値: `Promise<string>` - エクスポートされたファイルパス。
    *   スローされるエラー: `CliError`, `NotFoundError`, `StorageError` - タスク取得またはファイル書き込みに失敗した場合。
    *   イベント: `cli:task_export_before`, `cli:task_export_after`
*   **`importTask(inputPath)`:**
    *   指定された `inputPath` の JSON ファイルからタスク情報をインポートします。`storageService.readJSON` で読み込み、`validator.validateTaskInput` で検証後、`taskManagerAdapter.importTask` を呼び出します。
    *   引数: `inputPath` (string) - インポートするファイルパス。
    *   戻り値: `Promise<object>` - インポートされたタスク情報。
    *   スローされるエラー: `CliError`, `StorageError`, `ValidationError` - ファイル読み込み、パース、バリデーション、またはインポート処理に失敗した場合。
    *   イベント: `cli:task_import_before`, `cli:task_import_after`

## 4. 発行されるイベント

`CliTaskManager` は、各メソッドの実行中に以下の標準化イベントを発行します。

*   **`cli:task_create_before`**, **`cli:task_create_after`**
*   **`cli:task_update_before`**, **`cli:task_update_after`**
*   **`cli:task_list_before`**, **`cli:task_list_after`**
*   **`cli:task_info_get_before`**, **`cli:task_info_get_after`**
*   **`cli:task_progress_update_before`**, **`cli:task_progress_update_after`**
*   **`cli:task_delete_before`**, **`cli:task_delete_after`**
*   **`cli:task_link_commit_before`**, **`cli:task_link_commit_after`**
*   **`cli:task_export_before`**, **`cli:task_export_after`**
*   **`cli:task_import_before`**, **`cli:task_import_after`**
*   **`app:error`:** 各操作中にエラーが発生した場合に `_handleError` メソッド経由で発行されます。

## 5. 注意点とベストプラクティス

*   **アダプターへの依存:** タスクの具体的な作成・更新ロジックは `IntegrationManagerAdapter` に、データの永続化や取得ロジックは `TaskManagerAdapter` に依存します。
*   **バリデーション:** `createTask` と `importTask` では、`Validator` を使用して入力データの妥当性を検証します。`updateTask` と `updateTaskProgress` でも、状態や進捗率の値の基本的な検証を行います。
*   **エラーハンドリング:** `_handleError` メソッドでエラー処理を集約しています。`errorHandler` オプションを提供することで、エラー発生時の挙動をカスタマイズできます。