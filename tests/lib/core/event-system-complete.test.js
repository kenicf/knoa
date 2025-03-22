/**
 * イベントシステムの完全実装のテスト
 */

const { EnhancedEventEmitter, EventError, EventCatalog } = require('../../../src/lib/core/event-system');
const eventCatalog = require('../../../src/lib/core/event-catalog');
const { EventMigrationHelper } = require('../../../src/lib/core/event-migration-helper');

describe('イベントシステムの完全実装', () => {
  describe('EnhancedEventEmitter', () => {
    let emitter;
    let mockLogger;
    
    beforeEach(() => {
      mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      };
      
      emitter = new EnhancedEventEmitter({
        logger: mockLogger,
        debugMode: true,
        keepHistory: true
      });
    });
    
    test('イベント名の検証が正しく動作する', () => {
      // 有効なイベント名
      expect(emitter.validateEventName('component:action')).toBe(true);
      expect(emitter.validateEventName('task:created')).toBe(true);
      expect(emitter.validateEventName('session:ended')).toBe(true);
      
      // 無効なイベント名
      expect(emitter.validateEventName('component-action')).toBe(false);
      expect(emitter.validateEventName('Component:Action')).toBe(false);
      expect(emitter.validateEventName('component:')).toBe(false);
      expect(emitter.validateEventName(':action')).toBe(false);
      
      // 例外：グローバルイベント
      expect(emitter.validateEventName('event')).toBe(true);
      expect(emitter.validateEventName('error')).toBe(true);
    });
    
    test('標準化されたイベント名を生成できる', () => {
      expect(emitter.createStandardEventName('component', 'action')).toBe('component:action');
      expect(emitter.createStandardEventName('TASK', 'Created')).toBe('task:created');
      expect(emitter.createStandardEventName('session-manager', 'start_session')).toBe('sessionmanager:startsession');
    });
    
    test('標準化されたイベントを発行できる', () => {
      const mockListener = jest.fn();
      emitter.on('component:action', mockListener);
      
      emitter.emitStandardized('component', 'action', { data: 'test' });
      
      expect(mockListener).toHaveBeenCalled();
      const eventData = mockListener.mock.calls[0][0];
      expect(eventData.data).toBe('test');
      expect(eventData.component).toBe('component');
      expect(eventData.action).toBe('action');
      expect(eventData.timestamp).toBeDefined();
    });
    
    test('非標準のイベント名を警告する', () => {
      // 元のメソッドを保存
      const originalValidateEventName = emitter.validateEventName;
      
      // モックに置き換え
      emitter.validateEventName = jest.fn().mockReturnValue(false);
      
      // 警告が出るかテスト
      emitter.emitStandardized('Component', 'Action', { data: 'test' });
      
      // 検証
      expect(emitter.validateEventName).toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('非標準のイベント名'));
      
      // 元のメソッドに戻す
      emitter.validateEventName = originalValidateEventName;
    });
    
    test('非同期で標準化されたイベントを発行できる', async () => {
      const mockListener = jest.fn().mockResolvedValue('done');
      emitter.on('component:action', mockListener);
      
      await emitter.emitStandardizedAsync('component', 'action', { data: 'test' });
      
      expect(mockListener).toHaveBeenCalled();
      const eventData = mockListener.mock.calls[0][0];
      expect(eventData.data).toBe('test');
    });
  });
  
  describe('EventCatalog', () => {
    let catalog;
    
    beforeEach(() => {
      catalog = new EventCatalog();
    });
    
    test('イベント定義を登録して取得できる', () => {
      catalog.registerEvent('test:event', {
        description: 'テストイベント',
        category: 'test',
        schema: { data: 'データ' },
        examples: ['example']
      });
      
      const definition = catalog.getEventDefinition('test:event');
      expect(definition).toBeDefined();
      expect(definition.name).toBe('test:event');
      expect(definition.description).toBe('テストイベント');
      expect(definition.category).toBe('test');
      expect(definition.schema).toEqual({ data: 'データ' });
      expect(definition.examples).toEqual(['example']);
    });
    
    test('カテゴリ別のイベント一覧を取得できる', () => {
      catalog.registerEvent('test:event1', { category: 'test' });
      catalog.registerEvent('test:event2', { category: 'test' });
      catalog.registerEvent('other:event', { category: 'other' });
      
      const testEvents = catalog.getEventsByCategory('test');
      expect(testEvents).toHaveLength(2);
      expect(testEvents[0].name).toBe('test:event1');
      expect(testEvents[1].name).toBe('test:event2');
    });
    
    test('すべてのイベント定義を取得できる', () => {
      catalog.registerEvent('test:event1', {});
      catalog.registerEvent('test:event2', {});
      
      const allEvents = catalog.getAllEvents();
      expect(allEvents).toHaveLength(2);
    });
    
    test('すべてのカテゴリを取得できる', () => {
      catalog.registerEvent('test:event1', { category: 'test' });
      catalog.registerEvent('other:event', { category: 'other' });
      
      const categories = catalog.getAllCategories();
      expect(categories).toContain('test');
      expect(categories).toContain('other');
    });
    
    test('実際のイベントカタログが正しく読み込まれる', () => {
      expect(eventCatalog).toBeInstanceOf(EventCatalog);
      
      // いくつかの標準イベントが登録されているか確認
      expect(eventCatalog.getEventDefinition('task:created')).toBeDefined();
      expect(eventCatalog.getEventDefinition('session:started')).toBeDefined();
      expect(eventCatalog.getEventDefinition('feedback:collected')).toBeDefined();
    });
  });
  
  describe('イベントカタログとEnhancedEventEmitterの統合', () => {
    let emitter;
    let mockLogger;
    
    beforeEach(() => {
      mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      };
      
      emitter = new EnhancedEventEmitter({
        logger: mockLogger,
        debugMode: true,
        keepHistory: true
      });
      
      emitter.setCatalog(eventCatalog);
    });
    
    test('カタログに登録されているイベントを発行できる', () => {
      const mockListener = jest.fn();
      emitter.on('task:created', mockListener);
      
      emitter.emitCataloged('task:created', {
        id: 'T001',
        title: 'テストタスク'
      });
      
      expect(mockListener).toHaveBeenCalled();
      const eventData = mockListener.mock.calls[0][0];
      expect(eventData.id).toBe('T001');
      expect(eventData.title).toBe('テストタスク');
    });
    
    test('カタログに登録されていないイベントを発行するとエラーになる', () => {
      expect(() => {
        emitter.emitCataloged('unknown:event', {});
      }).toThrow(EventError);
    });
    
    test('カタログが設定されていない場合はエラーになる', () => {
      const emitterWithoutCatalog = new EnhancedEventEmitter();
      
      expect(() => {
        emitterWithoutCatalog.emitCataloged('task:created', {});
      }).toThrow(EventError);
    });
    
    test('イベント定義を取得できる', () => {
      const definition = emitter.getEventDefinition('task:created');
      expect(definition).toBeDefined();
      expect(definition.name).toBe('task:created');
      expect(definition.category).toBe('task');
    });
  });
  
  describe('EventMigrationHelper', () => {
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
        logger: mockLogger,
        debugMode: true
      });
      
      migrationHelper = new EventMigrationHelper(emitter, {
        logger: mockLogger,
        debugMode: true
      });
    });
    
    test('直接メソッド呼び出しをログに記録できる', () => {
      migrationHelper.logDirectCall('component', 'method', ['arg1', 'arg2']);
      
      expect(mockLogger.debug).toHaveBeenCalled();
      expect(migrationHelper.directCallCount.get('component.method')).toBe(1);
    });
    
    test('イベントベースの呼び出しをログに記録できる', () => {
      migrationHelper.logEventCall('component:event', { data: 'test' });
      
      expect(mockLogger.debug).toHaveBeenCalled();
      expect(migrationHelper.eventCallCount.get('component:event')).toBe(1);
    });
    
    test('移行レポートを生成できる', () => {
      migrationHelper.logDirectCall('component', 'method', []);
      migrationHelper.logEventCall('component:method', {});
      
      const report = migrationHelper.generateMigrationReport();
      
      expect(report).toBeDefined();
      expect(report.directMethods).toHaveLength(1);
      expect(report.eventMethods).toHaveLength(1);
      expect(report.migrationProgress).toBeDefined();
      expect(report.migrationProgress.totalDirectCalls).toBe(1);
      expect(report.migrationProgress.totalEventCalls).toBe(1);
    });
    
    test('移行ガイドを生成できる', () => {
      migrationHelper.logDirectCall('component', 'method', []);
      migrationHelper.logEventCall('component:method', {});
      
      const guide = migrationHelper.generateMigrationGuide();
      
      expect(guide).toBeDefined();
      expect(typeof guide).toBe('string');
      expect(guide).toContain('イベント駆動アーキテクチャへの移行ガイド');
    });
    
    test('移行ラッパーを作成できる', () => {
      // テスト用のクラス
      class TestClass {
        testMethod(data) {
          return { result: data };
        }
      }
      
      // メソッドとイベントのマッピング
      const methodToEventMap = {
        testMethod: 'test:method'
      };
      
      // 移行ラッパーの作成
      const testObject = new TestClass();
      const wrappedObject = migrationHelper.createMigrationWrapper(
        testObject,
        'test',
        methodToEventMap
      );
      
      // イベントリスナーの登録
      const mockListener = jest.fn();
      emitter.on('test:method', mockListener);
      
      // ラップされたメソッドの呼び出し
      const result = wrappedObject.testMethod({ data: 'test' });
      
      // 結果の検証
      expect(result).toEqual({ result: { data: 'test' } });
      expect(mockListener).toHaveBeenCalled();
      expect(migrationHelper.directCallCount.get('test.testMethod')).toBe(1);
      expect(migrationHelper.eventCallCount.get('test:method')).toBe(1);
    });
  });
  
  describe('統合テスト', () => {
    let emitter;
    let migrationHelper;
    
    beforeEach(() => {
      emitter = new EnhancedEventEmitter({
        debugMode: true,
        keepHistory: true
      });
      
      emitter.setCatalog(eventCatalog);
      
      migrationHelper = new EventMigrationHelper(emitter, {
        debugMode: true
      });
    });
    
    test('タスク管理の移行ラッパーが正しく動作する', () => {
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
            status: data.status || 'pending',
            ...data
          };
          
          this.tasks.set(id, task);
          return task;
        }
        
        updateTask(id, updates) {
          if (!this.tasks.has(id)) {
            throw new Error(`Task ${id} not found`);
          }
          
          const task = this.tasks.get(id);
          Object.assign(task, updates);
          return task;
        }
      }
      
      // メソッドとイベントのマッピング
      const methodToEventMap = {
        createTask: 'task:created',
        updateTask: 'task:updated'
      };
      
      // 移行ラッパーの作成
      const taskManager = new TaskManager();
      const wrappedTaskManager = migrationHelper.createMigrationWrapper(
        taskManager,
        'task',
        methodToEventMap
      );
      
      // イベントリスナーの登録
      const createdListener = jest.fn();
      const updatedListener = jest.fn();
      emitter.on('task:created', createdListener);
      emitter.on('task:updated', updatedListener);
      
      // タスクの作成
      const task = wrappedTaskManager.createTask({
        title: 'テストタスク',
        description: 'これはテストです'
      });
      
      // タスクの更新
      wrappedTaskManager.updateTask(task.id, {
        status: 'completed'
      });
      
      // 検証
      expect(task).toBeDefined();
      expect(task.id).toBe('T001');
      expect(task.title).toBe('テストタスク');
      
      expect(createdListener).toHaveBeenCalled();
      const createdEvent = createdListener.mock.calls[0][0];
      expect(createdEvent.title).toBe('テストタスク');
      
      expect(updatedListener).toHaveBeenCalled();
      const updatedEvent = updatedListener.mock.calls[0][0];
      expect(updatedEvent.id).toBe('T001');
      
      // 移行レポートの検証
      const report = migrationHelper.generateMigrationReport();
      expect(report.directMethods).toHaveLength(2);
      expect(report.eventMethods).toHaveLength(2);
      expect(report.migrationProgress.totalDirectCalls).toBe(2);
      expect(report.migrationProgress.totalEventCalls).toBe(2);
    });
    
    test('イベント履歴が正しく記録される', () => {
      // 履歴をクリア
      emitter.eventHistory = [];
      
      // イベントの発行
      emitter.emitStandardized('test', 'event1', { data: 'test1' });
      emitter.emitStandardized('test', 'event2', { data: 'test2' });
      
      // 履歴の取得
      const history = emitter.getEventHistory();
      
      // 検証
      // 各イベントに対して標準イベントとグローバルイベントの2つが記録されるため、合計4つのイベントが記録される
      expect(history.length).toBeGreaterThanOrEqual(4);
      
      // test:event1イベントが記録されていることを確認
      const event1Entries = history.filter(entry => entry.event === 'test:event1');
      expect(event1Entries.length).toBeGreaterThanOrEqual(1);
      expect(event1Entries[0].data.data).toBe('test1');
      
      // test:event2イベントが記録されていることを確認
      const event2Entries = history.filter(entry => entry.event === 'test:event2');
      expect(event2Entries.length).toBeGreaterThanOrEqual(1);
      expect(event2Entries[0].data.data).toBe('test2');
    });
    
    test('ワイルドカードリスナーが正しく動作する', () => {
      const wildcardListener = jest.fn();
      emitter.on('test:*', wildcardListener);
      
      // 複数のイベントを発行
      emitter.emitStandardized('test', 'event1', { data: 'test1' });
      emitter.emitStandardized('test', 'event2', { data: 'test2' });
      emitter.emitStandardized('other', 'event', { data: 'other' });
      
      // 検証
      expect(wildcardListener).toHaveBeenCalledTimes(2);
      expect(wildcardListener.mock.calls[0][1]).toBe('test:event1');
      expect(wildcardListener.mock.calls[1][1]).toBe('test:event2');
    });
  });
});