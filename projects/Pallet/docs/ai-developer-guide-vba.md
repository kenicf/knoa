# AI開発者向けガイド (VBA版)

このドキュメントは、AI（大規模言語モデルなど）をExcel/Access VBAを用いた開発プロセスに活用する際のガイドラインと注意点を提供します。AIの効果を最大化し、同時にコードの品質と一貫性を維持することを目的とします。

## 1. AI利用時の注意点とコツ

* **明確なコンテキストの提供:**
    * AIにコード生成やリファクタリングを依頼する際は、関連するモジュールやクラスモジュールの内容、既存のコードスニペット、対象となるExcel/Accessのバージョン、参照設定、および参照すべきドキュメント（特に [コーディング規約 (VBA版)](coding-standards-vba.md)、[設計原則とパターン (VBA版)](design-principles-vba.md)）を明確に指示してください。
    * **VBA特有のコンテキスト:** 使用するOfficeアプリケーション (Excel/Access)、関連するワークシート/テーブル/フォーム/レポートの構造、利用するActiveXコントロールなども重要なコンテキストです。
    * 曖昧な指示（例: 「このプロシージャを改善して」）ではなく、具体的な要件（例: 「`Customer` クラスモジュールに `DeleteCustomer` メソッドを追加し、[設計原則 (VBA版)](design-principles-vba.md) のエラーハンドリング戦略に従ってエラー処理を実装してください。顧客IDが見つからない場合は `Err.Raise` でカスタムエラーを発生させてください」）を与えてください。
* **段階的な指示:**
    * 一度に大規模な変更や複雑な機能全体の実装を指示するのではなく、タスクをより小さな、管理可能なステップ（例: 特定の関数の実装、エラー処理の追加、特定条件の分岐処理）に分割して依頼してください。
    * 各ステップの完了後に結果を確認し、必要に応じてフィードバックを与えながら進めることで、手戻りを減らすことができます。
* **生成されたコードのレビュー:**
    * AIが生成したコードは**必ず人間がレビュー**してください。VBE (Visual Basic Editor) 上で実際に動作させ、デバッグ機能（ブレークポイント、ステップ実行、ウォッチ式、イミディエイトウィンドウ）を活用して検証します。
    * [コーディング規約 (VBA版)](coding-standards-vba.md) および [設計原則とパターン (VBA版)](design-principles-vba.md) に準拠しているか確認します。
    * **VBA特有のレビュー観点:**
        * `Option Explicit` がモジュール先頭に記述されているか。
        * 変数が適切なスコープ（`Dim`, `Private`, `Public`）で宣言され、意図しないグローバル変数が使用されていないか。
        * 適切なエラーハンドリング (`On Error GoTo Label`, `Err`オブジェクトのチェック, `Err.Clear`) が実装されているか。`On Error Resume Next` が限定的かつ適切に使用されているか。
        * オブジェクト変数（特にADO、DAO、Excel/Accessオブジェクト）が適切に解放 (`Set obj = Nothing`) されているか。
        * ループ処理が効率的か、無限ループの可能性はないか。
        * マジックナンバーやハードコーディングされた文字列がないか (定数や設定シート/テーブルを利用しているか)。
        * Officeオブジェクトモデルの操作が適切か（例: `ScreenUpdating`, `EnableEvents`, `Calculation` の制御）。
    * ロジックが正しいか、エッジケース（例: 空のデータ、予期せぬユーザー入力）が考慮されているか、セキュリティ上の問題がないかを確認します。
    * 不適切なパターン（下記のアンチパターン集を参照）が含まれていないかを確認します。
* **テストコードの活用 (またはテスト容易な設計の依頼):**
    * VBAには標準的な単体テストフレームワークがありませんが、テストの重要性は変わりません。AIに機能コードの生成を依頼する際は、**テスト容易性を考慮した設計**にするよう指示してください（例: 「この処理をクラスモジュールに分離し、依存するオブジェクトを引数で受け取れるようにしてください」）。
    * 可能であれば、テストツール（例: [Rubberduck VBA](http://rubberduckvba.com/)）を使用したテストコードの生成を依頼することも検討できます。その際は、[テスト戦略とガイドライン (VBA版)](testing-guidelines-vba.md) に記載されているFIRST原則やAAAパターンを意識したテストコードを生成するように指示してください。(例: 「`Customer` クラスの `IsValidEmail` メソッドに対する単体テストを、AAAパターンに従って作成してください。正常系（有効なメールアドレス）と異常系（無効なメールアドレス、空文字列）をテストしてください。」)
    * 生成されたテストコードを実行し、テストがパスすることを確認します。テストがない場合は、手動テストやデバッグを通じて動作を十分に検証します。
* **具体的なフィードバック:**
    * AIの出力が期待通りでない場合、「うまくいかない」と言うだけでなく、具体的にどの部分がどのように問題なのか（エラーメッセージ、期待と異なる動作、規約違反箇所）、どのように修正してほしいのかを明確にフィードバックしてください。
    * 良いコード例、悪いコード例を提示することも効果的です。

## 2. アンチパターン集 (AIが生成しがちなVBAコードの例)

AIは効率的にコードを生成できますが、プロジェクト固有の規約やVBAのベストプラクティスから逸脱することもあります。以下は特に注意すべきアンチパターンとその修正例です。

* **不適切なエラーハンドリング:**
    * **悪い例:**
        ```vba
        ' エラーを完全に無視
        On Error Resume Next
        Dim value As Integer
        value = 1 / 0 ' エラー発生
        MsgBox "処理完了" ' エラーが発生しても実行されてしまう
        On Error GoTo 0 ' エラー処理を戻さない

        ' エラーが発生しても気づかない
        Sub ProcessData()
            On Error Resume Next
            Dim db As DAO.Database
            Dim rs As DAO.Recordset
            Set db = CurrentDb
            Set rs = db.OpenRecordset("SELECT * FROM NonExistentTable") ' エラー発生
            ' rs が Nothing のチェックなしに処理を続けようとする
            If Not rs.EOF Then
                ' ...
            End If
            rs.Close ' Nothing オブジェクトに対して Close しようとする
            Set rs = Nothing
            Set db = Nothing
            ' エラーが発生したことをハンドリングしていない
        End Sub
        ```
    * **良い例:**
        ```vba
        Sub ProcessData()
            On Error GoTo ErrorHandler ' エラーハンドラへジャンプ

            Dim db As DAO.Database
            Dim rs As DAO.Recordset
            Set db = CurrentDb

            ' 存在しないテーブルを開こうとする
            Set rs = db.OpenRecordset("SELECT * FROM NonExistentTable")

            If Not rs.EOF Then
                ' ... 正常系の処理 ...
            End If

        CleanExit: ' 正常終了時の処理
            On Error Resume Next ' クリーンアップ中のエラーは無視する場合もあるが注意
            If Not rs Is Nothing Then
                If rs.State = adStateOpen Then rs.Close
                Set rs = Nothing
            End If
            If Not db Is Nothing Then
                If db.Connections.Count > 0 Then db.Close ' Accessでは不要な場合も
                Set db = Nothing
            End If
            On Error GoTo 0 ' エラー処理をデフォルトに戻す
            Exit Sub

        ErrorHandler: ' エラー発生時の処理
            MsgBox "エラーが発生しました。" & vbCrLf & _
                   "エラー番号: " & Err.Number & vbCrLf & _
                   "エラー内容: " & Err.Description, vbCritical, "エラー"
            ' 必要に応じてエラーログを出力するなどの処理を追加
            ' Err.Clear ' 必要に応じてエラー情報をクリア (通常は Exit Sub/End Sub でクリアされる)
            Resume CleanExit ' クリーンアップ処理へジャンプ
        End Sub
        ```
    * **指針:** [設計原則とパターン (VBA版)](design-principles-vba.md) の「エラーハンドリング戦略」を参照してください。`On Error Resume Next` は必要最小限の範囲で使用し、使用後は必ず `Err` オブジェクトをチェックするか、`On Error GoTo 0` / `On Error GoTo Label` で元に戻します。
* **イベントプロシージャの肥大化:**
    * **悪い例:** ボタンクリックイベントなどに、データ検証、データアクセス、UI更新など、多くのロジックを詰め込む。
        ```vba
        Private Sub btnSave_Click()
            ' データ検証
            If Trim(Me.txtCustomerName.Value) = "" Then
                MsgBox "顧客名を入力してください。", vbExclamation
                Me.txtCustomerName.SetFocus
                Exit Sub
            End If
            If Not IsNumeric(Me.txtAge.Value) Then
                ' ... 他の検証 ...
            End If

            ' データアクセス
            Dim db As DAO.Database
            Dim rs As DAO.Recordset
            On Error Resume Next ' 安易なエラー無視
            Set db = CurrentDb
            Set rs = db.OpenRecordset("Customers", dbOpenDynaset)
            If Err.Number <> 0 Then Exit Sub ' 不十分なエラー処理
            rs.AddNew
            rs!CustomerName = Me.txtCustomerName.Value
            rs!Age = CInt(Me.txtAge.Value)
            ' ... 他のフィールド ...
            rs.Update
            If Err.Number <> 0 Then Exit Sub ' 不十分なエラー処理
            rs.Close
            Set rs = Nothing
            Set db = Nothing

            ' UI更新
            Me.lstCustomers.Requery
            MsgBox "保存しました。"
        End Sub
        ```
    * **良い例:** イベントプロシージャはUIイベントのハンドリングに徹し、ビジネスロジックやデータアクセスは別の標準モジュールやクラスモジュールに分離する。
        ```vba
        ' --- フォームモジュール ---
        Private Sub btnSave_Click()
            ' 入力値の取得とバリデーション呼び出し
            Dim customerData As Dictionary ' 例: Scripting.Dictionary
            Set customerData = GetFormData()
            If Not ValidateCustomerData(customerData) Then Exit Sub ' バリデーション関数を呼び出し

            ' 保存処理の呼び出し
            If SaveCustomer(customerData) Then ' 保存用関数を呼び出し
                Me.lstCustomers.Requery
                MsgBox "保存しました。"
            Else
                MsgBox "保存に失敗しました。", vbCritical
            End If
        End Sub

        Private Function GetFormData() As Dictionary
            ' フォームからデータを取得して Dictionary に格納する処理
        End Function

        ' --- 標準モジュール (例: CustomerLogic) ---
        Public Function ValidateCustomerData(data As Dictionary) As Boolean
            ' データ検証ロジック
            ValidateCustomerData = True ' 仮
        End Function

        Public Function SaveCustomer(data As Dictionary) As Boolean
            On Error GoTo ErrorHandler
            ' データアクセスロジック (DAO/ADO)
            SaveCustomer = True
        Exit Function
        ErrorHandler:
            LogError Err.Number, Err.Description, "SaveCustomer"
            SaveCustomer = False
        End Function
        ```
    * **指針:** [設計原則とパターン (VBA版)](design-principles-vba.md) の「クラスベース設計」「単一責任の原則」を参照してください。
* **依存関係のハードコーディング:**
    * **悪い例:** クラスモジュール内で、依存する別のクラスやオブジェクトを直接 `New` キーワードで生成したり、グローバル変数として参照したりする。
        ```vba
        ' --- Class Module: OrderProcessor ---
        Private logger As Logger ' グローバル変数やシングルトンへの依存 (例)
        Private dbHandler As New DatabaseHandler ' 内部で直接 New

        Private Sub Class_Initialize()
            Set logger = GlobalLoggerInstance ' グローバル参照
        End Sub

        Public Sub ProcessOrder(orderId As Long)
            logger.Log "Processing order: " & orderId
            dbHandler.Connect "some_connection_string" ' 接続文字列がハードコードされている可能性
            ' ... DB操作 ...
            dbHandler.Disconnect
        End Sub
        ```
    * **良い例:** 依存オブジェクトは、クラスの初期化時 (`Class_Initialize` は引数を取れないため、専用の初期化メソッドやプロパティ経由) やメソッドの引数で外部から注入する（手動DI）。
        ```vba
        ' --- Class Module: OrderProcessor ---
        Private m_logger As ILogger ' インターフェースを使用
        Private m_dbHandler As IDatabaseHandler ' インターフェースを使用

        ' 初期化メソッド (または Property Set) で依存性を注入
        Public Sub Initialize(logger As ILogger, dbHandler As IDatabaseHandler)
            Set m_logger = logger
            Set m_dbHandler = dbHandler
        End Sub

        Public Sub ProcessOrder(orderId As Long)
            If m_logger Is Nothing Or m_dbHandler Is Nothing Then
                Err.Raise vbObjectError + 513, "OrderProcessor", "Dependencies not initialized."
                Exit Sub
            End If
            m_logger.Log "Processing order: " & orderId
            m_dbHandler.Connect ' 接続情報は dbHandler 内部で管理 or 別途設定
            ' ... DB操作 ...
            m_dbHandler.Disconnect
        End Sub

        ' --- 利用側 ---
        Dim processor As New OrderProcessor
        Dim logger As New FileLogger ' 実装クラス
        Dim dbHandler As New AccessDatabaseHandler ' 実装クラス
        Set logger.LogFilePath = "C:\logs\app.log" ' 設定
        Set dbHandler.DatabasePath = CurrentProject.Path & "\mydb.accdb" ' 設定

        processor.Initialize logger, dbHandler ' 依存性を注入
        processor.ProcessOrder 123
        ```
    * **指針:** [設計原則とパターン (VBA版)](design-principles-vba.md) の「依存性注入 (DI)」を参照してください。これにより、テスト時にモックオブジェクトを注入しやすくなります。
* **オブジェクト変数の解放漏れ:**
    * **悪い例:** `Recordset`, `Connection`, `Excel.Application`, `Word.Document` などのオブジェクト変数を使い終わった後に `Set obj = Nothing` で解放しない。特にループ内で生成する場合、メモリリークやパフォーマンス低下の原因となる。
        ```vba
        Sub ProcessFiles()
            Dim fso As New FileSystemObject
            Dim ts As TextStream
            Dim folderPath As String
            Dim file As File
            folderPath = "C:\Data"

            For Each file In fso.GetFolder(folderPath).Files
                Set ts = file.OpenAsTextStream(ForReading) ' ループ内で生成
                ' ... ファイル処理 ...
                ts.Close
                ' Set ts = Nothing が抜けている
            Next file
            ' Set fso = Nothing も抜けている
        End Sub
        ```
    * **良い例:** オブジェクト変数のスコープを最小限にし、不要になったら速やかに `Set obj = Nothing` で解放する。エラーハンドリング内でも解放処理を行う (`Resume CleanExit` パターン)。
        ```vba
        Sub ProcessFiles()
            On Error GoTo ErrorHandler
            Dim fso As FileSystemObject ' New は使用時に行うか、明示的に Set
            Dim ts As TextStream
            Dim folderPath As String
            Dim file As File
            folderPath = "C:\Data"

            Set fso = New FileSystemObject

            For Each file In fso.GetFolder(folderPath).Files
                Set ts = file.OpenAsTextStream(ForReading)
                ' ... ファイル処理 ...
                ts.Close
                Set ts = Nothing ' ループ内で解放
            Next file

        CleanExit:
            On Error Resume Next
            Set ts = Nothing ' 念のため
            Set file = Nothing
            Set fso = Nothing
            On Error GoTo 0
            Exit Sub

        ErrorHandler:
            MsgBox "Error processing files: " & Err.Description, vbCritical
            Resume CleanExit
        End Sub
        ```
    * **指針:** [コーディング規約 (VBA版)](coding-standards-vba.md) を参照。
* **テスト不足/不適切なテスト:**
    * **悪い例:**
        * テストコードが全くない、または手動テストのみに依存している。
        * 正常系の簡単なケースしかテストしていない。エラーケースや境界値が考慮されていない。
        * テストが他のテストや外部環境（特定のファイル存在、DBの特定データ）に依存している (Independent/Repeatable 違反)。
        * テスト容易でないコード（UIへの直接アクセス、依存関係のハードコーディング）に対して、複雑で脆いテストを書こうとする（または諦める）。
    * **良い例:**
        * 可能な範囲でテストコードを作成する（例: Rubberduck VBA を利用）。
        * ロジック部分をクラスモジュールや標準モジュールに分離し、テスト容易性を高める。
        * エラーケース、境界値（0、最大値、空文字、Nullなど）を網羅的にテストする。
        * [テスト戦略とガイドライン (VBA版)](testing-guidelines-vba.md) の原則（FIRST、AAA）を意識する。
        * 手動テストを行う場合も、テストケースを事前に定義し、体系的に実施する。
    * **指針:** [テスト戦略とガイドライン (VBA版)](testing-guidelines-vba.md) を参照してください。
* **不必要な複雑化:** 過度な抽象化、複雑なデザインパターンの不適切な適用。
    * **指針:** シンプルさを保ち、必要になるまで複雑な解決策を導入しない (YAGNI - You Ain't Gonna Need It)。VBAでは特に、言語機能の制約から過度な抽象化が逆効果になることもあります。

## 3. ドキュメント活用法

AIにタスクを依頼する際は、以下のドキュメントを参照するように指示すると効果的です。

* **新しいクラス/関数/プロシージャを追加する場合:**
    * [コーディング規約 (VBA版)](coding-standards-vba.md)
    * [設計原則とパターン (VBA版)](design-principles-vba.md)
* **既存の共通モジュール/クラスを利用する場合:**
    * 該当するモジュール/クラスの利用ガイド（もしあれば）
    * [設計原則とパターン (VBA版)](design-principles-vba.md) (特に DI, エラー処理)
* **テストコードを作成/修正する場合 (またはテスト容易性を考慮したリファクタリング):**
    * [テスト戦略とガイドライン (VBA版)](testing-guidelines-vba.md) (**特に FIRST原則, AAAパターン, テスト容易性, モック戦略** のセクション)
    * [コーディング規約 (VBA版)](coding-standards-vba.md) (テストコードのスタイル)
* **リファクタリングを行う場合:**
    * 関連するすべてのガイドライン ([コーディング規約 (VBA版)](coding-standards-vba.md), [設計原則 (VBA版)](design-principles-vba.md), [テスト戦略 (VBA版)](testing-guidelines-vba.md))
    * 変更対象の共通モジュール/クラスの利用ガイド（もしあれば）
* **AIへの指示方法に迷った場合:**
    * この [AI開発者向けガイド (VBA版)](ai-developer-guide-vba.md)

これらのガイドラインを活用し、AIと協力して高品質なVBAアプリケーション開発を進めましょう。
