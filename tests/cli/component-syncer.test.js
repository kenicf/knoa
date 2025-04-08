/**
 * @fileoverview CliComponentSyncer クラスのテスト
 */
const CliComponentSyncer = require('../../src/cli/component-syncer');
const { ApplicationError, CliError } = require('../../src/lib/utils/errors');
const { createMockDependencies } = require('../helpers/mock-factory'); // createMockDependencies をインポート
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

  let mockDependencies; // モック依存関係を保持する変数

  beforeEach(() => {
    // Arrange (Common setup)
    mockDependencies = createMockDependencies(); // 共通モックを生成
    mockLogger = mockDependencies.logger; // 個別変数にも代入
    mockEventEmitter = mockDependencies.eventEmitter; // 個別変数にも代入
    mockIntegrationManagerAdapter = mockDependencies.integrationManagerAdapter; // 共通モックから取得
    mockErrorHandler = mockDependencies.errorHandler; // 共通モックから取得

    // モックメソッドを再設定 (必要に応じて)
    mockIntegrationManagerAdapter.syncComponents = jest.fn();
    mockErrorHandler.handle = jest
      .fn()
      .mockImplementation((_err, _comp, op) => {
        // syncComponents が失敗した場合のデフォルト戻り値 (false) を模倣
        if (op === 'syncComponents') return false;
        return undefined; // 他の操作は undefined を返す
      });
    // テスト対象インスタンスを作成 (errorHandler はテストケースに応じて設定)
    cliComponentSyncer = new CliComponentSyncer({
      logger: mockLogger,
      eventEmitter: mockEventEmitter,
      integrationManagerAdapter: mockIntegrationManagerAdapter,
      traceIdGenerator: mockDependencies.traceIdGenerator, // 注入
      requestIdGenerator: mockDependencies.requestIdGenerator, // 注入
      // errorHandler はここでは設定しない
    });

    emitErrorEvent.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    test('should throw ApplicationError if required dependencies are missing', () => {
      // Assert
      expect(() => new CliComponentSyncer({})).toThrow(ApplicationError);
      expect(
        () =>
          new CliComponentSyncer({
            logger: mockLogger,
            eventEmitter: mockEventEmitter,
            // integrationManagerAdapter が欠けている
          })
      ).toThrow(ApplicationError);
    });

    test('should initialize correctly with required dependencies', () => {
      // Arrange & Act (instance created in beforeEach)
      // Assert
      expect(cliComponentSyncer.logger).toBe(mockLogger);
      expect(cliComponentSyncer.eventEmitter).toBe(mockEventEmitter);
      expect(cliComponentSyncer.integrationManager).toBe(
        mockIntegrationManagerAdapter
      );
      expect(cliComponentSyncer.errorHandler).toBeUndefined();
      // toBeInstanceOf(Function) の代わりに typeof でチェック
      expect(typeof cliComponentSyncer._traceIdGenerator).toBe('function');
      expect(typeof cliComponentSyncer._requestIdGenerator).toBe('function');
    });

    test('should initialize correctly with errorHandler', () => {
      // Arrange
      const instanceWithHandler = new CliComponentSyncer({
        logger: mockLogger,
        eventEmitter: mockEventEmitter,
        integrationManagerAdapter: mockIntegrationManagerAdapter,
        errorHandler: mockErrorHandler, // errorHandler を渡す
        traceIdGenerator: mockDependencies.traceIdGenerator, // 注入
        requestIdGenerator: mockDependencies.requestIdGenerator, // 注入
      });
      // Assert
      expect(instanceWithHandler.errorHandler).toBe(mockErrorHandler);
    });
  });

  describe('syncComponents', () => {
    const operation = 'syncComponents';

    test('should call integrationManager.syncComponents and return true on success', async () => {
      // Arrange
      mockIntegrationManagerAdapter.syncComponents.mockResolvedValue(true);

      // Act
      const result = await cliComponentSyncer.syncComponents();

      // Assert
      expect(
        mockIntegrationManagerAdapter.syncComponents
      ).toHaveBeenCalledTimes(1);
      expect(result).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Syncing components...',
        expect.objectContaining({
          operation,
          traceId: expect.any(String),
          requestId: expect.any(String),
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Components synced successfully.',
        expect.objectContaining({
          traceId: expect.any(String),
          requestId: expect.any(String),
        })
      );
    });

    test('should emit _before and _after events on success', async () => {
      // Arrange
      mockIntegrationManagerAdapter.syncComponents.mockResolvedValue(true);

      // Act
      await cliComponentSyncer.syncComponents();

      // Assert
      // イベント名とデータ構造をリファクタリング後の実装に合わせる
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'sync_before',
        {} // データなし
      );
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'sync_after',
        { success: true }
      );
    });

    test('should throw ApplicationError with code ERR_SYNC_FAILED if adapter returns false', async () => {
      // Arrange
      mockIntegrationManagerAdapter.syncComponents.mockResolvedValue(false);

      // Act & Assert
      await expect(cliComponentSyncer.syncComponents()).rejects.toThrow(
        ApplicationError
      );
      await expect(cliComponentSyncer.syncComponents()).rejects.toHaveProperty(
        'code',
        'ERR_SYNC_FAILED'
      );

      // _handleError 内で emitErrorEvent が呼ばれることを確認
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliComponentSyncer',
        operation,
        expect.objectContaining({
          // ApplicationError を期待
          name: 'ApplicationError',
          code: 'ERR_SYNC_FAILED',
        }),
        null,
        expect.objectContaining({
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        'Components synced successfully.'
      ); // 成功ログは出ない
    });

    test('should throw ApplicationError with code ERR_SYNC_UNEXPECTED if adapter returns non-boolean', async () => {
      // Arrange
      const unexpectedResult = { message: 'unexpected' };
      mockIntegrationManagerAdapter.syncComponents.mockResolvedValue(
        unexpectedResult
      );

      // Act & Assert
      await expect(cliComponentSyncer.syncComponents()).rejects.toThrow(
        ApplicationError
      );
      await expect(cliComponentSyncer.syncComponents()).rejects.toHaveProperty(
        'code',
        'ERR_SYNC_UNEXPECTED'
      );

      // _handleError 内で emitErrorEvent が呼ばれることを確認
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliComponentSyncer',
        operation,
        expect.objectContaining({
          // ApplicationError を期待
          name: 'ApplicationError',
          code: 'ERR_SYNC_UNEXPECTED',
          context: { result: unexpectedResult },
        }),
        null,
        expect.objectContaining({
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    });

    test('should throw CliError and emit error event if adapter throws error', async () => {
      // Arrange
      const originalError = new Error('Sync API error');
      mockIntegrationManagerAdapter.syncComponents.mockRejectedValue(
        originalError
      );

      // Act & Assert
      await expect(cliComponentSyncer.syncComponents()).rejects.toThrow(
        CliError
      );
      await expect(cliComponentSyncer.syncComponents()).rejects.toHaveProperty(
        'code',
        'ERR_CLI_COMPONENTSYNCER_SYNCCOMPONENTS' // 修正: クラス名を含むエラーコード
      ); // _handleError で生成されるコード
      await expect(cliComponentSyncer.syncComponents()).rejects.toHaveProperty(
        'cause',
        originalError
      );

      // _handleError 内で emitErrorEvent が呼ばれることを確認
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliComponentSyncer',
        operation,
        expect.objectContaining({
          // CliError でラップされていることを確認
          name: 'CliError',
          code: 'ERR_CLI_COMPONENTSYNCER_SYNCCOMPONENTS', // 修正後のコード
          cause: originalError,
        }),
        null,
        expect.objectContaining({
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    });

    test('should call errorHandler.handle and return its result if provided on adapter failure', async () => {
      // Arrange
      // errorHandler を設定してインスタンス再作成
      cliComponentSyncer = new CliComponentSyncer({
        logger: mockLogger,
        eventEmitter: mockEventEmitter,
        integrationManagerAdapter: mockIntegrationManagerAdapter,
        errorHandler: mockErrorHandler, // errorHandler を設定
        traceIdGenerator: mockDependencies.traceIdGenerator, // 注入
        requestIdGenerator: mockDependencies.requestIdGenerator, // 注入
      });
      const originalError = new Error('Sync API error'); // originalError を定義
      mockIntegrationManagerAdapter.syncComponents.mockRejectedValue(
        originalError
      );
      const errorHandlerResult = 'handled error value'; // エラーハンドラーが値を返す場合
      mockErrorHandler.handle.mockReturnValue(errorHandlerResult);

      // Act
      const result = await cliComponentSyncer.syncComponents();

      // Assert
      expect(mockErrorHandler.handle).toHaveBeenCalledTimes(1);
      // _handleError から渡される引数を検証
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.objectContaining({
          // CliError でラップされていることを確認
          name: 'CliError',
          code: 'ERR_CLI_COMPONENTSYNCER_SYNCCOMPONENTS', // 修正: クラス名を含むエラーコード
          cause: originalError,
        }),
        'CliComponentSyncer',
        operation,
        expect.objectContaining({
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
      expect(result).toBe(errorHandlerResult); // エラーハンドラの戻り値が返る
      expect(emitErrorEvent).toHaveBeenCalledTimes(1); // エラーイベントは発行される
    });

    test('should return false if errorHandler handles the error but returns undefined', async () => {
      // Arrange
      cliComponentSyncer = new CliComponentSyncer({
        logger: mockLogger,
        eventEmitter: mockEventEmitter,
        integrationManagerAdapter: mockIntegrationManagerAdapter,
        errorHandler: mockErrorHandler,
        traceIdGenerator: mockDependencies.traceIdGenerator, // 注入
        requestIdGenerator: mockDependencies.requestIdGenerator, // 注入
      });
      const originalError = new Error('Sync API error');
      mockIntegrationManagerAdapter.syncComponents.mockRejectedValue(
        originalError
      );
      mockErrorHandler.handle.mockReturnValue(undefined); // エラーハンドラーが undefined を返す

      // Act
      const result = await cliComponentSyncer.syncComponents();

      // Assert
      expect(mockErrorHandler.handle).toHaveBeenCalledTimes(1);
      expect(result).toBe(false); // undefined の場合は false になる
      expect(emitErrorEvent).toHaveBeenCalledTimes(1); // エラーイベントは発行される
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliComponentSyncer',
        operation,
        expect.objectContaining({
          // CliError を期待
          name: 'CliError',
          code: 'ERR_CLI_COMPONENTSYNCER_SYNCCOMPONENTS', // 修正後のコード
          cause: originalError,
        }),
        null,
        expect.objectContaining({
          traceId: expect.any(String),
          requestId: expect.any(String),
        })
      );
    });
  });
});
