# 計画案: CLIコンポーネントの振り返りとドキュメント整備

## 1. 目的

*   `src/cli` および `tests/cli` ディレクトリに対するリファクタリング結果を包括的に振り返り、得られた知見をプロジェクトの資産として定着させる。
*   振り返りの結果に基づき、既存の基準ドキュメント群（コーディング規約、設計原則、テストガイドライン）を更新・追記する。
*   リファクタリングされたCLIコンポーネント群について、利用方法や設計思想を明確にするためのガイドドキュメントを新規作成する。

## 2. 実施ステップ

### ステップ1: 振り返りの実施 (分析フェーズ)

1.  **対象コード:** `src/cli` ディレクトリ内の全クラス、および `tests/cli` ディレクトリ内の関連テストコード。
2.  **観点:**
    *   **基準ドキュメントへの準拠度:**
        *   `docs/coding-standards.md`: 命名規則、フォーマット、コメント（JSDoc）、言語機能（async/await, エラー処理）などが守られているか。
        *   `docs/design-principles.md`: クラス設計（SRP）、依存性注入（コンストラクタインジェクション、optionsオブジェクト）、エラーハンドリング戦略（カスタムエラー、`_handleError`パターン）、イベント駆動（`_emitEvent`パターン、標準化イベント）などが適切に適用されているか。
        *   `docs/testing-guidelines.md`: FIRST原則、AAAパターン、テスト容易性、モック戦略（`mock-factory.js`の利用、契約）、テストヘルパーの活用などが実践されているか。
    *   **改善点・課題:** リファクタリングによって改善された点、依然として残る課題や、さらなる改善の余地がある箇所を特定する。
    *   **ドキュメントへのフィードバック:** 既存の基準ドキュメントに対して、CLIコンポーネントの実装を踏まえて追記・修正すべき点（例: CLI特有のパターン、より明確化すべきルール）を洗い出す。
3.  **方法:** 提供されたコードファイルの内容と基準ドキュメントを照らし合わせ、分析を行う。

### ステップ2: 基準ドキュメントの更新 (ドキュメント更新フェーズ)

1.  **対象ファイル:**
    *   `docs/coding-standards.md`
    *   `docs/design-principles.md`
    *   `docs/testing-guidelines.md`
2.  **内容:** ステップ1の振り返りで特定された追記・修正点を反映する。
    *   例: CLIクラスにおけるエラーコードの命名規則、イベント名の具体例追加、テストヘルパーの利用に関する注意点の追記など。

### ステップ3: CLIガイドドキュメントの作成 (ドキュメント作成フェーズ)

1.  **新規ディレクトリ作成 (提案):** `docs/cli-guides/` を作成し、CLI関連のガイドを集約する。
2.  **作成対象ファイル:** `src/cli` 内の各クラスに対応するガイドファイルを作成する。
    *   `docs/cli-guides/facade-guide.md`
    *   `docs/cli-guides/workflow-manager-guide.md`
    *   `docs/cli-guides/session-manager-guide.md`
    *   `docs/cli-guides/task-manager-guide.md`
    *   `docs/cli-guides/feedback-handler-guide.md`
    *   `docs/cli-guides/report-generator-guide.md`
    *   `docs/cli-guides/status-viewer-guide.md`
    *   `docs/cli-guides/interactive-mode-guide.md`
    *   `docs/cli-guides/component-syncer-guide.md`
3.  **各ガイドの構成:** 既存のユーティリティガイド (`docs/utility-guides/`) の形式を踏襲し、以下のセクションを含める。
    *   **1. 目的:** クラスの責務、役割の概要。
    *   **2. コンストラクタ:** 依存関係（必須/任意）、設定オプションの説明。
    *   **3. 主要メソッド:** 各パブリックメソッドのシグネチャ、機能、引数、戻り値、スローされる可能性のあるエラーの説明。
    *   **4. 発行されるイベント:** クラスが発行する標準化イベントの一覧と、そのイベントデータに含まれる主要な情報。
    *   **5. 注意点とベストプラクティス:** 利用上の注意点、設計上の考慮事項、関連する他のクラスとの連携方法など。
4.  **クラス関連図 (Mermaid):** 主要なCLIクラス間の依存関係を示す図を、例えば `docs/cli-guides/README.md` や関連ドキュメント内に含めることを検討する。

```mermaid
graph TD
    subgraph CLI Layer
        CliFacade --> CliWorkflowManager
        CliFacade --> CliSessionManager
        CliFacade --> CliTaskManager
        CliFacade --> CliFeedbackHandler
        CliFacade --> CliReportGenerator
        CliFacade --> CliStatusViewer
        CliFacade --> CliComponentSyncer
        CliFacade --> CliInteractiveMode
        CliInteractiveMode --> CliFacade

        CliWorkflowManager --> IntegrationManagerAdapter
        CliWorkflowManager --> StateManagerAdapter

        CliSessionManager --> IntegrationManagerAdapter
        CliSessionManager --> SessionManagerAdapter
        CliSessionManager --> StorageService

        CliTaskManager --> IntegrationManagerAdapter
        CliTaskManager --> TaskManagerAdapter
        CliTaskManager --> StorageService
        CliTaskManager --> Validator

        CliFeedbackHandler --> IntegrationManagerAdapter
        CliFeedbackHandler --> FeedbackManagerAdapter
        CliFeedbackHandler --> StorageService
        CliFeedbackHandler --> Validator

        CliReportGenerator --> IntegrationManagerAdapter
        CliReportGenerator --> StorageService

        CliStatusViewer --> StateManagerAdapter
        CliStatusViewer --> TaskManagerAdapter
        CliStatusViewer --> SessionManagerAdapter

        CliComponentSyncer --> IntegrationManagerAdapter
    end

    subgraph Core/Adapters
        IntegrationManagerAdapter
        SessionManagerAdapter
        TaskManagerAdapter
        FeedbackManagerAdapter
        StateManagerAdapter
        StorageService
        Validator
        Logger
        EventEmitter
    end

    CLI Layer --> Core/Adapters
    CliFacade --> Logger
    CliFacade --> EventEmitter
    CliWorkflowManager --> Logger
    CliWorkflowManager --> EventEmitter
    CliSessionManager --> Logger
    CliSessionManager --> EventEmitter
    CliTaskManager --> Logger
    CliTaskManager --> EventEmitter
    CliFeedbackHandler --> Logger
    CliFeedbackHandler --> EventEmitter
    CliReportGenerator --> Logger
    CliReportGenerator --> EventEmitter
    CliStatusViewer --> Logger
    CliStatusViewer --> EventEmitter
    CliInteractiveMode --> Logger
    CliInteractiveMode --> EventEmitter
    CliComponentSyncer --> Logger
    CliComponentSyncer --> EventEmitter

```

## 3. 成果物

*   更新された基準ドキュメント (`docs/coding-standards.md`, `docs/design-principles.md`, `docs/testing-guidelines.md`)
*   新規作成されたCLIガイドドキュメント群 (`docs/cli-guides/*.md`)

## 4. 次のステップ

*   この計画案についてユーザーのレビューと承認を得る。
*   承認後、計画に基づいたドキュメント更新・作成作業を別のモード（例: `code` モード）で実施する。