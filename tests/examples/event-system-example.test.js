/**
 * イベントシステムの使用例のテスト
 */

const { EnhancedEventEmitter, EventCatalog } = require('../../src/lib/core/event-system');
const eventCatalog = require('../../src/lib/core/event-catalog');
const { EventMigrationHelper } = require('../../src/lib/core/event-migration-helper');

describe('イベントシステムの使用例', () => {
  let emitter;
  let migrationHelper;
  let mockLogger;
  
  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };
    
    emitter = new EnhancedEventEmitter({
      debugMode: true,
      keepHistory: true,
      historyLimit: 100,
      logger: mockLogger
    });
    
    emitter.setCatalog(eventCatalog);
    
    migrationHelper = new EventMigrationHelper(emitter, {
      debugMode: true,
      logger: mockLogger
    });
  });
  
  describe('タスク管理システム', () => {
    let taskManager;
    let wrappedTaskManager;
    
    beforeEach(() => {
      // タスク管理クラス
      class TaskManager {
        constructor() {
          this.tasks = new Map();
          this.nextId = 1;
        }
        
        createTask(data) {
          const id = `T${String(this.nextId++).padStart(3, '0')}`;
          const task = {
            id,
            title: data.title || 'Untitled Task',
            description: data.description || '',
            status: data.status || 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          this.tasks.set(id, task);
          mockLogger.info(`タスク作成: ${id} - ${task.title}`);
          
          return task;
        }
        
        updateTask(id, updates) {
          if (!this.tasks.has(id)) {
            throw new Error(`タスク ${id} が見つかりません`);
          }
          
          const task = this.tasks.get(id);
          const previousStatus = task.status;
          
          // 更新を適用
          Object.assign(task, updates, {
            updated_at: new Date().toISOString()
          });
          
          mockLogger.info(`タスク更新: ${id} - ${task.title}`);
          
          // ステータスが変更された場合
          if (previousStatus !== task.status) {
            mockLogger.info(`タスクステータス変更: ${id} - ${previousStatus} → ${task.status}`);
          }
          
          return task;
        }
        
        deleteTask(id) {
          if (!this.tasks.has(id)) {
            throw new Error(`タスク ${id} が見つかりません`);
          }
          
          this.tasks.delete(id);
          mockLogger.info(`タスク削除: ${id}`);
          
          return true;
        }
        
        getTask(id) {
          if (!this.tasks.has(id)) {
            throw new Error(`タスク ${id} が見つかりません`);
          }
          
          return this.tasks.get(id);
        }
        
        getAllTasks() {
          return Array.from(this.tasks.values());
        }
      }
      
      // メソッドとイベントのマッピング
      const taskMethodToEventMap = {
        createTask: 'task:created',
        updateTask: 'task:updated',
        deleteTask: 'task:deleted',
        getTask: 'task:accessed',
        getAllTasks: 'task:listAccessed'
      };
      
      // 移行ラッパーの作成
      taskManager = new TaskManager();
      wrappedTaskManager = migrationHelper.createMigrationWrapper(
        taskManager,
        'task',
        taskMethodToEventMap
      );
    });
    
    test('タスクの作成と更新が正しく動作する', () => {
      // イベントリスナーの登録
      const createdListener = jest.fn();
      const updatedListener = jest.fn();
      const statusChangedListener = jest.fn();
      
      emitter.on('task:created', createdListener);
      emitter.on('task:updated', updatedListener);
      emitter.on('task:statusChanged', statusChangedListener);
      
      // タスクの作成
      const task = wrappedTaskManager.createTask({
        title: 'イベントシステムの実装',
        description: 'イベント駆動アーキテクチャを実装する',
        status: 'in_progress'
      });
      
      // タスクの更新
      wrappedTaskManager.updateTask(task.id, {
        status: 'completed'
      });
      
      // 検証
      expect(task).toBeDefined();
      expect(task.id).toBe('T001');
      expect(task.title).toBe('イベントシステムの実装');
      expect(task.status).toBe('in_progress');
      
      // イベントリスナーの検証
      expect(createdListener).toHaveBeenCalled();
      const createdEvent = createdListener.mock.calls[0][0];
      expect(createdEvent.title).toBe('イベントシステムの実装');
      
      expect(updatedListener).toHaveBeenCalled();
      const updatedEvent = updatedListener.mock.calls[0][0];
      expect(updatedEvent.id).toBe('T001');
      expect(updatedEvent.status).toBe('completed');
      
      // ステータス変更イベントは発行されていない（直接メソッド呼び出しのため）
      expect(statusChangedListener).not.toHaveBeenCalled();
      
      // 移行レポートの検証
      const report = migrationHelper.generateMigrationReport();
      expect(report.directMethods).toHaveLength(2);
      expect(report.eventMethods).toHaveLength(2);
      expect(report.migrationProgress.totalDirectCalls).toBe(2);
      expect(report.migrationProgress.totalEventCalls).toBe(2);
    });
  });
  
  describe('セッション管理システム', () => {
    let sessionManager;
    let wrappedSessionManager;
    
    beforeEach(() => {
      // セッション管理クラス
      class SessionManager {
        constructor() {
          this.sessions = new Map();
          this.currentSession = null;
        }
        
        startSession(data) {
          const id = `session-${new Date().toISOString().replace(/[:.]/g, '-')}`;
          const session = {
            id,
            project_id: data.project_id || 'default',
            start_time: new Date().toISOString(),
            end_time: null,
            status: 'active',
            ...data
          };
          
          this.sessions.set(id, session);
          this.currentSession = session;
          
          mockLogger.info(`セッション開始: ${id}`);
          
          return session;
        }
        
        endSession(id) {
          if (!this.sessions.has(id)) {
            throw new Error(`セッション ${id} が見つかりません`);
          }
          
          const session = this.sessions.get(id);
          session.end_time = new Date().toISOString();
          session.status = 'completed';
          
          if (this.currentSession && this.currentSession.id === id) {
            this.currentSession = null;
          }
          
          mockLogger.info(`セッション終了: ${id}`);
          
          return session;
        }
        
        getCurrentSession() {
          return this.currentSession;
        }
      }
      
      // メソッドとイベントのマッピング
      const sessionMethodToEventMap = {
        startSession: 'session:started',
        endSession: 'session:ended',
        getCurrentSession: 'session:accessed'
      };
      
      // 移行ラッパーの作成
      sessionManager = new SessionManager();
      wrappedSessionManager = migrationHelper.createMigrationWrapper(
        sessionManager,
        'session',
        sessionMethodToEventMap
      );
    });
    
    test('セッションの開始と終了が正しく動作する', () => {
      // イベントリスナーの登録
      const startedListener = jest.fn();
      const endedListener = jest.fn();
      
      emitter.on('session:started', startedListener);
      emitter.on('session:ended', endedListener);
      
      // セッションの開始
      const session = wrappedSessionManager.startSession({
        project_id: 'knoa',
        user_id: 'user-001'
      });
      
      // セッションの終了
      const endedSession = wrappedSessionManager.endSession(session.id);
      
      // 検証
      expect(session).toBeDefined();
      expect(session.id).toMatch(/^session-/);
      expect(session.project_id).toBe('knoa');
      expect(session.user_id).toBe('user-001');
      expect(session.status).toBe('active');
      
      expect(endedSession).toBeDefined();
      expect(endedSession.id).toBe(session.id);
      expect(endedSession.status).toBe('completed');
      expect(endedSession.end_time).toBeDefined();
      
      // イベントリスナーの検証
      expect(startedListener).toHaveBeenCalled();
      const startedEvent = startedListener.mock.calls[0][0];
      expect(startedEvent.project_id).toBe('knoa');
      
      expect(endedListener).toHaveBeenCalled();
      const endedEvent = endedListener.mock.calls[0][0];
      expect(endedEvent.id).toBe(session.id);
      
      // 移行レポートの検証
      const report = migrationHelper.generateMigrationReport();
      expect(report.directMethods).toHaveLength(2);
      expect(report.eventMethods).toHaveLength(2);
      expect(report.migrationProgress.totalDirectCalls).toBe(2);
      expect(report.migrationProgress.totalEventCalls).toBe(2);
    });
  });
  
  describe('イベント連携', () => {
    let taskManager;
    let wrappedTaskManager;
    let sessionManager;
    let wrappedSessionManager;
    
    beforeEach(() => {
      // タスク管理クラス
      class TaskManager {
        constructor() {
          this.tasks = new Map();
          this.nextId = 1;
        }
        
        createTask(data) {
          const id = `T${String(this.nextId++).padStart(3, '0')}`;
          const task = {
            id,
            title: data.title || 'Untitled Task',
            description: data.description || '',
            status: data.status || 'pending',
            created_at: new Date().toISOString()
          };
          
          this.tasks.set(id, task);
          return task;
        }
        
        updateTask(id, updates) {
          if (!this.tasks.has(id)) {
            throw new Error(`タスク ${id} が見つかりません`);
          }
          
          const task = this.tasks.get(id);
          Object.assign(task, updates);
          return task;
        }
      }
      
      // セッション管理クラス
      class SessionManager {
        constructor() {
          this.sessions = new Map();
          this.currentSession = null;
        }
        
        startSession(data) {
          const id = `session-${new Date().toISOString().replace(/[:.]/g, '-')}`;
          const session = {
            id,
            project_id: data.project_id || 'default',
            start_time: new Date().toISOString(),
            tasks: [],
            ...data
          };
          
          this.sessions.set(id, session);
          this.currentSession = session;
          return session;
        }
        
        addTaskToSession(sessionId, taskId) {
          if (!this.sessions.has(sessionId)) {
            throw new Error(`セッション ${sessionId} が見つかりません`);
          }
          
          const session = this.sessions.get(sessionId);
          if (!session.tasks.includes(taskId)) {
            session.tasks.push(taskId);
          }
          
          return session;
        }
      }
      
      // メソッドとイベントのマッピング
      const taskMethodToEventMap = {
        createTask: 'task:created',
        updateTask: 'task:updated'
      };
      
      const sessionMethodToEventMap = {
        startSession: 'session:started',
        addTaskToSession: 'session:taskAdded'
      };
      
      // 移行ラッパーの作成
      taskManager = new TaskManager();
      wrappedTaskManager = migrationHelper.createMigrationWrapper(
        taskManager,
        'task',
        taskMethodToEventMap
      );
      
      sessionManager = new SessionManager();
      wrappedSessionManager = migrationHelper.createMigrationWrapper(
        sessionManager,
        'session',
        sessionMethodToEventMap
      );
      
      // イベントリスナーの登録
      emitter.on('task:created', (data) => {
        mockLogger.info(`[EVENT] タスク作成イベント受信: ${data.id} - ${data.title}`);
        
        // 現在のセッションがあれば、タスクを追加
        const currentSession = sessionManager.currentSession;
        if (currentSession) {
          wrappedSessionManager.addTaskToSession(currentSession.id, data.id);
          
          // 通知イベントを発行
          emitter.emitStandardized('notification', 'created', {
            type: 'task_created',
            message: `新しいタスク「${data.title}」が作成されました`,
            task_id: data.id,
            session_id: currentSession.id
          });
        }
      });
      
      emitter.on('task:updated', (data) => {
        mockLogger.info(`[EVENT] タスク更新イベント受信: ${data.id}`);
        
        // ステータス変更の検出
        if (data.status === 'completed') {
          emitter.emitStandardized('task', 'statusChanged', {
            id: data.id,
            previousStatus: 'unknown',
            newStatus: 'completed'
          });
        }
      });
      
      emitter.on('task:statusChanged', (data) => {
        mockLogger.info(`[EVENT] タスクステータス変更イベント受信: ${data.id} - ${data.previousStatus} → ${data.newStatus}`);
        
        // ステータスが「completed」に変更された場合
        if (data.newStatus === 'completed') {
          emitter.emitStandardized('notification', 'created', {
            type: 'task_completed',
            message: `タスク ${data.id} が完了しました`,
            task_id: data.id
          });
        }
      });
      
      // ワイルドカードリスナー
      emitter.on('notification:*', (data, eventName) => {
        mockLogger.info(`[NOTIFICATION] ${eventName}: ${data.message}`);
      });
    });
    
    test('イベント連携が正しく動作する', () => {
      // セッションの開始
      const session = wrappedSessionManager.startSession({
        project_id: 'knoa',
        user_id: 'user-001'
      });
      
      // タスクの作成
      const task = wrappedTaskManager.createTask({
        title: 'イベントシステムの実装',
        description: 'イベント駆動アーキテクチャを実装する'
      });
      
      // タスクの更新
      wrappedTaskManager.updateTask(task.id, {
        status: 'completed'
      });
      
      // 検証
      expect(session.tasks).toContain(task.id);
      
      // ログの検証
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('[EVENT] タスク作成イベント受信'));
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('[EVENT] タスク更新イベント受信'));
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('[EVENT] タスクステータス変更イベント受信'));
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('[NOTIFICATION] notification:created'));
      
      // イベント履歴の検証
      const history = emitter.getEventHistory();
      expect(history.length).toBeGreaterThanOrEqual(7); // session:started, task:created, session:taskAdded, notification:created, task:updated, task:statusChanged, notification:created
    });
  });
  
  describe('カタログに登録されているイベントの発行', () => {
    test('カタログに登録されているイベントを発行できる', () => {
      // イベントリスナーの登録
      const initializedListener = jest.fn();
      emitter.on('system:initialized', initializedListener);
      
      // カタログに登録されているイベントを発行
      emitter.emitCataloged('system:initialized', {
        version: '1.0.0',
        components: ['task', 'session', 'feedback'],
        startup_time: 1200
      });
      
      // 検証
      expect(initializedListener).toHaveBeenCalled();
      const event = initializedListener.mock.calls[0][0];
      expect(event.version).toBe('1.0.0');
      expect(event.components).toEqual(['task', 'session', 'feedback']);
      expect(event.startup_time).toBe(1200);
    });
    
    test('カタログに登録されていないイベントを発行するとエラーになる', () => {
      expect(() => {
        emitter.emitCataloged('unknown:event', {});
      }).toThrow();
    });
  });
  
  describe('移行ガイド', () => {
    test('移行ガイドを生成できる', () => {
      // いくつかのイベントを発行
      const taskManager = {
        createTask: () => ({ id: 'T001', title: 'Test' }),
        updateTask: () => ({ id: 'T001', status: 'completed' })
      };
      
      const wrappedTaskManager = migrationHelper.createMigrationWrapper(
        taskManager,
        'task',
        {
          createTask: 'task:created',
          updateTask: 'task:updated'
        }
      );
      
      wrappedTaskManager.createTask({ title: 'Test' });
      wrappedTaskManager.updateTask('T001', { status: 'completed' });
      
      // 移行ガイドの生成
      const guide = migrationHelper.generateMigrationGuide();
      
      // 検証
      expect(guide).toBeDefined();
      expect(typeof guide).toBe('string');
      expect(guide).toContain('イベント駆動アーキテクチャへの移行ガイド');
      expect(guide).toContain('現在の移行状況');
      expect(guide).toContain('推奨される移行マッピング');
      expect(guide).toContain('移行手順');
      expect(guide).toContain('移行ラッパーの使用例');
    });
  });
});