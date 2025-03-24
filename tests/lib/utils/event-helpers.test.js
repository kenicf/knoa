/**
 * イベントヘルパー関数のテスト
 */

const { 
  createStandardizedEventData,
  createEventBridge,
  emitStandardizedEvent
} = require('../../../src/lib/utils/event-helpers');
const { 
  createMockLogger, 
  createMockEventEmitter,
  mockTimestamp 
} = require('../../helpers/mock-factory');
const { 
  expectEventEmitted,
  expectStandardizedEventEmitted,
  expectLogged
} = require('../../helpers/test-helpers');

// event-constantsのモック
jest.mock('../../../src/lib/core/event-constants', () => ({
  EVENT_MAP: {
    'component:action': 'old:event',
    'cache:system_initialized': 'cache:initialized'
  }
}));

describe('event-helpers', () => {
  describe('createStandardizedEventData', () => {
    beforeEach(() => {
      // Date.nowをモック化して時間を制御できるようにする
      mockTimestamp('2021-03-01T00:00:00.000Z');
      const timestamp = new Date('2021-03-01T00:00:00.000Z').getTime();
      jest.spyOn(Date, 'now').mockReturnValue(timestamp);
    });
    
    afterEach(() => {
      jest.restoreAllMocks();
    });
    
    test.each([
      ['基本的なイベントデータ', {}, 'component', {
        timestamp: expect.any(String),
        traceId: expect.stringMatching(/^trace-\d+-[a-z0-9]+$/),
        requestId: expect.stringMatching(/^req-\d+-[a-z0-9]+$/)
      }],
      ['既存のデータを保持', { key1: 'value1', key2: 'value2' }, 'component', {
        key1: 'value1',
        key2: 'value2'
      }],
      ['既存のタイムスタンプを保持', { timestamp: '2021-01-01T00:00:00.000Z' }, 'component', {
        timestamp: '2021-01-01T00:00:00.000Z'
      }],
      ['既存のtraceIdとrequestIdを保持', {
        traceId: 'existing-trace-id',
        requestId: 'existing-request-id'
      }, 'component', {
        traceId: 'existing-trace-id',
        requestId: 'existing-request-id'
      }],
      ['snake_caseのIDも処理', {
        trace_id: 'existing-trace-id',
        request_id: 'existing-request-id'
      }, 'component', {
        trace_id: 'existing-trace-id',
        request_id: 'existing-request-id',
        traceId: 'existing-trace-id',
        requestId: 'existing-request-id'
      }]
    ])('%s を生成する', (_, data, component, expectedData) => {
      // Act
      const result = createStandardizedEventData(data, component);
      
      // Assert
      expect(result).toEqual(expect.objectContaining({
        ...expectedData,
        component
      }));
    });

    test('traceIdとrequestIdがdataに含まれていない場合に自動生成する', () => {
      // Arrange
      const data = { key: 'value' };
      const component = 'component';
      
      // Act
      const result = createStandardizedEventData(data, component);
      
      // Assert
      expect(result).toEqual(expect.objectContaining({
        key: 'value',
        component,
        timestamp: expect.any(String)
      }));
      
      // 44行目のカバレッジを確保するために、明示的に自動生成されたIDを検証
      expect(result.traceId).toMatch(/^trace-\d+-[a-z0-9]+$/);
      expect(result.requestId).toMatch(/^req-\d+-[a-z0-9]+$/);
      
      // 自動生成されたIDが異なることを確認（Math.randomが呼ばれていることの証明）
      const result2 = createStandardizedEventData(data, component);
      expect(result2.traceId).not.toBe(result.traceId);
      expect(result2.requestId).not.toBe(result.requestId);
    });
    
    test('Math.randomとDate.nowを使用してIDを生成する', () => {
      // Arrange
      const data = { key: 'value' };
      const component = 'component';
      
      // Date.nowとMath.randomをスパイ
      const dateNowSpy = jest.spyOn(Date, 'now');
      const mathRandomSpy = jest.spyOn(Math, 'random');
      
      // Act
      createStandardizedEventData(data, component);
      
      // Assert
      expect(dateNowSpy).toHaveBeenCalled();
      expect(mathRandomSpy).toHaveBeenCalled();
      
      // スパイをリストア
      dateNowSpy.mockRestore();
      mathRandomSpy.mockRestore();
    });
    
    test('Math.random.toString(36).substr(2, 9)を使用してIDを生成する', () => {
      // Arrange
      const data = { key: 'value' };
      const component = 'component';
      
      // Math.randomをモック
      const originalMathRandom = Math.random;
      const mockRandom = jest.fn().mockReturnValue(0.123456789);
      Math.random = mockRandom;
      
      // toStringとsubstrをスパイ
      const toStringSpy = jest.spyOn(Number.prototype, 'toString');
      const substrSpy = jest.spyOn(String.prototype, 'substr');
      
      try {
        // Act
        createStandardizedEventData(data, component);
        
        // Assert
        expect(mockRandom).toHaveBeenCalled();
        expect(toStringSpy).toHaveBeenCalledWith(36);
        expect(substrSpy).toHaveBeenCalledWith(2, 9);
      } finally {
        // モックとスパイをリストア
        Math.random = originalMathRandom;
        toStringSpy.mockRestore();
        substrSpy.mockRestore();
      }
    });
    
    test('完全なIDの生成プロセスをテスト', () => {
      // Arrange
      const data = { key: 'value' };
      const component = 'component';
      
      // Date.nowとMath.randomを完全にモック化
      const originalDateNow = Date.now;
      const originalMathRandom = Math.random;
      const originalToString = Number.prototype.toString;
      const originalSubstr = String.prototype.substr;
      
      // モック関数を定義
      Date.now = jest.fn().mockReturnValue(12345);
      
      // Math.randomの戻り値をモック
      const mockRandomValue = 0.123456789;
      Math.random = jest.fn().mockReturnValue(mockRandomValue);
      
      // toString(36)の戻り値をモック
      const mockBase36 = '0.4fzzzz';
      Number.prototype.toString = function(radix) {
        if (this.valueOf() === mockRandomValue && radix === 36) {
          return mockBase36;
        }
        return originalToString.call(this, radix);
      };
      
      // substr(2, 9)の戻り値をモック
      String.prototype.substr = function(start, length) {
        if (this === mockBase36 && start === 2 && length === 9) {
          return '4fzzzz';
        }
        return originalSubstr.call(this, start, length);
      };
      
      try {
        // Act
        const result = createStandardizedEventData(data, component);
        
        // Assert - 完全に生成されたIDを検証
        expect(result.traceId).toBe('trace-12345-4fzzzz');
        expect(result.requestId).toBe('req-12345-4fzzzz');
      } finally {
        // モックを元に戻す
        Date.now = originalDateNow;
        Math.random = originalMathRandom;
        Number.prototype.toString = originalToString;
        String.prototype.substr = originalSubstr;
      }
    });
    
    test('dataがundefinedの場合でも正しく処理する', () => {
      // Arrange
      const component = 'component';
      
      // Act - undefinedを渡す
      const result = createStandardizedEventData(undefined, component);
      
      // Assert
      expect(result).toEqual(expect.objectContaining({
        component,
        timestamp: expect.any(String),
        traceId: expect.stringMatching(/^trace-\d+-[a-z0-9]+$/),
        requestId: expect.stringMatching(/^req-\d+-[a-z0-9]+$/)
      }));
    });
  });
  
  describe('createEventBridge', () => {
    let mockEventEmitter;
    let mockLogger;
    let originalNodeEnv;
    
    beforeEach(() => {
      // 環境変数のモック
      originalNodeEnv = process.env.NODE_ENV;
      
      // イベントエミッターとロガーのモック
      mockEventEmitter = createMockEventEmitter();
      mockLogger = createMockLogger();
      
      // コンソール警告をモック
      originalConsoleWarn = console.warn;
      console.warn = jest.fn();
    });
    
    afterEach(() => {
      // コンソール警告を元に戻す
      console.warn = originalConsoleWarn;
      
      // 環境変数を元に戻す
      process.env.NODE_ENV = originalNodeEnv;
      
      jest.restoreAllMocks();
    });
    
    test('新しいイベント名のリスナーを登録する', () => {
      // Arrange
      const oldEvent = 'old:event';
      const component = 'component';
      const action = 'action';
      
      // Act
      createEventBridge(mockEventEmitter, oldEvent, component, action);
      
      // Assert
      expect(mockEventEmitter.on).toHaveBeenCalledWith(
        `${component}:${action}`,
        expect.any(Function)
      );
    });
    
    test('新しいイベントが発行されたとき、古いイベントも発行する', () => {
      // Arrange
      const oldEvent = 'old:event';
      const component = 'component';
      const action = 'action';
      const eventData = { key: 'value' };
      
      // ブリッジを作成
      createEventBridge(mockEventEmitter, oldEvent, component, action);
      
      // onメソッドの呼び出しを取得
      const onCall = mockEventEmitter.on.mock.calls[0];
      const newEventName = onCall[0];
      const listener = onCall[1];
      
      // モックをリセット
      jest.clearAllMocks();
      
      // Act
      // リスナーを呼び出す（新しいイベントが発行されたときの処理）
      listener(eventData);
      
      // Assert
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        oldEvent,
        expect.objectContaining({
          key: 'value'
        })
      );
    });
    
    test('古いイベント名のリスナーを登録する', () => {
      // Arrange
      const oldEvent = 'old:event';
      const component = 'component';
      const action = 'action';
      
      // Act
      createEventBridge(mockEventEmitter, oldEvent, component, action);
      
      // Assert
      expect(mockEventEmitter.on).toHaveBeenCalledWith(
        oldEvent,
        expect.any(Function)
      );
    });
    
    test('古いイベントが発行されたとき、新しいイベントも発行する', () => {
      // Arrange
      const oldEvent = 'old:event';
      const component = 'component';
      const action = 'action';
      const eventData = { key: 'value' };
      
      // ブリッジを作成
      createEventBridge(mockEventEmitter, oldEvent, component, action);
      
      // onメソッドの呼び出しを取得（2回目の呼び出し）
      const onCall = mockEventEmitter.on.mock.calls[1];
      const oldEventName = onCall[0];
      const listener = onCall[1];
      
      // モックをリセット
      jest.clearAllMocks();
      
      // Act
      // リスナーを呼び出す（古いイベントが発行されたときの処理）
      listener(eventData);
      
      // Assert
      expect(mockEventEmitter.emitStandardized).toHaveBeenCalledWith(
        component,
        action,
        expect.objectContaining({
          key: 'value'
        })
      );
    });
    
    test('古いイベントが発行されたとき、emitStandardizedがない場合はemitを使用する', () => {
      // Arrange
      const oldEvent = 'old:event';
      const component = 'component';
      const action = 'action';
      const eventData = { key: 'value' };
      
      // emitStandardizedがないイベントエミッターを作成
      const legacyEventEmitter = {
        on: jest.fn(),
        emit: jest.fn()
      };
      
      // ブリッジを作成
      createEventBridge(legacyEventEmitter, oldEvent, component, action);
      
      // onメソッドの呼び出しを取得（2回目の呼び出し）
      const onCall = legacyEventEmitter.on.mock.calls[1];
      const listener = onCall[1];
      
      // モックをリセット
      jest.clearAllMocks();
      legacyEventEmitter.emit.mockClear();
      
      // Act
      // リスナーを呼び出す（古いイベントが発行されたときの処理）
      listener(eventData);
      
      // Assert
      expect(legacyEventEmitter.emit).toHaveBeenCalledWith(
        `${component}:${action}`,
        eventData
      );
    });
    
    test('開発環境では非推奨警告を表示する', () => {
      // Arrange
      // 開発環境に設定
      process.env.NODE_ENV = 'development';
      
      const oldEvent = 'old:event';
      const component = 'component';
      const action = 'action';
      
      // Act
      createEventBridge(mockEventEmitter, oldEvent, component, action);
      
      // Assert
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('非推奨のイベント名')
      );
    });
    
    test('本番環境では非推奨警告を表示しない', () => {
      // Arrange
      // 本番環境に設定
      process.env.NODE_ENV = 'production';
      
      const oldEvent = 'old:event';
      const component = 'component';
      const action = 'action';
      
      // Act
      createEventBridge(mockEventEmitter, oldEvent, component, action);
      
      // Assert
      expect(console.warn).not.toHaveBeenCalled();
    });
  });
  
  describe('emitStandardizedEvent', () => {
    let mockEventEmitter;
    let mockLogger;
    let originalNodeEnv;
    
    beforeEach(() => {
      // 環境変数のモック
      originalNodeEnv = process.env.NODE_ENV;
      
      // イベントエミッターとロガーのモック
      mockEventEmitter = createMockEventEmitter();
      mockLogger = createMockLogger();
      
      // イベントエミッターにロガーを追加
      mockEventEmitter.logger = mockLogger;
      mockEventEmitter.debugMode = true;
      
      // コンソール警告をモック
      originalConsoleWarn = console.warn;
      console.warn = jest.fn();
      
      // 日付・時間関連のモックを設定
      mockTimestamp('2021-03-01T00:00:00.000Z');
    });
    
    afterEach(() => {
      // コンソール警告を元に戻す
      console.warn = originalConsoleWarn;
      
      // 環境変数を元に戻す
      process.env.NODE_ENV = originalNodeEnv;
      
      jest.restoreAllMocks();
    });
    
    test('emitStandardizedが利用可能な場合、それを使用する', () => {
      // Arrange
      const component = 'component';
      const action = 'action';
      const data = { key: 'value' };
      
      // Act
      const result = emitStandardizedEvent(mockEventEmitter, component, action, data);
      
      // Assert
      expect(result).toBe(true);
      expectStandardizedEventEmitted(mockEventEmitter, component, action, {
        key: 'value'
      });
      expectLogged(mockLogger, 'debug', '標準化されたイベントを発行');
    });
    
    test('emitStandardizedが利用できない場合、emitを使用する', () => {
      // Arrange
      const component = 'component';
      const action = 'action';
      const data = { key: 'value' };
      
      const legacyEventEmitter = {
        emit: jest.fn(),
        logger: createMockLogger(),
        debugMode: true
      };
      
      // Act
      const result = emitStandardizedEvent(legacyEventEmitter, component, action, data);
      
      // Assert
      expect(result).toBe(true);
      expectEventEmitted(legacyEventEmitter, `${component}:${action}`, {
        key: 'value',
        component,
        timestamp: expect.any(String)
      });
      expectLogged(legacyEventEmitter.logger, 'debug', 'イベントを発行');
    });
    
    test('開発環境では非推奨警告を表示する', () => {
      // Arrange
      // 開発環境に設定
      process.env.NODE_ENV = 'development';
      
      const component = 'component';
      const action = 'action';
      const data = { key: 'value' };
      
      const legacyEventEmitter = {
        emit: jest.fn(),
        logger: createMockLogger(),
        debugMode: true
      };
      
      // Act
      emitStandardizedEvent(legacyEventEmitter, component, action, data);
      
      // Assert
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('非推奨のイベント名')
      );
    });
    
    test('本番環境では非推奨警告を表示しない', () => {
      // Arrange
      // 本番環境に設定
      process.env.NODE_ENV = 'production';
      
      const component = 'component';
      const action = 'action';
      const data = { key: 'value' };
      
      const legacyEventEmitter = {
        emit: jest.fn(),
        logger: createMockLogger(),
        debugMode: true
      };
      
      // Act
      emitStandardizedEvent(legacyEventEmitter, component, action, data);
      
      // Assert
      expect(console.warn).not.toHaveBeenCalled();
    });
    
    test('イベントエミッターがない場合、falseを返す', () => {
      // Arrange
      const component = 'component';
      const action = 'action';
      const data = { key: 'value' };
      
      // Act
      const result = emitStandardizedEvent(null, component, action, data);
      
      // Assert
      expect(result).toBe(false);
    });
    
    test('デバッグモードがfalseの場合、ログは出力されない', () => {
      // Arrange
      const component = 'component';
      const action = 'action';
      const data = { key: 'value' };
      
      // デバッグモードをfalseに設定
      mockEventEmitter.debugMode = false;
      
      // Act
      emitStandardizedEvent(mockEventEmitter, component, action, data);
      
      // Assert
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });
    
    test('ロガーがない場合、エラーは発生しない', () => {
      // Arrange
      const component = 'component';
      const action = 'action';
      const data = { key: 'value' };
      
      // ロガーを削除
      delete mockEventEmitter.logger;
      
      // Act & Assert
      expect(() => {
        emitStandardizedEvent(mockEventEmitter, component, action, data);
      }).not.toThrow();
    });

    test('bridgeOldEventsがtrueでEVENT_MAPにマッピングがある場合、古いイベント名で発行する', () => {
      // Arrange
      const component = 'component';
      const action = 'action';
      const data = { key: 'value' };
      
      // モックを復元
      mockEventEmitter = createMockEventEmitter();
      mockLogger = createMockLogger();
      mockEventEmitter.logger = mockLogger;
      mockEventEmitter.debugMode = true;
      
      // Act
      const result = emitStandardizedEvent(mockEventEmitter, component, action, data, true);
      
      // Assert
      expect(result).toBe(true);
      expectStandardizedEventEmitted(mockEventEmitter, component, action, { key: 'value' });
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('old:event', expect.objectContaining({
        key: 'value',
        component,
        timestamp: expect.any(String)
      }));
      expectLogged(mockLogger, 'debug', '古いイベント名でも発行');
    });

    test('bridgeOldEventsがfalseの場合、古いイベント名で発行しない', () => {
      // Arrange
      const component = 'component';
      const action = 'action';
      const data = { key: 'value' };
      
      // モックをリセット
      jest.clearAllMocks();
      
      // Act
      const result = emitStandardizedEvent(mockEventEmitter, component, action, data, false);
      
      // Assert
      expect(result).toBe(true);
      expectStandardizedEventEmitted(mockEventEmitter, component, action, { key: 'value' });
      // 'old:event'で呼び出されていないことを確認
      const oldEventCalls = mockEventEmitter.emit.mock.calls.filter(
        call => call[0] === 'old:event'
      );
      expect(oldEventCalls.length).toBe(0);
    });
    
    test('dataパラメータがundefinedの場合、デフォルト値の空オブジェクトを使用する', () => {
      // Arrange
      const component = 'component';
      const action = 'action';
      // dataを明示的にundefinedに設定
      const data = undefined;
      
      // モックをリセット
      jest.clearAllMocks();
      
      // Act
      const result = emitStandardizedEvent(mockEventEmitter, component, action, data);
      
      // Assert
      expect(result).toBe(true);
      expectStandardizedEventEmitted(mockEventEmitter, component, action, {});
    });
    
    test('emitStandardizedが利用できない場合でデバッグモードがtrueだがロガーがない場合', () => {
      // Arrange
      const component = 'component';
      const action = 'action';
      const data = { key: 'value' };
      
      // コンソール警告をモック
      const originalConsoleWarn = console.warn;
      console.warn = jest.fn();
      
      // コンソールエラーをモック
      const originalConsoleError = console.error;
      console.error = jest.fn();
      
      try {
        const legacyEventEmitter = {
          emit: jest.fn(),
          debugMode: true
          // ロガーなし
        };
        
        // Act
        const result = emitStandardizedEvent(legacyEventEmitter, component, action, data);
        
        // Assert
        // エラーが発生するため、falseが返される
        expect(result).toBe(false);
        // エラーが発生するため、コンソールエラーが呼ばれる
        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining(`イベント発行中にエラーが発生しました: ${component}:${action}`),
          expect.any(Error)
        );
      } finally {
        // コンソール警告とエラーを元に戻す
        console.warn = originalConsoleWarn;
        console.error = originalConsoleError;
      }
    });
    
    test('EVENT_MAPにマッピングがあるが、debugModeがfalseの場合、デバッグログは出力されない', () => {
      // Arrange
      const component = 'component';
      const action = 'action';
      const data = { key: 'value' };
      
      // デバッグモードをfalseに設定
      mockEventEmitter.debugMode = false;
      
      // モックをリセット
      jest.clearAllMocks();
      
      // Act
      const result = emitStandardizedEvent(mockEventEmitter, component, action, data, true);
      
      // Assert
      expect(result).toBe(true);
      expectStandardizedEventEmitted(mockEventEmitter, component, action, { key: 'value' });
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('old:event', expect.any(Object));
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    // 126行目のブランチカバレッジを向上させるための特別なテスト
    describe('126行目のブランチカバレッジテスト', () => {
      // 126行目: } else if (eventEmitter.debugMode) {
      test('EVENT_MAPにマッピングがなく、debugModeがtrueの場合', () => {
        // Arrange
        const component = 'unknown';
        const action = 'action';
        const data = { key: 'value' };
        
        // イベントエミッターとロガーを設定
        const testEventEmitter = {
          emitStandardized: jest.fn(),
          emit: jest.fn(),
          logger: {
            debug: jest.fn()
          },
          debugMode: true
        };
        
        // Act - 126-127行目のブランチを実行
        const result = emitStandardizedEvent(testEventEmitter, component, action, data, true);
        
        // Assert
        expect(result).toBe(true);
        // 126-127行目のブランチをカバーするために、明示的にdebugメソッドが呼ばれたことを検証
        expect(testEventEmitter.logger.debug).toHaveBeenCalledWith(
          expect.stringContaining('古いイベント名のマッピングが見つかりません'),
          expect.any(Object)
        );
      });
      
      test('EVENT_MAPにマッピングがなく、debugModeがfalseの場合', () => {
        // Arrange
        const component = 'unknown';
        const action = 'action';
        const data = { key: 'value' };
        
        // イベントエミッターとロガーを設定（debugModeがfalse）
        const testEventEmitter = {
          emitStandardized: jest.fn(),
          emit: jest.fn(),
          logger: {
            debug: jest.fn()
          },
          debugMode: false
        };
        
        // Act - 126行目のelse ifブランチを実行しない
        const result = emitStandardizedEvent(testEventEmitter, component, action, data, true);
        
        // Assert
        expect(result).toBe(true);
        // debugModeがfalseなので、debugメソッドは呼ばれない
        expect(testEventEmitter.logger.debug).not.toHaveBeenCalled();
      });
    });
    
    test('EVENT_MAPにマッピングがない場合でロガーがなくデバッグモードがtrueの場合', () => {
      // Arrange
      const component = 'unknown';
      const action = 'action';
      const data = { key: 'value' };
      
      // コンソール警告をモック
      const originalConsoleWarn = console.warn;
      console.warn = jest.fn();
      
      // コンソールエラーをモック
      const originalConsoleError = console.error;
      console.error = jest.fn();
      
      try {
        // ロガーなしのイベントエミッター
        const noLoggerEmitter = {
          emitStandardized: jest.fn(),
          emit: jest.fn(),
          debugMode: true
          // ロガーなし
        };
        
        // Act
        const result = emitStandardizedEvent(noLoggerEmitter, component, action, data, true);
        
        // Assert
        // エラーが発生するため、falseが返される
        expect(result).toBe(false);
        // エラーが発生するため、コンソールエラーが呼ばれる
        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining(`イベント発行中にエラーが発生しました: ${component}:${action}`),
          expect.any(Error)
        );
      } finally {
        // コンソール警告とエラーを元に戻す
        console.warn = originalConsoleWarn;
        console.error = originalConsoleError;
      }
    });
    
    test('EVENT_MAPにマッピングがあり、ロガーがなくデバッグモードがtrueの場合', () => {
      // Arrange
      const component = 'component';
      const action = 'action';
      const data = { key: 'value' };
      
      // コンソール警告をモック
      const originalConsoleWarn = console.warn;
      console.warn = jest.fn();
      
      // コンソールエラーをモック
      const originalConsoleError = console.error;
      console.error = jest.fn();
      
      try {
        // ロガーなしのイベントエミッター
        const noLoggerEmitter = {
          emitStandardized: jest.fn(),
          emit: jest.fn(),
          debugMode: true
          // ロガーなし
        };
        
        // Act
        const result = emitStandardizedEvent(noLoggerEmitter, component, action, data, true);
        
        // Assert
        // エラーが発生するため、falseが返される
        expect(result).toBe(false);
        // エラーが発生するため、コンソールエラーが呼ばれる
        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining(`イベント発行中にエラーが発生しました: ${component}:${action}`),
          expect.any(Error)
        );
      } finally {
        // コンソール警告とエラーを元に戻す
        console.warn = originalConsoleWarn;
        console.error = originalConsoleError;
      }
    });

    test('エラーが発生した場合にエラーログを出力する', () => {
      // Arrange
      const component = 'component';
      const action = 'action';
      const data = { key: 'value' };
      
      // エラーを発生させるモックエミッター
      const faultyEmitter = {
        emitStandardized: jest.fn(() => { throw new Error('テストエラー'); }),
        logger: createMockLogger(),
        debugMode: true
      };
      
      // Act
      const result = emitStandardizedEvent(faultyEmitter, component, action, data);
      
      // Assert
      expect(result).toBe(false);
      expect(faultyEmitter.logger.error).toHaveBeenCalledWith(
        expect.stringContaining(`イベント発行中にエラーが発生しました: ${component}:${action}`),
        expect.any(Error)
      );
    });

    test('エラーが発生し、ロガーがない場合はコンソールエラーを出力する', () => {
      // Arrange
      const component = 'component';
      const action = 'action';
      const data = { key: 'value' };
      
      // エラーを発生させるモックエミッター（ロガーなし）
      const faultyEmitter = {
        emitStandardized: jest.fn(() => { throw new Error('テストエラー'); }),
        debugMode: true
      };
      
      // コンソールエラーをモック
      const originalConsoleError = console.error;
      console.error = jest.fn();
      
      try {
        // Act
        const result = emitStandardizedEvent(faultyEmitter, component, action, data);
        
        // Assert
        expect(result).toBe(false);
        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining(`イベント発行中にエラーが発生しました: ${component}:${action}`),
          expect.any(Error)
        );
      } finally {
        // コンソールエラーを元に戻す
        console.error = originalConsoleError;
      }
    });
  });
});