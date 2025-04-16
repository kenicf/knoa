# 設計原則とパターン (VBA版)

このドキュメントでは、Excel/Access VBAを用いたプロジェクト全体で採用する主要な設計原則とデザインパターンについて説明します。一貫性のある、保守しやすく、拡張性の高いコードベースを維持するために、これらの原則に従ってください。

## 1. クラスベース設計 (VBA版)

* **原則:** 関連するデータ（状態）とロジック（操作）をカプセル化するために、クラスモジュールを用いたオブジェクト指向設計を採用します。
* **指針:**
    * **単一責任の原則 (SRP):** 各クラスモジュールは、明確に定義された単一の責務を持つべきです。例えば、`CustomerDataHandler` は顧客データの読み書きに責任を持ち、`FileExporter` はデータのエクスポート処理に責任を持ちます。
    * **初期化:** クラスの初期化は `Class_Initialize` イベントで行いますが、このイベントは引数を取れません。そのため、依存関係の注入や複雑な初期化は、専用のパブリックな初期化メソッド（例: `Initialize`, `Setup`）や `Property Let/Set` を通じて行うことを推奨します。
    * **メソッド (`Sub`/`Function`):** クラスの責務に関連する具体的な操作を提供します。メソッド名は、その操作内容を明確に示す動詞から始めることが推奨されます ([コーディング規約 (VBA版)](coding-standards-vba.md) 参照、例: `LoadCustomerData`, `ValidateInput`)。メソッドの粒度は適切に保ち、一つのメソッドが多くのことをしすぎないようにします。
    * **状態管理:** クラスの状態（内部データ）は、`Private` 変数として宣言し、外部からのアクセスは `Property Get`/`Property Let`/`Property Set` を通じて制御します。これにより、データのカプセル化と整合性維持を図ります。

* **例:**
    ```vba
    ' --- Class Module: Customer ---
    Option Explicit

    Private m_customerId As Long
    Private m_customerName As String
    Private m_emailAddress As String
    Private m_isValid As Boolean ' 内部状態

    ' Property Get/Let で外部からのアクセスを提供 (読み取り専用プロパティの例)
    Public Property Get CustomerId() As Long
        CustomerId = m_customerId
    End Property

    ' Property Get/Let で外部からのアクセスを提供 (読み書き可能プロパティの例)
    Public Property Get CustomerName() As String
        CustomerName = m_customerName
    End Property
    Public Property Let CustomerName(ByVal value As String)
        m_customerName = value
        ' 必要に応じてバリデーションや状態更新
        Validate ' 例: 名前変更時にバリデーション実行
    End Property

    Public Property Get EmailAddress() As String
        EmailAddress = m_emailAddress
    End Property
    Public Property Let EmailAddress(ByVal value As String)
        m_emailAddress = value
        Validate ' 例: メールアドレス変更時にバリデーション実行
    End Property

    ' 読み取り専用の内部状態
    Public Property Get IsValid() As Boolean
        IsValid = m_isValid
    End Property

    ' 初期化メソッド (Initialize は引数を取れないため)
    Public Sub LoadData(ByVal id As Long, ByVal name As String, ByVal email As String)
        m_customerId = id
        m_customerName = name
        m_emailAddress = email
        Validate ' 初期ロード時にもバリデーション
    End Sub

    ' クラスの責務に関連するメソッド
    Public Sub Validate()
        ' 顧客データのバリデーションロジック
        m_isValid = False ' デフォルトは False
        If m_customerId > 0 And Len(Trim(m_customerName)) > 0 And InStr(m_emailAddress, "@") > 0 Then
            m_isValid = True
        End If
        ' 必要なら RaiseEvent などで状態変更を通知
    End Sub

    ' Class_Initialize での基本的な初期化 (引数は取れない)
    Private Sub Class_Initialize()
        ' プロパティのデフォルト値設定など
        m_isValid = False
        m_customerId = -1 ' 未設定を示す値など
    End Sub

    Private Sub Class_Terminate()
        ' 必要に応じてリソース解放処理
    End Sub
    ```

## 2. 依存性注入 (DI) (VBA版)

* **原則:** クラスモジュール間の依存関係を疎結合にし、**テスト容易性**と再利用性を高めるために、依存性注入 (Dependency Injection) パターンを採用します。VBAでは主に手動DIを行います。
* **方法:**
    * **プロパティインジェクション (`Property Set`):** 依存オブジェクトを `Public Property Set` を通じて外部から設定します。これがVBAでは最も一般的で柔軟な方法です。
    * **メソッドインジェクション:** 依存オブジェクトを必要とするメソッドの引数として渡します。そのメソッド内でのみ依存関係が必要な場合に適しています。
    * **(非推奨) コンストラクタインジェクション:** `Class_Initialize` は引数を取れないため、VBAでは直接的なコンストラクタインジェクションはできません。
    * **初期化メソッド:** 複数の依存関係をまとめて設定するための `Public Sub Initialize(...)` のようなメソッドを用意する方法もあります。
* **利点:**
    * **テスト容易性:** **DI の最大の利点の一つです。** テスト時に、実際の依存オブジェクト（例: データベースアクセス用クラス、ファイル書き込みクラス）の代わりに、テスト用のモックオブジェクト（ダミーのオブジェクト）を容易に注入できます。これにより、テスト対象のクラスを隔離し、外部要因に影響されずにその動作を検証できます ([テスト戦略とガイドライン (VBA版)](testing-guidelines-vba.md) 参照)。
    * **再利用性:** クラスが特定の依存実装に結合しないため、異なるコンテキストで再利用しやすくなります。
    * **保守性:** 依存関係が明確になり、コードの理解と変更が容易になります。
* **Do (プロパティインジェクション):**
    ```vba
    ' --- Class Module: OrderProcessor ---
    Option Explicit

    Private m_logger As FileLogger ' 具象クラスに依存 (またはインターフェース的なクラス)
    Private m_dbHandler As CustomerDatabase ' 具象クラスに依存

    ' 依存オブジェクトを Property Set で注入
    Public Property Set Logger(ByVal value As FileLogger)
        Set m_logger = value
    End Property

    Public Property Set DatabaseHandler(ByVal value As CustomerDatabase)
        Set m_dbHandler = value
    End Property

    ' 依存オブジェクトが設定されているかチェックするメソッド (任意)
    Private Function CheckDependencies() As Boolean
        CheckDependencies = True
        If m_logger Is Nothing Then
            Err.Raise vbObjectError + 513, "OrderProcessor", "Logger が設定されていません。"
            CheckDependencies = False
            Exit Function
        End If
        If m_dbHandler Is Nothing Then
            Err.Raise vbObjectError + 514, "OrderProcessor", "DatabaseHandler が設定されていません。"
            CheckDependencies = False
            Exit Function
        End If
    End Function

    Public Sub ProcessOrder(ByVal orderId As Long)
        On Error GoTo ErrorHandler
        ' 依存関係のチェック
        If Not CheckDependencies() Then Exit Sub

        m_logger.Log "注文処理を開始: " & orderId

        Dim customerName As String
        customerName = m_dbHandler.GetCustomerNameByOrderId(orderId)

        ' ... 注文処理ロジック ...
        m_logger.Log "注文処理を完了: " & orderId

    Exit Sub
    ErrorHandler:
        If Not m_logger Is Nothing Then ' Loggerが利用可能ならエラーをログ記録
            m_logger.LogError Err.Number, Err.Description, "OrderProcessor.ProcessOrder"
        Else
            MsgBox "OrderProcessor でエラーが発生しました: " & Err.Description, vbCritical
        End If
        ' 必要に応じてエラーを再スロー: Err.Raise Err.Number, Err.Source, Err.Description
    End Sub

    ' --- 利用側の標準モジュール ---
    Sub Main()
        ' 依存オブジェクトのインスタンスを作成
        Dim logger As New FileLogger
        logger.LogFilePath = "C:\AppLogs\order_log.txt" ' 設定

        Dim dbHandler As New CustomerDatabase
        dbHandler.ConnectionString = "Provider=Microsoft.ACE.OLEDB.12.0;Data Source=C:\Data\Orders.accdb;" ' 設定

        ' OrderProcessor を作成し、依存性を注入
        Dim processor As New OrderProcessor
        Set processor.Logger = logger
        Set processor.DatabaseHandler = dbHandler

        ' 処理を実行
        processor.ProcessOrder 101

        ' オブジェクト解放
        Set processor = Nothing
        Set dbHandler = Nothing
        Set logger = Nothing
    End Sub

    ' --- テスト時の標準モジュール (例) ---
    Sub Test_OrderProcessor_Success()
        ' モックオブジェクト (またはテスト用スタブクラス) を作成
        Dim mockLogger As New MockLogger ' テスト用ロガークラス (別途定義)
        Dim mockDb As New MockCustomerDatabase ' テスト用DBクラス (別途定義)
        ' モックDBの振る舞いを設定 (例)
        mockDb.SetExpectedCustomerName "テスト顧客"

        ' テスト対象を作成し、モックを注入
        Dim processor As New OrderProcessor
        Set processor.Logger = mockLogger ' モックを注入
        Set processor.DatabaseHandler = mockDb ' モックを注入

        ' 実行
        processor.ProcessOrder 101

        ' 検証 (例)
        Debug.Assert mockLogger.LogCount > 0 ' ログが記録されたか
        Debug.Assert mockDb.GetCustomerNameCallCount = 1 ' DBメソッドが呼ばれたか

        Set processor = Nothing
        Set mockDb = Nothing
        Set mockLogger = Nothing
    End Sub
    ```
* **Don't:**
    * クラスモジュール内部で、依存する別のクラスモジュールを直接 `New` キーワードで生成する。
    * グローバル変数や `Public` な標準モジュール変数を通じて依存オブジェクトにアクセスする（テストや再利用が困難になるため）。

* **関連ガイドライン:**
    * テスト容易性の詳細については、[テスト戦略とガイドライン (VBA版)](testing-guidelines-vba.md) を参照してください。

## 3. エラーハンドリング戦略 (VBA版)

* **原則:** エラーは早期に検出し、明確な情報とともに処理します。エラー処理の一貫性を保ち、デバッグを容易にし、予期せぬプログラム停止を防ぎます。
* **方法:**
    * **`On Error GoTo Label`:** エラーが発生する可能性のあるプロシージャの冒頭で、エラーハンドリング用のラベルへジャンプするように設定します。これが VBA の基本的なエラー処理構造です。
    * **エラーハンドラ (`ErrorHandler:`):** プロシージャの末尾（`Exit Sub`/`Exit Function` の直前）にエラーハンドリング用のラベルを配置し、エラー発生時の処理（ログ記録、ユーザーへのメッセージ表示、デフォルト値の設定、リソース解放など）を記述します。
    * **クリーンアップ処理 (`CleanExit:`):** エラー発生の有無に関わらず実行すべきリソース解放処理（ファイルクローズ、オブジェクト変数の `Set Nothing` など）は、正常終了パスとエラーハンドラの両方からジャンプできる共通のラベルにまとめるのが一般的です (`GoTo CleanExit` / `Resume CleanExit`)。
    * **`Err` オブジェクト:** エラーハンドラ内では `Err` オブジェクトのプロパティ (`Number`, `Description`, `Source`) を参照して、発生したエラーの詳細情報を取得します。
    * **カスタムエラー (`Err.Raise`):** 特定の業務ルール違反や予期されるエラー条件が発生した場合、`Err.Raise` を使用して意図的にエラーを発生させます。カスタムエラー番号として `vbObjectError + N` (N は 513 以上の整数) を使用することを推奨します。エラー発生源 (`Source`) と説明 (`Description`) も明確に指定します。
    * **`Err.Clear`:** 通常、`Exit Sub`/`Exit Function`/`End Sub`/`End Function` や `Resume` でエラー状態はクリアされます。エラーハンドラ内でエラー情報を処理した後、プログラムの実行を継続する場合など、明示的にエラー状態をリセットしたい場合に `Err.Clear` を使用します（使用は限定的）。
    * **`Resume` / `Resume Next`:** エラーハンドラから処理を復帰させるために使用します。
        * `Resume`: エラーが発生したステートメントに処理を戻します。エラーの原因を解消した後に再試行する場合などに使用しますが、無限ループに注意が必要です。
        * `Resume Next`: エラーが発生したステートメントの**次の**ステートメントに処理を移します。**使用は、エラーが発生しても後続の処理に影響がないことが明確な場合に限定**し、非常に慎重に行う必要があります。安易な使用はバグの原因となります。
    * **`On Error Resume Next` の限定的な使用:** ファイルやオブジェクトの存在確認など、エラーが発生しても問題なく、かつそのエラーを無視したい**特定の箇所でのみ、必要最小限の範囲**で使用します。使用後は**必ず `Err` オブジェクトをチェック**し、予期せぬエラーでないことを確認するか、直後に `On Error GoTo 0` または `On Error GoTo Label` でエラー処理を元に戻します。**プロシージャ全体を `On Error Resume Next` にすることは絶対に避けてください。** ([コーディング規約 (VBA版)](coding-standards-vba.md) 参照)
    * **エラーログ:** エラーハンドラ内では、`Err` オブジェクトの情報や関連するコンテキスト情報（引数、処理中のデータなど）をログファイルやイベントログ、デバッグウィンドウに出力することを強く推奨します。これにより、問題発生後の原因調査が格段に容易になります。

* **Do:**
    ```vba
    Public Function GetCustomerName(ByVal customerId As Long) As String
        ' 関数: 顧客IDから顧客名を取得する

        On Error GoTo ErrorHandler ' エラーハンドラを設定

        Dim db As DAO.Database
        Dim rs As DAO.Recordset
        Dim sql As String
        Dim resultName As String
        resultName = "" ' 初期値

        ' --- 事前チェック ---
        If customerId <= 0 Then
            ' 意図的にカスタムエラーを発生させる
            Err.Raise vbObjectError + 1001, "GetCustomerName", "無効な顧客IDです: " & customerId
        End If

        ' --- DBアクセス処理 ---
        Set db = CurrentDb ' Accessの場合 (Excelなら適切な接続処理)
        sql = "SELECT CustomerName FROM Customers WHERE CustomerID = " & customerId
        Set rs = db.OpenRecordset(sql, dbOpenSnapshot) ' 読み取り専用

        If Not rs.EOF Then
            resultName = rs!CustomerName & "" ' Null対策
        Else
            ' データが見つからない場合もエラーとする例 (要件による)
            Err.Raise vbObjectError + 1002, "GetCustomerName", "顧客IDが見つかりません: " & customerId
        End If

        GetCustomerName = resultName ' 戻り値を設定

    CleanExit: ' 正常終了、エラー発生時共通のクリーンアップ
        On Error Resume Next ' クリーンアップ中のエラーは基本的に無視
        If Not rs Is Nothing Then
            If rs.State = adStateOpen Then rs.Close
            Set rs = Nothing
        End If
        If Not db Is Nothing Then
            ' Access の CurrentDb は通常 Close 不要
            Set db = Nothing
        End If
        On Error GoTo 0 ' VBA標準のエラー処理に戻す
        Exit Function ' 関数を抜ける

    ErrorHandler: ' エラー発生時の処理
        ' エラーログを出力 (別途 LogError 関数を実装推奨)
        LogError Err.Number, Err.Description, "GetCustomerName", "CustomerID=" & customerId

        ' 呼び出し元にエラーを通知するか、デフォルト値を返すかなどを決定
        GetCustomerName = "" ' エラー時は空文字を返す例
        ' または MsgBox "エラー: " & Err.Description, vbCritical
        ' または Err.Raise ... ' エラーを再スローして呼び出し元に処理を委ねる

        Resume CleanExit ' クリーンアップ処理へジャンプ
    End Function

    ' --- エラーログ記録関数の例 (標準モジュールに実装) ---
    Public Sub LogError(num As Long, desc As String, sourceProc As String, Optional context As String = "")
        ' 実際にはファイルやDBへの書き込みを行う
        Debug.Print Now(); " Error:"; num; "; Desc:"; desc; "; Source:"; sourceProc; "; Context:"; context
    End Sub
    ```
* **Don't:**
    * エラー処理を全く記述しない (`On Error` 文がない)。
    * プロシージャ全体で安易に `On Error Resume Next` を使用し、エラーチェックを行わない。
    * エラーハンドラで `Err` オブジェクトの情報を確認せずに処理を終える。
    * オブジェクト変数 (`Recordset`, `Connection`, `FileSystemObject` など) の解放処理 (`Set obj = Nothing`) を忘れる (特にエラーハンドリングパスで)。

## 4. イベント駆動アーキテクチャ (VBA版)

* **原則:** コンポーネント（フォーム、クラスモジュールなど）間の関心を分離し、疎結合なシステムを構築するためにイベント駆動アプローチを**限定的に**採用します。VBA におけるイベント駆動は、主に UI 操作への応答や、特定のクラスモジュール間での通知に使用されます。
* **基本的なイベント:**
    * **フォーム/レポート/コントロールイベント:** `Click`, `Change`, `BeforeUpdate`, `AfterUpdate`, `Load`, `Open`, `Close` など、組み込みのイベントプロシージャは VBA における最も基本的なイベント駆動です。イベントプロシージャ内では、関連するロジックを直接記述するのではなく、他の標準モジュールやクラスモジュールのメソッドを呼び出すようにし、イベントプロシージャ自体はシンプルに保ちます ([AI開発者向けガイド (VBA版)](ai-developer-guide-vba.md) のアンチパターン参照)。
* **カスタムイベント (クラスモジュール間):**
    * `Event` キーワード: クラスモジュール内でカスタムイベントを宣言します。
    * `RaiseEvent` ステートメント: クラスモジュール内で、特定の条件が満たされたときに宣言したイベントを発生させます。
    * `WithEvents` キーワード: 別のモジュール（通常はフォームモジュールや他のクラスモジュール）で、イベントを発生させるクラスのインスタンス変数を `WithEvents` 付きで宣言します。これにより、そのインスタンスが発生させるイベントを捕捉できるようになります。
    * **イベントハンドラ:** `WithEvents` で宣言した変数を使って、`Private Sub variableName_EventName(...)` という形式のイベントハンドラプロシージャを記述します。
* **利点:**
    * **疎結合:** イベント発行元のクラスは、イベント受信側のクラスを直接知る必要がありません。受信側は、必要なイベントを購読するだけです。
    * **拡張性:** 新しいイベントリスナー（受信側）を追加しても、発行元のクラスを変更する必要はありません。
* **Do (カスタムイベントの例):**
    ```vba
    ' --- Class Module: clsDataProcessor ---
    Option Explicit

    ' イベントを宣言 (進捗状況を通知する例)
    Public Event ProgressUpdated(ByVal percentage As Integer, ByVal message As String)
    Public Event ProcessingComplete(ByVal success As Boolean)

    Public Sub StartProcessing(ByVal itemCount As Long)
        Dim i As Long
        Dim pct As Integer

        On Error GoTo ErrorHandler

        For i = 1 To itemCount
            ' ... 何らかの重い処理 ...
            DoEvents ' UIの応答性を保つ (注意して使用)

            ' 進捗を通知
            pct = CInt((i / itemCount) * 100)
            If i Mod 10 = 0 Or i = itemCount Then ' 10回ごと、または最後に通知
                RaiseEvent ProgressUpdated(pct, "項目 " & i & "/" & itemCount & " を処理中...")
            End If
        Next i

        ' 完了を通知
        RaiseEvent ProcessingComplete(True)

    Exit Sub
    ErrorHandler:
        ' エラー発生時も完了イベントを発行 (失敗として)
        RaiseEvent ProcessingComplete(False)
        LogError Err.Number, Err.Description, "clsDataProcessor.StartProcessing"
    End Sub

    ' --- Form Module: frmMain ---
    Option Explicit

    ' イベントを発行するクラスのインスタンスを WithEvents で宣言
    Private WithEvents m_processor As clsDataProcessor
    Private m_progressBar As ProgressBar ' プログレスバーコントロール (仮)
    Private m_statusLabel As Label ' ステータスラベル (仮)

    Private Sub Form_Load()
        ' クラスのインスタンスを作成
        Set m_processor = New clsDataProcessor
        ' コントロールの参照を設定 (仮)
        ' Set m_progressBar = Me.ctlProgressBar
        ' Set m_statusLabel = Me.lblStatus
    End Sub

    Private Sub btnStart_Click()
        ' 処理を開始
        m_processor.StartProcessing 1000 ' 1000項目処理する例
        Me.btnStart.Enabled = False ' 処理中はボタンを無効化
    End Sub

    ' イベントハンドラ: ProgressUpdated イベントを捕捉
    Private Sub m_processor_ProgressUpdated(ByVal percentage As Integer, ByVal message As String)
        ' プログレスバーとラベルを更新
        ' m_progressBar.Value = percentage
        ' m_statusLabel.Caption = message
        DoEvents ' UIを更新
    End Sub

    ' イベントハンドラ: ProcessingComplete イベントを捕捉
    Private Sub m_processor_ProcessingComplete(ByVal success As Boolean)
        If success Then
            MsgBox "処理が完了しました。"
            ' m_statusLabel.Caption = "完了"
        Else
            MsgBox "処理中にエラーが発生しました。", vbCritical
            ' m_statusLabel.Caption = "エラー発生"
        End If
        Me.btnStart.Enabled = True ' ボタンを再度有効化
    End Sub

    Private Sub Form_Unload(Cancel As Integer)
        ' フォームが閉じられるときにオブジェクトを解放
        Set m_processor = Nothing
    End Sub
    ```
* **Don't:**
    * フォームモジュールやクラスモジュール間で、互いの内部メソッドを直接呼び出して密結合にする（イベントで代替できる場合）。
    * `DoEvents` をループ内で過剰に使用する（パフォーマンス低下や予期せぬ副作用の原因になる可能性があるため、必要最小限にする）。

## 5. 長時間処理に関する考慮事項 (VBA版)

* **原則:** VBA はシングルスレッドで動作するため、時間のかかる処理（大量のデータ処理、複雑な計算、外部データソースへのアクセスなど）を実行すると、UI がフリーズ（応答なし）することがあります。ユーザー体験を損なわないように配慮が必要です。
* **対策:**
    * **`DoEvents` の限定的な使用:** ループ内などで `DoEvents` を呼び出すと、Windows に処理を明け渡し、UI の再描画や他のイベント処理が可能になります。しかし、`DoEvents` は予期せぬ再入可能性（処理中にユーザーが別のボタンをクリックするなど）を生む可能性があり、デバッグを困難にするため、**使用は必要最小限に留め、影響を十分に理解した上で慎重に使用**してください。
    * **進捗状況の表示:** 処理が長時間にわたる場合は、ステータスバー、フォーム上のラベル、プログレスバーコントロールなどを使用して、ユーザーに進捗状況を視覚的にフィードバックします。`RaiseEvent` を使って進捗を通知するのも有効です ([イベント駆動アーキテクチャ (VBA版)](#4-イベント駆動アーキテクチャ-vba版) の例参照)。
    * **処理の最適化:** ループ処理の見直し、アルゴリズムの改善、データベースクエリの最適化など、処理自体の実行時間を短縮できないか検討します。Excel の場合、`Application.ScreenUpdating = False`, `Application.Calculation = xlCalculationManual`, `Application.EnableEvents = False` を適切に使用することで、パフォーマンスが大幅に改善することがあります ([コーディング規約 (VBA版)](coding-standards-vba.md) 参照)。
    * **ユーザーへの通知:** 処理開始前に「処理に時間がかかる場合があります」といったメッセージを表示したり、処理完了後に通知メッセージを表示したりします。
    * **(高度) 外部プロセスへの委譲:** 非常に重い処理は、VBScript や .NET アプリケーションなどを外部プロセスとして呼び出し、バックグラウンドで実行させる方法もありますが、実装は複雑になります。

* **注意点:** VBA には `async/await` のような組み込みの非同期処理メカニズムはありません。UI の応答性を維持するための工夫が重要になります。
