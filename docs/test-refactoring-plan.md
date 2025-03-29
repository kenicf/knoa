# テストコードリファクタリング計画

## 1. リファクタリングポイントの洗い出し

現状分析に基づき、以下のリファクタリングポイントを特定しました。

*   **テストヘルパーの改善:**
    *   `tests/helpers/test-helpers.js`:
        *   `expectEventEmitted` を削除または非推奨とし、全てのイベント検証を `expectStandardizedEventEmitted` に統一する。
        *   `expectErrorHandled` を見直す。エラーをスローする実装が増えたため、try-catch と `expect(error).toBeInstanceOf(ExpectedError)`、`expect(error.code).toBe(...)`、`expect(error.context).toEqual(...)` などを用いた検証方法を推奨し、ヘルパーを修正または削除する。
    *   `tests/helpers/mock-factory.js`:
        *   `createMockErrorHandler` の `defaultReturnValues` が、最新のユーティリティクラスの操作名（特に `GitService`, `StorageService`）と整合性が取れているか確認・修正する。
        *   `createMockDependencies` が、各クラスで必須となった依存関係（特に `logger`, `eventEmitter`）を正しく反映しているか確認・修正する。
*   **テストコード全体の一貫性向上:**
    *   **イベント検証:** 全てのテストファイルで `expectStandardizedEventEmitted` を使用するように統一する。イベント名、コンポーネント名、期待されるデータ構造が正しいか確認する。
    *   **エラー検証:** エラーハンドリングの検証方法を統一する。エラーをスローする場合は try-catch と `expect(...).toThrow(ExpectedError)` や `expect(error).toBeInstanceOf(...)` を使用し、エラーハンドラに委譲する場合は `mockErrorHandler.handle` の呼び出しを検証する（ただし、エラーハンドラへの委譲は減っている可能性あり）。エラーコード (`code`) やコンテキスト (`context`) の検証も追加する。
    *   **モック:**
        *   `beforeEach` での依存関係（logger, eventEmitter など）のモック生成とインスタンス生成を徹底する。`createMockDependencies` の活用を検討する。
        *   `jest.clearAllMocks()` や `jest.restoreAllMocks()` を `beforeEach` や `afterEach` で適切に使用する。
        *   時間関連のモック (`Date.now`, `setTimeout` など) の設定とリセットを確実に行う。`mockTimestamp` ヘルパーの利用を検討する。
        *   外部ライブラリ (`fs`, `simple-git`, `path` など) のモック方法を `jest.mock` を使った方法に統一する。
    *   **テスト記述:**
        *   `describe`, `test` (または `it`) の使い分け、テストケースの命名規則を統一する。
        *   Arrange-Act-Assert (AAA) パターンを意識した記述に統一する。
        *   不要なコメントや `console.log` を削除する。
*   **テスト品質の向上:**
    *   **網羅性:** 各メソッドについて、正常系だけでなく、異常系（不正な入力、エラー発生時など）や境界値のテストケースを追加する。
    *   **具体性:** アサーションをより具体的にする (`expect.any(String)` ではなく具体的な値を期待するなど）。
    *   **DRY原則:** 共通するセットアップや検証ロジックがあれば、`beforeEach` やヘルパー関数にまとめる。
    *   **実装との整合性:** ユーティリティクラスの変更（メソッド名、引数、返り値、イベント名、エラー処理）がテストコードに正しく反映されているか再確認する。

## 2. リファクタリング計画ステップ

以下のステップでリファクタリングを進めます。

```mermaid
graph LR
    subgraph Step 1: テストヘルパーの修正
        A[test-helpers.js の修正] --> B(イベント/エラー検証ヘルパー見直し);
        C[mock-factory.js の修正] --> D(モック生成関数の整合性確認);
    end

    subgraph Step 2: テストコード全体のリファクタリング
        E[イベント検証の統一] --> F(expectStandardizedEventEmitted へ);
        G[エラー検証の統一] --> H(try-catch / expect.toThrow へ);
        I[モック方法の統一] --> J(jest.mock / beforeEach 活用);
        K[テスト記述の統一] --> L(AAAパターン / 命名規則);
        M[テスト網羅性の向上] --> N(異常系 / 境界値テスト追加);
    end

    subgraph Step 3: レビューと微調整
        O[コードレビュー] --> P(フィードバック反映);
    end

    Step 1 --> Step 2 --> Step 3;

```

**計画の詳細:**

1.  **Step 1: テストヘルパーの修正**
    *   `tests/helpers/test-helpers.js`:
        *   `expectEventEmitted` を削除。
        *   `expectErrorHandled` を削除または try-catch ベースの検証を推奨するコメントを追加。
        *   `expectStandardizedEventEmitted` が最新のイベントデータ構造（timestamp, traceId, requestId など）を適切に検証できるように確認・修正。
    *   `tests/helpers/mock-factory.js`:
        *   `createMockErrorHandler` の `defaultReturnValues` を `GitService`, `StorageService` のメソッドリストと照合し、不足や齟齬があれば修正。
        *   `createMockDependencies` が `logger` と `eventEmitter` を確実に含み、他の依存関係も必要に応じて含めるように確認・修正。
2.  **Step 2: テストコード全体のリファクタリング (各 `*.test.js` ファイルに対して実施)**
    *   **イベント検証:** `expectEventEmitted` を `expectStandardizedEventEmitted` に置き換える。イベント名、コンポーネント名、期待されるデータ（特に `timestamp`, `traceId`, `requestId` の有無や形式）を再確認する。
    *   **エラー検証:** `expectErrorHandled` を削除し、try-catch ブロックと `expect(...).toThrow(...)` または `expect(error).toBeInstanceOf(...)` を使用した検証に書き換える。スローされるエラーのクラス (`GitError`, `StorageError`, `TimeoutError`, `ValidationError` など)、`code` プロパティ、`context` プロパティの内容を検証するアサーションを追加する。
    *   **モック:** `beforeEach` で `createMockDependencies` や個別のモックファクトリ関数を使って依存関係を生成し、テスト対象クラスのインスタンスを生成する。`jest.mock` を使用して `fs`, `simple-git`, `path` などをモックする。`afterEach` で `jest.restoreAllMocks()` を呼び出す。
    *   **テスト記述:** テストケース名を分かりやすくし、AAA パターンに従って記述を整理する。
    *   **網羅性:** 各メソッドについて、引数が不正な場合、依存するモックがエラーを返す場合などの異常系テストを追加する。数値や文字列長の境界値テストを追加する。
3.  **Step 3: レビューと微調整**
    *   リファクタリング後のコード全体をレビューし、一貫性が保たれているか、修正漏れがないかを確認する。CIでのテスト実行結果も確認する。

## 3. 追加改修戦略 (2025/03/29)

テスト実行結果に基づき、以下の追加戦略を立案・実施する。

*   **優先度1: `tests/lib/utils/storage.test.js` の `Maximum call stack size exceeded` エラー修正**
    *   **原因:** `beforeEach` 内での `path` モジュールの `jest.spyOn` によるモック実装が無限再帰を引き起こしている可能性が高い。
    *   **対策:**
        *   `jest.spyOn` による `path` モジュールのモック実装を削除する。
        *   代わりに `jest.mock('path', ...)` を使用し、ファクトリ関数内で `jest.requireActual('path')` を呼び出して元のモジュールを取得する。
        *   監視対象の `join`, `dirname`, `normalize` メソッドは `jest.fn()` でラップし、その中で元の関数を呼び出すように変更する。他の関数は元の実装をそのまま利用する。
    *   **確認:** エラー解消後、同ファイル内の他の失敗テストを修正する。
*   **優先度2: 残りの失敗テスト修正**
    *   `tests/lib/utils/plugin-manager.test.js`: `_validatePlugin` のテストで `mockLogger.warn` の期待値を修正。
    *   `tests/lib/utils/cache-manager.test.js`: `get` の期限切れテストを修正。
    *   `tests/lib/utils/lock-manager.test.js`: `mockLogger.warn/debug` の期待値を修正。
    *   `tests/lib/utils/event-emitter.test.js`: ネストエラーを修正。
    *   `tests/lib/utils/error-helpers.test.js`: `eventEmitter` が `null`/不正な場合のテストのアサーションを修正。
    *   `tests/lib/utils/validator.test.js`: `sanitizeString` のテストの期待値を修正。
*   **優先度3: カバレッジ向上**
    *   全テストパス後、`npm test --coverage tests/lib/utils` を再実行し、レポートを確認。
    *   未カバー箇所（`storage.js`, `git.js`, `logger.js`, `plugin-manager.js` など）に対応するテストケースを追加。