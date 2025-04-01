# テストエラー修正計画

## 1. 背景

前回のリファクタリングにより、複数のテストファイルでエラーが発生しました。特にイベント発行の検証 (`expectStandardizedEventEmitted`) で多くの失敗が見られます。

## 2. 原因分析

エラーの主な原因は、イベント発行時のデータ (`emitStandardized` の呼び出し側) と、テストでの期待値 (`expectStandardizedEventEmitted` の呼び出し側) の間で、`timestamp`, `traceId`, `requestId` といったメタデータの扱いに関する認識が一致していないことであると推測されます。

*   ユーティリティクラス (`cache-manager.js` など) は、`emitStandardized` 呼び出し時にこれらのメタデータを付与していません。
*   テストヘルパー (`expectStandardizedEventEmitted`) は、これらのメタデータがデータに含まれていることを期待しています。

## 3. 修正戦略

以下のステップで修正を進めます。

1.  **イベント発行の統一 (最優先):**
    *   `src/lib/utils/event-emitter.js` の `emitStandardized` および `emitStandardizedAsync` メソッドを修正します。これらのメソッド内部で、`timestamp`, `traceId`, `requestId` を生成し、イベントデータに追加してから `super.emit` / `super.emitAsync` を呼び出すように変更します。
    *   これにより、各ユーティリティクラスはメタデータを個別に付与する必要がなくなります。
    *   テストヘルパー (`expectStandardizedEventEmitted`) は、これらのメタデータが存在し、期待される型であることを検証するように維持します。
2.  **関連テストの修正:**
    *   ステップ1の修正により、`expectStandardizedEventEmitted` を使用しているテスト (`cache-manager.test.js`, `storage.test.js`, `logger.test.js` など) の多くがパスするようになるはずです。パスしない場合は、期待値 (`expectedData`) を再確認し、修正します。
    *   `storage.test.js` のコンストラクタテストも、デフォルト ID ジェネレーターの挙動に合わせて修正が必要になる可能性があります。
3.  **その他のテストエラー修正:**
    *   `validator.test.js`: `sanitizeString` の実装 (`src/lib/utils/validator.js`) とテストの期待値を比較し、修正します。
    *   `error-helpers.test.js`: `emitErrorEvent` 内の `logger.error` 呼び出し形式を確認し、`expectLogged` の期待値を修正します。
    *   `errors.test.js`: `StorageError` のコンストラクタ呼び出しを確認し、`cause` が正しく渡されるように修正します (必要であれば `core/error-framework.js` も確認)。
    *   `event-emitter.test.js`: `EventEmitter` のコンストラクタが `EnhancedEventEmitter` のコンストラクタを正しく呼び出し、`keepHistory` と `historyLimit` が適切に設定されるように修正します。
    *   `logger.test.js`: `addTransport` や `addContextProvider` でのイベント発行やプロパティ設定の問題を調査し、実装またはテストを修正します。
    *   `lock-manager.test.js`: タイムアウトしているテストケースの Jest タイムアウト値を増やします (例: `test('...', async () => { ... }, 10000);`)。
4.  **最終確認:** すべてのテストを実行し、パスすることを確認します。

## 4. 修正計画図

```mermaid
graph TD
    subgraph 全体フロー
        A[エラー分析] --> B(イベント発行統一戦略立案);
        B --> C[EventEmitter 実装修正];
        C --> D(関連テスト修正/確認);
        A --> E(個別エラー分析);
        E --> F(個別テスト/実装修正);
        D & F --> G(全テスト実行);
        G --> H{全パス?};
        H -- Yes --> I[完了];
        H -- No --> A;
    end

    subgraph イベント発行統一
        direction LR
        C1[event-emitter.js の emitStandardized/Async 修正] --> C2(メタデータ付与);
        D1[cache-manager.test.js] --> D2(期待値確認/修正);
        D3[storage.test.js] --> D4(期待値確認/修正);
        D5[logger.test.js] --> D6(期待値確認/修正);
    end

    subgraph 個別修正
        direction LR
        F1[validator.test.js] --> F2(sanitizeString 修正);
        F3[error-helpers.test.js] --> F4(expectLogged 修正);
        F5[errors.test.js] --> F6(StorageError cause 修正);
        F7[event-emitter.test.js] --> F8(コンストラクタ修正);
        F9[lock-manager.test.js] --> F10(タイムアウト調整);
    end

    C --> D1;
    C --> D3;
    C --> D5;
    E --> F1;
    E --> F3;
    E --> F5;
    E --> F7;
    E --> F9;