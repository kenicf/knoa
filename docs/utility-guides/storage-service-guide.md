# StorageService 利用ガイド (`src/lib/utils/storage.js`)

## 1. 目的

ファイルシステムへのアクセス（読み取り、書き込み、削除、一覧表示など）を抽象化し、一貫性のあるインターフェースを提供します。JSONファイル、テキストファイル、バイナリファイルの操作、ディレクトリ操作をサポートします。

## 2. コンストラクタ (`new StorageService(options)`)

*   **`options`** (Object): 設定オプション。
    *   **`basePath` (string):** オプション。ファイル操作の基準となるパス。デフォルトは `process.cwd()`。相対パスはこの `basePath` から解決されます。
    *   **`logger` (Object): 必須。** ファイル操作に関するログを出力するために使用される Logger インスタンス。
    *   **`eventEmitter` (Object):** オプション。ファイル操作イベントを発行するために使用する EventEmitter インスタンス。
    *   **`errorHandler` (Object):** オプション。ファイル操作中にエラーが発生した場合の処理をカスタマイズするためのエラーハンドラー。指定しない場合、エラーはログに出力され、操作に応じたデフォルト値（`null` や `false` など）が返されます。
    *   **`traceIdGenerator` (Function):** オプション。トレースIDを生成する関数。デフォルトは内部のジェネレーター。★★★ 追加 ★★★
    *   **`requestIdGenerator` (Function):** オプション。リクエストIDを生成する関数。デフォルトは内部のジェネレーター。★★★ 追加 ★★★

*   **例:**
    ```javascript
    const Logger = require('./logger'); // 仮
    const EventEmitter = require('./event-emitter'); // 仮
    const ErrorHandler = require('./error-handler'); // 仮
    const { generateTraceId, generateRequestId } = require('./id-generators'); // 仮

    const logger = new Logger();
    const eventEmitter = new EventEmitter({ logger });
    const errorHandler = new ErrorHandler({ logger });

    const storageService = new StorageService({
      basePath: './data', // データディレクトリを基準にする
      logger: logger,
      eventEmitter: eventEmitter,
      errorHandler: errorHandler,
      traceIdGenerator: generateTraceId, // 注入例
      requestIdGenerator: generateRequestId // 注入例
    });
    ```

## 3. 主要メソッド

**注意:** 多くのメソッドは、エラー発生時に `errorHandler` が指定されていればその処理に委譲します。`errorHandler` がない場合はエラーをログに出力し、操作に応じたデフォルト値（`null` や `false` など）を返します。エラー発生時に例外を期待する場合は、`errorHandler` でそのように実装する必要があります。

### 3.1 ファイル読み書き

*   **`readJSON(directory, filename)`:**
    *   指定されたディレクトリとファイル名から JSON ファイルを読み込み、JavaScript オブジェクトとして返します。
    *   ファイルが存在しない場合やJSONパースエラーの場合は `null` を返します（`errorHandler` がなければ）。
    *   イベント: `storage:file_read_before`, `storage:file_read_after`, `storage:file_not_found`
*   **`writeJSON(directory, filename, data)`:**
    *   指定された `data` オブジェクトを JSON 文字列に変換し、指定されたファイルに書き込みます。ファイルが存在する場合は上書きされます。
    *   成功した場合は `true`、失敗した場合は `false` を返します（`errorHandler` がなければ）。
    *   イベント: `storage:file_write_before`, `storage:file_write_after`, `storage:file_write_error`, `storage:directory_created` (必要時)
*   **`readText(directory, filename)`:**
    *   指定されたファイルからテキスト内容を読み込み、文字列として返します。
    *   ファイルが存在しない場合は `null` を返します（`errorHandler` がなければ）。
    *   イベント: `storage:file_read_before`, `storage:file_read_after`, `storage:file_not_found`
*   **`writeText(directory, filename, content)`:**
    *   指定された `content` 文字列を指定されたファイルに書き込みます。ファイルが存在する場合は上書きされます。
    *   成功した場合は `true`、失敗した場合は `false` を返します（`errorHandler` がなければ）。
    *   イベント: `storage:file_write_before`, `storage:file_write_after`, `storage:file_write_error`, `storage:directory_created` (必要時)
*   **`writeFile(directory, filename, content)`:**
    *   指定された `content` (文字列または Buffer) を指定されたファイルに書き込みます。バイナリファイルの書き込みに使用できます。
    *   成功した場合は `true`、失敗した場合は `false` を返します（`errorHandler` がなければ）。
    *   イベント: `storage:file_write_before`, `storage:file_write_after`, `storage:file_write_error`, `storage:directory_created` (必要時)
*   **`updateJSON(directory, filename, updateFn)`:**
    *   JSON ファイルをアトミックに読み込み、`updateFn` で内容を変更し、書き戻します。
    *   `updateFn` は現在のデータ (ファイルが存在しない場合は `{}`) を引数として受け取り、更新後のデータを返す必要があります。
    *   ファイルが元々存在した場合は `true`、新規作成された場合は `null`、エラー時は `null` を返します（`errorHandler` がなければ）。
    *   イベント: `storage:file_update_before`, `storage:file_update_after`, `storage:file_not_found` (読み込み時), `storage:directory_created` (必要時)

*   **例:**
    ```javascript
    // JSON 読み書き
    const config = storageService.readJSON('config', 'app-settings.json');
    if (config) {
      config.featureEnabled = true;
      storageService.writeJSON('config', 'app-settings.json', config);
    }

    // テキスト書き込み
    storageService.writeText('logs', 'latest.log', 'Application started.');

    // JSON 更新
    storageService.updateJSON('stats', 'user-counts.json', (counts) => {
      counts.logins = (counts.logins || 0) + 1;
      return counts;
    });
    ```

### 3.2 ファイル・ディレクトリ操作

*   **`fileExists(directory, filename)` または `fileExists(fullPath)`:**
    *   指定されたファイルが存在するかどうかを確認し、`true` または `false` を返します。
    *   引数が1つの場合は完全パス、2つの場合はディレクトリとファイル名として解釈されます。
*   **`listFiles(directory, [pattern])`:**
    *   指定されたディレクトリ内のファイル名の配列を返します。
    *   オプションの `pattern` (正規表現文字列) を指定すると、ファイル名をフィルタリングします。
    *   ディレクトリが存在しない場合やエラー時は `[]` を返します（`errorHandler` がなければ）。
    *   イベント: `storage:directory_list_before`, `storage:directory_list_after`, `storage:directory_not_found`, `storage:directory_list_error` ★★★ 修正 ★★★
*   **`deleteFile(directory, filename)`:**
    *   指定されたファイルを削除します。
    *   成功した場合は `true`、ファイルが存在しない場合や失敗した場合は `false` を返します（`errorHandler` がなければ）。
    *   イベント: `storage:file_delete_before`, `storage:file_delete_after`, `storage:file_not_found`, `storage:file_delete_error` ★★★ 修正 ★★★
*   **`deleteDirectory(directory, [recursive=false])`:**
    *   指定されたディレクトリを削除します。
    *   `recursive` が `true` の場合、ディレクトリ内のファイルやサブディレクトリも再帰的に削除します。**注意して使用してください。**
    *   成功した場合は `true`、ディレクトリが存在しない場合や失敗した場合は `false` を返します（`errorHandler` がなければ）。
    *   イベント: `storage:directory_delete_before`, `storage:directory_delete_after`, `storage:directory_not_found`, `storage:directory_delete_error` ★★★ 修正 ★★★
*   **`copyFile(sourceDir, sourceFile, destDir, destFile)`:**
    *   指定されたソースファイルを指定された宛先にコピーします。宛先ディレクトリが存在しない場合は作成されます。
    *   成功した場合は `true`、ソースファイルが存在しない場合や失敗した場合は `false` を返します（`errorHandler` がなければ）。
    *   イベント: `storage:file_copy_before`, `storage:file_copy_after`, `storage:file_not_found` (ソース), `storage:directory_created` (宛先), `storage:file_copy_error` ★★★ 修正 ★★★
*   **`ensureDirectoryExists(directory)`:**
    *   指定されたディレクトリが存在することを確認します。存在しない場合は作成します。
    *   成功した場合は `true`、失敗した場合は `false` を返します（`errorHandler` がなければ）。
    *   イベント: `storage:directory_created` (必要時)

*   **例:**
    ```javascript
    if (storageService.fileExists('uploads', 'image.jpg')) {
      storageService.deleteFile('uploads', 'image.jpg');
    }

    const logFiles = storageService.listFiles('logs', '\\.log$');

    storageService.ensureDirectoryExists('archive/logs');
    storageService.copyFile('logs', 'latest.log', 'archive/logs', `log-${Date.now()}.log`);

    storageService.deleteDirectory('temp-files', true); // 再帰削除
    ```

## 4. 発行されるイベント (EventEmitter が指定されている場合)

ファイルやディレクトリの操作前後、エラー発生時、ディレクトリ作成時などに `storage:` プレフィックスを持つイベントが発行されます。詳細は各メソッドの説明を参照してください。イベントデータには通常、操作対象のパス (`path`) や成功/失敗ステータス、エラーメッセージなどが含まれます。**また、これらのイベントデータには自動的に `timestamp`, `traceId`, `requestId` が含まれます。** ★★★ 修正 ★★★

*   例: `storage:file_read_before`, `storage:file_read_after`, `storage:file_write_error`, `storage:directory_created`, `storage:file_not_found`

## 5. 注意点とベストプラクティス

*   **パスの扱い:** メソッドに渡す `directory` や `filename` は、コンストラクタで指定された `basePath` からの相対パスとして扱われます。内部的には OS ネイティブなパスに変換されて処理されます。`fileExists` は絶対パスも受け付けます。イベントデータに含まれるパスも OS ネイティブ形式です。★★★ 修正 ★★★
*   **IDジェネレーター:** `traceIdGenerator` と `requestIdGenerator` はオプションですが、アプリケーション全体で一貫したトレースを行うために、外部から共通のジェネレーターを注入することを推奨します。★★★ 追加 ★★★
*   **エラーハンドリング:** デフォルトでは、多くのメソッドはエラー時に例外をスローせず、`null` や `false` を返します。これは `errorHandler` が指定されていない場合の動作です。エラー発生時に例外をスローさせたい場合や、特定のエラー処理（リトライなど）を行いたい場合は、カスタムの `errorHandler` を実装してコンストラクタに渡してください。
*   **同期処理:** この `StorageService` のメソッドは、Node.js の同期的なファイルシステム API (`fs.readFileSync`, `fs.writeFileSync` など) を使用しています。これは実装を単純化するためですが、大量のファイル操作や高負荷な状況ではアプリケーションのイベントループをブロックする可能性があります。パフォーマンスが重要な場合は、非同期的なファイル操作を行う別のサービスやライブラリの使用を検討してください。
*   **競合:** 短時間に同じファイルに対して複数のプロセスや非同期操作が書き込みを行うと、競合が発生する可能性があります。`updateJSON` はある程度の保護を提供しますが、より厳密な排他制御が必要な場合は、`LockManager` などのロック機構と組み合わせて使用することを検討してください。