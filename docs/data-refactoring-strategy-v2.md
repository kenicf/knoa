# データレイヤ改善・改修戦略 (v2)

## 1. 背景

ユーティリティクラス・CLIクラスのリファクタリングを経て確立された基準ドキュメント群に基づき、データレイヤ (`src/lib/data`, `src/lib/data/validators`) および関連テスト (`tests/helpers`, `tests/lib/data`, `tests/lib/data/integration`, `tests/lib/data/validators`) の広範な改善・改修を実施する。

## 2. 現状分析サマリー

*   **テスト信頼性:** `tests/lib/data/task-repository.test.js` に失敗しているテストが存在する。
*   **テストカバレッジ:** 特にエラーハンドリングパスや一部ロジックにおいてカバレッジが低い。`feedback`, `session` 関連のテストが不足している。
*   **実装の一貫性:** リポジトリクラス間でのエラーハンドリングやイベント発行のパターンに改善の余地がある。
*   **バリデーション:** 一部のバリデーションロジック（例: `TaskValidator.validateHierarchy`）が不十分な可能性がある。

## 3. 改善・改修戦略

以下の優先順位で改善・改修を実施する。

```mermaid
graph TD
    A[現状分析] --> B(戦略立案);
    B --> C{優先度1: テスト修正と信頼性向上};
    B --> D{優先度2: カバレッジ向上};
    B --> E{優先度3: 実装パターン統一};
    B --> F{優先度4: バリデーション強化};

    C --> C1[task-repository.test.js の失敗テスト修正];
    C --> C2[関連コード(associateCommitWithTask)のレビューと修正];

    D --> D1[エラーハンドリングパスのテスト追加];
    D --> D2[Repository/TaskRepository の未カバレッジ箇所のテスト追加];
    D --> D3[Feedback/Session Repository/Validator のテスト作成];

    E --> E1[エラーハンドリングヘルパー(_handleError)導入検討];
    E --> E2[イベント発行ヘルパー(_emitEvent)導入検討];
    E --> E3[DIパターンの再確認と統一];

    F --> F1[TaskValidator.validateHierarchy の実装/テスト];
    F --> F2[各Validatorの網羅的テスト];

    subgraph 全体最適化
        C; D; E; F;
    end
```

### 3.1. 優先度1: テスト修正と信頼性向上

*   **目的:** 既存テストスイートの信頼性を回復する。
*   **アクション:**
    *   `tests/lib/data/task-repository.test.js` の失敗テスト (`associateCommitWithTask` 関連) を修正する。
    *   関連する `src/lib/data/task-repository.js` の `associateCommitWithTask` メソッドをレビューし、必要に応じて修正する。

### 3.2. 優先度2: カバレッジ向上

*   **目的:** テストカバレッジを目標値（例: 80%）まで引き上げ、コード品質を向上させる。
*   **アクション:**
    *   `repository.js`, `task-repository.js` のエラーハンドリングパス（特に `errorHandler` がない場合）のテストを追加する。
    *   カバレッジレポートに基づき、未カバレッジ箇所のテストを追加・拡充する。
    *   `feedback-repository.js`, `session-repository.js`, `feedback-validator.js`, `session-validator.js` の単体テストを作成する。

### 3.3. 優先度3: 実装パターン統一

*   **目的:** リポジトリクラス間の実装パターンを統一し、保守性を向上させる。
*   **アクション:**
    *   `_handleError` ヘルパーメソッドの導入または共通パターンの適用を検討する。
    *   `_emitEvent` ヘルパーメソッドの導入または共通パターンの適用を検討する。
    *   依存性注入パターンの統一性を確認し、必要であれば修正する。

### 3.4. 優先度4: バリデーション強化

*   **目的:** データ整合性を確保するため、バリデーションロジックを強化する。
*   **アクション:**
    *   `TaskValidator.validateHierarchy` の詳細な検証ロジックを検討・実装・テストする。
    *   各バリデータクラスのテストを拡充し、網羅性を高める。

## 4. 次のステップ

この計画に基づき、実装フェーズに移行する。まずは優先度1のテスト修正から着手する。