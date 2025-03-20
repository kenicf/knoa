# フェーズ0: ミニマルAI駆動開発基盤の構築

## 目的と位置づけ

フェーズ0は、本格的なガイドライン導入前に最小限の仕組みを構築し、その後のフェーズをAI駆動で効率的に実装するための基盤となります。複雑なフレームワークやツールは使わず、シンプルなアプローチで迅速に導入できることを重視します。

## 実装内容

### 1. 環境準備

#### 1.1 リポジトリ構造

knoaリポジトリは以下の基本構造を持ちます：

```
knoa/
├── core/                # AI駆動開発の共通コアコンポーネント
├── projects/            # 個別プロジェクトディレクトリ（サブモジュール）
└── docs/                # プロジェクト全体のドキュメント
```

#### 1.2 サブモジュール管理

各プロジェクトは独立したGitリポジトリとして管理し、knoaからはサブモジュールとして参照します。

```
[submodule "projects/project-a"]
	path = projects/project-a
	url = https://github.com/your-org/project-a.git
	branch = main
```

#### 1.3 プロジェクトテンプレート

新規プロジェクト用のテンプレートを用意しています：

- フロントエンドプロジェクトテンプレート（HTML/CSS/JavaScript）
- VBAプロジェクトテンプレート

### 2. コアコンポーネント

#### 2.1 タスク分解・追跡システム

ユーザーからの大きな指示を、AIが処理可能な粒度のタスクに分解し追跡する仕組みです。

**実装**:
- タスク定義テンプレート: `core/templates/docs/task.json`
- タスク定義スキーマ: `core/schemas/task.schema.json`

#### 2.2 セッション間状態保持

複数のAI対話セッションをまたいで開発コンテキストを維持する仕組みです。

**実装**:
- セッション状態テンプレート: `core/templates/docs/session.json`
- セッション状態スキーマ: `core/schemas/session.schema.json`

#### 2.3 シンプルなフィードバックループ

実装結果の検証とそのフィードバックを開発フローに反映する基本的な仕組みです。

**実装**:
- フィードバックテンプレート: `core/templates/docs/feedback.json`
- フィードバックスキーマ: `core/schemas/feedback.schema.json`

#### 2.4 最小限の標準化テンプレート

基本的なコード構造とドキュメント形式を標準化し、一貫性を確保します。

**実装**:
- フロントエンドテンプレート:
  - HTML: `core/templates/frontend/html/index.html`
  - CSS: `core/templates/frontend/css/main.css`
  - JavaScript: `core/templates/frontend/js/main.js`
- VBAテンプレート:
  - `core/templates/vba/Main.bas`

### 3. 情報の凝集性を高める工夫

#### 3.1 メタデータの活用

各ファイルの先頭に構造化されたコメントブロックを追加し、AIが理解しやすい形でメタ情報を提供します。

```html
<!--
@ai-metadata {
  "purpose": "メインページ",
  "dependencies": ["styles/main.css", "scripts/main.js"],
  "lastModified": "2025-03-20"
}
-->
```

#### 3.2 AI用コンテキスト情報の集約

各プロジェクト内に「ai-context」ディレクトリを設け、AIが参照・更新する情報を集約します。

```
ai-context/
├── project-metadata.json       # プロジェクトの基本情報
├── tasks/                      # タスク情報
├── sessions/                   # セッション情報
└── feedback/                   # フィードバック情報
```

## 使用方法

### 1. 新規プロジェクトの作成

1. `docs/project-templates`から適切なテンプレートを選択
2. プロジェクト用のリポジトリを作成し、テンプレートをコピー
3. knoaリポジトリにサブモジュールとして追加

### 2. タスク管理

1. ユーザーからの指示を受け取ったら、`ai-context/tasks/current-tasks.json`にタスクを分解して記録
2. タスクの状態を更新しながら開発を進行

### 3. セッション管理

1. セッション終了時に`ai-context/sessions/latest-session.json`に状態を保存
2. 次のセッション開始時に前回の状態を読み込み

### 4. フィードバック管理

1. 実装結果の検証後、`ai-context/feedback/pending-feedback.json`にフィードバックを記録
2. フィードバックに基づいて改善を実施

## 成功指標

- ユーザー指示を5分以内に実行可能なタスクに分解できる
- セッションを跨いでも開発コンテキストを90%以上維持できる
- テスト結果から自動的に修正方針を導出できる
- 基本的なコード生成が一貫した構造で行える

## 次のステップ

フェーズ0の基盤を活用して、フェーズ1「情報フロー基盤の構築」へと進みます。フェーズ1では以下を実装します：

- JSONドキュメント形式の標準化
- JSON Schema定義の拡充
- JSON-RPCインターフェース設計
- JSON Logicによるルール表現