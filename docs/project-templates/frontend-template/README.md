# フロントエンドプロジェクトテンプレート

## 概要
このテンプレートは、AI駆動開発のためのフロントエンドプロジェクト（HTML/CSS/JavaScript）の基本構造を提供します。

## 使い方

### 1. 新規リポジトリの作成
GitHub等で新しいリポジトリを作成します。

### 2. テンプレートのクローンと初期化
```bash
# テンプレートをクローン
git clone https://github.com/your-org/frontend-template.git new-project
cd new-project

# リモートの変更
git remote remove origin
git remote add origin https://github.com/your-org/new-project.git

# 初期コミットとプッシュ
git add .
git commit -m "Initial commit from template"
git push -u origin main
```

### 3. knoaリポジトリへのサブモジュール追加
```bash
cd /path/to/knoa
git submodule add https://github.com/your-org/new-project.git projects/new-project
git commit -m "Add new-project as submodule"
git push
```

## ディレクトリ構造
```
frontend-template/
├── README.md                # このファイル
├── .gitignore               # Git除外設定
├── ai-context/              # AI用コンテキスト情報
│   ├── project-metadata.json  # プロジェクトメタデータ
│   ├── tasks/               # タスク情報
│   ├── sessions/            # セッション情報
│   └── feedback/            # フィードバック情報
└── src/                     # ソースコード
    ├── index.html           # メインHTML
    ├── styles/              # CSSファイル
    │   └── main.css         # メインCSS
    ├── scripts/             # JavaScriptファイル
    │   └── main.js          # メインJS
    └── assets/              # 静的アセット
        ├── images/          # 画像ファイル
        └── fonts/           # フォントファイル
```

## AI駆動開発のポイント

### メタデータの活用
各ファイルの先頭には`@ai-metadata`コメントブロックを配置し、AIが理解しやすい形でメタ情報を提供しています。

```html
<!--
@ai-metadata {
  "purpose": "メインページ",
  "dependencies": ["styles/main.css", "scripts/main.js"],
  "lastModified": "2025-03-20"
}
-->
```

### AI用コンテキスト情報
`ai-context`ディレクトリには、AIが参照・更新する情報を集約しています。タスク、セッション、フィードバックの情報を構造化して管理します。

## カスタマイズ方法
1. `project-metadata.json`のプロジェクト情報を更新
2. `index.html`のタイトルとコンテンツを変更
3. `main.css`のスタイルをプロジェクトに合わせて調整
4. `main.js`の機能を実装

## ライセンス
OSSとして公開（ライセンスを指定）