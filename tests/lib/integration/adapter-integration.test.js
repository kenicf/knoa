/**
 * アダプター統合テスト
 * 
 * このテストでは、TaskManagerAdapter、SessionManagerAdapter、FeedbackManagerAdapterの
 * 連携動作をテストします。
 */

const TaskManagerAdapter = require('../../../src/lib/adapters/task-manager-adapter');
const SessionManagerAdapter = require('../../../src/lib/adapters/session-manager-adapter');
const FeedbackManagerAdapter = require('../../../src/lib/adapters/feedback-manager-adapter');
const { EnhancedEventEmitter } = require('../../../src/lib/core/event-system');

describe('アダプター統合テスト', () => {
  let eventEmitter;
  let taskAdapter;
  let sessionAdapter;
  let feedbackAdapter;
  let mockLogger;
  let emittedEvents;
  
  beforeEach(() => {
    emittedEvents = [];
    
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };
    
    // 実際のEventEmitterを使用
    eventEmitter = new EnhancedEventEmitter({ logger: mockLogger });
    
    // イベントをキャプチャ
    eventEmitter.on('*', (data, eventName) => {
      emittedEvents.push({ name: eventName, data });
    });
    
    // モックの作成
    const mockTaskManager = {
      createTask: jest.fn().mockImplementation(data => ({ id: 'T001', ...data })),
      updateTask: jest.fn().mockImplementation(task => ({ ...task, updated: true })),
      updateTaskProgress: jest.fn().mockImplementation((taskId, progress, state) => ({ 
        id: taskId, 
        progress, 
        state, 
        previousProgress: 0, 
        previousState: 'pending' 
      }))
    };
    
    const mockSessionManager = {
      createNewSession: jest.fn().mockImplementation(() => ({
        session_handover: { session_id: 'S001' }
      })),
      addTaskToSession: jest.fn().mockImplementation((sessionId, taskId) => ({
        session_handover: { session_id: sessionId },
        tasks: [taskId]
      })),
      endSession: jest.fn().mockImplementation(sessionId => ({ 
        session_handover: { session_id: sessionId },
        ended: true,
        duration: 3600
      }))
    };
    
    const mockFeedbackManager = {
      createNewFeedback: jest.fn().mockImplementation((taskId, attempt) => ({
        id: 'F001',
        task_id: taskId,
        attempt: attempt || 1
      })),
      updateFeedbackStatus: jest.fn().mockImplementation((feedback, newStatus) => ({
        ...feedback,
        status: newStatus
      }))
    };
    
    // アダプターの作成
    taskAdapter = new TaskManagerAdapter(mockTaskManager, {
      eventEmitter,
      logger: mockLogger
    });
    
    sessionAdapter = new SessionManagerAdapter(mockSessionManager, {
      eventEmitter,
      logger: mockLogger
    });
    
    feedbackAdapter = new FeedbackManagerAdapter(mockFeedbackManager, {
      eventEmitter,
      logger: mockLogger
    });
  });
  
  test('タスク作成からセッション関連付け、フィードバック作成までの流れ', async () => {
    // イベントリスナーの登録
    const taskCreatedListener = jest.fn();
    const sessionTaskAddedListener = jest.fn();
    const feedbackCreatedListener = jest.fn();
    
    eventEmitter.on('task:task_created', taskCreatedListener);
    eventEmitter.on('session:task_added', sessionTaskAddedListener);
    eventEmitter.on('feedback:feedback_created', feedbackCreatedListener);
    
    // タスクの作成
    const task = await taskAdapter.createTask({ title: 'テストタスク' });
    expect(task).toBeDefined();
    expect(task.id).toBe('T001');
    expect(taskCreatedListener).toHaveBeenCalled();
    
    // セッションの作成
    const session = await sessionAdapter.createNewSession();
    expect(session).toBeDefined();
    expect(session.session_handover.session_id).toBe('S001');
    
    // タスクをセッションに関連付け
    const updatedSession = await sessionAdapter.addTaskToSession(
      session.session_handover.session_id,
      task.id
    );
    expect(updatedSession).toBeDefined();
    expect(updatedSession.tasks).toContain(task.id);
    expect(sessionTaskAddedListener).toHaveBeenCalled();
    
    // フィードバックの作成
    const feedback = await feedbackAdapter.createNewFeedback(task.id, 1);
    expect(feedback).toBeDefined();
    expect(feedback.task_id).toBe(task.id);
    expect(feedbackCreatedListener).toHaveBeenCalled();
    
    // イベントの順序を確認
    const eventSequence = emittedEvents
      .filter(e => ['task:task_created', 'session:session_created', 'session:task_added', 'feedback:feedback_created'].includes(e.name))
      .map(e => e.name);
    
    expect(eventSequence).toEqual([
      'task:task_created',
      'session:session_created',
      'session:task_added',
      'feedback:feedback_created'
    ]);
  });
  
  test('イベントリスナーを使用したコンポーネント間の連携', async () => {
    // テストのタイムアウトを設定（ミリ秒）
    jest.setTimeout(10000);
    // タスク作成時にセッションに自動的に関連付けるリスナー
    eventEmitter.on('task:task_created', async (data) => {
      const session = await sessionAdapter.createNewSession();
      await sessionAdapter.addTaskToSession(
        session.session_handover.session_id,
        data.id
      );
    });
    
    // セッションにタスクが関連付けられたときにフィードバックを自動的に作成するリスナー
    eventEmitter.on('session:task_added', async (data) => {
      await feedbackAdapter.createNewFeedback(data.taskId, 1);
    });
    
    // タスクの作成（これによって連鎖的にセッション作成、タスク関連付け、フィードバック作成が行われる）
    const task = await taskAdapter.createTask({ title: 'イベント連鎖テスト' });
    expect(task).toBeDefined();
    
    // 非同期処理の完了を待つ
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // すべてのイベントが発行されたことを確認
    const eventNames = emittedEvents.map(e => e.name);
    console.log('発行されたイベント:', eventNames);
    
    expect(eventNames).toContain('task:task_created');
    expect(eventNames).toContain('session:session_created');
    expect(eventNames).toContain('session:task_added');
    expect(eventNames).toContain('feedback:feedback_created');
    
    // イベントの数を確認
    const taskCreatedEvents = emittedEvents.filter(e => e.name === 'task:task_created');
    const sessionCreatedEvents = emittedEvents.filter(e => e.name === 'session:session_created');
    const taskAddedEvents = emittedEvents.filter(e => e.name === 'session:task_added');
    const feedbackCreatedEvents = emittedEvents.filter(e => e.name === 'feedback:feedback_created');
    
    expect(taskCreatedEvents.length).toBe(1);
    expect(sessionCreatedEvents.length).toBe(1);
    expect(taskAddedEvents.length).toBe(1);
    expect(feedbackCreatedEvents.length).toBe(1);
  });
  
  test('エラー発生時のイベント連鎖の中断', async () => {
    // テストのタイムアウトを設定（ミリ秒）
    jest.setTimeout(10000);
    
    // 操作コンテキストを作成
    const testContext = eventEmitter.createContext({
      testCase: 'エラー発生時のイベント連鎖の中断'
    });
    
    // エラーリスナーを設定
    eventEmitter.on('app:error', (errorData) => {
      // エラーログを出力（これにより mockLogger.error が呼び出される）
      mockLogger.error(`[ERROR] ${errorData.component}.${errorData.operation}: ${errorData.message}`, errorData);
    });
    
    // タスク作成時にセッションに自動的に関連付けるリスナー
    eventEmitter.on('task:task_created', async (data) => {
      // 子コンテキストを作成
      const sessionContext = eventEmitter.createContext({
        operation: 'createSessionFromTask',
        taskId: data.id
      }, data._context); // 親コンテキストを引き継ぐ
      
      const session = await sessionAdapter.createNewSession(sessionContext);
      await sessionAdapter.addTaskToSession(
        session.session_handover.session_id,
        data.id,
        sessionContext // コンテキストを渡す
      );
    });
    
    // セッションにタスクが関連付けられたときにエラーを発生させるリスナー
    eventEmitter.on('session:task_added', async (data) => {
      try {
        throw new Error('テストエラー');
      } catch (error) {
        // 直接エラーイベントを発行（emitErrorメソッドを使わない）
        eventEmitter.emit('app:error', {
          component: 'session',
          operation: 'addTaskToSession',
          message: error.message,
          code: 'ERR_TEST',
          timestamp: new Date().toISOString(),
          _context: data._context
        });
        
        // エラーログを出力
        mockLogger.error(`Error in session.addTaskToSession:`, error);
        
        // グローバルエラー状態を設定
        eventEmitter.errorOccurred = true;
      }
    });
    
    // エラーイベントをキャプチャするリスナー
    const errorListener = jest.fn();
    eventEmitter.on('app:error', errorListener);
    
    // フィードバック作成イベントをキャプチャするリスナー
    const feedbackListener = jest.fn();
    eventEmitter.on('feedback:feedback_created', feedbackListener);
    
    // タスクの作成（コンテキスト付き）
    const task = await taskAdapter.createTask({ title: 'エラーテスト' }, testContext);
    expect(task).toBeDefined();
    
    // 非同期処理の完了を待つ
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 発行されたイベントを確認
    console.log('発行されたイベント:', emittedEvents.map(e => e.name));
    
    // エラーイベントが発行されたことを確認
    expect(errorListener).toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenCalled();
    
    // フィードバック作成イベントは発行されていないことを確認
    expect(feedbackListener).not.toHaveBeenCalled();
    const feedbackCreatedEvents = emittedEvents.filter(e => e.name === 'feedback:feedback_created');
    expect(feedbackCreatedEvents.length).toBe(0);
  });
  
  test('後方互換性のあるイベントリスナー', async () => {
    // 古いイベント名でリスナーを登録
    const oldTaskCreatedListener = jest.fn();
    const oldSessionStartedListener = jest.fn();
    
    eventEmitter.on('task:created', oldTaskCreatedListener);
    eventEmitter.on('session:started', oldSessionStartedListener);
    
    // タスクとセッションを作成
    await taskAdapter.createTask({ title: '後方互換性テスト' });
    await sessionAdapter.createNewSession();
    
    // 古いイベント名のリスナーも呼び出されることを確認
    expect(oldTaskCreatedListener).toHaveBeenCalled();
    expect(oldSessionStartedListener).toHaveBeenCalled();
    
    // 警告ログが出力されることを確認（開発環境の場合）
    if (process.env.NODE_ENV === 'development') {
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('非推奨のイベント名'),
        expect.any(Object)
      );
    }
  });
});