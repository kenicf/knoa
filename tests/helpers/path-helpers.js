/**
 * パス関連のテストヘルパー関数
 */

/**
 * OSに依存しないパス比較のためのパス正規化関数
 * @param {string} path パス文字列
 * @returns {string} 正規化されたパス
 */
function normalizePath(path) {
  return path.replace(/\\/g, '/');
}

/**
 * パス比較用のカスタムマッチャー
 */
function setupPathMatchers() {
  expect.extend({
    toMatchPath(received, expected) {
      const normalizedReceived = normalizePath(received);
      const normalizedExpected = normalizePath(expected);
      
      const pass = normalizedReceived === normalizedExpected;
      
      return {
        pass,
        message: () => 
          `Expected path ${this.utils.printReceived(received)} ${
            pass ? 'not to match' : 'to match'
          } ${this.utils.printExpected(expected)}\n` +
          `Normalized: ${this.utils.printReceived(normalizedReceived)} vs ${
            this.utils.printExpected(normalizedExpected)
          }`
      };
    }
  });
}

module.exports = {
  normalizePath,
  setupPathMatchers
};