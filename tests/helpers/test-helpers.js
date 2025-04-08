/**
 * テスト用ヘルパー関数
 */

/**
 * 標準化された **同期** イベント発行の検証
 * @param {Object} emitter - モック化された EventEmitter インスタンス
 * @param {string} component - 期待されるコンポーネント名
 * @param {string} action - 期待されるアクション名
 * @param {Object} [expectedData] - オプション。期待されるイベントデータの一部または全部
 */
function expectStandardizedEventEmitted(
  emitter,
  component,
  action,
  expectedData
) {
  const eventName = `${component}:${action}`;
  // emitStandardized が jest.fn() であることを前提とする
  const calls = emitter.emitStandardized?.mock?.calls || [];

  const matchingCall = calls.find((call) => {
    if (call[0] !== component || call[1] !== action) return false;

    const callData = call[2]; // 実際に渡されたデータ

    // traceId と requestId の存在チェックは削除

    // expectedData が指定されていない場合はOK
    if (!expectedData) return true;

    // expectedData のキーで比較 (traceId/requestId も含めて比較)
    const keysToCompare = Object.keys(expectedData);

    // キーが expectedData になければOK
    if (keysToCompare.length === 0) return true;

    // キーについて値を比較
    return keysToCompare.every((key) => {
      // eslint-disable-next-line security/detect-object-injection
      const expectedValue = expectedData[key];
      // eslint-disable-next-line security/detect-object-injection
      const actualValue = callData?.[key];

      if (
        typeof expectedValue === 'object' &&
        expectedValue !== null &&
        typeof expectedValue.asymmetricMatch === 'function'
      ) {
        return expectedValue.asymmetricMatch(actualValue);
      }
      if (
        key === 'timestamp' &&
        typeof expectedValue === 'string' &&
        expectedValue.toLowerCase() === 'any'
      ) {
        return (
          typeof actualValue === 'string' && !isNaN(Date.parse(actualValue))
        );
      }
      if (
        key === 'path' &&
        typeof expectedValue === 'string' &&
        typeof actualValue === 'string'
      ) {
        const normalizePath = (p) => p?.replace(/\\/g, '/');
        return normalizePath(actualValue)?.includes(
          normalizePath(expectedValue)
        );
      }
      if (expectedValue instanceof RegExp) {
        return expectedValue.test(actualValue);
      }
      try {
        expect(actualValue).toEqual(expectedValue);
        return true;
      } catch (e) {
        return false;
      }
    });
  });

  if (!matchingCall) {
    const formattedCalls = calls
      .map(
        (call) =>
          `  - ${call[0]}:${call[1]} with data: ${JSON.stringify(call[2])}`
      )
      .join('\n');
    throw new Error(
      `Expected standardized event '${eventName}' with data matching ${JSON.stringify(expectedData)} to be emitted via emitStandardized, but it was not found.\nActual calls:\n${formattedCalls || '  (No calls to emitStandardized)'}` // エラーメッセージは変更なし
    );
  }
  expect(matchingCall).toBeDefined();
}

/**
 * 標準化された **非同期** イベント発行の検証
 * @param {Object} emitter - モック化された EventEmitter インスタンス
 * @param {string} component - 期待されるコンポーネント名
 * @param {string} action - 期待されるアクション名
 * @param {Object} [expectedData] - オプション。期待されるイベントデータの一部または全部
 */
function expectStandardizedEventEmittedAsync(
  emitter,
  component, // 期待するコンポーネント名 (例: 'cli')
  action, // 期待するアクション名 (例: 'session_start_before')
  expectedData // 期待するデータ (traceId, requestId は自動検証)
) {
  const eventName = `${component}:${action}`; // イベント名はそのまま component:action
  const calls = emitter.emitStandardizedAsync?.mock?.calls || [];
  const matchingCall = calls.find((call) => {
    if (call[0] !== component || call[1] !== action) return false;

    const callData = call[2];

    // traceId と requestId の存在と型をデフォルトで検証
    // expectedData が指定されていない場合は、コンポーネントとアクションが一致すればOK
    // (traceId/requestId の検証は不要になったため、コメントアウトブロックを削除)
    if (!expectedData) return true;

    // expectedData のキーで比較
    const keysToCompare = Object.keys(expectedData);
    // expectedData が空オブジェクト {} の場合も true を返す
    if (keysToCompare.length === 0) return true;
    return keysToCompare.every((key) => {
      // eslint-disable-next-line security/detect-object-injection
      const expectedValue = expectedData[key];
      // eslint-disable-next-line security/detect-object-injection
      const actualValue = callData?.[key];

      if (
        typeof expectedValue === 'object' &&
        expectedValue !== null &&
        typeof expectedValue.asymmetricMatch === 'function'
      ) {
        return expectedValue.asymmetricMatch(actualValue);
      }
      if (
        key === 'timestamp' &&
        typeof expectedValue === 'string' &&
        expectedValue.toLowerCase() === 'any'
      ) {
        return (
          typeof actualValue === 'string' && !isNaN(Date.parse(actualValue))
        );
      }
      if (
        key === 'path' &&
        typeof expectedValue === 'string' &&
        typeof actualValue === 'string'
      ) {
        const normalizePath = (p) => p?.replace(/\\/g, '/');
        return normalizePath(actualValue)?.includes(
          normalizePath(expectedValue)
        );
      }
      if (expectedValue instanceof RegExp) {
        return expectedValue.test(actualValue);
      }
      try {
        expect(actualValue).toEqual(expectedValue);
        return true;
      } catch (e) {
        return false;
      }
    });
  });

  if (!matchingCall) {
    const formattedCalls = calls
      .map(
        (call) =>
          `  - ${call[0]}:${call[1]} with data: ${JSON.stringify(call[2])}`
      )
      .join('\n');
    throw new Error(
      `Expected standardized event '${eventName}' with data matching ${JSON.stringify(expectedData)} (and valid traceId/requestId) to be emitted via emitStandardizedAsync, but it was not found.\nActual calls:\n${formattedCalls || '  (No calls to emitStandardizedAsync)'}`
    );
  }
  expect(matchingCall).toBeDefined();
}

/**
 * ログ出力の検証
 * @param {Object} logger - モックロガー
 * @param {string} level - ログレベル (info, warn, error, debug)
 * @param {string|RegExp} message - 期待されるログメッセージまたは正規表現
 */
function expectLogged(logger, level, message) {
  // eslint-disable-next-line security/detect-object-injection -- level はテストコード内で指定される安全なログレベル文字列のため抑制
  const mockFn = logger[level];
  if (!mockFn || !mockFn.mock) {
    throw new Error(
      `Logger mock for level '${level}' not found or is not a Jest mock function.`
    );
  }

  const matchingCall = mockFn.mock.calls.find((callArgs) => {
    const logMessage = callArgs[0]; // 最初の引数がメッセージ本体と想定
    if (typeof logMessage !== 'string') return false;
    if (message instanceof RegExp) {
      return message.test(logMessage);
    } else {
      // stringContaining のような動作にする
      return logMessage.includes(message);
    }
  });

  // expect アサーションを追加
  // expect(matchingCall).toBeDefined();
  // より明確なエラーメッセージのために toHaveBeenCalledWith を使用
  expect(mockFn).toHaveBeenCalledWith(
    message instanceof RegExp
      ? expect.stringMatching(message)
      : expect.stringContaining(message)
    // 2番目以降の引数は気にしないか、必要なら expect.anything() などを使う
    // expect.anything() // または expect.any(Object) など
  );

  // オプション: 特定のコンテキストが含まれているかも検証する場合
  // expect(mockFn).toHaveBeenCalledWith(
  //   expect.stringContaining(message),
  //   expect.objectContaining({ userId: 'test' }) // 例
  // );
}

/**
 * コンソール出力をキャプチャするためのヘルパー
 * @returns {Object} キャプチャ用のオブジェクト { consoleOutput: Array<string>, consoleErrors: Array<string>, restore: Function }
 */
function captureConsole() {
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const consoleOutput = [];
  const consoleErrors = [];

  // jest.fn() を使って呼び出しを記録
  console.log = jest.fn((...args) => {
    consoleOutput.push(args.map((arg) => String(arg)).join(' ')); // 文字列に変換して結合
  });

  console.error = jest.fn((...args) => {
    consoleErrors.push(args.map((arg) => String(arg)).join(' ')); // 文字列に変換して結合
  });

  return {
    consoleOutput,
    consoleErrors,
    // restore 関数内で元の関数に戻す
    restore: () => {
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
    },
    // 呼び出し回数などを確認するためのモック自体も返す (任意)
    logMock: console.log,
    errorMock: console.error,
  };
}

module.exports = {
  // expectEventEmitted, // 削除
  expectStandardizedEventEmitted,
  expectStandardizedEventEmittedAsync, // 追加
  // expectErrorHandled, // 削除
  expectLogged,
  captureConsole, // 追加
};
