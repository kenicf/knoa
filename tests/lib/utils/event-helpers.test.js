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

describe('event-helpers', () => {
  const MOCK_TIMESTAMP_ISO = '2021-03-01T00:00:00.000Z';
  const MOCK_TIMESTAMP_MS = new Date(MOCK_TIMESTAMP_ISO).getTime();
  const MOCK_RANDOM = 0.123456789;
  // substr(2, 9) を使用して期待値を生成
  const EXPECTED_TRACE_ID = `trace-${MOCK_TIMESTAMP_MS}-${MOCK_RANDOM.toString(36).substr(2, 9)}`;
  const EXPECTED_REQUEST_ID = `req-${MOCK_TIMESTAMP_MS}-${MOCK_RANDOM.toString(36).substr(2, 9)}`;

  describe('createStandardizedEventData', () => {
    beforeEach(() => {
      // Arrange (Common setup for this describe block)
      mockTimestamp(MOCK_TIMESTAMP_ISO);
      jest.spyOn(Date, 'now').mockReturnValue(MOCK_TIMESTAMP_MS);
      jest.spyOn(Math, 'random').mockReturnValue(MOCK_RANDOM);
    });

    afterEach(() => {
      // Clean up mocks
      jest.restoreAllMocks();
    });

    test.each([
      [
        '基本的なイベントデータ',
        {}, // 入力データ
        'component', // コンポーネント名
        {
          // 期待される完全なデータ
          component: 'component',
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: EXPECTED_TRACE_ID,
          requestId: EXPECTED_REQUEST_ID,
        },
      ],
      [
        '既存のデータを保持',
        { key1: 'value1' },
        'component',
        {
          key1: 'value1',
          component: 'component',
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: EXPECTED_TRACE_ID,
          requestId: EXPECTED_REQUEST_ID,
        },
      ],
      [
        '既存のタイムスタンプを保持',
        { timestamp: '2021-01-01T00:00:00.000Z' },
        'component',
        {
          component: 'component',
          timestamp: '2021-01-01T00:00:00.000Z', // 既存の値を期待
          traceId: EXPECTED_TRACE_ID,
          requestId: EXPECTED_REQUEST_ID,
        },
      ],
      [
        '既存のtraceIdとrequestIdを保持 (camelCase)',
        { traceId: 'existing-trace', requestId: 'existing-req' },
        'component',
        {
          component: 'component',
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: 'existing-trace', // 既存の値を期待
          requestId: 'existing-req', // 既存の値を期待
        },
      ],
      [
        '既存のtraceIdとrequestIdを保持 (snake_case)',
        { trace_id: 'existing-trace-s', request_id: 'existing-req-s' },
        'component',
        {
          trace_id: 'existing-trace-s',
          request_id: 'existing-req-s',
          component: 'component',
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: 'existing-trace-s', // snake_case が camelCase にコピーされることを期待
          requestId: 'existing-req-s', // snake_case が camelCase にコピーされることを期待
        },
      ],
    ])('should generate %s', (_, data, component, expectedFullData) => {
      // expectedPartialData -> expectedFullData
      // Act
      const result = createStandardizedEventData(data, component);

      // Assert
      // expect.objectContaining ではなく toEqual で完全一致を検証
      expect(result).toEqual(expectedFullData);
    });

    test('should handle undefined data correctly', () => {
      // Arrange
      const component = 'component';
      const expectedFullData = {
        // 期待される完全なデータ
        component: 'component',
        timestamp: MOCK_TIMESTAMP_ISO,
        traceId: EXPECTED_TRACE_ID,
        requestId: EXPECTED_REQUEST_ID,
      };

      // Act
      const result = createStandardizedEventData(undefined, component);

      // Assert
      // expect.objectContaining ではなく toEqual で完全一致を検証
      expect(result).toEqual(expectedFullData);
    });
  });

  describe('emitStandardizedEvent', () => {
    let mockEventEmitter;
    let mockLogger;

    beforeEach(() => {
      // Arrange (Common setup for this describe block)
      mockEventEmitter = createMockEventEmitter();
      mockLogger = createMockLogger();
      mockEventEmitter.logger = mockLogger; // Attach logger to mock emitter
      mockEventEmitter.debugMode = true; // Enable debug mode for testing logs
      mockTimestamp(MOCK_TIMESTAMP_ISO);
      jest.spyOn(Date, 'now').mockReturnValue(MOCK_TIMESTAMP_MS);
      jest.spyOn(Math, 'random').mockReturnValue(MOCK_RANDOM);
    });

    afterEach(() => {
      // Clean up mocks
      jest.restoreAllMocks();
    });

    test('should call emitStandardized with standardized data and log debug message', () => {
      // Arrange
      const component = 'component';
      const action = 'action';
      const data = { key: 'value' };
      const expectedStandardizedData = {
        key: 'value',
        component,
        timestamp: MOCK_TIMESTAMP_ISO,
        traceId: EXPECTED_TRACE_ID,
        requestId: EXPECTED_REQUEST_ID,
      };

      // Act
      const result = emitStandardizedEvent(
        mockEventEmitter,
        component,
        action,
        data
      );

      // Assert
      expect(result).toBe(true);
      expect(mockEventEmitter.emitStandardized).toHaveBeenCalledWith(
        component,
        action,
        expect.objectContaining(expectedStandardizedData)
      );
      // Verify debug log using mockLogger directly
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `標準化されたイベントを発行: ${component}:${action}`,
        expect.objectContaining({
          component,
          action,
          standardEvent: `${component}:${action}`,
          timestamp: MOCK_TIMESTAMP_ISO,
        })
      );
    });

    test('should use default empty object for data if data parameter is undefined', () => {
      // Arrange
      const component = 'component';
      const action = 'action';
      const data = undefined;
      const expectedStandardizedData = {
        component,
        timestamp: MOCK_TIMESTAMP_ISO,
        traceId: EXPECTED_TRACE_ID,
        requestId: EXPECTED_REQUEST_ID,
      };

      // Act
      const result = emitStandardizedEvent(
        mockEventEmitter,
        component,
        action,
        data
      );

      // Assert
      expect(result).toBe(true);
      expect(mockEventEmitter.emitStandardized).toHaveBeenCalledWith(
        component,
        action,
        expect.objectContaining(expectedStandardizedData)
      );
    });

    test('should return false and log console error if eventEmitter is null', () => {
      // Arrange
      const component = 'component';
      const action = 'action';
      const data = { key: 'value' };
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // Act
      const result = emitStandardizedEvent(null, component, action, data);

      // Assert
      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `emitStandardizedEvent requires an eventEmitter with emitStandardized method. Component: ${component}, Action: ${action}`
      );
      expect(mockEventEmitter.emitStandardized).not.toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    test('should return false and log error if eventEmitter lacks emitStandardized method', () => {
      // Arrange
      const component = 'component';
      const action = 'action';
      const data = { key: 'value' };
      const legacyEmitter = { logger: mockLogger }; // No emitStandardized

      // Act
      const result = emitStandardizedEvent(
        legacyEmitter,
        component,
        action,
        data
      );

      // Assert
      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        `emitStandardizedEvent requires an eventEmitter with emitStandardized method. Component: ${component}, Action: ${action}`
      );
      // Ensure emitStandardized was not called (it doesn't exist)
    });

    test('should not log debug message if debugMode is false', () => {
      // Arrange
      const component = 'component';
      const action = 'action';
      const data = { key: 'value' };
      mockEventEmitter.debugMode = false; // Disable debug mode

      // Act
      emitStandardizedEvent(mockEventEmitter, component, action, data);

      // Assert
      expect(mockEventEmitter.emitStandardized).toHaveBeenCalled(); // Still emits
      expect(mockLogger.debug).not.toHaveBeenCalled(); // But does not log debug
    });

    test('should return false and log error if emitStandardized throws', () => {
      // Arrange
      const component = 'component';
      const action = 'action';
      const data = { key: 'value' };
      const error = new Error('テストエラー');
      mockEventEmitter.emitStandardized.mockImplementation(() => {
        throw error;
      });

      // Act
      const result = emitStandardizedEvent(
        mockEventEmitter,
        component,
        action,
        data
      );

      // Assert
      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        `イベント発行中にエラーが発生しました: ${component}:${action}`,
        error
      );
    });

    test('should return false and log console error if emitStandardized throws and logger is unavailable', () => {
      // Arrange
      const component = 'component';
      const action = 'action';
      const data = { key: 'value' };
      const error = new Error('テストエラー');
      const faultyEmitter = {
        // No logger attached
        emitStandardized: jest.fn(() => {
          throw error;
        }),
        debugMode: true,
      };
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // Act
      const result = emitStandardizedEvent(
        faultyEmitter,
        component,
        action,
        data
      );

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
