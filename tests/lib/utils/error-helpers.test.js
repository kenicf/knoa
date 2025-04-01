/**
 * エラーヘルパー関数のテスト
 */

const { emitErrorEvent } = require('../../../src/lib/utils/error-helpers');
const {
  createMockLogger,
  createMockEventEmitter,
  mockTimestamp,
} = require('../../helpers/mock-factory');
// expectLogged は使用しないため削除
// const { expectLogged } = require('../../helpers/test-helpers');

describe('error-helpers', () => {
  describe('emitErrorEvent', () => {
    let mockEventEmitter;
    let mockLogger;
    let mockContext;
    const MOCK_TIMESTAMP_ISO = '2025-03-24T00:00:00.000Z';

    beforeEach(() => {
      // Arrange (Common setup)
      jest.clearAllMocks();
      mockEventEmitter = createMockEventEmitter();
      mockLogger = createMockLogger();
      mockTimestamp(MOCK_TIMESTAMP_ISO); // Set time mock
      mockContext = { id: 'context-123', setError: jest.fn() };
    });

    afterEach(() => {
      // Clean up mocks
      jest.restoreAllMocks();
    });

    test('should log error if logger is provided', () => {
      // Arrange
      const error = new Error('テストエラー');
      const component = 'TestComponent';
      const operation = 'testOperation';
      const details = { param1: 'value1' };

      // Act
      emitErrorEvent(
        mockEventEmitter,
        mockLogger,
        component,
        operation,
        error,
        mockContext,
        details
      );

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Error in ${component}.${operation}:`,
        { error, details } // ログの引数をオブジェクトに変更
      );
    });

    test('should work without error if logger is null', () => {
      // Arrange
      const error = new Error('ロガーなしエラー');
      const component = 'Comp';
      const operation = 'Op';

      // Act & Assert
      expect(() => {
        emitErrorEvent(mockEventEmitter, null, component, operation, error);
      }).not.toThrow();
      // イベント発行はされるはず
      expect(mockEventEmitter.emitStandardized).toHaveBeenCalledWith(
        'app',
        'error',
        expect.objectContaining({
          component: component,
          operation: operation,
          message: error.message,
          code: 'ERR_UNKNOWN',
        })
      );
    });

    test('should call context.setError if context is provided and has setError method', () => {
      // Arrange
      const error = new Error('テストエラー');
      const component = 'TestComponent';
      const operation = 'testOperation';
      const details = { param1: 'value1' };

      // Act
      emitErrorEvent(
        mockEventEmitter,
        mockLogger,
        component,
        operation,
        error,
        mockContext, // setError を持つモックコンテキスト
        details
      );

      // Assert
      expect(mockContext.setError).toHaveBeenCalledWith(
        error,
        component,
        operation,
        details
      );
    });

    test('should not call setError if context is null', () => {
      // Arrange
      const error = new Error('テストエラー');
      const component = 'TestComponent';
      const operation = 'testOperation';

      // Act
      emitErrorEvent(
        mockEventEmitter,
        mockLogger,
        component,
        operation,
        error,
        null // context is null
      );

      // Assert
      // setError が呼ばれないことを確認 (mockContext を使わないのでアサーション不要)
      expect(mockLogger.error).toHaveBeenCalled(); // ログは出力される
      expect(mockEventEmitter.emitStandardized).toHaveBeenCalled(); // イベントは発行される
    });

    test('should not call setError if context does not have setError method', () => {
      // Arrange
      const error = new Error('テストエラー');
      const component = 'TestComponent';
      const operation = 'testOperation';
      const contextWithoutSetError = { id: 'context-456' }; // setError がない

      // Act
      emitErrorEvent(
        mockEventEmitter,
        mockLogger,
        component,
        operation,
        error,
        contextWithoutSetError
      );

      // Assert
      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockEventEmitter.emitStandardized).toHaveBeenCalled();
      // setError が呼ばれないことを確認 (アサーション不要)
    });

    test('should emit app:error event with correct code when error has code', () => {
      // Arrange
      const error = new Error('テストエラー');
      error.code = 'ERR_TEST';
      const component = 'TestComponent';
      const operation = 'testOperation';
      const details = { param1: 'value1' };
      const expectedCode = 'ERR_TEST';

      // Act
      emitErrorEvent(
        mockEventEmitter,
        mockLogger,
        component,
        operation,
        error,
        mockContext,
        details
      );

      // Assert
      expect(mockEventEmitter.emitStandardized).toHaveBeenCalledWith(
        'app',
        'error',
        expect.objectContaining({
          component,
          operation,
          message: error.message,
          code: expectedCode,
          details,
          _contextId: mockContext.id,
        })
      );
      // expectLogged の代わりに logger.error の呼び出しを直接検証
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Error in ${component}.${operation}:`,
        { error, details }
      );
    });

    test('should emit app:error event with ERR_UNKNOWN code when error has no code', () => {
      // Arrange
      const error = new Error('コードなしエラー');
      const component = 'TestComponent';
      const operation = 'testOperation';
      const details = { param1: 'value1' };
      const expectedCode = 'ERR_UNKNOWN';

      // Act
      emitErrorEvent(
        mockEventEmitter,
        mockLogger,
        component,
        operation,
        error,
        mockContext,
        details
      );

      // Assert
      expect(mockEventEmitter.emitStandardized).toHaveBeenCalledWith(
        'app',
        'error',
        expect.objectContaining({
          component,
          operation,
          message: error.message,
          code: expectedCode,
          details,
          _contextId: mockContext.id,
        })
      );
      // expectLogged の代わりに logger.error の呼び出しを直接検証
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Error in ${component}.${operation}:`,
        { error, details }
      );
    });

    test('should emit app:error event correctly when context is null', () => {
      // Arrange
      const error = new Error('テストエラー');
      const component = 'TestComponent';
      const operation = 'testOperation';

      // Act
      emitErrorEvent(
        mockEventEmitter,
        mockLogger,
        component,
        operation,
        error,
        null // context is null
      );

      // Assert
      expect(mockEventEmitter.emitStandardized).toHaveBeenCalledWith(
        'app',
        'error',
        expect.objectContaining({
          component,
          operation,
          message: error.message,
          code: 'ERR_UNKNOWN',
          details: {}, // details なしの場合
          _contextId: null,
        })
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });

    test('should emit app:error event correctly when context has no id', () => {
      // Arrange
      const error = new Error('テストエラー');
      const component = 'TestComponent';
      const operation = 'testOperation';
      const contextWithoutId = { setError: jest.fn() }; // id がないコンテキスト

      // Act
      emitErrorEvent(
        mockEventEmitter,
        mockLogger,
        component,
        operation,
        error,
        contextWithoutId
      );

      // Assert
      expect(mockEventEmitter.emitStandardized).toHaveBeenCalledWith(
        'app',
        'error',
        expect.objectContaining({
          component,
          operation,
          message: error.message,
          code: 'ERR_UNKNOWN',
          details: {},
          _contextId: null, // id がないので null
        })
      );
      expect(contextWithoutId.setError).toHaveBeenCalled(); // setError は呼ばれる
      expect(mockLogger.error).toHaveBeenCalled();
    });

    test('should not emit event if eventEmitter is null', () => {
      // Arrange
      const error = new Error('イベントエミッターなしエラー');
      const component = 'Comp';
      const operation = 'Op';

      // Act
      emitErrorEvent(null, mockLogger, component, operation, error); // eventEmitter is null

      // Assert
      expect(mockLogger.error).toHaveBeenCalled(); // ログは出力される
      expect(mockEventEmitter.emitStandardized).not.toHaveBeenCalled(); // emitStandardized は呼ばれない
    });

    test('should log warning if eventEmitter exists but has no emitStandardized method', () => {
      // Arrange
      const error = new Error('テストエラー');
      const component = 'Comp';
      const operation = 'Op';
      const faultyEmitter = { logger: mockLogger }; // emitStandardized がない

      // Act
      emitErrorEvent(faultyEmitter, mockLogger, component, operation, error);

      // Assert
      expect(mockLogger.error).toHaveBeenCalled(); // 元のエラーログは出力される
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `emitErrorEvent: eventEmitter does not have emitStandardized method. Component: ${component}, Operation: ${operation}`
      );
      // emitStandardized は呼ばれない (アサーション不要)
    });

    test('should log error if emitStandardized throws an error', () => {
      // Arrange
      const error = new Error('テストエラー');
      const component = 'Comp';
      const operation = 'Op';
      const emitError = new Error('Emit failed');
      mockEventEmitter.emitStandardized.mockImplementation(() => {
        throw emitError;
      });

      // Act
      emitErrorEvent(mockEventEmitter, mockLogger, component, operation, error);

      // Assert
      expect(mockLogger.error).toHaveBeenCalledTimes(2); // 元のエラーログと発行失敗ログ
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Error in ${component}.${operation}:`,
        { error, details: {} }
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to emit app:error event',
        { error: emitError, originalError: expect.any(Object) }
      );
    });

    test('should log to console if emitStandardized throws and logger is unavailable', () => {
      // Arrange
      const error = new Error('テストエラー');
      const component = 'Comp';
      const operation = 'Op';
      const emitError = new Error('Emit failed');
      mockEventEmitter.emitStandardized.mockImplementation(() => {
        throw emitError;
      });
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(); // console.error をスパイ

      // Act
      emitErrorEvent(mockEventEmitter, null, component, operation, error); // logger is null

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to emit app:error event:',
        emitError,
        'Original error data:',
        expect.objectContaining({
          component,
          operation,
          message: error.message,
        })
      );
      consoleErrorSpy.mockRestore();
    });
  });
});
