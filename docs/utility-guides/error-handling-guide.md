# エラーハンドリング利用ガイド (`src/lib/utils/errors.js`, `src/lib/utils/error-helpers.js`)

## 1. 目的

アプリケーション全体で一貫性のあるエラー処理を実現し、エラーの原因特定とデバッグを容易にすることを目的とします。カスタムエラークラスの定義、エラーイベントの標準化された発行、およびエラー処理戦略の基盤を提供します。

## 2. エラークラス (`src/lib/utils/errors.js`)

*   **基本クラス:** すべてのカスタムエラーは、`src/lib/core/error-framework.js` で定義されている `ApplicationError` を直接または間接的に継承します。`ApplicationError` は、標準の `Error` オブジェクトを拡張し、`code` (エラーコード) や `context` (追加情報) などのプロパティを追加します。
*   **コアエラークラス:** `error-framework.js` では、汎用的なエラークラスが定義されています。これらは `src/lib/utils/errors.js` で再エクスポートされ、アプリケーション全体で使用できます。
    *   `ValidationError`: 入力データ検証エラー。
    *   `StateError`: 不正な状態遷移や操作順序エラー。
    *   `DataConsistencyError`: データ不整合エラー。
    *   `TimeoutError`: 操作タイムアウトエラー。
    *   `LockError`: リソースロック関連エラー。
    *   `ConfigurationError`: 設定不備エラー。
    *   `AuthorizationError`: 権限不足エラー。
    *   `NotFoundError`: リソースが見つからないエラー。
    *   `ExternalServiceError`: 外部サービス連携エラー。
*   **ユーティリティ固有エラー:** `src/lib/utils/errors.js` では、特定のユーティリティに関連するエラークラスも定義されています。
    *   `GitError`: `GitService` で発生したエラー。
    *   `StorageError`: `StorageService` で発生したエラー。
*   **エラークラスの利用:**
    *   エラーを `throw` する際は、状況に最も適したエラークラスを選択してください。
    *   コンストラクタには、エラーメッセージ、原因となった元のエラー (`cause`)、および関連するコンテキスト情報 (`context`) を渡すことができます。
    *   **例:**
        ```javascript
        if (!isValid(input)) {
          throw new ValidationError('Invalid user input provided', { context: { field: 'email' } });
        }
        try {
          await gitService.createCommit(message);
        } catch (error) {
          // GitError でラップして再スロー
          throw new GitError('Failed to create commit', error, { context: { message } });
        }
        ```

## 3. エラーヘルパー (`src/lib/utils/error-helpers.js`)

*   **`emitErrorEvent(eventEmitter, logger, component, operation, error, [context=null], [details={}])`:**
    *   標準化されたエラー処理とイベント発行を行うためのヘルパー関数です。
    *   **機能:**
        1.  `logger` があれば、エラー情報をログに出力します (`logger.error`)。
        2.  `context` オブジェクト (OperationContext など) があれば、その `setError` メソッドを呼び出してエラー情報を記録します。
        3.  `eventEmitter` があれば、標準化された `app:error` イベントを発行します。
    *   **引数:**
        *   `eventEmitter`: EventEmitter インスタンス。
        *   `logger`: Logger インスタンス。
        *   `component`: エラーが発生したコンポーネント名 (例: `'GitService'`)。
        *   `operation`: エラーが発生した操作名 (例: `'createCommit'`)。
        *   `error`: 発生した Error オブジェクト。
        *   `context`: オプション。操作コンテキストオブジェクト。
        *   `details`: オプション。エラーに関する追加の詳細情報。
    *   **`app:error` イベントデータ:**
        ```json
        {
          "component": "GitService",
          "operation": "createCommit",
          "message": "Failed to create commit",
          "code": "ERR_GIT", // error.code または 'ERR_UNKNOWN'
          "timestamp": "...", // ISO 8601 形式
          "details": { "message": "Commit message" }, // details 引数の内容
          "_context": "context-id-123" // context.id (あれば)
        }
        ```
    *   **利用箇所:** 主にユーティリティクラス内の `_handleError` メソッドのような、エラー処理を一元化する箇所で使用されることが想定されますが、アプリケーションコードで直接使用することも可能です。

*   **例:**
    ```javascript
    // GitService の _handleError メソッド内での使用例 (簡略化)
    _handleError(message, error, context = {}) {
      const gitError = new GitError(message, error, context);

      // errorHandler があれば委譲 (emitErrorEvent は呼ばれない)
      if (this.errorHandler && typeof this.errorHandler.handle === 'function') {
        return this.errorHandler.handle(gitError, 'GitService', context.operation, context);
      }

      // errorHandler がなければ、emitErrorEvent を直接呼び出す (現在の実装とは異なるが、ヘルパーの意図を示す例)
      emitErrorEvent(
        this.eventEmitter,
        this.logger,
        'GitService',
        context.operation,
        gitError,
        null, // OperationContext を渡す場合もある
        context // details として渡す
      );

      // エラーをスロー
      throw gitError;
    }
    ```
    *(注: 現在の `GitService._handleError` 実装では、`errorHandler` がない場合に直接 `logger.error` を呼び出しています。`emitErrorEvent` を使用するようにリファクタリングすることも可能です。)*

## 4. 発行されるイベント

*   **`app:error`:** `emitErrorEvent` ヘルパー関数によって発行される、アプリケーション全体のエラーイベントです。

## 5. 注意点とベストプラクティス

*   **適切なエラークラスの選択:** エラーの性質を最もよく表すエラークラスを使用してください。これにより、`catch` ブロックでのエラー種別に応じた分岐処理が容易になります。
*   **エラーのラップ:** 低レベルのエラーを捕捉した場合は、そのまま再スローするのではなく、意味のあるカスタムエラークラスでラップし、`cause` プロパティに元のエラーを設定してください。
*   **コンテキスト情報の付与:** エラーの原因究明に役立つ情報（関連するID、パラメータ、状態など）をエラーオブジェクトの `context` プロパティや `emitErrorEvent` の `details` 引数に含めてください。
*   **`errorHandler` の活用:** アプリケーション全体で共通のエラー処理（例: 特定のエラーはリトライする、特定のエラーは通知する）を行いたい場合は、`errorHandler` を実装し、各ユーティリティクラスのコンストラクタに渡すことを検討してください。
*   **イベント監視:** `app:error` イベントを購読することで、アプリケーション全体のエラー発生状況を監視し、ログ集約システムや監視ツールに連携させることができます。