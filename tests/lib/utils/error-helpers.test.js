/**
 * エラーヘルパー関数のテスト
 */

const { emitErrorEvent } = require('../../../src/lib/utils/error-helpers');
const { 
  createMockLogger, 
  createMockEventEmitter,
  mockTimestamp 
} = require('../../helpers/mock-factory');
const { 
  expectEventEmitted,
  expectLogged
} = require('../../helpers/test-helpers');

describe('error-helpers', () => {
  describe('emitErrorEvent', () => {
    let mockEventEmitter;
    let mockLogger;
    let mockContext;
    
    beforeEach(() => {
      jest.clearAllMocks();
      
      // イベントエミッターとロガーのモック
      mockEventEmitter = createMockEventEmitter();
      mockLogger = createMockLogger();
      
      // 日付・時間関連のモックを設定
      mockTimestamp('2025-03-24T00:00:00.000Z');
      
      // 操作コンテキストのモック
      mockContext = {
        id: 'context-123',
        setError: jest.fn()
      };
    });
    
    afterEach(() => {
      jest.restoreAllMocks();
    });
    
    test('ロガーにエラーを出力する', () => {
      // Arrange
      const error = new Error('テストエラー');
      const component = 'TestComponent';
      const operation = 'testOperation';
      const details = { param1: 'value1' };
      
      // Act
      emitErrorEvent(mockEventEmitter, mockLogger, component, operation, error, mockContext, details);
      
      // Assert
      // expectLoggedの代わりに直接expectを使用
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Error in ${component}.${operation}:`,
        error,
        details
      );
    });
    
    test('コンテキストにエラー状態を設定する', () => {
      // Arrange
      const error = new Error('テストエラー');
      const component = 'TestComponent';
      const operation = 'testOperation';
      const details = { param1: 'value1' };
      
      // Act
      emitErrorEvent(mockEventEmitter, mockLogger, component, operation, error, mockContext, details);
      
      // Assert
      expect(mockContext.setError).toHaveBeenCalledWith(
        error,
        component,
        operation,
        details
      );
    });
    
    test.each([
      ['エラーコードあり', new Error('テストエラー'), 'ERR_TEST', 'ERR_TEST'],
      ['エラーコードなし', new Error('コードなしエラー'), null, 'ERR_UNKNOWN']
    ])('%s の場合、適切なコードでイベントを発行する', (_, error, errorCode, expectedCode) => {
      // Arrange
      if (errorCode) {
        error.code = errorCode;
      }
      
      const component = 'TestComponent';
      const operation = 'testOperation';
      const details = { param1: 'value1' };
      
      // Act
      emitErrorEvent(mockEventEmitter, mockLogger, component, operation, error, mockContext, details);
      
      // Assert
      expectEventEmitted(mockEventEmitter, 'app:error', {
        component,
        operation,
        message: error.message,
        code: expectedCode,
        timestamp: '2025-03-24T00:00:00.000Z',
        details,
        _context: mockContext.id
      });
    });
    
    test.each([
      ['コンテキストなし', null, null],
      ['コンテキストあり', { id: 'context-123', setError: jest.fn() }, 'context-123']
    ])('%s の場合も適切に動作する', (_, context, expectedContextId) => {
      // Arrange
      const error = new Error('テストエラー');
      const component = 'TestComponent';
      const operation = 'testOperation';
      
      // Act
      emitErrorEvent(mockEventEmitter, mockLogger, component, operation, error, context);
      
      // Assert
      expectEventEmitted(mockEventEmitter, 'app:error', {
        _context: expectedContextId
      });
      
      if (context) {
        expect(context.setError).toHaveBeenCalled();
      }
    });
    
    test('ロガーがない場合もエラーなく動作する', () => {
      // Arrange
      const error = new Error('ロガーなしエラー');
      const component = 'TestComponent';
      const operation = 'testOperation';
      
      // Act
      emitErrorEvent(mockEventEmitter, null, component, operation, error);
      
      // Assert
      expect(mockEventEmitter.emit).toHaveBeenCalled();
    });
    
    test('イベントエミッターがない場合、イベントは発行されない', () => {
      // Arrange
      const error = new Error('イベントエミッターなしエラー');
      const component = 'TestComponent';
      const operation = 'testOperation';
      
      // スパイを作成して関数が終了することを確認
      const spy = jest.spyOn(console, 'error').mockImplementation();
      
      // Act
      emitErrorEvent(null, mockLogger, component, operation, error);
      
      // Assert
      // イベントエミッターがないので、emitは呼ばれない
      expect(mockLogger.error).toHaveBeenCalled();
      
      // スパイをリストア
      spy.mockRestore();
    });
  });
});