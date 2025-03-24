/**
 * 境界値テスト関数
 */

/**
 * 長い文字列の処理テストを実行
 * @param {Object} adapter - テスト対象のアダプター
 * @param {string} methodName - テスト対象のメソッド名
 * @param {Array} args - メソッドの引数
 * @param {number} argIndex - 長い文字列を設定する引数のインデックス
 * @param {number} length - 文字列の長さ
 * @param {Object} mockLogger - モックロガー
 */
function runLongStringTest(adapter, methodName, args = [], argIndex = 0, length = 1000, mockLogger) {
  test(`${methodName}: 長い文字列（${length}文字）を処理できる`, async () => {
    // ロガーをリセット
    if (mockLogger) {
      mockLogger.error.mockClear();
    }
    
    const longString = 'a'.repeat(length);
    const testArgs = [...args];
    testArgs[argIndex] = longString;
    
    const result = await adapter[methodName](...testArgs);
    expect(result).not.toHaveProperty('error');
    
    // エラーログが出力されていないことを確認
    if (mockLogger) {
      expect(mockLogger.error).not.toHaveBeenCalled();
    }
  });
}

/**
 * 特殊文字の処理テストを実行
 * @param {Object} adapter - テスト対象のアダプター
 * @param {string} methodName - テスト対象のメソッド名
 * @param {Array} args - メソッドの引数
 * @param {number} argIndex - 特殊文字列を設定する引数のインデックス
 * @param {Object} mockLogger - モックロガー
 */
function runSpecialCharactersTest(adapter, methodName, args = [], argIndex = 0, mockLogger) {
  test(`${methodName}: 特殊文字を含む文字列を処理できる`, async () => {
    // ロガーをリセット
    if (mockLogger) {
      mockLogger.error.mockClear();
    }
    
    const specialChars = '特殊文字!@#$%^&*()_+{}[]|\\:;"\'<>,.?/';
    const testArgs = [...args];
    testArgs[argIndex] = specialChars;
    
    const result = await adapter[methodName](...testArgs);
    expect(result).not.toHaveProperty('error');
    
    // エラーログが出力されていないことを確認
    if (mockLogger) {
      expect(mockLogger.error).not.toHaveBeenCalled();
    }
  });
}

/**
 * 循環参照の処理テストを実行
 * @param {Object} adapter - テスト対象のアダプター
 * @param {string} methodName - テスト対象のメソッド名
 * @param {Array} args - メソッドの引数
 * @param {number} argIndex - 循環参照オブジェクトを設定する引数のインデックス
 * @param {Object} mockLogger - モックロガー
 */
function runCircularReferenceTest(adapter, methodName, args = [], argIndex = 0, mockLogger) {
  test(`${methodName}: 循環参照を含むオブジェクトを処理できる`, async () => {
    // ロガーをリセット
    if (mockLogger) {
      mockLogger.error.mockClear();
    }
    
    const circularObj = {};
    circularObj.self = circularObj;
    
    const testArgs = [...args];
    testArgs[argIndex] = circularObj;
    
    const result = await adapter[methodName](...testArgs);
    expect(result).not.toHaveProperty('error');
    
    // エラーログが出力されていないことを確認
    if (mockLogger) {
      expect(mockLogger.error).not.toHaveBeenCalled();
    }
  });
}

/**
 * 大量データの処理テストを実行
 * @param {Object} adapter - テスト対象のアダプター
 * @param {string} methodName - テスト対象のメソッド名
 * @param {Array} args - メソッドの引数
 * @param {number} argIndex - 大量データを設定する引数のインデックス
 * @param {number} size - データサイズ
 * @param {Object} mockLogger - モックロガー
 */
function runLargeDataTest(adapter, methodName, args = [], argIndex = 0, size = 1000, mockLogger) {
  test(`${methodName}: 大量データ（${size}件）を処理できる`, async () => {
    // ロガーをリセット
    if (mockLogger) {
      mockLogger.error.mockClear();
    }
    
    // 大量データを生成
    const largeData = Array(size).fill().map((_, i) => ({
      id: `item-${i}`,
      name: `Item ${i}`,
      value: i,
      timestamp: new Date(Date.now() + i * 1000).toISOString()
    }));
    
    const testArgs = [...args];
    testArgs[argIndex] = largeData;
    
    const result = await adapter[methodName](...testArgs);
    expect(result).not.toHaveProperty('error');
    
    // エラーログが出力されていないことを確認
    if (mockLogger) {
      expect(mockLogger.error).not.toHaveBeenCalled();
    }
  });
}

/**
 * 空データの処理テストを実行
 * @param {Object} adapter - テスト対象のアダプター
 * @param {string} methodName - テスト対象のメソッド名
 * @param {Array} args - メソッドの引数
 * @param {number} argIndex - 空データを設定する引数のインデックス
 * @param {Object} mockLogger - モックロガー
 */
function runEmptyDataTest(adapter, methodName, args = [], argIndex = 0, mockLogger) {
  test(`${methodName}: 空データを処理できる`, async () => {
    // ロガーをリセット
    if (mockLogger) {
      mockLogger.error.mockClear();
    }
    
    // 空データを設定
    const testArgs = [...args];
    if (Array.isArray(args[argIndex])) {
      testArgs[argIndex] = [];
    } else if (typeof args[argIndex] === 'string') {
      testArgs[argIndex] = '';
    } else if (typeof args[argIndex] === 'object' && args[argIndex] !== null) {
      testArgs[argIndex] = {};
    }
    
    const result = await adapter[methodName](...testArgs);
    expect(result).not.toHaveProperty('error');
    
    // エラーログが出力されていないことを確認
    if (mockLogger) {
      expect(mockLogger.error).not.toHaveBeenCalled();
    }
  });
}

/**
 * 境界値テストをまとめて実行
 * @param {Object} adapter - テスト対象のアダプター
 * @param {string} methodName - テスト対象のメソッド名
 * @param {Array} args - メソッドの引数
 * @param {number} argIndex - テスト対象の引数のインデックス
 * @param {Object} options - オプション
 * @param {Object} mockLogger - モックロガー
 */
function runBoundaryValueTests(adapter, methodName, args = [], argIndex = 0, options = {}, mockLogger) {
  describe(`${methodName}: 境界値テスト`, () => {
    // 長い文字列のテスト
    if (options.longString !== false) {
      runLongStringTest(adapter, methodName, args, argIndex, options.stringLength || 1000, mockLogger);
    }
    
    // 特殊文字のテスト
    if (options.specialChars !== false) {
      runSpecialCharactersTest(adapter, methodName, args, argIndex, mockLogger);
    }
    
    // 循環参照のテスト
    if (options.circularRef !== false) {
      runCircularReferenceTest(adapter, methodName, args, argIndex, mockLogger);
    }
    
    // 大量データのテスト
    if (options.largeData !== false) {
      runLargeDataTest(adapter, methodName, args, argIndex, options.dataSize || 1000, mockLogger);
    }
    
    // 空データのテスト
    if (options.emptyData !== false) {
      runEmptyDataTest(adapter, methodName, args, argIndex, mockLogger);
    }
  });
}

module.exports = {
  runLongStringTest,
  runSpecialCharactersTest,
  runCircularReferenceTest,
  runLargeDataTest,
  runEmptyDataTest,
  runBoundaryValueTests
};