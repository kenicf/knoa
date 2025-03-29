/**
 * ロック管理クラスのテスト
 */

const LockManager = require('../../../src/lib/utils/lock-manager');
const { TimeoutError } = require('../../../src/lib/core/error-framework');
const {
  mockTimestamp,
  createMockLogger,
} = require('../../helpers/mock-factory');

// TimeoutError をモック化
jest.mock('../../../src/lib/core/error-framework', () => {
  const originalModule = jest.requireActual(
    '../../../src/lib/core/error-framework'
  );
  return {
    ...originalModule,
    TimeoutError: class MockTimeoutError extends originalModule.TimeoutError {
      constructor(message, options) {
        super(message, options);
        this.name = 'TimeoutError';
        this._mockOptions = options; // テストで検証可能にする
      }
    },
  };
});

describe('LockManager', () => {
  let lockManager;
  let mockLogger;
  const MOCK_TIMESTAMP_ISO = '2025-03-24T00:00:00.000Z';
  const MOCK_TIMESTAMP_MS = new Date(MOCK_TIMESTAMP_ISO).getTime();

  beforeEach(() => {
    // モックのセットアップ
    jest.clearAllMocks();
    mockLogger = createMockLogger();

    // LockManagerのインスタンスを作成
    lockManager = new LockManager({ logger: mockLogger });

    // タイマーと時間のモック
    jest.useFakeTimers();
    mockTimestamp(MOCK_TIMESTAMP_ISO);
    jest.spyOn(Date, 'now').mockReturnValue(MOCK_TIMESTAMP_MS);
  });

  afterEach(() => {
    // モックのリセット
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    test('logger がないとエラーをスローする', () => {
      expect(() => new LockManager()).toThrow('Logger instance is required');
    });

    test('デフォルト値で初期化される', () => {
      // Assert (beforeEach で初期化済み)
      expect(lockManager.logger).toBe(mockLogger);
      expect(lockManager.locks).toBeInstanceOf(Map);
      expect(lockManager.lockTimeout).toBe(30000);
      expect(lockManager.retryInterval).toBe(100);
      expect(lockManager.maxRetries).toBe(50);
    });

    test('カスタム値で初期化される', () => {
      // Arrange
      const customLogger = createMockLogger();
      const customLockManager = new LockManager({
        logger: customLogger,
        lockTimeout: 5000,
        retryInterval: 200,
        maxRetries: 10,
      });

      // Assert
      expect(customLockManager.logger).toBe(customLogger);
      expect(customLockManager.lockTimeout).toBe(5000);
      expect(customLockManager.retryInterval).toBe(200);
      expect(customLockManager.maxRetries).toBe(10);
    });
  });

  describe('_tryAcquireLock', () => {
    test('ロックがない場合、ロックを取得できる', () => {
      // Arrange
      const resourceId = 'resource1';
      const lockerId = 'locker1';

      // Act
      const result = lockManager._tryAcquireLock(resourceId, lockerId);

      // Assert
      expect(result).toBe(true);
      expect(lockManager.locks.has(resourceId)).toBe(true);
      expect(lockManager.locks.get(resourceId)).toEqual({
        lockerId,
        timestamp: MOCK_TIMESTAMP_MS, // モックされた現在時刻
      });
    });

    test('同じプロセスによるロックの場合、ロックを取得でき、タイムスタンプが更新される', () => {
      // Arrange
      const resourceId = 'resource1';
      const lockerId = 'locker1';
      const initialTimestamp = MOCK_TIMESTAMP_MS - 1000; // 1秒前
      lockManager.locks.set(resourceId, {
        lockerId,
        timestamp: initialTimestamp,
      });

      // Act
      const result = lockManager._tryAcquireLock(resourceId, lockerId);

      // Assert
      expect(result).toBe(true);
      expect(lockManager.locks.get(resourceId).timestamp).toBe(
        MOCK_TIMESTAMP_MS
      ); // 現在時刻に更新
    });

    test('別のプロセスによる有効なロックがある場合、ロックを取得できない', () => {
      // Arrange
      const resourceId = 'resource1';
      const lockerId1 = 'locker1';
      const lockerId2 = 'locker2';
      lockManager.locks.set(resourceId, {
        lockerId: lockerId1,
        timestamp: MOCK_TIMESTAMP_MS - 1000, // 有効なロック
      });

      // Act
      const result = lockManager._tryAcquireLock(resourceId, lockerId2);

      // Assert
      expect(result).toBe(false);
      expect(lockManager.locks.get(resourceId).lockerId).toBe(lockerId1); // 変更なし
    });

    test('期限切れのロックがある場合、新しいロックを取得できる', () => {
      // Arrange
      const resourceId = 'resource1';
      const lockerId1 = 'locker1';
      const lockerId2 = 'locker2';
      lockManager.locks.set(resourceId, {
        lockerId: lockerId1,
        timestamp: MOCK_TIMESTAMP_MS - (lockManager.lockTimeout + 1000), // 期限切れ
      });

      // Act
      const result = lockManager._tryAcquireLock(resourceId, lockerId2);

      // Assert
      expect(result).toBe(true);
      expect(lockManager.locks.get(resourceId).lockerId).toBe(lockerId2);
      expect(lockManager.locks.get(resourceId).timestamp).toBe(
        MOCK_TIMESTAMP_MS
      );
      // warn はメッセージのみで呼び出されるように変更されたため、アサーションを修正
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `Overwriting expired lock for resource: ${resourceId} held by ${lockerId1}`
      );
    });
  });

  describe('acquireLock', () => {
    test('ロックがない場合、すぐにロックを取得できる', async () => {
      // Arrange
      const resourceId = 'resource1';
      const lockerId = 'locker1';
      const tryAcquireLockSpy = jest.spyOn(lockManager, '_tryAcquireLock');

      // Act
      const result = await lockManager.acquireLock(resourceId, lockerId);

      // Assert
      expect(result).toBe(true);
      expect(tryAcquireLockSpy).toHaveBeenCalledWith(resourceId, lockerId);
      expect(lockManager.locks.has(resourceId)).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Lock acquired')
      );
    });

    test('ロックが取得できない場合、再試行する', async () => {
      // Arrange
      const resourceId = 'resource1';
      const lockerId = 'locker1';
      const tryAcquireLockSpy = jest
        .spyOn(lockManager, '_tryAcquireLock')
        .mockReturnValueOnce(false) // 1回目失敗
        .mockReturnValueOnce(false) // 2回目失敗
        .mockReturnValueOnce(true); // 3回目成功
      const sleepSpy = jest.spyOn(lockManager, '_sleep').mockResolvedValue();

      // Act
      const result = await lockManager.acquireLock(resourceId, lockerId);

      // Assert
      expect(result).toBe(true);
      expect(tryAcquireLockSpy).toHaveBeenCalledTimes(3);
      expect(sleepSpy).toHaveBeenCalledTimes(2);
      expect(sleepSpy).toHaveBeenCalledWith(lockManager.retryInterval);
      // debug はメッセージのみで呼び出されるように変更されたため、アサーションを修正
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `Retrying lock acquisition for resource: ${resourceId} (Attempt 1)`
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `Retrying lock acquisition for resource: ${resourceId} (Attempt 2)`
      );
      // 成功時のログも確認 (必要に応じて)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `Lock acquired for resource: ${resourceId} by ${lockerId}`
      ); // lockerId1 を lockerId に修正
    });

    test('タイムアウトした場合、TimeoutErrorをスローし、正しいcodeとcontextを持つ', async () => {
      // Arrange
      const resourceId = 'resource1';
      const lockerId = 'locker1';
      const timeout = 500;
      lockManager.maxRetries = 50; // デフォルト値に戻す
      jest.spyOn(lockManager, '_tryAcquireLock').mockReturnValue(false); // 常に失敗
      const sleepSpy = jest.spyOn(lockManager, '_sleep').mockResolvedValue();

      // Act
      const acquirePromise = lockManager.acquireLock(
        resourceId,
        lockerId,
        timeout
      );
      // 時間を進めてタイムアウトさせる
      jest.advanceTimersByTime(timeout + lockManager.retryInterval);

      // Assert
      await expect(acquirePromise).rejects.toThrow(TimeoutError);
      await expect(acquirePromise).rejects.toMatchObject({
        name: 'TimeoutError',
        _mockOptions: {
          code: 'ERR_LOCK_TIMEOUT',
          context: {
            resourceId,
            lockerId,
            timeout,
            errorType: 'LockTimeoutError',
          },
        },
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Lock acquisition timed out'),
        expect.any(Object)
      );
    });

    test('最大再試行回数に達した場合、TimeoutErrorをスローする', async () => {
      // Arrange
      const resourceId = 'resource1';
      const lockerId = 'locker1';
      const timeout = 30000; // デフォルトタイムアウト
      const maxRetries = 3;
      lockManager.maxRetries = maxRetries;
      jest.spyOn(lockManager, '_tryAcquireLock').mockReturnValue(false); // 常に失敗
      const sleepSpy = jest.spyOn(lockManager, '_sleep').mockResolvedValue();

      // Act & Assert
      await expect(
        lockManager.acquireLock(resourceId, lockerId, timeout)
      ).rejects.toThrow(TimeoutError);
      await expect(
        lockManager.acquireLock(resourceId, lockerId, timeout)
      ).rejects.toMatchObject({
        name: 'TimeoutError',
        _mockOptions: {
          code: 'ERR_LOCK_TIMEOUT',
          context: {
            resourceId,
            lockerId,
            timeout,
            errorType: 'LockTimeoutError',
          },
        },
      });

      // 最大再試行回数だけ試行していることを確認
      expect(lockManager._tryAcquireLock).toHaveBeenCalledTimes(maxRetries);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Lock acquisition timed out'),
        expect.any(Object)
      );
    });
  });

  describe('releaseLock', () => {
    test('ロックを解放できる', () => {
      // Arrange
      const resourceId = 'resource1';
      const lockerId = 'locker1';
      lockManager.locks.set(resourceId, {
        lockerId,
        timestamp: MOCK_TIMESTAMP_MS,
      });

      // Act
      const result = lockManager.releaseLock(resourceId, lockerId);

      // Assert
      expect(result).toBe(true);
      expect(lockManager.locks.has(resourceId)).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Lock released')
      );
    });

    test('ロックがない場合、trueを返し、デバッグログを出力する', () => {
      // Arrange
      const resourceId = 'resource1';
      const lockerId = 'locker1';

      // Act
      const result = lockManager.releaseLock(resourceId, lockerId);

      // Assert
      expect(result).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Lock not found')
      );
    });

    test('別のプロセスによるロックを解放しようとすると、エラーをスローし、エラーログを出力する', () => {
      // Arrange
      const resourceId = 'resource1';
      const lockerId1 = 'locker1';
      const lockerId2 = 'locker2';
      lockManager.locks.set(resourceId, {
        lockerId: lockerId1,
        timestamp: MOCK_TIMESTAMP_MS,
      });

      // Act & Assert
      expect(() => lockManager.releaseLock(resourceId, lockerId2)).toThrow(
        `リソース ${resourceId} のロックは別のプロセス (${lockerId1}) が保持しています`
      );
      expect(lockManager.locks.has(resourceId)).toBe(true); // ロックは解放されていない
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'Attempted to release lock held by another locker'
        ),
        expect.any(Object)
      );
    });
  });

  describe('getLockStatus', () => {
    test('ロック状態を取得できる', () => {
      // Arrange
      const resourceId1 = 'resource1';
      const resourceId2 = 'resource2';
      const lockerId1 = 'locker1';
      const lockerId2 = 'locker2';
      const timestamp1 = MOCK_TIMESTAMP_MS - 10000; // 10秒前
      const timestamp2 = MOCK_TIMESTAMP_MS - (lockManager.lockTimeout + 1000); // 期限切れ

      lockManager.locks.set(resourceId1, {
        lockerId: lockerId1,
        timestamp: timestamp1,
      });
      lockManager.locks.set(resourceId2, {
        lockerId: lockerId2,
        timestamp: timestamp2,
      });

      // Act
      const status = lockManager.getLockStatus();

      // Assert
      expect(status).toBeInstanceOf(Map);
      expect(status.size).toBe(2);

      const status1 = status.get(resourceId1);
      expect(status1.lockerId).toBe(lockerId1);
      expect(status1.timestamp).toBe(timestamp1);
      expect(status1.age).toBe(MOCK_TIMESTAMP_MS - timestamp1);
      expect(status1.isExpired).toBe(false);

      const status2 = status.get(resourceId2);
      expect(status2.lockerId).toBe(lockerId2);
      expect(status2.timestamp).toBe(timestamp2);
      expect(status2.age).toBe(MOCK_TIMESTAMP_MS - timestamp2);
      expect(status2.isExpired).toBe(true);
    });

    test('ロックがない場合、空のMapを返す', () => {
      // Act
      const status = lockManager.getLockStatus();
      // Assert
      expect(status).toBeInstanceOf(Map);
      expect(status.size).toBe(0);
    });
  });

  describe('_sleep', () => {
    test('指定時間後にresolveする', async () => {
      // Arrange
      const ms = 100;
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

      // Act
      const sleepPromise = lockManager._sleep(ms);
      jest.advanceTimersByTime(ms);
      await sleepPromise;

      // Assert
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), ms);
    });
  });
});
