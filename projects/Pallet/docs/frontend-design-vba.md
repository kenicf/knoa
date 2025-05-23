# フロントエンド設計標準 (VBA版) - 画面一覧・画面遷移図 (改訂版 v1.1)

## 1. はじめに

### 1.1. 本書の目的

本書は、VBA (Visual Basic for Applications) を用いたアプリケーション開発プロジェクトにおいて、フロントエンド設計、特に**画面一覧**および**画面遷移図**の作成と記述に関する標準的な方法論とガイドラインを定めるものです。本書は、高品質で保守性が高く、テスト容易性やアクセシビリティにも配慮されたフロントエンド設計を実現することを目的とします。

本書の目的は、以下の通りです。

* フロントエンド設計ドキュメントの**品質と一貫性**を確保する。
* 開発者、設計者、レビュアー間の**共通理解**を促進する。
* 設計・開発・保守・レビューの**効率**を高める。
* **【設計原則とパターン (VBA版)】**、**【テスト戦略とガイドライン (VBA版)】**、**【コーディング規約 (VBA版)】**、および**【persol-theme-guideline.md】**（UI/UX、アクセシビリティ）に基づいた設計を実践するための具体的な指針を提供する。

### 1.2. 適用範囲

本書は、Microsoft AccessフォームやExcel上のユーザーフォーム等、VBAを用いて構築されるユーザーインターフェースを持つアプリケーションのフロントエンド設計プロセスに適用されます。特に、以下の要素の定義と記述方法を対象とします。

* 画面一覧（システムに含まれる画面の網羅的なリスト）
* 画面遷移図（画面間の主要な遷移フローを示す図）
* 画面設計における基本的なUI/UX原則とアクセシビリティへの配慮（VBA/Accessの文脈で具体化）

詳細な画面レイアウト設計（具体的なコントロール配置）、個々の画面要素の仕様、詳細なイベント処理ロジックなどは、本書の範囲外とし、プロジェクトごとの詳細設計書等で定義します。

### 1.3. 前提文書

本書は、プロジェクトで別途定義される以下の標準ドキュメント群と連携し、補完する関係にあります。本書の適用にあたっては、これらの前提文書の内容を十分に理解し、参照してください。

* **【ai-developer-guide-vba.md】:** AI利用時の指針、レビュー、テスト容易性考慮など。
* **【coding-standards-vba.md】:** 命名規則、フォーマット、エラーハンドリング規約、オブジェクト変数管理、マジックナンバー回避など。
* **【design-principles-vba.md】:** システム全体の設計思想、クラス設計(SRP)、DI、エラー処理戦略、イベント駆動アーキテクチャ、長時間処理考慮など。
* **【testing-guidelines-vba.md】:** テスト容易性設計(UI/ロジック分離、DI、純粋関数)、テスト実装方法（AAAパターン、モック、`Debug.Assert`）、FIRST原則など。
* **【persol-theme-guideline.md】:** プロジェクトのデザイン原則、配色、タイポグラフィ、レイアウト、アイコン、コンポーネント、アクセシビリティ基準の根拠。
* **【support-apps-requirements-statement.md】:** システム要件、特に非機能要件（5.4項 アクセシビリティ要件）。
* **【basic-design-03-backend-design.md】**, **【basic-design-04-query-definitions.md】**: バックエンド設計（テーブル定義、クエリ定義）。

## 2. 一般原則

フロントエンド設計ドキュメント（画面一覧、画面遷移図）の作成にあたっては、以下の一般原則を遵守します。

* **整合性 (Consistency):** 本書のガイドラインおよび前提文書（**【coding-standards-vba.md】**, **【design-principles-vba.md】**, **【persol-theme-guideline.md】** 等）に準拠し、ドキュメント内およびドキュメント間で表記や記述スタイルの一貫性を保ちます。
* **明瞭性 (Clarity):** 誰が読んでも理解できるよう、専門用語を適切に用い、曖昧な表現を避け、明確かつ簡潔な記述を心がけます。特に画面遷移図のトリガーや条件は具体的に記述します。
* **MECE性 (Mutually Exclusive and Collectively Exhaustive):** システムに必要な画面や遷移を、漏れなく、かつ重複なく洗い出し、定義することを目指します。「4.2 関心事ごとの分割戦略」や「4.3 MECEな図表群の構成」も参照してください。
* **保守性 (Maintainability):** 設計変更が発生した場合に、ドキュメントの修正が容易であるように、Mermaid記法などのテキストベースのフォーマットを推奨します。また、設計の根拠や決定事項をコメント等で残します。
* **テスト容易性考慮 (Testability Consideration):** 設計段階からテストのことを意識します。特に、画面（UI）とビジネスロジックの分離を前提とし、その方針を画面一覧の備考等に明記します（**【design-principles-vba.md】** 1, 4項、**【testing-guidelines-vba.md】** 4項参照）。テスト容易性を考慮したUI設計（コントロール命名、ロジック分離前提）を心がけます（詳細は「5.7 テスト容易性を考慮したUI設計原則」参照）。
* **アクセシビリティ考慮 (Accessibility Consideration):** 設計の初期段階から、**【support-apps-requirements-statement.md】** 5.4項や**【persol-theme-guideline.md】**に基づき、多様なユーザー（**障害**を持つ人、高齢者などを含む）が利用可能であることを意識し、具体的な実装方法を検討・文書化します（詳細は「5.6 アクセシビリティ実装原則」および「付録A アクセシビリティチェックリスト」参照）。

## 3. 画面一覧ガイドライン

### 3.1. 目的と役割

画面一覧は、システムに存在するすべてのユーザーインターフェース画面（フォーム、ダイアログ等）を網羅的にリスト化し、各画面の基本的な情報（ID、名称、概要、関連情報）を定義するものです。システム全体の画面構成を把握し、後続の設計・開発・テストの基礎となります。

### 3.2. MECEな洗い出し方策

システムに必要な画面を漏れなくダブりなく洗い出すために、以下の観点を考慮します。

* **ユーザーロール/ペルソナ:** 想定されるユーザーの種類（例: 一般オペレーター、マネージャー）ごとに、利用する機能とそれに伴う画面を洗い出す。
* **主要機能/ユースケース:** システムが提供する主要な機能（例: ログイン、データ取込、案件入力・編集、データ転記、実績確認、マスタ管理）や、ユーザーの典型的な利用シナリオに基づいて画面を洗い出す。
* **共通画面:** 機能横断的に使用される共通的な画面を漏れなくリストアップする。
    * 認証関連 (ログイン)
    * メニュー (ロール別など)
    * 確認ダイアログ (汎用、削除時、保存時など)
    * 情報通知ダイアログ/ステータス表示 (完了、成功)
    * エラー通知画面/ダイアログ (入力エラー、処理エラー、致命的エラー)
    * 処理中インジケータ/画面
    * ファイルロック通知画面
    * エスカレーション関連画面/レポート表示
    * (必要に応じて) ヘルプ・バージョン情報画面
* **画面粒度:** 原則として、一つの主要な目的やタスクに対応する単位で画面を定義します。ただし、ユーザー体験（UX）と保守性を考慮し、過度に画面を細分化したり、逆に一つのフォームに無関係な機能を詰め込みすぎたりしないよう、適切な粒度を検討します。複雑な画面は、サブフォームやタブコントロールによる分割も視野に入れます。
* **アンチパターン:**
    * 必要な共通画面（エラー、確認など）がリストから漏れている。
    * 類似機能の画面が複数定義されており、統合可能である。
    * 一つの画面に責任が多すぎる（SRP違反）。

### 3.3. 画面ID採番規則

一貫性があり、識別しやすい画面IDを付与するための採番規則をプロジェクトで定めます。以下は規則の推奨例です。**【coding-standards-vba.md】** 1項の命名規則も参照してください。

* **形式:** `[プレフィックス]` + `[機能分類コード(3桁)]` + `[連番(2桁)]` + `_[属性識別子(任意)]`
    * **プレフィックス:** Accessフォームの場合は `FRM`、レポートの場合は `RPT` などを推奨。
    * **機能分類コード:** 主要機能を示す3桁の数字コード（例: `000`=認証, `100`=メインメニュー, `110`=案件管理, `120`=業務遂行, `130`=データ連携, `140`=ダッシュボード, `150`=イベント管理, `160`=管理機能, `180`=個人設定, `900`=共通）。プロジェクトの機能構成に応じて定義。
    * **連番:** 機能分類内で一意となる2桁の連番（例: `01`, `02`, ...）。
    * **属性識別子:** 画面の特性を示す識別子（例: `_DLG`=ダイアログ, `_MG`=管理者用, `_OP`=オペレーター用, `_ERR`=エラー画面, `_CNF`=確認画面, `_INFO`=情報画面, `_PROC`=処理中画面, `_LOCK`=ロック画面, `_ESCL`=エスカレーション画面）。
* **例:** `FRM00001` (ログイン画面), `FRM11001` (案件一覧画面), `FRM11002_DLG` (一括更新ダイアログ), `FRM16001_MG` (マスタ一覧画面), `FRM90001_ERR` (共通エラーダイアログ)
* **注意:** この採番規則は推奨例です。プロジェクトの規模や特性に応じて調整し、定義した規則はプロジェクト内で共有・遵守します。

### 3.4. 画面名命名規則

* **言語:** プロジェクトの標準言語（日本語または英語）を使用します。
* **形式:** 画面の目的や内容が具体的にわかる、明確で簡潔な名称を付けます。`PascalCase`（英語の場合）または適切な日本語表記を用います。Accessオブジェクト名としても有効な文字列を使用します（**【coding-standards-vba.md】** 1項参照）。
* **一貫性:** 同様の機能を持つ画面（例: 一覧画面、詳細画面、設定画面）には、一貫した命名パターンを適用します（例: 「〇〇一覧画面」、「〇〇詳細画面」）。
* **属性:** 必要に応じて、画面の特性を括弧書き等で補足します（例: 「ユーザー編集画面 (管理者用)」、「確認ダイアログ (削除時)」）。
* **アンチパターン:** 画面名が抽象的すぎる（例: 「画面1」）、内容を表していない、一貫性がない。

### 3.5. 定義すべき情報 (画面一覧の列構成例)

画面一覧には、以下の情報を**必ず**含めることを推奨します。プロジェクトの必要に応じて列を追加・変更してください。

| 列名 (必須)              | 説明                                                                                                                                                                                                                                                              | 記載例/ポイント (Do/Don't)                                                                                                                                                                                                                                                                                       |
| :----------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **画面ID** | 3.3項で定義した採番規則に従う一意なID。                                                                                                                                                                                                                                 | **Do:** `FRM11001`<br>**Don't:** 画面IDがない、一意でない。                                                                                                                                                                                                                                                       |
| **画面名** | 3.4項で定義した命名規則に従う名称。                                                                                                                                                                                                                                     | **Do:** `案件一覧画面`<br>**Don't:** `画面1`                                                                                                                                                                                                                                                                      |
| **概要説明** | この画面の主な目的と、ユーザーがこの画面で行う主要な操作を簡潔に記述する。                                                                                                                                                                                                 | **Do:** 「担当案件を検索・一覧表示し、詳細画面への遷移、一括更新・削除を行う。」<br>**Don't:** 「案件を管理する」 (具体性不足)                                                                                                                                                                                                |
| **主要な遷移元 (例)** | この画面に遷移してくる可能性のある代表的な画面IDをリストアップする。画面遷移図と整合させる。                                                                                                                                                                              | **Do:** `FRM10001_OP`, `FRM10002_MG`<br>**Don't:** 記載漏れ、画面遷移図と不整合。                                                                                                                                                                                                                                        |
| **主要な遷移先 (例)** | この画面から遷移する可能性のある代表的な画面IDをリストアップする。画面遷移図と整合させる。                                                                                                                                                                              | **Do:** `FRM11002` (詳細へ), `FRM11003_DLG` (一括更新へ), `FRM90002_CNF` (削除確認へ)<br>**Don't:** 記載漏れ、画面遷移図と不整合。                                                                                                                                                                                        |
| **備考** | **【★★★最重要★★★】**以下の補足情報を**具体的かつ網羅的に**記載する。**この欄の記述品質が、後続工程の効率と品質、レビューの質を大きく左右します。** レビュアーや後続工程の担当者への重要な申し送り事項となるため、責任を持って記述してください。 | **Do:** 以下の各項目を具体的に記述。<br>**Don't:** 空欄、抽象的な記述（例:「データはDBから」）、標準ドキュメントへの言及がない、他の設計書との連携意識がない。                                                                                                                                                                |
| *(備考欄内)* **主要データソース** | **[必須]** この画面が表示・操作する主要なデータソース。BEのテーブル名、クエリ名を具体的に記述。**【basic-design-03/04】**との連携を明確にする。                                                                                                                             | **Do:** `- Q_SearchCases_Admin (一覧表示用)`<br>`- T_CaseInfo (更新/削除時)`<br>**Don't:** `- DBから取得` (具体性不足), 記載漏れ, basic-designとの不整合。                                                                                                                                                            |
| *(備考欄内)* **UI/ロジック分離方針** | **[必須(ロジック含む場合)]** データ検証、計算、DBアクセス等のビジネスロジックを含む場合、UI(フォーム)からロジックを分離する設計方針への言及。**【design-principles-vba.md】1項(クラス設計/SRP), 4項(イベント駆動)**、**【testing-guidelines-vba.md】4項(テスト容易性設計)**準拠。関連するモジュール設計への具体的な申し送り事項（例: `CustomerValidation`クラスで検証、`CaseRepository`クラスでDBアクセス）。 | **Do:** `- UIイベント(Click等)は入力取得と処理依頼のみ。(設計原則4項)`<br>`- データ検証は`ValidationModule`へ。(設計原則1項)`<br>`- DB更新は`CaseRepository`クラス経由。(DI考慮、設計原則2項)`<br>`- **[テスト容易性]** UI非依存でロジックテスト可能に。(テストガイドライン4項)`<br>**Don't:** `- 保存ボタンで全部やる` (方針不明), 記載漏れ, 設計原則/テストガイドラインへの言及なし。 |
| *(備考欄内)* **画面間データ連携方針** | **[必須(連携ある場合)]** 他の画面との間でデータを受け渡す必要がある場合、その内容と連携方法の基本方針。**【coding-standards-vba.md】4項**(グローバル変数回避)、**【testing-guidelines-vba.md】2項**(独立性)準拠。具体的な実装は詳細設計へ。 | **Do:** `- 遷移元(FRM11001)から選択された`CaseUUID`を`OpenArgs`で受け取る。`<br>`- 複雑なデータは専用Contextクラス(モジュール設計で定義)経由を検討。(コーディング規約4項準拠)`<br>**Don't:** `- グローバル変数 g_SelectedCaseID を使う` (規約違反), 記載漏れ。                                                                       |
| *(備考欄内)* **アクセシビリティ配慮事項** | **[必須]** 特に配慮すべきアクセシビリティ項目や実装方針。**【support-apps-requirements-statement.md】5.4項**、**【persol-theme-guideline.md】5項**、本書「5.6 アクセシビリティ実装原則」および「付録A アクセシビリティチェックリスト」参照。具体的なプロパティ設定指示や確認項目への言及。 | **Do:** `- **必須:** タブオーダー設定、全コントロールにラベル設定、アクセスキー設定。`<br>`- コントラスト比は`persol-theme`準拠。(チェックリストA.6参照)`<br>`- 複雑な操作には`ControlTipText`設定。(チェックリストA.5参照)`<br>**Don't:** `- アクセシビリティに配慮する` (具体性不足), 記載漏れ, チェックリストへの言及なし。                                                              |
| *(備考欄内)* **その他特記事項** | 関連する要件定義番号、設計上の注意点、パフォーマンス懸念（**【design-principles-vba.md】5項**長時間処理考慮）、未確定事項、AI利用時の注意点(**【ai-developer-guide-vba.md】**レビュー必須、コンテキスト提供指示など)など。 | **Do:** `- 要件定義書 4.2項 参照。`<br>`- 大量データ表示時のパフォーマンス要検証。(設計原則5項)`<br>`- 書類照合支援レイアウトは詳細設計で具体化。`<br>`- **[AI利用]** ロジック生成時はレビュー必須。(`ai-developer-guide-vba.md`参照)`<br>**Don't:** 記載漏れ。                                                                                                     |

### 3.6. バックエンド設計との連携

フロントエンド(FE)はバックエンド(BE)のデータ構造やクエリに依存します。画面一覧の「主要データソース」欄には、各画面が表示・操作する**具体的な**テーブル名やクエリ名 (`Q_` プレフィックス等) を**必ず**記載してください (**【basic-design-03-backend-design.md】**, **【basic-design-04-query-definitions.md】** を参照)。これにより、以下のメリットが得られます。

* FEとBEの関連性が明確になり、影響範囲の特定が容易になる。
* クエリの設計漏れや、画面要件とクエリ仕様の齟齬を早期に発見できる。
* データバインディングやVBAコードでのデータアクセス実装時の参照情報となる。

### 3.7. 他設計セクションとの連携

画面一覧は、後続の画面レイアウト設計、主要機能フロー設計、モジュール設計などの基礎となります。画面固有の要件や設計上の判断を、後続工程に確実に伝えるために、「備考」欄を積極的に活用してください。

* **UI/ロジック分離方針:** どのビジネスロジックをどのモジュール（クラス/標準）に実装する想定か。(**【design-principles-vba.md】**, **【testing-guidelines-vba.md】** 参照)
* **画面間データ連携方針:** 画面遷移時にどのようなデータをどのように受け渡すか。(**【coding-standards-vba.md】**, **【testing-guidelines-vba.md】** 参照)
* **パフォーマンス考慮:** 特定の画面で大量データ処理が想定される場合、その懸念と対策方針。(**【design-principles-vba.md】** 参照)
* **アクセシビリティ:** その画面で特に注意すべきアクセシビリティ要件や実装のポイント。(**【support-apps-requirements-statement.md】**, **【persol-theme-guideline.md】**, 本書付録A 参照)
* **未確定事項:** 設計時点での未確定事項や、詳細設計で決定すべき事項。

これらの情報を「申し送り事項」として明確に記述することで、設計の意図を正確に伝え、手戻りを防ぎます。

## 4. 画面遷移図ガイドライン

### 4.1. 目的と役割

画面遷移図は、画面一覧で定義された画面間の主要な遷移フローと、その遷移が発生するトリガー（ユーザー操作など）や条件を視覚的に表現するものです。ユーザーのナビゲーションパスを理解し、システムの全体的な操作フローを把握するために用いられます。

### 4.2. 関心事ごとの分割戦略

大規模なシステムでは、すべての画面遷移を一枚の図に描画すると複雑になりすぎるため、以下の観点で図を分割することを推奨します。

* **主要機能単位:** システムの主要な機能（例: 認証、データ取込、案件管理、データ転記、実績表示、マスタメンテ）ごとに図を作成する。
* **ユーザーロール/タスクフロー:** 特定のユーザーロール（オペレーター、マネージャー）が行う典型的なタスクフローに沿って図を作成する。
* **共通フロー:** ログイン/ログアウト、エラー処理、確認/情報ダイアログなど、複数の機能から共通して利用されるフローは、別の図として切り出すか、各図で共通要素として明確に表現します（後述の「4.5 共通画面の表現」参照）。

分割した図の集合が、システム全体の主要な遷移を**網羅**するように構成します。

### 4.3. MECEな図表群の構成

分割された各画面遷移図は、単独でも意味が通るように作成します。他の図との関連性（どの図から遷移してきて、どの図へ遷移する可能性があるか）を明示することを推奨します。

* **図のタイトル:** 各図には、対象とする機能やフローを示す明確なタイトルを付けます（例: 「案件管理フロー画面遷移図」）。
* **起点と終点:** 図の開始点（例: メインメニューから）と終了点（例: メインメニューへ戻る、別の機能フローへ）を明示します。他の図への参照を含む場合、その図の名称やIDを記載します。
* **凡例:** 必要に応じて、図中で使用するノードのスタイルや線種の意味を示す凡例を図のコメント部分に記載します。

これにより、図の集合全体としてMECE（漏れなくダブりなく）な状態を目指します。

### 4.4. Mermaid記法ガイドライン (`graph TD` 前提)

画面遷移図の記述には、可読性と保守性の高いMermaid記法（特に `graph TD`）の使用を**強く推奨**します。以下に記述ガイドラインを示します。

* **ノード (画面):**
    * **形式 (Do):** `NodeID["画面ID: 画面名"]:::styleName` の形式を基本とします。
        * `NodeID`: 図の中で一意な短い識別子（画面IDの一部など）。
        * `画面ID`: 画面一覧と対応する**完全な画面ID**。
        * `画面名`: 画面一覧と対応する画面名。
        * `:::styleName`: ノードの役割に応じたスタイルクラス名（後述）。
    * **形式 (Don't):** 画面IDや画面名が画面一覧と不整合、ノードIDが非推奨文字を含む、スタイルが未定義または不統一。
    * **スタイル (`classDef`):** ノードの役割を示す標準スタイルをプロジェクトで定義し、一貫して適用します。
        * **推奨スタイル定義:**
            ```mermaid
            classDef main fill:#ccf,stroke:#333,stroke-width:1px;  /* 主要画面 */
            classDef sub fill:#eef,stroke:#333,stroke-width:1px;  /* サブ画面、選択画面 */
            classDef dedicated fill:#ffc,stroke:#333,stroke-width:1px; /* 専用UI画面 */
            classDef datalink fill:#dde,stroke:#333,stroke-width:1px; /* データ連携画面 */
            classDef dashboard fill:#cfc,stroke:#333,stroke-width:1px; /* ダッシュボード画面 */
            classDef event fill:#fec,stroke:#333,stroke-width:1px; /* イベント管理画面 */
            classDef admin fill:#eee,stroke:#333,stroke-width:1px; /* 管理機能画面 */
            classDef popup fill:#fff,stroke:#f00,stroke-width:1px,stroke-dasharray: 2 2; /* ポップアップ/ダイアログ */
            classDef common fill:#ddd,stroke:#666,stroke-width:1px,stroke-dasharray: 5 5; /* 共通処理/通知 */
            classDef error fill:#fdd,stroke:#c00,stroke-width:1px; /* エラー関連画面/通知 */
            classDef entryExit fill:#bfb,stroke:#383,stroke-width:1px; /* 起点/終点 */
            ```
        * 図の冒頭で `classDef` を使用して定義します。
* **エッジ (遷移):**
    * **形式 (Do):** `NodeA -->|"遷移トリガー<br>[遷移条件]"| NodeB` の形式を基本とします。
    * **形式 (Don't):** 遷移トリガーが曖昧（例: `-->|"実行"|`）、条件が不明確、線種が不適切。
    * **遷移トリガー:** 遷移を引き起こす**具体的なユーザー操作**（例: 「保存ボタンクリック」、「メニュー項目選択」）や**システムイベント**（例: 「認証成功時」、「データ取込完了(エラーあり)」）を記述します。
    * **遷移条件:** 遷移が発生するための条件（例: `[入力OK]`, `[エラーなし]`, `[MGロール]`）を角括弧 `[]` 内に記述します（任意ですが、分岐がある場合は必須）。
    * **ラベル:** ラベルが長くなる場合は `<br>` タグで改行します。
    * **線種:**
        * **主要な正常系フロー:** 実線 (`-->`) を使用します。
        * **エラー発生時のフロー、キャンセル時のフロー:** 点線 (`-.->`) を使用し、ラベルで内容を明確にします（例: `-.->|"[致命的エラー]"|ERR_NODE`）。
        * **非同期処理や特殊な遷移:** 必要に応じて他の線種（例: `==>`) も検討できますが、多用は避け、意味を凡例で定義します。
* **サブグラフ:**
    * 関連性の高い画面群や機能グループ（例: 認証フロー、案件登録フロー、共通画面群）を `subgraph "グループ名"` ... `end` で囲むことで、図の構造を視覚的に分かりやすくします。
* **コメント:**
    * `%%` で始まる行はコメントとして扱われます。図の**タイトル、説明、改訂履歴、凡例、注記**などを記載するために**必ず**活用します。
    * **【★★★重要: Mermaidコメントルール★★★】**
        * Mermaidの仕様やレンダラーによっては、**コード行（ノード定義やエッジ定義など）と同じ行の末尾にコメント (`%% ...`) を記述すると、図が正しくレンダリングされない**場合があります。
        * **コメントは必ず独立した行に記述してください。**
        * **悪い例 (エラーになる可能性が高い):**
          ```mermaid
          A --> B %% ボタンクリック時の処理
          ```
        * **良い例 (独立した行に記述):**
          ```mermaid
          A --> B
            %% ボタンクリック時の処理
          ```
    * このルールはAIにコード生成を依頼する際にも認識されにくい場合があるため、生成されたコードをレビューする際には特に注意してください (**【ai-developer-guide-vba.md】** 2項アンチパターン参照)。
    * 図のヘッダーコメント例:
        ```mermaid
        %% --- 案件管理フロー画面遷移図 ---
        %% Description: 案件の一覧表示から詳細表示、編集、保存までの基本的なフローを示す。
        %% Version: 1.1 (2025-04-14)
        %% Author: Your Name
        %%
        %% 凡例:
        %%   :::main - 主要画面
        %%   :::popup - ダイアログ
        %%   --> 実線: 正常遷移
        %%   -.-> 点線: エラー/キャンセル遷移
        ```
* **フォーマット:**
    * Mermaidコードのインデントを適切に行い、ノード定義、エッジ定義、サブグラフ定義などのブロックを視覚的に区別しやすく記述します。

### 4.5. 共通画面の表現

エラー通知、確認ダイアログ、情報通知、処理中表示、ファイルロック通知などの共通画面は、画面遷移図において頻繁に登場します。これらを表現する際の推奨方法は以下の通りです。

* **専用ノードとして定義:** 画面一覧に基づき、共通画面にも画面IDを付与し、遷移図上では専用のノード（例: `SCR90001_ERR["FRM90001_ERR: エラー通知"]:::error`）として表現します。
* **サブグラフでまとめる:** 各図において、関連する共通画面ノードを `subgraph "共通画面"` ... `end` でグループ化すると見やすくなります。
* **遷移の明確化:** 各画面から共通画面への遷移、および共通画面からの戻り先（元の画面、メインメニューなど）をエッジで明確に示します。特にエラー発生時の戻り先は重要です。
    * 例:
        ```mermaid
        graph TD
            subgraph "メイン機能"
                A["FRM11001:画面A"]:::main
            end
            subgraph "共通画面"
                ERR["FRM90001_ERR:エラー通知"]:::error
                CNF["FRM90002_CNF:確認"]:::popup
            end

            A -->|保存ボタンクリック| CNF
            CNF -->|"OK"| A
                %% 確認後、画面Aに戻る
            CNF -->|"キャンセル"| A
            A -->|"[DB保存エラー]"| ERR
                %% design-principlesのエラーハンドリング戦略に従い、
                %% エラー発生時は共通エラー通知へ
            ERR -->|"OK"| A
                %% エラー確認後、元の画面Aに戻る
                %% (エラー内容によってはメインメニュー等へ戻る場合もある)

            classDef main fill:#ccf,stroke:#333,stroke-width:1px;
            classDef error fill:#fdd,stroke:#c00,stroke-width:1px;
            classDef popup fill:#fff,stroke:#f00,stroke-width:1px,stroke-dasharray: 2 2;
        ```
* **共通フロー図への分割:** プロジェクト規模が大きい場合、「ログインフロー」「エラーハンドリングフロー」などを独立した図として定義し、他の機能フロー図からはその共通フロー図への参照（例: ノード `CommonLoginFlow["共通ログインフローへ"]`）を記述する方法も検討します。

## 5. UI/UXデザイン基本原則 (Accessフォーム向け)

画面の具体的なレイアウトやコントロール配置を設計する際には、以下の基本原則を考慮します。**【persol-theme-guideline.md】**で示されたデザイン原則と**【support-apps-requirements-statement.md】**の要件を、Accessフォームの特性を踏まえて適用します。

### 5.1. 目的

ユーザー（**障害**を持つ人を含む）にとって直感的で分かりやすく、効率的に操作でき、かつエラーを誘発しにくいユーザーインターフェースを提供することを目指します。アプリケーション全体で一貫した操作感を提供することも重要です。

### 5.2. レイアウト原則 (PERSOLテーマガイドライン参照)

* **一貫性 (Do):** アプリケーション内の各画面で、ヘッダー、フッター、ナビゲーション要素、主要コンテンツ領域などの基本的な配置構成を統一します。
* **グループ化 (Do):** 関連性の高い情報は視覚的に近づけ、Accessの `Frame` コントロールや区切り線、十分な余白を用いてグループ化します（**【persol-theme-guideline.md】** 3.3項 近接の原則）。
* **余白 (Whitespace) (Do):** 要素間やセクション間に十分な余白を設けます（**【persol-theme-guideline.md】** 3.3項）。`Padding` や `Margin` に相当する概念を意識し、コントロールの `Top`, `Left`, `Width`, `Height` プロパティで調整します。
* **整列 (Alignment) (Do):** コントロールは左揃え、右揃えなどを適切に用い、グリッドを意識して整然と配置します（Accessの配置ツール活用）。
* **アンチパターン (Don't):**
    * 画面ごとにレイアウト構成がバラバラ。
    * 関連性の低い情報が近くに配置されている、または関連性の高い情報が離れている。
    * 要素が詰まりすぎていて、どこを見ればよいか分かりにくい。
    * コントロールの配置が不揃いで雑然とした印象を与える。

### 5.3. コントロール利用原則

* **標準コントロール優先 (Do):** 特殊な要件がない限り、Accessの標準コントロール（テキストボックス、コンボボックス、リストボックス、コマンドボタン、ラベル、タブコントロール、サブフォーム等）の使用を優先します。これにより、OS標準の操作感やアクセシビリティ機能との互換性が高まります。ActiveXコントロールの使用は、互換性や配布の問題を考慮し、慎重に検討します。
* **適切な選択 (Do):** 目的（データ入力、選択肢提示、アクション実行、情報表示など）に応じて、最も適切なコントロールを選択します。
    * 例: 少数の固定選択肢ならオプションボタン、多数の選択肢ならコンボボックスやリストボックス。
* **命名規則 (Do):** **【coding-standards-vba.md】**で定められたコントロール命名規則（例: `txtUserName`, `cboCategory`, `cmdOK`）に厳密に従います。
* **アンチパターン (Don't):**
    * 必要なくActiveXコントロールを多用し、配布や互換性の問題を引き起こす。
    * 多数の選択肢にオプションボタンを使い、画面領域を圧迫する。
    * コントロール名がデフォルト（例: `Text1`, `Command3`）のままで、コードの可読性が低い。

### 5.4. 配色とタイポグラフィ原則 (PERSOLテーマガイドライン参照)

* **配色 (Do):**
    * **【persol-theme-guideline.md】** 3.1項のカラーパレットを参考に、Accessフォームのプロパティ（`BackColor`, `ForeColor`, `BorderColor`等）を設定します。
        * 背景: `persol-white` (#FFFFFF) または淡いニュートラルグレー。
        * 文字: `persol-dark-gray` (#53565A) を基本。
        * アクセント: `persol-teal` (#00BFB3) や `persol-blue` (#00B5E2) をボタンや強調箇所に限定的に使用。
    * **コントラスト:** テキストと背景色、重要なUI要素（ボタンなど）と背景色の間には、十分なコントラスト比を確保します（WCAG 2.1 AAレベル: 4.5:1 / 3:1）。コントラストチェックツール等での確認を推奨します（「付録A アクセシビリティチェックリスト」A.6参照）。
    * **色覚多様性配慮:** 色だけで情報を伝えないように注意します。ステータスを示す場合は、色に加えてアイコン（イメージコントロール等）やテキストラベルなどを併用します（「付録A アクセシビリティチェックリスト」A.7参照）。
* **タイポグラフィ (Do):**
    * **フォント:** **【persol-theme-guideline.md】** 3.2項に基づき、読みやすい標準的なサンセリフ体（例: `Meiryo UI`, `Yu Gothic UI`）をアプリケーション内で統一します。
    * **サイズ:** 基準となるフォントサイズ（例: 10pt〜12pt程度）を設定し、見出しは段階的に大きくするなど、視覚的な階層を意識します。小さすぎる文字（9pt未満など）は避けます（「付録A アクセシビリティチェックリスト」A.8参照）。
    * **行間:** Accessでは直接制御が難しいですが、ラベルとコントロールの間隔、複数行テキストボックスの高さなどで読みやすさに配慮します。
* **アンチパターン (Don't):**
    * 背景色と文字色のコントラストが低く、文字が読みにくい。
    * 多色を使いすぎ、統一感がなく、どこが重要か分かりにくい。
    * 赤/緑の色だけでステータスを示しており、色覚多様性を持つユーザーが区別できない。
    * 特殊なフォントを使用し、環境によって表示が変わる、または読みにくい。
    * 文字サイズが小さすぎる、または画面内でサイズがバラバラ。

### 5.5. フィードバック原則

* ユーザーのアクション（ボタンクリック、データ保存、処理実行など）に対して、システムが応答していること、処理結果（成功、失敗、処理中）を**明確かつタイムリーに**フィードバックします。
* **フィードバック方法 (Do):**
    * **成功時:** ステータスバーへの一時的なメッセージ表示（例: 「保存しました。」）、短い情報メッセージボックス（`MsgBox vbInformation`）、画面の一部（例: 保存ボタンの無効化）など。
    * **失敗/エラー時:** 分かりやすいエラーメッセージボックス（`MsgBox vbCritical` または専用エラーフォーム `SCR_ERR`）、エラー箇所の強調表示（例: 背景色変更）、ログへの誘導。エラーメッセージは具体的で解決策を示唆するものにする（「付録A アクセシビリティチェックリスト」A.10参照）。
    * **処理中:** マウスカーソルの砂時計表示 (`DoCmd.Hourglass True/False`)、ステータスバーへのメッセージ表示、プログレスバーコントロール（長時間処理の場合、**【design-principles-vba.md】** 5項参照）、処理中は操作ボタンを無効化するなど。
* **一貫性 (Do):** アプリケーション全体で、同様の状況には一貫したフィードバックパターンを適用します。
* **アンチパターン (Don't):**
    * ボタンをクリックしても何も反応がないように見える。
    * 保存処理が成功したのか失敗したのか分からない。
    * エラーメッセージが抽象的で原因が分からない（例: 「エラーが発生しました。」）。
    * 長時間処理中にUIがフリーズし、進捗状況が分からない。

### 5.6. アクセシビリティ実装原則 (要件定義書5.4項 & PERSOLテーマガイドライン準拠)

**【support-apps-requirements-statement.md】** 5.4項で定義された要件に基づき、Accessフォーム上で以下のアクセシビリティ実装を**必須**とします。詳細は**「付録A アクセシビリティチェックリスト」**を参照し、実装とテストを行ってください。

* **キーボード操作 (必須):**
    * **[原則]** すべての機能（コントロールへのフォーカス移動、値の選択・入力、ボタンの実行、メニュー操作など）がキーボードのみで操作可能であること。マウス操作が必須となる機能を設けない（チェックリスト A.1）。
    * **[実装]** 各コントロールの `Enabled`, `Locked`, `TabStop` プロパティを適切に設定する。
* **タブオーダー (必須):**
    * **[原則]** フォーム内のコントロールを Tab キーで移動する際の順序が、論理的で自然な流れ（通常は左上から右下、または関連するグループごと）になるように設定する（チェックリスト A.2）。
    * **[実装]** 各コントロールの `TabIndex` プロパティを0から始まる連続した整数で設定する。`Frame` や `TabControl` 内のコントロールも考慮する。
* **アクセスキー (必須):**
    * **[原則]** 主要なボタンやコントロール（特にテキストボックス、コンボボックス、チェックボックス等）には、対応するラベル (`Label` コントロール) の `Caption` プロパティ内で、アクセスキーとして機能する文字の前にアンパサンド (`&`) を付与する (例: `保&存(S)`, `&名前(N):`)。**括弧内に英字キーを明記**することを推奨（チェックリスト A.3）。
    * **[実装]** ラベルの `Caption` を設定する。
* **ラベル (必須):**
    * **[原則]** すべての入力系コントロール（テキストボックス、コンボボックス、リストボックス、チェックボックス、オプションボタン等）には、その目的を示す `Label` コントロールを視覚的に近接して配置し、関連付ける（ラベルクリックでコントロールにフォーカスが移動するように）（チェックリスト A.4）。
    * **[実装]** ラベルと対応するコントロールをペアで配置し、ラベルの `Caption` を設定する。
* **`ControlTipText` (推奨):**
    * **[原則]** 操作が自明でないコントロールや、入力形式に補足が必要なコントロールには、ユーザーがマウスカーソルを合わせた際に表示されるヒントテキストを設定する。これはスクリーンリーダーの読み上げにも寄与する（チェックリスト A.5）。
    * **[実装]** コントロールの `ControlTipText` プロパティに簡潔で分かりやすい説明を設定する。
* **コントラストと色 (必須):**
    * **[原則]** 5.4項の原則に従い、十分なコントラスト比を確保し（チェックリスト A.6）、色だけに依存しない情報提示を行う（チェックリスト A.7）。
* **フォントとサイズ (必須):**
    * **[原則]** 5.4項の原則に従い、読みやすいフォントと適切なサイズを使用する（チェックリスト A.8）。
* **スクリーンリーダーへの配慮 (配慮):**
    * **[原則]** 上記のラベル、タブオーダー、標準コントロールの使用を徹底することで、スクリーンリーダーによる基本的な読み上げに対応する。カスタムコントロールや複雑なUI要素を使用する場合は、スクリーンリーダーでの動作確認を別途検討する（ベストエフォート）（チェックリスト A.12）。
* **テスト (必須):** 設計レビューおよびテストフェーズで、これらのアクセシビリティ要件が満たされているかを「付録A アクセシビリティチェックリスト」を用いて確認するプロセスを設ける (**【testing-guidelines-vba.md】** の受入テスト等と連携)。

### 5.7. テスト容易性を考慮したUI設計原則

**【testing-guidelines-vba.md】** 4項の「テスト容易性のための設計」に基づき、以下の原則をUI設計段階から意識します。

* **コントロール命名規則の遵守 (Do):** **【coding-standards-vba.md】** に従った明確なコントロール名を付けることで、VBAコードからのアクセスやテストコード（手動またはツール支援）での参照を容易にします。
* **ロジック分離の前提 (Do):** UI（フォーム）はユーザー操作の受付と結果表示に集中し、ビジネスロジック（検証、計算、DBアクセスなど）は独立したモジュール（クラス/標準）に実装することを前提として設計します。これにより、UIを表示せずにロジック部分のテストが可能になります（画面一覧「UI/ロジック分離方針」参照）。
* **UI要素への直接依存を減らす (Do):** ビジネスロジックモジュールは、特定のフォームコントロール（例: `Forms!MyForm!txtInput`）に直接アクセスするのではなく、必要なデータを引数として受け取るように設計します。
* **アンチパターン (Don't):**
    * コントロール名がデフォルトのまま（`Text1`, `Command3`）で、コードが読みにくい。
    * イベントプロシージャ内に大量のビジネスロジックが記述され、分離されていない。
    * ビジネスロジックモジュールが特定のフォームコントロールを直接参照しており、テストが困難。

## 6. ドキュメント作成・管理プロセス

* **作成とレビュー:** 基本設計フェーズで画面一覧と画面遷移図のドラフトを作成し、関係者（設計者、開発者、テスター、必要に応じてユーザー代表）によるレビューを実施します。レビューでは、MECE性、整合性、明瞭性、および各ガイドライン（特にアクセシビリティ、UI/ロジック分離、テスト容易性）への準拠を確認します。レビュー時には「付録A アクセシビリティチェックリスト」も活用します。
* **承認:** レビュー結果を反映し、内容をFIXさせ、関係者間で承認プロセスを経ます。
* **変更管理:** 開発プロセス中に画面仕様や遷移フローに変更が生じた場合は、速やかに本書（または関連ドキュメント）を更新し、関連する設計書（画面一覧、クエリ定義、モジュール設計等）との**整合性**を維持します。変更履歴（バージョン、日付、変更内容、担当者）は各ドキュメントに適切に記録します。
* **整合性確保:** 画面一覧、画面遷移図、および他の設計ドキュメント（要件定義書、BE設計書、モジュール設計書など）間で、画面ID、画面名、遷移関係、データソースなどに矛盾が生じないように、相互参照とレビューを通じて注意深く確認します。

---

## 付録A: アクセシビリティチェックリスト (Accessフォーム向け)

**目的:** **【support-apps-requirements-statement.md】** 5.4項 および **【persol-theme-guideline.md】** 5項に基づき、Accessフォームのアクセシビリティ実装を確認するためのチェックリスト。

**対象:** 設計レビュー、実装レビュー、テストフェーズで使用。

| No. | チェック項目                     | 確認内容                                                                                                                                                                                                                          | 関連標準                                                                                                                              | 確認結果 (OK/NG/NA) | 備考/修正指示 |
| :-: | :------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------- | :------------------ | :------------ |
| **A.1** | **キーボード操作性** | 全ての機能（フォーカス移動、入力、選択、ボタン実行、メニュー操作等）がキーボードのみで完結するか？ マウス必須の操作はないか？ Escキー等の標準動作は機能するか？                                                                     | 要件5.4, persol 5                                                                                                                         |                     |               |
| **A.2** | **タブオーダー** | Tabキーによるコントロール間の移動順序は、論理的で自然な流れ（左上→右下、グループ単位）になっているか？ `TabIndex` プロパティは適切に設定されているか？ FrameやTabControl内も考慮されているか？ `TabStop=False` が適切に使われているか？ | 要件5.4                                                                                                                                 |                     |               |
| **A.3** | **アクセスキー** | 主要なボタンや入力コントロールに対応するラベルの `Caption` にアクセスキー（`&`）が設定され、括弧内に英字キーが明記されているか（例: `保&存(S)`）？ ラベルクリックで対応コントロールにフォーカスが移動するか？                               | 要件5.4                                                                                                                                 |                     |               |
| **A.4** | **ラベルの関連付け** | 全ての入力/選択コントロール（テキストボックス、コンボボックス、リストボックス、チェックボックス、オプションボタン等）に、目的を示す `Label` が視覚的に近接して配置され、関連付けられているか？                                                | 要件5.4, persol 5                                                                                                                         |                     |               |
| **A.5** | **補足説明 (`ControlTipText`)** | 操作が自明でない、または入力形式に補足が必要なコントロールに、`ControlTipText` プロパティで簡潔かつ分かりやすい説明が設定されているか？ (推奨)                                                                                     | 要件5.4                                                                                                                                 |                     |               |
| **A.6** | **コントラスト比** | 文字と背景色、主要UI要素（ボタン等）と背景色のコントラスト比は十分か？（WCAG 2.1 AAレベル: 4.5:1 / 3:1以上）。コントラストチェックツールでの確認を推奨。                                                                      | 要件5.4, persol 3.1, 5                                                                                                                    |                     |               |
| **A.7** | **色依存の排除** | 色だけで情報（例: ステータス、エラー箇所）を伝えていないか？ 色と併せてアイコン、テキストラベル、形状等で識別できるように工夫されているか？                                                                                           | persol 5                                                                                                                                |                     |               |
| **A.8** | **フォントとサイズ** | 読みやすい標準的なサンセリフ体（例: Meiryo UI, Yu Gothic UI）が適切なサイズ（例: 10-12pt目安）で使用されているか？ 小さすぎる文字（9pt未満等）はないか？                                                                            | 要件5.4, persol 3.2, 5                                                                                                                    |                     |               |
| **A.9** | **フォーカス表示** | 現在フォーカスのあるコントロールが視覚的に明確に識別できるか？（通常はOS標準の表示に従う）                                                                                                                                           | (WCAG 2.1 SC 2.4.7)                                                                                                                     |                     |               |
| **A.10**| **エラーメッセージ** | エラー発生時、内容と（可能であれば）対処法が具体的で分かりやすいメッセージが表示されるか？ エラー箇所が特定できるか？                                                                                                                    | 要件5.4 (フィードバック)                                                                                                              |                     |               |
| **A.11**| **フォームサイズと拡大** | フォームが極端に小さくないか？ OSの拡大・縮小機能を使用しても、表示が大きく崩れたり、操作不能になったりしないか？                                                                                                                      | persol 5                                                                                                                                |                     |               |
| **A.12**| **標準コントロール** | ActiveXコントロールなど、アクセシビリティ対応が不確かなカスタムコントロールではなく、Access標準コントロールを優先して使用しているか？                                                                                                   | (Implied by others)                                                                                                                     |                     |               |
| **A.13**| **スクリーンリーダー (確認)** | (ベストエフォート) 上記項目を遵守することで基本的な読み上げは担保される想定だが、可能であればスクリーンリーダー（NVDA等）で主要な操作を行い、読み上げ内容や操作性に大きな問題がないか確認する。                                            | 要件5.4                                                                                                                                 |                     |               |

---

**以上**