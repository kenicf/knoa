# テスト戦略とガイドライン

このドキュメントは、プロジェクトにおけるテストの記述方法、戦略、および利用可能なツールに関するガイドラインを提供します。高品質で保守性の高いコードベースを維持するために、これらのガイドラインに従ってください。

## 1. テストの目的

*   **リグレッション（デグレード）の防止:** コード変更によって既存の機能が壊れていないことを保証します。
*   **仕様の明確化:** テストコードは、コードがどのように動作すべきかの生きたドキュメントとして機能します。
*   **リファクタリングの安全性確保:** テストに保護されたコードは、安心してリファクタリングできます。
*   **設計の改善:** テスト容易性を考慮することで、より疎結合でモジュール化された設計が促進されます。

## 2. テスト設計の原則 (FIRST原則)

良い単体テストは以下の FIRST 原則を満たすべきです。

*   **Fast (高速):** テストは迅速に実行されるべきです。実行に時間がかかるテストは、開発サイクル中に頻繁に実行されなくなり、フィードバックループが遅くなります。遅いテストは、外部依存（ネットワーク、DB、ファイルシステム）を伴う場合が多いため、モック化を検討します。
*   **Independent (独立):** 各テストは他のテストから独立しているべきです。テストの実行順序に依存したり、他のテストの結果に影響を与えたりしてはいけません。`beforeEach` や `afterEach` を使用して、各テストの実行前に状態をリセットし、クリーンアップします。
    *   **Do:** `beforeEach(() => { jest.clearAllMocks(); /* 状態リセット */ });`
    *   **Don't:** あるテストが作成したデータを別のテストが利用する。
*   **Repeatable (反復可能):** テストはどの環境（開発者のローカル環境、CIサーバーなど）でも、何度実行しても同じ結果になるべきです。外部環境の状態（現在時刻、ネットワーク接続、ファイルシステムの特定の内容など）に依存するテストは避けます。必要であれば、時間や外部サービスをモックします。
*   **Self-Validating (自己検証可能):** テストは、その実行結果（成功または失敗）を自身で判断できるべきです。テスト結果の解釈のために手動での確認（ログの目視確認など）が必要なテストは避けます。Jest の `expect` マッチャーを使用して、期待される結果を明確にアサーションします。
*   **Thorough (徹底的):** テストは、対象コードの重要な側面を網羅するべきです。正常系だけでなく、境界値、エラーケース、エッジケースもテストします。カバレッジは指標の一つですが、単にコード行を実行するだけでなく、意味のあるシナリオをテストすることが重要です。

## 3. テスト構造 (AAAパターン)

テストコードの可読性と保守性を高めるために、Arrange-Act-Assert (AAA) パターンに従うことを推奨します。

*   **Arrange (準備):** テストに必要な前提条件や入力データを準備します。これには、テスト対象オブジェクトのインスタンス化、依存関係のモック化、入力値の設定などが含まれます。
*   **Act (実行):** テスト対象のメソッドや関数を実行します。通常、このセクションは1行か数行になります。
*   **Assert (検証):** 実行結果が期待通りであるかを検証します。Jest の `expect` を使用して、戻り値、モックの呼び出し、状態の変化などをアサーションします。

*   **例:**
    ```javascript
    test('should add two numbers correctly', () => {
      // Arrange (準備)
      const calculator = new Calculator();
      const num1 = 5;
      const num2 = 10;
      const expectedSum = 15;

      // Act (実行)
      const actualSum = calculator.add(num1, num2);

      // Assert (検証)
      expect(actualSum).toBe(expectedSum);
    });
    ```
*   各テストケースはこの3つの明確なセクションに分けることで、テストの目的と内容が理解しやすくなります。

## 4. テスト容易性のための設計

テストしやすいコードは、結果としてよりモジュール化され、保守しやすいコードになる傾向があります。

*   **重要性:** テスト容易性が低いコードは、テストを書くのが困難または不可能になり、バグの発見が遅れたり、リファクタリングが妨げられたりします。
*   **原則:**
    *   **依存性注入 (DI):** [設計原則](design-principles.md) で推奨されている通り、依存関係は外部から注入します。これにより、テスト時に依存関係をモックに差し替えることが容易になります。
    *   **副作用の分離:** 外部システムへの書き込み、グローバル状態の変更、ファイルI/Oなどの副作用を持つロジックは、純粋な計算ロジックから分離します。副作用を持つ部分は薄いラッパーとし、テストではモック化します。
    *   **純粋関数の利用:** 可能な限り純粋関数（同じ入力に対して常に同じ出力を返し、副作用を持たない関数）を使用します。純粋関数は入力と出力のみを考慮すればよいため、テストが非常に容易です。
    *   **インターフェースの明確化:** クラスやモジュールのパブリックインターフェースを明確に定義します。これにより、テスト対象の境界が明確になり、内部実装の詳細に依存しないテストが書けます。
*   **リファクタリング例:**
    *   **悪い例 (テストしにくい):**
        ```javascript
        class UserService {
          constructor() {
            this.db = new DatabaseConnection(); // 内部で直接生成
          }
          async getUser(userId) {
            const user = await this.db.query('SELECT * FROM users WHERE id = ?', userId);
            // ... 加工処理 ...
            return user;
          }
        }
        ```
    *   **良い例 (テストしやすい):**
        ```javascript
        class UserService {
          constructor(options = {}) {
            if (!options.db) throw new Error('Database dependency is required');
            this.db = options.db; // DI
          }
          async getUser(userId) {
            const user = await this.db.query('SELECT * FROM users WHERE id = ?', userId);
            // ... 加工処理 ...
            return user;
          }
        }
        // テスト時
        const mockDb = { query: jest.fn().mockResolvedValue({ id: 1, name: 'Test' }) };
        const service = new UserService({ db: mockDb });
        await service.getUser(1);
        expect(mockDb.query).toHaveBeenCalledWith(expect.any(String), 1);
        ```

## 5. モック戦略と契約によるテスト

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
    *   **共通依存関係のモック:** 多くのクラスが共通の依存関係（Logger, EventEmitter, ErrorHandler など）を持つため、`tests/helpers/mock-factory.js` の `createMockDependencies()` を使用して、これらのモックをまとめて生成し、`beforeEach` で利用することを推奨します。これにより、テストセットアップの記述が簡潔になります。
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
        ```
*   **契約によるテスト:**
    *   **目的:** モックオブジェクトと、それが模倣する実際の依存オブジェクトとの間のインターフェースや振る舞いの一貫性を保つことを目指します。モックが実際の依存関係の「契約」に従っていることを保証することで、テストの信頼性を高めます。
    *   **実践方法:**
        *   **インターフェース/型定義の活用:** TypeScript を使用している場合、インターフェースや型定義を共有することで、モックと実オブジェクトのシグネチャの一致をコンパイル時に保証できます。
        *   **モックファクトリの活用:** `tests/helpers/mock-factory.js` のようなファクトリ関数を使用して、一貫性のあるモックオブジェクトを生成します。ファクトリ内で、モック対象のクラスが持つべきメソッドや基本的な振る舞いを定義します。**特に、コンストラクタでの初期化処理や、メソッド内でのデータ加工・追加（例: `EventEmitter.emitStandardized` での `traceId`/`requestId` 付与）など、テストに影響を与える可能性のある動作は、モックでも正確に模倣する必要があります。**
        *   **共有テストスイート (オプション):** より高度な方法として、モックと実オブジェクトの両方に対して実行できる共有のテストスイートを作成し、インターフェース契約を検証することも考えられます（例: Pactなどの消費者駆動契約テストツール）。現時点では必須ではありませんが、API連携などで有効な場合があります。
    *   **注意点:** モックは便利ですが、過度に使用するとテストが実装の詳細に結合しすぎ、リファクタリング耐性が低下する可能性があります。可能な限り、実際の依存関係に近い振る舞いをするモックを作成し、インターフェースに基づいたテストを心がけます。**実実装が変更された場合は、関連するモックファクトリも必ず更新し、乖離を防いでください。**

## 6. Jest利用法

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

## 7. テストヘルパー利用法 (`tests/helpers`)

テストコードの記述を簡略化し、一貫性を保つために、`tests/helpers` ディレクトリにいくつかのヘルパー関数が用意されています。

*   **`mock-factory.js`:**
    *   `createMockLogger()`: `info`, `warn`, `error`, `debug` メソッドを持つモックロガーオブジェクトを生成します。各メソッドは `jest.fn()` です。
    *   `createMockEventEmitter()`: `emit`, `emitStandardized`, `on`, `once` などのメソッドを持つモックイベントエミッターオブジェクトを生成します。各メソッドは `jest.fn()` です。**注意:** このモックは、実際の `EventEmitter` が行う `traceId` や `requestId` の自動付与などの動作を模倣しない場合があります。イベントデータの検証を行う際は、この点を考慮してください（[イベントテスト](#9-イベントテスト) 参照）。
    *   `createMockErrorHandler()`: `handle`, `register`, `unregister` メソッドを持つモックエラーハンドラーオブジェクトを生成します。`handle` メソッドは、オプションで指定されたデフォルト値を返すように設定できます。
    *   `mockTimestamp(isoString)`: `Date` オブジェクトと `Date.now()` をモックし、指定された ISO 文字列の時刻を返すようにします。テスト全体で時刻を固定したい場合に使用します。
    *   `createMockDependencies()`: `logger`, `eventEmitter`, `errorHandler` を含む共通のモック依存関係オブジェクトを生成します。`beforeEach` での使用を推奨します。
*   **`test-helpers.js`:**
    *   `expectStandardizedEventEmitted(emitter, component, action, expectedData)`: **同期的な**標準化イベント発行 (`emitStandardized`) を検証します。
    *   `expectStandardizedEventEmittedAsync(emitter, component, action, expectedData)`: **非同期的な**標準化イベント発行 (`emitStandardizedAsync`) を検証します。CLIコンポーネントの `_emitEvent` ヘルパーはこちらを使用しているため、CLIのテストでは主にこちらを使用します。引数や注意点は `expectStandardizedEventEmitted` と同様です。
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

## 8. 非同期テスト

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

## 9. イベントテスト

*   `EventEmitter` を使用してイベントを発行するコードをテストする場合、イベントが期待通りに発行されたかを検証します。
*   **`expectStandardizedEventEmitted` ヘルパー:** `tests/helpers/test-helpers.js` に定義されている `expectStandardizedEventEmitted` を使用します。
    *   引数: `(emitter, component, action, expectedData)`
    *   `emitter`: モック化された EventEmitter インスタンス。
    *   `component`: 期待されるコンポーネント名 (文字列)。
    *   `action`: 期待されるアクション名 (文字列)。
    *   `expectedData`: 期待されるイベントデータ (オブジェクト)。
        *   `timestamp: 'any'` を使用すると、タイムスタンプの存在と ISO 8601 形式であることを検証します。
        *   正規表現や `expect.any(String)` など、Jest の非対称マッチャーも使用できます。
    *   **注意点:**
        *   `expectedData` で指定するキーと値の形式は、**実際に `emitStandardized` に渡されるデータ**と正確に一致する必要があります。
        *   特に、イベント発行側の実装（例: `StorageService._emitEvent`）がデータを加工している場合（例: `directory` と `filename` を結合して `path` にする）、テストの期待値もそれに合わせる必要があります。
        *   **例 (修正前後の比較):**
            ```javascript
            // 修正前 (テスト失敗の原因): directory/filename を期待
            expectStandardizedEventEmitted(mockEmitter, 'storage', 'file_write_before', {
              directory: TEST_DIR,
              filename: TEST_FILE_JSON,
              type: 'json',
              timestamp: 'any',
              // traceId/requestId の検証はヘルパー内部で行われる (以前のバージョン)
            });

            // 修正後 (成功する期待値): path を期待
            expectStandardizedEventEmitted(mockEmitter, 'storage', 'file_write_before', {
              path: NATIVE_JSON_PATH, // 実際のデータ形式に合わせる
              type: 'json',
              timestamp: 'any',
              traceId: expect.any(String),
              requestId: expect.any(String),
            });
            ```
    *   **例:**
        ```javascript
        test('should emit item_set event when setting cache', () => {
          cacheManager.set('myKey', 'myValue', 5000);
          // CacheManager._emitEvent が traceId/requestId を付与するため、それを期待する
          expectStandardizedEventEmitted(mockEventEmitter, 'cache', 'item_set', {
            key: 'myKey',
            ttl: 5000,
            timestamp: 'any',
            traceId: expect.any(String),
            requestId: expect.any(String),
          });
        });
        ```

## 10. エラーハンドリングテスト

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
*   **ログ出力の検証:** エラー時に特定のログが出力されることを検証する場合、`expect(mockLogger.error).toHaveBeenCalledWith(...)` などを使用します。
    *   **注意:** アサーション対象のエラーオブジェクトの構造に注意してください。`toThrowError` で検証するエラーオブジェクトと、`logger.error` などに渡されるエラーオブジェクト（またはそれを含むオブジェクト）は異なる場合があります。
        *   **例 (`LockManager` のタイムアウトテスト):**
            ```javascript
            // エラーがスローされること自体の検証
            await expect(acquirePromise).rejects.toThrow(TimeoutError);
            // スローされたエラーオブジェクトのプロパティ検証
            await expect(acquirePromise).rejects.toMatchObject({
              name: 'TimeoutError',
              code: 'ERR_LOCK_TIMEOUT',
              context: expect.objectContaining({ resourceId, lockerId, timeout }),
            });
            // logger.warn に渡される引数の検証 (第2引数は { error: ActualErrorObject })
            expect(mockLogger.warn).toHaveBeenCalledWith(
              `Lock acquisition timed out for resource: ${resourceId}`,
              {
                error: expect.objectContaining({ // error プロパティの中身を検証
                  name: 'TimeoutError',
                  code: 'ERR_LOCK_TIMEOUT',
                }),
              }
            );
*   **`_handleError` メソッドのテスト:** CLIクラスなどで使用されている `_handleError` 内部ヘルパーメソッドをテストする場合、以下の点を検証します。
    *   適切なエラークラス（`CliError` など）でエラーがラップされているか。
    *   `emitErrorEvent` ヘルパーが期待される引数で呼び出されているか。
    *   `errorHandler` が提供されている場合に、`errorHandler.handle` が期待される引数で呼び出され、その戻り値が返されるか。
    *   `errorHandler` が提供されていない場合に、ラップされたエラーがスローされるか。
            ```

## 11. テストコードのリファクタリング

テストコードもプロダクションコードと同様に、可読性、保守性、信頼性を維持するためにリファクタリングが必要です。

*   **目的:**
    *   テストの意図を明確にする。
    *   重複を排除する。
    *   テストの実行速度を改善する。
    *   テストの信頼性を高める。
*   **テクニック:**
    *   **テストヘルパー関数の作成と活用:** 繰り返し現れるセットアップロジックやアサーションは、`tests/helpers` 内のヘルパー関数に抽出します (例: `expectStandardizedEventEmitted`)。
    *   **テストデータの共通化:** 複数のテストケースで使用するテストデータは、`describe` ブロックのスコープや別ファイルで定義し、共通化します。
    *   **カスタムマッチャーの利用:** プロジェクト固有の複雑なアサーションは、Jest のカスタムマッチャー ([`expect.extend`](https://jestjs.io/docs/expect#expectextendmatchers)) として定義し、テストコードを簡潔にします (例: `toMatchPath`)。
    *   **セットアップ/クリーンアップの共通化:** `beforeEach`, `afterEach`, `beforeAll`, `afterAll` を効果的に使用し、テストケース間の重複する準備・後処理コードを共通化します。
    *   **AAAパターンの徹底:** テストケースが Arrange-Act-Assert の構造に従っているか確認し、逸脱している場合は修正します。
    *   **記述的なテスト名:** `test` や `describe` の名前は、テストの内容や目的を具体的に示すようにします。

## 12. カバレッジ

*   **目標:** コードベースの品質と信頼性を確保するため、テストカバレッジの目標を設定します。一般的には **Statement カバレッジで 80% 以上** を目指します。
*   **測定:** `npm run test -- --coverage` コマンドを実行すると、カバレッジレポートが `coverage/lcov-report/index.html` に生成されます。
*   **注意点:** カバレッジ率はあくまで指標の一つです。100% であってもテストの質が低い（アサーションが不十分など）可能性はあります。重要なロジックやエラーパスが適切にテストされているかを確認することが重要です。カバレッジが低い箇所は、テストケースを追加する候補となります。

## 13. エディタ連携 (VS Code 推奨)

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
