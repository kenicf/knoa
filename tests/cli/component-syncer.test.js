const CliComponentSyncer = require('../../src/cli/component-syncer');
const { ApplicationError, CliError } = require('../../src/lib/utils/errors'); // CliError をインポート
const {
  createMockLogger,
  createMockEventEmitter,
} = require('../helpers/mock-factory');
// expectStandardizedEventEmittedAsync をインポート
const {
  expectStandardizedEventEmittedAsync,
} = require('../helpers/test-helpers');
// emitErrorEvent もモック化
jest.mock('../../src/lib/utils/error-helpers', () => ({
  emitErrorEvent: jest.fn(),
}));
const { emitErrorEvent } = require('../../src/lib/utils/error-helpers');

describe('CliComponentSyncer', () => {
  let mockLogger;
  let mockEventEmitter;
  let mockIntegrationManagerAdapter;
  let mockErrorHandler;
  let cliComponentSyncer;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockEventEmitter = createMockEventEmitter();
    mockIntegrationManagerAdapter = {
      syncComponents: jest.fn(),
    };
    mockErrorHandler = {
      handle: jest.fn(),
    };

    // テスト対象インスタンスを作成
    cliComponentSyncer = new CliComponentSyncer({
      logger: mockLogger,
      eventEmitter: mockEventEmitter,
      integrationManagerAdapter: mockIntegrationManagerAdapter,
      // errorHandler: mockErrorHandler,
    });

    emitErrorEvent.mockClear();
  });

  describe('constructor', () => {
    test('should throw ApplicationError if required dependencies are missing', () => {
      expect(() => new CliComponentSyncer({})).toThrow(ApplicationError);
      expect(
        () =>
          new CliComponentSyncer({
            logger: mockLogger,
            eventEmitter: mockEventEmitter,
          })
      ).toThrow(ApplicationError); // integrationManagerAdapter が必須
    });
  });

  describe('syncComponents', () => {
    const operation = 'syncComponents';

    test('should call integrationManager.syncComponents and return true on success', async () => {
      mockIntegrationManagerAdapter.syncComponents.mockResolvedValue(true);

      const result = await cliComponentSyncer.syncComponents();

      expect(
        mockIntegrationManagerAdapter.syncComponents
      ).toHaveBeenCalledTimes(1);
      expect(result).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Syncing components'),
        expect.objectContaining({ operation })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Components synced successfully')
        // expect.any(Object) // 2番目の引数はない
      );
    });

    test('should emit _before and _after events on success', async () => {
      mockIntegrationManagerAdapter.syncComponents.mockResolvedValue(true);
      await cliComponentSyncer.syncComponents();
      // expectStandardizedEventEmittedAsync に変更
      expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli_sync',
        `${operation}_before`
      );
      expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli_sync',
        `${operation}_after`,
        { success: true }
      );
    });

    test('should throw SyncFailedError if adapter returns false', async () => {
      mockIntegrationManagerAdapter.syncComponents.mockResolvedValue(false); // 同期失敗

      await expect(cliComponentSyncer.syncComponents()).rejects.toThrow(
        ApplicationError
      );
      // エラーコード検証修正
      await expect(cliComponentSyncer.syncComponents()).rejects.toHaveProperty(
        'code',
        'ERR_SYNC_FAILED'
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Syncing components'),
        expect.objectContaining({ operation })
      ); // 開始ログは出る
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('Components synced successfully')
      ); // 成功ログは出ない
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliComponentSyncer',
        operation,
        expect.objectContaining({ code: 'ERR_SYNC_FAILED' }),
        null, // context
        {} // details
      );
    });

    test('should throw SyncUnexpectedError if adapter returns non-boolean', async () => {
      mockIntegrationManagerAdapter.syncComponents.mockResolvedValue({
        message: 'unexpected',
      }); // boolean 以外

      await expect(cliComponentSyncer.syncComponents()).rejects.toThrow(
        ApplicationError
      );
      // エラーコード検証修正
      await expect(cliComponentSyncer.syncComponents()).rejects.toHaveProperty(
        'code',
        'ERR_SYNC_UNEXPECTED'
      );
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliComponentSyncer',
        operation,
        expect.objectContaining({ code: 'ERR_SYNC_UNEXPECTED' }),
        null, // context
        {} // details
      );
    });

    test('should throw CliError and emit error event if adapter throws error', async () => {
      const originalError = new Error('Sync API error');
      mockIntegrationManagerAdapter.syncComponents.mockRejectedValue(
        originalError
      );

      let caughtError;
      try {
        await cliComponentSyncer.syncComponents();
      } catch (error) {
        caughtError = error;
      }

      // エラーがスローされたことを確認
      expect(caughtError).toBeDefined();
      // スローされたエラーが CliError であることを検証
      expect(caughtError).toBeInstanceOf(CliError);
      // エラーコードと原因を検証
      expect(caughtError).toHaveProperty('code', 'ERR_CLI_SYNC');
      expect(caughtError).toHaveProperty('cause', originalError);

      // emitErrorEvent が1回だけ呼び出されたことを確認
      expect(emitErrorEvent).toHaveBeenCalledTimes(1);
      // emitErrorEvent の引数を検証
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliComponentSyncer',
        operation,
        expect.objectContaining({
          // CliError インスタンスであることを期待
          name: 'CliError',
          code: 'ERR_CLI_SYNC',
          cause: originalError,
        }),
        null, // context のデフォルト値は null
        {} // details のデフォルト値は {}
      );
    });

    test('should call errorHandler.handle if provided on adapter failure', async () => {
      // errorHandler を設定してインスタンス再作成
      cliComponentSyncer = new CliComponentSyncer({
        logger: mockLogger,
        eventEmitter: mockEventEmitter,
        integrationManagerAdapter: mockIntegrationManagerAdapter,
        errorHandler: mockErrorHandler,
      });
      const originalError = new Error('Sync API error');
      mockIntegrationManagerAdapter.syncComponents.mockRejectedValue(
        originalError
      );
      const errorHandlerResult = false; // エラーハンドラーは false を返す想定
      mockErrorHandler.handle.mockReturnValue(errorHandlerResult);

      const result = await cliComponentSyncer.syncComponents();

      expect(mockErrorHandler.handle).toHaveBeenCalledTimes(1);
      // errorHandler.handle に CliError インスタンスが渡されることを検証
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.objectContaining({
          // CliError インスタンスであることを期待
          name: 'CliError',
          code: 'ERR_CLI_SYNC',
          cause: originalError,
        }),
        'CliComponentSyncer',
        operation,
        null // context は null が渡されるはず
      );
      expect(result).toBe(errorHandlerResult);
      expect(emitErrorEvent).toHaveBeenCalledTimes(1); // エラーイベントは発行される
    });
  });
});
