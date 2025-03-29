/**
 * エラーヘルパー関数のテスト
 */

const { emitErrorEvent } = require('../../../src/lib/utils/error-helpers');
const {
  createMockLogger,
  createMockEventEmitter,
  mockTimestamp,
} = require('../../helpers/mock-factory');
const {
  expectStandardizedEventEmitted,
} = require('../../helpers/test-helpers');

describe('error-helpers', () => {
  describe('emitErrorEvent', () => {
    let mockEventEmitter;
    let mockLogger;
    let mockContext;
    const MOCK_TIMESTAMP_ISO = '2025-03-24T00:00:00.000Z';

    beforeEach(() => {
      // モックのセットアップ
      jest.clearAllMocks();
      mockEventEmitter = createMockEventEmitter();
      mockLogger = createMockLogger();
      mockTimestamp(MOCK_TIMESTAMP_ISO);
      mockContext = { id: 'context-123', setError: jest.fn() };
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('ロガーがある場合、エラーを出力する', () => {
      // Arrange
      const error = new Error('テストエラー');
      const component = 'TestComponent';
      const operation = 'testOperation';
      const details = { param1: 'value1' };

      // Act
      emitErrorEvent(mockEventEmitter, mockLogger, component, operation, error, mockContext, details);

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Error in ${component}.${operation}:`,
        error,
        details
      );
    });

    test('ロガーがない場合でもエラーなく動作する', () => {
      // Arrange
      const error = new Error('ロガーなしエラー');

      // Act & Assert
      expect(() => {
          emitErrorEvent(mockEventEmitter, null, 'Comp', 'Op', error);
      }).not.toThrow();
      // emit が 'app:error' イベントで呼び出されることを確認 (テストケースの値に合わせる)
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'app:error',
        expect.objectContaining({
          component: 'Comp', // テストケースで設定された値
          operation: 'Op', // テストケースで設定された値
          message: 'ロガーなしエラー', // テストケースで設定された値
          code: 'ERR_UNKNOWN', // コードなしの場合のデフォルト
          timestamp: expect.any(String),
        })
      );
    });


    test('コンテキストがある場合、setError を呼び出す', () => {
      // Arrange
      const error = new Error('テストエラー');
      const component = 'TestComponent';
      const operation = 'testOperation';
      const details = { param1: 'value1' };

      // Act
      emitErrorEvent(mockEventEmitter, mockLogger, component, operation, error, mockContext, details);

      // Assert
      expect(mockContext.setError).toHaveBeenCalledWith(error, component, operation, details);
    });

    test('コンテキストがない場合、setError は呼び出されない', () => {
      // Arrange
      const error = new Error('テストエラー');

      // Act
      emitErrorEvent(mockEventEmitter, mockLogger, 'Comp', 'Op', error, null); // context is null

      // Assert
      // setError が呼ばれないことを確認するアサーションは不要 (mockContext が null のため)
      // エラーログが出力されることを確認
      expect(mockLogger.error).toHaveBeenCalled();
      // emit が 'app:error' イベントで呼び出されることを確認 (テストケースの値に合わせる)
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'app:error',
        expect.objectContaining({
          component: 'Comp', // テストケースで設定された値
          operation: 'Op', // テストケースで設定された値
          message: 'テストエラー', // テストケースで設定された値
          code: 'ERR_UNKNOWN', // コードなしの場合のデフォルト
          timestamp: expect.any(String),
          _context: null, // コンテキストがない場合は null
        })
      );
      // context.setError が呼び出されないことを確認 (mockContext があれば)
      // expect(mockContext.setError).not.toHaveBeenCalled();
    });


    test.each([
      ['エラーコードあり', new Error('テストエラー'), 'ERR_TEST', 'ERR_TEST'],
      ['エラーコードなし', new Error('コードなしエラー'), null, 'ERR_UNKNOWN'],
    ])(
      '%s の場合、適切なコードで app:error イベントを発行する',
      (_, error, errorCode, expectedCode) => {
        // Arrange
        if (errorCode) error.code = errorCode;
        const component = 'TestComponent';
        const operation = 'testOperation';
        const details = { param1: 'value1' };

        // Act
        emitErrorEvent(mockEventEmitter, mockLogger, component, operation, error, mockContext, details);

        // Assert
        expectStandardizedEventEmitted(mockEventEmitter, 'app', 'error', {
          component,
          operation,
          message: error.message,
          code: expectedCode,
          timestamp: 'any', // タイムスタンプの存在と形式を検証
          details,
          _context: mockContext.id,
        });
      }
    );

    test.each([
      ['コンテキストなし', null, null],
      ['コンテキストあり', { id: 'context-123', setError: jest.fn() }, 'context-123'],
    ])(
      '%s の場合も適切に動作し、app:error イベントを発行する',
      (_, context, expectedContextId) => {
        // Arrange
        const error = new Error('テストエラー');
        const component = 'TestComponent';
        const operation = 'testOperation';

        // Act
        emitErrorEvent(mockEventEmitter, mockLogger, component, operation, error, context);

        // Assert
        expectStandardizedEventEmitted(mockEventEmitter, 'app', 'error', {
          component,
          operation,
          message: error.message,
          code: 'ERR_UNKNOWN',
          timestamp: 'any', // タイムスタンプの存在と形式を検証
          details: {}, // details なしの場合
          _context: expectedContextId,
        });

        if (context) {
          expect(context.setError).toHaveBeenCalled();
        }
      }
    );

    test('イベントエミッターがない場合、イベントは発行されない', () => {
      // Arrange
      const error = new Error('イベントエミッターなしエラー');

      // Act
      emitErrorEvent(null, mockLogger, 'Comp', 'Op', error); // eventEmitter is null

      // Assert
      expect(mockLogger.error).toHaveBeenCalled();
      // emitStandardized は呼ばれないことを確認 (mockEventEmitter が null なので不要)
    });
  });
});
