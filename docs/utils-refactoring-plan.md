# src/lib/utils リファクタリング計画

## 1. はじめに

この計画は、`src/lib/utils/` ディレクトリ配下にある以下のユーティリティクラス群を対象とし、実装パターンとコーディング規則の一貫性を向上させるためのリファクタリング方針を定めることを目的とします。

*   `cache-manager.js`
*   `error-helpers.js`
*   `errors.js`
*   `event-emitter.js`
*   `event-helpers.js`
*   `git.js`
*   `lock-manager.js`
*   `logger.js`
*   `plugin-manager.js`
*   `storage.js`
*   `validator.js`

リファクタリングを通じて、コードの可読性、保守性、拡張性を高め、開発効率の向上を目指します。

## 2. 現状分析

### 2.1. 各ユーティリティクラスの役割

*   **cache-manager:** アプリケーション内でのデータキャッシュ機能を提供。
*   **error-helpers:** 標準化されたエラーイベントの発行を支援。
*   **errors:** アプリケーション固有のエラークラスを定義（コアエラークラスのラッパーが多い）。
*   **event-emitter:** イベント駆動のためのイベント送受信機能を提供（コアEventEmitterのラッパー）。
*   **event-helpers:** イベントデータの標準化やイベント名のブリッジなどを支援。
*   **git:** Gitリポジトリ操作（コミット情報取得、ファイル差分など）を抽象化。
*   **lock-manager:** リソースへの同時アクセスを制御するロック機能を提供。
*   **logger:** アプリケーションのログ出力機能を提供。
*   **plugin-manager:** プラグインによる機能拡張の仕組みを提供。
*   **storage:** ファイルシステム操作（読み書き、ディレクトリ操作など）を抽象化。
*   **validator:** データ構造やフォーマットの検証機能を提供。

### 2.2. クラス間の主な依存関係

```mermaid
classDiagram
    direction LR

    class CoreErrorFramework {
        <<Core Module>>
        +ApplicationError
        +ValidationError
        +StateError
        +DataConsistencyError
        +TimeoutError
        +LockError
    }

    class CoreEventSystem {
        <<Core Module>>
        +EnhancedEventEmitter
    }

    class CoreEventConstants {
        <<Core Module>>
        +EVENT_MAP
    }

    class CacheManager {
        +constructor(options)
        +get(key)
        +set(key, value, ttl)
        +invalidate(keyPattern)
        +clear()
        +getStats()
        -_evictOldest()
    }
    CacheManager --> Logger : uses (optional)
    CacheManager --> EventEmitter : uses (optional)

    class ErrorHelpers {
        +emitErrorEvent(eventEmitter, logger, component, operation, error, context, details)
    }
    ErrorHelpers --> EventEmitter : uses
    ErrorHelpers --> Logger : uses

    class Errors {
        +ValidationError
        +StateError
        +DataConsistencyError
        +LockTimeoutError
    }
    Errors --|> CoreErrorFramework : inherits

    class EventEmitter {
        +constructor(options)
        +on(event, callback)
        +off(event, callback)
        +emit(event, data)
        +emitStandardized(component, action, data, options)
        +emitAsync(event, data)
        +emitStandardizedAsync(component, action, data, options)
    }
    EventEmitter --|> CoreEventSystem : inherits
    EventEmitter --> Logger : uses (optional)

    class EventHelpers {
        +createStandardizedEventData(data, component)
        +createEventBridge(eventEmitter, oldEventName, component, action)
        +emitStandardizedEvent(eventEmitter, component, action, data, bridgeOldEvents)
    }
    EventHelpers --> EventEmitter : uses
    EventHelpers --> CoreEventConstants : uses

    class GitService {
        +constructor(options)
        +getCurrentCommitHash()
        +extractTaskIdsFromCommitMessage(message)
        +getCommitsBetween(startCommit, endCommit)
        +getChangedFilesInCommit(commitHash)
        +getCommitDiffStats(commitHash)
        +getCommitDetails(commitHash)
        -_executeCommand(command, options)
        -_emitEvent(eventName, data)
        -_handleError(message, error, context)
    }
    GitService --> Logger : uses (optional)
    GitService --> EventEmitter : uses (optional)
    GitService --> Errors : uses (GitError)
    %% GitService uses child_process internally

    class LockManager {
        +constructor(options)
        +acquireLock(resourceId, lockerId, timeout)
        +releaseLock(resourceId, lockerId)
        -_tryAcquireLock(resourceId, lockerId)
    }
    LockManager --> Errors : uses (LockTimeoutError)

    class Logger {
        +constructor(options)
        +log(level, message, context)
        +debug(message, context)
        +info(message, context)
        +warn(message, context)
        +error(message, context)
        +fatal(message, context)
        +addTransport(transport)
        +addContextProvider(key, provider)
        -_sendAlert(entry)
    }
    Logger --> EventEmitter : uses (optional)

    class PluginManager {
        +constructor(options)
        +registerPlugin(pluginType, pluginImplementation)
        +invokePlugin(pluginType, methodName, ...args)
        +hasPlugin(pluginType)
        +unregisterPlugin(pluginType)
        -_validatePlugin(pluginType, pluginImplementation)
    }
    PluginManager --> Logger : uses (optional)
    PluginManager --> EventEmitter : uses (optional)

    class StorageService {
        +constructor(options)
        +getFilePath(directory, filename)
        +readJSON(filePath, filename)
        +writeJSON(directory, filename, data)
        +readText(directory, filename)
        +writeText(directory, filename, content)
        +updateJSON(directory, filename, updateFn)
        +fileExists(filePath)
        +listFiles(directory, pattern)
        +deleteFile(directory, filename)
        +deleteDirectory(directory, recursive)
        +copyFile(sourceDir, sourceFile, destDir, destFile)
        -_emitEvent(eventName, data)
        -_handleError(message, error, context)
        -_ensureDirectoryExists(dirPath)
    }
    StorageService --> Logger : uses (optional)
    StorageService --> EventEmitter : uses (optional)
    StorageService --> Errors : uses (StorageError)
    %% StorageService uses fs, path internally

    class Validator {
        +constructor(options)
        +validateTaskInput(taskData)
        +validateSessionInput(sessionData)
        +validateFeedbackInput(feedbackData)
        +sanitizeString(str)
        + {static} validateTaskInput(taskData)
        + {static} validateSessionInput(sessionData)
        + {static} validateFeedbackInput(feedbackData)
        + {static} sanitizeString(str)
    }
    Validator --> Logger : uses (optional)
    Validator --> Errors : uses (ValidationError)

```

### 2.3. 主な実装パターンと課題点

*   **依存性注入:**
    *   多くのクラスがコンストラクタの `options` オブジェクト経由で `logger`, `eventEmitter`, `errorHandler` 等の依存を受け取るパターンを採用しています。
    *   しかし、`LockManager` や `Validator` など、一部のクラスではこのパターンが完全には適用されておらず、一貫性が欠けています。
    *   依存がオプショナル (`options.logger || console`) になっている箇所が多く、依存関係が曖昧になる可能性があります。
*   **イベント発行:**
    *   標準化されたイベント形式 (`component:action`) と `emitStandardized` メソッドへの移行が進められていますが、古い形式 (`event:name`) や `emit` メソッドの利用、後方互換性のための警告ログが多くのクラス (`CacheManager`, `EventEmitter`, `Logger`, `StorageService`, `GitService`?) に混在しています。
    *   `event-helpers.js` にはイベントブリッジや標準化発行ヘルパーが存在し、移行期の複雑さを示唆しています。
    *   イベントデータの構造（特に `traceId`, `requestId` の有無や命名）に一貫性がない可能性があります。
*   **エラーハンドリング:**
    *   `GitService`, `StorageService` は内部に `_handleError` メソッドを持ち、エラー処理を行っています。
    *   `ErrorHelpers` は標準化されたエラーイベント発行を提供しますが、これが一貫して利用されているかは不明です。
    *   `errorHandler` を依存として注入するオプションがありますが、実際にどのように利用されているか、またその実装は一貫しているか不明です。
    *   `errors.js` には `../core/error-framework` のエラークラスをラップした後方互換性のためのクラスが多く定義されており、冗長である可能性があります。
*   **トレース/リクエストID:**
    *   `CacheManager`, `EventHelpers`, `Logger`, `StorageService` など、複数の箇所でID生成ロジックが実装されており、重複しています。
    *   `Logger` はID生成関数を注入できますが、他のクラスでは直接 `Date.now()` や `Math.random()` を使用して生成しています。
*   **後方互換性:**
    *   `errors.js` のラッパークラス、`event-emitter.js` の `emit`/`on`/`off` メソッド、`validator.js` の静的メソッドなど、後方互換性を維持するためのコードが散見されます。これらはコードの複雑性を増大させています。
*   **コーディングスタイル:**
    *   全体的にクラスベースで書かれていますが、`error-helpers.js` や `event-helpers.js` は関数ベースです。
    *   命名規則は主に `camelCase` ですが、イベントデータ等で `snake_case` (`trace_id`, `request_id`) も使用されています。
    *   JSDocコメントは比較的記述されていますが、網羅性や記述スタイルにばらつきがある可能性があります。
*   **外部ライブラリ/モジュール利用:**
    *   `GitService` は `child_process` を、`StorageService` は `fs`, `path` を直接利用しており、これらはより高レベルな抽象化やエラーハンドリングを提供するライブラリで置き換えられる可能性があります。
    *   `../core/*` モジュールへの依存があり、これらのコアモジュールとの整合性を保つ必要があります。

## 3. リファクタリング提案

### 3.1. 目標

*   ユーティリティクラス全体で実装パターンとコーディング規則の一貫性を確立する。
*   コードの重複を削減し、関心事を分離する。
*   後方互換性のためのコードを整理・削除し、コードベースをシンプルにする。
*   可読性、保守性、テスト容易性、拡張性を向上させる。

### 3.2. 具体的なリファクタリング項目

1.  **依存性注入の統一:**
    *   **方針:** 全てのユーティリティクラスで、必要な依存関係（Logger, EventEmitter, ErrorHandler, Config 等）をコンストラクタインジェクションで明示的に受け取るように統一します。オプショナルな依存は避け、必須とします。
    *   **具体例:** `LockManager`, `Validator` も `Logger` 等を必須の依存として受け取るように変更します。`options.logger || console` のようなフォールバックを削除します。
    *   **検討事項:** DIコンテナ（例: `tsyringe`, `inversify`）の導入を検討し、依存関係の解決をフレームワークに任せることで、より宣言的なコードを目指します。
2.  **イベント発行の標準化:**
    *   **方針:** イベント発行を `EventEmitter` の `emitStandardized` / `emitStandardizedAsync` メソッド利用に完全に統一します。
    *   **具体例:**
        *   各クラス内の古い `emit` / `emitAsync` 呼び出しを `emitStandardized` / `emitStandardizedAsync` に置き換えます。
        *   `EventEmitter` 内の後方互換性コード（`emit`/`on`/`off` のオーバーライド、警告ログ）を削除します。
        *   `event-helpers.js` の `createEventBridge` や関連する警告ログを削除します。
        *   イベント名とデータ構造（`traceId`, `requestId` を含む）をコア規約（例: `../core/event-constants`）に基づいて統一します。
3.  **エラーハンドリングの統一:**
    *   **方針:** エラーハンドリング戦略を統一します。`ErrorHelpers` の利用、または一貫した `ErrorHandler` インターフェースの導入を推奨します。
    *   **具体例:**
        *   `GitService`, `StorageService` の `_handleError` を廃止し、注入された `ErrorHandler` または `ErrorHelpers.emitErrorEvent` を利用するように変更します。
        *   `errors.js` の後方互換ラッパークラス (`ValidationError`, `StateError`, `DataConsistencyError`, `LockTimeoutError`) を削除し、`../core/error-framework` のエラークラスを直接利用するように、各クラスの `require` とエラー生成箇所を修正します。
4.  **トレース/リクエストID生成の集約:**
    *   **方針:** ID生成ロジックを専用のユーティリティクラスまたは `Logger` の機能（コンテキストプロバイダ等）に集約します。
    *   **具体例:** `CacheManager`, `EventHelpers`, `StorageService` 等での直接的なID生成コードを削除し、集約されたID生成機能を利用するように変更します。`Logger` の `traceIdGenerator`, `requestIdGenerator` の利用を標準化します。
5.  **後方互換性コードの削除:**
    *   **方針:** 上記の標準化・統一化に伴い、不要になった後方互換性維持のためのコードを削除します。
    *   **具体例:** `errors.js` のラッパークラス、`event-emitter.js` のメソッドオーバーライド、`validator.js` の静的メソッドなどを削除します。関連する警告ログも削除します。
6.  **コーディングスタイルの統一:**
    *   **方針:** ESLint と Prettier を導入・設定し、コードベース全体に適用します。
    *   **具体例:** 命名規則 (`camelCase` に統一)、インデント、スペース、コメントスタイル（JSDocの必須化など）、`require`/`import` の順序などをルール化し、自動修正・チェックを行います。
7.  **共通ロジックの抽出:**
    *   **方針:** 複数のクラスで重複しているロジックがあれば、共通のヘルパー関数や基底クラスに抽出します。
    *   **具体例:** パス操作、イベントデータの定型的な構築処理などが候補となります。
8.  **`git.js` の改善:**
    *   **方針:** `child_process.execSync` の直接利用を避け、より安全でテスト容易性の高いGitライブラリ（例: `simple-git`）の利用を検討します。
    *   **具体例:** `_executeCommand` や `_execGit` をライブラリ呼び出しに置き換えます。イベント発行も標準化します。
9.  **`storage.js` の改善:**
    *   **方針:** ファイルパスの扱いやプラットフォーム依存性を改善します。`path` モジュールの機能を活用し、`process.platform` による分岐を減らします。
    *   **具体例:** `getFilePath` や各メソッド内でのパス結合・正規化処理を見直し、`path.join`, `path.normalize` を適切に使用します。イベント発行も標準化します。

### 3.3. リファクタリングの進め方（案）

以下のステップで段階的に進めることを提案します。各ステップでテストを実行し、デグレが発生しないことを確認しながら進めます。

1.  **Step 1: コーディングスタイル統一:** ESLint/Prettier を導入し、コード全体のフォーマットを統一します。
2.  **Step 2: 後方互換性コード削除準備:** `errors.js` のラッパー等を削除し、コアモジュールを直接利用するように修正します。`validator.js` の静的メソッドも削除します。
3.  **Step 3: イベント発行標準化:** `emitStandardized` への統一、古い形式の削除、`event-helpers.js` の整理を行います。
4.  **Step 4: エラーハンドリング統一:** `ErrorHandler` または `ErrorHelpers` の利用に統一し、`_handleError` を廃止します。
5.  **Step 5: 依存性注入とID生成統一:** DIの必須化、ID生成ロジックの集約を行います。
6.  **Step 6: 各クラス固有改善:** `git.js`, `storage.js` の改善、共通ロジック抽出などを行います。

## 4. 期待される効果

*   **保守性の向上:** 一貫したパターンにより、コードの理解や修正が容易になります。
*   **品質の向上:** コードの重複削減やエラーハンドリング統一により、バグが減少します。
*   **開発効率の向上:** 新規開発者がコードベースを理解しやすくなり、機能追加や変更が迅速に行えるようになります。
*   **テスト容易性の向上:** 依存関係が明確になり、単体テストが書きやすくなります。