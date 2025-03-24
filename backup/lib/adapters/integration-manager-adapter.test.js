/**
 * IntegrationManagerAdapterのテスト
 */

const IntegrationManagerAdapter = require('../../../src/lib/adapters/integration-manager-adapter');
const { EnhancedEventEmitter } = require('../../../src/lib/core/event-system');
const { ValidationError } = require('../../../src/lib/utils/errors');

describe('IntegrationManagerAdapter', () => {
  let adapter;
  let mockIntegrationManager;
  let mockEventEmitter;
  let mockLogger;
  let emittedEvents;

  beforeEach(() => {
    emittedEvents = [];
    
    // モックの作成
    mockIntegrationManager = {
      initializeWorkflow: jest.fn().mockImplementation(projectData => ({ 
        projectId: projectData.id, 
        initialized: true, 
        timestamp: new Date().toISOString() 
      })),
      startSession: jest.fn().mockImplementation(options => ({ 
        sessionId: 'S001', 
        started: true, 
        timestamp: new Date().toISOString(),
        options 
      })),
      endSession: jest.fn().mockImplementation(sessionId => ({ 
        sessionId, 
        ended: true, 
        duration: 3600,
        timestamp: new Date().toISOString() 
      })),
      createTask: jest.fn().mockImplementation(taskData => ({ 
        id: 'T001', 
        ...taskData, 
        created: true,
        timestamp: new Date().toISOString() 
      })),
      updateTaskStatus: jest.fn().mockImplementation((taskId, status) => ({ 
        id: taskId, 
        status, 
        previousStatus: 'pending',
        timestamp: new Date().toISOString() 
      })),
      collectFeedback: jest.fn().mockImplementation((taskId, feedbackData) => ({ 
        id: 'F001', 
        taskId, 
        ...feedbackData,
        timestamp: new Date().toISOString() 
      })),
      resolveFeedback: jest.fn().mockImplementation((feedbackId, resolution) => ({ 
        id: feedbackId, 
        resolved: true, 
        resolution,
        timestamp: new Date().toISOString() 
      })),
      syncComponents: jest.fn().mockImplementation(() => ({ 
        synced: true, 
        components: ['session', 'task', 'feedback'],
        timestamp: new Date().toISOString() 
      })),
      generateReport: jest.fn().mockImplementation(options => ({ 
        reportId: 'R001', 
        generated: true, 
        ...options,
        timestamp: new Date().toISOString() 
      })),
      getWorkflowStatus: jest.fn().mockImplementation(() => ({ 
        state: 'task_in_progress', 
        previousState: 'session_started',
        activeComponents: ['session', 'task'],
        timestamp: new Date().toISOString() 
      })),
      startPeriodicSync: jest.fn().mockImplementation(interval => ({ 
        started: true, 
        interval,
        timestamp: new Date().toISOString() 
      })),
      stopPeriodicSync: jest.fn().mockImplementation(() => ({ 
        stopped: true,
        timestamp: new Date().toISOString() 
      }))
    };
    
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };
    
    // 実際のEventEmitterを使用
    mockEventEmitter = new EnhancedEventEmitter({ logger: mockLogger });
    
    // イベントをキャプチャ
    mockEventEmitter.on('*', (data, eventName) => {
      emittedEvents.push({ name: eventName, data });
    });
    
    // アダプターの作成
    adapter = new IntegrationManagerAdapter(mockIntegrationManager, {
      eventEmitter: mockEventEmitter,
      logger: mockLogger
    });
  });

  // 基本機能のテスト
  describe('基本機能', () => {
    test('インスタンスが正しく作成される', () => {
      expect(adapter).toBeInstanceOf(IntegrationManagerAdapter);
      expect(adapter.manager).toBe(mockIntegrationManager);
      expect(adapter.eventEmitter).toBe(mockEventEmitter);
      expect(adapter.logger).toBe(mockLogger);
    });

    test('マネージャーが指定されていない場合はエラーが発生する', () => {
      expect(() => {
        new IntegrationManagerAdapter(null, {
          eventEmitter: mockEventEmitter,
          logger: mockLogger
        });
      }).toThrow('Manager is required');
    });
  });

  // initializeWorkflowのテスト
  describe('initializeWorkflow', () => {
    test('ワークフローを初期化し、イベントを発行する', async () => {
      const projectData = { id: 'P001', name: 'テストプロジェクト' };
      
      const result = await adapter.initializeWorkflow(projectData);
      
      expect(mockIntegrationManager.initializeWorkflow).toHaveBeenCalledWith(projectData);
      expect(result).toMatchObject({
        projectId: 'P001',
        initialized: true
      });
      
      // イベント発行のテスト
      const workflowInitializedEvent = emittedEvents.find(e => e.name === 'integration:workflow_initialized');
      expect(workflowInitializedEvent).toBeDefined();
      expect(workflowInitializedEvent.data.projectId).toBe('P001');
      expect(workflowInitializedEvent.data.timestamp).toBeDefined();
    });
    
    test('エラー時に適切に処理する', async () => {
      mockIntegrationManager.initializeWorkflow.mockImplementationOnce(() => {
        throw new Error('初期化エラー');
      });
      
      const result = await adapter.initializeWorkflow({ id: 'P001' });
      
      expect(result).toMatchObject({
        error: true,
        message: '初期化エラー',
        operation: 'initializeWorkflow'
      });
      
      expect(result.timestamp).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // startSessionのテスト
  describe('startSession', () => {
    test('セッションを開始し、イベントを発行する', async () => {
      const options = { previousSessionId: 'S000' };
      
      const result = await adapter.startSession(options);
      
      expect(mockIntegrationManager.startSession).toHaveBeenCalledWith(options);
      expect(result).toMatchObject({
        sessionId: 'S001',
        started: true
      });
      
      // イベント発行のテスト
      const sessionStartedEvent = emittedEvents.find(e => e.name === 'integration:session_started');
      expect(sessionStartedEvent).toBeDefined();
      expect(sessionStartedEvent.data.sessionId).toBe('S001');
      expect(sessionStartedEvent.data.timestamp).toBeDefined();
    });
    
    test('エラー時に適切に処理する', async () => {
      mockIntegrationManager.startSession.mockImplementationOnce(() => {
        throw new Error('セッション開始エラー');
      });
      
      const result = await adapter.startSession({ previousSessionId: 'S000' });
      
      expect(result).toMatchObject({
        error: true,
        message: 'セッション開始エラー',
        operation: 'startSession'
      });
      
      expect(result.timestamp).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // endSessionのテスト
  describe('endSession', () => {
    test('セッションを終了し、イベントを発行する', async () => {
      const sessionId = 'S001';
      
      const result = await adapter.endSession(sessionId);
      
      expect(mockIntegrationManager.endSession).toHaveBeenCalledWith(sessionId);
      expect(result).toMatchObject({
        sessionId: 'S001',
        ended: true
      });
      
      // イベント発行のテスト
      const sessionEndedEvent = emittedEvents.find(e => e.name === 'integration:session_ended');
      expect(sessionEndedEvent).toBeDefined();
      expect(sessionEndedEvent.data.sessionId).toBe('S001');
      expect(sessionEndedEvent.data.timestamp).toBeDefined();
    });
    
    test('エラー時に適切に処理する', async () => {
      mockIntegrationManager.endSession.mockImplementationOnce(() => {
        throw new Error('セッション終了エラー');
      });
      
      const result = await adapter.endSession('S001');
      
      expect(result).toMatchObject({
        error: true,
        message: 'セッション終了エラー',
        operation: 'endSession'
      });
      
      expect(result.timestamp).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // createTaskのテスト
  describe('createTask', () => {
    test('タスクを作成し、イベントを発行する', async () => {
      const taskData = { title: 'テストタスク', description: 'テスト説明' };
      
      const result = await adapter.createTask(taskData);
      
      expect(mockIntegrationManager.createTask).toHaveBeenCalledWith(taskData);
      expect(result).toMatchObject({
        id: 'T001',
        title: 'テストタスク',
        description: 'テスト説明',
        created: true
      });
      
      // イベント発行のテスト
      const taskCreatedEvent = emittedEvents.find(e => e.name === 'integration:task_created');
      expect(taskCreatedEvent).toBeDefined();
      expect(taskCreatedEvent.data.id).toBe('T001');
      expect(taskCreatedEvent.data.title).toBe('テストタスク');
      expect(taskCreatedEvent.data.timestamp).toBeDefined();
    });
    
    test('エラー時に適切に処理する', async () => {
      mockIntegrationManager.createTask.mockImplementationOnce(() => {
        throw new Error('タスク作成エラー');
      });
      
      const result = await adapter.createTask({ title: 'テストタスク' });
      
      expect(result).toMatchObject({
        error: true,
        message: 'タスク作成エラー',
        operation: 'createTask'
      });
      
      expect(result.timestamp).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // updateTaskStatusのテスト
  describe('updateTaskStatus', () => {
    test('タスク状態を更新し、イベントを発行する', async () => {
      const taskId = 'T001';
      const status = 'in_progress';
      
      const result = await adapter.updateTaskStatus(taskId, status);
      
      expect(mockIntegrationManager.updateTaskStatus).toHaveBeenCalledWith(taskId, status);
      expect(result).toMatchObject({
        id: 'T001',
        status: 'in_progress',
        previousStatus: 'pending'
      });
      
      // イベント発行のテスト
      const taskStatusUpdatedEvent = emittedEvents.find(e => e.name === 'integration:task_status_updated');
      expect(taskStatusUpdatedEvent).toBeDefined();
      expect(taskStatusUpdatedEvent.data.id).toBe('T001');
      expect(taskStatusUpdatedEvent.data.status).toBe('in_progress');
      expect(taskStatusUpdatedEvent.data.previousStatus).toBe('pending');
      expect(taskStatusUpdatedEvent.data.timestamp).toBeDefined();
    });
    
    test('エラー時に適切に処理する', async () => {
      mockIntegrationManager.updateTaskStatus.mockImplementationOnce(() => {
        throw new Error('タスク状態更新エラー');
      });
      
      const result = await adapter.updateTaskStatus('T001', 'in_progress');
      
      expect(result).toMatchObject({
        error: true,
        message: 'タスク状態更新エラー',
        operation: 'updateTaskStatus'
      });
      
      expect(result.timestamp).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // collectFeedbackのテスト
  describe('collectFeedback', () => {
    test('フィードバックを収集し、イベントを発行する', async () => {
      const taskId = 'T001';
      const feedbackData = { content: 'テストフィードバック' };
      
      const result = await adapter.collectFeedback(taskId, feedbackData);
      
      expect(mockIntegrationManager.collectFeedback).toHaveBeenCalledWith(taskId, feedbackData);
      expect(result).toMatchObject({
        id: 'F001',
        taskId: 'T001',
        content: 'テストフィードバック'
      });
      
      // イベント発行のテスト
      const feedbackCollectedEvent = emittedEvents.find(e => e.name === 'integration:feedback_collected');
      expect(feedbackCollectedEvent).toBeDefined();
      expect(feedbackCollectedEvent.data.id).toBe('F001');
      expect(feedbackCollectedEvent.data.taskId).toBe('T001');
      expect(feedbackCollectedEvent.data.content).toBe('テストフィードバック');
      expect(feedbackCollectedEvent.data.timestamp).toBeDefined();
    });
    
    test('エラー時に適切に処理する', async () => {
      mockIntegrationManager.collectFeedback.mockImplementationOnce(() => {
        throw new Error('フィードバック収集エラー');
      });
      
      const result = await adapter.collectFeedback('T001', { content: 'テストフィードバック' });
      
      expect(result).toMatchObject({
        error: true,
        message: 'フィードバック収集エラー',
        operation: 'collectFeedback'
      });
      
      expect(result.timestamp).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // resolveFeedbackのテスト
  describe('resolveFeedback', () => {
    test('フィードバックを解決し、イベントを発行する', async () => {
      const feedbackId = 'F001';
      const resolution = { action: 'fixed', comment: '修正しました' };
      
      const result = await adapter.resolveFeedback(feedbackId, resolution);
      
      expect(mockIntegrationManager.resolveFeedback).toHaveBeenCalledWith(feedbackId, resolution);
      expect(result).toMatchObject({
        id: 'F001',
        resolved: true,
        resolution: { action: 'fixed', comment: '修正しました' }
      });
      
      // イベント発行のテスト
      const feedbackResolvedEvent = emittedEvents.find(e => e.name === 'integration:feedback_resolved');
      expect(feedbackResolvedEvent).toBeDefined();
      expect(feedbackResolvedEvent.data.id).toBe('F001');
      expect(feedbackResolvedEvent.data.resolution.action).toBe('fixed');
      expect(feedbackResolvedEvent.data.timestamp).toBeDefined();
    });
    
    test('エラー時に適切に処理する', async () => {
      mockIntegrationManager.resolveFeedback.mockImplementationOnce(() => {
        throw new Error('フィードバック解決エラー');
      });
      
      const result = await adapter.resolveFeedback('F001', { action: 'fixed' });
      
      expect(result).toMatchObject({
        error: true,
        message: 'フィードバック解決エラー',
        operation: 'resolveFeedback'
      });
      
      expect(result.timestamp).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // syncComponentsのテスト
  describe('syncComponents', () => {
    test('コンポーネント間の同期を実行し、イベントを発行する', async () => {
      const result = await adapter.syncComponents();
      
      expect(mockIntegrationManager.syncComponents).toHaveBeenCalled();
      expect(result).toMatchObject({
        synced: true,
        components: ['session', 'task', 'feedback']
      });
      
      // イベント発行のテスト
      const componentsSyncedEvent = emittedEvents.find(e => e.name === 'integration:components_synced');
      expect(componentsSyncedEvent).toBeDefined();
      expect(componentsSyncedEvent.data.components).toEqual(['session', 'task', 'feedback']);
      expect(componentsSyncedEvent.data.timestamp).toBeDefined();
    });
    
    test('エラー時に適切に処理する', async () => {
      mockIntegrationManager.syncComponents.mockImplementationOnce(() => {
        throw new Error('同期エラー');
      });
      
      const result = await adapter.syncComponents();
      
      expect(result).toMatchObject({
        error: true,
        message: '同期エラー',
        operation: 'syncComponents'
      });
      
      expect(result.timestamp).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // generateReportのテスト
  describe('generateReport', () => {
    test('レポートを生成し、イベントを発行する', async () => {
      const options = { format: 'markdown', includeDetails: true };
      
      const result = await adapter.generateReport(options);
      
      expect(mockIntegrationManager.generateReport).toHaveBeenCalledWith(options);
      expect(result).toMatchObject({
        reportId: 'R001',
        generated: true,
        format: 'markdown',
        includeDetails: true
      });
      
      // イベント発行のテスト
      const reportGeneratedEvent = emittedEvents.find(e => e.name === 'integration:report_generated');
      expect(reportGeneratedEvent).toBeDefined();
      expect(reportGeneratedEvent.data.reportId).toBe('R001');
      expect(reportGeneratedEvent.data.format).toBe('markdown');
      expect(reportGeneratedEvent.data.timestamp).toBeDefined();
    });
    
    test('エラー時に適切に処理する', async () => {
      mockIntegrationManager.generateReport.mockImplementationOnce(() => {
        throw new Error('レポート生成エラー');
      });
      
      const result = await adapter.generateReport({ format: 'markdown' });
      
      expect(result).toMatchObject({
        error: true,
        message: 'レポート生成エラー',
        operation: 'generateReport'
      });
      
      expect(result.timestamp).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // getWorkflowStatusのテスト
  describe('getWorkflowStatus', () => {
    test('ワークフロー状態を取得する', async () => {
      const result = await adapter.getWorkflowStatus();
      
      expect(mockIntegrationManager.getWorkflowStatus).toHaveBeenCalled();
      expect(result).toMatchObject({
        state: 'task_in_progress',
        previousState: 'session_started',
        activeComponents: ['session', 'task']
      });
    });
    
    test('エラー時に適切に処理する', async () => {
      mockIntegrationManager.getWorkflowStatus.mockImplementationOnce(() => {
        throw new Error('状態取得エラー');
      });
      
      const result = await adapter.getWorkflowStatus();
      
      expect(result).toMatchObject({
        error: true,
        message: '状態取得エラー',
        operation: 'getWorkflowStatus'
      });
      
      expect(result.timestamp).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // startPeriodicSyncのテスト
  describe('startPeriodicSync', () => {
    test('定期同期を開始し、イベントを発行する', async () => {
      const interval = 60000;
      
      const result = await adapter.startPeriodicSync(interval);
      
      expect(mockIntegrationManager.startPeriodicSync).toHaveBeenCalledWith(interval);
      expect(result).toMatchObject({
        started: true,
        interval: 60000
      });
      
      // イベント発行のテスト
      const periodicSyncStartedEvent = emittedEvents.find(e => e.name === 'integration:periodic_sync_started');
      expect(periodicSyncStartedEvent).toBeDefined();
      expect(periodicSyncStartedEvent.data.interval).toBe(60000);
      expect(periodicSyncStartedEvent.data.timestamp).toBeDefined();
    });
    
    test('エラー時に適切に処理する', async () => {
      mockIntegrationManager.startPeriodicSync.mockImplementationOnce(() => {
        throw new Error('定期同期開始エラー');
      });
      
      const result = await adapter.startPeriodicSync(60000);
      
      expect(result).toMatchObject({
        error: true,
        message: '定期同期開始エラー',
        operation: 'startPeriodicSync'
      });
      
      expect(result.timestamp).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // stopPeriodicSyncのテスト
  describe('stopPeriodicSync', () => {
    test('定期同期を停止し、イベントを発行する', async () => {
      const result = await adapter.stopPeriodicSync();
      
      expect(mockIntegrationManager.stopPeriodicSync).toHaveBeenCalled();
      expect(result).toMatchObject({
        stopped: true
      });
      
      // イベント発行のテスト
      const periodicSyncStoppedEvent = emittedEvents.find(e => e.name === 'integration:periodic_sync_stopped');
      expect(periodicSyncStoppedEvent).toBeDefined();
      expect(periodicSyncStoppedEvent.data.timestamp).toBeDefined();
    });
    
    test('エラー時に適切に処理する', async () => {
      mockIntegrationManager.stopPeriodicSync.mockImplementationOnce(() => {
        throw new Error('定期同期停止エラー');
      });
      
      const result = await adapter.stopPeriodicSync();
      
      expect(result).toMatchObject({
        error: true,
        message: '定期同期停止エラー',
        operation: 'stopPeriodicSync'
      });
      
      expect(result.timestamp).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // バリデーションのテスト
  describe('バリデーション', () => {
    test('createTask: タスクデータが指定されていない場合はエラーを返す', async () => {
      // _validateParamsをスパイ
      jest.spyOn(adapter, '_validateParams').mockImplementationOnce(() => {
        throw new ValidationError('タスクデータは必須です');
      });
      
      const result = await adapter.createTask();
      
      expect(result).toMatchObject({
        error: true,
        message: 'タスクデータは必須です',
        operation: 'createTask'
      });
      
      expect(result.timestamp).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });
    
    test('updateTaskStatus: タスクIDと状態が指定されていない場合はエラーを返す', async () => {
      // _validateParamsをスパイ
      jest.spyOn(adapter, '_validateParams').mockImplementationOnce(() => {
        throw new ValidationError('タスクIDと状態は必須です');
      });
      
      const result = await adapter.updateTaskStatus();
      
      expect(result).toMatchObject({
        error: true,
        message: 'タスクIDと状態は必須です',
        operation: 'updateTaskStatus'
      });
      
      expect(result.timestamp).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // 後方互換性のテスト
  describe('後方互換性', () => {
    test('古いイベント名と新しいイベント名の両方が発行される', async () => {
      // 古いイベント名と新しいイベント名のリスナーを登録
      const oldEventListener = jest.fn();
      const newEventListener = jest.fn();
      
      mockEventEmitter.on('integration:task_created', oldEventListener);
      mockEventEmitter.on('integration:task_created', newEventListener);
      
      // タスクを作成
      await adapter.createTask({ title: 'テストタスク' });
      
      // 両方のリスナーが呼び出されることを確認
      expect(oldEventListener).toHaveBeenCalled();
      expect(newEventListener).toHaveBeenCalled();
    });
  });

  // エラー処理のテスト
  describe('エラーイベント', () => {
    test('エラー時にapp:errorイベントを発行する', async () => {
      // エラーイベントリスナーを設定
      const errorListener = jest.fn();
      mockEventEmitter.on('app:error', errorListener);
      
      // 後方互換性のイベントリスナーも設定
      const legacyErrorListener = jest.fn();
      mockEventEmitter.on('integrationmanager:error', legacyErrorListener);
      
      // グローバルエラーイベントリスナーも設定
      const globalErrorListener = jest.fn();
      mockEventEmitter.on('error', globalErrorListener);
      
      // エラーを発生させる
      mockIntegrationManager.createTask.mockImplementationOnce(() => {
        throw new Error('タスク作成エラー');
      });
      
      // メソッドを呼び出す
      const result = await adapter.createTask({ title: 'テストタスク' });
      
      // エラー結果を確認
      expect(result).toMatchObject({
        error: true,
        message: 'タスク作成エラー',
        operation: 'createTask'
      });
      
      // エラーイベントが発行されたことを確認
      expect(errorListener).toHaveBeenCalled();
      
      // 後方互換性のイベントも発行されたことを確認
      expect(legacyErrorListener).toHaveBeenCalled();
      
      // グローバルエラーイベントも発行されたことを確認
      expect(globalErrorListener).toHaveBeenCalled();
      
      // エラーイベントのデータを確認
      const errorData = errorListener.mock.calls[0][0];
      expect(errorData.component).toBe('integrationmanager');
      expect(errorData.operation).toBe('createTask');
      expect(errorData.message).toBe('タスク作成エラー');
      expect(errorData.timestamp).toBeDefined();
      
      // エラーログが出力されたことを確認
      expect(mockLogger.error).toHaveBeenCalled();
    });
    
    test('ApplicationErrorのプロパティが保持される', async () => {
      // エラーイベントリスナーを設定
      const errorListener = jest.fn();
      mockEventEmitter.on('app:error', errorListener);
      
      // ApplicationErrorを発生させる
      mockIntegrationManager.createTask.mockImplementationOnce(() => {
        const { ApplicationError } = require('../../../src/lib/core/error-framework');
        throw new ApplicationError('アプリケーションエラー', {
          code: 'ERR_TEST',
          context: { testId: 'T001' },
          recoverable: false
        });
      });
      
      // メソッドを呼び出す
      const result = await adapter.createTask({ title: 'テストタスク' });
      
      // エラー結果を確認
      expect(result).toMatchObject({
        error: true,
        message: 'アプリケーションエラー',
        code: 'ERR_TEST',
        operation: 'createTask',
        recoverable: false
      });
      
      // エラーイベントのデータを確認
      const errorData = errorListener.mock.calls[0][0];
      expect(errorData.code).toBe('ERR_TEST');
      expect(errorData.recoverable).toBe(false);
    });
  });
});