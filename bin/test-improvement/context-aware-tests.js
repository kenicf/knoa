/**
 * コンテキスト対応テスト関数
 */

/**
 * コンテキスト対応テストを実行
 * @param {Object} adapter - テスト対象のアダプター
 * @param {Object} mockManager - モックマネージャー
 * @param {Object} mockEventEmitter - モックイベントエミッター
 * @param {string} methodName - テスト対象のメソッド名
 * @param {Array} args - メソッドの引数
 * @param {Object} mockLogger - モックロガー
 */
function runContextAwareTest(adapter, mockManager, mockEventEmitter, methodName, args = [], mockLogger) {
  describe(`${methodName}: コンテキスト対応テスト`, () => {
    beforeEach(() => {
      // ロガーをリセット
      if (mockLogger) {
        mockLogger.error.mockClear();
        mockLogger.debug.mockClear();
      }
    });
    
    test('操作コンテキストが正しく作成される', async () => {
      // createContextのスパイを作成
      const createContextSpy = jest.spyOn(mockEventEmitter, 'createContext');
      const mockContext = { id: 'ctx-123', setError: jest.fn() };
      createContextSpy.mockReturnValue(mockContext);
      
      // アダプターのメソッドを呼び出す
      await adapter[methodName](...args);
      
      // createContextが呼び出されたことを確認
      expect(createContextSpy).toHaveBeenCalled();
      expect(createContextSpy.mock.calls[0][0]).toMatchObject({
        component: expect.any(String),
        operation: methodName
      });
      
      // スパイをリストア
      createContextSpy.mockRestore();
    });
    
    test('エラー時にコンテキストにエラーが設定される', async () => {
      // createContextのスパイを作成
      const mockContext = { id: 'ctx-123', setError: jest.fn() };
      jest.spyOn(mockEventEmitter, 'createContext').mockReturnValue(mockContext);
      
      // エラーを発生させる
      mockManager[methodName].mockImplementationOnce(() => {
        throw new Error('コンテキストテストエラー');
      });
      
      // アダプターのメソッドを呼び出す
      await adapter[methodName](...args);
      
      // コンテキストにエラーが設定されたことを確認
      expect(mockContext.setError).toHaveBeenCalled();
      expect(mockContext.setError.mock.calls[0][0]).toBeInstanceOf(Error);
      expect(mockContext.setError.mock.calls[0][0].message).toBe('コンテキストテストエラー');
    });
    
    test('コンテキストIDがイベントデータに含まれる', async () => {
      // イベントリスナーを設定
      const eventListener = jest.fn();
      const eventName = `${adapter.constructor.name.replace('Adapter', '').toLowerCase()}:${methodName}_success`;
      mockEventEmitter.on(eventName, eventListener);
      
      // createContextのスパイを作成
      const mockContext = { id: 'ctx-123', setError: jest.fn() };
      jest.spyOn(mockEventEmitter, 'createContext').mockReturnValue(mockContext);
      
      // アダプターのメソッドを呼び出す
      await adapter[methodName](...args);
      
      // イベントリスナーが呼び出されたことを確認
      if (eventListener.mock.calls.length > 0) {
        // イベントデータにコンテキストIDが含まれていることを確認
        const eventData = eventListener.mock.calls[0][0];
        expect(eventData._context).toBe('ctx-123');
      }
    });
    
    test('コンテキストにメタデータが追加される', async () => {
      // createContextのスパイを作成
      const createContextSpy = jest.spyOn(mockEventEmitter, 'createContext');
      
      // メタデータを含む引数を作成
      const metadata = { userId: 'U001', sessionId: 'S001' };
      const argsWithMetadata = [...args];
      
      // 最初の引数がオブジェクトの場合はマージ、そうでなければ追加
      if (args.length > 0 && typeof args[0] === 'object' && args[0] !== null) {
        argsWithMetadata[0] = { ...args[0], ...metadata };
      } else {
        argsWithMetadata.push(metadata);
      }
      
      // アダプターのメソッドを呼び出す
      await adapter[methodName](...argsWithMetadata);
      
      // createContextが呼び出されたことを確認
      expect(createContextSpy).toHaveBeenCalled();
      
      // メタデータが含まれていることを確認
      const contextParams = createContextSpy.mock.calls[0][0];
      expect(contextParams).toMatchObject({
        component: expect.any(String),
        operation: methodName
      });
      
      // スパイをリストア
      createContextSpy.mockRestore();
    });
    
    test('親コンテキストが指定された場合に子コンテキストが作成される', async () => {
      // 親コンテキストを作成
      const parentContext = { id: 'parent-ctx-123' };
      
      // createContextのスパイを作成
      const createContextSpy = jest.spyOn(mockEventEmitter, 'createContext');
      
      // アダプターの_createContextメソッドを直接呼び出す
      adapter._createContext(methodName, {}, parentContext);
      
      // createContextが親コンテキストを指定して呼び出されたことを確認
      expect(createContextSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          component: expect.any(String),
          operation: methodName
        }),
        parentContext
      );
      
      // スパイをリストア
      createContextSpy.mockRestore();
    });
  });
}

/**
 * コンテキストエラー処理テストを実行
 * @param {Object} adapter - テスト対象のアダプター
 * @param {Object} mockManager - モックマネージャー
 * @param {Object} mockEventEmitter - モックイベントエミッター
 * @param {string} methodName - テスト対象のメソッド名
 * @param {Array} args - メソッドの引数
 * @param {Object} mockLogger - モックロガー
 */
function runContextErrorHandlingTest(adapter, mockManager, mockEventEmitter, methodName, args = [], mockLogger) {
  describe(`${methodName}: コンテキストエラー処理テスト`, () => {
    test('コンテキストエラー設定に失敗した場合も処理が継続される', async () => {
      // createContextのスパイを作成
      const mockContext = { 
        id: 'ctx-123', 
        setError: jest.fn().mockImplementation(() => {
          throw new Error('コンテキストエラー設定失敗');
        })
      };
      jest.spyOn(mockEventEmitter, 'createContext').mockReturnValue(mockContext);
      
      // エラーを発生させる
      mockManager[methodName].mockImplementationOnce(() => {
        throw new Error('テストエラー');
      });
      
      // アダプターのメソッドを呼び出す
      const result = await adapter[methodName](...args);
      
      // エラー結果が返されることを確認
      expect(result).toMatchObject({
        error: true,
        message: 'テストエラー',
        operation: methodName
      });
      
      // コンテキストエラー設定が呼び出されたことを確認
      expect(mockContext.setError).toHaveBeenCalled();
      
      // ロガーに警告が出力されたことを確認
      if (mockLogger) {
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('コンテキストのエラー設定に失敗'),
          expect.anything()
        );
      }
    });
  });
}

module.exports = {
  runContextAwareTest,
  runContextErrorHandlingTest
};