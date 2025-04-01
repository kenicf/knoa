# CLI リファクタリング計画

## 1. 背景

`tests/cli/session-manager.test.js` および `tests/cli/integration.test.js` でテスト失敗が発生している。これらの問題を解決し、提供された基準ドキュメント群に基づいて `src/cli` および `tests/cli` 全体をリファクタリングする。

## 2. テスト失敗の原因分析

1.  **NotFoundError の不一致:** `src/cli/session-manager.js` の `catch` ブロックで `NotFoundError` を適切に再スローせず、`CliError` でラップしている可能性。
2.  **StorageError の TypeError:** `tests/cli/session-manager.test.js` で `StorageError` をモックする際に、コンストラクタ引数が正しく渡されていない可能性。
3.  **Integration テストの失敗:** `tests/cli/integration.test.js` で `main` 関数のテストが失敗しており、モックの設定や呼び出し検証に問題がある可能性。

## 3. リファクタリング計画

### Phase 1: テスト失敗の修正 (最優先)

1.  **`src/cli/session-manager.js` の修正:**
    *   `endSession`, `getSessionInfo`, `exportSession` メソッド内の `catch` ブロックを修正し、捕捉したエラーが `NotFoundError` のインスタンスである場合は、それをそのまま再スローするように変更します。他のエラーの場合は、従来通り `CliError` でラップします。
2.  **`tests/cli/session-manager.test.js` の修正:**
    *   `exportSession` と `importSession` のテストケース内で `StorageError` を `mockRejectedValue` で設定する際に、`new StorageError('エラーメッセージ', null, { code: 'ERR_CLI_FILE_WRITE', context: {...} })` のように、第3引数に `code` を含む `options` オブジェクトを正しく渡すように修正します。
3.  **`tests/cli/integration.test.js` の修正:**
    *   `main` 関数のテストにおけるモック設定や呼び出し検証を修正します。
4.  **確認:** 上記修正後、`npm test tests/cli/` を実行し、関連テストがすべてパスすることを確認します。

### Phase 2: 基準ドキュメントに基づく全体リファクタリング

1.  **対象:** `src/cli/*.js` および `tests/cli/*.test.js`
2.  **方針:** 提供された基準ドキュメント群（コーディング規約、設計原則、ユーティリティ利用ガイド、テストガイドライン、AI開発者ガイド）に基づいて、以下の点を中心にリファクタリングを実施します。
    *   命名規則、フォーマット、コメントの統一。
    *   依存性注入、エラーハンドリング、イベント発行、非同期処理の設計原則遵守。
    *   ユーティリティクラスの適切な利用。
    *   テストヘルパーの活用、モック戦略の最適化、テスト網羅性の向上。
    *   AIが生成しがちなアンチパターンの排除。
3.  **進め方:**
    *   `src/cli` 内のファイルを一つずつリファクタリングし、対応する `tests/cli` のテストファイルも修正します。
    *   ファイル単位での修正後、関連テストを実行して確認します。
    *   全ファイルの完了後、`tests/cli/` 配下の全テストを実行し、カバレッジを確認します。

## 4. リファクタリング計画の可視化 (Mermaid)

```mermaid
graph TD
    subgraph Phase 1: テスト修正
        A[テストレポート分析] --> B(原因特定: NotFoundError/StorageError/Integration);
        B --> C{src/cli/session-manager.js 修正};
        C --> D(catchブロックでNotFoundErrorを再スロー);
        B --> E{tests/cli/session-manager.test.js 修正};
        E --> F(StorageErrorモック修正);
        B --> G{tests/cli/integration.test.js 修正};
        G --> H(main関数テスト修正);
        D & F & H --> I(npm test tests/cli/ 実行);
        I -- 全てパス --> J(Phase 1 完了);
    end

    subgraph Phase 2: 全体リファクタリング
        K[基準ドキュメント群 参照] --> L{src/cli/*.js リファクタリング};
        L -- コーディング規約 --> M(命名, フォーマット, コメント);
        L -- 設計原則 --> N(DI, エラー処理, イベント, 非同期);
        L -- ユーティリティガイド --> O(各Util利用法);
        L -- AIガイド --> P(アンチパターン確認);
        M & N & O & P --> Q(ファイル単位で実施);
        Q --> R{tests/cli/*.test.js リファクタリング};
        R -- テストガイドライン --> S(ヘルパー利用, モック戦略, テスト網羅性);
        S --> T(ファイル単位で実施);
        Q & T --> U(関連テスト実行);
        U -- 全てパス --> V(Phase 2 完了);
    end

    J --> K;