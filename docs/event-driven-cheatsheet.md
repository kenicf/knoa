# イベント駆動アーキテクチャ 開発者向けチートシート

> **難易度: 基本** | 所要時間: 10分

このチートシートでは、イベント駆動アーキテクチャを使用する際によく必要となるコードスニペットやイベント名の一覧を提供します。日常的な開発作業で参照できる実用的な情報を集めています。

## 目次
- [1. よく使用されるイベント名一覧](#1-よく使用されるイベント名一覧)
- [2. イベント発行のコードスニペット](#2-イベント発行のコードスニペット)
- [3. イベントリスナーのコードスニペット](#3-イベントリスナーのコードスニペット)
- [4. エラーハンドリングのコードスニペット](#4-エラーハンドリングのコードスニペット)
- [5. デバッグのヒント](#5-デバッグのヒント)

## 1. よく使用されるイベント名一覧

### 1.1 タスク関連イベント

| 新イベント名 | 旧イベント名 | 説明 |
|------------|------------|------|
| `task:task_created` | `task:created` | 新しいタスクが作成されたとき |
| `task:task_updated` | `task:updated` | タスクが更新されたとき |
| `task:task_progress_updated` | `task:progress` | タスクの進捗が更新されたとき |
| `task:git_commit_added` | `task:commit` | タスクにGitコミットが追加されたとき |
| `task:tasks_initialized` | `task:initialized` | タスクが初期化されたとき |

### 1.2 セッション関連イベント

| 新イベント名 | 旧イベント名 | 説明 |
|------------|------------|------|
| `session:session_created` | `session:started` | 新しいセッションが作成されたとき |
| `session:session_updated` | `session:updated` | セッションが更新されたとき |
| `session:session_ended` | `session:ended` | セッションが終了したとき |
| `session:task_added` | `session:task:added` | セッションにタスクが追加されたとき |
| `session:task_removed` | `session:task:removed` | セッションからタスクが削除されたとき |
| `session:git_commit_added` | `session:commit:added` | セッションにGitコミットが追加されたとき |

### 1.3 フィードバック関連イベント

| 新イベント名 | 旧イベント名 | 説明 |
|------------|------------|------|
| `feedback:feedback_created` | `feedback:created` | 新しいフィードバックが作成されたとき |
| `feedback:test_results_collected` | `feedback:test:collected` | テスト結果が収集されたとき |
| `feedback:feedback_prioritized` | `feedback:prioritized` | フィードバックが優先順位付けされたとき |
| `feedback:status_updated` | `feedback:status:updated` | フィードバックのステータスが更新されたとき |
| `feedback:integrated_with_session` | `feedback:integrated:session` | フィードバックがセッションと統合されたとき |
| `feedback:integrated_with_task` | `feedback:integrated:task` | フィードバックがタスクと統合されたとき |

### 1.4 システム関連イベント

| 新イベント名 | 旧イベント名 | 説明 |
|------------|------------|------|
| `system:initialized` | `system:init` | システムが初期化されたとき |
| `system:shutdown` | `system:exit` | システムがシャットダウンされたとき |

### 1.5 ストレージ関連イベント

| 新イベント名 | 旧イベント名 | 説明 |
|------------|------------|------|
| `storage:file_read` | `storage:file:read` | ファイルが読み込まれたとき |
| `storage:file_write` | `storage:file:write` | ファイルが書き込まれたとき |
| `storage:file_delete` | `storage:file:delete` | ファイルが削除されたとき |

## 2. イベント発行のコードスニペット

### 2.1 基本的なイベント発行

```javascript
// 基本的なイベント発行
eventEmitter.emit('task:task_created', { 
  id: 'T001', 
  title: 'タスクの作成'
});
```

### 2.2 標準化されたイベント発行

```javascript
// 標準化されたイベント発行
eventEmitter.emitStandardized('task', 'task_created', { 
  id: 'T001', 
  title: 'タスクの作成'
});
```

### 2.3 コンテキスト付きイベント発行

```javascript
// コンテキストの作成
const context = this._createContext('createTask', { taskId: 'T001' });

// コンテキスト付きイベント発行
this._emitEvent('task', 'task_created', { 
  id: 'T001', 
  title: 'タスクの作成'
}, context);
```

### 2.4 非同期イベント発行

```javascript
// 非同期イベント発行
await eventEmitter.emitStandardizedAsync('task', 'task_created', { 
  id: 'T001', 
  title: 'タスクの作成'
});
```

### 2.5 エラーイベント発行

```javascript
// エラーイベント発行
this._emitErrorEvent(error, 'createTask', context, { 
  taskData: { title: 'タスクの作成' }
});
```

### 2.6 アダプターでのイベント発行パターン

```javascript
async createTask(taskData, context = null) {
  // コンテキストがない場合は新しく作成
  context = context || this._createContext('createTask', { taskData });
  
  try {
    // パラメータの検証
    this._validateParams(taskData, ['title']);
    
    // タスクの作成
    const task = await this.manager.createTask(taskData);
    
    // イベントの発行
    this._emitEvent('task', 'task_created', task, context);
    
    return task;
  } catch (error) {
    // エラー処理
    return this._handleError(error, 'createTask', context, { taskData });
  }
}
```

## 3. イベントリスナーのコードスニペット

### 3.1 基本的なリスナー登録

```javascript
// 基本的なイベントリスナー
const removeListener = eventEmitter.on('task:task_created', (data) => {
  console.log(`タスクが作成されました: ${data.title}`);
});

// リスナーの解除
removeListener();
```

### 3.2 ワイルドカードリスナー

```javascript
// ワイルドカードリスナー（タスク関連のすべてのイベントを購読）
eventEmitter.on('task:*', (data, eventName) => {
  console.log(`タスク関連イベント: ${eventName}`);
});

// 複数のコンポーネントのイベントを購読
eventEmitter.on('*:created', (data, eventName) => {
  console.log(`作成イベント: ${eventName}`);
});
```

### 3.3 一度だけ実行されるリスナー

```javascript
// 一度だけ実行されるリスナー
eventEmitter.once('system:initialized', (data) => {
  console.log('システムが初期化されました');
});
```

### 3.4 非同期リスナー

```javascript
// 非同期リスナー
eventEmitter.on('task:task_created', async (data) => {
  // 非同期処理
  await someAsyncFunction(data);
  console.log('非同期処理が完了しました');
});
```

### 3.5 イベント連鎖のリスナー

```javascript
// タスク作成時にセッションを自動的に作成するリスナー
eventEmitter.on('task:task_created', async (data) => {
  try {
    // セッションの作成
    const session = await sessionAdapter.createNewSession();
    
    // タスクをセッションに関連付け
    await sessionAdapter.addTaskToSession(
      session.session_handover.session_id,
      data.id
    );
    
    console.log(`タスク ${data.id} をセッション ${session.session_handover.session_id} に関連付けました`);
  } catch (error) {
    console.error('セッション作成中にエラーが発生しました:', error);
  }
});
```

### 3.6 コンテキスト付きイベントのリスナー

```javascript
// コンテキスト付きイベントのリスナー
eventEmitter.on('task:task_created', (data) => {
  if (data._context) {
    console.log(`コンテキストID: ${data._context}`);
  }
});
```

## 4. エラーハンドリングのコードスニペット

### 4.1 エラー状態の設定

```javascript
// エラー状態の設定
context.setError(error, 'TaskManager', 'createTask', { 
  taskId: 'T001',
  additionalInfo: '追加情報'
});
```

### 4.2 エラー状態のチェック

```javascript
// エラー状態のチェック
if (context.hasError()) {
  console.log('エラーが発生しています');
  console.log('エラー詳細:', context.getInfo().errorDetails);
  return; // 処理を中断
}
```

### 4.3 エラーイベントのリスナー

```javascript
// エラーイベントのリスナー
eventEmitter.on('error', (errorData) => {
  console.error(`エラーが発生しました: ${errorData.message}`);
  console.error('コンポーネント:', errorData.component);
  console.error('操作:', errorData.operation);
  console.error('詳細:', errorData.details);
});
```

### 4.4 try-catchパターン

```javascript
// try-catchパターン
try {
  // 何らかの処理
  throw new Error('テストエラー');
} catch (error) {
  // エラー処理
  if (context) {
    context.setError(error, 'Component', 'operation', { details });
  }
  
  // エラーイベントを発行
  this._emitErrorEvent(error, 'operation', context, { details });
  
  // エラー情報を返す
  return {
    error: true,
    message: error.message,
    code: error.code || 'UNKNOWN_ERROR'
  };
}
```

### 4.5 BaseAdapterのエラーハンドリング

```javascript
// BaseAdapterのエラーハンドリング
return this._handleError(error, 'createTask', context, { 
  taskData,
  additionalInfo: '追加情報'
});
```

## 5. デバッグのヒント

### 5.1 イベント履歴の活用

```javascript
// イベント履歴の取得
const history = eventEmitter.getEventHistory();
console.log('最近のイベント:', history);

// 最新の10件のイベントを取得
const recentEvents = eventEmitter.getEventHistory(10);
console.log('最新のイベント:', recentEvents);
```

### 5.2 デバッグモードの有効化

```javascript
// デバッグモードの有効化
eventEmitter.setDebugMode(true);

// イベント発行（詳細なログが出力される）
eventEmitter.emitStandardized('task', 'task_created', { id: 'T001' });
```

### 5.3 コンテキストIDによるトレース

```javascript
// コンテキスト情報の取得
const contextInfo = context.getInfo();
console.log('コンテキストID:', contextInfo.id);
console.log('開始時刻:', contextInfo.startTime);
console.log('経過時間:', contextInfo.duration);
console.log('エラー状態:', contextInfo.hasError);
console.log('エラー詳細:', contextInfo.errorDetails);
console.log('メタデータ:', contextInfo.metadata);
```

### 5.4 リスナーの数の確認

```javascript
// リスナーの数を確認
const count = eventEmitter.listenerCount('task:task_created');
console.log(`リスナーの数: ${count}`);

// 登録されているイベント一覧を取得
const events = eventEmitter.getRegisteredEvents();
console.log('登録されているイベント:', events);

// 登録されているワイルドカードパターン一覧を取得
const patterns = eventEmitter.getRegisteredWildcardPatterns();
console.log('登録されているワイルドカードパターン:', patterns);
```

### 5.5 イベント発行のデバッグ

```javascript
// イベント発行前にログ出力
console.log('イベント発行前:', { component: 'task', action: 'task_created', data });

// イベント発行
this._emitEvent('task', 'task_created', data, context);

// イベント発行後にログ出力
console.log('イベント発行後');
```

### 5.6 リスナー内でのデバッグ

```javascript
// リスナー内でのデバッグ
eventEmitter.on('task:task_created', (data) => {
  console.log('リスナーが呼び出されました');
  console.log('データ:', data);
  console.log('タイムスタンプ:', data.timestamp);
  console.log('コンテキストID:', data._context);
});
```

## 関連ドキュメント

- [クイックスタートガイド](./event-driven-quickstart.md) - イベント駆動アーキテクチャの基本的な使用方法
- [イベント駆動アーキテクチャガイド](./event-driven-architecture-guide.md) - イベント駆動アーキテクチャの詳細な説明
- [イベント名標準化ガイド](./event-naming-convention.md) - イベント名の命名規則と標準化ガイドライン
- [操作コンテキスト活用ガイド](./operation-context-guide.md) - 操作コンテキストの詳細な使用方法

## 次のステップ

このチートシートで基本的なコードスニペットを理解したら、次のステップとして以下のドキュメントを参照してください：

- [イベント名標準化ガイド](./event-naming-convention.md) - イベント名の命名規則について詳しく学ぶ
- [操作コンテキスト活用ガイド](./operation-context-guide.md) - 操作コンテキストの高度な使用方法を学ぶ