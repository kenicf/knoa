# 設計原則とパターン

このドキュメントでは、プロジェクト全体で採用する主要な設計原則とデザインパターンについて説明します。一貫性のある、保守しやすく、拡張性の高いコードベースを維持するために、これらの原則に従ってください。

## 1. クラスベース設計

*   **原則:** 関連するデータとロジックをカプセル化するために、クラスベースのオブジェクト指向設計を採用します。
*   **指針:**
    *   **単一責任の原則 (SRP):** 各クラスは、明確に定義された単一の責務を持つべきです。例えば、`StorageService` はファイル操作に責任を持ち、`GitService` はGit操作に責任を持ちます。
    *   **コンストラクタ:** クラスの初期化、特に依存関係の注入と基本的な設定に専念します。複雑な初期化ロジックは、専用のメソッド（例: `initialize()`）に分離することを検討します。
    *   **メソッド:** クラスの責務に関連する具体的な操作を提供します。メソッド名は、その操作内容を明確に示す動詞から始めることが推奨されます (例: `getUserData`, `calculateTotal`)。メソッドの粒度は適切に保ち、一つのメソッドが多くのことをしすぎないようにします。
    *   **状態管理:** クラスの状態（インスタンス変数）は、必要最小限に保ち、外部から直接変更されることを避けるために適切にカプセル化します（例: private フィールドや getter/setter の利用を検討）。

## 2. 依存性注入 (DI)

*   **原則:** クラス間の依存関係を疎結合にし、**テスト容易性**と再利用性を高めるために、依存性注入 (Dependency Injection) パターンを採用します。
*   **方法:**
    *   **コンストラクタインジェクション:** 依存オブジェクトは、クラスのコンストラクタを通じて注入することを原則とします。これにより、クラスのインスタンス化時に必要な依存関係がすべて揃っていることが保証されます。
    *   **`options` オブジェクト:** 依存関係は `options` オブジェクトとしてコンストラクタに渡します。これにより、引数の順序を気にする必要がなくなり、将来的な依存関係の追加が容易になります。
    *   **必須/任意依存:** 依存関係が必須か任意かを明確にします。必須の依存関係が提供されない場合は、コンストラクタでエラーをスローします (`logger` は多くの場合必須です)。任意の依存関係は、存在チェックを行ってから使用します。
*   **利点:**
    *   **テスト容易性:** **DI の最大の利点の一つです。** テスト時に、実際の依存オブジェクト（例: データベース接続、外部APIクライアント）の代わりに、モックオブジェクトやスタブを容易に注入できます。これにより、テスト対象のユニットを隔離し、外部要因に影響されずにその動作を検証できます。
    *   **再利用性:** クラスが特定の依存実装に結合しないため、異なるコンテキストで再利用しやすくなります。
    *   **保守性:** 依存関係が明確になり、コードの理解と変更が容易になります。
*   **Do:**
    ```javascript
    // 例: ServiceA が Logger と OptionalService に依存する場合
    class ServiceA {
      constructor(options = {}) {
        // 必須依存のチェック
        if (!options.logger) {
          throw new Error('Logger instance is required for ServiceA');
        }
        this.logger = options.logger;
        // 任意依存の取得
        this.optionalService = options.optionalService;
        // ★★★ IDジェネレーターも注入可能 ★★★
        this._traceIdGenerator = options.traceIdGenerator || (() => `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
        this._requestIdGenerator = options.requestIdGenerator || (() => `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

        this.logger.info('ServiceA initialized');
      }

      doSomething() {
        this.logger.debug('Doing something in ServiceA');
        if (this.optionalService) {
          this.optionalService.help();
        }
        // ...
      }
    }

    // 利用側
    const logger = new Logger();
    const optionalService = new OptionalService();
    const serviceA = new ServiceA({ logger, optionalService });
    const serviceA_minimal = new ServiceA({ logger }); // 任意依存は省略可能

    // テスト時
    const mockLogger = createMockLogger(); // モックファクトリから
    const mockOptionalService = { help: jest.fn() };
    const serviceAForTest = new ServiceA({ logger: mockLogger, optionalService: mockOptionalService });
    serviceAForTest.doSomething();
    expect(mockOptionalService.help).toHaveBeenCalled();
    ```
*   **Don't:**
    *   クラス内部で依存オブジェクトを直接 `new` する。
    *   グローバル変数やシングルトンパターンを通じて依存オブジェクトにアクセスする（テストや再利用が困難になるため）。

*   **関連ガイドライン:**
    *   テスト容易性の詳細については、[テスト戦略とガイドライン](./testing-guidelines.md#4-テスト容易性のための設計) を参照してください。

## 3. エラーハンドリング戦略

*   **原則:** エラーは早期に検出し、明確な情報とともに処理します。エラー処理の一貫性を保ち、デバッグを容易にします。
*   **方法:**
    *   **カスタムエラークラス:** `src/lib/core/error-framework.js` で定義された基本エラークラス (`ApplicationError`, `ValidationError` など) を継承し、`src/lib/utils/errors.js` で具体的なエラータイプ (例: `GitError`, `StorageError`) を定義します。これにより、エラーの種類に応じた処理が可能になります。
    *   **`errorHandler` オプション:** 多くのユーティリティクラスでは、コンストラクタオプションとして `errorHandler` を受け取ります。これは、エラー発生時のデフォルト動作（ログ出力、デフォルト値の返却など）をオーバーライドしたり、特定のエラー処理ロジック（例: リトライ、通知）を一元的に実装したりするためのフックポイントです。テスト時にはモック化してエラーハンドリングの動作を検証します。
    *   **`error-helpers.js`:** `emitErrorEvent` ヘルパー関数は、エラー情報をログに出力し、標準化された `app:error` イベントを発行するために使用されます。これにより、アプリケーション全体のエラー監視と分析が容易になります。
    *   **`try...catch`:** エラーが発生する可能性のある操作（ファイルI/O、外部API呼び出し、Git操作など）は `try...catch` ブロックで囲みます。
    *   **エラーのラップ:** 捕捉した低レベルのエラー（例: `fs` モジュールのエラー）は、より意味のあるカスタムエラークラス（例: `StorageError`）でラップしてから再スローするか、`errorHandler` に渡します。エラーの原因 (`cause`) も含めるようにします。
    *   **エラーコンテキスト:** エラーオブジェクトの `context` プロパティや、`emitErrorEvent` の `details` 引数には、エラー発生時の状況を理解するのに役立つ情報（関連ID、パラメータ、操作名など）を含めます。
        *   **例 (`LockManager` のタイムアウト):**
            ```javascript
            // TimeoutError を使用し、エラーコードとコンテキストを指定
            const error = new TimeoutError(
              `リソース ${resourceId} のロック取得がタイムアウトしました`,
              {
                code: 'ERR_LOCK_TIMEOUT', // エラーコード
                context: { // 関連情報
                  resourceId,
                  lockerId,
                  timeout,
                  errorType: 'LockTimeoutError', // 元のエラータイプ
                },
              }
            );
            this.logger.warn(`Lock acquisition timed out for resource: ${resourceId}`, { error }); // ログにもエラーオブジェクトを渡す
            throw error;
            ```
*   **Do:**
    ```javascript
    // StorageService の例
    try {
      const content = fs.readFileSync(nativeFilePath, 'utf8');
      // ...
      return data;
    } catch (error) {
      // エラーをラップして errorHandler に渡すか、再スロー
      // 多くのクラスでは、エラー処理を _handleError 内部ヘルパーに集約しています。
      return this._handleError(
        `JSONファイルの読み込みに失敗しました: ${nativeFilePath}`,
        error, // cause として元のエラーを渡す
        operationContext
      );
      // または throw new StorageError(...)
    }
    ```
    *   **CLIクラスにおけるエラーコード:** CLI関連クラス (`src/cli/*`) で発生した固有のエラーには、`ERR_CLI_<CLASSNAME>_<OPERATION>` という形式のエラーコードを使用することを推奨します (例: `ERR_CLI_TASKMANAGER_CREATETASK`)。これにより、エラーの発生源を特定しやすくなります。
*   **Don't:**
    *   エラーを無視する (`catch` ブロックを空にする）。
    *   具体的な情報なしに一般的な `Error` をスローする。
    *   エラー情報を単に `console.log` するだけで処理を終える。

## 4. イベント駆動アーキテクチャ

*   **原則:** コンポーネント間の関心を分離し、疎結合なシステムを構築するためにイベント駆動アプローチを採用します。
*   **中心コンポーネント:** `src/lib/utils/event-emitter.js` (コアの `EnhancedEventEmitter` を拡張) がイベントの発行と購読を管理します。
*   **イベント発行:**
    *   **`emitStandardized(component, action, data)`:** 標準化されたイベントを発行するための主要メソッドです。
    *   **イベント構造:** `emitStandardized` によって発行されるイベントデータには、自動的に以下の情報が付与されます。
        *   `component`: イベントを発行したコンポーネント名 (例: `'git'`, `'storage'`)。
        *   `action`: 発生したアクション (例: `'commit_created'`, `'file_read_after'`)。
        *   `timestamp`: イベント発生時刻 (ISO 8601形式)。
        *   **`traceId`, `requestId`:** 操作やリクエストを追跡するためのID。`EventEmitter` インスタンスが持つIDジェネレーターによって自動的に生成・付与されます。
        *   `...data`: アクション固有のデータ。
    *   **イベント名:** `component:action` 形式を厳守します。これにより、イベントの発生源と種類が明確になります。
    *   **内部ヘルパー (`_emitEvent`):** ユーティリティクラス内でイベントを発行する場合、`_emitEvent(action, data)` のような内部ヘルパーメソッドを定義することを推奨します。このヘルパー内で `traceId`, `requestId` を生成し、`timestamp` と共にデータに追加してから `this.eventEmitter.emitStandardized()` を呼び出します。これにより、各ユーティリティクラス内でのイベント発行ロジックが統一されます。
        ```javascript
        // 例: StorageService の _emitEvent
        _emitEvent(eventName, data) {
          if (!this.eventEmitter || typeof this.eventEmitter.emitStandardized !== 'function') {
            return;
          }
          try {
            const traceId = this._traceIdGenerator(); // 内部で保持するジェネレーターを使用
            const requestId = this._requestIdGenerator();
            const standardizedData = {
              ...data,
              timestamp: new Date().toISOString(),
              traceId,
              requestId,
            };
            this.eventEmitter.emitStandardized('storage', eventName, standardizedData);
          } catch (error) {
            this.logger.warn(`イベント発行中にエラー: storage:${eventName}`, error);
          }
        }
        ```
*   **イベント購読:**
    *   `on(eventName, listener)`: イベントを購読します。
    *   `off(eventName, listener)`: イベント購読を解除します。
*   **利点:**
    *   **疎結合:** イベント発行者はリスナーを意識する必要がなく、リスナーも発行者を直接参照しません。
    *   **拡張性:** 新しいリスナーを追加しても、既存のコンポーネントへの影響が少なくなります。
    *   **非同期処理との親和性:** イベント発行と処理を非同期に行うことができます (`emitStandardizedAsync`)。
*   **Do:**
    ```javascript
    // GitService でコミット作成後にイベント発行
    this._emitEvent('commit_create_after', { message, hash, success: true });
    // _emitEvent 内部で emitStandardized('git', 'commit_create_after', ...) が呼ばれる

    // 別のコンポーネントでイベントを購読
    eventEmitter.on('git:commit_create_after', (eventData) => {
      if (eventData.success) {
        console.log(`New commit created: ${eventData.hash}`);
        console.log(`Trace ID: ${eventData.traceId}`); // traceId などが利用可能
      }
    });
    ```
*   **Don't:**
    *   コンポーネント間で直接メソッドを呼び出して密結合にする（イベントで代替できる場合）。
    *   標準化されていない形式でイベントを発行する (`emit` を直接使用するなど）。
    *   イベント名に一貫性がない。
    *   ユーティリティクラスやCLIクラス内で `emitStandardized` を直接呼び出す代わりに、`_emitEvent` ヘルパーパターンを使用する。CLIクラスでは、コンポーネント名を `'cli'`、アクション名を `<component>_<action>_<timing>` (例: `task_create_before`, `session_end_after`) とすることが多いです。

## 5. 非同期処理

*   **原則:** I/O操作（ファイルアクセス、ネットワーク通信、Git操作など）は非同期で行い、アプリケーションの応答性を維持します。
*   **方法:**
    *   **`async/await`:** 非同期処理を記述する際の標準的な方法として `async/await` を使用します。これにより、コールバックや Promise チェーンに比べてコードが読みやすくなります。
    *   **Promise:** `async` 関数は常に Promise を返します。Promise を返すライブラリ関数（例: `simple-git` の多くのメソッド）も `await` で処理します。
    *   **エラーハンドリング:** `async` 関数内のエラーは `try...catch` で捕捉します。Promise が拒否 (reject) される可能性のある処理は `await` と `try...catch` を組み合わせるか、`.catch()` メソッドで処理します。
*   **Do:**
    ```javascript
    async function performGitOperation() {
      try {
        const hash = await gitService.getCurrentCommitHash();
        const details = await gitService.getCommitDetails(hash);
        console.log(details);
      } catch (error) {
        // エラー処理 (例: ログ出力、errorHandler 呼び出し)
        logger.error('Git operation failed:', error);
      }
    }
    ```
*   **Don't:**
    *   `await` せずに Promise を返す関数を呼び出す（`floating promise`）。
    *   Promise の `.catch()` を省略する。
    *   同期的な I/O 操作（例: `fs.readFileSync`）を、ブロッキングが許容されないコンテキストで使用する（ただし、CLIツールなど一部のコンテキストでは許容される場合がある）。