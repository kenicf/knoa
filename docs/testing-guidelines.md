# テスト戦略とガイドライン

このドキュメントは、プロジェクトにおけるテストの記述方法、戦略、および利用可能なツールに関するガイドラインを提供します。高品質で保守性の高いコードベースを維持するために、これらのガイドラインに従ってください。

## 1. テストの目的

*   **リグレッション（デグレード）の防止:** コード変更によって既存の機能が壊れていないことを保証します。
*   **仕様の明確化:** テストコードは、コードがどのように動作すべきかの生きたドキュメントとして機能します。
*   **リファクタリングの安全性確保:** テストに保護されたコードは、安心してリファクタリングできます。
*   **設計の改善:** テスト容易性を考慮することで、より疎結合でモジュール化された設計が促進されます。

## 2. Jest利用法

本プロジェクトでは、テストフレームワークとして [Jest](https://jestjs.io/) を使用します。

*   **テストファイルの配置:** テスト対象のファイルが `src/lib/components/example.js` の場合、テストファイルは `tests/lib/components/example.test.js` のように、`tests` ディレクトリ以下の対応するパスに配置します。
*   **基本構造:**
    *   `describe(name, fn)`: 関連するテストケースをグループ化します。ネストすることも可能です。
    *   `test(name, fn)` または `it(name, fn)`: 個々のテストケースを定義します。テスト名は、テストする内容を具体的に記述します（例: `'should return null if file does not exist'`）。
    *   `beforeEach(fn)`: 各テストケースの実行前に実行されるセットアップ処理（モックの初期化など）を記述します。
    *   `afterEach(fn)`: 各テストケースの実行後に実行されるクリーンアップ処理（モックのリストアなど）を記述します。
    *   `expect(value)`: アサーション（検証）の起点となります。様々なマッチャー（`.toBe()`, `.toEqual()`, `.toHaveBeenCalled()`, `.toThrow()` など）を繋げて使用します。Jest のマッチャーについては [公式ドキュメント](https://jestjs.io/docs/expect) を参照してください。

*   **テストの実行:**
    *   すべてのテストを実行: `npm test`
    *   特定のテストファイルを実行: `npm test -- <path/to/file.test.js>`
    *   カバレッジレポート付きで実行: `npm test -- --coverage`

## 3. テストヘルパー利用法 (`tests/helpers`)

テストコードの記述を簡略化し、一貫性を保つために、`tests/helpers` ディレクトリにいくつかのヘルパー関数が用意されています。

*   **`mock-factory.js`:**
    *   `createMockLogger()`: `info`, `warn`, `error`, `debug` メソッドを持つモックロガーオブジェクトを生成します。各メソッドは `jest.fn()` です。
    *   `createMockEventEmitter()`: `emit`, `emitStandardized`, `on`, `once` などのメソッドを持つモックイベントエミッターオブジェクトを生成します。各メソッドは `jest.fn()` です。
    *   `createMockErrorHandler()`: `handle`, `register`, `unregister` メソッドを持つモックエラーハンドラーオブジェクトを生成します。`handle` メソッドは、オプションで指定されたデフォルト値を返すように設定できます。
    *   `mockTimestamp(isoString)`: `Date` オブジェクトと `Date.now()` をモックし、指定された ISO 文字列の時刻を返すようにします。テスト全体で時刻を固定したい場合に使用します。
    *   `createMockDependencies()`: `logger`, `eventEmitter`, `errorHandler` を含む共通のモック依存関係オブジェクトを生成します。`beforeEach` での使用を推奨します。
*   **`test-helpers.js`:**
    *   `expectStandardizedEventEmitted(emitter, component, action, expectedData)`: 指定されたモック `emitter` が、期待される `component`, `action`, および `expectedData` を持つ標準化されたイベントを発行したことを検証します。`expectedData` 内で `timestamp: 'any'` や正規表現、`expect.any(String)` などを使用できます。
    *   `expectLogged(logger, level, message)`: 指定されたモック `logger` の特定の `level` のメソッドが、期待される `message` を含む文字列で呼び出されたことを検証します。
*   **`path-helpers.js`:**
    *   `normalizePath(path)`: パス文字列の区切り文字を `/` に正規化します。OS によるパス区切り文字の違いを吸収するために使用します。
    *   `setupPathMatchers()`: Jest の `expect` にカスタムマッチャー `toMatchPath()` を追加します。このマッチャーは、`normalizePath` を使用してパスを比較します。テストファイルの先頭で呼び出す必要があります。
        ```javascript
        const { setupPathMatchers } = require('../../helpers/path-helpers');
        setupPathMatchers(); // マッチャーをセットアップ

        test('should normalize path', () => {
          expect('path\\to\\file').toMatchPath('path/to/file');
        });
        ```

## 4. モック戦略

テスト対象のユニットを隔離し、外部依存関係の影響を受けずにテストを行うためにモックを使用します。

*   **依存オブジェクトのモック:**
    *   クラスのコンストラクタに渡される依存オブジェクト（Logger, EventEmitter, Service など）は、`tests/helpers/mock-factory.js` のヘルパー関数や `jest.fn()` を使って生成したモックオブジェクトを使用します。
    *   `beforeEach` でモックオブジェクトを作成し、テスト対象のクラスインスタンスに注入します。
    *   **例:**
        ```javascript
        let service;
        let mockLogger;
        let mockDependency;

        beforeEach(() => {
          mockLogger = createMockLogger();
          mockDependency = { someMethod: jest.fn() };
          service = new MyService({ logger: mockLogger, dependency: mockDependency });
        });

        test('should call dependency method', () => {
          service.doWork();
          expect(mockDependency.someMethod).toHaveBeenCalled();
        });
        ```
*   **メソッドのモック/スパイ:**
    *   `jest.spyOn(object, methodName)`: オブジェクトの特定のメソッドの呼び出しを監視したり、その実装を一時的に置き換えたり（スタブ化）します。元の実装を呼び出すことも、モック実装を提供することも可能です。テスト後に `jest.restoreAllMocks()` で元の実装に戻すことが重要です。
    *   **例 (スパイ):**
        ```javascript
        const spy = jest.spyOn(console, 'log');
        myFunctionThatLogs();
        expect(spy).toHaveBeenCalledWith('Expected log message');
        spy.mockRestore(); // スパイを解除
        ```
    *   **例 (スタブ):**
        ```javascript
        const mockDate = new Date('2023-01-01');
        const dateSpy = jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
        // ... test code ...
        dateSpy.mockRestore(); // モックを解除
        ```
*   **モジュール全体のモック:**
    *   `jest.mock('module-name')`: モジュール全体（例: `fs`, `simple-git`）をモックします。テストファイルの先頭で呼び出します。デフォルトでは、モジュールのすべてのエクスポートが `jest.fn()` になります。特定の実装を提供することも可能です。
    *   **例 (`fs`):**
        ```javascript
        jest.mock('fs'); // ファイルの先頭でモック
        const fs = require('fs');

        test('should read file', () => {
          fs.readFileSync.mockReturnValue('mock file content');
          const content = readFileFunction('path/to/file');
          expect(fs.readFileSync).toHaveBeenCalledWith('path/to/file', 'utf8');
          expect(content).toBe('mock file content');
        });

## 5. 非同期テスト

*   テスト対象のコードが非同期処理（Promise を返す関数や `async` 関数）を含む場合、Jest の非同期テスト機能を使用します。
*   **`async/await`:** テストケース関数 (`test` または `it`) を `async` として定義し、非同期処理の結果を `await` で待ちます。
    ```javascript
    test('should fetch user data correctly', async () => {
      mockApiService.fetchUser.mockResolvedValue({ id: 1, name: 'Test User' });
      const user = await userService.getUser(1);
      expect(user.name).toBe('Test User');
    });
    ```
*   **`.resolves` / `.rejects` マッチャー:** Promise が期待通りに解決 (resolve) または拒否 (reject) されるかを検証します。
    ```javascript
    test('should resolve with user data', async () => {
      mockApiService.fetchUser.mockResolvedValue({ id: 1, name: 'Test User' });
      await expect(userService.getUser(1)).resolves.toEqual({ id: 1, name: 'Test User' });
    });

    test('should reject if user not found', async () => {
      const error = new Error('User not found');
      mockApiService.fetchUser.mockRejectedValue(error);
      await expect(userService.getUser(999)).rejects.toThrow('User not found');
    });
    ```

## 6. イベントテスト

*   `EventEmitter` を使用してイベントを発行するコードをテストする場合、イベントが期待通りに発行されたかを検証します。
*   **`expectStandardizedEventEmitted` ヘルパー:** `tests/helpers/test-helpers.js` に定義されている `expectStandardizedEventEmitted` を使用します。
    *   引数: `(emitter, component, action, expectedData)`
    *   `emitter`: モック化された EventEmitter インスタンス。
    *   `component`: 期待されるコンポーネント名 (文字列)。
    *   `action`: 期待されるアクション名 (文字列)。
    *   `expectedData`: 期待されるイベントデータ (オブジェクト)。
        *   `timestamp: 'any'` を使用すると、タイムスタンプの存在と ISO 8601 形式であることを検証します。
        *   正規表現や `expect.any(String)` など、Jest の非対称マッチャーも使用できます。
    *   **例:**
        ```javascript
        test('should emit item_set event when setting cache', () => {
          cacheManager.set('myKey', 'myValue', 5000);
          expectStandardizedEventEmitted(mockEventEmitter, 'cache', 'item_set', {
            key: 'myKey',
            ttl: 5000,
            timestamp: 'any', // タイムスタンプの存在と形式を検証
            traceId: expect.any(String), // traceId の存在を検証
            requestId: expect.any(String), // requestId の存在を検証
          });
        });
        ```

## 7. エラーハンドリングテスト

*   コードがエラー状況を適切に処理することを検証します。
*   **同期エラー:** `expect(() => { ... }).toThrow()` を使用します。
    ```javascript
    test('should throw error if logger is not provided', () => {
      expect(() => new MyService({})).toThrow('Logger instance is required');
    });
    ```
*   **非同期エラー:** `expect(async () => { ... }).rejects.toThrow()` または `.rejects.toThrowError()` を使用します。
    ```javascript
    test('should throw GitError if commit fails', async () => {
      const commitError = new Error('Git commit failed');
      mockGit.commit.mockRejectedValue(commitError);
      await expect(gitService.createCommit('message')).rejects.toThrow(GitError);
      // エラーメッセージや原因も検証可能
      await expect(gitService.createCommit('message')).rejects.toThrowError(
          expect.objectContaining({
              message: expect.stringContaining('コミットの作成に失敗しました'),
              cause: commitError
          })
      );
    });
    ```
*   **`errorHandler` の検証:** `errorHandler.handle` が期待通りに呼び出されたかを `expect(mockErrorHandler.handle).toHaveBeenCalledWith(...)` で検証します。

## 8. カバレッジ

*   **目標:** コードベースの品質と信頼性を確保するため、テストカバレッジの目標を設定します。一般的には **Statement カバレッジで 80% 以上** を目指します。
*   **測定:** `npm run test -- --coverage` コマンドを実行すると、カバレッジレポートが `coverage/lcov-report/index.html` に生成されます。
*   **注意点:** カバレッジ率はあくまで指標の一つです。100% であってもテストの質が低い（アサーションが不十分など）可能性はあります。重要なロジックやエラーパスが適切にテストされているかを確認することが重要です。カバレッジが低い箇所は、テストケースを追加する候補となります。

## 9. エディタ連携 (VS Code 推奨)

開発効率とコード品質の一貫性を高めるために、エディタと ESLint/Prettier を連携させることを強く推奨します。以下は VS Code での設定例です。

1.  **拡張機能のインストール:**
    *   [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
    *   [Prettier - Code formatter](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

2.  **VS Code 設定 (`settings.json`):**
    *   ワークスペース設定 (`.vscode/settings.json`) またはユーザー設定に以下を追加します。

    ```json
    {
      // ファイル保存時に Prettier でフォーマットする
      "editor.formatOnSave": true,
      // デフォルトフォーマッターとして Prettier を指定
      "editor.defaultFormatter": "esbenp.prettier-vscode",
      // ファイル保存時に ESLint の自動修正を実行する
      "editor.codeActionsOnSave": {
        "source.fixAll.eslint": "explicit" // "explicit" または true
      },
      // JavaScript ファイルに対して上記設定を有効にする (任意)
      "[javascript]": {
        "editor.formatOnSave": true,
        "editor.defaultFormatter": "esbenp.prettier-vscode",
        "editor.codeActionsOnSave": {
          "source.fixAll.eslint": "explicit"
        }
      }
    }
    ```

これにより、ファイルを保存するたびに Prettier によるフォーマットと ESLint による自動修正が実行され、コーディング中に規約違反を即座に修正できます。

