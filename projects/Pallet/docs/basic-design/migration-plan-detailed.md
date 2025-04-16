# 基本設計書 移行作業計画 (詳細実行計画)

**フェーズ1: 移行準備**

1.  **前提確認:**
    *   YAML編集・スキーマ検証が可能なエディタ（VSCode推奨）が利用可能であること。
    *   Gitによるバージョン管理が設定されていること。
    *   Mermaid記法をプレビューできる環境があること。
2.  **ファイル準備:**
    *   空の `projects/Pallet/docs/basic-design/basic-design.yaml` ファイルを作成します。
    *   詳細設計Markdownを格納するディレクトリ `projects/Pallet/docs/basic-design/detailed-designs/` を作成します。
    *   Mermaid図を格納するディレクトリ `projects/Pallet/docs/basic-design/diagrams/` を作成します。

**フェーズ2: Markdown分析 (机上)**

*   提供されたMarkdownファイル (`01`～`05`)、`basic-design.schema.json` (v1.9)、`yaml-vs-markdown-guideline.md` (v1.4) を精査し、以下の点を整理します。
    *   各Markdownセクション/項目と、YAMLスキーマ要素のマッピング。
    *   YAMLに記述すべき「概要」と、詳細設計Markdownに記述すべき「詳細」の切り分け。
    *   `details` セクションに必要な情報（設計根拠、テスト戦略、標準準拠等）の抽出。
    *   Mermaid図の特定とファイル化の方針確認。
    *   必要となる詳細設計Markdownファイルリストの作成（例: `T_CaseInfo.md`, `FRM12003_DedicatedUI.md` など）。

**フェーズ3: YAML移行実施 (段階的構築)**

*   **`apply_diff` 戦略:** 各ステップで `basic-design.yaml` の末尾（または適切なセクションの末尾）に新しいセクションを追加します。`apply_diff` の `SEARCH` ブロックでは、追加箇所の直前の行（通常はインデントが同じレベルの最終行）を正確に指定し、`REPLACE` ブロックにはその行の内容と追加するYAMLブロック全体を含めます。追加するYAMLブロックは、正しいインデントを維持していることを確認します。

*   **ステップ 3.1: 初期構造の作成**
    *   `basic-design.yaml` に `schema_version`, `document_info`, `prerequisite_documents` を追加します。`document_info` の内容は `basic-design-01-introduction.md` のヘッダー情報や計画書を参考に設定します。`prerequisite_documents` は計画書および `basic-design-01-introduction.md` に基づき定義します。
    *   **ツール使用:** `<write_to_file>` (初回のみ) または `<apply_diff>`

*   **ステップ 3.2: `introduction` セクションの追加**
    *   `basic-design-01-introduction.md` の「1.1. 本書の目的」「1.2. 適用範囲」から概要を抽出し、`introduction` セクションとしてYAMLに追加します。
    *   **ツール使用:** `<read_file>` (`basic-design.yaml` の最終行付近) -> `<apply_diff>`

*   **ステップ 3.3: `system_configuration` セクションの追加**
    *   `basic-design-02-system-configuration.md` の「2.1. システム構成概要」「2.3. 構成要素補足」から概要を抽出し、`system_configuration` セクション (`overview`, `components`) としてYAMLに追加します。
    *   Mermaid図は `projects/Pallet/docs/basic-design/diagrams/system-configuration.mmd` に保存し、`diagram.mermaid_file` で参照パスを記述します。（Mermaidファイルの作成は別途行います）
    *   各 `components` の `details` セクションをスキーマに従って概要レベルで記述します。
    *   **ツール使用:** `<read_file>` (`basic-design.yaml` の最終行付近) -> `<apply_diff>`

*   **ステップ 3.4: `backend_design` セクションの追加**
    *   `basic-design-03-backend-design.md` の「3.1. データベース概要」から `database_overview`, `general_notes` を抽出し、YAMLに追加します。
    *   **テーブル定義 (`tables`) の移行:**
        *   各テーブル定義をMarkdownから読み取り、スキーマに従ってYAMLのリスト構造に変換します。フィールド定義 (`fields`)、インデックス定義 (`indexes`) を含みます。
        *   各テーブルに `details` セクション (`StandardDetailsSection`) を追加し、設計根拠、テスト戦略、標準準拠等の**概要**を記述します。
        *   各テーブルに **必須** で `detailed_design_ref` を追加し、対応する詳細設計Markdownファイルへのパス（例: `./detailed-designs/T_CaseInfo.md`）を指定します。
    *   **リレーションシップ定義 (`relationships`) の移行:**
        *   ER図は `projects/Pallet/docs/basic-design/diagrams/er-diagrams.mmd` 等に保存し、`diagrams` で参照パスを記述します。（Mermaidファイルの作成は別途行います）
        *   各リレーション定義を `details` リストに移行します。
    *   **ツール使用:** `<read_file>` (`basic-design.yaml` の最終行付近) -> `<apply_diff>` (テーブル定義、リレーション定義は1度に3～4つの定義をめどに、複数回の `apply_diff` に分割する。)

*   **ステップ 3.5: `query_definitions` セクションの追加**
    *   `basic-design-04-query-definitions.md` から各クエリ定義を読み取り、スキーマに従ってYAMLのリスト構造 (`query_definitions`) に変換します。
    *   `query_id`, `logical_name`, `purpose`, `query_type`, `primary_tables`, `primary_fields` 等のキー情報を記述します。
    *   `filter_conditions_summary`, `join_conditions_summary` に**概要**を記述します。
    *   `filter_parameters` を定義します。
    *   `sql_definition` は短い場合は直接記述、複雑な場合は「詳細はMarkdown参照」とし、`detailed_design_ref` を設定します。
    *   各クエリに `details` セクション (`StandardDetailsSection`) を追加し、特に性能考慮事項、テスト戦略の**概要**を記述します。
    *   複雑なクエリや重要なクエリには **推奨** で `detailed_design_ref` を追加します。
    *   **ツール使用:** `<read_file>` (`basic-design.yaml` の最終行付近) -> `<apply_diff>` (クエリ定義も1度に3～4つの定義をめどに、複数回の `apply_diff` に分割)

*   **ステップ 3.6: `frontend_design` セクションの追加**
    *   `basic-design-05-frontend-design.md` の「5. フロントエンド(FE)設計 (WIP)」から `general_principles`, `common_ui_components`（もしあれば）を抽出し、YAMLに追加します。
    *   **画面定義 (`screens`) の移行:**
        *   各画面定義をMarkdownから読み取り、スキーマに従ってYAMLのリスト構造に変換します。
        *   `screen_id`, `screen_name`, `screen_type`, `category`, `description`, `primary_sources`, `primary_destinations` 等のキー情報を記述します。
        *   各画面に **必須** で `details` セクション (`ScreenDetails`) を追加し、`data_sources`, `ui_logic_separation`, `data_integration`, `accessibility`, `details_section` 等の**概要**を記述します。特に `accessibility.implementation_notes` には**具体的な実装方針の概要 (How)** を記述します。
        *   各画面に **必須** で `detailed_design_ref` を追加し、対応する詳細設計Markdownファイルへのパス（例: `./detailed-designs/FRM12003_DedicatedUI.md`）を指定します。
    *   **画面遷移図 (`screen_transitions`) の移行:**
        *   画面遷移図（Mermaid）は `projects/Pallet/docs/basic-design/diagrams/screen-transitions.mmd` 等に保存し、`diagrams` で参照パスを記述します。（Mermaidファイルの作成は別途行います）
    *   **ツール使用:** `<read_file>` (`basic-design.yaml` の最終行付近) -> `<apply_diff>` (画面定義も1度に3～4つの定義をめどに、複数回の `apply_diff` に分割)

**フェーズ4: 詳細設計Markdown作成**

*   フェーズ2でリストアップされた詳細設計Markdownファイル (`./detailed-designs/*.md`) を作成します。
*   `yaml-vs-markdown-guideline.md` (v1.4) の「2. 参照Markdownファイルに記述すべき内容」に従い、YAMLの概要項目に対応する詳細情報（背景、根拠、ロジック、代替案比較、テストシナリオ、標準準拠詳細など）を記述します。
*   Markdown内から関連するYAMLセクションへの参照を記述します（例: `(参照: basic-design.yaml > backend_design.tables[name='T_CaseInfo'].details.design_rationale)`）。
*   **ツール使用:** `<write_to_file>` (各Markdownファイルに対して)

**フェーズ5: レビュー・検証**

*   作成された `basic-design.yaml` が `basic-design.schema.json` (v1.9) に対して妥当か検証します（ユーザー様側での実行）。
*   YAMLとMarkdownの内容が `yaml-vs-markdown-guideline.md` (v1.4) の分担ルールに従っているか確認します。
*   `detailed_design_ref` が適切に設定され、対応するMarkdownファイルが存在するか確認します。
*   移行された内容（YAMLとMarkdown）が元の設計意図を維持し、正確であるかレビューします。特に `details` セクションの内容の妥当性と具体性（**How** が記述されているか）を確認します。
*   レビュー結果に基づき、YAMLファイルおよびMarkdownファイルを修正します。
*   **ツール使用:** `<read_file>`, `<apply_diff>`, `<write_to_file>` (修正内容に応じて)

**フェーズ6: 完了・展開**

*   全てのレビューと修正が完了したら、移行作業の完了を宣言します。
*   Gitで最終版をコミット・タグ付けします（ユーザー様側での実行）。
*   関係者（ユーザー様）に対して、新しいドキュメント管理方式への移行完了と、今後の参照・更新方法を周知します。

**Mermaid図によるプロセス概要:**

```mermaid
graph TD
    A[移行準備: ファイル/ディレクトリ作成] --> B(Markdown分析: YAML/MD切り分け);
    B --> C{YAML移行実施 (段階的)};
    C -- apply_diff --> C1[Step 3.1: 初期構造];
    C1 -- apply_diff --> C2[Step 3.2: introduction];
    C2 -- apply_diff --> C3[Step 3.3: system_configuration];
    C3 -- apply_diff --> C4[Step 3.4: backend_design];
    C4 -- apply_diff --> C5[Step 3.5: query_definitions];
    C5 -- apply_diff --> C6[Step 3.6: frontend_design];
    C6 --> D{詳細設計MD作成};
    B --> D; %% 分析結果に基づきMD作成
    D -- write_to_file --> E[レビュー/検証];
    C6 --> E; %% YAML完成後レビュー
    E -- 修正 --> C; %% YAML修正の場合
    E -- 修正 --> D; %% MD修正の場合
    E --> F[完了/展開];

    style A fill:#f9f,stroke:#333,stroke-width:2px
    style B fill:#ccf,stroke:#333,stroke-width:2px
    style C fill:#ffc,stroke:#333,stroke-width:2px
    style D fill:#cfc,stroke:#333,stroke-width:2px
    style E fill:#fec,stroke:#333,stroke-width:2px
    style F fill:#eee,stroke:#333,stroke-width:2px