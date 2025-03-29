# テスト環境改善戦略プラン

このドキュメントは、プロジェクトのテスト環境を段階的に改善するための戦略プランを定義します。

## 1. 現状の評価

*   **Jest:**
    *   基本的なテスト実行、カバレッジ測定、閾値設定 (`coverageThreshold`) は `jest.config.js` で適切に設定されており、良好な基盤があります。
    *   特定のディレクトリ (`adapters`, `core/error-framework.js`) に対して高いカバレッジ目標が設定されており、品質への意識が高いことが伺えます。
    *   テストヘルパー (`tests/helpers`) が整備されており、モック生成や標準化されたイベント/ログの検証が効率化されています。
    *   モック (`jest.fn`, `jest.spyOn`, `jest.mock`) や非同期テスト (`async/await`, `.resolves/.rejects`) の基本的な使い方は [テスト戦略とガイドライン](testing-guidelines.md) に記載されていますが、プロジェクト全体での活用度合いはこれから確認が必要です。
    *   スナップショットテストは現時点では活用されていないようです。
*   **ESLint & Prettier:**
    *   ESLint (`eslint.config.js`) と Prettier (`.prettierrc.json`) が導入され、基本的なコードチェックとフォーマットは行われています。
    *   `eslint-config-prettier` により、ESLint と Prettier のルール競合は回避されています。
    *   しかし、`eslint-plugin-node`, `eslint-plugin-jest`, `eslint-plugin-promise`, `eslint-plugin-security` といった、より高度なチェックを行うための ESLint プラグインは導入されていません。
    *   Prettier のフォーマット違反を ESLint エラーとして報告する仕組み (`eslint-plugin-prettier`) は導入されていません。
*   **CI/CD:**
    *   継続的インテグレーション (CI) / 継続的デリバリー (CD) のパイプラインは**未導入**です。これにより、コード変更時の自動的な品質チェックが行われておらず、手動でのテスト実行や Lint チェックに依存している状態です。
*   **その他ツール:**
    *   コードフォーマッターとして Prettier は導入済みです。
    *   SonarQube/SonarCloud (高度な静的解析)、依存関係脆弱性スキャン (npm audit の自動実行、Dependabot)、`dependency-cruiser` (依存関係ルール) などは導入されていません。

## 2. 改善戦略

以下のフェーズで段階的にテスト環境を強化していくことを提案します。

```mermaid
graph TD
    subgraph 現状
        A[Jest設定済 (カバレッジ閾値含む)]
        B[ESLint+Prettier基本設定済]
        C[CI/CD 未導入]
        D[高度ツール 未導入]
    end

    subgraph 改善プラン
        direction LR
        subgraph フェーズ1: 静的解析強化
            P1_1[ESLintプラグイン導入<br>(node, jest, promise, security)]
            P1_2[Prettier連携強化<br>(eslint-plugin-prettier)]
            P1_3[エディタ連携設定の推奨]
        end
        subgraph フェーズ2: CI導入 (GitHub Actions)
            P2_1[基本ワークフロー作成<br>(.github/workflows/ci.yml)]
            P2_2[自動実行:<br>- Lint (npm run lint)<br>- Format Check (npm run format:check)<br>- Test & Coverage (npm run test:ci)<br>- Vulnerability Scan (npm audit)]
            P2_3[ブランチ保護ルール設定<br>(mainブランチへのマージ条件)]
        end
        subgraph フェーズ3: テスト実践強化
            P3_1[Jest高度機能の活用促進<br>(Mock, Async, Snapshot検討)]
            P3_2[カバレッジ維持・向上の仕組み化<br>(CIでの閾値チェック)]
        end
        subgraph フェーズ4: 高度化 (任意)
            P4_1[SonarCloud導入検討]
            P4_2[Dependabot有効化]
            P4_3[dependency-cruiser導入検討]
        end
        フェーズ1 --> フェーズ2 --> フェーズ3 --> フェーズ4
    end

    subgraph ドキュメント更新
        E[testing-guidelines.md 更新<br>(CI, ESLint強化, その他ツール)]
        F[ai-developer-guide.md 更新<br>(CIの重要性)]
        G[導入手順/設定例ドキュメント作成 (任意)]
    end

    現状 --> 改善プラン
    改善プラン --> ドキュメント更新

```

*   **フェーズ1: 静的解析の強化 (ESLint & Prettier)**
    *   **目的:** コードの潜在的なバグ、セキュリティリスク、ベストプラクティス違反を早期に発見し、コードフォーマットの一貫性を強制する。
    *   **タスク:**
        1.  ESLint プラグイン (`eslint-plugin-node`, `eslint-plugin-jest`, `eslint-plugin-promise`, `eslint-plugin-security`) を導入し、`eslint.config.js` を更新してルールを有効化する。
        2.  `eslint-plugin-prettier` を導入し、Prettier のフォーマット違反を ESLint エラーとして報告するように `eslint.config.js` を設定する。（これにより `npm run lint` でフォーマット崩れも検出できる）
        3.  VS Code などのエディタで ESLint/Prettier 拡張機能を活用し、保存時の自動フォーマット・Lint チェックを行う設定を推奨するドキュメントを作成または更新する。
*   **フェーズ2: CI パイプラインの導入 (GitHub Actions)**
    *   **目的:** コード変更（特に Pull Request）時に、Lint、フォーマットチェック、テスト、脆弱性スキャンを自動実行し、品質基準を満たさないコードのマージを自動的に防止する仕組みを構築する。
    *   **タスク:**
        1.  GitHub Actions のワークフローファイル (`.github/workflows/ci.yml`) を作成する。
        2.  ワークフロー内で以下のステップを実行するように設定する:
            *   コードのチェックアウト
            *   Node.js のセットアップ (複数のバージョンでテストすることも可能)
            *   依存関係のインストール (`npm ci` を使用)
            *   ESLint による Lint チェック (`npm run lint`)
            *   Prettier によるフォーマットチェック (`npm run format:check` - フェーズ1で `eslint-plugin-prettier` を導入した場合、`npm run lint` に統合可能)
            *   Jest によるテスト実行とカバレッジ測定 (`npm run test:ci` または `npm test -- --coverage`)
            *   `npm audit` による依存関係の脆弱性スキャン (例: `npm audit --audit-level=high`)
        3.  GitHub リポジトリ設定でブランチ保護ルールを有効にし、main ブランチへのマージ条件として、この CI ワークフローの成功を必須とする。
*   **フェーズ3: テストの実践強化**
    *   **目的:** CI 基盤の上で、テストコード自体の質を高め、カバレッジを維持・向上させる。
    *   **タスク:**
        1.  既存のテストコードをレビューし、Jest の高度な機能（特に `jest.mock` や `jest.spyOn` を使ったモック、`.resolves`/`.rejects` を使った非同期テスト）の活用が不足している箇所を特定し、改善を推奨する。
        2.  UI コンポーネントや複雑な設定オブジェクトなど、スナップショットテストが有効な箇所があれば導入を検討する。
        3.  CI パイプラインで Jest の `coverageThreshold` チェックが確実に機能するようにし、カバレッジが低下した場合に CI が失敗するようにする。
        4.  定期的にカバレッジレポートを確認し、テストが不足している重要なロジックやエラーパスを特定してテストを追加する文化を醸成する。
*   **フェーズ4: 高度なツールの導入 (任意)**
    *   **目的:** さらなるコード品質の向上、技術的負債の可視化、依存関係管理の自動化を目指す。
    *   **タスク (必要に応じて):**
        1.  SonarCloud (無料プランあり) または SonarQube を導入し、コードの複雑度、重複、バグ、脆弱性、コードスメルを継続的に監視する。
        2.  GitHub の Dependabot を有効化し、依存ライブラリの脆弱性修正やアップデートの Pull Request を自動作成させる。
        3.  `dependency-cruiser` を導入し、モジュール間の依存関係ルール (例: 「`core` は `adapters` に依存しない」) を定義・強制し、アーキテクチャの維持を図る。

## 3. ドキュメント更新

*   上記の改善活動に合わせて、以下のドキュメントを更新します。
    *   `docs/testing-guidelines.md`: CI/CD パイプラインの概要、ESLint プラグイン、強化された Prettier 連携、その他の推奨ツール (SonarCloud, Dependabot, dependency-cruiser) について追記・更新する。
    *   `docs/ai-developer-guide.md`: CI/CD による自動品質チェックの重要性や、開発者が Lint/Format エラーを早期に修正する必要性について追記する。
    *   必要であれば、各フェーズの具体的な導入手順や設定例をまとめた新しいドキュメントを作成する。