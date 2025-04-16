---
title: "バックエンド(BE)設計：クエリ定義"
section_number: 4
status: "FIXED"
prev_section: "./basic-design-03-backend-design.md"
next_section: "./basic-design-05-frontend-design.md"
---

## 4. バックエンド(BE)設計：クエリ定義

### 4.1. フォーム表示・検索用クエリ

#### 4.1.1. Q_SearchCases_Admin (管理者向け案件検索クエリ)

*   **目的/用途:** 管理者が案件情報を複合条件で検索・一覧表示するために使用する。主にメインの案件一覧フォームのレコードソースとなる。
*   **種類:** 選択クエリ
*   **主要テーブル:**
    *   `T_CaseInfo` (案件情報)
    *   `M_BusinessType` (業務種別マスタ) - 業務種別名表示用
    *   `M_SystemStatus` (システムステータスマスタ) - システム状態名表示用
    *   `M_OverallCaseStatus` (案件全体ステータスマスタ) - 案件全体状態名表示用
    *   `M_User` (ユーザーマスタ) - 主担当者名表示用
*   **主要フィールド:**
    *   `T_CaseInfo.CaseUUID` (案件独自キー)
    *   `T_CaseInfo.CaseMgmtNumber` (案件管理番号)
    *   `M_BusinessType.BusinessTypeName` (業務種別名)
    *   `T_CaseInfo.RequestDateTime` (依頼日時)
    *   `T_CaseInfo.DueDate` (納期)
    *   `M_User.UserName` (主担当者名)
    *   `M_SystemStatus.SystemStatusName` (システム状態名)
    *   `M_OverallCaseStatus.OverallCaseStatusName` (案件全体状態名)
    *   `T_CaseInfo.LastUpdatedDateTime` (最終更新日時)
    *   *(その他、一覧表示に必要なフィールド)*
*   **抽出条件 (WHERE句):** 以下のパラメータに基づいて動的に生成される。
    *   `caseMgmtNumber` (案件管理番号、部分一致)
    *   `businessTypeName` (業務種別名、完全一致)
    *   `requestDateFrom` (依頼日時 From)
    *   `requestDateTo` (依頼日時 To)
    *   `dueDateFrom` (納期 From)
    *   `dueDateTo` (納期 To)
    *   `primaryUserName` (主担当者名、完全一致)
    *   `systemStatusName` (システム状態名、完全一致)
    *   `overallCaseStatusName` (案件全体状態名、完全一致)
*   **結合条件 (JOIN):**
    *   `T_CaseInfo` LEFT JOIN `M_BusinessType` ON `T_CaseInfo.BusinessTypeID = M_BusinessType.BusinessTypeID`
    *   `T_CaseInfo` LEFT JOIN `M_SystemStatus` ON `T_CaseInfo.SystemStatusID = M_SystemStatus.SystemStatusID`
    *   `T_CaseInfo` LEFT JOIN `M_OverallCaseStatus` ON `T_CaseInfo.OverallCaseStatusID = M_OverallCaseStatus.OverallCaseStatusID`
    *   `T_CaseInfo` LEFT JOIN `M_User` ON `T_CaseInfo.PrimaryUserID = M_User.UserID`
*   **グループ化 (GROUP BY):** なし
*   **集計関数:** なし
*   **ソート順 (ORDER BY):** 依頼日時(`RequestDateTime`) の降順をデフォルトとする (変更可能)。
*   **パラメータ:** 上記抽出条件の `camelCase` で示される各項目。フォーム上のコントロールから値を受け取る。
*   **備考/特記事項:**
    *   LEFT JOIN を使用し、関連マスタ情報が存在しない場合でも案件情報が表示されるようにする。
    *   大量データ時のパフォーマンスを考慮し、検索条件フィールド (`BusinessTypeID`, `SystemStatusID`, `OverallCaseStatusID`, `PrimaryUserID`, `RequestDateTime`, `DueDate`) にはインデックスが設定されていることを確認する。
    *   VBA側で条件が指定されなかったパラメータを除外してSQLを動的に構築する必要がある。

---

#### 4.1.2. Q_GetCaseDetails_Worker (作業者向け案件詳細表示クエリ)

*   **目的/用途:** 作業者が特定の案件（`CaseUUID` で指定）に関する詳細情報（共通情報および業務固有情報）を表示するフォームで使用する。
*   **種類:** 選択クエリ
*   **主要テーブル:**
    *   `T_CaseInfo` (案件情報)
    *   `T_CaseDetail_...` (案件詳細テーブル群 - 詳細設計で具体化)
    *   関連マスタ（`M_BusinessType`, `M_SystemStatus`, `M_OverallCaseStatus`, `M_User` など、表示に必要なもの）
*   **主要フィールド:**
    *   `T_CaseInfo.CaseUUID`, `T_CaseInfo.CaseMgmtNumber`, `T_CaseInfo.ImportSourceFile`, `T_CaseInfo.ImportDateTime`, `T_CaseInfo.LastUpdatedDateTime`, `T_CaseInfo.RequestDateTime`, `T_CaseInfo.DueDate` *(など、T_CaseInfoの表示必要項目)*
    *   `T_CaseDetail_...フィールド1`, `T_CaseDetail_...フィールド2` *(など、T_CaseDetailの表示必要項目)*
    *   `M_BusinessType.BusinessTypeName`, `M_SystemStatus.SystemStatusName`, `M_OverallCaseStatus.OverallCaseStatusName`, `M_User.UserName` AS `PrimaryUserName` *(など、関連マスタの表示用フィールド)*
*   **抽出条件 (WHERE句):** `T_CaseInfo.CaseUUID = [caseUUID]`
*   **結合条件 (JOIN):**
    *   `T_CaseInfo` と `T_CaseDetail_...` を `CaseUUID` で結合 (INNER JOIN または LEFT JOIN は詳細設計で決定)。
    *   `T_CaseInfo` と関連マスタを LEFT JOIN で結合。
*   **グループ化 (GROUP BY):** なし
*   **集計関数:** なし
*   **ソート順 (ORDER BY):** なし (単一レコード取得のため)
*   **パラメータ:** `caseUUID` (表示対象案件のUUID)
*   **備考/特記事項:**
    *   `T_CaseDetail_...` の具体的なテーブル構造とフィールドは詳細設計フェーズで定義されるため、このクエリも詳細設計で具体化する。
    *   作業者が実書類の情報（例: 社員番号、会社名）で検索する場合、その情報が格納される `T_CaseDetail_...` のフィールドを検索条件に含めるクエリも別途必要になる可能性がある（詳細設計で検討）。

---

#### 4.1.3. Q_GetWorkHistory (作業履歴表示クエリ)

*   **目的/用途:** 特定の案件（`CaseUUID` で指定）に関する作業履歴を、関連情報（工程名、アクション名、担当者名）と共に時系列で表示する。主に案件詳細フォーム内のサブフォーム等で使用される。
*   **種類:** 選択クエリ
*   **主要テーブル:**
    *   `T_WorkHistory` (作業履歴)
    *   `M_ProcessDefinition` (工程定義マスタ) - 工程名表示用
    *   `M_ActionType` (アクション種別マスタ) - アクション名表示用
    *   `M_User` (ユーザーマスタ) - 担当者名表示用
*   **主要フィールド:**
    *   `T_WorkHistory.WorkHistoryID`
    *   `T_WorkHistory.ActionDateTime` (アクション日時)
    *   `M_ProcessDefinition.ProcessName` (工程名)
    *   `M_ActionType.ActionTypeName` (アクション種別名)
    *   `M_User.UserName` (担当者名)
    *   `T_WorkHistory.Remarks` (備考)
    *   `T_WorkHistory.WorkDetailMemo` (作業内容詳細メモ)
*   **抽出条件 (WHERE句):** `T_WorkHistory.CaseUUID = [caseUUID]`
*   **結合条件 (JOIN):**
    *   `T_WorkHistory` INNER JOIN `M_ProcessDefinition` ON `T_WorkHistory.ProcessDefinitionID = M_ProcessDefinition.ProcessDefinitionID`
    *   `T_WorkHistory` INNER JOIN `M_ActionType` ON `T_WorkHistory.ActionTypeID = M_ActionType.ActionTypeID`
    *   `T_WorkHistory` INNER JOIN `M_User` ON `T_WorkHistory.UserID = M_User.UserID`
*   **グループ化 (GROUP BY):** なし
*   **集計関数:** なし
*   **ソート順 (ORDER BY):** `T_WorkHistory.ActionDateTime` の昇順 (古い履歴から表示)。
*   **パラメータ:** `caseUUID` (表示対象案件のUUID)
*   **備考/特記事項:**
    *   INNER JOIN を使用し、関連マスタが存在する履歴のみを表示する（通常、マスタ削除はしない想定）。
    *   表示パフォーマンスのため、`T_WorkHistory.CaseUUID` にはインデックスが設定されていることを確認する。

---

### 4.2. 実績集計・分析用クエリ

#### 4.2.1. Q_GetDailyPerformanceSummary (日次実績集計表示クエリ)

*   **目的/用途:** 日次で集計された実績データ (`T_DailyPerformanceSummary`) を、関連マスタ情報（担当者名、業務種別名、工程名）と結合し、指定された条件（期間、担当者、業務種別、工程）で絞り込んで表示する。ダッシュボードやレポートのデータソースとして使用する。
*   **種類:** 選択クエリ
*   **主要テーブル:**
    *   `T_DailyPerformanceSummary` (日次実績集計)
    *   `M_User` (ユーザーマスタ) - 担当者名表示用
    *   `M_BusinessType` (業務種別マスタ) - 業務種別名表示用
    *   `M_ProcessDefinition` (工程定義マスタ) - 工程名表示用
*   **主要フィールド:**
    *   `T_DailyPerformanceSummary.SummaryDate` (集計日)
    *   `M_User.UserName` (担当者名)
    *   `M_BusinessType.BusinessTypeName` (業務種別名)
    *   `M_ProcessDefinition.ProcessName` (工程名)
    *   `T_DailyPerformanceSummary.CompletedActionCount` (完了アクション数)
    *   `T_DailyPerformanceSummary.WorkloadFactorSum` (巻き取り工数合計)
    *   `T_DailyPerformanceSummary.EstimatedWorkMinutesSum` (作業時間(分)合計)
    *   `T_DailyPerformanceSummary.MissOccurredCount` (ミス発生件数)
    *   `T_DailyPerformanceSummary.CheckPerformedCount` (チェック実施件数)
    *   `T_DailyPerformanceSummary.MissPointedOutCount` (ミス指摘件数)
    *   *(必要に応じてミス率などを計算するフィールドを追加: `IIF(CheckPerformedCount > 0, MissOccurredCount / CheckPerformedCount, 0) AS MissRate` など)*
*   **抽出条件 (WHERE句):** 以下のパラメータに基づいて動的に生成される。
    *   `summaryDateFrom` (集計日 From)
    *   `summaryDateTo` (集計日 To)
    *   `userName` (担当者名、完全一致)
    *   `businessTypeName` (業務種別名、完全一致)
    *   `processName` (工程名、完全一致)
*   **結合条件 (JOIN):**
    *   `T_DailyPerformanceSummary` INNER JOIN `M_User` ON `T_DailyPerformanceSummary.UserID = M_User.UserID`
    *   `T_DailyPerformanceSummary` INNER JOIN `M_BusinessType` ON `T_DailyPerformanceSummary.BusinessTypeID = M_BusinessType.BusinessTypeID`
    *   `T_DailyPerformanceSummary` INNER JOIN `M_ProcessDefinition` ON `T_DailyPerformanceSummary.ProcessDefinitionID = M_ProcessDefinition.ProcessDefinitionID`
*   **グループ化 (GROUP BY):** なし (集計は `T_DailyPerformanceSummary` 作成時に実施済み)
*   **集計関数:** なし (必要ならクエリ内でミス率などを計算)
*   **ソート順 (ORDER BY):** 集計日(`SummaryDate`)、担当者名(`UserName`) などをデフォルトとする (変更可能)。
*   **パラメータ:** 上記抽出条件の `camelCase` で示される各項目。フォーム上のコントロールから値を受け取る。
*   **備考/特記事項:**
    *   このクエリは集計済みのデータを表示するためのものであり、集計処理自体は別途日次バッチ等で実行されることを前提とする。
    *   VBA側で条件が指定されなかったパラメータを除外してSQLを動的に構築する必要がある。

---

#### 4.2.2. Q_GetLeadTimeAnalysisData (リードタイム分析用データ取得クエリ) - *修正・詳細化*

*   **目的/用途:** VBAでのリードタイム計算・分析に必要な元データを取得する。案件ごとの取込日時、依頼日時、完了アクション日時、および関連属性（業務種別など）を取得する。
*   **種類:** 選択クエリ (集計を伴う)
*   **主要テーブル:**
    *   `T_CaseInfo` (案件情報) - 取込日時、依頼日時、案件属性取得
    *   `T_WorkHistory` (作業履歴) - 完了アクション日時取得
    *   `M_ActionType` (アクション種別マスタ) - 完了アクション特定
    *   `M_BusinessType` (業務種別マスタ) - 業務種別名表示用
    *   *(オプション)* `M_Holiday` (祝日マスタ) - 営業日計算用
*   **主要フィールド (計算・集計後):**
    *   `CaseUUID` (案件独自キー)
    *   `BusinessTypeName` (業務種別名)
    *   `ImportDateTime` (取込日時 - リードタイム開始点)
    *   `RequestDateTime` (依頼日時 - 積み残し判定用)
    *   `CompletionDateTime` (完了アクション日時 - リードタイム終了点)
    *   `LeadTimeMinutes` (リードタイム(分) - `CompletionDateTime - ImportDateTime`)
    *   `LeadTimeBusinessDays` (リードタイム(営業日) - VBA関数等で計算)
    *   `IsCarriedOver` (積み残しフラグ - `DateValue(CompletionDateTime) > DateValue(RequestDateTime)` などで判定)
    *   *(その他、分析に必要な案件情報フィールド)*
*   **抽出条件 (WHERE句):**
    *   分析対象期間（例: `CompletionDateTime` が指定期間内）
    *   業務種別 (`T_CaseInfo.BusinessTypeID`)
    *   *(その他、必要に応じて)*
*   **結合条件 (JOIN):**
    *   `T_CaseInfo` LEFT JOIN (`T_WorkHistory` INNER JOIN `M_ActionType` ON `T_WorkHistory.ActionTypeID = M_ActionType.ActionTypeID` AND `M_ActionType.IsEndAction = True`) AS `CompletionHistory` ON `T_CaseInfo.CaseUUID = CompletionHistory.CaseUUID`
    *   `T_CaseInfo` LEFT JOIN `M_BusinessType` ON `T_CaseInfo.BusinessTypeID = M_BusinessType.BusinessTypeID`
*   **グループ化 (GROUP BY):**
    *   まずサブクエリ等で `CaseUUID` ごとに最初の完了アクション日時 (`MIN(ActionDateTime) WHERE IsEndAction = True`) を特定する。
    *   その後、業務種別や期間（例: `Format(CompletionDateTime, "yyyy-mm")`）などでグループ化し、リードタイムの平均値や積み残し件数 (`SUM(IIF(IsCarriedOver, 1, 0))`) などを計算。
*   **集計関数:** `MIN(ActionDateTime)`, `AVG(LeadTimeMinutes)`, `COUNT(*)`, `SUM(IIF(...))` など。
*   **ソート順 (ORDER BY):** 業務種別、期間などでソート。
*   **パラメータ:** 分析対象期間、業務種別など（`camelCase`形式）。
*   **備考/特記事項:**
    *   **VBAでの処理:** このクエリで取得したデータを基に、VBA側で以下の処理を行うことを想定する。
        *   完了アクション日時の特定（複数完了アクションがある場合のルール定義が必要）。
        *   リードタイム計算（単純な時間差、および営業日計算）。
        *   営業日計算には、土日判定と `M_Holiday` テーブルを参照するロジックが必要。
        *   積み残し判定（依頼日と完了日の比較）。
        *   必要に応じた集計（平均リードタイム、積み残し件数など）。
    *   **パフォーマンス:** `T_WorkHistory` が大きい場合、完了アクションの検索に時間がかかる可能性あり。`CaseUUID`, `ActionDateTime`, `ActionTypeID` へのインデックスが重要。
    *   **完了アクションの定義:** リードタイム計算の終点となる「完了」アクション（`M_ActionType` の `IsEndAction` フラグ等で識別）を明確に定義する必要がある。
    *   **積み残し分析:** 依頼日 (`RequestDateTime` または `ImportDateTime`) と完了日 (`CompletionDateTime`) の日付部分を比較して判定。日次・週次での積み残し件数推移を見るには、さらに日付でグループ化する必要がある。
    *   **対話的フォーム:** Accessフォームでの対話的な分析は、このクエリの結果セットをレコードソースとし、フォーム上のコントロールやVBAで絞り込みや再計算を行うことで実現する。

---

### 4.3. データ転記用クエリ

#### 4.3.1. Q_GetCasesForExport (転記対象案件取得クエリ)

*   **目的/用途:** データ転記機能（ステージングDB → 顧客Excel管理表）の対象となる案件情報を取得する。VBAの転記処理ロジックで使用される。
*   **種類:** 選択クエリ
*   **主要テーブル:**
    *   `T_CaseInfo` (案件情報)
    *   `T_CaseDetail_...` (案件詳細テーブル群 - 詳細設計で具体化)
    *   `M_SystemStatus` (システムステータスマスタ) - ステータス名取得用
    *   *(その他、転記に必要な情報を持つテーブル)*
*   **主要フィールド:**
    *   `T_CaseInfo.CaseUUID` (案件独自キー)
    *   `T_CaseInfo.CaseMgmtNumber` (案件管理番号 - Excel上の行特定に使用する可能性あり)
    *   `T_CaseInfo.ImportSourceFile` (取込元ファイル名 - 転記先Excel特定用)
    *   *(Excel上の行/列を特定するためのキー情報 - 例: `T_CaseDetail_...` 内のExcel行番号フィールドなど)*
    *   *(転記対象となるデータ項目 - 例: `T_CaseInfo.SystemStatusID`, `T_CaseDetail_...` の関連フィールド)*
    *   `M_SystemStatus.SystemStatusName` (現在のシステム状態名 - 転記対象判定用)
*   **抽出条件 (WHERE句):**
    *   転記対象となるシステムステータス（例: `M_SystemStatus.SystemStatusName = '転記待ち'` や `'完了'` など、運用ルールに基づく）
    *   *(その他、転記対象を絞り込む条件があれば)*
*   **結合条件 (JOIN):**
    *   `T_CaseInfo` INNER JOIN `M_SystemStatus` ON `T_CaseInfo.SystemStatusID = M_SystemStatus.SystemStatusID`
    *   `T_CaseInfo` と `T_CaseDetail_...` を結合 (詳細設計で具体化)
    *   *(その他、必要なテーブルを結合)*
*   **グループ化 (GROUP BY):** なし
*   **集計関数:** なし
*   **ソート順 (ORDER BY):** 転記処理の順序に意味がある場合（例: 案件管理番号順）は指定する。
*   **パラメータ:** なし (または転記対象を絞るためのパラメータ、`camelCase`形式)
*   **備考/特記事項:**
    *   このクエリで取得したレコードセットをVBAでループ処理し、1件ずつExcelへの転記処理を行うことを想定。
    *   転記ロジック（要件定義書 7.2項）で必要となる情報（Excel上のどの行/列に書き込むかの特定情報、書き込むべき値）を過不足なく取得する必要がある。
    *   `T_CaseDetail_...` の構造が未定のため、詳細設計で具体化する。
    *   **転記対象ステータスの定義:** 転記対象となる具体的なシステムステータス（例: '完了'）を明確に定義する必要がある。

---

#### 4.3.2. Q_UpdateCaseStatusAfterExport (転記後ステータス更新クエリ)

*   **目的/用途:** データ転記処理が正常に完了した案件について、`T_CaseInfo` テーブルのシステムステータスを更新する（例: '転記済' に変更）。VBAの転記処理ロジックから呼び出される。
*   **種類:** 更新クエリ (アクションクエリ)
*   **対象テーブル:** `T_CaseInfo` (案件情報)
*   **更新内容:**
    *   `SET T_CaseInfo.SystemStatusID = [paramNewStatusID]`
    *   `SET T_CaseInfo.LastUpdatedDateTime = Now()`
*   **抽出条件 (WHERE句):** `T_CaseInfo.CaseUUID = [paramCaseUUID]`
*   **パラメータ:**
    *   `newStatusID` (更新後の新しいシステムステータスID - 例: '転記済' に対応するID)
    *   `caseUUID` (ステータスを更新する案件のUUID)
*   **備考/特記事項:**
    *   VBAの転記処理ループ内で、1件の転記が成功するごとにこのクエリを実行することを想定。
    *   トランザクション管理（`BeginTrans`, `CommitTrans`, `Rollback`）と組み合わせて使用し、転記処理全体または個別案件の更新の原子性を確保することを検討する。

---

### 4.4. イベント管理用クエリ

#### 4.4.1. Q_GetEvents (イベント一覧表示クエリ)

*   **目的/用途:** イベント情報 (`T_Event`) を関連マスタ情報（種別名、ステータス名、起票者名など）と共に一覧表示する。イベント管理フォームのメインリスト表示用。
*   **種類:** 選択クエリ
*   **主要テーブル:**
    *   `T_Event` (イベント)
    *   `M_EventType` (イベント種別マスタ) - 種別名表示用
    *   `M_Status` (対応状況マスタ) - ステータス名表示用
    *   `M_User` (ユーザーマスタ) - 起票者名表示用
*   **主要フィールド:**
    *   `T_Event.EventID`
    *   `M_EventType.EventTypeName` (イベント種別名)
    *   `T_Event.EventTitle` (件名/概要)
    *   `T_Event.EventDateTime` (発生/起票日時)
    *   `M_User.UserName` AS `ReportedUserName` (起票者名)
    *   `M_Status.StatusName` (対応状況名)
    *   `T_Event.Priority` (優先度)
    *   `T_Event.DueDate` (対応期限)
    *   `T_Event.UpdatedDateTime` (最終更新日時)
*   **抽出条件 (WHERE句):** 以下のパラメータに基づいて動的に生成される。
    *   `eventTypeName` (イベント種別名)
    *   `statusName` (対応状況名)
    *   `eventDateFrom` (発生/起票日時 From)
    *   `eventDateTo` (発生/起票日時 To)
    *   `reportedUserName` (起票者名)
*   **結合条件 (JOIN):**
    *   `T_Event` LEFT JOIN `M_EventType` ON `T_Event.EventTypeID = M_EventType.EventTypeID`
    *   `T_Event` LEFT JOIN `M_Status` ON `T_Event.CurrentStatusID = M_Status.StatusID`
    *   `T_Event` LEFT JOIN `M_User` ON `T_Event.ReportedUserID = M_User.UserID`
*   **グループ化 (GROUP BY):** なし
*   **集計関数:** なし
*   **ソート順 (ORDER BY):** 発生/起票日時 (`EventDateTime`) の降順をデフォルトとする (変更可能)。
*   **パラメータ:** 上記抽出条件の `camelCase` で示される各項目。
*   **備考/特記事項:** LEFT JOIN を使用し、関連マスタ情報が欠落している場合でもイベント本体は表示されるようにする。

---

#### 4.4.2. Q_GetEventDetails (イベント詳細表示クエリ)

*   **目的/用途:** 特定のイベント (`EventID` で指定) に関連する詳細情報（追記履歴）を、関連情報（詳細種別名、追記ユーザー名）と共に時系列で表示する。イベント詳細フォーム内のサブフォーム等で使用される。
*   **種類:** 選択クエリ
*   **主要テーブル:**
    *   `T_EventDetail` (イベント詳細)
    *   `M_EventDetailType` (イベント詳細種別マスタ) - 詳細種別名表示用
    *   `M_User` (ユーザーマスタ) - 追記ユーザー名表示用
*   **主要フィールド:**
    *   `T_EventDetail.EventDetailID`
    *   `T_EventDetail.DetailDateTime` (追記日時)
    *   `M_EventDetailType.DetailTypeName` (詳細種別名)
    *   `M_User.UserName` AS `DetailUserName` (追記ユーザー名)
    *   `T_EventDetail.DetailContent` (追記内容)
    *   `T_EventDetail.RelatedFilePath` (関連ファイルパス)
*   **抽出条件 (WHERE句):** `T_EventDetail.EventID = [eventID]`
*   **結合条件 (JOIN):**
    *   `T_EventDetail` INNER JOIN `M_EventDetailType` ON `T_EventDetail.DetailTypeID = M_EventDetailType.DetailTypeID`
    *   `T_EventDetail` INNER JOIN `M_User` ON `T_EventDetail.UserID = M_User.UserID`
*   **グループ化 (GROUP BY):** なし
*   **集計関数:** なし
*   **ソート順 (ORDER BY):** 追記日時 (`DetailDateTime`) の昇順 (古い追記から表示)。
*   **パラメータ:** `eventID` (表示対象イベントのID)
*   **備考/特記事項:** INNER JOIN を使用し、関連マスタが存在する詳細のみを表示する。

---

#### 4.4.3. Q_GetEventsByCaseUUID (案件関連イベント取得クエリ) - *新規追加*

*   **目的/用途:** 特定の案件 (`CaseUUID` で指定) に関連付けられたイベントの一覧を取得する。案件詳細画面等で関連イベントを表示するために使用。
*   **種類:** 選択クエリ
*   **主要テーブル:**
    *   `T_EventRelatedCase` (イベント関連案件)
    *   `T_Event` (イベント)
    *   `M_EventType` (イベント種別マスタ)
    *   `M_Status` (対応状況マスタ)
*   **主要フィールド:**
    *   `T_Event.EventID`
    *   `M_EventType.EventTypeName` (イベント種別名)
    *   `T_Event.EventTitle` (件名/概要)
    *   `T_Event.EventDateTime` (発生/起票日時)
    *   `M_Status.StatusName` (対応状況名)
*   **抽出条件 (WHERE句):** `T_EventRelatedCase.CaseUUID = [caseUUID]`
*   **結合条件 (JOIN):**
    *   `T_EventRelatedCase` INNER JOIN `T_Event` ON `T_EventRelatedCase.EventID = T_Event.EventID`
    *   `T_Event` LEFT JOIN `M_EventType` ON `T_Event.EventTypeID = M_EventType.EventTypeID`
    *   `T_Event` LEFT JOIN `M_Status` ON `T_Event.CurrentStatusID = M_Status.StatusID`
*   **グループ化 (GROUP BY):** なし
*   **集計関数:** なし
*   **ソート順 (ORDER BY):** 発生/起票日時 (`EventDateTime`) の降順。
*   **パラメータ:** `caseUUID` (対象案件のUUID)
*   **備考/特記事項:** 案件詳細画面から関連イベントへドリルダウンする際に利用。

---

### 4.5. マスタデータ取得用クエリ群

#### 4.5.1. Q_GetMasterData_BusinessTypes (業務種別マスタ取得クエリ)

*   **目的/用途:** フォーム上のコンボボックス等で、有効な業務種別を選択肢として表示するために使用する。
*   **種類:** 選択クエリ
*   **主要テーブル:** `M_BusinessType`
*   **主要フィールド:** `BusinessTypeID`, `BusinessTypeName`
*   **抽出条件 (WHERE句):** `IsActive = True`
*   **ソート順 (ORDER BY):** `BusinessTypeName` の昇順。
*   **備考/特記事項:** 他のマスタデータ取得クエリも同様の構成で作成する (`M_User`, `M_SystemStatus`, `M_OverallCaseStatus`, `M_MissCategory`, `M_ActionType`, `M_EventType`, `M_Status`, `M_EventDetailType`, `M_EventUserRole`, `M_Role` など)。クエリ名は `Q_GetMasterData_テーブル名複数形` の形式とする。

---

### 4.6. データ整合性チェック用クエリ

#### 4.6.1. Q_CheckDuplicate_CaseMgmtNumber (案件管理番号重複チェッククエリ)

*   **目的/用途:** `T_CaseInfo` テーブル内で `CaseMgmtNumber` が重複しているレコードを検出する。データインポート時や定期的なデータチェックで使用。
*   **種類:** 選択クエリ (集計)
*   **主要テーブル:** `T_CaseInfo`
*   **主要フィールド:** `CaseMgmtNumber`, `Count(*) AS DuplicateCount`
*   **抽出条件 (WHERE句):** `CaseMgmtNumber Is Not Null`
*   **グループ化 (GROUP BY):** `CaseMgmtNumber`
*   **集計条件 (HAVING句):** `Count(*) > 1`
*   **備考/特記事項:** 重複している `CaseMgmtNumber` とその件数を返す。

---

#### 4.6.2. Q_CheckOrphan_WorkHistory (孤立作業履歴チェッククエリ)

*   **目的/用途:** 親となる案件情報 (`T_CaseInfo`) が存在しない作業履歴レコード (`T_WorkHistory`) を検出する。データクレンジングや定期チェックで使用。
*   **種類:** 選択クエリ
*   **主要テーブル:** `T_WorkHistory` LEFT JOIN `T_CaseInfo`
*   **主要フィールド:** `T_WorkHistory.WorkHistoryID`, `T_WorkHistory.CaseUUID` *(など、特定に必要なフィールド)*
*   **抽出条件 (WHERE句):** `T_CaseInfo.CaseUUID Is Null`
*   **結合条件 (JOIN):** `T_WorkHistory` LEFT JOIN `T_CaseInfo` ON `T_WorkHistory.CaseUUID = T_CaseInfo.CaseUUID`
*   **備考/特記事項:** 関連する `T_CaseInfo` が見つからない `T_WorkHistory` レコードを返す。他のテーブル（例: `T_CheckMiss` と `T_WorkHistory`）についても同様の孤立レコードチェッククエリを作成可能。

---

#### 4.6.3. Q_CheckForeignKey_CaseInfo_BusinessType (FK整合性チェッククエリ例) - *新規追加*

*   **目的/用途:** `T_CaseInfo` テーブルの `BusinessTypeID` が、対応するマスタ (`M_BusinessType`) に存在しないレコードを検出する。データ整合性チェックで使用。
*   **種類:** 選択クエリ
*   **主要テーブル:** `T_CaseInfo` LEFT JOIN `M_BusinessType`
*   **主要フィールド:** `T_CaseInfo.CaseUUID`, `T_CaseInfo.BusinessTypeID`
*   **抽出条件 (WHERE句):** `T_CaseInfo.BusinessTypeID Is Not Null AND M_BusinessType.BusinessTypeID Is Null`
*   **結合条件 (JOIN):** `T_CaseInfo` LEFT JOIN `M_BusinessType` ON `T_CaseInfo.BusinessTypeID = M_BusinessType.BusinessTypeID`
*   **備考/特記事項:** 他の外部キー制約についても同様のチェッククエリを作成可能（例: `Q_CheckForeignKey_WorkHistory_User` など）。

---

### 4.7. データメンテナンス用クエリ

#### 4.7.1. Q_DeleteOldLogs (古いログ削除クエリ)

*   **目的/用途:** 指定した日付 (`paramCutoffDate`) より古いログレコードを `T_Log` テーブルから削除する。定期的なデータベースメンテナンスで使用。
*   **種類:** 削除クエリ (アクションクエリ)
*   **対象テーブル:** `T_Log`
*   **抽出条件 (WHERE句):** `LogDateTime < [cutoffDate]`
*   **パラメータ:** `cutoffDate` (削除基準日)
*   **備考/特記事項:** 実行前にバックアップを取得することを強く推奨。削除対象件数を確認する選択クエリを別途用意すると安全。

---

#### 4.7.2. Q_GetSettingValue (設定値取得クエリ)

*   **目的/用途:** `M_Setting` テーブルから、指定した設定キー (`paramSettingKey`) に対応する設定値 (`SettingValue`) を取得する。VBAコード内でシステム設定を参照するために使用。
*   **種類:** 選択クエリ
*   **主要テーブル:** `M_Setting`
*   **主要フィールド:** `SettingValue`
*   **抽出条件 (WHERE句):** `SettingKey = [settingKey]`
*   **パラメータ:** `settingKey` (取得したい設定のキー)
*   **備考/特記事項:** DLookup関数でも代替可能だが、クエリとして定義しておくと管理しやすい場合がある。

---

### 4.8. データ取込用クエリ

#### 4.8.1. Q_ClearStagingImport (一時取込テーブルクリアクエリ)

*   **目的/用途:** データ取込処理の開始前に、一時取込テーブル (`T_StagingImport_...`) の内容をすべて削除する。
*   **種類:** 削除クエリ (アクションクエリ)
*   **対象テーブル:** `T_StagingImport_...` (対象テーブルは動的に指定する必要あり)
*   **抽出条件 (WHERE句):** なし (全件削除)
*   **備考/特記事項:** テーブル名は取込対象のExcelシート等に応じて変動するため、VBA側でSQLを動的に生成して実行する必要がある。

---

#### 4.8.2. Q_GetNewCasesFromStaging (ステージングからの新規案件データ取得クエリ)

*   **目的/用途:** VBAでの新規案件追加処理に必要なデータを、一時取込テーブル (`T_StagingImport_...`) から取得する。`T_CaseInfo` にまだ存在しない案件データを対象とする。
*   **種類:** 選択クエリ
*   **主要テーブル:** `T_StagingImport_...` LEFT JOIN `T_CaseInfo`
*   **主要フィールド:** `T_StagingImport_...キーフィールド`, `T_StagingImport_...フィールド1`, `T_StagingImport_...フィールド2` *(など、`T_CaseInfo` への追加に必要なフィールド)*
*   **抽出条件 (WHERE句):** `T_CaseInfo.CaseUUID Is Null` (または `T_CaseInfo` に対応するキーが存在しない条件)
*   **結合条件 (JOIN):** `T_StagingImport_...` LEFT JOIN `T_CaseInfo` ON `T_StagingImport_...キー = T_CaseInfo.キー` (キーは `CaseMgmtNumber` など、一意性を担保できる項目)
*   **備考/特記事項:**
    *   **VBAでの処理:** このクエリで取得したデータを基に、VBA側で `T_CaseInfo` へのレコード追加処理を行う。`CaseUUID` の生成・設定、`ImportSourceFile`, `ImportDateTime` などの設定もVBA側で行う。
    *   `T_StagingImport_...` の構造とキー項目は詳細設計で決定。

---

#### 4.8.3. Q_GetExistingCasesForUpdate (ステージングからの更新対象案件データ取得クエリ)

*   **目的/用途:** VBAでの既存案件更新処理に必要なデータを、一時取込テーブル (`T_StagingImport_...`) と `T_CaseInfo` から取得する。差分更新を行う場合に利用。
*   **種類:** 選択クエリ
*   **主要テーブル:** `T_CaseInfo` INNER JOIN `T_StagingImport_...`
*   **主要フィールド:** `T_CaseInfo.CaseUUID`, `T_CaseInfo.SystemStatusID`, `T_StagingImport_...フィールド1`, `T_StagingImport_...フィールド2` *(など、比較・更新に必要なフィールド)*
*   **結合条件 (JOIN):** `T_CaseInfo` INNER JOIN `T_StagingImport_...` ON `T_CaseInfo.キー = T_StagingImport_...キー` (キーは `CaseMgmtNumber` など)
*   **備考/特記事項:**
    *   **VBAでの処理:** このクエリで取得したデータを基に、VBA側で `T_CaseInfo` のデータと `T_StagingImport_...` のデータを比較し、差分があれば `T_CaseInfo` を更新する処理を行う。`LastUpdatedDateTime` の更新もVBA側で行う。
    *   差分更新ロジック（どの項目を更新対象とするか）はVBA側で実装する。
    *   **差分更新用クエリ検討:** 更新が必要なレコードのみを抽出するクエリ（例: `WHERE T_CaseInfo.Field1 <> T_StagingImport_...Field1 OR ...`）を定義することも検討可能だが、クエリが複雑になる可能性があるため、VBAでの比較を基本とする。
    *   `T_StagingImport_...` の構造とキー項目は詳細設計で決定。

---

### 4.9. ログ・監査用クエリ

#### 4.9.1. Q_SearchLogs (ログ検索クエリ)

*   **目的/用途:** `T_Log` テーブルから、指定された条件（ログレベル、期間、ユーザー、キーワード等）でログレコードを検索・表示する。トラブルシューティングや監査で使用。
*   **種類:** 選択クエリ
*   **主要テーブル:** `T_Log` LEFT JOIN `M_User` LEFT JOIN `T_CaseInfo`
*   **主要フィールド:** `T_Log.LogID`, `T_Log.LogDateTime`, `T_Log.LogLevel`, `T_Log.EventType`, `T_Log.Message`, `M_User.UserName`, `T_CaseInfo.CaseMgmtNumber`, `T_Log.SourceProcedure`, `T_Log.ErrorNumber`, `T_Log.ErrorDescription`, `T_Log.ContextInfo`
*   **抽出条件 (WHERE句):** 以下のパラメータに基づいて動的に生成される。
    *   `logLevel` (ログレベル)
    *   `logDateFrom` (発生日時 From)
    *   `logDateTo` (発生日時 To)
    *   `userName` (ユーザー名)
    *   `caseMgmtNumber` (案件管理番号)
    *   `keyword` (メッセージ本文の部分一致検索)
*   **結合条件 (JOIN):**
    *   `T_Log` LEFT JOIN `M_User` ON `T_Log.UserID = M_User.UserID`
    *   `T_Log` LEFT JOIN `T_CaseInfo` ON `T_Log.CaseUUID = T_CaseInfo.CaseUUID`
*   **ソート順 (ORDER BY):** 発生日時 (`LogDateTime`) の降順。
*   **パラメータ:** 上記抽出条件の `camelCase` で示される各項目。
*   **備考/特記事項:**
    *   VBA側で条件が指定されなかったパラメータを除外してSQLを動的に構築する必要がある。
    *   メッセージ本文の部分一致検索 (`keyword`) は、`T_Log` テーブルのレコード数が多い場合にパフォーマンスが低下する可能性があるため注意が必要。

---

### 4.10. ユーティリティクエリ

#### 4.10.1. Q_GetOverdueCases (納期超過案件取得クエリ)

*   **目的/用途:** 現在日時が納期 (`DueDate`) を過ぎている未完了案件のリストを取得する。管理者へのアラートやダッシュボード表示用。
*   **種類:** 選択クエリ
*   **主要テーブル:** `T_CaseInfo` INNER JOIN `M_SystemStatus`
*   **主要フィールド:** `T_CaseInfo.CaseUUID`, `T_CaseInfo.CaseMgmtNumber`, `T_CaseInfo.DueDate`, `M_SystemStatus.SystemStatusName` *(など、必要な情報)*
*   **抽出条件 (WHERE句):**
    *   `T_CaseInfo.DueDate < Date()`
    *   AND `M_SystemStatus.SystemStatusName` が完了を示すステータスではない (例: `<> '完了'` や `<> '転記済'`)
*   **結合条件 (JOIN):** `T_CaseInfo` INNER JOIN `M_SystemStatus` ON `T_CaseInfo.SystemStatusID = M_SystemStatus.SystemStatusID`
*   **ソート順 (ORDER BY):** 納期 (`DueDate`) の昇順 (超過日数が大きい順)。
*   **備考/特記事項:** 「完了を示すステータス」の具体的な定義（例: `M_SystemStatus.SystemStatusName` の値）が必要。

---

#### 4.10.2. Q_GetUserTaskAbilities (ユーザー対応可能タスク取得クエリ)

*   **目的/用途:** 特定のユーザー (`paramUserID`) が対応可能なタスク（工程）のリストを、工程名と共に取得する。タスク割り当てや権限管理の参考に利用。
*   **種類:** 選択クエリ
*   **主要テーブル:** `M_UserTaskAbility` INNER JOIN `M_ProcessDefinition`
*   **主要フィールド:** `M_ProcessDefinition.ProcessDefinitionID`, `M_ProcessDefinition.ProcessName`, `M_UserTaskAbility.SkillLevel`
*   **抽出条件 (WHERE句):** `M_UserTaskAbility.UserID = [userID]`
*   **結合条件 (JOIN):** `M_UserTaskAbility` INNER JOIN `M_ProcessDefinition` ON `M_UserTaskAbility.ProcessDefinitionID = M_ProcessDefinition.ProcessDefinitionID`
*   **ソート順 (ORDER BY):** 工程名 (`ProcessName`) の昇順。
*   **パラメータ:** `userID` (対象ユーザーのID)

---