# CliInteractiveMode 利用ガイド (`src/cli/interactive-mode.js`)

## 1. 目的

`CliInteractiveMode` は、ユーザーがコマンドを対話的に入力し、実行結果を確認できるインターフェースを提供します。Node.js の `readline` モジュールを使用してユーザー入力を受け付け、入力されたコマンドを解析して `CliFacade` に処理を委譲します。

## 2. コンストラクタ (`new CliInteractiveMode(options)`)

*   **`options`** (Object): 設定オプション。
    *   **`logger` (Object): 必須。** Logger インスタンス。
    *   **`eventEmitter` (Object): 必須。** EventEmitter インスタンス。
    *   **`cliFacade` (Object): 必須。** `CliFacade` インスタンス。ユーザーが入力したコマンドの実行を担当します。
    *   **`errorHandler` (Object):** オプション。エラーハンドラー。主に `readline` インターフェース自体のエラー処理に使用されます。
    *   **`traceIdGenerator` (Function): 必須。** トレースID生成関数。
    *   **`requestIdGenerator` (Function): 必須。** リクエストID生成関数。

*   **初期化:** コンストラクタは、渡された依存関係をインスタンス変数に格納します。必須の依存関係が不足している場合は `ApplicationError` をスローします。`readline` インスタンス (`this.rl`) は `start()` メソッドが呼び出されるまで `null` です。

## 3. 主要メソッド

*   **`start()`:**
    *   インタラクティブモードを開始します。
    *   **機能:**
        1.  `cli:interactive_start_before` イベントを発行します。
        2.  開始ログとユーザーへの案内メッセージをコンソールに出力します。
        3.  `readline.createInterface` を使用して `readline` インスタンス (`this.rl`) を初期化し、プロンプト (`knoa> `) を表示します。
        4.  `line` イベントリスナーを設定します。
            *   入力行をトリムし、空の場合は再プロンプトします。
            *   `exit` または `quit` が入力された場合は `this.rl.close()` を呼び出します。
            *   `help` が入力された場合は `_displayHelp()` を呼び出して再プロンプトします。
            *   それ以外の入力は `_parseArgs` で簡易的にパースし、コマンドと引数を抽出します。
            *   抽出したコマンドと引数で `this.facade.execute()` を呼び出します。
            *   `execute` が成功したら、`_displayResult()` で結果をコンソールに出力します。
            *   `execute` が失敗（エラーをスロー）したら、エラーメッセージとコンテキストをコンソールに出力します。
            *   処理完了後、再度プロンプトを表示します。
        5.  `close` イベントリスナーを設定します。
            *   `cli:interactive_end_after` イベントを発行します。
            *   終了ログとメッセージをコンソールに出力します。
            *   `start()` メソッドが返す Promise を解決 (resolve) します。
        6.  `error` イベントリスナーを設定します。
            *   `_handleError` メソッドを呼び出してエラー処理を行います。
            *   `start()` メソッドが返す Promise を拒否 (reject) します。
    *   **戻り値:** `Promise<void>` - ユーザーが `exit` または `quit` を入力してモードが終了したときに解決される Promise。`readline` インターフェースでエラーが発生した場合は拒否されます。
    *   **スローされるエラー:** `ApplicationError` (コード: `ERR_CLI_READLINE`) - `readline` インターフェースでエラーが発生した場合（`errorHandler` がない場合など）。

## 4. 内部ヘルパーメソッド (Private)

*   **`_emitEvent(action, data, traceId, requestId)`:** 標準化イベントを発行します。
*   **`_handleError(error, operation, context)`:** `readline` のエラーを処理します。
*   **`_displayHelp()`:** 利用可能なコマンドのヘルプメッセージをコンソールに出力します。
*   **`_displayResult(command, result)`:** `CliFacade` から返された結果を `display.formatResult` を使用して整形し、コンソールに出力します。
*   **`_parseArgs(argsArray)`:** スペース区切りおよび引用符で囲まれた引数を簡易的にパースしてオブジェクトに変換します。`--option=value` や `--flag` 形式を認識しますが、yargs ほどの高度な機能はありません。

## 5. 発行されるイベント

`CliInteractiveMode` は、`start` メソッドの実行中に以下の標準化イベントを発行します。

*   **`cli:interactive_start_before`:** インタラクティブモード開始前に発行されます。
*   **`cli:interactive_end_after`:** インタラクティブモード終了時 (`close` イベント) に発行されます。
*   **`app:error`:** `readline` インターフェースでエラーが発生した場合に `_handleError` メソッド経由で発行されます。

**注意:** ユーザーが入力した各コマンドの実行に関するイベント (`cli:<command>_before`, `cli:<command>_after`) は、`CliFacade` によって発行されます。

## 6. 注意点とベストプラクティス

*   **`readline` への依存:** このクラスは Node.js の標準モジュール `readline` に強く依存しています。
*   **コマンド実行:** ユーザーが入力したコマンドの実際の実行は `CliFacade` に委譲されます。このクラスは入力の受付、パース、Facade への引き渡し、結果表示を担当します。
*   **引数パース:** `_parseArgs` は簡易的なパーサーであり、複雑なオプションや引数の組み合わせには対応できない可能性があります。より厳密なパースが必要な場合は、yargs などのライブラリを内部で使用するように変更することも考えられます。
*   **エラー処理:** `CliFacade.execute` からスローされたエラーはこのクラス内で捕捉され、コンソールに出力されますが、インタラクティブモード自体は続行されます。`readline` インターフェース自体のエラーは `_handleError` で処理され、`start()` の Promise が reject される可能性があります。