/**
 * イベントヘルパー関数のテスト
 */

const {
  createStandardizedEventData,
  emitStandardizedEvent,
} = require('../../../src/lib/utils/event-helpers');
const {
  createMockLogger,
  createMockEventEmitter,
  mockTimestamp,
} = require('../../helpers/mock-factory');
const {
  // expectStandardizedEventEmitted はヘルパー自体のテストなので直接検証
  expectLogged,
} = require('../../helpers/test-helpers'); // expectStandardizedEventEmitted を削除

describe('event-helpers', () => {
  const MOCK_TIMESTAMP_ISO = '2021-03-01T00:00:00.000Z';
  const MOCK_TIMESTAMP_MS = new Date(MOCK_TIMESTAMP_ISO).getTime();
  const MOCK_RANDOM = 0.123456789;
  // substr(2, 9) を使用して期待値を生成
  const EXPECTED_TRACE_ID = `trace-${MOCK_TIMESTAMP_MS}-${MOCK_RANDOM.toString(36).substr(2, 9)}`;
  const EXPECTED_REQUEST_ID = `req-${MOCK_TIMESTAMP_MS}-${MOCK_RANDOM.toString(36).substr(2, 9)}`;

  describe('createStandardizedEventData', () => {
    beforeEach(() => {
      mockTimestamp(MOCK_TIMESTAMP_ISO);
      jest.spyOn(Date, 'now').mockReturnValue(MOCK_TIMESTAMP_MS);
      jest.spyOn(Math, 'random').mockReturnValue(MOCK_RANDOM);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test.each([
      [
        '基本的なイベントデータ', {}, 'component',
        {
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: EXPECTED_TRACE_ID,
          requestId: EXPECTED_REQUEST_ID,
        },
      ],
      [
        '既存のデータを保持', { key1: 'value1' }, 'component',
        { key1: 'value1' },
      ],
      [
        '既存のタイムスタンプを保持', { timestamp: '2021-01-01T00:00:00.000Z' }, 'component',
        { timestamp: '2021-01-01T00:00:00.000Z' },
      ],
      [
        '既存のtraceIdとrequestIdを保持 (camelCase)', { traceId: 'existing-trace', requestId: 'existing-req' }, 'component',
        { traceId: 'existing-trace', requestId: 'existing-req' },
      ],
      [
        '既存のtraceIdとrequestIdを保持 (snake_case)', { trace_id: 'existing-trace-s', request_id: 'existing-req-s' }, 'component',
        { trace_id: 'existing-trace-s', request_id: 'existing-req-s', traceId: 'existing-trace-s', requestId: 'existing-req-s' },
      ],
    ])('%s を生成する', (_, data, component, expectedData) => {
      // Act
      const result = createStandardizedEventData(data, component);
      // Assert
      expect(result).toEqual(expect.objectContaining({ ...expectedData, component }));
    });

     test('dataがundefinedの場合でも正しく処理する', () => {
       // Arrange
       const component = 'component';
       // Act
       const result = createStandardizedEventData(undefined, component);
       // Assert
       expect(result).toEqual(expect.objectContaining({
           component,
           timestamp: MOCK_TIMESTAMP_ISO,
           traceId: EXPECTED_TRACE_ID,
           requestId: EXPECTED_REQUEST_ID,
       }));
     });
  });

  // createEventBridge のテストブロックは削除

  describe('emitStandardizedEvent', () => {
    let mockEventEmitter;
    let mockLogger;

    beforeEach(() => {
      // モックのセットアップ
      mockEventEmitter = createMockEventEmitter();
      mockLogger = createMockLogger();
      mockEventEmitter.logger = mockLogger;
      mockEventEmitter.debugMode = true;
      mockTimestamp(MOCK_TIMESTAMP_ISO);
      jest.spyOn(Date, 'now').mockReturnValue(MOCK_TIMESTAMP_MS);
      jest.spyOn(Math, 'random').mockReturnValue(MOCK_RANDOM);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('emitStandardized を使用してイベントを発行する', () => {
      // Arrange
      const component = 'component';
      const action = 'action';
      const data = { key: 'value' };

      // Act
      const result = emitStandardizedEvent(mockEventEmitter, component, action, data);

      // Assert
      expect(result).toBe(true);
      expect(mockEventEmitter.emitStandardized).toHaveBeenCalledWith(
        component,
        action,
        expect.objectContaining({
          key: 'value',
          component,
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: EXPECTED_TRACE_ID,
          requestId: EXPECTED_REQUEST_ID,
        })
      );
      expectLogged(mockLogger, 'debug', '標準化されたイベントを発行');
    });

    test('dataパラメータがundefinedの場合、デフォルト値の空オブジェクトを使用する', () => {
        // Arrange
        const component = 'component';
        const action = 'action';
        const data = undefined;

        // Act
        const result = emitStandardizedEvent(mockEventEmitter, component, action, data);

        // Assert
        expect(result).toBe(true);
        expect(mockEventEmitter.emitStandardized).toHaveBeenCalledWith(
          component,
          action,
          expect.objectContaining({
            component,
            timestamp: MOCK_TIMESTAMP_ISO,
            traceId: EXPECTED_TRACE_ID,
            requestId: EXPECTED_REQUEST_ID,
          })
        );
      });

    test('イベントエミッターがない場合、falseを返し、コンソールエラーを出力する', () => {
      // Arrange
      const component = 'component';
      const action = 'action';
      const data = { key: 'value' };
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // Act
      const result = emitStandardizedEvent(null, component, action, data);

      // Assert
      expect(result).toBe(false);
      // エラーメッセージの内容を実際の出力に合わせる
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `emitStandardizedEvent requires an eventEmitter with emitStandardized method. Component: ${component}, Action: ${action}`
        // 以前の期待値: expect.stringContaining('emitStandardizedEvent requires an eventEmitter'), component, action
      );
      consoleErrorSpy.mockRestore();
    });

     test('eventEmitter に emitStandardized がない場合、falseを返し、エラーログを出力する', () => {
       // Arrange
       const component = 'component';
       const action = 'action';
       const data = { key: 'value' };
       const legacyEmitter = { logger: mockLogger }; // emitStandardized がない

       // Act
       const result = emitStandardizedEvent(legacyEmitter, component, action, data);

       // Assert
       expect(result).toBe(false);
       // エラーメッセージの内容を修正
       expect(mockLogger.error).toHaveBeenCalledWith(
         `emitStandardizedEvent requires an eventEmitter with emitStandardized method. Component: ${component}, Action: ${action}`
       );
     });


    test('デバッグモードがfalseの場合、デバッグログは出力されない', () => {
      // Arrange
      const component = 'component';
      const action = 'action';
      const data = { key: 'value' };
      mockEventEmitter.debugMode = false;

      // Act
      emitStandardizedEvent(mockEventEmitter, component, action, data);

      // Assert
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    test('ロガーがない場合でもエラーは発生しない（コンソールエラーが出力される）', () => {
      // Arrange
      const component = 'component';
      const action = 'action';
      const data = { key: 'value' };
      delete mockEventEmitter.logger;
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('Test Error');
      mockEventEmitter.emitStandardized.mockImplementation(() => { throw error; });

      // Act
      const result = emitStandardizedEvent(mockEventEmitter, component, action, data);

      // Assert
      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `イベント発行中にエラーが発生しました: ${component}:${action}`,
        error
      );
      consoleErrorSpy.mockRestore();
    });

    test('エラーが発生した場合にエラーログを出力する', () => {
      // Arrange
      const component = 'component';
      const action = 'action';
      const data = { key: 'value' };
      const error = new Error('テストエラー');
      mockEventEmitter.emitStandardized.mockImplementation(() => { throw error; });

      // Act
      const result = emitStandardizedEvent(mockEventEmitter, component, action, data);

      // Assert
      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        `イベント発行中にエラーが発生しました: ${component}:${action}`,
        error
      );
    });

    test('エラーが発生し、ロガーがない場合はコンソールエラーを出力する', () => {
      // Arrange
      const component = 'component';
      const action = 'action';
      const data = { key: 'value' };
      const error = new Error('テストエラー');
      const faultyEmitter = { // ロガーなし
        emitStandardized: jest.fn(() => { throw error; }),
        debugMode: true,
      };
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // Act
      const result = emitStandardizedEvent(faultyEmitter, component, action, data);

      // Assert
      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `イベント発行中にエラーが発生しました: ${component}:${action}`,
        error
      );
      consoleErrorSpy.mockRestore();
    });
  });
});
