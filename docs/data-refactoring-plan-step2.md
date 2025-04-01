# データレイヤーリファクタリング計画 (Step 2)

引継ぎドキュメントに基づき、`src/lib/data` および `tests/lib/data` 配下のコードをリファクタリングします。

## 計画概要

```mermaid
graph TD
    subgraph Step 2: コードリファクタリング
        direction LR
        Start[開始] --> B1(定数共通化);
        B1 --> B2(バリデータ実装修正);
        B2 --> B3(リポジトリ実装修正);
        B3 --> B4(エラー/DI確認);
        B4 --> B5(命名/スタイル統一);
        B5 --> Check{基準整合性OK?};
        Check -- Yes --> Done[Step 2 完了];
        Check -- No --> B1;
    end

    subgraph B1_Details [B1: 定数共通化]
        B1_1[src/lib/core/constants.js 作成];
        B1_2[TaskRepository/TaskValidator から PROGRESS_STATES, STATE_TRANSITIONS を constants.js へ移動];
        B1_3[TaskRepository/TaskValidator が constants.js を参照するように修正];
        B1_4[テスト実行: npm test tests/lib/data];
        B1_1 --> B1_2 --> B1_3 --> B1_4;
    end

    subgraph B2_Details [B2: バリデータ実装修正]
        B2_1[各バリデータ (Task, Session, Feedback) の実装を validator-guide.md と照合];
        B2_2[TaskValidator.validateHierarchy の実装 (基本チェックのみ)];
        B2_3[不要な Validator (src/lib/utils/validator.js) のメソッド削除検討];
        B2_4[テスト実行: npm test tests/lib/data/validators];
        B2_1 --> B2_2 --> B2_3 --> B2_4;
    end

    subgraph B3_Details [B3: リポジトリ実装修正]
        B3_1[各リポジトリ (Task, Session, Feedback, Repository) の実装を design-principles.md と照合];
        B3_2[バリデータの適切な利用を確認/修正 (コンストラクタ注入、validateメソッド呼び出し)];
        B3_3[エラーハンドリングの一貫性確認/修正 (errorHandler の利用、適切なエラークラス)];
        B3_4[依存性注入 (DI) の確認 (コンストラクタ注入、必須/任意依存)];
        B3_5[FeedbackRepository の状態遷移/重み定義を constants.js へ移動];
        B3_6[テスト実行: npm test tests/lib/data];
        B3_1 --> B3_2 --> B3_3 --> B3_4 --> B3_5 --> B3_6;
    end

    subgraph B4_Details [B4: エラーハンドリング/DI確認]
        B4_1[エラークラス (errors.js) の利用状況確認];
        B4_2[errorHandler パターンの適用状況確認];
        B4_3[DI パターン (コンストラクタ注入) の適用状況確認];
        B4_4[テスト実行: npm test tests/lib/data];
        B4_1 --> B4_2 --> B4_3 --> B4_4;
    end

    subgraph B5_Details [B5: 命名/スタイル統一]
        B5_1[coding-standards.md に基づき、変数名、関数名、ファイル名、イベント名などを確認/修正];
        B5_2[Prettier/ESLint によるフォーマット確認/修正];
        B5_3[テスト実行: npm test tests/lib/data];
        B5_1 --> B5_2 --> B5_3;
    end

    Start --> B1_Details;
    B1_Details --> B2_Details;
    B2_Details --> B3_Details;
    B3_Details --> B4_Details;
    B4_Details --> B5_Details;
    B5_Details --> Check;

```

## 計画詳細

*   **B1: 定数共通化**
    1.  `src/lib/core/constants.js` ファイルを新規作成します。
    2.  `src/lib/data/task-repository.js` および `src/lib/data/validators/task-validator.js` 内で定義されている `PROGRESS_STATES` と `STATE_TRANSITIONS` を `constants.js` に移動し、エクスポートします。
    3.  `TaskRepository` と `TaskValidator` が `constants.js` からこれらの定数をインポートするように修正します。
    4.  関連するテスト (`tests/lib/data/task-repository.test.js`, `tests/lib/data/validators/task-validator.test.js`) が引き続きパスすることを確認します (`npm test tests/lib/data`)。
*   **B2: バリデータ実装修正**
    1.  `TaskValidator`, `SessionValidator`, `FeedbackValidator` の各 `validate` メソッドの実装内容を、`docs/utility-guides/validator-guide.md` や各データ構造の期待される形式と照合し、過不足があれば修正します。特に、必須フィールド、データ型、許容される値（enum）、ID形式（例: `Txxx`）などのチェックが適切か確認します。
    2.  `TaskValidator.validateHierarchy` メソッドを実装します（基本チェックのみ: `epics`, `stories` が配列であること）。
    3.  `src/lib/utils/validator.js` に残っているデータ型固有の検証メソッド（もしあれば）は削除し、`src/lib/data/validators/*` に完全に移行されていることを確認します。基本的な `sanitizeString` は残します。
    4.  バリデータ関連のテスト (`tests/lib/data/validators/*`) がパスすることを確認します。
*   **B3: リポジトリ実装修正**
    1.  `Repository`, `TaskRepository`, `SessionRepository`, `FeedbackRepository` の実装を `docs/design-principles.md` に照らして見直します。
    2.  **バリデータ利用:** 各リポジトリ（Task, Session, Feedback）が、対応するバリデータ（TaskValidator, SessionValidator, FeedbackValidator）をコンストラクタで正しく受け取り、`create` や `update` などのメソッド内で適切に `validate` メソッドを呼び出しているか確認・修正します。基底クラス `Repository` は特定のバリデータを持たない想定です。
    3.  **エラーハンドリング:**
        *   `try...catch` が適切に使用されているか確認します。
        *   エラー発生時に、`docs/utility-guides/error-handling-guide.md` に従い、適切なカスタムエラークラス (`ValidationError`, `NotFoundError`, `DataConsistencyError` など `src/lib/utils/errors.js` で定義されたもの）を `throw` しているか、またはコンストラクタで受け取った `errorHandler` に処理を委譲しているか確認・修正します。`errorHandler` がない場合のフォールバック処理（ログ出力＋デフォルト値返却 or 例外スロー）が一貫しているか確認します。
    4.  **依存性注入 (DI):**
        *   `storageService`, `logger`, 各バリデータ, `gitService` などの依存関係が、コンストラクタの `options` オブジェクトを通じて正しく注入されているか確認します。
        *   必須の依存関係（`storageService`, `logger`, 各バリデータ, `gitService`）が提供されない場合に、コンストラクタでエラーをスローしているか確認します。
    5.  **FeedbackRepository の定数:** `FeedbackRepository` 内で定義されている `feedbackStateTransitions` と `feedbackTypeWeights` を `constants.js` に移動します。
    6.  データレイヤー全体のテスト (`npm test tests/lib/data`) がパスすることを確認します。
*   **B4: エラーハンドリング/DI確認**
    1.  `src/lib/data` 配下のファイル全体で、`src/lib/utils/errors.js` で定義されたエラークラスが一貫して使用されているか確認します。
    2.  `errorHandler` オプションを受け取るクラスで、エラー処理が適切に `errorHandler.handle` に委譲されているか、またはフォールバック処理が適切に行われているかを確認します。
    3.  すべてのクラスで、依存関係がコンストラクタインジェクションパターンに従って注入されているか最終確認します。
    4.  データレイヤー全体のテスト (`npm test tests/lib/data`) がパスすることを確認します。
*   **B5: 命名規則/スタイルの統一**
    1.  `docs/coding-standards.md` に基づき、`src/lib/data` および `tests/lib/data` 配下のファイル名、変数名、関数名、クラス名、イベント名（もしあれば）などを確認し、規約に合わせて修正します。
    2.  `npm run lint -- --fix` や Prettier のフォーマット機能を実行し、コードスタイルを統一します。
    3.  データレイヤー全体のテスト (`npm test tests/lib/data`) がパスすることを確認します。
*   **B6: 基準ドキュメントとの整合性確認**
    *   リファクタリングされたコード全体が、関連する基準ドキュメント群（コーディング規約、設計原則、テスト戦略、ユーティリティガイド）の内容と整合性が取れているか最終レビューを行います。