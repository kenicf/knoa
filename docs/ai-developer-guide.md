# AI開発者向けガイド

このドキュメントは、AI（大規模言語モデルなど）を開発プロセスに活用する際のガイドラインと注意点を提供します。AIの効果を最大化し、同時にコードの品質と一貫性を維持することを目的とします。

## 1. AI利用時の注意点とコツ

*   **明確なコンテキストの提供:**
    *   AIにコード生成やリファクタリングを依頼する際は、関連するファイルの内容、既存のコードスニペット、および参照すべきドキュメント（特に [コーディング規約](coding-standards.md)、[設計原則とパターン](design-principles.md)、関連する [ユーティリティクラス利用ガイド](utility-guides/)）を明確に指示してください。
    *   曖昧な指示（例: 「このコードを改善して」）ではなく、具体的な要件（例: 「`UserService` クラスに `deleteUser` メソッドを追加し、[設計原則](design-principles.md) のエラーハンドリング戦略に従ってエラー処理を実装してください」）を与えてください。
*   **段階的な指示:**
    *   一度に大規模な変更や複雑な機能全体の実装を指示するのではなく、タスクをより小さな、管理可能なステップに分割して依頼してください。
    *   各ステップの完了後に結果を確認し、必要に応じてフィードバックを与えながら進めることで、手戻りを減らすことができます。
*   **生成されたコードのレビュー:**
    *   AIが生成したコードは**必ず人間がレビュー**してください。
    *   [コーディング規約](coding-standards.md) および [設計原則とパターン](design-principles.md) に準拠しているか確認します。
    *   ロジックが正しいか、エッジケースが考慮されているか、セキュリティ上の問題がないかを確認します。
    *   不適切なパターン（下記のアンチパターン集を参照）が含まれていないかを確認します。
*   **テストコードの活用:**
    *   AIに機能コードの生成を依頼する際は、同時にテストコードの生成も依頼してください。**その際、[テスト戦略とガイドライン](testing-guidelines.md) に記載されている FIRST原則、AAAパターン、テスト容易性を考慮したテストコードを生成するように具体的に指示してください。** (例: 「`UserService` の `getUser` メソッドに対する単体テストを、AAAパターンに従って作成してください。依存する `Database` クラスはモック化し、正常系とユーザーが見つからないエラーケースをテストしてください。」)
    *   生成されたテストコードを実行し、テストがパスすること、およびカバレッジが十分であることを確認します。**さらに、生成されたテストが FIRST原則を満たしているか（独立性、反復可能性など）、AAAパターンに従っているか、アサーションが適切かつ十分かもレビューしてください。**
*   **具体的なフィードバック:**
    *   AIの出力が期待通りでない場合、「うまくいかない」と言うだけでなく、具体的にどの部分がどのように問題なのか、どのように修正してほしいのかを明確にフィードバックしてください。
    *   良い例、悪い例を提示することも効果的です。

## 2. アンチパターン集 (AIが生成しがちな例)

AIは効率的にコードを生成できますが、プロジェクト固有の規約やベストプラクティスから逸脱することもあります。以下は特に注意すべきアンチパターンとその修正例です。

*   **エラーハンドリング不足:**
    *   **悪い例:**
        ```javascript
        // エラーを無視している
        try {
          await fs.promises.readFile(filePath);
        } catch (error) {}

        // 具体性のないエラーをスロー
        const data = service.getData();
        if (!data) {
          throw new Error('Failed to get data');
        }
        ```
    *   **良い例:**
        ```javascript
        // 適切なエラー処理または再スロー
        try {
          await fs.promises.readFile(filePath);
        } catch (error) {
          // errorHandler に委譲するか、カスタムエラーをスロー
          this.errorHandler.handle(new StorageError('Failed to read file', error, { filePath }));
          // または: throw new StorageError('Failed to read file', error, { filePath });
        }

        // 具体的なカスタムエラーを使用
        const data = service.getData();
        if (!data) {
          throw new DataConsistencyError('Data not found for ID: ' + id);
        }
        ```
    *   **指針:** [設計原則とパターン](design-principles.md) の「エラーハンドリング戦略」を参照してください。
*   **イベント名の不統一/非標準的な発行:**
    *   **悪い例:**
        ```javascript
        this.eventEmitter.emit('userCreatedEvent', userData); // 規約違反
        this.eventEmitter.emit('storage:file-written', { path }); // ケバブケース混在
        ```
    *   **良い例:**
        ```javascript
        this.eventEmitter.emitStandardized('user', 'created', userData);
        this.eventEmitter.emitStandardized('storage', 'file_written', { path });
        ```
    *   **指針:** [設計原則とパターン](design-principles.md) の「イベント駆動アーキテクチャ」および [コーディング規約](coding-standards.md) の「命名規則」を参照してください。
*   **非同期処理の誤り (`floating promise`):**
    *   **悪い例:**
        ```javascript
        // await を忘れている
        service.updateDatabase();
        console.log('Update started...'); // 完了前にログが出る可能性がある
        ```
    *   **良い例:**
        ```javascript
        try {
          await service.updateDatabase();
          console.log('Database updated successfully.');
        } catch (error) {
          console.error('Database update failed:', error);
        }
        ```
    *   **指針:** [設計原則とパターン](design-principles.md) の「非同期処理」を参照してください。
*   **依存関係のハードコーディング:**
    *   **悪い例:**
        ```javascript
        class MyController {
          constructor() {
            this.logger = new Logger(); // DI を使用していない
            this.userService = global.userService; // グローバル参照
          }
          // ...
        }
        ```
    *   **良い例:**
        ```javascript
        class MyController {
          constructor(options = {}) {
            if (!options.logger || !options.userService) {
              throw new Error('Missing required dependencies');
            }
            this.logger = options.logger;
            this.userService = options.userService;
          }
          // ...
        }
        ```
    *   **指針:** [設計原則とパターン](design-principles.md) の「依存性注入 (DI)」を参照してください。
*   **テスト不足/不適切なテスト:**
    *   **悪い例:**
        *   正常系のテストしかない。
        *   アサーションが不十分 (`expect(true).toBe(true)`) または全くない。
        *   テストが他のテストに依存している (Independent 違反)。
        *   テスト実行に時間がかかりすぎる (Fast 違反、例: 実際のDBアクセス)。
        *   AAAパターンに従っていないため、テストの意図が不明瞭。
        *   モックが実際の依存関係と異なる振る舞いをする (契約違反)。
        *   テスト容易性を考慮しない実装に対する、複雑で脆いテスト。
    *   **良い例:**
        *   エラーケース、境界値、イベント発行、モックの呼び出し回数/引数などを網羅的にテストする。
        *   [テスト戦略とガイドライン](testing-guidelines.md) のヘルパー関数を活用する。
        *   FIRST原則、AAAパターンを意識してテストを記述する。
        *   テスト容易な設計を心がけ、シンプルなテストを書く。
    *   **指針:** [テスト戦略とガイドライン](testing-guidelines.md) を参照してください。
*   **不必要な複雑化:** 過度な抽象化、複雑なデザインパターンの不適切な適用。
    *   **指針:** シンプルさを保ち、必要になるまで複雑な解決策を導入しない (YAGNI - You Ain't Gonna Need It)。
*   **★★★ モック実装の不備 ★★★:**
    *   **悪い例:** モックファクトリ (`createMockEventEmitter` など) が、実際のクラスの重要な動作（例: `emitStandardized` での `traceId`/`requestId` の自動付与）を模倣していない。単純な `jest.fn()` を返すだけでは、テストヘルパーが期待するデータ構造と一致せず、テストが失敗する原因となる。
    *   **良い例:** モックファクトリは、テスト対象コードが依存するメソッドのシグネチャだけでなく、テスト結果に影響を与える可能性のある内部動作（データの加工や追加など）も可能な限り正確に再現する。依存クラスの実装が変更された場合は、モックファクトリも追随して更新する。
    *   **指針:** [テスト戦略とガイドライン](testing-guidelines.md) の「モック戦略と契約によるテスト」を参照。
*   **★★★ テストヘルパーの期待値不一致 ★★★:**
    *   **悪い例:** テストヘルパー (`expectStandardizedEventEmitted` など) の期待値 (`expectedData`) が、イベント発行側の実際のデータ構造（キー名、値の形式など）と一致していない。例えば、イベント発行側が `path` プロパティを含むデータを渡しているのに、テストでは `directory` と `filename` を期待している。
    *   **良い例:** テストヘルパーを使用する際は、イベント発行側のコード（例: `_emitEvent`）をよく確認し、期待するデータ構造を正確に指定する。特に、パスの形式（OS依存かPOSIXか）や、動的に生成されるID（`traceId`, `requestId`）の扱い（存在チェックのみか、具体的な値を期待するか）に注意する。
    *   **指針:** [テスト戦略とガイドライン](testing-guidelines.md) の「イベントテスト」および「テストヘルパー利用法」を参照。

## 3. ドキュメント活用法

AIにタスクを依頼する際は、以下のドキュメントを参照するように指示すると効果的です。

*   **新しいクラス/関数を追加する場合:**
    *   [コーディング規約](coding-standards.md)
    *   [設計原則とパターン](design-principles.md)
*   **既存のユーティリティクラスを利用する場合:**
    *   [ユーティリティクラス利用ガイド](utility-guides/) (該当するクラスのガイド)
    *   [設計原則とパターン](design-principles.md) (特に DI, エラー処理, イベント)
*   **テストコードを作成/修正する場合:**
    *   [テスト戦略とガイドライン](testing-guidelines.md) (**特に FIRST原則, AAAパターン, テスト容易性, モック戦略** のセクション)
    *   [コーディング規約](coding-standards.md) (テストコードのスタイル)
*   **リファクタリングを行う場合:**
    *   関連するすべてのガイドライン ([コーディング規約](coding-standards.md), [設計原則](design-principles.md), [テスト戦略](testing-guidelines.md))
    *   変更対象の [ユーティリティクラス利用ガイド](utility-guides/)
*   **AIへの指示方法に迷った場合:**
    *   この [AI開発者向けガイド](ai-developer-guide.md)

これらのガイドラインを活用し、AIと協力して高品質なソフトウェア開発を進めましょう。