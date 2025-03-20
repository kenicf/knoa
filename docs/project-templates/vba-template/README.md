# VBAプロジェクトテンプレート

## 概要
このテンプレートは、AI駆動開発のためのVBAプロジェクトの基本構造を提供します。Excel、Access、Wordなどで使用するVBAモジュールの開発に適しています。

## 使い方

### 1. 新規リポジトリの作成
GitHub等で新しいリポジトリを作成します。

### 2. テンプレートのクローンと初期化
```bash
# テンプレートをクローン
git clone https://github.com/your-org/vba-template.git new-vba-project
cd new-vba-project

# リモートの変更
git remote remove origin
git remote add origin https://github.com/your-org/new-vba-project.git

# 初期コミットとプッシュ
git add .
git commit -m "Initial commit from template"
git push -u origin main
```

### 3. knoaリポジトリへのサブモジュール追加
```bash
cd /path/to/knoa
git submodule add https://github.com/your-org/new-vba-project.git projects/new-vba-project
git commit -m "Add new-vba-project as submodule"
git push
```

## ディレクトリ構造
```
vba-template/
├── README.md                # このファイル
├── .gitignore               # Git除外設定
├── ai-context/              # AI用コンテキスト情報
│   ├── project-metadata.json  # プロジェクトメタデータ
│   ├── tasks/               # タスク情報
│   ├── sessions/            # セッション情報
│   └── feedback/            # フィードバック情報
└── src/                     # ソースコード
    ├── modules/             # 標準モジュール
    │   ├── Main.bas         # メインモジュール
    │   └── Utilities.bas    # ユーティリティモジュール
    ├── forms/               # フォーム
    │   └── UserForm1.frm    # サンプルフォーム
    └── class-modules/       # クラスモジュール
        └── DataProcessor.cls # データ処理クラス
```

## AI駆動開発のポイント

### メタデータの活用
各モジュールの先頭には`@ai-metadata`コメントブロックを配置し、AIが理解しやすい形でメタ情報を提供しています。

```vba
' @ai-metadata {
'   "purpose": "メインモジュール",
'   "dependencies": ["Utilities.bas"],
'   "exports": ["Initialize", "Main"],
'   "lastModified": "2025-03-20"
' }
```

### AI用コンテキスト情報
`ai-context`ディレクトリには、AIが参照・更新する情報を集約しています。タスク、セッション、フィードバックの情報を構造化して管理します。

## VBAコードの管理

### エクスポート/インポート
VBAコードはバイナリ形式（.xlsm, .accdb等）で保存されるため、テキストベースのバージョン管理のために以下のアプローチを使用します：

1. VBAコードをテキストファイル（.bas, .cls, .frm）としてエクスポート
2. テキストファイルをバージョン管理
3. 必要に応じてVBAプロジェクトにインポート

### 推奨ツール
- [VBA-Toolbox](https://github.com/example/vba-toolbox)（仮想リンク）: VBAコードのエクスポート/インポートを自動化

## カスタマイズ方法
1. `project-metadata.json`のプロジェクト情報を更新
2. `Main.bas`の初期化処理とメイン処理を実装
3. 必要に応じてフォームとクラスモジュールを追加

## ライセンス
OSSとして公開（ライセンスを指定）