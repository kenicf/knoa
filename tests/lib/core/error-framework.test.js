/**
 * エラー処理フレームワークのテスト
 */

const {
  ApplicationError,
  ValidationError,
  StateError,
  DataConsistencyError,
  StorageError,
  GitError,
  LockError,
  TimeoutError,
  ConfigurationError,
  DependencyError,
  ErrorHandler,
} = require('../../../src/lib/core/error-framework');

describe('エラー処理フレームワーク', () => {
  describe('ApplicationError', () => {
    test('基本的なエラー情報を保持する', () => {
      const error = new ApplicationError('テストエラー');

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ApplicationError');
      expect(error.message).toBe('テストエラー');
      expect(error.code).toBe('ERR_APPLICATION');
      expect(error.context).toEqual({});
      expect(error.cause).toBeUndefined();
      expect(error.recoverable).toBe(true);
      expect(error.timestamp).toBeDefined();
    });

    test('オプションを正しく処理する', () => {
      const cause = new Error('原因エラー');
      const context = { foo: 'bar' };
      const error = new ApplicationError('テストエラー', {
        code: 'TEST_CODE',
        context,
        cause,
        recoverable: false,
      });

      expect(error.code).toBe('TEST_CODE');
      expect(error.context).toBe(context);
      expect(error.cause).toBe(cause);
      expect(error.recoverable).toBe(false);
    });

    test('toJSON()メソッドが正しいJSON表現を返す', () => {
      const cause = new Error('原因エラー');
      const error = new ApplicationError('テストエラー', {
        code: 'TEST_CODE',
        context: { foo: 'bar' },
        cause,
        recoverable: false,
      });

      const json = error.toJSON();

      expect(json.name).toBe('ApplicationError');
      expect(json.message).toBe('テストエラー');
      expect(json.code).toBe('TEST_CODE');
      expect(json.context).toEqual({ foo: 'bar' });
      expect(json.cause).toBe(cause.message);
      expect(json.recoverable).toBe(false);
      expect(json.timestamp).toBeDefined();
    });

    test('toString()メソッドが正しい文字列表現を返す', () => {
      const error = new ApplicationError('テストエラー', {
        code: 'TEST_CODE',
      });

      expect(error.toString()).toBe(
        '[TEST_CODE] ApplicationError: テストエラー'
      );
    });
  });

  describe('派生エラークラス', () => {
    test('ValidationErrorが正しく初期化される', () => {
      const error = new ValidationError('検証エラー');

      expect(error).toBeInstanceOf(ApplicationError);
      expect(error.name).toBe('ValidationError');
      expect(error.code).toBe('ERR_VALIDATION');
      expect(error.recoverable).toBe(true);
    });

    test('StateErrorが正しく初期化される', () => {
      const error = new StateError('状態エラー');

      expect(error).toBeInstanceOf(ApplicationError);
      expect(error.name).toBe('StateError');
      expect(error.code).toBe('ERR_STATE');
      expect(error.recoverable).toBe(false);
    });

    test('DataConsistencyErrorが正しく初期化される', () => {
      const error = new DataConsistencyError('データ整合性エラー');

      expect(error).toBeInstanceOf(ApplicationError);
      expect(error.name).toBe('DataConsistencyError');
      expect(error.code).toBe('ERR_DATA_CONSISTENCY');
      expect(error.recoverable).toBe(false);
    });

    test('StorageErrorが正しく初期化される', () => {
      const error = new StorageError('ストレージエラー');

      expect(error).toBeInstanceOf(ApplicationError);
      expect(error.name).toBe('StorageError');
      expect(error.code).toBe('ERR_STORAGE');
      expect(error.recoverable).toBe(true);
    });

    test('GitErrorが正しく初期化される', () => {
      const error = new GitError('Gitエラー');

      expect(error).toBeInstanceOf(ApplicationError);
      expect(error.name).toBe('GitError');
      expect(error.code).toBe('ERR_GIT');
      expect(error.recoverable).toBe(true);
    });

    test('LockErrorが正しく初期化される', () => {
      const error = new LockError('ロックエラー');

      expect(error).toBeInstanceOf(ApplicationError);
      expect(error.name).toBe('LockError');
      expect(error.code).toBe('ERR_LOCK');
      expect(error.recoverable).toBe(true);
    });

    test('TimeoutErrorが正しく初期化される', () => {
      const error = new TimeoutError('タイムアウトエラー');

      expect(error).toBeInstanceOf(ApplicationError);
      expect(error.name).toBe('TimeoutError');
      expect(error.code).toBe('ERR_TIMEOUT');
      expect(error.recoverable).toBe(true);
    });

    test('ConfigurationErrorが正しく初期化される', () => {
      const error = new ConfigurationError('設定エラー');

      expect(error).toBeInstanceOf(ApplicationError);
      expect(error.name).toBe('ConfigurationError');
      expect(error.code).toBe('ERR_CONFIGURATION');
      expect(error.recoverable).toBe(false);
    });

    test('DependencyErrorが正しく初期化される', () => {
      const error = new DependencyError('依存関係エラー');

      expect(error).toBeInstanceOf(ApplicationError);
      expect(error.name).toBe('DependencyError');
      expect(error.code).toBe('ERR_DEPENDENCY');
      expect(error.recoverable).toBe(false);
    });

    test('派生クラスでオプションが正しく処理される', () => {
      const cause = new Error('原因エラー');
      const context = { foo: 'bar' };
      const error = new ValidationError('検証エラー', {
        code: 'CUSTOM_VALIDATION',
        context,
        cause,
        recoverable: false,
      });

      expect(error.code).toBe('CUSTOM_VALIDATION');
      expect(error.context).toBe(context);
      expect(error.cause).toBe(cause);
      expect(error.recoverable).toBe(false);
    });
  });

  describe('ErrorHandler', () => {
    let mockLogger;
    let mockEventEmitter;
    let errorHandler;

    beforeEach(() => {
      mockLogger = {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
      };

      mockEventEmitter = {
        emit: jest.fn(),
      };

      errorHandler = new ErrorHandler(mockLogger, mockEventEmitter);
    });

    test('通常のエラーをApplicationErrorにラップする', async () => {
      const originalError = new Error('通常のエラー');
      const result = await errorHandler.handle(
        originalError,
        'TestComponent',
        'testOperation'
      );

      expect(result).toBeInstanceOf(ApplicationError);
      expect(result.message).toBe(originalError.message);
      expect(result.cause).toBe(originalError);
      expect(result.context).toEqual({
        component: 'TestComponent',
        operation: 'testOperation',
      });
    });

    test('ApplicationErrorはそのまま処理される', async () => {
      const originalError = new ValidationError('検証エラー');
      const result = await errorHandler.handle(
        originalError,
        'TestComponent',
        'testOperation'
      );

      expect(result).toBe(originalError);
    });

    test('エラーがログに記録される', async () => {
      const error = new ValidationError('検証エラー');
      await errorHandler.handle(error, 'TestComponent', 'testOperation');

      expect(mockLogger.error).toHaveBeenCalled();
      const logArgs = mockLogger.error.mock.calls[0];
      expect(logArgs[0]).toContain('[TestComponent] testOperation failed:');
      expect(logArgs[1].error_name).toBe('ValidationError');
      expect(logArgs[1].error_message).toBe('検証エラー');
    });

    test('エラーイベントが発行される', async () => {
      const error = new ValidationError('検証エラー');
      await errorHandler.handle(error, 'TestComponent', 'testOperation');

      expect(mockEventEmitter.emit).toHaveBeenCalled();
      const callArgs = mockEventEmitter.emit.mock.calls[0];
      expect(callArgs[0]).toBe('error');
      expect(callArgs[1].error).toBe(error);
      expect(callArgs[1].component).toBe('TestComponent');
      expect(callArgs[1].operation).toBe('testOperation');
      expect(callArgs[1].timestamp).toBeDefined();
    });

    test('回復戦略が登録され実行される', async () => {
      const error = new ValidationError('検証エラー', {
        code: 'TEST_RECOVERY',
      });
      const mockRecovery = jest.fn().mockReturnValue('recovered');

      errorHandler.registerRecoveryStrategy('TEST_RECOVERY', mockRecovery);
      const result = await errorHandler.handle(
        error,
        'TestComponent',
        'testOperation'
      );

      expect(mockRecovery).toHaveBeenCalledWith(
        error,
        'TestComponent',
        'testOperation'
      );
      expect(result).toBe('recovered');
    });

    test('回復戦略が失敗した場合、エラーがスローされる', async () => {
      const error = new ValidationError('検証エラー', {
        code: 'TEST_RECOVERY_FAIL',
      });
      const recoveryError = new Error('回復失敗');
      const mockRecovery = jest.fn().mockImplementation(() => {
        throw recoveryError;
      });

      errorHandler.registerRecoveryStrategy('TEST_RECOVERY_FAIL', mockRecovery);

      // errorHandler.handle が '回復失敗' エラーで reject されることを期待
      await expect(
        errorHandler.handle(error, 'TestComponent', 'testOperation')
      ).rejects.toThrow('回復失敗');

      // 回復戦略とエラーログが呼び出されたことを確認
      expect(mockRecovery).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Recovery strategy failed'),
        expect.objectContaining({
          original_error_code: 'TEST_RECOVERY_FAIL',
          recovery_error_message: '回復失敗',
        })
      );
    });

    test('回復不可能なエラーは回復戦略が実行されない', async () => {
      const error = new StateError('状態エラー', { code: 'NO_RECOVERY' });
      const mockRecovery = jest.fn();

      errorHandler.registerRecoveryStrategy('NO_RECOVERY', mockRecovery);
      const result = await errorHandler.handle(
        error,
        'TestComponent',
        'testOperation'
      );

      expect(mockRecovery).not.toHaveBeenCalled();
      expect(result).toBe(error);
    });

    test('回復戦略を削除できる', async () => {
      const error = new ValidationError('検証エラー', {
        code: 'REMOVE_RECOVERY',
      });
      const mockRecovery = jest.fn();

      errorHandler.registerRecoveryStrategy('REMOVE_RECOVERY', mockRecovery);
      errorHandler.removeRecoveryStrategy('REMOVE_RECOVERY');
      const result = await errorHandler.handle(
        error,
        'TestComponent',
        'testOperation'
      );

      expect(mockRecovery).not.toHaveBeenCalled();
      expect(result).toBe(error);
    });
  });
});
