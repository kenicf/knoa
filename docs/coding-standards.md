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
*   **テスト関連:**
    *   `describe` ブロック: テスト対象のクラス名や機能名を記述します (例: `'UserService'`, `'getUserData method'`)。
    *   `test` / `it` ブロック: テストケースの内容を具体的に記述します。`should` から始め、期待される動作を明確にします (例: `'should return user data for a valid ID'`, `'should throw NotFoundError if user does not exist'`)。
    *   モック変数/関数: `mock` プレフィックスをつけ、モック対象がわかるように命名します (例: `mockLogger`, `mockDbConnection`, `mockFetchUser`)。

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
*   **テストコードのコメント:**
    *   テストコードの可読性を高めるために、必要に応じてコメントを追加します。
    *   特に、[AAAパターン](./testing-guidelines.md#3-テスト構造-aaaパターン) の各セクション（Arrange, Act, Assert）をコメントで明示することを推奨します。
        ```javascript
        test('should ...', () => {
          // Arrange
          // ... setup code ...

          // Act
          // ... execute code under test ...

          // Assert
          // ... assertions ...
        });
        ```
    *   複雑なモックの設定やアサーションには、その意図を説明するコメントを追加します。

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

## 5. テストコード固有の規約

プロダクションコードと同様に、テストコードも一貫性があり、読みやすく、保守しやすい状態を保つことが重要です。

*   **明確なテスト名:** `describe` と `test`/`it` の名前は、テスト対象とその期待される動作を具体的に記述します（上記「命名規則」参照）。
*   **AAAパターンの適用:** 各テストケースは、原則として Arrange-Act-Assert の構造に従います（上記「テストコードのコメント」参照）。
*   **単一責任のテスト:** 各テストケースは、一つの具体的な動作や条件を検証することに集中します。複数のことを一度にテストしようとしないでください。
*   **適切なアサーション:** `expect` を使用して、テストの期待結果を明確に検証します。単にエラーが発生しないことを確認するだけでなく、具体的な値、状態、モックの呼び出しなどを検証します。
*   **マジックナンバー/文字列の回避:** テストコード内で使用する特定の数値や文字列には、意味のある定数名を付けるか、テストデータのセットアップで明確にします。
*   **テストヘルパーの活用:** 繰り返し使用するセットアップロジックやカスタムアサーションは、`tests/helpers` 内のヘルパー関数に抽出し、テストコードの重複を減らします ([テスト戦略とガイドライン](./testing-guidelines.md#7-テストヘルパー利用法-testshelpers) 参照)。
*   **プロダクションコードへの依存:** テストコードは、テスト対象のパブリックインターフェースに依存すべきであり、内部実装の詳細に過度に依存しないようにします。これにより、リファクタリング耐性が向上します。