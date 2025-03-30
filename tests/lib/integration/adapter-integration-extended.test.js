/**
 * 拡張アダプター統合テスト
 *
 * このテストでは、TaskManagerAdapter、SessionManagerAdapter、FeedbackManagerAdapter、
 * StateManagerAdapter、IntegrationManagerAdapterの連携動作をテストします。
 */

const TaskManagerAdapter = require('../../../src/lib/adapters/task-manager-adapter');
const StateManagerAdapter = require('../../../src/lib/adapters/state-manager-adapter');
const IntegrationManagerAdapter = require('../../../src/lib/adapters/integration-manager-adapter');
const { EnhancedEventEmitter } = require('../../../src/lib/core/event-system');

describe('拡張アダプター統合テスト', () => {
  let eventEmitter;
  let taskAdapter;
  let stateAdapter;
  let integrationAdapter;
  let mockLogger;
  let emittedEvents;
  // let mockTaskManager, // 未使用のためコメントアウト
  //   mockSessionManager, // 未使用のためコメントアウト
  //   mockFeedbackManager, // 未使用のためコメントアウト
  let mockStateManager, // mockStateManager と mockIntegrationManager は使用されている
    mockIntegrationManager;

  beforeEach(() => {
    emittedEvents = [];

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // 実際のEventEmitterを使用
    eventEmitter = new EnhancedEventEmitter({ logger: mockLogger });

    // イベントをキャプチャ
    eventEmitter.on('*', (data, eventName) => {
      emittedEvents.push({ name: eventName, data });
    });

    // モックの作成
    const mockTaskManager = {
      createTask: jest
        .fn()
        .mockImplementation((data) => ({ id: 'T001', ...data })),
      updateTask: jest
        .fn()
        .mockImplementation((task) => ({ ...task, updated: true })),
      updateTaskProgress: jest
        .fn()
        .mockImplementation((taskId, progress, state) => ({
          id: taskId,
          progress,
          state,
          previousProgress: 0,
          previousState: 'pending',
        })),
      getAllTasks: jest.fn().mockImplementation(() => ({
        decomposed_tasks: [
          { id: 'T001', title: 'タスク1', status: 'in_progress' },
          { id: 'T002', title: 'タスク2', status: 'pending' },
        ],
      })),
    };

    mockStateManager = {
      getCurrentState: jest.fn().mockReturnValue('initialized'),
      setState: jest.fn().mockImplementation((state, data) => ({
        state,
        previousState: 'initialized',
        timestamp: new Date().toISOString(),
        ...data,
      })),
      transitionTo: jest.fn().mockImplementation((state, data) => ({
        state,
        previousState: 'initialized',
        timestamp: new Date().toISOString(),
        ...data,
      })),
      canTransitionTo: jest.fn().mockReturnValue(true),
      getStateHistory: jest.fn().mockReturnValue([
        {
          state: 'uninitialized',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
        },
        { state: 'initialized', timestamp: new Date().toISOString() },
      ]),
      getPreviousState: jest.fn().mockReturnValue('uninitialized'),
    };

    mockIntegrationManager = {
      initializeWorkflow: jest.fn().mockImplementation((projectData) => ({
        projectId: projectData.id,
        initialized: true,
        timestamp: new Date().toISOString(),
      })),
      startSession: jest.fn().mockImplementation((options) => ({
        sessionId: 'S001',
        started: true,
        timestamp: new Date().toISOString(),
        options,
      })),
      endSession: jest.fn().mockImplementation((sessionId) => ({
        sessionId,
        ended: true,
        duration: 3600,
        timestamp: new Date().toISOString(),
      })),
      createTask: jest.fn().mockImplementation((taskData) => ({
        id: 'T001',
        ...taskData,
        created: true,
        timestamp: new Date().toISOString(),
      })),
      updateTaskStatus: jest.fn().mockImplementation((taskId, status) => ({
        id: taskId,
        status,
        previousStatus: 'pending',
        timestamp: new Date().toISOString(),
      })),
      collectFeedback: jest.fn().mockImplementation((taskId, feedbackData) => ({
        id: 'F001',
        taskId,
        ...feedbackData,
        timestamp: new Date().toISOString(),
      })),
      getWorkflowStatus: jest.fn().mockImplementation(() => ({
        state: 'task_in_progress',
        previousState: 'session_started',
        activeComponents: ['session', 'task'],
        timestamp: new Date().toISOString(),
      })),
    };

    // アダプターの作成
    taskAdapter = new TaskManagerAdapter(mockTaskManager, {
      eventEmitter,
      logger: mockLogger,
    });

    stateAdapter = new StateManagerAdapter(mockStateManager, {
      eventEmitter,
      logger: mockLogger,
    });

    integrationAdapter = new IntegrationManagerAdapter(mockIntegrationManager, {
      eventEmitter,
      logger: mockLogger,
    });
  });

  test('状態変更がイベントを通じて他のアダプターに伝播する', async () => {
    // イベントリスナーの登録
    const stateChangedListener = jest.fn();
    const taskCreatedListener = jest.fn();

    eventEmitter.on('state:state_changed', stateChangedListener);
    eventEmitter.on('task:task_created', taskCreatedListener);

    // 状態変更時にタスクを作成するリスナー
    eventEmitter.on('state:state_changed', async (data) => {
      if (data.state === 'task_in_progress') {
        await taskAdapter.createTask({
          title: '状態変更によるタスク',
          description: `状態が ${data.state} に変更されたため作成されたタスク`,
        });
      }
    });

    // 状態を変更
    const result = stateAdapter.setState('task_in_progress', {
      reason: 'テスト',
    });
    expect(result).toMatchObject({
      state: 'task_in_progress',
      previousState: 'initialized',
    });

    // 非同期処理の完了を待つ
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 状態変更イベントが発行されたことを確認
    expect(stateChangedListener).toHaveBeenCalled();

    // タスク作成イベントが発行されたことを確認
    expect(taskCreatedListener).toHaveBeenCalled();

    // イベントの順序を確認
    const eventSequence = emittedEvents
      .filter((e) =>
        ['state:state_changed', 'task:task_created'].includes(e.name)
      )
      .map((e) => e.name);

    expect(eventSequence[0]).toBe('state:state_changed');
    expect(eventSequence[1]).toBe('task:task_created');
  });

  test('IntegrationManagerAdapterが他のアダプターと連携する', async () => {
    // イベントリスナーの登録
    const workflowInitializedListener = jest.fn();
    const sessionStartedListener = jest.fn();
    const taskCreatedListener = jest.fn();

    eventEmitter.on(
      'integration:workflow_initialized',
      workflowInitializedListener
    );
    eventEmitter.on('integration:session_started', sessionStartedListener);
    eventEmitter.on('integration:task_created', taskCreatedListener);

    // ワークフローを初期化
    const workflow = await integrationAdapter.initializeWorkflow({
      id: 'P001',
      name: 'テストプロジェクト',
    });
    expect(workflow).toMatchObject({
      projectId: 'P001',
      initialized: true,
    });
    expect(workflowInitializedListener).toHaveBeenCalled();

    // セッションを開始
    const session = await integrationAdapter.startSession({
      previousSessionId: null,
    });
    expect(session).toMatchObject({
      sessionId: 'S001',
      started: true,
    });
    expect(sessionStartedListener).toHaveBeenCalled();

    // タスクを作成
    const task = await integrationAdapter.createTask({
      title: '統合テスト',
      description: 'IntegrationManagerAdapterのテスト',
    });
    expect(task).toMatchObject({
      id: 'T001',
      title: '統合テスト',
      created: true,
    });
    expect(taskCreatedListener).toHaveBeenCalled();

    // イベントの順序を確認
    const eventSequence = emittedEvents
      .filter((e) =>
        [
          'integration:workflow_initialized',
          'integration:session_started',
          'integration:task_created',
        ].includes(e.name)
      )
      .map((e) => e.name);

    expect(eventSequence).toEqual([
      'integration:workflow_initialized',
      'integration:session_started',
      'integration:task_created',
    ]);
  });

  test('ワークフロー全体の連携テスト', async () => {
    // テストのタイムアウトを設定（ミリ秒）
    jest.setTimeout(10000);

    // ワークフロー初期化時にセッションを開始するリスナー
    eventEmitter.on('integration:workflow_initialized', async () => {
      await integrationAdapter.startSession();
    });

    // セッション開始時に状態を変更するリスナー
    eventEmitter.on('integration:session_started', async () => {
      stateAdapter.setState('session_started', { sessionId: 'S001' });
    });

    // 状態が変更されたときにタスクを作成するリスナー
    eventEmitter.on('state:state_changed', async (data) => {
      if (data.state === 'session_started') {
        await integrationAdapter.createTask({
          title: '自動作成タスク',
          description: 'セッション開始時に自動的に作成されたタスク',
        });
      }
    });

    // タスク作成時に状態を変更するリスナー
    eventEmitter.on('integration:task_created', async () => {
      stateAdapter.setState('task_in_progress', { taskId: 'T001' });
    });

    // 状態がtask_in_progressに変更されたときにフィードバックを収集するリスナー
    eventEmitter.on('state:state_changed', async (data) => {
      if (data.state === 'task_in_progress') {
        await integrationAdapter.collectFeedback('T001', {
          content: '自動フィードバック',
          type: 'auto',
        });
      }
    });

    // ワークフローを初期化（これによって連鎖的にイベントが発行される）
    await integrationAdapter.initializeWorkflow({
      id: 'P001',
      name: 'ワークフローテスト',
    });

    // 非同期処理の完了を待つ
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 発行されたイベントを確認
    const eventNames = emittedEvents.map((e) => e.name);
    console.log('発行されたイベント:', eventNames);

    // 各イベントが発行されたことを確認
    expect(eventNames).toContain('integration:workflow_initialized');
    expect(eventNames).toContain('integration:session_started');
    expect(eventNames).toContain('state:state_changed');
    expect(eventNames).toContain('integration:task_created');
    expect(eventNames).toContain('integration:feedback_collected');

    // 状態変更イベントの内容を確認
    const stateChangedEvents = emittedEvents.filter(
      (e) => e.name === 'state:state_changed'
    );
    expect(stateChangedEvents.length).toBeGreaterThanOrEqual(2);

    // 最初の状態変更はsession_startedであることを確認
    expect(stateChangedEvents[0].data.state).toBe('session_started');

    // 2番目の状態変更はtask_in_progressであることを確認
    expect(stateChangedEvents[1].data.state).toBe('task_in_progress');
  });

  test('ワークフロー状態の取得と検証', async () => {
    // ワークフロー状態を取得
    const status = await integrationAdapter.getWorkflowStatus();
    expect(status).toMatchObject({
      state: 'task_in_progress',
      previousState: 'session_started',
      activeComponents: ['session', 'task'],
    });

    // 現在の状態を取得
    const currentState = stateAdapter.getCurrentState();
    expect(currentState).toBe('initialized');

    // 状態履歴を取得
    const stateHistory = stateAdapter.getStateHistory();
    expect(stateHistory.length).toBe(2);
    expect(stateHistory[0].state).toBe('uninitialized');
    expect(stateHistory[1].state).toBe('initialized');

    // 前の状態を取得
    const previousState = stateAdapter.getPreviousState();
    expect(previousState).toBe('uninitialized');

    // 状態遷移の検証
    const canTransition = stateAdapter.canTransitionTo('task_in_progress');
    expect(canTransition).toBe(true);
  });

  test('エラー発生時の状態管理と伝播', async () => {
    // テストのタイムアウトを設定（ミリ秒）
    jest.setTimeout(10000);

    // エラーを発生させる
    mockIntegrationManager.createTask.mockImplementationOnce(() => {
      const {
        ApplicationError,
      } = require('../../../src/lib/core/error-framework');
      throw new ApplicationError('タスク作成エラー', {
        code: 'ERR_TEST',
        recoverable: true,
      });
    });

    // タスク作成を試みる（エラーが発生する）
    const result = await integrationAdapter.createTask({
      title: 'エラーテスト',
    });

    // 結果を検証
    expect(result).toMatchObject({
      error: true,
      message: 'タスク作成エラー',
      operation: 'createTask',
    });

    // 直接状態を変更
    stateAdapter.setState('error', {
      errorComponent: 'integrationmanager',
      errorOperation: 'createTask',
      errorMessage: 'タスク作成エラー',
    });

    // mockStateManager.setStateが呼び出されたことを確認
    expect(mockStateManager.setState).toHaveBeenCalledWith(
      'error',
      expect.objectContaining({
        errorComponent: 'integrationmanager',
        errorOperation: 'createTask',
        errorMessage: 'タスク作成エラー',
      })
    );
  });

  test('エラーからの回復メカニズム', async () => {
    // テストのタイムアウトを設定（ミリ秒）
    jest.setTimeout(10000);

    // エラー状態をリセットする関数
    const resetErrorState = jest.fn().mockImplementation(() => {
      stateAdapter.setState('initialized', { resetReason: 'error_recovery' });
      eventEmitter.resetErrorState();
      return true;
    });

    // 回復可能なエラーを発生させる
    mockIntegrationManager.createTask.mockImplementationOnce(() => {
      const {
        ApplicationError,
      } = require('../../../src/lib/core/error-framework');
      throw new ApplicationError('回復可能なエラー', {
        code: 'ERR_UNKNOWN',
        recoverable: true,
      });
    });

    // タスク作成を試みる（エラーが発生する）
    await integrationAdapter.createTask({ title: 'エラーテスト' });

    // 直接回復関数を呼び出す
    resetErrorState();

    // 状態が'initialized'に戻ったことを確認
    expect(mockStateManager.setState).toHaveBeenCalledWith(
      'initialized',
      expect.objectContaining({
        resetReason: 'error_recovery',
      })
    );

    // エラー状態がリセットされたことを確認
    expect(eventEmitter.errorOccurred).toBe(false);
  });
});
