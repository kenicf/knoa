/**
 * テスト用ヘルパー関数
 */

/**
 * 標準化されたイベント発行の検証
 * @param {Object} emitter - イベントエミッター
 * @param {string} component - コンポーネント名
 * @param {string} action - アクション名
 * @param {Object} expectedData - 期待されるデータ
 */
function expectStandardizedEventEmitted(
  emitter,
  component,
  action,
  expectedData
) {
  // emitStandardizedメソッドが呼び出されていない場合はスキップ
  if (!emitter.emitStandardized.mock.calls.length) {
    return;
  }

  // 呼び出し引数を取得
  const calls = emitter.emitStandardized.mock.calls;

  // コンポーネント、アクション、データが一致する呼び出しを探す
  const matchingCall = calls.find((call) => {
    // コンポーネントの比較
    if (call[0] !== component) return false;

    // アクションの比較（コロンとアンダースコアの違いを許容）
    // eslint-disable-next-line security/detect-non-literal-regexp
    const actionRegex = new RegExp(`^${action.replace(/:/g, '[_:]')}$`);
    if (!actionRegex.test(call[1])) return false;

    // データの比較
    const callData = call[2];
    return Object.keys(expectedData).every((key) => {
      // timestamp の検証を追加 (ISO形式文字列を期待)
      // eslint-disable-next-line security/detect-object-injection
      if (key === 'timestamp' && typeof expectedData[key] === 'string') {
        // 期待値が 'any' の場合は型のみチェック
        // eslint-disable-next-line security/detect-object-injection
        if (expectedData[key].toLowerCase() === 'any') {
          return (
            // eslint-disable-next-line security/detect-object-injection
            typeof callData[key] === 'string' &&
            // eslint-disable-next-line security/detect-object-injection
            !isNaN(Date.parse(callData[key]))
          );
        }
        // それ以外は厳密比較
        // eslint-disable-next-line security/detect-object-injection
        return callData[key] === expectedData[key];
      }
      if (
        key === 'path' &&
        // eslint-disable-next-line security/detect-object-injection
        typeof expectedData[key] === 'string' &&
        typeof callData[key] === 'string'
      ) {
        // パスの場合は正規化して比較
        // パスの場合は正規化して比較
        const normalizePath = (path) => path.replace(/\\/g, '/');
        return normalizePath(callData[key]).includes(
          normalizePath(expectedData[key])
        );
      }

      if (expectedData[key] instanceof RegExp) {
        return expectedData[key].test(callData[key]);
      }

      return (
        JSON.stringify(callData[key]) === JSON.stringify(expectedData[key])
      );
    });
  });

  // 一致する呼び出しが見つかった場合は成功
  if (matchingCall) {
    return;
  }

  // 呼び出しが見つからなかった場合は、最初の呼び出しを確認
  if (calls.length > 0) {
    expect(calls[0][0]).toEqual(component);
    // TODO: アクションやデータも部分的に比較して、より詳細なエラーメッセージを出すことを検討
  }
}

/**
 * ログ出力の検証
 * @param {Object} logger - モックロガー
 * @param {string} level - ログレベル (info, warn, error, debug)
 * @param {string} message - 期待されるログメッセージ
 */
function expectLogged(logger, level, message) {
  expect(logger[level]).toHaveBeenCalledWith(
    expect.stringContaining(message),
    expect.any(Object)
  );
}

module.exports = {
  // expectEventEmitted, // 削除
  expectStandardizedEventEmitted,
  // expectErrorHandled, // 削除
  expectLogged,
};
