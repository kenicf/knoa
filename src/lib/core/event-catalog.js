/**
 * イベントカタログ
 * 
 * システム全体で使用されるイベントの定義と説明を管理します。
 * このファイルでは、標準的なイベントの定義を提供します。
 */

const { EventCatalog } = require('./event-system');

// イベントカタログのシングルトンインスタンス
const eventCatalog = new EventCatalog();

// タスク関連イベント
eventCatalog.registerEvent('task:created', {
  description: '新しいタスクが作成されたときに発行されます',
  category: 'task',
  schema: {
    id: 'タスクID',
    title: 'タスクのタイトル',
    description: 'タスクの説明',
    status: 'タスクのステータス',
    dependencies: 'タスクの依存関係',
    priority: 'タスクの優先度',
    estimated_hours: '見積もり時間',
    progress_percentage: '進捗率'
  },
  examples: [
    `emitter.emitStandardized('task', 'created', { 
      id: 'T001', 
      title: '基本ディレクトリ構造の設計',
      status: 'pending'
    });`
  ]
});

eventCatalog.registerEvent('task:updated', {
  description: 'タスクが更新されたときに発行されます',
  category: 'task',
  schema: {
    id: 'タスクID',
    updates: '更新内容',
    previous: '更新前の値',
    current: '更新後の値'
  },
  examples: [
    `emitter.emitStandardized('task', 'updated', { 
      id: 'T001', 
      updates: { status: 'in_progress' },
      previous: { status: 'pending' },
      current: { status: 'in_progress' }
    });`
  ]
});

eventCatalog.registerEvent('task:deleted', {
  description: 'タスクが削除されたときに発行されます',
  category: 'task',
  schema: {
    id: 'タスクID',
    reason: '削除理由'
  },
  examples: [
    `emitter.emitStandardized('task', 'deleted', { 
      id: 'T001', 
      reason: '重複タスクのため削除'
    });`
  ]
});

eventCatalog.registerEvent('task:statusChanged', {
  description: 'タスクのステータスが変更されたときに発行されます',
  category: 'task',
  schema: {
    id: 'タスクID',
    previousStatus: '変更前のステータス',
    newStatus: '変更後のステータス',
    timestamp: '変更日時'
  },
  examples: [
    `emitter.emitStandardized('task', 'statusChanged', { 
      id: 'T001', 
      previousStatus: 'pending',
      newStatus: 'in_progress'
    });`
  ]
});

// セッション関連イベント
eventCatalog.registerEvent('session:started', {
  description: '新しいセッションが開始されたときに発行されます',
  category: 'session',
  schema: {
    id: 'セッションID',
    timestamp: '開始時刻',
    project_id: 'プロジェクトID',
    previous_session_id: '前回のセッションID'
  },
  examples: [
    `emitter.emitStandardized('session', 'started', { 
      id: 'session-20250322-1',
      project_id: 'knoa'
    });`
  ]
});

eventCatalog.registerEvent('session:ended', {
  description: 'セッションが終了したときに発行されます',
  category: 'session',
  schema: {
    id: 'セッションID',
    timestamp: '終了時刻',
    duration: 'セッション時間（秒）',
    completed_tasks: '完了したタスク'
  },
  examples: [
    `emitter.emitStandardized('session', 'ended', { 
      id: 'session-20250322-1',
      duration: 3600,
      completed_tasks: ['T001', 'T002']
    });`
  ]
});

eventCatalog.registerEvent('session:handover', {
  description: 'セッション間の引継ぎが行われたときに発行されます',
  category: 'session',
  schema: {
    from_session_id: '引継ぎ元セッションID',
    to_session_id: '引継ぎ先セッションID',
    handover_data: '引継ぎデータ'
  },
  examples: [
    `emitter.emitStandardized('session', 'handover', { 
      from_session_id: 'session-20250322-1',
      to_session_id: 'session-20250322-2',
      handover_data: { current_focus: 'T011' }
    });`
  ]
});

// フィードバック関連イベント
eventCatalog.registerEvent('feedback:collected', {
  description: 'フィードバックが収集されたときに発行されます',
  category: 'feedback',
  schema: {
    id: 'フィードバックID',
    task_id: 'タスクID',
    content: 'フィードバック内容',
    type: 'フィードバックタイプ',
    severity: '重要度'
  },
  examples: [
    `emitter.emitStandardized('feedback', 'collected', { 
      id: 'F001',
      task_id: 'T001',
      content: 'ディレクトリ構造が複雑すぎる',
      type: 'improvement',
      severity: 'medium'
    });`
  ]
});

eventCatalog.registerEvent('feedback:resolved', {
  description: 'フィードバックが解決されたときに発行されます',
  category: 'feedback',
  schema: {
    id: 'フィードバックID',
    resolution: '解決内容',
    resolution_time: '解決にかかった時間'
  },
  examples: [
    `emitter.emitStandardized('feedback', 'resolved', { 
      id: 'F001',
      resolution: 'ディレクトリ構造をシンプル化しました',
      resolution_time: 3600
    });`
  ]
});

// Git関連イベント
eventCatalog.registerEvent('git:committed', {
  description: 'Gitコミットが行われたときに発行されます',
  category: 'git',
  schema: {
    hash: 'コミットハッシュ',
    message: 'コミットメッセージ',
    author: '作者',
    files_changed: '変更されたファイル',
    related_tasks: '関連タスク'
  },
  examples: [
    `emitter.emitStandardized('git', 'committed', { 
      hash: 'commit-20250322-1',
      message: 'タスク管理JSONファイル形式の詳細化 #T007',
      author: 'AI Developer',
      files_changed: 5,
      related_tasks: ['T007']
    });`
  ]
});

// ストレージ関連イベント
eventCatalog.registerEvent('storage:fileCreated', {
  description: 'ファイルが作成されたときに発行されます',
  category: 'storage',
  schema: {
    path: 'ファイルパス',
    size: 'ファイルサイズ',
    content_type: 'コンテンツタイプ'
  },
  examples: [
    `emitter.emitStandardized('storage', 'fileCreated', { 
      path: 'ai-context/tasks/T011-implementation-strategy.md',
      size: 24560,
      content_type: 'text/markdown'
    });`
  ]
});

eventCatalog.registerEvent('storage:fileUpdated', {
  description: 'ファイルが更新されたときに発行されます',
  category: 'storage',
  schema: {
    path: 'ファイルパス',
    previous_size: '更新前のサイズ',
    new_size: '更新後のサイズ',
    changes: '変更内容'
  },
  examples: [
    `emitter.emitStandardized('storage', 'fileUpdated', { 
      path: 'ai-context/tasks/current-tasks.json',
      previous_size: 4096,
      new_size: 4256,
      changes: { added_tasks: ['T011'] }
    });`
  ]
});

// システム関連イベント
eventCatalog.registerEvent('system:initialized', {
  description: 'システムが初期化されたときに発行されます',
  category: 'system',
  schema: {
    version: 'システムバージョン',
    components: '初期化されたコンポーネント',
    startup_time: '起動時間（ミリ秒）'
  },
  examples: [
    `emitter.emitStandardized('system', 'initialized', { 
      version: '1.0.0',
      components: ['task', 'session', 'feedback'],
      startup_time: 1200
    });`
  ]
});

eventCatalog.registerEvent('system:error', {
  description: 'システムエラーが発生したときに発行されます',
  category: 'system',
  schema: {
    code: 'エラーコード',
    message: 'エラーメッセージ',
    component: 'エラーが発生したコンポーネント',
    stack: 'スタックトレース',
    recoverable: '回復可能かどうか'
  },
  examples: [
    `emitter.emitStandardized('system', 'error', { 
      code: 'ERR_VALIDATION',
      message: 'タスクIDが無効です',
      component: 'task-manager',
      recoverable: true
    });`
  ]
});

// イベント駆動アーキテクチャ関連イベント
eventCatalog.registerEvent('event:registered', {
  description: '新しいイベントがカタログに登録されたときに発行されます',
  category: 'meta',
  schema: {
    name: 'イベント名',
    category: 'カテゴリ',
    description: '説明'
  },
  examples: [
    `emitter.emitStandardized('event', 'registered', { 
      name: 'task:created',
      category: 'task',
      description: '新しいタスクが作成されたときに発行されます'
    });`
  ]
});

module.exports = eventCatalog;