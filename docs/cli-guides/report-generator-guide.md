# CliReportGenerator 利用ガイド (`src/cli/report-generator.js`)

## 1. 目的

`CliReportGenerator` は、CLIにおける各種レポートの生成を担当するクラスです。`IntegrationManagerAdapter` を通じてレポート内容を取得し、必要に応じて `StorageService` を使用してファイルに保存します。

## 2. コンストラクタ (`new CliReportGenerator(options)`)

*   **`options`** (Object): 設定オプション。
    *   **`logger` (Object): 必須。** Logger インスタンス。
    *   **`eventEmitter` (Object): 必須。** EventEmitter インスタンス。
    *   **`integrationManagerAdapter` (Object): 必須。** `IntegrationManagerAdapter` インスタンス。レポート生成処理の実体を提供します。
    *   **`storageService` (Object): 必須。** `StorageService` インスタンス。レポートのファイル保存に使用します。
    *   **`errorHandler` (Object):** オプション。エラーハンドラー。
    *   **`traceIdGenerator` (Function): 必須。** トレースID生成関数。
    *   **`requestIdGenerator` (Function): 必須。** リクエストID生成関数。

*   **初期化:** コンストラクタは、渡された依存関係をインスタンス変数に格納します。必須の依存関係が不足している場合は `ApplicationError` をスローします。

## 3. 主要メソッド

*   **`generateReport(reportType, reportOptions = {})`:**
    *   指定された `reportType` と `reportOptions` に基づいてレポートを生成します。`integrationManagerAdapter.generateReport` を呼び出し、結果を処理します。`outputPath` が指定されている場合は、`storageService.writeText` でファイルに保存します。
    *   **機能:**
        1.  `cli:report_generate_before` イベントを発行します。
        2.  レポート生成開始のログを出力します。
        3.  `integrationManagerAdapter.generateReport` を呼び出します（`format`, `noCache` オプションを渡します）。
        4.  アダプターからの戻り値を検証します。
            *   結果に `error` プロパティが含まれる場合は `ApplicationError` (コード: `ERR_REPORT_GENERATE`) をスローします。
            *   結果が文字列でない場合は `ApplicationError` (コード: `ERR_REPORT_GENERATE_UNEXPECTED`) をスローします。
        5.  `outputPath` が指定されている場合:
            *   `storageService.writeText` でレポート内容をファイルに書き込みます。
            *   書き込みに失敗した場合は `StorageError` (コード: `ERR_CLI_FILE_WRITE`) をスローします。
            *   成功ログを出力し、ファイルパスを返します。
        6.  `outputPath` が指定されていない場合:
            *   成功ログを出力し、レポート内容（文字列）を返します。
        7.  成功した場合、`cli:report_generate_after` イベントを発行します。
        8.  エラーが発生した場合、`_handleError` メソッドを呼び出してエラー処理を行います。
    *   **引数:**
        *   `reportType` (string): 生成するレポートのタイプ (例: `'task_summary'`, `'workflow_status'`)。
        *   `reportOptions` (Object): オプション。`output` (出力パス), `format` (出力形式、デフォルト 'text'), `noCache` (キャッシュ無視フラグ、デフォルト false) を含めることができます。
    *   **戻り値:** `Promise<string>` - `outputPath` が指定されていればファイルパス、そうでなければレポート内容の文字列。
    *   **スローされるエラー:** `CliError`, `ApplicationError`, `StorageError` - レポート生成またはファイル書き込みに失敗した場合。
    *   **イベント:** `cli:report_generate_before`, `cli:report_generate_after`

## 4. 発行されるイベント

`CliReportGenerator` は、`generateReport` メソッドの実行中に以下の標準化イベントを発行します。

*   **`cli:report_generate_before`:** レポート生成開始前に発行されます。データには `{ reportType, format, outputPath, noCache }` が含まれます。
*   **`cli:report_generate_after`:** レポート生成成功後に発行されます。データには `{ reportType, format, outputPath, reportLength }` が含まれます (`outputPath` はファイル保存した場合のみ設定)。
*   **`app:error`:** レポート生成またはファイル書き込み中にエラーが発生した場合に `_handleError` メソッド経由で発行されます。

## 5. 注意点とベストプラクティス

*   **アダプターへの依存:** レポートの具体的な生成ロジックは `IntegrationManagerAdapter` に依存します。
*   **ファイル保存:** `outputPath` オプションを指定すると、生成されたレポートが指定されたパスにテキストファイルとして保存されます。保存処理は `StorageService` が担当します。
*   **エラーハンドリング:** `_handleError` メソッドでエラー処理を集約しています。`errorHandler` オプションを提供することで、エラー発生時の挙動をカスタマイズできます。