# `integration.js` および `integration.test.js` 再設計・再実装計画

**1. 背景と課題**

*   `src/cli/integration.js` は CLI アプリケーションのエントリーポイントだが、依存関係の初期化処理とコマンド定義が肥大化し、責務が曖昧になっている。
*   `tests/cli/integration.test.js` は多数の内部実装詳細をモックしており、リファクタリング耐性が低く、現状 `TypeError` によりテストが失敗している。根本的な原因として、モック戦略や初期化処理の扱いに問題がある可能性が高い。
*   プロジェクト全体の基準となるガイドライン（設計原則、コーディング規約、テスト戦略）が整備されており、これらに準拠した形での再設計が求められる。

**2. 目標**

*   `integration.js` をガイドラインに沿ってリファクタリングし、責務を明確化・単純化する。
*   `integration.test.js` をリファクタリングし、堅牢性・保守性・可読性を向上させ、テストが成功するように修正する。
*   テストヘルパー (`mock-factory`, `test-helpers`) を効果的に活用する。

**3. 再設計方針**

```mermaid
graph LR
    subgraph Refactored Structure
        direction LR
        A[integration.js] --> B(bootstrap.js);
        A --> C(commands/index.js);
        A --> D(CliFacade);
        A --> E(display.js);
        C --> F(commands/workflow.js);
        C --> G(commands/session.js);
        C --> H(commands/task.js);
        C --> I(...);
        B --> J(ServiceContainer);
        B --> K(service-definitions.js);
        B --> L(Cli* Components);
        B --> D;
    end

    subgraph integration.js Responsibilities
        direction TB
        R1[1. Initialize (Call bootstrap)] --> R2[2. Parse Arguments (Use commands/*)];
        R2 --> R3[3. Execute Command (Call CliFacade)];
        R3 --> R4[4. Display Result/Error (Use display.js)];
    end

    subgraph integration.test.js Focus
        direction TB
        T1[Verify Flow: Init -> Parse -> Execute -> Display/Error] --> T2[Mock Dependencies: bootstrap, commands, CliFacade, display];
        T2 --> T3[Utilize Helpers: createMock*, captureConsole, expectLogged];
        T3 --> T4[Test Scenarios: Normal, Init Error, Parse Error, Execute Error];
    end

    Refactored Structure -- Guides --> integration.js;
    Refactored Structure -- Guides --> integration.test.js;
    integration.js -- Defines --> integration.test.js Focus;
```

*   **`integration.js` の責務明確化:**
    *   **初期化処理の分離:** 依存関係の解決と `CliFacade` の構築ロジックを `src/cli/bootstrap.js` (仮称) に分離する。
    *   **コマンド定義の分離:** `yargs` のコマンド定義を `src/cli/commands/` 配下に機能ごとに分割し、`integration.js` はそれらを読み込んで登録する。
    *   **エントリーポイント機能への集中:** `integration.js` は、①初期化呼び出し (`bootstrap`)、②引数解析 (`parseArguments` + コマンド定義)、③コマンド実行委譲 (`CliFacade.execute`)、④結果/エラー表示 (`displayResult`) のフロー制御に専念する。
*   **`integration.test.js` のテスト対象絞り込み:**
    *   `integration.js` のエントリーポイントとしてのフロー（上記①〜④）が正しく連携するかを検証する。
    *   `bootstrap`, `parseArguments`, `CliFacade`, `displayResult` など、`integration.js` が直接呼び出すインターフェースをモックする。個別の `Cli*` クラスや `ServiceContainer` の内部実装はテスト対象外とする。
    *   テストヘルパー (`createMockDependencies`, `captureConsole`, `expectLogged` など) を活用し、テストコードを簡潔かつ堅牢にする。

**4. 実装ステップ**

```mermaid
gantt
    dateFormat YYYY-MM-DD
    title integration.js & test Refactoring Plan

    section Analysis & Preparation
    Analyze Current Code & Error :a1, 2025-04-01, 1d
    Define Bootstrap Interface   :a2, after a1, 1d
    Define Command Module Interface :a3, after a1, 1d

    section Implementation (integration.js)
    Create bootstrap.js        :b1, after a2, 2d
    Create commands/* modules  :b2, after a3, 3d
    Refactor integration.js    :b3, after b1 b2, 2d

    section Implementation (integration.test.js)
    Setup Mocks (bootstrap, commands, facade, display) :c1, after b3, 1d
    Implement Normal Flow Test :c2, after c1, 1d
    Implement Error Flow Tests :c3, after c2, 2d
    Utilize Test Helpers       :c4, during c1 c2 c3, 4d

    section Testing & Review
    Run Tests & Fix Issues     :d1, after c4, 2d
    Code Review                :d2, after d1, 1d
    Update Documentation (if needed) :d3, after d2, 1d
```

1.  **準備 (Analysis & Preparation):**
    *   `integration.js` と `integration.test.js` のコードを再確認し、`TypeError` の根本原因を特定する。
    *   分離する `bootstrap.js` と `commands/index.js` (および配下のファイル) のインターフェース（入力と出力）を定義する。
2.  **実装 (`integration.js`):**
    *   `src/cli/bootstrap.js` を作成し、初期化ロジックを移植する。
    *   `src/cli/commands/` ディレクトリを作成し、コマンド定義を機能ごとに分割・移植する。
    *   `integration.js` をリファクタリングし、`bootstrap` とコマンド定義モジュールを呼び出すように修正する。
3.  **実装 (`integration.test.js`):**
    *   `integration.test.js` をリファクタリングする。
    *   `bootstrap`, コマンド定義モジュール, `CliFacade`, `displayResult` をモックする。
    *   `createMockDependencies` や `captureConsole` などのテストヘルパーを活用する。
    *   正常系および各種エラー系のフローを検証するテストケースを実装する。
4.  **テストとレビュー (Testing & Review):**
    *   `npm test tests/cli/integration.test.js` を実行し、テストが成功することを確認する。失敗した場合は修正する。
    *   リファクタリングしたコードのレビューを行う。
    *   必要に応じて関連ドキュメントを更新する。