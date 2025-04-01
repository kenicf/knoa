# テストエラー修正計画 (フェーズ2)

## 1. 背景

前回のリファクタリングにより発生したテストエラーの解決を目指します。エラーの大部分は、イベント発行のテストヘルパー (`expectStandardizedEventEmitted`) とモック (`createMockEventEmitter`) の間の不整合、および `LockManager` のテストにおけるアサーションの問題に起因すると特定されました。

## 2. 戦略

1.  **イベント発行エラーの解決:** `tests/helpers/mock-factory.js` の `createMockEventEmitter` を修正し、モックの `emitStandardized` が実際の `EventEmitter.emitStandardized` の動作（特に `traceId`, `requestId` の自動付与）を正確に模倣するようにします。
2.  **LockManager のタイムアウトエラー解決:** `tests/lib/utils/lock-manager.test.js` のタイムアウトエラーが発生しているテストケースのアサーションを、実際のログ出力やエラーオブジェクトの構造に合わせて修正します。

## 3. 計画

以下のステップで修正を進めます。

1.  **情報収集・原因特定:** 完了。
2.  **修正方針決定:** 完了。
3.  **計画の提示と確認:** 完了。
4.  **修正ファイルの書き込み:**
    *   `tests/helpers/mock-factory.js` を `write_to_file` で修正。
    *   `tests/lib/utils/lock-manager.test.js` を `write_to_file` で修正。
5.  **モード切り替え:** `code` モードに切り替えて、テストの再実行と結果確認を依頼。

## 4. 修正フロー (Mermaid)

```mermaid
graph TD
    A[テストエラー発生] --> B{原因分析};
    B --> C[イベント関連エラー (mock-factory)];
    B --> D[LockManagerエラー (test assertion)];
    C --> E[mock-factory.js 修正];
    D --> F[lock-manager.test.js 修正];
    E --> G[write_to_file (mock-factory.js)];
    F --> H[write_to_file (lock-manager.test.js)];
    G --> I{テスト再実行};
    H --> I;
    I --> J[エラー解消確認];