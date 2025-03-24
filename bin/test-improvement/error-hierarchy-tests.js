/**
 * エラー階層テスト関数
 */
const { 
  ApplicationError, 
  ValidationError, 
  StateError, 
  DataConsistencyError,
  StorageError,
  NetworkError,
  TimeoutError
} = require('../../../src/lib/core/error-framework');

/**
 * エラー階層テストを実行
 * @param {Object} adapter - テスト対象のアダプター
 * @param {Object} mockManager - モックマネージャー
 * @param {string} methodName - テスト対象のメソッド名
 * @param {Array} args - メソッドの引数
 * @param {Object} mockLogger - モックロガー
 */
function runErrorHierarchyTest(adapter, mockManager, methodName, args = [], mockLogger) {
  describe(`${methodName}: エラー階層テスト`, () => {
    const errorTypes = [
      { ErrorClass: ValidationError, code: 'ERR_VALIDATION', recoverable: true },
      { ErrorClass: StateError, code: 'ERR_STATE', recoverable: false },
      { ErrorClass: DataConsistencyError, code: 'ERR_DATA_CONSISTENCY', recoverable: false },
      { ErrorClass: StorageError, code: 'ERR_STORAGE', recoverable: true },
      { ErrorClass: NetworkError, code: 'ERR_NETWORK', recoverable: true },
      { ErrorClass: TimeoutError, code: 'ERR_TIMEOUT', recoverable: true }
    ];
    
    test.each(errorTypes)(
      '異なる種類のエラー ($ErrorClass.name) を適切に処理できる',
      async ({ ErrorClass, code, recoverable }) => {
        // モックをリセット
        mockLogger.error.mockClear();
        
        // エラーを発生させるモック
        mockManager[methodName].mockImplementationOnce(() => {
          throw new ErrorClass(`${ErrorClass.name}テスト`, { code });
        });
        
        // アダプターのメソッドを呼び出す
        const result = await adapter[methodName](...args);
        
        // 結果を検証
        expect(result).toMatchObject({
          error: true,
          message: `${ErrorClass.name}テスト`,
          code,
          recoverable,
          operation: methodName
        });
        
        // エラーログが出力されたことを確認
        expect(mockLogger.error).toHaveBeenCalled();
      }
    );
  });
}

/**
 * エラーコードテストを実行
 * @param {Object} adapter - テスト対象のアダプター
 * @param {Object} mockManager - モックマネージャー
 * @param {string} methodName - テスト対象のメソッド名
 * @param {Array} args - メソッドの引数
 * @param {Object} mockLogger - モックロガー
 */
function runErrorCodeTest(adapter, mockManager, methodName, args = [], mockLogger) {
  describe(`${methodName}: エラーコードテスト`, () => {
    test('カスタムエラーコードが保持される', async () => {
      // モックをリセット
      mockLogger.error.mockClear();
      
      // カスタムエラーコードを持つエラーを発生させる
      mockManager[methodName].mockImplementationOnce(() => {
        throw new ApplicationError('カスタムエラーコードテスト', {
          code: 'CUSTOM_ERROR_CODE'
        });
      });
      
      // アダプターのメソッドを呼び出す
      const result = await adapter[methodName](...args);
      
      // 結果を検証
      expect(result).toMatchObject({
        error: true,
        message: 'カスタムエラーコードテスト',
        code: 'CUSTOM_ERROR_CODE',
        operation: methodName
      });
    });
  });
}

/**
 * エラーコンテキストテストを実行
 * @param {Object} adapter - テスト対象のアダプター
 * @param {Object} mockManager - モックマネージャー
 * @param {string} methodName - テスト対象のメソッド名
 * @param {Array} args - メソッドの引数
 * @param {Object} mockLogger - モックロガー
 */
function runErrorContextTest(adapter, mockManager, methodName, args = [], mockLogger) {
  describe(`${methodName}: エラーコンテキストテスト`, () => {
    test('エラーコンテキスト情報が保持される', async () => {
      // モックをリセット
      mockLogger.error.mockClear();
      
      // コンテキスト情報を持つエラーを発生させる
      const contextData = { 
        userId: 'U001', 
        sessionId: 'S001', 
        timestamp: new Date().toISOString() 
      };
      
      mockManager[methodName].mockImplementationOnce(() => {
        throw new ApplicationError('コンテキスト情報テスト', {
          context: contextData
        });
      });
      
      // アダプターのメソッドを呼び出す
      const result = await adapter[methodName](...args);
      
      // 結果を検証
      expect(result).toMatchObject({
        error: true,
        message: 'コンテキスト情報テスト',
        operation: methodName
      });
      
      // エラーログにコンテキスト情報が含まれていることを確認
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          context: expect.objectContaining(contextData)
        }),
        expect.anything()
      );
    });
  });
}

module.exports = {
  runErrorHierarchyTest,
  runErrorCodeTest,
  runErrorContextTest
};