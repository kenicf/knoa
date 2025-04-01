# GitService 利用ガイド (`src/lib/utils/git.js`)

## 1. 目的

ローカルの Git リポジトリに対する操作を抽象化し、一貫性のあるインターフェースを提供します。コミット情報の取得、ブランチ情報の取得、ファイルのステージング、コミット作成などの基本的な Git 操作をサポートします。内部で `simple-git` ライブラリを使用しています。

## 2. コンストラクタ (`new GitService(options)`)

*   **`options`** (Object): 設定オプション。
    *   **`repoPath` (string):** オプション。操作対象の Git リポジトリへのパス。デフォルトは `process.cwd()`。
    *   **`logger` (Object): 必須。** Git 操作に関するログを出力するために使用される Logger インスタンス。
    *   **`eventEmitter` (Object):** オプション。Git 操作イベントを発行するために使用する EventEmitter インスタンス。
    *   **`errorHandler` (Object):** オプション。Git 操作中にエラーが発生した場合の処理をカスタマイズするためのエラーハンドラー。指定しない場合、エラーはログに出力され、`GitError` がスローされます。
    *   **`taskIdPattern` (RegExp):** オプション。コミットメッセージからタスクIDを抽出するための正規表現。デフォルトは `/#(T[0-9]{3})/g`。
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

    const gitService = new GitService({
      repoPath: '/path/to/your/repo',
      logger: logger,
      eventEmitter: eventEmitter,
      errorHandler: errorHandler,
      taskIdPattern: /TASK-(\d+)/g, // カスタムパターン
      traceIdGenerator: generateTraceId, // 注入例
      requestIdGenerator: generateRequestId // 注入例
    });
    ```

## 3. 主要メソッド

**注意:** すべての非同期メソッドは Promise を返します。エラーが発生した場合、`errorHandler` が指定されていればその処理に委譲され、その戻り値が返されます。`errorHandler` がない場合は、`GitError` (またはそのサブクラス) がスローされます。

### 3.1 コミット関連

*   **`getCurrentCommitHash()`:**
    *   現在の HEAD のコミットハッシュ (SHA) を取得します。
    *   戻り値: `Promise<string>` (コミットハッシュ)
    *   イベント: `git:commit_get_hash_before`, `git:commit_get_hash_after`
*   **`getCommitsBetween(startCommit, endCommit)`:**
    *   指定された2つのコミット間（`startCommit` は含まず `endCommit` は含む）のコミット情報を取得します。
    *   戻り値: `Promise<Array<Object>>` (コミット情報の配列)
        *   各コミット情報: `{ hash, message, timestamp, author, related_tasks }`
    *   イベント: `git:commit_get_between_before`, `git:commit_get_between_after`
*   **`getChangedFilesInCommit(commitHash)`:**
    *   指定されたコミットで変更されたファイルとそのステータス（`added`, `modified`, `deleted`, `renamed`, `copied` など）を取得します。
    *   戻り値: `Promise<Array<Object>>` (変更されたファイルの配列)
        *   各ファイル情報: `{ status: string, path: string }`
    *   イベント: `git:commit_get_changed_files_before`, `git:commit_get_changed_files_after`
*   **`getCommitDiffStats(commitHash)`:**
    *   指定されたコミットの差分統計（変更されたファイル、追加行数、削除行数）を取得します。
    *   戻り値: `Promise<Object>`
        *   統計情報: `{ files: Array<Object>, lines_added: number, lines_deleted: number }` (`files` は `getChangedFilesInCommit` と同じ形式)
    *   イベント: `git:commit_get_diff_stats_before`, `git:commit_get_diff_stats_after`
*   **`getCommitHistory([limit=10])`:**
    *   最新のコミット履歴を指定された件数だけ取得します。
    *   戻り値: `Promise<Array<Object>>` (コミット情報の配列、`getCommitsBetween` と同じ形式)
    *   イベント: `git:commit_get_history_before`, `git:commit_get_history_after`
*   **`getFileHistory(filePath, [limit=10])`:**
    *   指定されたファイルの変更履歴を指定された件数だけ取得します。
    *   戻り値: `Promise<Array<Object>>` (コミット情報の配列、`getCommitsBetween` と同じ形式)
    *   イベント: `git:file_get_history_before`, `git:file_get_history_after`
*   **`getCommitDetails(commitHash)`:**
    *   指定されたコミットの詳細情報（メッセージ、作者、コミッター、親コミット、変更ファイル、差分統計、関連タスク）を取得します。
    *   戻り値: `Promise<Object|null>` (コミット詳細情報、見つからない場合は `GitError` がスローされる)
    *   イベント: `git:commit_get_details_before`, `git:commit_get_details_after`
*   **`createCommit(message)`:**
    *   ステージングされている変更を指定されたメッセージでコミットします。
    *   戻り値: `Promise<string>` (作成されたコミットのハッシュ)
    *   イベント: `git:commit_create_before`, `git:commit_create_after`
    *   注意: コミットメッセージが空の場合はエラーになります。

### 3.2 ブランチ関連

*   **`getBranches()`:**
    *   ローカルブランチの一覧を取得します。
    *   戻り値: `Promise<Array<string>>` (ブランチ名の配列)
    *   イベント: `git:branch_get_all_before`, `git:branch_get_all_after`
*   **`getCurrentBranch()`:**
    *   現在のチェックアウトされているブランチ名を取得します。
    *   戻り値: `Promise<string>` (ブランチ名)
    *   イベント: `git:branch_get_current_before`, `git:branch_get_current_after`

### 3.3 ステージング関連

*   **`stageFiles(files)`:**
    *   指定されたファイル（単一のパス文字列またはパス文字列の配列）をステージングエリアに追加します (`git add`)。
    *   戻り値: `Promise<boolean>` (成功したかどうかを示すが、エラー時は例外がスローされる)
    *   イベント: `git:stage_before`, `git:stage_after`

### 3.4 その他

*   **`extractTaskIdsFromCommitMessage(message)`:**
    *   指定されたコミットメッセージから、コンストラクタで設定された `taskIdPattern` に一致するタスクIDを抽出します。
    *   戻り値: `Array<string>` (抽出されたタスクIDの配列)
    *   注意: このメソッドは同期的であり、エラー発生時は `GitError` をスローします。

*   **例:**
    ```javascript
    async function processLatestCommit() {
      try {
        const currentHash = await gitService.getCurrentCommitHash();
        logger.info(`Current commit: ${currentHash}`);

        const details = await gitService.getCommitDetails(currentHash);
        logger.info(`Commit message: ${details.message}`);
        logger.info(`Related tasks: ${details.related_tasks.join(', ')}`);

        await gitService.stageFiles(['new-file.txt', 'modified-file.js']);
        const newCommitHash = await gitService.createCommit('Add new file and modify existing one #T123');
        logger.info(`New commit created: ${newCommitHash}`);

      } catch (error) {
        logger.error('Git operation failed:', error);
        // errorHandler があれば、ここで処理されている可能性がある
      }
    }
    ```

## 4. 発行されるイベント (EventEmitter が指定されている場合)

各 Git 操作の前後 (`_before`, `_after`) に `git:` プレフィックスを持つイベントが発行されます。詳細は各メソッドの説明を参照してください。イベントデータには通常、操作の引数、結果（成功/失敗、ハッシュ、ファイルリストなど）、エラーメッセージなどが含まれます。**また、これらのイベントデータには自動的に `timestamp`, `traceId`, `requestId` が含まれます。** ★★★ 修正 ★★★

*   例: `git:commit_get_hash_before`, `git:commit_get_hash_after`, `git:stage_before`, `git:stage_after`, `git:commit_create_after`

## 5. 注意点とベストプラクティス

*   **エラーハンドリング:** `GitService` のメソッドはエラー発生時に `GitError` をスローします（`errorHandler` がない場合）。呼び出し元で適切に `try...catch` を使用してエラーを処理してください。`errorHandler` を使用する場合は、そのハンドラーがエラーをどのように処理するか（例外をスローするか、デフォルト値を返すかなど）を理解しておく必要があります。
*   **IDジェネレーター:** `traceIdGenerator` と `requestIdGenerator` はオプションですが、アプリケーション全体で一貫したトレースを行うために、外部から共通のジェネレーターを注入することを推奨します。
*   **リポジトリの状態:** `GitService` は、操作対象のリポジトリが有効な状態であることを前提としています。リポジトリが存在しない、破損している、などの場合は予期しないエラーが発生する可能性があります。
*   **競合:** 複数のプロセスや操作が同時に同じリポジトリに対して書き込み操作（コミット、ステージングなど）を行うと、競合が発生する可能性があります。必要に応じて `LockManager` などを使用して排他制御を行ってください。
*   **`simple-git` への依存:** このサービスは内部で `simple-git` ライブラリを使用しています。`simple-git` のバージョンアップによって挙動が変わる可能性に注意してください。