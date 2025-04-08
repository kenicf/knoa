# CliSessionManager 利用ガイド (`src/cli/session-manager.js`)

## 1. 目的

`CliSessionManager` は、CLIにおける開発セッションのライフサイクル（開始、終了、一覧表示、情報取得、エクスポート、インポート）を管理するクラスです。`IntegrationManagerAdapter` や `SessionManagerAdapter`、`StorageService` と連携して、セッション関連の操作を実行します。

## 2. コンストラクタ (`new CliSessionManager(options)`)

*   **`options`** (Object): 設定オプション。
    *   **`logger` (Object): 必須。** Logger インスタンス。
    *   **`eventEmitter` (Object): 必須。** EventEmitter インスタンス。
    *   **`integrationManagerAdapter` (Object): 必須。** `IntegrationManagerAdapter` インスタンス。セッションの開始・終了処理の実体を提供します。
    *   **`sessionManagerAdapter` (Object): 必須。** `SessionManagerAdapter` インスタンス。セッション情報の取得や永続化を担当します。
    *   **`storageService` (Object): 必須。** `StorageService` インスタンス。引継ぎドキュメントの保存やセッションのエクスポート/インポートに使用します。
    *   **`errorHandler` (Object):** オプション。エラーハンドラー。
    *   **`traceIdGenerator` (Function): 必須。** トレースID生成関数。
    *   **`requestIdGenerator` (Function): 必須。** リクエストID生成関数。

*   **初期化:** コンストラクタは、渡された依存関係をインスタンス変数に格納します。必須の依存関係が不足している場合は `ApplicationError` をスローします。

## 3. 主要メソッド

*   **`startSession(previousSessionId = null)`:**
    *   新しいセッションを開始します。`integrationManagerAdapter.startSession` を呼び出します。
    *   引数: `previousSessionId` (string|null) - オプション。前回のセッションID。
    *   戻り値: `Promise<object>` - 開始されたセッション情報。
    *   スローされるエラー: `CliError` - セッション開始に失敗した場合。
    *   イベント: `cli:session_start_before`, `cli:session_start_after`
*   **`endSession(sessionId = null)`:**
    *   指定されたセッション（`sessionId` が null の場合は最新のアクティブセッション）を終了します。`integrationManagerAdapter.endSession` を呼び出します。
    *   終了後、`result.handover_document` があれば、`ai-context/sessions/session-handover.md` に保存します（保存失敗時はエラーログを出力しますが、処理は続行します）。
    *   引数: `sessionId` (string|null) - オプション。終了するセッションID。
    *   戻り値: `Promise<object>` - 終了されたセッション情報。
    *   スローされるエラー: `CliError`, `NotFoundError` - セッション終了または引継ぎドキュメント保存に失敗した場合、または終了対象のセッションが見つからない場合。
    *   イベント: `cli:session_end_before`, `cli:session_end_after`
*   **`listSessions()`:**
    *   すべてのセッション情報の一覧を取得します。`sessionManagerAdapter.getAllSessions` を呼び出します。
    *   戻り値: `Promise<Array<object>>` - セッション情報の配列。エラー時は空配列を返すことがあります（`errorHandler` の実装による）。
    *   スローされるエラー: `CliError` - 取得に失敗した場合（`errorHandler` がない場合）。
    *   イベント: `cli:session_list_before`, `cli:session_list_after`
*   **`getCurrentSessionInfo()`:**
    *   最新のアクティブなセッション情報を取得します。`sessionManagerAdapter.getLatestSession` を呼び出します。
    *   戻り値: `Promise<object|null>` - 最新のセッション情報、またはアクティブなセッションがない場合は `null`。エラー時は `null` を返すことがあります（`errorHandler` の実装による）。
    *   スローされるエラー: `CliError` - 取得に失敗した場合（`errorHandler` がない場合）。
    *   イベント: `cli:session_current_get_before`, `cli:session_current_get_after`
*   **`getSessionInfo(sessionId)`:**
    *   指定された `sessionId` のセッション情報を取得します。`sessionManagerAdapter.getSession` を呼び出します。
    *   引数: `sessionId` (string) - 取得するセッションID。
    *   戻り値: `Promise<object>` - セッション情報。
    *   スローされるエラー: `CliError`, `NotFoundError` - 取得に失敗した場合、またはセッションが見つからない場合。
    *   イベント: `cli:session_info_get_before`, `cli:session_info_get_after`
*   **`exportSession(sessionId, outputPath = null)`:**
    *   指定された `sessionId` のセッション情報を取得し、JSON ファイルとしてエクスポートします。`sessionManagerAdapter.getSession` と `storageService.writeJSON` を使用します。
    *   引数:
        *   `sessionId` (string) - エクスポートするセッションID。
        *   `outputPath` (string|null) - オプション。出力ファイルパス。指定しない場合は `session-<sessionId>-export.json` という名前でカレントディレクトリに保存されます。
    *   戻り値: `Promise<string>` - エクスポートされたファイルパス。
    *   スローされるエラー: `CliError`, `NotFoundError`, `StorageError` - セッション取得またはファイル書き込みに失敗した場合。
    *   イベント: `cli:session_export_before`, `cli:session_export_after`
*   **`importSession(inputPath)`:**
    *   指定された `inputPath` の JSON ファイルからセッション情報をインポートします。`storageService.readJSON` と `sessionManagerAdapter.importSession` を使用します。
    *   引数: `inputPath` (string) - インポートするファイルパス。
    *   戻り値: `Promise<object>` - インポートされたセッション情報。
    *   スローされるエラー: `CliError`, `StorageError`, `ValidationError` (将来的に追加予定) - ファイル読み込み、パース、またはインポート処理に失敗した場合。
    *   イベント: `cli:session_import_before`, `cli:session_import_after`

## 4. 発行されるイベント

`CliSessionManager` は、各メソッドの実行中に以下の標準化イベントを発行します。

*   **`cli:session_start_before`**, **`cli:session_start_after`**
*   **`cli:session_end_before`**, **`cli:session_end_after`**
*   **`cli:session_list_before`**, **`cli:session_list_after`**
*   **`cli:session_current_get_before`**, **`cli:session_current_get_after`**
*   **`cli:session_info_get_before`**, **`cli:session_info_get_after`**
*   **`cli:session_export_before`**, **`cli:session_export_after`**
*   **`cli:session_import_before`**, **`cli:session_import_after`**
*   **`app:error`:** 各操作中にエラーが発生した場合に `_handleError` メソッド経由で発行されます。

## 5. 注意点とベストプラクティス

*   **アダプターへの依存:** セッションの具体的な開始・終了ロジックは `IntegrationManagerAdapter` に、データの永続化や取得ロジックは `SessionManagerAdapter` に依存します。
*   **`endSession` の挙動:** `sessionId` を省略した場合、`SessionManagerAdapter.getLatestSession` を呼び出して最新のアクティブセッションを特定します。アクティブなセッションがない場合は `NotFoundError` がスローされます。
*   **引継ぎドキュメント:** `endSession` 時に取得した引継ぎドキュメント (`handover_document`) は、`ai-context/sessions/session-handover.md` に保存されます。この保存処理でエラーが発生しても、セッション終了処理自体は続行され、エラーログが出力されるのみです。
*   **インポート時のバリデーション:** 現在の実装では、`importSession` 時に読み込んだデータのバリデーションは行われていません (TODOコメントあり)。将来的に `Validator` を使用したバリデーションが追加される可能性があります。
*   **エラーハンドリング:** `_handleError` メソッドでエラー処理を集約しています。`errorHandler` オプションを提供することで、エラー発生時の挙動（例: デフォルト値を返す、特定のエラーを無視するなど）をカスタマイズできます。