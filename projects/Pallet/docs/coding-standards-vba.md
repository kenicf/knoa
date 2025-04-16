# コーディング規約 (VBA版)

このドキュメントは、Excel/Access VBAを用いたプロジェクト全体で一貫したコードスタイルを維持するための規約を定義します。AI開発者を含むすべての開発者は、この規約に従ってコードを記述してください。

## 1. 命名規則

一貫性のある命名は、コードの可読性と保守性を大幅に向上させます。

* **変数:** `camelCase` を使用します。データ型を示すハンガリアン記法（例: `strUserName`, `intCount`）は**原則として使用しません**が、プロジェクトで統一されている場合はそれに従います。
    * 例: `userName`, `recordCount`, `targetWorkbook`
* **定数:** `UPPER_SNAKE_CASE` を使用します。
    * 例: `MAX_RECORDS`, `DEFAULT_SHEET_NAME`
* **プロシージャ (Sub/Function):** `PascalCase` を使用し、動詞から始めることが推奨されます。
    * 例: `CalculateTotal`, `GetUserRecord`, `OpenTargetFile`
* **モジュール/クラスモジュール:** `PascalCase` を使用し、その役割を示す名詞または名詞句にします。
    * 例: `CustomerData`, `FileHandler`, `ReportGenerator`
* **フォーム/レポート/コントロール:**
    * フォーム/レポート名: `PascalCase` またはプロジェクトの命名規則に従います (例: `frmCustomerInput`, `rptMonthlySales`)。
    * コントロール名: 一般的なプレフィックス（下記参照）を付け、その後に `PascalCase` で目的を示す名前を付けます。これにより、コード内でコントロールの種類を識別しやすくなります。
        * テキストボックス: `txt` (例: `txtUserName`)
        * ラベル: `lbl` (例: `lblStatusMessage`)
        * コマンドボタン: `cmd` または `btn` (例: `cmdProcessData`, `btnCancel`)
        * コンボボックス: `cbo` (例: `cboProductCategory`)
        * リストボックス: `lst` (例: `lstSelectedItems`)
        * チェックボックス: `chk` (例: `chkEnableLogging`)
        * オプションボタン/ラジオボタン: `opt` (例: `optPaymentMethod`)
        * イメージ: `img` (例: `imgLogo`)
        * サブフォーム/サブレポート: `sub` (例: `subOrderDetails`)
* **イベントプロシージャ:** VBEが自動生成する `コントロール名_イベント名` (例: `cmdOK_Click`, `Form_Load`) の形式に従います。
* **列挙型 (Enum):** `PascalCase` を使用し、プレフィックス `Enum` または `E` を付けることを推奨します (プロジェクトで統一)。メンバー名は `PascalCase` または `UPPER_SNAKE_CASE` を使用します (プロジェクトで統一)。
    * 例:
        ```vba
        Public Enum FileStatus
            fsNotFound
            fsOk
            fsAccessDenied
        End Enum
        ' または
        Public Enum EFileStatus
            FileNotFound
            FileOK
            AccessDenied
        End Enum
        ```
* **ユーザー定義型 (Type):** `PascalCase` を使用し、プレフィックス `Type` または `T` を付けることを推奨します (プロジェクトで統一)。メンバー名は `PascalCase` を使用します。
    * 例:
        ```vba
        Public Type TCustomer
            CustomerID As Long
            CustomerName As String
            LastOrderDate As Date
        End Type
        ```
* **引数:** プロシージャの引数名は `camelCase` を使用します。

## 2. フォーマット

VBEには自動フォーマット機能がないため、手動で一貫性を保つことが重要です。

* **インデント:** スペース 4つを使用します。タブ文字は使用しません（VBEの設定でタブ幅を4に設定し、「タブをスペースに変換」を有効にすることを推奨）。
* **スペース:**
    * 演算子 (`=`, `+`, `-`, `*`, `/`, `&`, `<`, `>`, `<>`, `<=`, `>=`, `And`, `Or`, `Xor` など) の前後にはスペースを入れます。
    * カンマ (`,`) の後にはスペースを入れます。
    * 括弧 `()` の内側には基本的にスペースを入れません (例: `MyFunction(arg1, arg2)`)。
* **行の継続:** 長い行は、アンダースコア (` _`) を使用して改行します。可読性を考慮し、論理的な区切りで改行します。アンダースコアの前にはスペースが必要です。
    * 例:
        ```vba
        Set rs = CurrentDb.OpenRecordset("SELECT CustomerID, CustomerName " & _
                                        "FROM Customers " & _
                                        "WHERE Prefecture = '" & pref & "' " & _
                                        "ORDER BY CustomerID")
        ```
* **大文字/小文字:**
    * VBAキーワード (`Dim`, `Sub`, `Function`, `If`, `Then`, `Else`, `End`, `For`, `Next`, `With` など) は VBE の自動整形に従い、通常は先頭が大文字になります (`PascalCase`)。
    * 変数名、プロシージャ名、定数名などは、宣言時の大文字/小文字を維持します。VBEは自動的に補完・修正しますが、宣言時の一貫性が重要です。
* **空行:** 論理的なコードブロック間には空行を入れて、可読性を高めます。
* **プロシージャの区切り:** 各プロシージャ (`Sub`, `Function`) の間には、区切り線コメントや複数の空行を入れて、視覚的に分離します。

## 3. コメント

コードの意図を明確にし、将来の自分や他の開発者が理解しやすくするためにコメントは不可欠です。

* **モジュール/クラスヘッダーコメント:** モジュールやクラスモジュールの先頭には、その目的、作成者、作成日、更新履歴などを記述します。
    ```vba
    '---------------------------------------------------------------------------------------
    ' Module    : CustomerLogic
    ' Author    : Your Name
    ' Date      : 2025-04-09
    ' Purpose   : Handles business logic related to customer data.
    ' Revision History:
    '   2025-04-10 - Your Name - Added ValidateCustomerData function.
    '---------------------------------------------------------------------------------------
    Option Explicit
    ```
* **プロシージャヘッダーコメント:** 各プロシージャ (`Sub`, `Function`) の直前には、その目的、引数、戻り値（Functionの場合）、特記事項などを記述します。
    ```vba
    '---------------------------------------------------------------------------------------
    ' Procedure : GetCustomerName
    ' Author    : Your Name
    ' Date      : 2025-04-09
    ' Purpose   : Retrieves the customer name based on the provided customer ID.
    ' Arguments : customerId (Long) - The ID of the customer to retrieve.
    ' Returns   : String - The name of the customer, or an empty string if not found.
    ' Notes     : Returns vbNullString if an error occurs during database access.
    '---------------------------------------------------------------------------------------
    Public Function GetCustomerName(ByVal customerId As Long) As String
        On Error GoTo ErrorHandler
        ' ... implementation ...
    GetCustomerName = customerName ' Assign return value

    Exit Function ' Normal exit

    ErrorHandler:
        LogError Err.Number, Err.Description, "GetCustomerName"
        GetCustomerName = vbNullString ' Return empty string on error
    End Function
    ```
* **インラインコメント:** 複雑なロジック、分かりにくい処理、重要な決定の理由などには、必要に応じてインラインコメント (`'`) を追加します。コメントは「何を」しているかではなく、「なぜ」そのようにしているかを説明するように心がけます。
    ```vba
    ' Calculate discount based on membership level (Gold members get 10%)
    If customerLevel = "Gold" Then
        discountRate = 0.1
    Else
        discountRate = 0.05 ' Standard discount
    End If
    ```
* **TODOコメント:**
    * 一時的な修正、未実装の機能、将来的な改善が必要な箇所には `TODO:` コメントを使用します。
    * フォーマット: `' TODO: [担当者名 or チケット番号] [日付 yyyy-mm-dd] 説明`
    * 例: `' TODO: [Roo] [2025-04-15] エラー発生時の詳細ログ出力処理を追加する`
    * TODOコメントは定期的にレビューし、対応または削除を行います。

## 4. 言語機能ガイドライン

VBAの機能を適切に使用し、堅牢で保守しやすいコードを作成するためのガイドラインです。

* **`Option Explicit` の強制:** **すべてのモジュールの先頭に `Option Explicit` を記述します。** これにより、宣言されていない変数の使用がコンパイルエラーとなり、タイプミスによるバグを防ぎます。VBEのオプションで「変数の宣言を強制する」を有効にしてください。
* **変数宣言:**
    * 変数は使用する直前、またはプロシージャの先頭で宣言します。
    * 常に `As Type` でデータ型を明示します。`Variant` 型は、意図的に使用する場合（例: 配列への一括代入、COMオブジェクトの戻り値）を除き、極力避けます。
    * スコープ (`Dim`, `Private`, `Public`, `Static`) を適切に使い分けます。モジュールレベル変数は `Private` を基本とし、必要最小限の範囲で `Public` を使用します。グローバル変数（Publicな標準モジュール変数）の使用は慎重に検討します。
        ```vba
        ' 良い例
        Dim counter As Integer
        Dim userName As String
        Private db As DAO.Database
        Public Const APP_VERSION As String = "1.0.0"

        ' 避けるべき例
        Dim x ' 型が不明 (Variantになる)
        Dim a, b, c As Integer ' a と b は Variant になる！ 正しくは Dim a As Integer, b As Integer, c As Integer
        ```
* **エラーハンドリング:**
    * **`On Error GoTo Label` を基本とする:** 予期せぬエラーでプログラムが停止することを防ぐため、エラーが発生する可能性のあるプロシージャには `On Error GoTo ErrorHandlerLabel` を記述します。
    * **エラーハンドラ:** プロシージャの末尾（`Exit Sub`/`Exit Function` の前）にエラーハンドリング用のラベル (`ErrorHandlerLabel:`) を設け、エラー発生時の処理（ログ記録、メッセージ表示、リソース解放など）を記述します。
    * **`Err` オブジェクトの活用:** エラーハンドラ内では `Err.Number`, `Err.Description`, `Err.Source` を参照してエラー情報を取得します。
    * **`Err.Raise`:** 特定の条件下で意図的にエラーを発生させる場合に使用します。カスタムエラー番号（`vbObjectError + N`）を使用することを推奨します。
    * **`Err.Clear`:** 通常、`Exit Sub`/`Exit Function`/`End Sub`/`End Function` または `Resume` でエラー状態はクリアされますが、エラーハンドラ内で処理を継続する場合など、明示的にエラー情報をクリアしたい場合に使用します。
    * **`Resume` / `Resume Next`:** エラーハンドラからの復帰に使用します。`Resume` はエラー発生行へ、`Resume Next` はエラー発生行の次の行へ処理を戻します。**`Resume Next` の使用は、エラー発生後も処理を続行できることが明確な場合に限定**し、慎重に行います。
    * **`On Error Resume Next` の限定的な使用:** ファイルやオブジェクトの存在確認など、エラーが発生しても問題なく、かつそのエラーを無視したい特定の箇所でのみ、**必要最小限の範囲**で使用します。使用後は**必ず `Err` オブジェクトをチェック**し、予期せぬエラーでないことを確認するか、直後に `On Error GoTo 0` または `On Error GoTo Label` でエラー処理を元に戻します。**プロシージャ全体を `On Error Resume Next` にすることは絶対に避けてください。**
    * **クリーンアップ処理:** エラー発生有無に関わらず実行すべきリソース解放処理（ファイルクローズ、オブジェクト解放など）は、正常終了パスとエラーハンドラの両方からジャンプできる共通のクリーンアップセクション (`CleanExit:`) にまとめるのが一般的です (GoTo CleanExit / Resume CleanExit)。
        ```vba
        Sub ProcessFile(ByVal filePath As String)
            On Error GoTo ErrorHandler
            Dim fso As Object ' Scripting.FileSystemObject
            Dim ts As Object  ' Scripting.TextStream
            Dim lineCounter As Long

            Set fso = CreateObject("Scripting.FileSystemObject")

            ' On Error Resume Next の限定的な使用例 (ファイル存在確認)
            On Error Resume Next
            Dim fileExists As Boolean
            fileExists = fso.FileExists(filePath)
            On Error GoTo ErrorHandler ' エラー処理を元に戻す

            If Not fileExists Then
                Err.Raise vbObjectError + 1001, "ProcessFile", "指定されたファイルが見つかりません: " & filePath
            End If

            Set ts = fso.OpenTextFile(filePath, 1) ' 1: ForReading

            Do While Not ts.AtEndOfStream
                Dim lineText As String
                lineText = ts.ReadLine
                ' ... process line ...
                lineCounter = lineCounter + 1
            Loop

        CleanExit: ' 正常終了時、エラー発生時共通のクリーンアップ
            On Error Resume Next ' クリーンアップ中のエラーは無視する場合が多い
            If Not ts Is Nothing Then
                If ts.AtEndOfStream = False Then ' 状態を確認できる場合
                   ts.Close
                End If
                Set ts = Nothing
            End If
            Set fso = Nothing
            On Error GoTo 0 ' デフォルトのエラー処理に戻す
            Exit Sub

        ErrorHandler:
            MsgBox "エラーが発生しました。" & vbCrLf & _
                   "エラー番号: " & Err.Number & vbCrLf & _
                   "エラー内容: " & Err.Description, vbCritical, "エラー"
            LogError Err.Number, Err.Description, "ProcessFile", "FilePath: " & filePath ' ログ記録関数 (別途実装)
            Resume CleanExit ' クリーンアップ処理へ
        End Sub
        ```
* **オブジェクト変数:**
    * オブジェクト変数は `Set` キーワードを使用して代入します。
    * 使用が終了したオブジェクト変数は、速やかに `Set objectVariable = Nothing` で解放します。特に、Excelアプリケーションオブジェクト、Wordオブジェクト、ADO/DAOオブジェクト、`FileSystemObject`、`Collection`、`Dictionary` などは明示的な解放が重要です。
    * ループ内でオブジェクトを生成・破棄する場合は、ループの各反復で適切に解放します。
    * エラーハンドリング内のクリーンアップ処理 (`CleanExit:`) でも解放漏れがないか確認します。
* **`With` ステートメント:** 同じオブジェクトに対して複数のプロパティ設定やメソッド呼び出しを行う場合は、`With` ステートメントを使用してコードを簡潔にし、パフォーマンスを向上させます。ネストは深くしすぎないように注意します。
    ```vba
    With Worksheets("Sheet1")
        .Range("A1").Value = "Name"
        .Range("B1").Value = "Value"
        .Range("A1:B1").Font.Bold = True
        .Columns("A:B").AutoFit
    End With
    ```
* **マジックナンバー/ハードコーディングされた文字列:**
    * コード内に直接記述された意味不明な数値（マジックナンバー）や文字列は避けます。
    * 意味のある名前を持つ定数 (`Const`) として定義するか、設定シートや設定テーブルから読み込むようにします。
    * 例:
        ```vba
        ' 悪い例
        If userType = 1 Then ' 1 が何を示すか不明
            price = price * 0.9 ' 0.9 が何を示すか不明
        End If
        Worksheets("売上データ").Range("A1").Value = "..." ' シート名が変更されたら動かない

        ' 良い例
        Const ADMIN_USER_TYPE As Integer = 1
        Const PREMIUM_DISCOUNT_RATE As Double = 0.9
        Const SALES_DATA_SHEET_NAME As String = "売上データ" ' または設定から取得

        If userType = ADMIN_USER_TYPE Then
            price = price * PREMIUM_DISCOUNT_RATE
        End If
        Worksheets(SALES_DATA_SHEET_NAME).Range("A1").Value = "..."
        ```
* **Office オブジェクトモデル:**
    * **パフォーマンス:** 大量のセル操作などを行う場合は、処理の開始前に `Application.ScreenUpdating = False`、`Application.EnableEvents = False`、`Application.Calculation = xlCalculationManual` を設定し、処理後に元に戻すことを検討します。
    * **オブジェクトの完全修飾:** `Range("A1")` のような修飾なしの参照は、アクティブなシートに依存するため、意図しない動作の原因となります。`ThisWorkbook.Worksheets("Sheet1").Range("A1")` のように、必ず親オブジェクト（Workbook, Worksheetなど）を明示的に修飾します。
    * **オブジェクトの解放:** Excel/Accessオブジェクト（`Workbook`, `Worksheet`, `Recordset` など）は使用後に適切に解放 (`Close`, `Set obj = Nothing`) します。
* **引数の渡し方 (`ByRef` / `ByVal`):**
    * 引数をプロシージャ内で変更する必要がない場合は、原則として `ByVal` を使用します。これにより、意図しない副作用を防ぎます。
    * プロシージャ内で引数の値を変更し、その変更を呼び出し元に反映させたい場合にのみ `ByRef` を使用します（`ByRef` は VBA のデフォルトですが、明示することを推奨）。
    * オブジェクト変数は常に参照渡しですが、`ByVal` を指定するとオブジェクトのコピーではなく参照のコピーが渡されます（挙動は `ByRef` と似ていますが、プロシージャ内で `Set obj = New AnotherObject` としても呼び出し元の変数は変わりません）。混乱を避けるため、オブジェクト引数も `ByVal` を基本とするか、プロジェクトで方針を統一します。
* **標準モジュールとクラスモジュール:**
    * 関連性の低い独立したユーティリティ関数や、アプリケーション全体で共有する定数などは標準モジュールに配置します。
    * 状態（データ）とその操作（メソッド）をカプセル化したい場合は、クラスモジュールを使用します（例: 顧客データとそれに関連する操作を持つ `Customer` クラス）。
    * [設計原則とパターン (VBA版)](design-principles-vba.md) の「クラスベース設計」も参照してください。

## 5. テストコード固有の規約 (概念)

VBAには標準的な単体テストフレームワークはありませんが、テスト容易性を意識したコーディングは重要です。

* **テスト容易な設計:**
    * **ロジックの分離:** UI操作（フォームイベントなど）とビジネスロジック（計算、データ処理）を分離します。ロジック部分は標準モジュールやクラスモジュール内の独立したプロシージャとして実装し、引数でデータを受け取り、戻り値で結果を返すようにします。これにより、UIに依存せずにロジック部分をテスト（デバッグ実行やイミディエイトウィンドウでの呼び出し）しやすくなります。
    * **依存関係の注入 (手動):** クラスモジュールが他のオブジェクト（例: データアクセス用クラス）に依存する場合、`Set MyProperty = object` のようなプロパティや初期化メソッド経由で外部から依存オブジェクトを渡せるように設計すると、テスト時にモックオブジェクト（ダミーのオブジェクト）を注入しやすくなります。（[設計原則とパターン (VBA版)](design-principles-vba.md) の「依存性注入」参照）
* **テスト用プロシージャ:**
    * 特定のプロシージャをテストするための `Sub` プロシージャを作成し、その中でテスト対象のプロシージャを様々な引数で呼び出し、結果を `Debug.Assert` や `Debug.Print` で検証する方法があります。
    * テストコードは専用のモジュール（例: `Test_ModuleName`）にまとめることを検討します。
* **AAAパターン (概念):** テスト用プロシージャを書く際に、Arrange (準備)、Act (実行)、Assert (検証) のステップを意識すると、テストの意図が明確になります。
    ```vba
    Sub Test_CalculateDiscount_GoldMember()
        ' Arrange (準備)
        Dim customerLevel As String
        Dim originalPrice As Currency
        Dim expectedDiscountedPrice As Currency
        customerLevel = "Gold"
        originalPrice = 1000
        expectedDiscountedPrice = 900 ' 10% discount

        ' Act (実行)
        Dim actualDiscountedPrice As Currency
        actualDiscountedPrice = CalculateDiscount(originalPrice, customerLevel) ' テスト対象関数

        ' Assert (検証)
        Debug.Assert actualDiscountedPrice = expectedDiscountedPrice ' 条件が False なら中断
        If actualDiscountedPrice <> expectedDiscountedPrice Then
            Debug.Print "Test Failed: Test_CalculateDiscount_GoldMember. Expected: " & expectedDiscountedPrice & ", Actual: " & actualDiscountedPrice
        Else
            Debug.Print "Test Passed: Test_CalculateDiscount_GoldMember"
        End If
    End Sub
    ```
* **ツールの活用:** [Rubberduck VBA](http://rubberduckvba.com/) などのアドインは、静的コード解析や限定的な単体テスト機能を提供しており、品質向上に役立つ場合があります。

これらの規約に従うことで、VBAプロジェクトのコード品質、可読性、保守性を高めることができます。AIにコード生成を依頼する際も、これらの規約を参照するように指示してください。
