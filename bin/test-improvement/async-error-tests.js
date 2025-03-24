/**
 * 非同期エラーテスト関数
 */

/**
 * 非同期エラー処理テストを実行
 * @param {Object} adapter - テスト対象のアダプター
 * @param {Object} mockManager - モックマネージャー
 * @param {string} methodName - テスト対象のメソッド名
 * @param {Array} args - メソッドの引数
 * @param {Object} mockLogger - モックロガー
 */
function runAsyncErrorTest(adapter, mockManager, methodName, args = [], mockLogger) {
  test(`${methodName}: 非同期操作中のエラーを適切に処理する`, async () => {
    // ロガーをリセット
    if (mockLogger) {
      mockLogger.error.mockClear();
    }
    
    // 非同期でエラーを発生させるモック
    mockManager[methodName].mockImplementationOnce(() => {
      return new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('非同期エラー'));
        }, 100);
      });
    });
    
    const result = await adapter[methodName](...args);
    
    expect(result).toMatchObject({
      error: true,
      message: '非同期エラー',
      operation: methodName
    });
    
    // エラーログが出力されたことを確認
    if (mockLogger) {
      expect(mockLogger.error).toHaveBeenCalled();
    }
  });
}

/**
 * 操作キャンセルテストを実行
 * @param {Object} adapter - テスト対象のアダプター
 * @param {Object} mockManager - モックマネージャー
 * @param {string} methodName - テスト対象のメソッド名
 * @param {Array} args - メソッドの引数
 * @param {Object} mockLogger - モックロガー
 */
function runCancellationTest(adapter, mockManager, methodName, args = [], mockLogger) {
  test(`${methodName}: 操作のキャンセルを処理できる`, async () => {
    // ロガーをリセット
    if (mockLogger) {
      mockLogger.error.mockClear();
    }
    
    const abortController = new AbortController();
    const signal = abortController.signal;
    
    // キャンセル可能な非同期操作をモック
    mockManager[methodName].mockImplementationOnce(() => {
      return new Promise((_, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('タイムアウト'));
        }, 1000);
        
        signal.addEventListener('abort', () => {
          clearTimeout(timeout);
          reject(new Error('操作がキャンセルされました'));
        });
      });
    });
    
    // 操作を開始し、すぐにキャンセル
    const resultPromise = adapter[methodName](...args, { signal });
    abortController.abort();
    
    const result = await resultPromise;
    
    expect(result).toMatchObject({
      error: true,
      message: '操作がキャンセルされました',
      operation: methodName
    });
    
    // エラーログが出力されたことを確認
    if (mockLogger) {
      expect(mockLogger.error).toHaveBeenCalled();
    }
  });
}

/**
 * イベントリスナーエラーテストを実行
 * @param {Object} adapter - テスト対象のアダプター
 * @param {Object} mockEventEmitter - モックイベントエミッター
 * @param {string} methodName - テスト対象のメソッド名
 * @param {Array} args - メソッドの引数
 * @param {string} eventName - 発行されるイベント名
 * @param {Object} mockLogger - モックロガー
 */
function runEventListenerErrorTest(adapter, mockEventEmitter, methodName, args = [], eventName, mockLogger) {
  test(`${methodName}: イベントリスナーでのエラーが他の処理に影響しない`, async () => {
    // ロガーをリセット
    if (mockLogger) {
      mockLogger.error.mockClear();
    }
    
    // エラーを投げるイベントリスナーを追加
    mockEventEmitter.on(eventName, () => {
      throw new Error('リスナーエラー');
    });
    
    // 通常の操作を実行
    const result = await adapter[methodName](...args);
    
    // 操作自体は成功することを確認
    expect(result).not.toHaveProperty('error');
    
    // エラーがログに記録されることを確認
    if (mockLogger) {
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('リスナーエラー'),
        expect.anything()
      );
    }
  });
}

/**
 * タイムアウトテストを実行
 * @param {Object} adapter - テスト対象のアダプター
 * @param {Object} mockManager - モックマネージャー
 * @param {string} methodName - テスト対象のメソッド名
 * @param {Array} args - メソッドの引数
 * @param {number} timeout - タイムアウト時間（ミリ秒）
 * @param {Object} mockLogger - モックロガー
 */
function runTimeoutTest(adapter, mockManager, methodName, args = [], timeout = 5000, mockLogger) {
  // Jest自体のタイムアウトを設定
  jest.setTimeout(timeout + 1000);
  
  test(`${methodName}: タイムアウトを処理できる`, async () => {
    // ロガーをリセット
    if (mockLogger) {
      mockLogger.error.mockClear();
    }
    
    // タイムアウトする非同期操作をモック
    mockManager[methodName].mockImplementationOnce(() => {
      return new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('タイムアウト'));
        }, timeout);
      });
    });
    
    // タイムアウトオプションを設定
    const options = { timeout: timeout / 2 };
    const testArgs = [...args, options];
    
    // アダプターのメソッドを呼び出す
    const result = await adapter[methodName](...testArgs);
    
    // タイムアウトエラーが返されることを確認
    expect(result).toMatchObject({
      error: true,
      message: expect.stringContaining('タイムアウト'),
      operation: methodName
    });
    
    // エラーログが出力されたことを確認
    if (mockLogger) {
      expect(mockLogger.error).toHaveBeenCalled();
    }
  });
}

/**
 * 並行処理テストを実行
 * @param {Object} adapter - テスト対象のアダプター
 * @param {string} methodName - テスト対象のメソッド名
 * @param {Array} args - メソッドの引数
 * @param {number} concurrency - 並行数
 * @param {Object} mockLogger - モックロガー
 */
function runConcurrencyTest(adapter, methodName, args = [], concurrency = 5, mockLogger) {
  test(`${methodName}: ${concurrency}個の並行リクエストを処理できる`, async () => {
    // ロガーをリセット
    if (mockLogger) {
      mockLogger.error.mockClear();
    }
    
    // 並行リクエストを実行
    const promises = Array(concurrency).fill().map(() => adapter[methodName](...args));
    const results = await Promise.all(promises);
    
    // すべての結果が成功していることを確認
    results.forEach(result => {
      expect(result).not.toHaveProperty('error');
    });
    
    // エラーログが出力されていないことを確認
    if (mockLogger) {
      expect(mockLogger.error).not.toHaveBeenCalled();
    }
  });
}

/**
 * 非同期エラーテストをまとめて実行
 * @param {Object} adapter - テスト対象のアダプター
 * @param {Object} mockManager - モックマネージャー
 * @param {Object} mockEventEmitter - モックイベントエミッター
 * @param {string} methodName - テスト対象のメソッド名
 * @param {Array} args - メソッドの引数
 * @param {Object} options - オプション
 * @param {Object} mockLogger - モックロガー
 */
function runAsyncTests(adapter, mockManager, mockEventEmitter, methodName, args = [], options = {}, mockLogger) {
  describe(`${methodName}: 非同期テスト`, () => {
    // 非同期エラー処理テスト
    if (options.asyncError !== false) {
      runAsyncErrorTest(adapter, mockManager, methodName, args, mockLogger);
    }
    
    // キャンセルテスト
    if (options.cancellation !== false) {
      runCancellationTest(adapter, mockManager, methodName, args, mockLogger);
    }
    
    // イベントリスナーエラーテスト
    if (options.listenerError !== false && options.eventName) {
      runEventListenerErrorTest(adapter, mockEventEmitter, methodName, args, options.eventName, mockLogger);
    }
    
    // タイムアウトテスト
    if (options.timeout !== false) {
      runTimeoutTest(adapter, mockManager, methodName, args, options.timeoutValue || 1000, mockLogger);
    }
    
    // 並行処理テスト
    if (options.concurrency !== false) {
      runConcurrencyTest(adapter, methodName, args, options.concurrencyValue || 5, mockLogger);
    }
  });
}

module.exports = {
  runAsyncErrorTest,
  runCancellationTest,
  runEventListenerErrorTest,
  runTimeoutTest,
  runConcurrencyTest,
  runAsyncTests
};