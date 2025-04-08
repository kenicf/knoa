# CLI リファクタリング戦略 (v2)

## 1. 分析結果概要

*   **基準ドキュメント:** コーディング規約、設計原則（DI、エラーハンドリング、イベント駆動）、テストガイドライン（FIRST原則、AAA、モック戦略、ヘルパー利用）など、明確な基準が定義されています。特に、DIによるテスト容易性の向上、標準化されたエラー処理とイベント発行が重視されています。
*   **`src/cli` コード:**
    *   DIは `bootstrap.js` で行われていますが、各クラスのコンストラクタでの `options` オブジェクト利用や必須依存関係チェックは改善の余地があります。`traceIdGenerator`, `requestIdGenerator` の注入は最近追加されたようです。
    *   `_emitEvent`, `_handleError` ヘルパーは多くのクラスで導入されていますが、実装（エラーコード生成、`errorHandler` 呼び出し等）に若干のばらつきが見られます。
    *   イベント発行は `emitStandardizedAsync` と `cli:component_action` 形式で概ね統一されています。
    *   エラーハンドリングは `try...catch` とカスタムエラーで行われていますが、エラーラップやコンテキスト付与、`errorHandler` の活用に改善の可能性があります。
*   **`tests/cli` コード:**
    *   テストヘルパー (`mockDependencies`, `expectStandardizedEventEmittedAsync` 等) は活用されています。
    *   AAAパターンはおおむね遵守されています。
    *   エラーハンドリングやイベント発行のテストは含まれていますが、網羅性に改善の余地があります。
*   **テストレポート:**
    *   `src/cli` のカバレッジは比較的高 (94%) ですが、いくつかのファイルで未カバー行が存在します（特にエラーパスや分岐）。`display.js` のカバレッジがやや低めです。
    *   テストは全てパスしています。

## 2. 改善・改修戦略

**全体方針:** `src/cli` の各クラスに、ユーティリティクラスで確立された DI、エラーハンドリング、イベント発行のパターンを一貫して適用します。`tests/cli` のテストコードも、テストガイドラインに沿って質と網羅性を向上させます。

**具体的な改善項目と計画:**

1.  **DI の徹底:**
    *   **対象:** `src/cli` 配下の全クラス (`CliWorkflowManager`, `CliSessionManager`, `CliTaskManager`, `CliFeedbackHandler`, `CliReportGenerator`, `CliStatusViewer`, `CliComponentSyncer`, `CliInteractiveMode`, `CliFacade`)。
    *   **内容:**
        *   コンストラクタを修正し、`options` オブジェクトですべての依存関係 (`logger`, `eventEmitter`, 各 Adapter, `storageService`, `validator`, `traceIdGenerator`, `requestIdGenerator`, `errorHandler` (任意)) を受け取るように統一します。
        *   コンストラクタ冒頭で必須依存関係の存在チェックを実装します。
    *   **担当:** Roo (リファクタリング担当)
    *   **優先度:** 高

2.  **エラーハンドリングの標準化:**
    *   **対象:** `src/cli` 配下の全クラス。
    *   **内容:**
        *   `_handleError` 内部ヘルパーメソッドの実装を統一します（エラーラップ、`emitErrorEvent` 呼び出し、`errorHandler` 呼び出しロジック、エラーコード生成ルール `ERR_CLI_COMPONENT_OPERATION` の明確化）。
        *   各メソッドの `catch` ブロックで `_handleError` を確実に呼び出すように修正します。
        *   `NotFoundError`, `StorageError`, `ValidationError` は適切にスローし、`_handleError` で処理するようにします。
    *   **担当:** Roo (リファクタリング担当)
    *   **優先度:** 中

3.  **イベント発行の標準化:**
    *   **対象:** `src/cli` 配下の全クラス。
    *   **内容:**
        *   `_emitEvent` 内部ヘルパーメソッドの実装を統一します（`emitStandardizedAsync` 呼び出し、コンポーネント名 `cli`、アクション名 `component_action`、`traceId`/`requestId` 付与ロジック）。
        *   各メソッドの適切な箇所 (`_before`, `_after`) で `_emitEvent` を呼び出すように修正します。
    *   **担当:** Roo (リファクタリング担当)
    *   **優先度:** 中

4.  **テストコードの改善:**
    *   **対象:** `tests/cli` 配下の全テストファイル。
    *   **内容:**
        *   `mockDependencies` の利用を全テストファイルで統一します。
        *   イベント発行テストで `expectStandardizedEventEmittedAsync` を利用します。
        *   エラーハンドリングテストに `emitErrorEvent` の呼び出し検証を追加します。
        *   `errorHandler` を利用するクラスのテストに `errorHandler.handle` の呼び出しと戻り値の検証を追加します。
        *   カバレッジレポートに基づき、未カバー行（特にエラーパス、`display.js`）を対象としたテストケースを追加します。
    *   **担当:** Roo (テスト改善担当)
    *   **優先度:** 中〜低 (リファクタリング後)

5.  **`integration.js` レビュー:**
    *   **対象:** `src/cli/integration.js`
    *   **内容:** `bootstrap` 呼び出し、`runCommand` での `CliFacade` 呼び出し、最終的なエラーハンドリングが適切に行われているかを確認します。
    *   **担当:** Roo (レビュー担当)
    *   **優先度:** 低

6.  **全体レビュー & テスト実行:**
    *   **対象:** `src/cli`, `tests/cli`
    *   **内容:** 全体のコードレビューを実施し、`npm test tests/cli -- --coverage` を実行してテストパスとカバレッジ改善を確認します。
    *   **担当:** Roo (全体レビュー担当)
    *   **優先度:** 低 (完了確認)

## 3. クラス依存関係 (Mermaid - 簡略版)

```mermaid
graph TD
    subgraph EntryPoint
        Integration["integration.js"]
    end

    subgraph Initialization
        Bootstrap["bootstrap.js"]
        ServiceContainer["ServiceContainer (core)"]
    end

    subgraph Facade
        CliFacade["CliFacade"]
    end

    subgraph Interactive
        CliInteractiveMode["CliInteractiveMode"]
    end

    subgraph ManagersHandlers [CLI Managers/Handlers]
        CliWorkflowManager
        CliSessionManager
        CliTaskManager
        CliFeedbackHandler
        CliReportGenerator
        CliStatusViewer
        CliComponentSyncer
    end

    subgraph Adapters [Adapters (lib)]
        IntegrationManagerAdapter
        SessionManagerAdapter
        TaskManagerAdapter
        FeedbackManagerAdapter
        StateManagerAdapter
    end

    subgraph ServicesUtils [Services/Utils (lib)]
        Logger
        EventEmitter
        StorageService
        Validator
        TraceIdGenerator
        RequestIdGenerator
        ErrorHandler["ErrorHandler (optional)"]
    end

    Integration --> Bootstrap
    Bootstrap --> ServiceContainer
    Bootstrap --> CliFacade
    Bootstrap --> CliInteractiveMode
    Bootstrap --> ManagersHandlers

    CliFacade --> ManagersHandlers
    CliFacade --> CliInteractiveMode

    CliInteractiveMode --> CliFacade

    ManagersHandlers --> Adapters
    ManagersHandlers --> ServicesUtils

    ServiceContainer --> ServicesUtils
    ServiceContainer --> Adapters

    %% スタイル定義 %%
    classDef entry fill:#f9f,stroke:#333,stroke-width:2px;
    classDef init fill:#ccf,stroke:#333,stroke-width:2px;
    classDef facade fill:#ff9,stroke:#333,stroke-width:2px;
    classDef interactive fill:#9cf,stroke:#333,stroke-width:2px;
    classDef managers fill:#cfc,stroke:#333,stroke-width:2px;
    classDef adapters fill:#fcc,stroke:#333,stroke-width:2px;
    classDef services fill:#eee,stroke:#333,stroke-width:1px;

    class Integration entry;
    class Bootstrap,ServiceContainer init;
    class CliFacade facade;
    class CliInteractiveMode interactive;
    class CliWorkflowManager,CliSessionManager,CliTaskManager,CliFeedbackHandler,CliReportGenerator,CliStatusViewer,CliComponentSyncer managers;
    class IntegrationManagerAdapter,SessionManagerAdapter,TaskManagerAdapter,FeedbackManagerAdapter,StateManagerAdapter adapters;
    class Logger,EventEmitter,StorageService,Validator,TraceIdGenerator,RequestIdGenerator,ErrorHandler services;