# コーディング規約

このドキュメントは、プロジェクト全体で一貫したコードスタイルを維持するための規約を定義します。AI開発者を含むすべての開発者は、この規約に従ってコードを記述してください。

## 1. 命名規則

*   **変数、関数、メソッド、クラス名:** `camelCase` を使用します。
    *   例: `userData`, `calculateTotal`, `UserService`
*   **定数:** `UPPER_SNAKE_CASE` を使用します。
    *   例: `MAX_RETRIES`, `DEFAULT_TIMEOUT`
*   **ファイル名:**
    *   JavaScriptファイル: `kebab-case.js` (例: `user-service.js`)
    *   テストファイル: `kebab-case.test.js` (例: `user-service.test.js`)
    *   Markdownファイル: `kebab-case.md` (例: `coding-standards.md`)
*   **イベント名:** `component:action` 形式を使用します。コンポーネント名とアクション名は `snake_case` または `camelCase` を使用できますが、プロジェクト内で統一してください。（現状のコードでは `snake_case` が多いようです）
    *   例: `cache:item_set`, `git:commit_create_after`, `plugin:method_invoked`

## 2. フォーマット

*   コードのフォーマットは [Prettier](https://prettier.io/) によって自動的に行われます。設定はプロジェクトルートの [.prettierrc.json](/.prettierrc.json) を参照してください。
*   コードの静的解析には [ESLint](https://eslint.org/) を使用します。設定はプロジェクトルートの [eslint.config.js](/eslint.config.js) を参照してください。
*   **主要なルール:**
    *   インデント: スペース 2つ
    *   セミコロン: 必須
    *   引用符: シングルクォート (`'`) を優先
    *   その他、Prettier と ESLint の設定に従います。
*   コミット前にフォーマットとリンティングを実行することを推奨します。

## 3. コメント

*   **JSDoc:** クラス、メソッド、複雑な関数には JSDoc 形式でコメントを記述します。これにより、コードの意図が明確になり、AI もコードを理解しやすくなります。
    *   **必須タグ:**
        *   `@param {type} name - 説明`: 関数の引数。
        *   `@returns {type} 説明`: 関数の戻り値。
        *   `@throws {ErrorType} 説明`: 関数がスローする可能性のあるエラー。
    *   **推奨タグ:**
        *   `@description`: クラスや関数の概要説明。
        *   `@example`: 使用例。
        *   `@deprecated`: 非推奨の要素。
    *   **例:**
        ```javascript
        /**
         * ユーザーデータを取得します。
         * @param {string} userId - 取得するユーザーのID。
         * @returns {Promise<User|null>} ユーザーオブジェクト、または見つからない場合はnull。
         * @throws {DatabaseError} データベース接続に失敗した場合。
         */
        async function getUserData(userId) {
          // ... implementation ...
        }
        ```
*   **インラインコメント:** 複雑なロジックや、一見して意図が分かりにくい箇所には、必要に応じてインラインコメント (`//`) を追加します。
*   **TODOコメント:**
    *   一時的な修正や将来的な改善が必要な箇所には `TODO:` コメントを使用します。
    *   フォーマット: `// TODO: [担当者名 or JIRAチケット番号] [日付 YYYY-MM-DD] 説明`
    *   例: `// TODO: [Roo] [2025-03-30] エラー処理をより詳細にする`
    *   TODOコメントは定期的にレビューし、対応または削除を行います。

## 4. 言語機能ガイドライン

*   **非同期処理:**
    *   `async/await` を一貫して使用します。これにより、非同期コードが同期的であるかのように読み書きでき、可読性が向上します。
    *   Promise を返す関数を呼び出す際は、必ず `await` を使用するか、`.then()` と `.catch()` で適切に処理します。Promise を無視する (`floating promise`) ことは避けてください。
    *   **悪い例:** `doSomethingAsync(); // エラーや完了を待たない`
    *   **良い例:** `try { await doSomethingAsync(); } catch (error) { /* handle error */ }`
*   **エラー処理:**
    *   `try...catch` ブロックを使用して、エラーが発生する可能性のある処理を囲みます。
    *   捕捉したエラーは、単にコンソールに出力するだけでなく、より具体的なカスタムエラークラス（`src/lib/utils/errors.js` で定義されているもの、または必要に応じて追加したもの）にラップして再スローするか、`errorHandler` に処理を委譲します。
    *   エラーメッセージには、問題の原因を特定するのに役立つコンテキスト情報を含めるように努めます。
*   **変数宣言:**
    *   再代入しない変数は `const` を使用します。
    *   再代入が必要な変数は `let` を使用します。
    *   `var` は使用しません。
*   **その他:**
    *   ES6以降の構文（アロー関数、テンプレートリテラル、分割代入など）を積極的に活用し、コードを簡潔かつ読みやすくします。