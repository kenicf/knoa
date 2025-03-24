/**
 * 回復戦略テスト関数
 */

/**
 * エラー回復戦略テストを実行
 * @param {Object} adapter - テスト対象のアダプター
 * @param {Object} mockManager - モックマネージャー
 * @param {Object} mockErrorHandler - モックエラーハンドラー
 * @param {string} methodName - テスト対象のメソッド名
 * @param {Array} args - メソッドの引数
 * @param {string} errorCode - エラーコード
 * @param {Object} mockLogger - モックロガー
 */
function runRecoveryStrategyTest(adapter, mockManager, mockErrorHandler, methodName, args = [], errorCode = 'ERR_TEST', mockLogger) {
  describe(`${methodName}: 回復戦略テスト`, () => {
    beforeEach(() => {
      // ロガーをリセット
      if (mockLogger) {
        mockLogger.error.mockClear();
        mockLogger.info.mockClear();
      }
    });
    
    test('回復戦略が適用される', async () => {
      // 回復戦略を登録
      const recoveryResult = { recovered: true, data: 'recovered data' };
      const recoveryStrategy = jest.fn().mockReturnValue(recoveryResult);
      mockErrorHandler.registerRecoveryStrategy(errorCode, recoveryStrategy);
      
      // 回復可能なエラーを発生させる
      mockManager[methodName].mockImplementationOnce(() => {
        const { ApplicationError } = require('../../../src/lib/core/error-framework');
        throw new ApplicationError('回復可能なエラー', {
          code: errorCode,
          recoverable: true
        });
      });
      
      // アダプターのメソッドを呼び出す
      const result = await adapter[methodName](...args);
      
      // 回復戦略が呼び出されたことを確認
      expect(recoveryStrategy).toHaveBeenCalled();
      
      // 回復結果が返されたことを確認
      expect(result).toEqual(recoveryResult);
    });
    
    test('回復戦略が失敗した場合もエラーが適切に処理される', async () => {
      // 失敗する回復戦略を登録
      const recoveryStrategy = jest.fn().mockImplementation(() => {
        throw new Error('回復戦略エラー');
      });
      mockErrorHandler.registerRecoveryStrategy(errorCode, recoveryStrategy);
      
      // 回復可能なエラーを発生させる
      mockManager[methodName].mockImplementationOnce(() => {
        const { ApplicationError } = require('../../../src/lib/core/error-framework');
        throw new ApplicationError('回復可能なエラー', {
          code: errorCode,
          recoverable: true
        });
      });
      
      // アダプターのメソッドを呼び出す
      const result = await adapter[methodName](...args);
      
      // 回復戦略が呼び出されたことを確認
      expect(recoveryStrategy).toHaveBeenCalled();
      
      // エラー結果が返されることを確認
      expect(result).toMatchObject({
        error: true,
        message: expect.stringContaining('回復戦略エラー'),
        operation: methodName
      });
      
      // エラーログが出力されたことを確認
      if (mockLogger) {
        expect(mockLogger.error).toHaveBeenCalled();
      }
    });
    
    test('回復不可能なエラーは回復戦略が適用されない', async () => {
      // 回復戦略を登録
      const recoveryStrategy = jest.fn();
      mockErrorHandler.registerRecoveryStrategy(errorCode, recoveryStrategy);
      
      // 回復不可能なエラーを発生させる
      mockManager[methodName].mockImplementationOnce(() => {
        const { ApplicationError } = require('../../../src/lib/core/error-framework');
        throw new ApplicationError('回復不可能なエラー', {
          code: errorCode,
          recoverable: false
        });
      });
      
      // アダプターのメソッドを呼び出す
      const result = await adapter[methodName](...args);
      
      // 回復戦略が呼び出されないことを確認
      expect(recoveryStrategy).not.toHaveBeenCalled();
      
      // エラー結果が返されることを確認
      expect(result).toMatchObject({
        error: true,
        message: '回復不可能なエラー',
        operation: methodName,
        recoverable: false
      });
    });
    
    test('エラーコードが一致しない場合は回復戦略が適用されない', async () => {
      // 回復戦略を登録
      const recoveryStrategy = jest.fn();
      mockErrorHandler.registerRecoveryStrategy(errorCode, recoveryStrategy);
      
      // 異なるエラーコードのエラーを発生させる
      mockManager[methodName].mockImplementationOnce(() => {
        const { ApplicationError } = require('../../../src/lib/core/error-framework');
        throw new ApplicationError('異なるエラーコード', {
          code: 'DIFFERENT_ERROR_CODE',
          recoverable: true
        });
      });
      
      // アダプターのメソッドを呼び出す
      const result = await adapter[methodName](...args);
      
      // 回復戦略が呼び出されないことを確認
      expect(recoveryStrategy).not.toHaveBeenCalled();
      
      // エラー結果が返されることを確認
      expect(result).toMatchObject({
        error: true,
        message: '異なるエラーコード',
        operation: methodName,
        code: 'DIFFERENT_ERROR_CODE'
      });
    });
    
    test('回復戦略の登録と削除', async () => {
      // 回復戦略を登録
      const recoveryStrategy = jest.fn().mockReturnValue({ recovered: true });
      mockErrorHandler.registerRecoveryStrategy(errorCode, recoveryStrategy);
      
      // 回復戦略を削除
      mockErrorHandler.removeRecoveryStrategy(errorCode);
      
      // 回復可能なエラーを発生させる
      mockManager[methodName].mockImplementationOnce(() => {
        const { ApplicationError } = require('../../../src/lib/core/error-framework');
        throw new ApplicationError('回復可能なエラー', {
          code: errorCode,
          recoverable: true
        });
      });
      
      // アダプターのメソッドを呼び出す
      const result = await adapter[methodName](...args);
      
      // 回復戦略が呼び出されないことを確認
      expect(recoveryStrategy).not.toHaveBeenCalled();
      
      // エラー結果が返されることを確認
      expect(result).toMatchObject({
        error: true,
        message: '回復可能なエラー',
        operation: methodName
      });
    });
  });
}

module.exports = {
  runRecoveryStrategyTest
};