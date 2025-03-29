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
    progress_percentage: '進捗率',
  },
  examples: [
    `emitter.emitStandardized('task', 'created', { 
      id: 'T001', 
      title: '基本ディレクトリ構造の設計',
      status: 'pending'
    });`,
  ],
});

eventCatalog.registerEvent('task:updated', {
  description: 'タスクが更新されたときに発行されます',
  category: 'task',
  schema: {
    id: 'タスクID',
    updates: '更新内容',
    previous: '更新前の値',
    current: '更新後の値',
  },
  examples: [
    `emitter.emitStandardized('task', 'updated', { 
      id: 'T001', 
      updates: { status: 'in_progress' },
      previous: { status: 'pending' },
      current: { status: 'in_progress' }
    });`,
  ],
});

eventCatalog.registerEvent('task:deleted', {
  description: 'タスクが削除されたときに発行されます',
  category: 'task',
  schema: {
    id: 'タスクID',
    reason: '削除理由',
  },
  examples: [
    `emitter.emitStandardized('task', 'deleted', { 
      id: 'T001', 
      reason: '重複タスクのため削除'
    });`,
  ],
});

eventCatalog.registerEvent('task:statusChanged', {
  description: 'タスクのステータスが変更されたときに発行されます',
  category: 'task',
  schema: {
    id: 'タスクID',
    previousStatus: '変更前のステータス',
    newStatus: '変更後のステータス',
    timestamp: '変更日時',
  },
  examples: [
    `emitter.emitStandardized('task', 'statusChanged', { 
      id: 'T001', 
      previousStatus: 'pending',
      newStatus: 'in_progress'
    });`,
  ],
});

// セッション関連イベント
eventCatalog.registerEvent('session:started', {
  description: '新しいセッションが開始されたときに発行されます',
  category: 'session',
  schema: {
    id: 'セッションID',
    timestamp: '開始時刻',
    project_id: 'プロジェクトID',
    previous_session_id: '前回のセッションID',
  },
  examples: [
    `emitter.emitStandardized('session', 'started', { 
      id: 'session-20250322-1',
      project_id: 'knoa'
    });`,
  ],
});

eventCatalog.registerEvent('session:ended', {
  description: 'セッションが終了したときに発行されます',
  category: 'session',
  schema: {
    id: 'セッションID',
    timestamp: '終了時刻',
    duration: 'セッション時間（秒）',
    completed_tasks: '完了したタスク',
  },
  examples: [
    `emitter.emitStandardized('session', 'ended', { 
      id: 'session-20250322-1',
      duration: 3600,
      completed_tasks: ['T001', 'T002']
    });`,
  ],
});

eventCatalog.registerEvent('session:handover', {
  description: 'セッション間の引継ぎが行われたときに発行されます',
  category: 'session',
  schema: {
    from_session_id: '引継ぎ元セッションID',
    to_session_id: '引継ぎ先セッションID',
    handover_data: '引継ぎデータ',
  },
  examples: [
    `emitter.emitStandardized('session', 'handover', { 
      from_session_id: 'session-20250322-1',
      to_session_id: 'session-20250322-2',
      handover_data: { current_focus: 'T011' }
    });`,
  ],
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
    severity: '重要度',
  },
  examples: [
    `emitter.emitStandardized('feedback', 'collected', { 
      id: 'F001',
      task_id: 'T001',
      content: 'ディレクトリ構造が複雑すぎる',
      type: 'improvement',
      severity: 'medium'
    });`,
  ],
});

eventCatalog.registerEvent('feedback:resolved', {
  description: 'フィードバックが解決されたときに発行されます',
  category: 'feedback',
  schema: {
    id: 'フィードバックID',
    resolution: '解決内容',
    resolution_time: '解決にかかった時間',
  },
  examples: [
    `emitter.emitStandardized('feedback', 'resolved', { 
      id: 'F001',
      resolution: 'ディレクトリ構造をシンプル化しました',
      resolution_time: 3600
    });`,
  ],
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
    related_tasks: '関連タスク',
  },
  examples: [
    `emitter.emitStandardized('git', 'committed', { 
      hash: 'commit-20250322-1',
      message: 'タスク管理JSONファイル形式の詳細化 #T007',
      author: 'AI Developer',
      files_changed: 5,
      related_tasks: ['T007']
    });`,
  ],
});

// ストレージ関連イベント
// ファイル読み込み関連イベント
eventCatalog.registerEvent('storage:file_read_before', {
  description: 'ファイル読み込み前に発行されます',
  category: 'storage',
  version: 1,
  schema: {
    directory: 'ディレクトリパス',
    filename: 'ファイル名',
    type: 'ファイルタイプ',
    traceId: 'トレースID',
    requestId: 'リクエストID',
  },
  examples: [
    `emitter.emitStandardized('storage', 'file_read_before', {
      directory: 'ai-context/feedback',
      filename: 'pending-feedback.json',
      type: 'json',
      traceId: 'trace-1234567890',
      requestId: 'req-1234567890'
    });`,
  ],
});

eventCatalog.registerEvent('storage:file_read_after', {
  description: 'ファイル読み込み後に発行されます',
  category: 'storage',
  version: 1,
  schema: {
    directory: 'ディレクトリパス',
    filename: 'ファイル名',
    type: 'ファイルタイプ',
    success: '成功したかどうか',
    error: 'エラー情報（失敗時）',
    traceId: 'トレースID',
    requestId: 'リクエストID',
  },
  examples: [
    `emitter.emitStandardized('storage', 'file_read_after', {
      directory: 'ai-context/feedback',
      filename: 'pending-feedback.json',
      type: 'json',
      success: true,
      traceId: 'trace-1234567890',
      requestId: 'req-1234567890'
    });`,
  ],
});

// ファイル書き込み関連イベント
eventCatalog.registerEvent('storage:file_write_before', {
  description: 'ファイル書き込み前に発行されます',
  category: 'storage',
  version: 1,
  schema: {
    directory: 'ディレクトリパス',
    filename: 'ファイル名',
    type: 'ファイルタイプ',
    traceId: 'トレースID',
    requestId: 'リクエストID',
  },
  examples: [
    `emitter.emitStandardized('storage', 'file_write_before', {
      directory: 'ai-context/feedback',
      filename: 'pending-feedback.json',
      type: 'json',
      traceId: 'trace-1234567890',
      requestId: 'req-1234567890'
    });`,
  ],
});

eventCatalog.registerEvent('storage:file_write_after', {
  description: 'ファイル書き込み後に発行されます',
  category: 'storage',
  version: 1,
  schema: {
    directory: 'ディレクトリパス',
    filename: 'ファイル名',
    type: 'ファイルタイプ',
    success: '成功したかどうか',
    error: 'エラー情報（失敗時）',
    traceId: 'トレースID',
    requestId: 'リクエストID',
  },
  examples: [
    `emitter.emitStandardized('storage', 'file_write_after', {
      directory: 'ai-context/feedback',
      filename: 'pending-feedback.json',
      type: 'json',
      success: true,
      traceId: 'trace-1234567890',
      requestId: 'req-1234567890'
    });`,
  ],
});

eventCatalog.registerEvent('storage:fileCreated', {
  description: 'ファイルが作成されたときに発行されます',
  category: 'storage',
  schema: {
    path: 'ファイルパス',
    size: 'ファイルサイズ',
    content_type: 'コンテンツタイプ',
  },
  examples: [
    `emitter.emitStandardized('storage', 'fileCreated', { 
      path: 'ai-context/tasks/T011-implementation-strategy.md',
      size: 24560,
      content_type: 'text/markdown'
    });`,
  ],
});

eventCatalog.registerEvent('storage:fileUpdated', {
  description: 'ファイルが更新されたときに発行されます',
  category: 'storage',
  schema: {
    path: 'ファイルパス',
    previous_size: '更新前のサイズ',
    new_size: '更新後のサイズ',
    changes: '変更内容',
  },
  examples: [
    `emitter.emitStandardized('storage', 'fileUpdated', { 
      path: 'ai-context/tasks/current-tasks.json',
      previous_size: 4096,
      new_size: 4256,
      changes: { added_tasks: ['T011'] }
    });`,
  ],
});

// システム関連イベント
eventCatalog.registerEvent('system:initialized', {
  description: 'システムが初期化されたときに発行されます',
  category: 'system',
  schema: {
    version: 'システムバージョン',
    components: '初期化されたコンポーネント',
    startup_time: '起動時間（ミリ秒）',
  },
  examples: [
    `emitter.emitStandardized('system', 'initialized', { 
      version: '1.0.0',
      components: ['task', 'session', 'feedback'],
      startup_time: 1200
    });`,
  ],
});

eventCatalog.registerEvent('system:error', {
  description: 'システムエラーが発生したときに発行されます',
  category: 'system',
  schema: {
    code: 'エラーコード',
    message: 'エラーメッセージ',
    component: 'エラーが発生したコンポーネント',
    stack: 'スタックトレース',
    recoverable: '回復可能かどうか',
  },
  examples: [
    `emitter.emitStandardized('system', 'error', { 
      code: 'ERR_VALIDATION',
      message: 'タスクIDが無効です',
      component: 'task-manager',
      recoverable: true
    });`,
  ],
});

// ロガー関連イベント
eventCatalog.registerEvent('log:message_created', {
  description: 'ログメッセージが作成されたときに発行されます',
  category: 'log',
  version: 1,
  schema: {
    level: 'ログレベル',
    message: 'ログメッセージ',
    context: 'コンテキスト情報',
    timestamp: 'タイムスタンプ',
    traceId: 'トレースID',
    requestId: 'リクエストID',
  },
  examples: [
    `emitter.emitStandardized('log', 'message_created', {
      level: 'info',
      message: 'システムが初期化されました',
      context: { component: 'system' },
      timestamp: '2025-03-23T05:32:05.412Z',
      traceId: 'trace-1742707925413-ujbwba8zz',
      requestId: 'req-1742707925413-b0240qt7m'
    });`,
  ],
});

eventCatalog.registerEvent('log:alert_created', {
  description: 'アラートログが作成されたときに発行されます',
  category: 'log',
  version: 1,
  schema: {
    level: 'ログレベル',
    message: 'アラートメッセージ',
    context: 'コンテキスト情報',
    timestamp: 'タイムスタンプ',
    traceId: 'トレースID',
    requestId: 'リクエストID',
  },
  examples: [
    `emitter.emitStandardized('log', 'alert_created', {
      level: 'error',
      message: 'システムエラーが発生しました',
      context: { component: 'system', error: 'Connection refused' },
      timestamp: '2025-03-23T05:32:05.412Z',
      traceId: 'trace-1742707925413-ujbwba8zz',
      requestId: 'req-1742707925413-b0240qt7m'
    });`,
  ],
});

eventCatalog.registerEvent('log:transport_added', {
  description: 'ログトランスポートが追加されたときに発行されます',
  category: 'log',
  version: 1,
  schema: {
    type: 'トランスポートタイプ',
    timestamp: 'タイムスタンプ',
    traceId: 'トレースID',
    requestId: 'リクエストID',
  },
  examples: [
    `emitter.emitStandardized('log', 'transport_added', {
      type: 'file',
      timestamp: '2025-03-23T05:32:05.412Z',
      traceId: 'trace-1742707925413-ujbwba8zz',
      requestId: 'req-1742707925413-b0240qt7m'
    });`,
  ],
});

eventCatalog.registerEvent('log:context_provider_added', {
  description: 'ログコンテキストプロバイダが追加されたときに発行されます',
  category: 'log',
  version: 1,
  schema: {
    key: 'プロバイダキー',
    timestamp: 'タイムスタンプ',
    traceId: 'トレースID',
    requestId: 'リクエストID',
  },
  examples: [
    `emitter.emitStandardized('log', 'context_provider_added', {
      key: 'user',
      timestamp: '2025-03-23T05:32:05.412Z',
      traceId: 'trace-1742707925413-ujbwba8zz',
      requestId: 'req-1742707925413-b0240qt7m'
    });`,
  ],
});

// キャッシュ関連イベント
eventCatalog.registerEvent('cache:system_initialized', {
  description: 'キャッシュシステムが初期化されたときに発行されます',
  category: 'cache',
  version: 1,
  schema: {
    ttlMs: 'TTL（ミリ秒）',
    maxSize: '最大キャッシュサイズ',
    timestamp: 'タイムスタンプ',
    traceId: 'トレースID',
    requestId: 'リクエストID',
  },
  examples: [
    `emitter.emitStandardized('cache', 'system_initialized', {
      ttlMs: 300000,
      maxSize: 1000,
      timestamp: '2025-03-23T05:32:05.412Z',
      traceId: 'trace-1742707925413-ujbwba8zz',
      requestId: 'req-1742707925413-b0240qt7m'
    });`,
  ],
});

eventCatalog.registerEvent('cache:item_set', {
  description: 'キャッシュアイテムが設定されたときに発行されます',
  category: 'cache',
  version: 1,
  schema: {
    key: 'キャッシュキー',
    ttl: 'TTL（ミリ秒）',
    timestamp: 'タイムスタンプ',
    traceId: 'トレースID',
    requestId: 'リクエストID',
  },
  examples: [
    `emitter.emitStandardized('cache', 'item_set', {
      key: 'user:123',
      ttl: 300000,
      timestamp: '2025-03-23T05:32:05.412Z',
      traceId: 'trace-1742707925413-ujbwba8zz',
      requestId: 'req-1742707925413-b0240qt7m'
    });`,
  ],
});

// イベント駆動アーキテクチャ関連イベント
eventCatalog.registerEvent('event:registered', {
  description: '新しいイベントがカタログに登録されたときに発行されます',
  category: 'meta',
  schema: {
    name: 'イベント名',
    category: 'カテゴリ',
    description: '説明',
  },
  examples: [
    `emitter.emitStandardized('event', 'registered', {
      name: 'task:created',
      category: 'task',
      description: '新しいタスクが作成されたときに発行されます'
    });`,
  ],
});

// StorageServiceの標準化されたイベント
eventCatalog.registerEvent('storage:file_read_before', {
  description: 'ファイル読み込み前に発行されます',
  category: 'storage',
  version: 1,
  schema: {
    directory: 'ディレクトリパス',
    filename: 'ファイル名',
    type: 'ファイルタイプ',
    timestamp: 'タイムスタンプ',
    traceId: 'トレースID',
    requestId: 'リクエストID',
    component: 'コンポーネント名',
  },
  examples: [
    `emitter.emitStandardized('storage', 'file_read_before', {
      directory: 'ai-context/feedback',
      filename: 'pending-feedback.json',
      type: 'json',
      timestamp: '2025-03-23T05:32:05.412Z',
      traceId: 'trace-1742707925413-ujbwba8zz',
      requestId: 'req-1742707925413-b0240qt7m',
      component: 'storage'
    });`,
  ],
});

eventCatalog.registerEvent('storage:file_read_after', {
  description: 'ファイル読み込み後に発行されます',
  category: 'storage',
  version: 1,
  schema: {
    directory: 'ディレクトリパス',
    filename: 'ファイル名',
    type: 'ファイルタイプ',
    success: '成功したかどうか',
    error: 'エラー情報（失敗時）',
    timestamp: 'タイムスタンプ',
    traceId: 'トレースID',
    requestId: 'リクエストID',
    component: 'コンポーネント名',
  },
  examples: [
    `emitter.emitStandardized('storage', 'file_read_after', {
      directory: 'ai-context/feedback',
      filename: 'pending-feedback.json',
      type: 'json',
      success: true,
      timestamp: '2025-03-23T05:32:05.412Z',
      traceId: 'trace-1742707925413-ujbwba8zz',
      requestId: 'req-1742707925413-b0240qt7m',
      component: 'storage'
    });`,
  ],
});

eventCatalog.registerEvent('storage:file_write_before', {
  description: 'ファイル書き込み前に発行されます',
  category: 'storage',
  version: 1,
  schema: {
    directory: 'ディレクトリパス',
    filename: 'ファイル名',
    type: 'ファイルタイプ',
    timestamp: 'タイムスタンプ',
    traceId: 'トレースID',
    requestId: 'リクエストID',
    component: 'コンポーネント名',
  },
  examples: [
    `emitter.emitStandardized('storage', 'file_write_before', {
      directory: 'ai-context/feedback',
      filename: 'pending-feedback.json',
      type: 'json',
      timestamp: '2025-03-23T05:32:05.412Z',
      traceId: 'trace-1742707925413-ujbwba8zz',
      requestId: 'req-1742707925413-b0240qt7m',
      component: 'storage'
    });`,
  ],
});

eventCatalog.registerEvent('storage:file_write_after', {
  description: 'ファイル書き込み後に発行されます',
  category: 'storage',
  version: 1,
  schema: {
    directory: 'ディレクトリパス',
    filename: 'ファイル名',
    type: 'ファイルタイプ',
    success: '成功したかどうか',
    error: 'エラー情報（失敗時）',
    timestamp: 'タイムスタンプ',
    traceId: 'トレースID',
    requestId: 'リクエストID',
    component: 'コンポーネント名',
  },
  examples: [
    `emitter.emitStandardized('storage', 'file_write_after', {
      directory: 'ai-context/feedback',
      filename: 'pending-feedback.json',
      type: 'json',
      success: true,
      timestamp: '2025-03-23T05:32:05.412Z',
      traceId: 'trace-1742707925413-ujbwba8zz',
      requestId: 'req-1742707925413-b0240qt7m',
      component: 'storage'
    });`,
  ],
});

eventCatalog.registerEvent('storage:file_update_before', {
  description: 'ファイル更新前に発行されます',
  category: 'storage',
  version: 1,
  schema: {
    directory: 'ディレクトリパス',
    filename: 'ファイル名',
    type: 'ファイルタイプ',
    timestamp: 'タイムスタンプ',
    traceId: 'トレースID',
    requestId: 'リクエストID',
    component: 'コンポーネント名',
  },
  examples: [
    `emitter.emitStandardized('storage', 'file_update_before', {
      directory: 'ai-context/feedback',
      filename: 'pending-feedback.json',
      type: 'json',
      timestamp: '2025-03-23T05:32:05.412Z',
      traceId: 'trace-1742707925413-ujbwba8zz',
      requestId: 'req-1742707925413-b0240qt7m',
      component: 'storage'
    });`,
  ],
});

eventCatalog.registerEvent('storage:file_update_after', {
  description: 'ファイル更新後に発行されます',
  category: 'storage',
  version: 1,
  schema: {
    directory: 'ディレクトリパス',
    filename: 'ファイル名',
    type: 'ファイルタイプ',
    success: '成功したかどうか',
    error: 'エラー情報（失敗時）',
    timestamp: 'タイムスタンプ',
    traceId: 'トレースID',
    requestId: 'リクエストID',
    component: 'コンポーネント名',
  },
  examples: [
    `emitter.emitStandardized('storage', 'file_update_after', {
      directory: 'ai-context/feedback',
      filename: 'pending-feedback.json',
      type: 'json',
      success: true,
      timestamp: '2025-03-23T05:32:05.412Z',
      traceId: 'trace-1742707925413-ujbwba8zz',
      requestId: 'req-1742707925413-b0240qt7m',
      component: 'storage'
    });`,
  ],
});

eventCatalog.registerEvent('storage:directory_list_before', {
  description: 'ディレクトリ一覧取得前に発行されます',
  category: 'storage',
  version: 1,
  schema: {
    directory: 'ディレクトリパス',
    pattern: 'ファイル名パターン',
    timestamp: 'タイムスタンプ',
    traceId: 'トレースID',
    requestId: 'リクエストID',
    component: 'コンポーネント名',
  },
  examples: [
    `emitter.emitStandardized('storage', 'directory_list_before', {
      directory: 'ai-context/feedback',
      pattern: '*.json',
      timestamp: '2025-03-23T05:32:05.412Z',
      traceId: 'trace-1742707925413-ujbwba8zz',
      requestId: 'req-1742707925413-b0240qt7m',
      component: 'storage'
    });`,
  ],
});

eventCatalog.registerEvent('storage:directory_list_after', {
  description: 'ディレクトリ一覧取得後に発行されます',
  category: 'storage',
  version: 1,
  schema: {
    directory: 'ディレクトリパス',
    pattern: 'ファイル名パターン',
    count: 'ファイル数',
    success: '成功したかどうか',
    error: 'エラー情報（失敗時）',
    timestamp: 'タイムスタンプ',
    traceId: 'トレースID',
    requestId: 'リクエストID',
    component: 'コンポーネント名',
  },
  examples: [
    `emitter.emitStandardized('storage', 'directory_list_after', {
      directory: 'ai-context/feedback',
      pattern: '*.json',
      count: 5,
      success: true,
      timestamp: '2025-03-23T05:32:05.412Z',
      traceId: 'trace-1742707925413-ujbwba8zz',
      requestId: 'req-1742707925413-b0240qt7m',
      component: 'storage'
    });`,
  ],
});

eventCatalog.registerEvent('storage:file_delete_before', {
  description: 'ファイル削除前に発行されます',
  category: 'storage',
  version: 1,
  schema: {
    directory: 'ディレクトリパス',
    filename: 'ファイル名',
    timestamp: 'タイムスタンプ',
    traceId: 'トレースID',
    requestId: 'リクエストID',
    component: 'コンポーネント名',
  },
  examples: [
    `emitter.emitStandardized('storage', 'file_delete_before', {
      directory: 'ai-context/feedback',
      filename: 'pending-feedback.json',
      timestamp: '2025-03-23T05:32:05.412Z',
      traceId: 'trace-1742707925413-ujbwba8zz',
      requestId: 'req-1742707925413-b0240qt7m',
      component: 'storage'
    });`,
  ],
});

eventCatalog.registerEvent('storage:file_delete_after', {
  description: 'ファイル削除後に発行されます',
  category: 'storage',
  version: 1,
  schema: {
    directory: 'ディレクトリパス',
    filename: 'ファイル名',
    success: '成功したかどうか',
    error: 'エラー情報（失敗時）',
    timestamp: 'タイムスタンプ',
    traceId: 'トレースID',
    requestId: 'リクエストID',
    component: 'コンポーネント名',
  },
  examples: [
    `emitter.emitStandardized('storage', 'file_delete_after', {
      directory: 'ai-context/feedback',
      filename: 'pending-feedback.json',
      success: true,
      timestamp: '2025-03-23T05:32:05.412Z',
      traceId: 'trace-1742707925413-ujbwba8zz',
      requestId: 'req-1742707925413-b0240qt7m',
      component: 'storage'
    });`,
  ],
});

// TaskManagerの標準化されたイベント
eventCatalog.registerEvent('task:task_created', {
  description: '新しいタスクが作成されたときに発行されます',
  category: 'task',
  version: 1,
  schema: {
    id: 'タスクID',
    title: 'タスクのタイトル',
    description: 'タスクの説明',
    status: 'タスクのステータス',
    timestamp: 'タイムスタンプ',
    traceId: 'トレースID',
    requestId: 'リクエストID',
    component: 'コンポーネント名',
  },
  examples: [
    `emitter.emitStandardized('task', 'task_created', {
      id: 'T001',
      title: '基本ディレクトリ構造の設計',
      status: 'pending',
      timestamp: '2025-03-23T05:32:05.412Z',
      traceId: 'trace-1742707925413-ujbwba8zz',
      requestId: 'req-1742707925413-b0240qt7m',
      component: 'task'
    });`,
  ],
});

eventCatalog.registerEvent('task:task_updated', {
  description: 'タスクが更新されたときに発行されます',
  category: 'task',
  version: 1,
  schema: {
    id: 'タスクID',
    updates: '更新内容',
    previous: '更新前の値',
    current: '更新後の値',
    timestamp: 'タイムスタンプ',
    traceId: 'トレースID',
    requestId: 'リクエストID',
    component: 'コンポーネント名',
  },
  examples: [
    `emitter.emitStandardized('task', 'task_updated', {
      id: 'T001',
      updates: { status: 'in_progress' },
      previous: { status: 'pending' },
      current: { status: 'in_progress' },
      timestamp: '2025-03-23T05:32:05.412Z',
      traceId: 'trace-1742707925413-ujbwba8zz',
      requestId: 'req-1742707925413-b0240qt7m',
      component: 'task'
    });`,
  ],
});

eventCatalog.registerEvent('task:task_deleted', {
  description: 'タスクが削除されたときに発行されます',
  category: 'task',
  version: 1,
  schema: {
    id: 'タスクID',
    reason: '削除理由',
    timestamp: 'タイムスタンプ',
    traceId: 'トレースID',
    requestId: 'リクエストID',
    component: 'コンポーネント名',
  },
  examples: [
    `emitter.emitStandardized('task', 'task_deleted', {
      id: 'T001',
      reason: '重複タスクのため削除',
      timestamp: '2025-03-23T05:32:05.412Z',
      traceId: 'trace-1742707925413-ujbwba8zz',
      requestId: 'req-1742707925413-b0240qt7m',
      component: 'task'
    });`,
  ],
});

eventCatalog.registerEvent('task:status_changed', {
  description: 'タスクのステータスが変更されたときに発行されます',
  category: 'task',
  version: 1,
  schema: {
    id: 'タスクID',
    previousStatus: '変更前のステータス',
    newStatus: '変更後のステータス',
    timestamp: 'タイムスタンプ',
    traceId: 'トレースID',
    requestId: 'リクエストID',
    component: 'コンポーネント名',
  },
  examples: [
    `emitter.emitStandardized('task', 'status_changed', {
      id: 'T001',
      previousStatus: 'pending',
      newStatus: 'in_progress',
      timestamp: '2025-03-23T05:32:05.412Z',
      traceId: 'trace-1742707925413-ujbwba8zz',
      requestId: 'req-1742707925413-b0240qt7m',
      component: 'task'
    });`,
  ],
});

eventCatalog.registerEvent('task:system_initialized', {
  description: 'タスク管理システムが初期化されたときに発行されます',
  category: 'task',
  version: 1,
  schema: {
    timestamp: 'タイムスタンプ',
    traceId: 'トレースID',
    requestId: 'リクエストID',
    component: 'コンポーネント名',
  },
  examples: [
    `emitter.emitStandardized('task', 'system_initialized', {
      timestamp: '2025-03-23T05:32:05.412Z',
      traceId: 'trace-1742707925413-ujbwba8zz',
      requestId: 'req-1742707925413-b0240qt7m',
      component: 'task'
    });`,
  ],
});

// SessionManagerの標準化されたイベント
eventCatalog.registerEvent('session:session_started', {
  description: '新しいセッションが開始されたときに発行されます',
  category: 'session',
  version: 1,
  schema: {
    sessionId: 'セッションID',
    previousSessionId: '前回のセッションID',
    timestamp: 'タイムスタンプ',
    traceId: 'トレースID',
    requestId: 'リクエストID',
    component: 'コンポーネント名',
  },
  examples: [
    `emitter.emitStandardized('session', 'session_started', {
      sessionId: 'session-20250322-1',
      previousSessionId: 'session-20250321-3',
      timestamp: '2025-03-23T05:32:05.412Z',
      traceId: 'trace-1742707925413-ujbwba8zz',
      requestId: 'req-1742707925413-b0240qt7m',
      component: 'session'
    });`,
  ],
});

eventCatalog.registerEvent('session:session_ended', {
  description: 'セッションが終了したときに発行されます',
  category: 'session',
  version: 1,
  schema: {
    sessionId: 'セッションID',
    duration: 'セッション時間（秒）',
    completedTasks: '完了したタスク',
    timestamp: 'タイムスタンプ',
    traceId: 'トレースID',
    requestId: 'リクエストID',
    component: 'コンポーネント名',
  },
  examples: [
    `emitter.emitStandardized('session', 'session_ended', {
      sessionId: 'session-20250322-1',
      duration: 3600,
      completedTasks: ['T001', 'T002'],
      timestamp: '2025-03-23T05:32:05.412Z',
      traceId: 'trace-1742707925413-ujbwba8zz',
      requestId: 'req-1742707925413-b0240qt7m',
      component: 'session'
    });`,
  ],
});

eventCatalog.registerEvent('session:handover_created', {
  description: 'セッション間の引継ぎが作成されたときに発行されます',
  category: 'session',
  version: 1,
  schema: {
    fromSessionId: '引継ぎ元セッションID',
    toSessionId: '引継ぎ先セッションID',
    handoverData: '引継ぎデータ',
    timestamp: 'タイムスタンプ',
    traceId: 'トレースID',
    requestId: 'リクエストID',
    component: 'コンポーネント名',
  },
  examples: [
    `emitter.emitStandardized('session', 'handover_created', {
      fromSessionId: 'session-20250322-1',
      toSessionId: 'session-20250322-2',
      handoverData: { current_focus: 'T011' },
      timestamp: '2025-03-23T05:32:05.412Z',
      traceId: 'trace-1742707925413-ujbwba8zz',
      requestId: 'req-1742707925413-b0240qt7m',
      component: 'session'
    });`,
  ],
});

eventCatalog.registerEvent('session:system_initialized', {
  description: 'セッション管理システムが初期化されたときに発行されます',
  category: 'session',
  version: 1,
  schema: {
    timestamp: 'タイムスタンプ',
    traceId: 'トレースID',
    requestId: 'リクエストID',
    component: 'コンポーネント名',
  },
  examples: [
    `emitter.emitStandardized('session', 'system_initialized', {
      timestamp: '2025-03-23T05:32:05.412Z',
      traceId: 'trace-1742707925413-ujbwba8zz',
      requestId: 'req-1742707925413-b0240qt7m',
      component: 'session'
    });`,
  ],
});

// FeedbackManagerの標準化されたイベント
eventCatalog.registerEvent('feedback:feedback_collected', {
  description: 'フィードバックが収集されたときに発行されます',
  category: 'feedback',
  version: 1,
  schema: {
    id: 'フィードバックID',
    taskId: 'タスクID',
    content: 'フィードバック内容',
    type: 'フィードバックタイプ',
    severity: '重要度',
    timestamp: 'タイムスタンプ',
    traceId: 'トレースID',
    requestId: 'リクエストID',
    component: 'コンポーネント名',
  },
  examples: [
    `emitter.emitStandardized('feedback', 'feedback_collected', {
      id: 'F001',
      taskId: 'T001',
      content: 'ディレクトリ構造が複雑すぎる',
      type: 'improvement',
      severity: 'medium',
      timestamp: '2025-03-23T05:32:05.412Z',
      traceId: 'trace-1742707925413-ujbwba8zz',
      requestId: 'req-1742707925413-b0240qt7m',
      component: 'feedback'
    });`,
  ],
});

eventCatalog.registerEvent('feedback:feedback_resolved', {
  description: 'フィードバックが解決されたときに発行されます',
  category: 'feedback',
  version: 1,
  schema: {
    id: 'フィードバックID',
    resolution: '解決内容',
    resolutionTime: '解決にかかった時間',
    timestamp: 'タイムスタンプ',
    traceId: 'トレースID',
    requestId: 'リクエストID',
    component: 'コンポーネント名',
  },
  examples: [
    `emitter.emitStandardized('feedback', 'feedback_resolved', {
      id: 'F001',
      resolution: 'ディレクトリ構造をシンプル化しました',
      resolutionTime: 3600,
      timestamp: '2025-03-23T05:32:05.412Z',
      traceId: 'trace-1742707925413-ujbwba8zz',
      requestId: 'req-1742707925413-b0240qt7m',
      component: 'feedback'
    });`,
  ],
});

eventCatalog.registerEvent('feedback:system_initialized', {
  description: 'フィードバック管理システムが初期化されたときに発行されます',
  category: 'feedback',
  version: 1,
  schema: {
    timestamp: 'タイムスタンプ',
    traceId: 'トレースID',
    requestId: 'リクエストID',
    component: 'コンポーネント名',
  },
  examples: [
    `emitter.emitStandardized('feedback', 'system_initialized', {
      timestamp: '2025-03-23T05:32:05.412Z',
      traceId: 'trace-1742707925413-ujbwba8zz',
      requestId: 'req-1742707925413-b0240qt7m',
      component: 'feedback'
    });`,
  ],
});

// IntegrationManagerの標準化されたイベント
eventCatalog.registerEvent('integration:system_initialized', {
  description: '統合管理システムが初期化されたときに発行されます',
  category: 'integration',
  version: 1,
  schema: {
    syncInterval: '同期間隔（ミリ秒）',
    enablePeriodicSync: '定期同期が有効かどうか',
    timestamp: 'タイムスタンプ',
    traceId: 'トレースID',
    requestId: 'リクエストID',
    component: 'コンポーネント名',
  },
  examples: [
    `emitter.emitStandardized('integration', 'system_initialized', {
      syncInterval: 60000,
      enablePeriodicSync: true,
      timestamp: '2025-03-23T05:32:05.412Z',
      traceId: 'trace-1742707925413-ujbwba8zz',
      requestId: 'req-1742707925413-b0240qt7m',
      component: 'integration'
    });`,
  ],
});

eventCatalog.registerEvent('integration:workflow_initialized', {
  description: 'ワークフローが初期化されたときに発行されます',
  category: 'integration',
  version: 1,
  schema: {
    projectId: 'プロジェクトID',
    sessionId: 'セッションID',
    taskCount: 'タスク数',
    timestamp: 'タイムスタンプ',
    traceId: 'トレースID',
    requestId: 'リクエストID',
    component: 'コンポーネント名',
  },
  examples: [
    `emitter.emitStandardized('integration', 'workflow_initialized', {
      projectId: 'knoa',
      sessionId: 'session-20250322-1',
      taskCount: 5,
      timestamp: '2025-03-23T05:32:05.412Z',
      traceId: 'trace-1742707925413-ujbwba8zz',
      requestId: 'req-1742707925413-b0240qt7m',
      component: 'integration'
    });`,
  ],
});

module.exports = eventCatalog;
