/**
 * エラーイベントテスト関数
 */

/**
 * エラーイベントテストを実行
 * @param {Object} adapter - テスト対象のアダプター
 * @param {Object} mockManager - モックマネージャー
 * @param {Object} mockEventEmitter - モックイベントエミッター
 * @param {string} methodName - テスト対象のメソッド名
 * @param {Array} args - メソッドの引数
 * @param {string} component - コンポーネント名
 * @param {Object} mockLogger - モックロガー
 */
function runErrorEventTest(adapter, mockManager, mockEventEmitter, methodName, args = [], component, mockLogger) {
  describe(`${methodName}: エラーイベントテスト`, () => {
    let errorListener;
    let legacyErrorListener;
    let globalErrorListener;
    
    beforeEach(() => {
      // リスナーをリセット
      errorListener = jest.fn();
      legacyErrorListener = jest.fn();
      globalErrorListener = jest.fn();
      
      // エラーイベントリスナーを設定
      mockEventEmitter.on('app:error', errorListener);
      mockEventEmitter.on(`${component}:error`, legacyErrorListener);
      mockEventEmitter.on('error', globalErrorListener);
      
      // ロガーをリセット
      mockLogger.error.mockClear();
    });
    
    test('エラー時にapp:errorイベントを発行する', async () => {
      // エラーを発生させる
      mockManager[methodName].mockImplementationOnce(() => {
        throw new Error('テストエラー');
      });
      
      // メソッドを呼び出す
      const result = await adapter[methodName](...args);
      
      // エラー結果を確認
      expect(result).toMatchObject({
        error: true,
        message: 'テストエラー',
        operation: methodName
      });
      
      // 各種エラーイベントが発行されたことを確認
      expect(errorListener).toHaveBeenCalled();
      expect(legacyErrorListener).toHaveBeenCalled();
      expect(globalErrorListener).toHaveBeenCalled();
      
      // エラーイベントのデータを確認
      const errorData = errorListener.mock.calls[0][0];
      expect(errorData.component).toBe(component);
      expect(errorData.operation).toBe(methodName);
      expect(errorData.message).toBe('テストエラー');
      expect(errorData.timestamp).toBeDefined();
      
      // エラーログが出力されたことを確認
      expect(mockLogger.error).toHaveBeenCalled();
    });
    
    test('ApplicationErrorのプロパティが保持される', async () => {
      const { ApplicationError } = require('../../../src/lib/core/error-framework');
      
      // ApplicationErrorを発生させる
      mockManager[methodName].mockImplementationOnce(() => {
        throw new ApplicationError('アプリケーションエラー', {
          code: 'ERR_TEST',
          context: { testId: 'T001' },
          recoverable: false
        });
      });
      
      // メソッドを呼び出す
      const result = await adapter[methodName](...args);
      
      // エラー結果を確認
      expect(result).toMatchObject({
        error: true,
        message: 'アプリケーションエラー',
        code: 'ERR_TEST',
        operation: methodName,
        recoverable: false
      });
      
      // エラーイベントのデータを確認
      const errorData = errorListener.mock.calls[0][0];
      expect(errorData.code).toBe('ERR_TEST');
      expect(errorData.recoverable).toBe(false);
    });
    
    test('エラーイベントにスタックトレースが含まれる（開発環境のみ）', async () => {
      // 元の環境変数を保存
      const originalNodeEnv = process.env.NODE_ENV;
      
      try {
        // 開発環境に設定
        process.env.NODE_ENV = 'development';
        
        // エラーを発生させる
        mockManager[methodName].mockImplementationOnce(() => {
          throw new Error('スタックトレーステスト');
        });
        
        // メソッドを呼び出す
        await adapter[methodName](...args);
        
        // エラーイベントのデータを確認
        const errorData = errorListener.mock.calls[0][0];
        expect(errorData.stack).toBeDefined();
      } finally {
        // 環境変数を元に戻す
        process.env.NODE_ENV = originalNodeEnv;
      }
    });
    
    test('エラーイベントにスタックトレースが含まれない（本番環境）', async () => {
      // 元の環境変数を保存
      const originalNodeEnv = process.env.NODE_ENV;
      
      try {
        // 本番環境に設定
        process.env.NODE_ENV = 'production';
        
        // エラーを発生させる
        mockManager[methodName].mockImplementationOnce(() => {
          throw new Error('スタックトレーステスト');
        });
        
        // メソッドを呼び出す
        await adapter[methodName](...args);
        
        // エラーイベントのデータを確認
        const errorData = errorListener.mock.calls[0][0];
        expect(errorData.stack).toBeUndefined();
      } finally {
        // 環境変数を元に戻す
        process.env.NODE_ENV = originalNodeEnv;
      }
    });
  });
}

module.exports = {
  runErrorEventTest
};