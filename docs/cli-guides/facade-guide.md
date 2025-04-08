# CliFacade 利用ガイド (`src/cli/facade.js`)

## 1. 目的

`CliFacade` は、コマンドラインインターフェース (CLI) から受け取ったコマンドを解釈し、対応する各CLIマネージャー/ハンドラークラス（`CliWorkflowManager`, `CliSessionManager`, `CliTaskManager` など）に処理を委譲するためのファサード（窓口）クラスです。コマンド実行の統一的なエントリーポイントを提供し、エラーハンドリングやイベント発行の共通処理も担当します。

## 2. コンストラクタ (`new CliFacade(options)`)

*   **`options`** (Object): 設定オプション。
    *   **`logger` (Object): 必須。** Logger インスタンス。
    *   **`eventEmitter` (Object): 必須。** EventEmitter インスタンス。
    *   **`cliWorkflowManager` (Object): 必須。** `CliWorkflowManager` インスタンス。
    *   **`cliSessionManager` (Object): 必須。** `CliSessionManager` インスタンス。
    *   **`cliTaskManager` (Object): 必須。** `CliTaskManager` インスタンス。
    *   **`cliFeedbackHandler` (Object): 必須。** `CliFeedbackHandler` インスタンス。
    *   **`cliReportGenerator` (Object): 必須。** `CliReportGenerator` インスタンス。
    *   **`cliStatusViewer` (Object): 必須。** `CliStatusViewer` インスタンス。
    *   **`cliInteractiveMode` (Object): 必須。** `CliInteractiveMode` インスタンス。
    *   **`cliComponentSyncer` (Object): 必須。** `CliComponentSyncer` インスタンス。

*   **初期化:** コンストラクタは、渡された依存関係をインスタンス変数に格納します。必須の依存関係が不足している場合は `ApplicationError` をスローします。

## 3. 主要メソッド

*   **`execute(command, args)`:**
    *   指定された `command` (文字列) と `args` (yargs でパースされたオブジェクト) に基づいて、対応する処理を実行します。
    *   **機能:**
        1.  コマンド実行開始のログを出力します。
        2.  `cli:<command>_before` イベントを発行します。
        3.  `switch` 文を使用して `command` 文字列を評価し、適切なCLIマネージャー/ハンドラーのメソッドを `args` を引数として呼び出します。
        4.  メソッド呼び出しが成功した場合:
            *   `cli:<command>_after` イベントを発行します（結果データを含む）。
            *   成功ログを出力します。
            *   メソッドの戻り値を返します。
        5.  メソッド呼び出し中にエラーが発生した場合:
            *   エラーログを出力します。
            *   エラーをラップします:
                *   `ValidationError` または `CliError` はそのまま。
                *   その他のエラーは `CliError` でラップし、元のエラーを `cause` プロパティに設定します。
            *   `emitErrorEvent` ヘルパーを使用して `app:error` イベントを発行します。
            *   ラップされたエラーを再スローします。
        6.  未知のコマンドが指定された場合は、`ERR_CLI_UNKNOWN_COMMAND` コードを持つ `CliError` をスローします。
    *   **引数:**
        *   `command` (string): 実行するコマンド名 (例: `'create-task'`, `'status'`)。
        *   `args` (Object): コマンドに渡される引数とオプションを含むオブジェクト。
    *   **戻り値:** `Promise<*>` - 実行されたメソッドの戻り値。
    *   **スローされるエラー:** `CliError`, `ValidationError` - コマンド実行中にエラーが発生した場合。

## 4. 発行されるイベント

`CliFacade` は、`execute` メソッドの実行中に以下の標準化イベントを発行します。

*   **`cli:<command>_before`:** 各コマンドの実行前に発行されます。データには `{ args }` が含まれます。
*   **`cli:<command>_after`:** 各コマンドの実行成功後に発行されます。データには `{ args, result }` が含まれます。
*   **`app:error`:** コマンド実行中にエラーが発生した場合に `emitErrorEvent` ヘルパー経由で発行されます。データにはエラーの詳細が含まれます ([エラーハンドリング利用ガイド](../utility-guides/error-handling-guide.md) 参照)。

## 5. 注意点とベストプラクティス

*   **コマンドの追加:** 新しいCLIコマンドを追加する場合は、`execute` メソッド内の `switch` 文に対応する `case` を追加し、適切なマネージャー/ハンドラーのメソッド呼び出しを実装する必要があります。
*   **エラーハンドリング:** `execute` メソッドは、下位のマネージャー/ハンドラーからスローされたエラーを捕捉し、`CliError` でラップ（または `ValidationError`/`CliError` はそのまま）して再スローします。最終的なエラー処理は、`CliFacade` の呼び出し元（例: `src/cli/integration.js` の `runCommand`）で行われます。
*   **依存関係:** `CliFacade` は多くのCLIコンポーネントに依存しています。これらのコンポーネントが正しくインスタンス化され、コンストラクタに渡されることが重要です。通常、これは `src/cli/bootstrap.js` で処理されます。
*   **インタラクティブモード:** `interactive` コマンドが実行されると、`CliInteractiveMode` の `start` メソッドが呼び出されます。`CliInteractiveMode` は内部で `CliFacade` を参照して、ユーザーが入力したコマンドを実行します。