# テスト戦略とガイドライン (VBA版)

このドキュメントは、Excel/Access VBAプロジェクトにおけるテストの記述方法、戦略、および利用可能なアプローチに関するガイドラインを提供します。高品質で保守性の高いコードベースを維持するために、これらのガイドラインに従ってください。VBAには最新のプログラミング言語のような高度なテストフレームワークはありませんが、テストの原則と考え方を適用することは依然として重要です。

## 1. テストの目的

* **リグレッション（デグレード）の防止:** コード変更によって既存の機能が意図せず壊れていないことを保証します。
* **仕様の明確化:** テストコード（またはテスト手順）は、コードがどのように動作すべきかの具体的なドキュメントとして機能します。
* **リファクタリングの安全性確保:** テストによって動作が保証されたコードは、安心してリファクタリング（内部構造の改善）を行えます。
* **設計の改善:** テスト容易性を考慮することで、より疎結合でモジュール化された、理解しやすい設計が促進されます。

## 2. テスト設計の原則 (FIRST原則 - VBA版)

良いテスト（特に自動化を目指す場合）は、以下の FIRST 原則を満たすことが理想です。VBAの文脈で解釈し、適用を目指します。

* **Fast (高速):** テストは可能な限り迅速に実行されるべきです。VBAのテスト（特に手動や半自動）はコンパイル言語ほど高速ではありませんが、個々のテストプロシージャは焦点を絞り、不要な依存（時間のかかるファイルアクセス、複雑なUI操作、DBへの大量アクセスなど）をテストコード自体に含めないようにします。テスト対象コード自体の最適化も重要です。
* **Independent (独立):** 各テストプロシージャ (`Sub Test_...`) は他のテストから独立しているべきです。テストの実行順序に依存したり、他のテストが残した状態（例: グローバル変数、特定のファイル）に影響されたりしてはいけません。必要であれば、各テストプロシージャの開始時に状態を初期化し、終了時にクリーンアップする処理（例: `Setup`, `Teardown` のようなヘルパーSub）を設けますが、シンプルに保つことが望ましいです。
* **Repeatable (反復可能):** テストはどの環境（開発者のPC、他の担当者のPC）でも、何度実行しても同じ結果になるべきです。外部環境の状態（特定のファイルの内容、DBの特定データ、現在時刻など）に依存するテストは避けます。テストデータは引数で渡すか、テストモジュール内の定数や `Setup` プロシージャで一貫して準備します。現在時刻に依存する場合は、時刻を引数で渡すか、テスト用に固定値を返す関数を用意するなどの工夫をします。
* **Self-Validating (自己検証可能):** テストは、その実行結果（成功または失敗）を自動的に判断できるべきです。テスト結果の解釈のために、複雑なログを目視確認したり、手動でファイルの内容を比較したりする必要があるテストは避けます。`Debug.Assert` を使用して期待される条件をコード内で検証します。`Debug.Assert` がFalseの場合、中断モードであればコードが停止するため、失敗を明確に検知できます。失敗時の詳細情報として `Debug.Print` を併用することも有効です。
* **Thorough (徹底的):** テストは、対象コードの重要な側面を網羅するべきです。正常系（期待される入力と出力）だけでなく、境界値（0、最大値/最小値、空文字列、Nullなど）、エラーケース（予期されるエラー条件）、エッジケース（稀な状況）もテストします。VBAではカバレッジ測定ツールはありませんが、`If/Then/Else`, `Select Case`, ループ、エラーハンドリングパスなどを意識的にテストすることが重要です。

## 3. テスト構造 (AAAパターン - VBA版)

テストコードの可読性と保守性を高めるために、Arrange-Act-Assert (AAA) パターンに従うことを強く推奨します。これは個々のテスト用 `Sub` プロシージャ内に適用します。

* **Arrange (準備):** テストに必要な前提条件や入力データを準備します。テスト対象オブジェクト（クラスインスタンス）の生成、依存関係のモックオブジェクトの設定、入力変数や定数の定義などが含まれます。
* **Act (実行):** テスト対象のメソッド (`Sub` または `Function`) を実行します。通常、このセクションは1行、または数行になります。
* **Assert (検証):** 実行結果が期待通りであるかを検証します。`Debug.Assert` を使用して、戻り値、オブジェクトの状態、モックオブジェクトのメソッドが期待通り呼び出されたかなどを検証します。`Debug.Assert` が False になるとコードが停止（中断モード時）するため、失敗が明確になります。必要に応じて `If` 文と `Debug.Print` で補足的な情報（期待値と実際値など）を出力します。

* **例:**
    ```vba
    Public Sub Test_Calculator_Add_PositiveNumbers()
        ' Arrange (準備)
        Dim calculator As New clsCalculator ' テスト対象クラス
        Dim num1 As Double
        Dim num2 As Double
        Dim expectedSum As Double
        num1 = 5.5
        num2 = 10.2
        expectedSum = 15.7

        ' Act (実行)
        Dim actualSum As Double
        actualSum = calculator.Add(num1, num2) ' テスト対象メソッドの呼び出し

        ' Assert (検証)
        Debug.Assert actualSum = expectedSum ' 結果が期待通りか検証
        If actualSum <> expectedSum Then
            Debug.Print "Test Failed: Test_Calculator_Add_PositiveNumbers. Expected: " & expectedSum & ", Actual: " & actualSum
        End If
    End Sub

    Public Sub Test_Calculator_Add_Zero()
        ' Arrange
        Dim calculator As New clsCalculator
        Dim expectedSum As Double
        expectedSum = 5 ' 5 + 0 = 5

        ' Act
        Dim actualSum As Double
        actualSum = calculator.Add(5, 0)

        ' Assert
        Debug.Assert actualSum = expectedSum
        If actualSum <> expectedSum Then Debug.Print "Test Failed: Test_Calculator_Add_Zero..."
    End Sub
    ```
* 各テストプロシージャをこの3つの明確なセクション（コメントで区切ると分かりやすい）に分けることで、テストの目的と内容が理解しやすくなります。

## 4. テスト容易性のための設計 (VBA版)

テストしやすいコードを書くことは、VBAにおいても非常に重要です。テスト容易性を考慮した設計は、結果としてよりモジュール化され、理解しやすく、保守しやすいコードにつながります。

* **依存性注入 (DI) の活用:** [設計原則とパターン (VBA版)](design-principles-vba.md) で説明されている通り、クラスが依存する他のオブジェクト（データアクセス、ロガー、他のサービスクラスなど）は、内部で `New` するのではなく、外部から注入できるように設計します（主にプロパティインジェクション `Property Set` や初期化メソッドを使用）。**これがVBAでテスト容易性を確保する最も重要なテクニックです。** これにより、テスト時には本物の依存オブジェクトの代わりに、テスト用に作成した「モックオブジェクト」を注入できます。
* **ロジックとUIの分離:** フォームやレポートのイベントプロシージャ（例: `Button_Click`, `Form_Load`）には、UI操作（コントロールの値の取得/設定、表示更新）と、ビジネスロジックを担当する別のモジュール（標準モジュールやクラスモジュール）の呼び出しのみを記述します。実際の計算、データ処理、検証などの**ビジネスロジックは、UIから独立した標準モジュールやクラスモジュール内のプロシージャ/関数に実装します。** これにより、UIを表示せずにロジック部分だけをテストすることが可能になります。
* **純粋なプロシージャ/関数の推奨:** 可能な限り、プロシージャや関数は、引数としてデータを受け取り、結果を戻り値や `ByRef` 引数で返すように設計します。モジュールレベル変数やグローバル変数への依存、あるいは直接的なファイル/DB/UI操作を関数内部で行う（副作用）ことを避けます。このような「純粋な」関数は、入力と出力だけを考えればよいため、テストが非常に容易になります。

* **リファクタリング例:**
    * **悪い例 (テストしにくい):**
        ```vba
        ' --- フォームモジュール ---
        Private Sub btnProcess_Click()
            Dim db As DAO.Database
            Dim rs As DAO.Recordset
            Dim result As String

            ' UIから直接値を取得し、DBアクセスとロジックが混在
            Set db = CurrentDb
            Set rs = db.OpenRecordset("SELECT Value FROM Settings WHERE ID = " & Me.txtInputID.Value)
            If Not rs.EOF Then
                result = "Processed: " & UCase(rs!Value) & " at " & Now() ' 時間にも依存
            Else
                result = "Not Found"
            End If
            rs.Close
            Set rs = Nothing
            Set db = Nothing

            Me.lblResult.Caption = result ' UIを直接更新
        End Sub
        ```
    * **良い例 (テストしやすい):**
        ```vba
        ' --- フォームモジュール ---
        Private Sub btnProcess_Click()
            Dim inputId As Long
            Dim result As String
            Dim processor As New DataProcessor ' ロジッククラス (DI可能にすると更に良い)

            ' UIから値を取得
            inputId = CLng(Me.txtInputID.Value)

            ' ロジック部分を呼び出し
            result = processor.ProcessData(inputId, Now()) ' 現在時刻は引数で渡す

            ' UIを更新
            Me.lblResult.Caption = result
        End Sub

        ' --- クラスモジュール: DataProcessor ---
        Private m_dbHandler As IDatabaseHandler ' DBアクセスは別クラス (DIで注入)

        Public Property Set DatabaseHandler(value As IDatabaseHandler)
            Set m_dbHandler = value
        End Property

        Public Function ProcessData(id As Long, processTime As Date) As String
            On Error GoTo ErrorHandler
            Dim dataValue As String
            dataValue = m_dbHandler.GetValueFromSettings(id) ' 依存オブジェクトのメソッド呼び出し

            If Len(dataValue) > 0 Then
                ProcessData = "Processed: " & UCase(dataValue) & " at " & processTime
            Else
                ProcessData = "Not Found"
            End If
        Exit Function
        ErrorHandler:
            LogError Err.Number, Err.Description, "DataProcessor.ProcessData" ' エラー処理
            ProcessData = "Error occurred"
        End Function

        ' --- インターフェース的なクラスモジュール: IDatabaseHandler (例) ---
        ' (メソッド定義のみ)
        Public Function GetValueFromSettings(id As Long) As String: End Function

        ' --- 本番用DBアクセス クラスモジュール: DaoDatabaseHandler ---
        Implements IDatabaseHandler
        Public Function IDatabaseHandler_GetValueFromSettings(id As Long) As String
            ' ... DAOを使ってDBから値を取得する実装 ...
        End Function

        ' --- テスト用モック クラスモジュール: MockDatabaseHandler ---
        Implements IDatabaseHandler
        Public MockResult As String ' テストで設定する値
        Public Function IDatabaseHandler_GetValueFromSettings(id As Long) As String
            IDatabaseHandler_GetValueFromSettings = MockResult ' 固定値を返す
        End Function
        ```
        この良い例では、`DataProcessor` クラスの `ProcessData` 関数がテスト対象となります。テスト時には `MockDatabaseHandler` を `DatabaseHandler` プロパティに注入することで、実際のDBアクセスなしにロジックを検証できます。

## 5. モック戦略と契約によるテスト (VBA版)

テスト対象のコード（ユニット）を、それが依存する他の部分（ファイル、DB、他のクラス）から隔離してテストするために、「モックオブジェクト」を使用します。

* **VBAにおけるモックオブジェクト:**
    * テスト対象コードが依存しているクラス（例: `DaoDatabaseHandler`）の代わりとなる、テスト用の単純なクラスモジュールやオブジェクトです。
    * モックオブジェクトは、本物のクラスと同じ `Public` なインターフェース（メソッド名、引数、戻り値の型）を持ちますが、その内部実装はテスト用に単純化されています（例: 固定値を返す、引数を記録するだけ）。
    * 単純な依存関係であれば、`Scripting.Dictionary` を使ってメソッド呼び出しをシミュレートすることも可能です。
* **モックの作成例:**
    ```vba
    ' --- テスト用モック クラスモジュール: clsMockLogger ---
    Option Explicit
    Public LogHistory As Collection ' ログ呼び出し履歴を記録

    Private Sub Class_Initialize()
        Set LogHistory = New Collection
    End Sub

    ' 本物の Logger クラスが持つメソッドと同じシグネチャで実装
    Public Sub Info(message As String, Optional context As Variant)
        LogHistory.Add "INFO: " & message & IIf(IsMissing(context), "", " Context: " & CStr(context))
    End Sub
    Public Sub Error(num As Long, desc As String, sourceProc As String, Optional context As Variant)
        LogHistory.Add "ERROR: " & num & " - " & desc & " in " & sourceProc & IIf(IsMissing(context), "", " Context: " & CStr(context))
    End Sub
    Public Function GetLastLog() As String
        If LogHistory.Count > 0 Then GetLastLog = LogHistory(LogHistory.Count)
    End Function

    ' --- テスト用モック クラスモジュール: clsMockDataAccess ---
    Option Explicit
    Public GetData_ReturnValue As Variant ' このメソッドが返す値をテスト側で設定
    Public GetData_CalledWith_ID As Long ' メソッドが呼ばれた際の引数を記録
    Public SaveData_Called As Boolean ' メソッドが呼ばれたかのフラグ
    Public SaveData_CalledWith_Data As Variant ' 引数を記録

    ' 本物の DataAccess クラスが持つメソッドと同じシグネチャ
    Public Function GetData(id As Long) As Variant
        GetData_CalledWith_ID = id
        GetData = GetData_ReturnValue ' 設定された値を返す
    End Function
    Public Sub SaveData(data As Variant)
        SaveData_Called = True
        SaveData_CalledWith_Data = data ' 参照型の場合は注意が必要
    End Sub
    ```
* **DIによるモックの利用:** テスト対象クラスのインスタンスを作成した後、その依存プロパティ（`Property Set` で定義されているもの）に、作成したモックオブジェクトのインスタンスを `Set` します。
    ```vba
    Sub Test_MyService_DoSomething_Success()
        ' Arrange
        Dim service As New clsMyService
        Dim mockLogger As New clsMockLogger
        Dim mockData As New clsMockDataAccess

        ' モックを設定
        mockData.GetData_ReturnValue = "Mock Data" ' GetDataが返す値を設定
        Set service.Logger = mockLogger ' Loggerプロパティにモックを注入
        Set service.DataAccess = mockData ' DataAccessプロパティにモックを注入

        ' Act
        service.DoSomething 123

        ' Assert
        Debug.Assert mockData.GetData_CalledWith_ID = 123 ' GetDataが正しいIDで呼ばれたか
        Debug.Assert mockLogger.LogHistory.Count > 0 ' ログが記録されたか
        Debug.Assert InStr(mockLogger.GetLastLog, "INFO:") > 0 ' 最後のログがINFOか
        Debug.Assert mockData.SaveData_Called ' SaveDataが呼ばれたか
    End Sub
    ```
* **契約（インターフェース）の維持:**
    * **重要:** モックオブジェクトは、それが模倣する本物のクラスと同じ **Public なインターフェース（メソッド名、引数の数と型、戻り値の型）** を持たなければなりません。これが「契約」です。契約が一致していないと、テストは成功しても実際の動作は異なる、という信頼性の低いテストになってしまいます。
    * VBA の `Implements` キーワードを使ってインターフェース（メソッド定義のみを持つクラスモジュール）を定義し、本物のクラスとモッククラスの両方にそれを実装させることで、契約の維持を強制できます（上記リファクタリング例の `IDatabaseHandler` 参照）。ただし、`Implements` の利用は少し複雑になるため、小規模なプロジェクトでは必須ではありませんが、有効な手法です。
    * 本物のクラスのインターフェースが変更された場合は、**必ず対応するモッククラスも更新**してください。

## 6. VBAにおけるテストの実装方法

VBAには標準的なテストフレームワークがないため、以下の方法でテストを実装します。

* **テストモジュールの作成:** テスト対象のモジュール（例: `Module1`, `clsMyClass`）ごとに、対応するテスト用モジュールを作成します（例: `Test_Module1`, `Test_clsMyClass`）。これにより、テストコードが整理されます。
* **テストプロシージャの命名と構造:**
    * テストプロシージャは `Public Sub` として作成します。
    * 命名規則: `Test_対象プロシージャ名_テストシナリオ()` の形式を推奨します。
        * 例: `Test_CalculateTotal_PositiveValues()`, `Test_CalculateTotal_InputIsEmpty()`, `Test_SaveData_Success()`, `Test_SaveData_DatabaseError()`
    * 各プロシージャ内は AAA パターンで構造化します（上記参照）。
* **アサーション (`Debug.Assert`, `Debug.Print`):**
    * `Debug.Assert condition`: `condition` が `True` であることを表明します。`False` の場合、VBEが中断モードであればコードの実行がその行で停止し、イミディエイトウィンドウにアサーション失敗が表示されます。これがテストの合否を自動判定する主要な手段です。
    * `Debug.Print expression`: イミディエイトウィンドウに変数の値やメッセージを出力します。`Debug.Assert` が失敗した場合に、期待値と実際値を出力してデバッグを助けるために使用します。
    ```vba
    ' Assert
    Dim actualValue As String
    actualValue = GetValue()
    Dim expectedValue As String
    expectedValue = "Expected"
    Debug.Assert actualValue = expectedValue
    If actualValue <> expectedValue Then
        Debug.Print "Assertion Failed in Test_GetValue_Scenario!" & vbCrLf & _
                    "  Expected: '" & expectedValue & "'" & vbCrLf & _
                    "  Actual:   '" & actualValue & "'"
    End If
    ```
* **エラーハンドリングのテスト:**
    * **期待されるエラーのテスト:** 特定の条件下でエラーが発生することを確認します。
        1.  エラーが発生すると予想される行の直前に `On Error Resume Next` を記述します。
        2.  エラーが発生する可能性のあるコードを実行します。
        3.  直後に `Err.Number` が期待するエラーコードと一致するかを `Debug.Assert` で検証します。必要であれば `Err.Description` や `Err.Source` も検証します。
        4.  **重要:** テストの後、必ず `On Error GoTo 0` （または元のエラーハンドララベル）でエラー処理を元に戻します。
    ```vba
    Sub Test_ProcessData_InvalidId_RaisesError()
        ' Arrange
        Dim processor As New DataProcessor
        Dim invalidId As Long
        invalidId = -1
        Dim expectedErrorNumber As Long
        expectedErrorNumber = vbObjectError + 1001 ' 例: カスタムエラー番号

        ' Act & Assert
        On Error Resume Next ' エラーを捕捉する準備
        processor.ProcessData invalidId, Now() ' エラーが発生するはずの呼び出し
        Debug.Assert Err.Number = expectedErrorNumber ' エラー番号を検証
        If Err.Number <> expectedErrorNumber Then
            Debug.Print "Test Failed: Expected error " & expectedErrorNumber & ", but got " & Err.Number & ": " & Err.Description
        End If
        On Error GoTo 0 ' ★エラー処理を元に戻す★
        Err.Clear ' エラー情報をクリア (任意)
    End Sub
    ```
    * **エラーハンドラ自体のテスト:** エラー発生時にログが記録されるか、特定のデフォルト値が返されるかなどをテストします。これは、エラーを意図的に発生させ（上記の方法や、エラーを発生させるモックを使用）、その後の状態（ログモックの内容、関数の戻り値）を検証することで行います。
* **(オプション) テストツールの活用:** [Rubberduck VBA](http://rubberduckvba.com/) のような無料の VBE アドインには、限定的ながら単体テスト機能が含まれています。これを利用すると、テストの実行や管理が少し容易になる場合があります。プロジェクトで導入されている場合は活用を検討してください。

## 7. テストヘルパーの活用 (VBA版)

テストコード内で繰り返し使用されるセットアップロジックやアサーション処理は、ヘルパープロシージャ（`Sub` または `Function`）として抽出することで、テストコードの重複を減らし、可読性を向上させることができます。

* **ヘルパーの配置:** テストモジュール内、または共通のテストユーティリティモジュール（例: `TestUtils`）に `Public` または `Private` なプロシージャとして作成します。
* **例:**
    * **モックオブジェクト生成ヘルパー:** 標準的な設定を持つモックオブジェクトを生成する関数。
        ```vba
        Function CreateStandardMockLogger() As clsMockLogger
            Set CreateStandardMockLogger = New clsMockLogger
            ' 必要ならデフォルト設定を行う
        End Function
        ```
    * **カスタムアサーションヘルパー:** 特定の型のオブジェクトが等しいか、期待される状態かなどを検証する `Sub`。
        ```vba
        Sub AssertCustomerDataMatches(expected As clsCustomer, actual As clsCustomer, testName As String)
            Dim pass As Boolean
            pass = True ' Assume pass initially
            If expected.ID <> actual.ID Then pass = False
            If expected.Name <> actual.Name Then pass = False
            ' ... 他のプロパティも比較 ...

            Debug.Assert pass
            If Not pass Then
                Debug.Print "Assertion Failed in " & testName & ": Customer data mismatch."
                Debug.Print "  Expected ID: " & expected.ID & ", Actual ID: " & actual.ID
                Debug.Print "  Expected Name: " & expected.Name & ", Actual Name: " & actual.Name
                ' ...
            End If
        End Sub
        ```
    * **テストデータ生成ヘルパー:** テスト用の複雑なデータ構造を生成する関数。
    * **状態リセットヘルパー:** テスト間でリセットが必要なグローバル変数や設定などを初期状態に戻す `Sub`。

## 8. イベントテスト (VBA版)

* **UIイベントハンドラのテスト戦略:**
    * フォーム上のボタンクリック (`Button_Click`) のような UI イベントハンドラ自体を直接自動テストするのは困難です。
    * **戦略:** イベントハンドラ内のコード量を最小限にします。ハンドラは、①コントロールから値を取得し、②ビジネスロジックを持つ別のプロシージャ/関数（標準モジュールやクラスモジュール内）を呼び出し、③その結果をコントロールに設定する、という役割に徹します。
    * **テスト対象:** UI から分離されたビジネスロジックのプロシージャ/関数を重点的にテストします。
* **カスタムイベント (`RaiseEvent`) のテスト:**
    * クラスモジュール内で `Event` キーワードで宣言され、`RaiseEvent` で発生するカスタムイベントをテストする方法です。
    * **戦略:** テストプロシージャ内で、イベントをリッスン（捕捉）するためのシンプルなクラス（リスナークラス）のインスタンスを `WithEvents` を付けて宣言します。テスト対象のメソッドを実行し、リスナークラスのイベントハンドラが期待通りに呼び出されたか（例: ハンドラ内でフラグを立てる、引数を記録する）を検証します。
    ```vba
    ' --- リスナークラス (テスト用): clsEventListener ---
    Option Explicit
    Public EventHandled As Boolean
    Public ReceivedPercentage As Integer
    Public ReceivedMessage As String

    ' DataProcessor の ProgressUpdated イベントをハンドルする
    Public Sub DataProcessor_ProgressUpdated(ByVal percentage As Integer, ByVal message As String)
        EventHandled = True
        ReceivedPercentage = percentage
        ReceivedMessage = message
    End Sub

    ' --- テストプロシージャ ---
    Sub Test_DataProcessor_RaisesProgressUpdatedEvent()
        ' Arrange
        Dim processor As New clsDataProcessor ' イベントを発行するクラス
        Dim listener As New clsEventListener ' イベントを捕捉するリスナー
        Set listener.DataProcessor = processor ' ★WithEvents変数にインスタンスをセット★

        ' Act
        processor.StartProcessing 10 ' イベントが発生するはずの処理を実行

        ' Assert
        Debug.Assert listener.EventHandled ' イベントハンドラが呼ばれたか
        If listener.EventHandled Then
            Debug.Assert listener.ReceivedPercentage = 100 ' 最後のイベント引数を検証 (例)
            Debug.Assert InStr(listener.ReceivedMessage, "10/10") > 0 ' 引数の内容を検証 (例)
        Else
            Debug.Print "Test Failed: ProgressUpdated event was not handled."
        End If

        Set listener.DataProcessor = Nothing ' 解放
    End Sub

    ' --- リスナークラスの宣言部分 (例) ---
    ' (clsEventListener のモジュールレベルで)
    Public WithEvents DataProcessor As clsDataProcessor ' イベント発行元クラスを WithEvents で宣言
    ```

## 9. テストコードのリファクタリング (VBA版)

テストコードもプロダクションコードと同様に、読みやすく、保守しやすく、信頼できる状態を保つために、定期的な見直しと改善（リファクタリング）が必要です。

* **目的:**
    * テストの意図をより明確にする。
    * 重複するコード（特にセットアップやアサーション）を排除する。
    * テストの実行を（可能な範囲で）効率化する。
    * テストの信頼性を高める（脆いテスト、誤検知しやすいテストを修正する）。
* **テクニック:**
    * **テストヘルパーの活用:** 上記「テストヘルパーの活用」で述べたように、共通処理をヘルパーに抽出します。
    * **定数の利用:** テストデータ（入力値、期待値）で繰り返し使われる値は、テストモジュールの上部で `Const` として定義します。
    * **AAAパターンの徹底:** テストプロシージャが Arrange-Act-Assert の構造に従っているか確認し、逸脱している場合は修正します。
    * **記述的なテスト名:** `Test_...` の名前が、テスト対象とシナリオを具体的に示しているか確認し、必要なら修正します。
    * **マジックナンバー/文字列の排除:** テストコード中の意味不明な数値や文字列を避け、定数や説明的な変数名を使用します。

## 10. カバレッジ (VBA版)

* **課題:** VBAには、コードのどの部分がテストによって実行されたかを自動的に測定する「テストカバレッジ」ツールが組み込まれていません。
* **アプローチ:**
    * **手動評価:** どの程度のロジックパス（`If` の True/False、`Select Case` の各 Case、ループの 0回/1回/複数回実行、エラーハンドリングパス）がテストされているかを、テストケースリストやコードレビューを通じて意識的に評価します。
    * **規律:** 自動的な指標がないため、重要なビジネスロジック、複雑な条件分岐、エラー処理ルーチンについては、意図的にテストケースを作成し、網羅性を高めるよう努める規律が重要になります。
    * **ツールの補助:** Rubberduck VBA のようなツールはコードメトリクス（複雑度など）を提供することがあり、テストを重点的に行うべき箇所を特定するヒントになる場合がありますが、実行カバレッジそのものではありません。
* **目標:** 自動測定はできなくとも、「主要な機能が正常に動作すること」「典型的なエラーケースが処理されること」「境界値が扱えること」をテストによって確認することを目指します。

---

これらのガイドラインに従い、VBAプロジェクトにおいてもテストの文化を醸成し、コードの品質と保守性を向上させることを目指してください。[AI開発者向けガイド (VBA版)](ai-developer-guide-vba.md) にあるように、AIにテスト容易性を考慮したコード生成や、テストコード（テストプロシージャ）の生成を依頼する際にも、このガイドライン（特にAAAパターン、モックの考え方、エラーテストの方法）を参照するように指示すると効果的です。
