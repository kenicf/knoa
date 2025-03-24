/**
 * アダプター共通テスト
 */

/**
 * 基本的なエラー処理テストを実行
 * @param {Object} adapter - テスト対象のアダプター
 * @param {Object} mockManager - モックマネージャー
 * @param {Array<Object>} methods - テスト対象のメソッド情報
 * @param {Object} mockLogger - モックロガー
 */
function runErrorHandlingTests(adapter, mockManager, methods, mockLogger) {
  describe('エラー処理', () => {
    test.each(methods)(
      '$methodName: エラー時に適切に処理する',
      async ({ methodName, args, errorMessage }) => {
        // モックをリセット
        mockLogger.error.mockClear();
        
        // モックマネージャーのメソッドをエラーを投げるように設定
        mockManager[methodName].mockImplementationOnce(() => {
          throw new Error(errorMessage || 'テストエラー');
        });
        
        // アダプターのメソッドを呼び出す
        const result = await adapter[methodName](...(args || []));
        
        // 結果を検証
        expect(result).toMatchObject({
          error: true,
          message: errorMessage || 'テストエラー',
          operation: methodName
        });
        
        // エラーログが出力されたことを確認
        expect(mockLogger.error).toHaveBeenCalled();
      }
    );
  });
}

/**
 * 回復可能性テストを実行
 * @param {Object} adapter - テスト対象のアダプター
 * @param {Object} mockManager - モックマネージャー
 * @param {string} methodName - テスト対象のメソッド名
 * @param {Array} args - メソッドの引数
 * @param {Object} mockLogger - モックロガー
 */
function runRecoverabilityTests(adapter, mockManager, methodName, args = [], mockLogger) {
  describe('回復可能性', () => {
    test('回復可能なエラーと回復不可能なエラーを区別する', async () => {
      const { ApplicationError } = require('../../../src/lib/core/error-framework');
      
      // モックをリセット
      mockLogger.error.mockClear();
      
      // 回復可能なエラーを発生させる
      mockManager[methodName].mockImplementationOnce(() => {
        throw new ApplicationError('回復可能なエラー', {
          recoverable: true
        });
      });
      
      const result1 = await adapter[methodName](...args);
      
      expect(result1).toMatchObject({
        error: true,
        message: '回復可能なエラー',
        operation: methodName,
        recoverable: true
      });
      
      // モックをリセット
      mockLogger.error.mockClear();
      
      // 回復不可能なエラーを発生させる
      mockManager[methodName].mockImplementationOnce(() => {
        throw new ApplicationError('回復不可能なエラー', {
          recoverable: false
        });
      });
      
      const result2 = await adapter[methodName](...args);
      
      expect(result2).toMatchObject({
        error: true,
        message: '回復不可能なエラー',
        operation: methodName,
        recoverable: false
      });
    });
  });
}

/**
 * バリデーションエラーテストを実行
 * @param {Object} adapter - テスト対象のアダプター
 * @param {string} methodName - テスト対象のメソッド名
 * @param {Array} requiredParams - 必須パラメータのリスト
 * @param {Object} mockLogger - モックロガー
 */
function runValidationTests(adapter, methodName, requiredParams = [], mockLogger) {
  describe(`${methodName}: バリデーション`, () => {
    test.each(requiredParams)(
      'パラメータ %s が指定されていない場合はエラーを返す',
      async (paramName) => {
        // _validateParamsをスパイ
        const validateSpy = jest.spyOn(adapter, '_validateParams');
        const { ValidationError } = require('../../../src/lib/utils/errors');
        
        validateSpy.mockImplementationOnce(() => {
          throw new ValidationError(`パラメータ '${paramName}' は必須です`);
        });
        
        // モックをリセット
        mockLogger.error.mockClear();
        
        // 引数なしでメソッドを呼び出す
        const result = await adapter[methodName]();
        
        // 結果を検証
        expect(result).toMatchObject({
          error: true,
          message: `パラメータ '${paramName}' は必須です`,
          operation: methodName
        });
        
        // エラーログが出力されたことを確認
        expect(mockLogger.error).toHaveBeenCalled();
        
        // スパイをリストア
        validateSpy.mockRestore();
      }
    );
  });
}

module.exports = {
  runErrorHandlingTests,
  runRecoverabilityTests,
  runValidationTests
};