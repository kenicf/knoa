/**
 * イベント駆動アーキテクチャの移行ヘルパーのテスト
 */

const { EnhancedEventEmitter } = require('../../../src/lib/core/event-system');
const {
  EventMigrationHelper,
} = require('../../../src/lib/core/event-migration-helper');

describe('EventMigrationHelper', () => {
  let emitter;
  let migrationHelper;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    emitter = new EnhancedEventEmitter({
      logger: mockLogger,
      debugMode: true,
    });

    migrationHelper = new EventMigrationHelper(emitter, {
      logger: mockLogger,
      debugMode: true,
    });
  });

  describe('基本機能', () => {
    test('インスタンスが正しく作成される', () => {
      expect(migrationHelper).toBeInstanceOf(EventMigrationHelper);
      expect(migrationHelper.eventEmitter).toBe(emitter);
      expect(migrationHelper.migrationLog).toEqual([]);
      expect(migrationHelper.directCallCount).toBeInstanceOf(Map);
      expect(migrationHelper.eventCallCount).toBeInstanceOf(Map);
    });

    test('直接メソッド呼び出しをログに記録できる', () => {
      migrationHelper.logDirectCall('component', 'method', ['arg1', 'arg2']);

      expect(mockLogger.debug).toHaveBeenCalled();
      expect(migrationHelper.directCallCount.get('component.method')).toBe(1);

      // 2回目の呼び出し
      migrationHelper.logDirectCall('component', 'method', ['arg3']);
      expect(migrationHelper.directCallCount.get('component.method')).toBe(2);
    });

    test('イベントベースの呼び出しをログに記録できる', () => {
      migrationHelper.logEventCall('component:event', { data: 'test' });

      expect(mockLogger.debug).toHaveBeenCalled();
      expect(migrationHelper.eventCallCount.get('component:event')).toBe(1);

      // 2回目の呼び出し
      migrationHelper.logEventCall('component:event', { data: 'test2' });
      expect(migrationHelper.eventCallCount.get('component:event')).toBe(2);
    });
  });

  describe('移行レポート', () => {
    beforeEach(() => {
      // テストデータの準備
      migrationHelper.logDirectCall('task', 'create', [{ title: 'Task 1' }]);
      migrationHelper.logDirectCall('task', 'create', [{ title: 'Task 2' }]);
      migrationHelper.logDirectCall('task', 'update', [
        'T001',
        { status: 'completed' },
      ]);
      migrationHelper.logDirectCall('session', 'start', [{ project: 'test' }]);

      migrationHelper.logEventCall('task:created', { title: 'Task 1' });
      migrationHelper.logEventCall('task:created', { title: 'Task 2' });
      migrationHelper.logEventCall('task:updated', {
        id: 'T001',
        status: 'completed',
      });
      migrationHelper.logEventCall('session:started', { project: 'test' });
      migrationHelper.logEventCall('notification:created', { message: 'Test' });
    });

    test('移行レポートを生成できる', () => {
      const report = migrationHelper.generateMigrationReport();

      expect(report).toBeDefined();
      expect(report.timestamp).toBeDefined();
      expect(report.runningTime).toBeGreaterThan(0);

      // 直接メソッド呼び出し
      expect(report.directMethods).toHaveLength(3);
      expect(
        report.directMethods.find((m) => m.key === 'task.create')
      ).toBeDefined();
      expect(
        report.directMethods.find((m) => m.key === 'task.update')
      ).toBeDefined();
      expect(
        report.directMethods.find((m) => m.key === 'session.start')
      ).toBeDefined();

      // イベント呼び出し
      expect(report.eventMethods).toHaveLength(4);
      expect(
        report.eventMethods.find((m) => m.key === 'task:created')
      ).toBeDefined();
      expect(
        report.eventMethods.find((m) => m.key === 'task:updated')
      ).toBeDefined();
      expect(
        report.eventMethods.find((m) => m.key === 'session:started')
      ).toBeDefined();
      expect(
        report.eventMethods.find((m) => m.key === 'notification:created')
      ).toBeDefined();

      // マッピング
      expect(report.mappings).toHaveLength(3);

      // 未マッピングのイベント
      expect(report.unmappedEvents).toHaveLength(1);
      expect(report.unmappedEvents[0].key).toBe('notification:created');

      // 移行進捗
      expect(report.migrationProgress).toBeDefined();
      expect(report.migrationProgress.totalDirectCalls).toBe(4);
      expect(report.migrationProgress.totalEventCalls).toBe(5);
      expect(report.migrationProgress.migrationPercentage).toBeGreaterThan(0);
    });

    test('移行ガイドを生成できる', () => {
      const guide = migrationHelper.generateMigrationGuide();

      expect(guide).toBeDefined();
      expect(typeof guide).toBe('string');
      expect(guide).toContain('イベント駆動アーキテクチャへの移行ガイド');
      expect(guide).toContain('現在の移行状況');
      expect(guide).toContain('推奨される移行マッピング');
      expect(guide).toContain('移行手順');
      expect(guide).toContain('移行ラッパーの使用例');
    });
  });

  describe('パラメータ名の推測', () => {
    test('メソッド名からパラメータ名を推測できる', () => {
      // get系メソッド
      expect(migrationHelper._guessParamNames('getTask', ['T001'])).toEqual([
        'id',
        'options',
      ]);

      // create系メソッド
      expect(
        migrationHelper._guessParamNames('createTask', [{ title: 'Task' }])
      ).toEqual(['data', 'options']);

      // update系メソッド
      expect(
        migrationHelper._guessParamNames('updateTask', [
          'T001',
          { status: 'completed' },
        ])
      ).toEqual(['id', 'data', 'options']);

      // delete系メソッド
      expect(migrationHelper._guessParamNames('deleteTask', ['T001'])).toEqual([
        'id',
        'options',
      ]);

      // 未知のメソッド
      expect(
        migrationHelper._guessParamNames('unknownMethod', ['arg1', 'arg2'])
      ).toEqual(['param1', 'param2']);
    });
  });

  describe('移行ラッパー', () => {
    test('移行ラッパーを作成できる', () => {
      // テスト用のクラス
      class TestClass {
        constructor() {
          this.data = 'test';
        }

        testMethod(arg) {
          return { result: arg };
        }

        getValue() {
          return this.data;
        }
      }

      // メソッドとイベントのマッピング
      const methodToEventMap = {
        testMethod: 'test:method',
        getValue: 'test:getValue',
      };

      // 移行ラッパーの作成
      const testObject = new TestClass();
      const wrappedObject = migrationHelper.createMigrationWrapper(
        testObject,
        'test',
        methodToEventMap
      );

      // プロパティの検証
      expect(wrappedObject).toBeInstanceOf(TestClass);
      expect(wrappedObject.data).toBe('test');

      // メソッドの検証
      expect(typeof wrappedObject.testMethod).toBe('function');
      expect(typeof wrappedObject.getValue).toBe('function');

      // イベントリスナーの登録
      const mockListener = jest.fn();
      emitter.on('test:method', mockListener);

      // ラップされたメソッドの呼び出し
      const result = wrappedObject.testMethod('arg1');

      // 結果の検証
      expect(result).toEqual({ result: 'arg1' });
      expect(mockListener).toHaveBeenCalled();
      expect(migrationHelper.directCallCount.get('test.testMethod')).toBe(1);
      expect(migrationHelper.eventCallCount.get('test:method')).toBe(1);

      // イベントデータの検証
      const eventData = mockListener.mock.calls[0][0];
      expect(eventData.param1).toBe('arg1');
      expect(eventData.result).toEqual({ result: 'arg1' });
    });

    test('オブジェクト引数を持つメソッドのラッパー', () => {
      // テスト用のクラス
      class TestClass {
        createItem(data) {
          return { id: 'item-1', ...data };
        }
      }

      // メソッドとイベントのマッピング
      const methodToEventMap = {
        createItem: 'item:created',
      };

      // 移行ラッパーの作成
      const testObject = new TestClass();
      const wrappedObject = migrationHelper.createMigrationWrapper(
        testObject,
        'item',
        methodToEventMap
      );

      // イベントリスナーの登録
      const mockListener = jest.fn();
      emitter.on('item:created', mockListener);

      // ラップされたメソッドの呼び出し
      const result = wrappedObject.createItem({
        name: 'Test Item',
        value: 100,
      });

      // 結果の検証
      expect(result).toEqual({ id: 'item-1', name: 'Test Item', value: 100 });
      expect(mockListener).toHaveBeenCalled();

      // イベントデータの検証
      const eventData = mockListener.mock.calls[0][0];
      expect(eventData.name).toBe('Test Item');
      expect(eventData.value).toBe(100);
      expect(eventData.result).toEqual({
        id: 'item-1',
        name: 'Test Item',
        value: 100,
      });
    });

    test('複数引数を持つメソッドのラッパー', () => {
      // テスト用のクラス
      class TestClass {
        updateItem(id, data, options) {
          return { id, ...data, options };
        }
      }

      // メソッドとイベントのマッピング
      const methodToEventMap = {
        updateItem: 'item:updated',
      };

      // 移行ラッパーの作成
      const testObject = new TestClass();
      const wrappedObject = migrationHelper.createMigrationWrapper(
        testObject,
        'item',
        methodToEventMap
      );

      // イベントリスナーの登録
      const mockListener = jest.fn();
      emitter.on('item:updated', mockListener);

      // ラップされたメソッドの呼び出し
      const result = wrappedObject.updateItem(
        'item-1',
        { name: 'Updated Item' },
        { silent: true }
      );

      // 結果の検証
      expect(result).toEqual({
        id: 'item-1',
        name: 'Updated Item',
        options: { silent: true },
      });
      expect(mockListener).toHaveBeenCalled();

      // イベントデータの検証
      const eventData = mockListener.mock.calls[0][0];
      expect(eventData.id).toBe('item-1');
      expect(eventData.data).toEqual({ name: 'Updated Item' });
      expect(eventData.options).toEqual({ silent: true });
    });
  });

  describe('実際のユースケース', () => {
    test('タスク管理システムの移行', () => {
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
          };

          this.tasks.set(id, task);
          return task;
        }

        updateTask(id, updates) {
          if (!this.tasks.has(id)) {
            throw new Error(`Task ${id} not found`);
          }

          const task = this.tasks.get(id);
          const previousStatus = task.status;

          Object.assign(task, updates, {
            updated_at: new Date().toISOString(),
          });

          return {
            ...task,
            previousStatus,
          };
        }

        deleteTask(id) {
          if (!this.tasks.has(id)) {
            throw new Error(`Task ${id} not found`);
          }

          const task = this.tasks.get(id);
          this.tasks.delete(id);

          return { success: true, deleted: task };
        }

        getTask(id) {
          if (!this.tasks.has(id)) {
            throw new Error(`Task ${id} not found`);
          }

          return this.tasks.get(id);
        }

        getAllTasks() {
          return Array.from(this.tasks.values());
        }
      }

      // メソッドとイベントのマッピング
      const methodToEventMap = {
        createTask: 'task:created',
        updateTask: 'task:updated',
        deleteTask: 'task:deleted',
        getTask: 'task:accessed',
        getAllTasks: 'task:listAccessed',
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
      const deletedListener = jest.fn();

      emitter.on('task:created', createdListener);
      emitter.on('task:updated', updatedListener);
      emitter.on('task:deleted', deletedListener);

      // タスクの作成
      const task = wrappedTaskManager.createTask({
        title: 'テストタスク',
        description: 'これはテストです',
      });

      // タスクの更新
      const updatedTask = wrappedTaskManager.updateTask(task.id, {
        status: 'in_progress',
      });

      // タスクの削除
      const deleteResult = wrappedTaskManager.deleteTask(task.id);

      // 検証
      expect(task).toBeDefined();
      expect(task.id).toBe('T001');
      expect(task.title).toBe('テストタスク');

      expect(updatedTask).toBeDefined();
      expect(updatedTask.status).toBe('in_progress');
      expect(updatedTask.previousStatus).toBe('pending');

      expect(deleteResult).toBeDefined();
      expect(deleteResult.success).toBe(true);
      expect(deleteResult.deleted.id).toBe('T001');

      // イベントリスナーの検証
      expect(createdListener).toHaveBeenCalled();
      const createdEvent = createdListener.mock.calls[0][0];
      expect(createdEvent.title).toBe('テストタスク');

      expect(updatedListener).toHaveBeenCalled();
      const updatedEvent = updatedListener.mock.calls[0][0];
      expect(updatedEvent.id).toBe('T001');

      expect(deletedListener).toHaveBeenCalled();
      const deletedEvent = deletedListener.mock.calls[0][0];
      expect(deletedEvent.id).toBe('T001');

      // 移行レポートの検証
      const report = migrationHelper.generateMigrationReport();
      expect(report.directMethods).toHaveLength(3);
      expect(report.eventMethods).toHaveLength(3);
      expect(report.migrationProgress.totalDirectCalls).toBe(3);
      expect(report.migrationProgress.totalEventCalls).toBe(3);
      expect(report.migrationProgress.migrationPercentage).toBe(50);
    });
  });
});
