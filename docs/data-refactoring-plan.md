# データ層リファクタリング計画

## 1. 目的

`src/lib/data` 配下の Repository クラス群および Validator クラス群を、プロジェクト全体の基準ドキュメント群（コーディング規約、設計原則、ユーティリティガイドなど）に沿ってリファクタリングし、一貫性、保守性、テスト容易性を向上させることを目的とします。

## 2. リファクタリング方針

*   **エラーハンドリング:** `errorHandler` パターンを導入します。
*   **バリデータ責務:** 各データ型固有の検証ロジックは `src/lib/data/validators/*` に集約します。
*   **イベント発行:** データ変更時に標準化されたイベントを発行します。
*   **テストカバレッジ:** 80%を目指します。

## 3. 詳細リファクタリング計画

```mermaid
graph TD
    subgraph "フェーズ1: 基盤整備 (Repository & Validators)"
        A[1.1 DI改善 (全リポジトリ)] --> B(1.2 エラーハンドリング統一 (errorHandler導入));
        B --> C(1.3 バリデータ責務整理 (提案A));
    end

    subgraph "フェーズ2: 各リポジトリへの適用"
        C --> D[2.1 TaskRepositoryリファクタリング];
        C --> E[2.2 SessionRepositoryリファクタリング];
        C --> F[2.3 FeedbackRepositoryリファクタリング];
    end

    subgraph "フェーズ3: イベント駆動導入"
        G[3.1 イベント発行実装 (全リポジトリ)]
    end

    subgraph "フェーズ4: テストコード改善"
        H[4.1 テストコードリファクタリング (目標80%)]
    end

    F --> G;
    G --> H;

    style A fill:#f9f,stroke:#333,stroke-width:2px
    style B fill:#f9f,stroke:#333,stroke-width:2px
    style C fill:#f9f,stroke:#333,stroke-width:2px
    style D fill:#ccf,stroke:#333,stroke-width:2px
    style E fill:#ccf,stroke:#333,stroke-width:2px
    style F fill:#ccf,stroke:#333,stroke-width:2px
    style G fill:#cfc,stroke:#333,stroke-width:2px
    style H fill:#ffc,stroke:#333,stroke-width:2px
```

### フェーズ1: 基盤整備 (Repository & Validators)

1.  **1.1 DI改善 (全リポジトリ):**
    *   **対象:**
        *   `src/lib/data/repository.js`
        *   `src/lib/data/task-repository.js`
        *   `src/lib/data/session-repository.js`
        *   `src/lib/data/feedback-repository.js`
    *   **内容:**
        *   各クラスのコンストラクタを修正し、依存関係 (`storageService`, `validator`, `logger`, `eventEmitter`, `errorHandler`, `gitService` 等) を `options` オブジェクトを用いたコンストラクタインジェクションで受け取るように統一する。
        *   必須依存関係のチェックを追加する (`logger` は原則必須)。
    *   **参照:** [設計原則 (DI)](design-principles.md#2-依存性注入-di), 各ユーティリティガイド
2.  **1.2 エラーハンドリング統一 (`errorHandler`導入):**
    *   **対象:**
        *   `src/lib/data/repository.js`
        *   `src/lib/data/task-repository.js`
        *   `src/lib/data/session-repository.js`
        *   `src/lib/data/feedback-repository.js`
    *   **内容:**
        *   `repository.js` 内のエラークラス定義を削除し、`src/lib/utils/errors.js` のエラークラスを使用する。
        *   各メソッドの `try...catch` で、`this.errorHandler.handle()` を呼び出すように修正する。適切なエラーオブジェクト、コンポーネント名、操作名、コンテキストを渡す。
    *   **参照:** [設計原則 (エラーハンドリング)](design-principles.md#3-エラーハンドリング戦略), [エラーハンドリングガイド](utility-guides/error-handling-guide.md)
3.  **1.3 バリデータ責務整理 (提案A):**
    *   **対象:**
        *   `src/lib/utils/validator.js`
        *   `src/lib/data/validators/task-validator.js`
        *   `src/lib/data/validators/session-validator.js`
        *   `src/lib/data/validators/feedback-validator.js`
        *   各リポジトリクラス
    *   **内容:**
        *   `utils/validator.js` からデータ型固有の検証メソッドを削除。
        *   `data/validators/*` に各データ型の検証ロジックを集約・実装。コンストラクタで `logger` を必須依存として受け取る。
        *   各リポジトリクラスが、対応するバリデータをDIで受け取り、内部の検証ロジックをバリデータ呼び出しに置き換える。
    *   **参照:** [Validatorガイド](utility-guides/validator-guide.md)

### フェーズ2: 各リポジトリへの適用

1.  **2.1 TaskRepositoryリファクタリング:**
    *   **対象:** `src/lib/data/task-repository.js`
    *   **内容:** フェーズ1の変更を適用。`progressStates`, `stateTransitions` の外部化検討。コーディング規約遵守。
2.  **2.2 SessionRepositoryリファクタリング:**
    *   **対象:** `src/lib/data/session-repository.js`
    *   **内容:** フェーズ1の変更を適用。`gitService` 利用箇所の確認。コーディング規約遵守。
3.  **2.3 FeedbackRepositoryリファクタリング:**
    *   **対象:** `src/lib/data/feedback-repository.js`
    *   **内容:** フェーズ1の変更を適用。`feedbackStateTransitions`, `feedbackTypeWeights` の外部化検討。コーディング規約遵守。

### フェーズ3: イベント駆動導入

1.  **3.1 イベント発行実装 (全リポジトリ):**
    *   **対象:** 全リポジトリクラス
    *   **内容:**
        *   コンストラクタで `eventEmitter` をDIで受け取る。
        *   データ作成・更新・削除メソッド内で `this.eventEmitter.emitStandardized()` を呼び出し、適切なイベント名 (`component:action`) とデータでイベントを発行する。
    *   **参照:** [設計原則 (イベント駆動)](design-principles.md#4-イベント駆動アーキテクチャ), [EventEmitterガイド](utility-guides/event-emitter-guide.md)

### フェーズ4: テストコード改善

1.  **4.1 テストコードリファクタリング (目標80%):**
    *   **対象:** `tests/lib/data/` 配下の関連テストファイル
    *   **内容:**
        *   `testing-guidelines.md` に従う。
        *   `mock-factory.js` で依存関係をモック化。
        *   `test-helpers.js` のヘルパー関数を活用。
        *   エラーハンドリング、イベント発行のテストを追加・改善。
        *   カバレッジ80%を目指す。
    *   **参照:** [テスト戦略とガイドライン](testing-guidelines.md)

## 4. 次のステップ

この計画に基づき、`code` モードでリファクタリング作業を開始します。