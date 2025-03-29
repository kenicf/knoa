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
    *   AIに機能コードの生成を依頼する際は、同時にテストコードの生成も依頼してください。
    *   生成されたテストコードを実行し、テストがパスすること、およびカバレッジが十分であることを確認します ([テスト戦略とガイドライン](testing-guidelines.md) 参照)。
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
    *   **悪い例:** 正常系のテストしかない、アサーションが不十分 (`expect(true).toBe(true)`)、モックが適切でない。
    *   **良い例:** エラーケース、境界値、イベント発行、モックの呼び出し回数/引数などを網羅的にテストする。[テスト戦略とガイドライン](testing-guidelines.md) のヘルパー関数を活用する。
    *   **指針:** [テスト戦略とガイドライン](testing-guidelines.md) を参照してください。
*   **不必要な複雑化:** 過度な抽象化、複雑なデザインパターンの不適切な適用。
    *   **指針:** シンプルさを保ち、必要になるまで複雑な解決策を導入しない (YAGNI - You Ain't Gonna Need It)。

## 3. ドキュメント活用法

AIにタスクを依頼する際は、以下のドキュメントを参照するように指示すると効果的です。

*   **新しいクラス/関数を追加する場合:**
    *   [コーディング規約](coding-standards.md)
    *   [設計原則とパターン](design-principles.md)
*   **既存のユーティリティクラスを利用する場合:**
    *   [ユーティリティクラス利用ガイド](utility-guides/) (該当するクラスのガイド)
    *   [設計原則とパターン](design-principles.md) (特に DI, エラー処理, イベント)
*   **テストコードを作成/修正する場合:**
    *   [テスト戦略とガイドライン](testing-guidelines.md)
    *   [コーディング規約](coding-standards.md) (テストコードのスタイル)
*   **リファクタリングを行う場合:**
    *   関連するすべてのガイドライン ([コーディング規約](coding-standards.md), [設計原則](design-principles.md), [テスト戦略](testing-guidelines.md))
    *   変更対象の [ユーティリティクラス利用ガイド](utility-guides/)
*   **AIへの指示方法に迷った場合:**
    *   この [AI開発者向けガイド](ai-developer-guide.md)

これらのガイドラインを活用し、AIと協力して高品質なソフトウェア開発を進めましょう。