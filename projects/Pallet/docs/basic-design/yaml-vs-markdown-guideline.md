# 記述粒度ガイドライン (YAML vs Markdown) - 改訂版 v1.4

**目的:** YAMLソースファイル (`basic-design.yaml` 等、**JSON Schema v1.9準拠**) と、そこから参照される詳細設計Markdownファイル (`./detailed-designs/*.md` 等) の間で、記述する情報の粒度と内容を明確に分け、基本設計ドキュメント全体の一貫性と保守性を最大限に高める。

**基本方針:**

* **YAML (`basic-design.yaml`等):** 「構造化されたデータ」と「キー情報」、および設計判断の**「概要」**を保持する **Source of Truth (信頼できる唯一の情報源)** とする。JSON Schema v1.9による検証が可能。自動生成ツールはこのYAMLファイルを主たる入力とする。
* **Markdown (`./detailed-designs/*.md` 等):** YAMLに書ききれない**「補足的な説明」、「詳細な自由記述」、「具体的なロジック解説」、「UIモックアップの説明」、「設計判断の背景や詳細な根拠（代替案、トレードオフ含む）」、「具体的なテストシナリオ」、「性能/セキュリティ/トランザクション管理等の詳細」、「標準準拠の詳細」**などを記述するための**補足ドキュメント**とする。YAML内の `detailed_design_ref` キーから参照される。

**改訂履歴:**

* v1.0: 初版
* v1.1: YAMLスキーマ v1.5 ベースに改訂。`details`セクション標準化、`detailed_design_ref`導入。
* v1.2: JSON Schema v1.7 ベースに改訂。`standard_compliance`項目追加、記述例の大幅な具体化、MarkdownからのYAML参照ルール追加。
* v1.3: JSON Schema v1.8 ベースに改訂。`details`セクション、`standard_compliance`、`detailed_design_ref`の記述例/ガイドライン強化。トランザクション管理等の詳細記述場所を明確化。
* **v1.4:** **JSON Schema v1.9 ベース**に改訂。`standard_compliance.compliance_summary`、`ScreenDetailsAccessibility.implementation_notes`、`detailed_design_ref` 等の記述ガイドラインを、スキーマ側のdescription強化に合わせて具体化。全体的な記述整合性を向上。

---

## 1. YAMLファイル (`basic-design.yaml`等) に記述すべき内容

**原則:** 構造化されており、JSON Schema v1.9で検証可能で、一貫性が求められ、他の要素から参照される可能性のある情報、および設計上の判断や考慮事項の**概要**を記述します。**各概要記述フィールド（例: `description`, `details`内項目）はJSON Schemaで定義された`maxLength`（多くは500文字）を目安とし、詳細はMarkdownに記述します。**

### 1.1. 構造化データ

* **テーブル定義 (`backend_design.tables`):**
    * テーブル名 (`name`)、論理名 (`logical_name`)、**概要説明 (`description`: maxLength参照)**、ステータス (`status`)。
    * フィールド定義リスト (`fields`): 各フィールドの物理名、論理名、データ型、サイズ/形式、PK/FKフラグ、NULL許容、インデックス種別、制約、デフォルト値、**簡潔な備考 (`remarks`: maxLength参照)**。`fk_references` は `TableName.FieldName` 形式で記述。
    * インデックス定義リスト (`indexes`): インデックス名、構成フィールド、一意性。
    * リレーションシップ定義リスト (`backend_design.relationships.details`): 親/子テーブル、キー、整合性設定、**簡潔な備考 (`remarks`: maxLength参照)**。
* **クエリ定義 (`query_definitions`):**
    * クエリID (`query_id`)、論理名 (`logical_name`)、**目的 (`purpose`: maxLength参照)**、種類 (`query_type`)、ステータス (`status`)。
    * 主要テーブル (`primary_tables`)、主要フィールド (`primary_fields`) リスト。
    * **フィルタ条件サマリ (`filter_conditions_summary`: maxLength参照)**、パラメータ定義リスト (`filter_parameters`: 名前、型(SQL/VBA型区別)、説明、必須、コントロール種別、ソースクエリID)。
    * **結合条件サマリ (`join_conditions_summary`: maxLength参照)**。
    * **SQL定義 (`sql_definition`):** 比較的短く自己説明的なSQLは直接記述可（可読性優先）。**長大/複雑なSQLは概要のみYAMLに記述し、詳細はMarkdown参照（`detailed_design_ref` を使用）を強く推奨。**
* **画面一覧 (`frontend_design.screens`):**
    * 画面ID (`screen_id`: FRM/RPT/共通画面ID形式)、画面名 (`screen_name`)、カテゴリ (`category`)、**概要説明 (`description`: maxLength参照)**、ステータス (`status`)。
    * 主要な遷移元/先リスト (`primary_sources`, `primary_destinations`)。
    * 使用する主要UIコンポーネントリスト (`ui_components`)。
* **モジュール定義 (`module_design.modules`):**
    * モジュールID (`module_id`)、種別 (`module_type`)、**概要説明 (`description`: maxLength参照)**、ステータス (`status`)。
    * 責務リスト (`responsibilities`)。
    * 依存関係リスト (`dependencies`: 依存先ID、**注入タイプ (`injection_type`)**、概要説明)。
    * 主要メソッド/プロパティ/イベント定義リスト (`methods`, `properties`, `events`): 名前、アクセス修飾子、型、パラメータ（名前、型、方向、任意性、デフォルト値、簡潔な備考）、戻り値型、**簡潔な説明 (`description`: maxLength参照)**、エラー処理方針 (`error_handling`)。
* **各種リスト:** (前提文書、変更履歴、システムコンポーネント、共通UI、遷移図/ER図定義、用語リストなど)

### 1.2. キー情報・属性

* 各主要要素（テーブル、クエリ、画面、モジュール等）のID、名前、ステータス、バージョン（該当する場合）、最終更新日。
* 短い説明 (`description`, `purpose`, `summary`, `remarks` の **簡潔なもの**: maxLength参照)。概要レベルで要素の目的が理解できる程度。
* 列挙型の許容値 (スキーマの`enum`で定義)。
* 必須/任意の区別 (スキーマの`required`で定義)。

### 1.3. 設計上の判断・方針の「概要」 (maxLength参照)

* **標準 `details` セクション (`StandardDetailsSection`, `ScreenDetails.details_section`) 内の各項目:**
    * `design_rationale`: その設計（テーブル構造、画面構成、アルゴリズム選択など）を採用した**理由の要点**。
    * `testing_strategy`: 実施すべき**テストの種類や主要な観点**。**【testing-guidelines-vba.md】** のどの原則/パターンに関連するか。
    * `performance_considerations`: パフォーマンス上の**懸念点や対策の概要**。関連する非機能要件（**【req-statement】** 5.2項など）への言及。
    * `security_considerations`: セキュリティ上の**注意点や対策の概要**。関連する非機能要件（**【req-statement】** 5.1項など）への言及。
    * `extensibility_notes`: 将来の拡張に関する**考慮点や方針の概要**。
    * `unresolved_issues`: 設計時点での**未解決課題リスト**。
    * `other_notes`: 上記以外で特記すべき**重要な補足事項の概要**。（例: **トランザクション管理の方針概要**、非機能要件への言及など）
    * **`standard_compliance`**: [必須(推奨)] 関連する**【標準ドキュメント群】**のどの原則/規約に**どのように準拠しているかの概要**をリスト形式で記述。`compliance_summary` には、**「どのように(How)」準拠しているか**を具体的に記述する。（★記述例はセクション3参照）
* **画面詳細 (`frontend_design.screens.details`) 内の構造化情報:**
    * `data_sources.items` の各要素: データソースの種別、ID、**利用目的の概要**。
    * `ui_logic_separation.description`: UIとロジックの**分離方針の概要**。関連モジュールIDリスト。テスト容易性確保の**方針概要**。**【design-principles-vba.md】**, **【testing-guidelines-vba.md】** への言及。
    * `data_integration.inputs/outputs`: 連携するデータの**項目名リスト(`data_items`推奨)/構造**、連携方法、トリガー。
    * `accessibility.checklist_references`: **【frontend-design-vba.md】** 付録Aのうち、**特に注意/対応が必要なチェックリスト項目ID**のリスト。**（注意: チェックリストIDはガイドライン更新時に同期確認が必要）**
    * `accessibility.implementation_notes`: アクセシビリティ実装に関する**主要な指示や配慮事項の概要**。タブオーダー方針、必須ラベル、コントラスト考慮など。**チェックリスト項目に対する具体的な実装方針の概要を記述する。**
* **全体戦略:** `error_handling_strategy.overview`, `security_design.authentication`/`authorization`/`data_security`, `deployment_plan.overview` 等の全体戦略・方針の**概要**。

### 1.4. 参照情報

* 他のYAML要素への参照（例: `fk_references` は `TableName.FieldName` 形式, `related_modules`, `source_query_id`)。**参照先のIDが存在するか確認すること。**
* 前提文書や標準ドキュメントへの参照（`references`リスト内の `doc_id`, `section`）。
* 外部ファイルへのパス:
    * Mermaid図 (`mermaid_file`: 例 `./diagrams/system-configuration.mmd`)。
    * レイアウトスケッチ画像 (`layout_sketch_file`: 例 `./sketches/FRM00001_Login.png`)。
    * **詳細設計Markdownファイル (`detailed_design_ref`: 例 `./detailed-designs/FRM00001_Login.md`)。** 主要な設計要素（テーブル、複雑なクエリ、画面、モジュール）では、このキーを用いて詳細な設計ドキュメント（Markdown）へのパスを記述することを**原則とします。対応するMarkdownファイルを作成・保守してください。** スキーマの `description` にある通り、**詳細な説明、背景、根拠、ロジック、代替案比較などは、この参照先Markdownに記述してください。**

---

## 2. 参照Markdownファイル (`./detailed-designs/*.md`等) に記述すべき内容

**原則:** YAMLに記述された構造化情報やキー情報、**概要**だけでは伝わらない、詳細な説明や自由記述が必要な情報を記述します。YAMLの情報を補足・詳述する位置づけです。

### 2.1. 詳細な説明・背景・根拠

* 特定の機能、画面、モジュール、テーブル、クエリに関する**詳細な背景、目的、設計意図**の長文説明。
* YAMLの`description`や`remarks`、`details`セクションの各「概要」項目では書ききれない、あるいは冗長になる**補足情報や具体的な解説**。
* **`details`セクションの詳述:** (YAMLの概要項目に対応)
    * `design_rationale` 詳細: なぜその設計選択をしたのか、**検討した代替案、技術的なトレードオフ（性能、保守性、複雑性など）、採用/不採用の具体的な理由付け**。
    * `testing_strategy` 詳細: YAMLで概要を示したテスト戦略に基づき、**具体的なテストケース、シナリオ、テストデータの準備方法、使用するモック/スタブの詳細**などを記述。**【testing-guidelines-vba.md】** のどのパターン（AAA、FIRST原則の考慮点、モック戦略）を適用するか。
    * `performance_considerations` 詳細: パフォーマンス上の懸念に対する**具体的な分析、計測結果（もしあれば）、詳細な対策手順、コード例、チューニング方針、関連非機能要件（応答時間など）への言及**。
    * `security_considerations` 詳細: セキュリティリスクに対する**具体的な脅威分析（例: 不正アクセス、データ漏洩、入力改竄）、詳細な対策実装方法（例: 入力サニタイズ、権限チェック箇所）、運用上の注意点、関連非機能要件（認証、認可など）への言及**。
    * `extensibility_notes` 詳細: 将来的な拡張シナリオを想定し、**具体的な拡張方法、変更が必要となる箇所、拡張時の注意点、設計上の考慮（インターフェース、設定の外部化など）**。
    * `unresolved_issues` 詳細: 未解決課題に関する**詳細な議論の経緯、検討された選択肢、現在の状況、関係者、解決に向けたアクションアイテム**。
    * `other_notes` 詳細: その他特記事項に関する**具体的な内容、図解、関連情報へのリンク**など。（例: **トランザクション管理の詳細** - 対象処理、分離レベル、ロック戦略、エラー発生時のロールバック方針など）
    * **`standard_compliance` 詳細:** YAMLで概要を示した標準準拠について、**具体的にどのように準拠しているかの詳細説明**。該当する標準ドキュメントの記述を引用したり、具体的なコード設計の方針を示したりする。

### 2.2. 詳細なロジック・アルゴリズム

* 複雑な計算ロジック、データ検証ルール（特にカスタムルール）、処理フローの詳細なステップバイステップの説明、**疑似コード**。
* YAMLの`sql_definition`に記述するには長すぎる、または文脈説明が必要な**SQLの詳細な解説、パフォーマンスチューニングの意図、実行計画**など。
* VBAでの**具体的な実装方針や注意点、利用するAPIやライブラリの詳細**。

### 2.3. UI詳細・モックアップ

* 画面レイアウトの詳細な説明、ワイヤーフレーム画像、モックアップ画像（画像ファイルへのリンク＋補足説明）。
* 特定のUIコントロール（カスタムコントロール等）の**具体的な動作仕様、状態変化の詳細**。
* YAMLの`frontend_design.screens.details.accessibility.implementation_notes`で概要を示した内容の**具体的な実装手順やコード例**。**【frontend-design-vba.md】**付録Aのどの項目にどのように対応するかを詳述する。

### 2.4. コード例

* 特定のロジックや実装パターンを示すための**サンプルコードスニペット**（Markdownのコードブロックを使用）。

### 2.5. 詳細なテストシナリオ・ケース

* YAMLの`details.testing_strategy`で概要を示したテスト戦略に基づき、具体的な**テストケースやシナリオをリストアップ**。**入力値、期待される出力、テスト手順、モックの設定方法**などを記述。

### 2.6. 未解決事項の詳細な議論

* YAMLの`details.unresolved_issues`でリストアップされた課題に関する**詳細な議論の経緯、検討された選択肢、現在の状況**などを記録。

---

## 3. 具体例 (YAML vs Markdown) - 改訂版 v1.4 (JSON Schema v1.9 ベース)

以下に、YAMLとMarkdownの記述粒度の具体例を、`details`セクションの各項目（`standard_compliance`含む）や、トランザクション管理の記述例も含めて示します。JSON Schema v1.9 での `description` 強化点を反映しています。

### 例1: テーブル定義 (`T_CaseInfo`)

* **YAML (`basic-design.yaml`):**
    ```yaml
    backend_design:
      tables:
        - name: "T_CaseInfo"
          # ... 他のキー情報 (logical_name, description など) ...
          status: "FIXED"
          fields:
            # ... フィールド定義 ...
          indexes:
            # ... インデックス定義 ...
          details: # ★標準化された details セクション (JSON Schema v1.9)★
            design_rationale: | # 必須(推奨) maxLength: 500
              案件のコア情報を保持。Excelキー変動リスク回避のためUUIDを主キーに採用。
              業務固有情報は別テーブルで管理する方針 (SRP準拠)。
            testing_strategy: | # 必須(推奨) maxLength: 500
              CRUD操作、特にUUID生成とFK制約のテスト。大量データ挿入テスト(性能)。
              詳細はMarkdown参照。【testing-guidelines-vba.md】4項準拠。
            performance_considerations: | # 任意 maxLength: 500
              頻繁な検索対象フィールド(各ID, 日付)にインデックス必須。データ量増大時の応答性考慮。【req-statement】5.2項準拠。
            security_considerations: | # 任意 maxLength: 500
               案件情報内容に応じたアクセス制御が必要な場合、上位層(FE/Service)で検討。【req-statement】5.1項考慮。
            extensibility_notes: "業務固有情報は別テーブル（T_CaseDetail_...）で拡張予定。新規業務追加容易。" # 任意 maxLength: 500
            unresolved_issues: [] # 任意
            other_notes: "インポート時の重複チェックロジックは詳細設計で定義。" # 任意 maxLength: 500
            standard_compliance: # 必須(推奨)
              - standard_doc_id: "design-prin" # 必須
                section: "3.1 BE設計方針" # 任意
                compliance_summary: "独自キー管理方針に従い、変動リスクのあるExcelキーではなく**UUIDをPKに採用**。" # ★必須(推奨): 「どのように(How)」準拠しているかを具体的に記述★
              - standard_doc_id: "design-prin" # 必須
                section: "1. SRP" # 任意
                compliance_summary: "案件コア情報に責務を限定し、**業務固有情報を別テーブルに分離**。" # ★必須(推奨): How を具体的に★
              - standard_doc_id: "coding-std" # 必須
                section: "1. 命名規則" # 任意
                compliance_summary: "テーブル名・フィールド名を**PascalCaseで命名**。" # ★必須(推奨): How を具体的に★
          references: # 任意
            - doc_id: "req-statement"
              section: "4.3"
          detailed_design_ref: "./detailed-designs/T_CaseInfo.md" # ★原則として設定。詳細な説明・背景・根拠・代替案比較等はここに記述★
    ```
* **Markdown (`./detailed-designs/T_CaseInfo.md`):**
    ```markdown
    # テーブル詳細設計: T_CaseInfo (案件情報テーブル)

    ## 1. 設計根拠 (Design Rationale)
    (参照: basic-design.yaml > backend_design.tables[name='T_CaseInfo'].details.design_rationale)

    ### 1.1 概要
    (YAMLの概要を記載)

    ### 1.2 詳細
    (YAML概要の詳述に加え、**なぜUUIDなのか**、オートナンバー等**代替案との比較**（例: Excel行番号追跡の困難性、導入容易性、パフォーマンス影響）、**トレードオフ**（読みにくさ、インデックスサイズ増、他システム連携時の考慮）、**業務情報分離の具体的なメリット・デメリット**（例: テーブル肥大化防止、関心事の分離 vs 結合コスト）などを具体的に記述)

    ## 2. テスト戦略 (Testing Strategy)
    (参照: basic-design.yaml > backend_design.tables[name='T_CaseInfo'].details.testing_strategy)

    ### 2.1 概要
    (YAMLの概要を記載)

    ### 2.2 詳細
    **テスト方針:** 【testing-guidelines-vba.md】4項に基づき、本テーブルへのアクセスはリポジトリパターン（`CaseRepository`クラス等）経由で行う。テストはリポジトリクラスに対して行う。AAAパターン適用。

    **主要なテストケース:** (YAML概要の詳述)
    * **CRUD操作テスト:** (具体的なテストデータ、**モックDBの期待動作**、リポジトリメソッドの呼び出し方などを記述)
    * **制約テスト:** (具体的な異常データ（NULL制約違反、FK制約違反、UUID形式違反等）、期待されるエラー挙動、リポジトリでのエラーハンドリング)
    * **パフォーマンス測定:** (具体的なテストデータ量（例: 1万件、10万件）、測定項目（INSERT/SELECT速度）、期待される性能目標（NFR参照）、測定方法)

    ## 3. 性能考慮事項 (Performance Considerations)
    (参照: basic-design.yaml > backend_design.tables[name='T_CaseInfo'].details.performance_considerations)

    ### 3.1 概要
    (YAMLの概要を記載)

    ### 3.2 詳細
    * **インデックス:** (設定済みインデックス（PK含む）の効果、クエリ例（`Q_SearchCases_Admin`等）、想定される検索パターン、日付範囲検索の注意点、複合インデックスの検討などを具体的に)
    * **データ量:** (想定されるデータ増加ペース（例: 年間XX件）、アーカイブ方針の必要性検討（例: X年以上経過したデータは別DBへ移動など）)
    * **UUIDのパフォーマンス影響分析:** (想定データ量でのINSERT/SELECT/JOIN性能への影響度評価、代替キー（オートナンバー）との比較（採用しなかった理由含む）)

    ## 4. セキュリティ考慮事項 (Security Considerations)
    (参照: basic-design.yaml > backend_design.tables[name='T_CaseInfo'].details.security_considerations)

    ### 4.1 概要
    (YAMLの概要を記載)

    ### 4.2 詳細
    * **格納データ:** (機密性の高い情報（例: 個人特定情報）を含まないことの確認、もし含む場合のマスキング等の必要性、関連テーブル（業務詳細）への言及)
    * **アクセス制御:** (BEファイル、共有フォルダのアクセス権限管理方法の詳細。アプリケーションレベルでのアクセス制御（例: ロールに応じたデータ表示制限）の必要性判断とその実装方針（FE側かService層か）)

    ## 5. 拡張性考慮事項 (Extensibility Notes)
    (参照: basic-design.yaml > backend_design.tables[name='T_CaseInfo'].details.extensibility_notes)

    ### 5.1 概要
    (YAMLの概要を記載)

    ### 5.2 詳細
    * **具体的な拡張シナリオ:** (新規業務種別追加時の影響（`T_CaseDetail_NewBiz`追加）、共通項目追加時の手順や影響範囲)
    * **設計上の配慮:** (テーブル分離による拡張容易性の具体例、外部キー制約による関連性維持など)

    ## 6. 未解決事項 (Unresolved Issues)
    (参照: basic-design.yaml > backend_design.tables[name='T_CaseInfo'].details.unresolved_issues)
    * (課題があれば、詳細な議論状況、関係者、解決策案などを記録)

    ## 7. その他特記事項 (Other Notes)
    (参照: basic-design.yaml > backend_design.tables[name='T_CaseInfo'].details.other_notes)

    ### 7.1 概要
    (YAMLの概要を記載)

    ### 7.2 詳細
    * **重複チェックロジック詳細:** (インポート機能設計へのリンク、重複と判断する具体的なキー項目（`CaseMgmtNumber`?）、重複時の処理フロー（エラーとするか、上書きするか等）)
    * **監査項目:** (`CreatedDateTime`, `UpdatedDateTime`の具体的な更新トリガー（VBAコード内の箇所）やデフォルト値設定について)

    ## 8. 標準準拠 (Standard Compliance)
    (参照: basic-design.yaml > backend_design.tables[name='T_CaseInfo'].details.standard_compliance)

    ### 8.1 design-prin 3.1 BE設計方針 (独自キー管理)
    * (YAML概要の詳述。UUID採用が**具体的にどのようにExcelキー変動リスクを回避**するのか、原則のどの部分（安定性、追跡容易性）に合致するかを説明)
    * (UUID生成方法（VBA関数、外部ライブラリ等）への言及)

    ### 8.2 design-prin 1. SRP
    * (テーブルの責務が案件のコア情報（ステータス、担当、日時等）に限定されていることを具体的に説明。分離した業務詳細テーブル(`T_CaseDetail_...`)への言及と、そのメリットを再確認。)

    ### 8.3 coding-std 1. 命名規則
    * (テーブル名 `T_CaseInfo`、フィールド名 `CaseUUID`, `BusinessTypeID` 等の具体的な命名規則適用例を示す。)

    ---
    ```

### 例2: 画面定義 (`FRM12003`)

* **YAML (`basic-design.yaml`):**
    ```yaml
    frontend_design:
      screens:
        - screen_id: "FRM12003" # Screen ID format check in schema v1.9
          # ... 他のキー情報 ...
          status: "WIP"
          details: # ★画面詳細★
            # ... data_sources, ui_logic_separation, data_integration ...
            accessibility: # 必須
              checklist_references: ["A.1", "A.2", "A.3", "A.4", "A.6", "A.8", "A.10", "A.13"] # 必須(推奨) 参照: frontend-design-vba 付録A (同期確認要)
              implementation_notes: | # ★必須(推奨) maxLength: 500: スキーマv1.9の記述指示強化を反映★
                **最重要:** 書類照合を容易にするレイアウト、タブオーダー、視覚的強調。
                **具体的な実装方針概要:** 自然なタブ移動順序設定。全コントロールにラベルとアクセスキー設定。キーボード操作完結性の保証。
                【persol-theme】準拠のコントラスト確保。エラー箇所明示。読み上げ順序考慮。(詳細はMarkdown)
              references:
                - doc_id: "frontend-design-vba"
                  section: "付録A"
                - doc_id: "persol-theme"
                  section: "3.3, 5"
            # --- ↓ StandardDetailsSection 適用 ---
            details_section: # ★標準化された details セクション v1.9★
              design_rationale: "業務遂行の中核画面。書類照合効率と入力精度向上が目的。業務/工程に合わせた動的UI採用。代替案(汎用UI)との比較。" # 必須(推奨) maxLength: 500
              testing_strategy: "UI動的制御、検索、検証、永続化、イレギュラーケースを単体テスト(モック使用)。E2Eシナリオテストも重要。UIテストは手動中心。【testing-guide】4項準拠。" # 必須(推奨) maxLength: 500
              performance_considerations: "動的UI生成/制御、案件検索のパフォーマンス。特に初回表示とサイクル処理の応答性。【req-statement】5.2項考慮。" # 任意 maxLength: 500
              security_considerations: "入力検証はValidationModule担当。表示データに関する権限考慮必要ならService/Repository層で。" # 任意 maxLength: 500
              extensibility_notes: "新規業務/工程追加時のUI制御ロジック(Controller等)追加が必要。共通化・設定駆動を検討。" # 任意 maxLength: 500
              unresolved_issues: ["検索ヒットなし/複数ヒット時の詳細UI/UX", "書類照合支援機能(ハイライト等)の具体実装"] # 任意
              other_notes: | # 任意 maxLength: 500
                システムの最重要画面。UI動的制御、サイクル処理、イレギュラー対応の詳細設計が鍵。
                [AI注意] 複雑ロジック生成依頼時は要件を明確に指示。(ai-dev-guide参照)
              standard_compliance: # 必須(推奨)
                - standard_doc_id: "design-prin"
                  section: "1. SRP, 4. イベント駆動"
                  compliance_summary: "**UIイベント処理を最小限にし、ビジネスロジックを別モジュールに分離**することで責務を分散。" # ★必須(推奨): How を具体的に★
                - standard_doc_id: "testing-guide"
                  section: "4. テスト容易性設計"
                  compliance_summary: "**ロジック分離により、各機能（検証、永続化等）の単体テストを可能にする**設計を採用。" # ★必須(推奨): How を具体的に★
                - standard_doc_id: "frontend-design-vba"
                  section: "付録A (Accessibility Checklist)"
                  compliance_summary: "**accessibilityセクションで指定された項目への準拠**を目指し、詳細はMarkdown参照。" # ★必須(推奨): How を具体的に★
          # ... references, related_modules など ...
          detailed_design_ref: "./detailed-designs/FRM12003_DedicatedUI.md" # ★原則として設定。複雑なイベントロジック、動的UI、コントロール仕様などはここに記述★
    ```
* **Markdown (`./detailed-designs/FRM12003_DedicatedUI.md`):**
    ```markdown
    # 画面詳細設計: FRM12003 案件詳細画面(専用UI)

    ## 1. 目的 ...
    ## 2. データソース詳細 ...
    ## 3. UI/ロジック分離方針 詳細 ...
        ### 3.1 概要 (YAML記載内容)
        ### 3.2 詳細
        * **具体的なクラス/モジュール責務分担:**
            * `FRM12003` (フォーム): UI表示、イベント受付、`DedicatedUIController`への処理移譲。
            * `DedicatedUIController`: フォームからの依頼を受け、UIの動的制御（コントロール表示/非表示、有効/無効）、`CaseSearchService`や`CaseRepository`の呼び出し、結果のフォームへの反映を担当。
            * `CaseSearchService`: 検索ロジック（クエリ実行、結果整形）。
            * `CaseValidator`: 入力データ検証ルール実装。
            * `CaseRepository`: DB永続化（CRUD操作、トランザクション管理）。
        * **テスト戦略:** 各クラスをモックを利用して単体テストする方法。
    ## 4. データ連携詳細 ...
    ## 5. アクセシビリティ実装詳細
    (参照: basic-design.yaml > frontend_design.screens[screen_id='FRM12003'].details.accessibility)
    ### 5.1 概要 (YAML記載内容)
    ### 5.2 詳細 (チェックリスト項目への具体的対応)
    (YAMLの概要に加え、**各チェックリスト項目(A.1～A.13等)への具体的な対応方法、実装上の注意点（例: 動的生成コントロールへのラベル設定方法）、確認方法**を記述)
    * **タブオーダー (A.2):** (具体的なコントロール名と順序をリストアップ。動的UIの場合は制御ロジックも記述)
    * **ラベルとアクセスキー (A.3, A.4):** (動的生成時の注意点、具体的なラベル文字列例とアクセスキー設定)
    * **キーボード操作 (A.1):** (サブフォームや特殊コントロールのキー操作詳細、検索実行や確定処理のキーボードショートカット)
    * **視覚的強調とコントラスト (A.6):** (具体的な強調方法（背景色変更、太字）、使用色コード（例: `--persol-highlight-bg`）、コントラスト比確認ツールと基準)
    * **スクリーンリーダー読み上げ (A.13):** (読み上げ順序の確認方法、`Frame`等のコンテナ利用時の注意点、読み上げ不要な要素の制御)

    ## 6. 画面レイアウト案 (スケッチやワイヤーフレームへのリンク＋説明) ...
    ## 7. 詳細設計・特記事項
    (参照: basic-design.yaml > frontend_design.screens[screen_id='FRM12003'].details.details_section)
    * **設計根拠:** (動的UI採用の**具体的なメリット（例: 業務Aでは項目X,Yを表示、業務BではZを表示）、デメリット（実装複雑性）、代替案（汎用UI＋タブ等）との比較検討結果**を記述)
    * **テスト戦略:** (UI制御、検索、検証、永続化の**具体的なテストケース、モック利用方法（インターフェース定義含む）、シナリオテストの詳細（主要な業務サイクル）**を記述)
    * **パフォーマンス:** (懸念される箇所（動的UI描画、複雑な検索）、**具体的な対策案（コードレベル、DBクエリレベル）、目標応答時間（NFR参照）**への言及)
    * **標準準拠:** (SRP/イベント駆動、テスト容易性、アクセシビリティへの**具体的な準拠方法や設計上の工夫**を詳述。例: UI Controller導入によるロジック分離方法、アクセシビリティチェックリストへの具体的な対応コード方針など。)
    * **イレギュラー処理フロー:** (検索ヒットなし、複数ヒット、保存エラー（重複、FK違反等）、突合不一致など、**具体的なケースごとの処理フロー、画面表示（エラーメッセージ含む）、メッセージ内容、ログ記録レベル**を記述)

    ---
    ```

### 例3: モジュール定義 (`CaseRepository`) - トランザクション管理の例

* **YAML (`basic-design.yaml`):**
    ```yaml
    module_design:
      modules:
        - module_id: "CaseRepository"
          status: "WIP"
          module_type: "Class Module"
          description: "案件情報(T_CaseInfo, T_CaseDetail_...)および作業履歴(T_WorkHistory)のDB永続化を担当。"
          responsibilities:
            - "案件情報・詳細のCRUD操作"
            - "作業履歴の登録"
            - "関連データのトランザクション管理"
          dependencies:
            - dependency_id: "DBConnectionManager" # (仮称) DB接続管理
              injection_type: "Property" # プロパティ経由で注入
              description: "DAO.Database オブジェクト提供"
            - dependency_id: "ILogger" # (仮称) ログサービス
              injection_type: "Property"
              description: "エラーログ記録用"
          methods:
            - name: "SaveCaseAndHistory" # ★トランザクションが必要なメソッド例★
              access: "Public"
              type: "Function"
              # ... parameters (caseInfoData, historyData) ...
              return_type: "Boolean" # 成功/失敗
              description: "案件情報/詳細と作業履歴をまとめて保存(新規/更新)。トランザクション管理必須。"
              error_handling: "DBエラー発生時はロールバックしFalseを返す。ログ記録必須。【design-prin】3項準拠。" # 具体的な方針
            # ... 他のメソッド (GetCaseById, AddWorkHistory 単体など) ...
          properties:
            - name: "ConnectionManager"
              access: "Public"
              type: "DBConnectionManager"
              read_write: "Set"
              description: "DB接続管理オブジェクト (DI用)"
            - name: "Logger"
              access: "Public"
              type: "ILogger"
              read_write: "Set"
              description: "ロガーオブジェクト (DI用)"
          details: # ★標準化された details セクション v1.9★
            design_rationale: "データアクセスロジックをカプセル化(SRP)。DIによりテスト容易性確保。" # 必須(推奨) maxLength: 500
            testing_strategy: "`DBConnectionManager`/`ILogger`モック使用。CRUD操作、特にトランザクション、エラー時のロールバックを単体テスト。【testing-guide】参照。" # 必須(推奨) maxLength: 500
            performance_considerations: "DBアクセス効率。クエリ最適化。コネクションプーリングはVBAでは困難。" # 任意 maxLength: 500
            security_considerations: "SQLインジェクション対策（パラメータ化クエリ）。" # 任意 maxLength: 500
            extensibility_notes: "新規CaseDetailテーブル対応のためのメソッド追加など。" # 任意 maxLength: 500
            unresolved_issues: ["DBエラーコードごとの詳細ハンドリング"] # 任意
            other_notes: | # 任意 maxLength: 500
              **トランザクション管理は SaveCaseAndHistory メソッド内で `BeginTrans/CommitTrans/Rollback` を使用して実装。**
              詳細はMarkdown参照。
            standard_compliance: # 必須(推奨)
              - standard_doc_id: "design-prin"
                section: "1. SRP"
                compliance_summary: "**データ永続化責務に特化**させ、ビジネスロジックは上位層に分離。" # ★必須(推奨): How を具体的に★
              - standard_doc_id: "design-prin"
                section: "2. DI"
                compliance_summary: "**DB接続とロガーをProperty Setで外部注入可能**とし、テスト容易性確保。" # ★必須(推奨): How を具体的に★
              - standard_doc_id: "design-prin"
                section: "3. エラーハンドリング戦略"
                compliance_summary: "**DBエラーはログ記録しFalseを返す。トランザクション失敗時はRollbackを実行**する方針。" # ★必須(推奨): How を具体的に★
          detailed_design_ref: "./detailed-designs/CaseRepository.md" # ★原則として設定。複雑なデータアクセスロジック、トランザクション詳細などはここに記述★
    ```
* **Markdown (`./detailed-designs/CaseRepository.md`):**
    ```markdown
    # モジュール詳細設計: CaseRepository クラス

    ## 1. 責務 ...
    ## 2. 設計根拠 (Design Rationale) ...
        ### 2.1 概要 (YAML記載内容)
        ### 2.2 詳細
        * **リポジトリパターン採用理由:** データアクセスロジックをカプセル化することで、上位層（Service, Controller）から具体的なDB操作（SQL、DAO/ADO）を隠蔽する。これにより、上位層の関心事をビジネスロジックに集中させ、テスト容易性（DBアクセス層のモック化）と保守性（DB変更の影響を局所化）を向上させる。
        * **DI採用理由:** `DBConnectionManager` や `ILogger` を外部から注入可能にすることで、テスト時にモックオブジェクトを使用できるようにし、DBやログファイルへの依存なしに本クラスのロジックを単体テスト可能にする。
    ## 3. テスト戦略 (Testing Strategy)
    (参照: basic-design.yaml > module_design.modules[module_id='CaseRepository'].details.testing_strategy)
        ### 3.1 概要 (YAML記載内容)
        ### 3.2 詳細
        * **モック対象:** `IDBConnectionManager`インターフェース（仮）を実装したモック、`ILogger`インターフェースを実装したモックを使用する。
        * **トランザクションテストケース:**
            * `SaveCaseAndHistory` 正常系: `BeginTrans`, `CommitTrans` が正常に呼び出され、各テーブルへの更新処理（モックメソッド呼び出し）が行われることを確認。
            * `SaveCaseAndHistory` 履歴登録失敗時: 案件情報更新処理（モック）は成功するが、作業履歴登録処理（モック）でエラーを発生させた場合、`Rollback` が呼び出され、最終的にFalseが返ることを確認。
            * `SaveCaseAndHistory` 接続エラー時: `BeginTrans` 前のエラー、`CommitTrans` 時のエラー等、各種DBエラー発生時の挙動（ログ記録、Rollback、戻り値）を確認。
        * (他のCRUDメソッドのテストケース詳細...)
    ## 4. パフォーマンス考慮事項 ...
    ## 5. セキュリティ考慮事項 ...
        ### 5.1 概要 (YAML記載内容)
        ### 5.2 詳細
        * **SQLインジェクション対策:** クエリを動的に生成する場合は、パラメータ化クエリ（ADODB.Commandなど）を可能な限り使用する。DAOのRecordset操作では通常問題ないが、Actionクエリ（`db.Execute`）等で文字列結合を使用する場合は、入力値のエスケープ処理を検討する。
    ## 6. 拡張性考慮事項 ...
    ## 7. 未解決事項 ...
        ### 7.1 概要 (YAML記載内容)
        ### 7.2 詳細
        * **DBエラーコードごとのハンドリング:** 特定のエラーコード（例: キー重複、ロック競合）に対して、単純なロールバック＆False返し以外の処理（リトライ、独自例外Raiseなど）を行うか検討。現時点では行わない方針。
    ## 8. その他特記事項 (Other Notes)
    (参照: basic-design.yaml > module_design.modules[module_id='CaseRepository'].details.other_notes)
        ### 8.1 概要 (YAML記載内容)
        ### 8.2 詳細
        * **トランザクション管理詳細:**
            * **対象メソッド:** `SaveCaseAndHistory` メソッド内でのみトランザクションを開始・終了する。個別の `AddWorkHistory` や `UpdateCaseInfo` メソッド（もしあれば）ではトランザクションを管理しない（呼び出し元で制御するか、それ自体がトランザクション不要な操作とする）。
            * **実装方法:** 注入された `DBConnectionManager` が提供するDAO.WorkspaceまたはADODB.Connectionオブジェクトのトランザクションメソッド (`BeginTrans`, `CommitTrans`, `Rollback`) を使用する。
            * **エラーハンドリング:** `ErrorHandler:` 内で `Rollback` を確実に呼び出す。ネストしたトランザクションは使用しない。
            * **ロック戦略:** Access標準のロック機構に依存。ロック競合（エラーコード `3218` 等）発生時のリトライ処理は、本クラスでは実装せず、必要に応じて上位のサービス層で検討。
        * **エラー処理詳細:** (DBエラーコードに応じた処理分岐など、もし実装する場合)
    ## 9. 標準準拠 (Standard Compliance) ...
        ### 9.1 design-prin 1. SRP
        * (YAML概要の詳述。データ永続化という単一責務に特化していること、ビジネスルール検証などは上位層で行うことを明記。)
        ### 9.2 design-prin 2. DI
        * (YAML概要の詳述。`ConnectionManager` と `Logger` プロパティ (Set) を設けることで、外部からの依存性注入を可能にしている具体的な方法を説明。)
        ### 9.3 design-prin 3. エラーハンドリング戦略
        * (YAML概要の詳述。`SaveCaseAndHistory` 内での `On Error GoTo`, `ErrorHandler` での `Rollback` 呼び出し、ログ記録、`False` 返却という具体的な実装方針が原則に準拠していることを説明。)

    ---
    ```

---

## 4. 運用ルール

* YAMLファイルと参照Markdownファイルは、Git等のバージョン管理システムで適切に管理します。
* **YAMLを正とする:** 情報がYAMLとMarkdownで重複または矛盾する場合、原則として**YAMLの情報が正**とみなされます。MarkdownはYAMLの内容を補足・詳述する目的で記述します。
* **参照キーの利用:**
    * YAMLから詳細設計Markdownを参照する場合は、`detailed_design_ref` キーを使用します。**主要な設計要素（テーブル、複雑なクエリ、画面、モジュール）では、`detailed_design_ref` を原則として設定し、対応する詳細設計Markdownファイルを作成・保守してください。** スキーマの `description` にある通り、**詳細な説明、背景、根拠、ロジック、代替案比較などは参照先Markdownに記述**します。
    * Markdownファイル内からも、関連するYAMLセクションへの参照を記述することが望ましいです（記述形式は例3のMarkdown参照）。
* **変更時の同期:** 設計変更が発生した場合、関連するYAMLファイルと、必要に応じて参照先のMarkdownファイルの両方を更新し、**整合性**を保ちます。変更履歴はYAMLの `document_info.change_log` で管理します。

---