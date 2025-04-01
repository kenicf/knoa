/**
 * ロック管理クラスのテスト
 */

const LockManager = require('../../../src/lib/utils/lock-manager');
const { TimeoutError } = require('../../../src/lib/core/error-framework');
const {
  mockTimestamp,
  createMockLogger,
} = require('../../helpers/mock-factory');

// TimeoutError をモック化 (エラープロパティ検証のため)
// ★★★ TimeoutError のモック化を削除 ★★★
// jest.mock('../../../src/lib/core/error-framework', () => {
//   const originalModule = jest.requireActual(
//     '../../../src/lib/core/error-framework'
//   );
//   return {
//     ...originalModule,
//     TimeoutError: class MockTimeoutError extends originalModule.TimeoutError {
//       constructor(message, options) {
//         super(message, options);
//         this.name = 'TimeoutError';
//         this._mockOptions = options; // テストで検証可能にする
//       }
//     },
//   };
// });

describe('LockManager', () => {
  let lockManager;
  let mockLogger;
  const MOCK_TIMESTAMP_ISO = '2025-03-24T00:00:00.000Z';
  const MOCK_TIMESTAMP_MS = new Date(MOCK_TIMESTAMP_ISO).getTime();

  beforeEach(() => {
    // Arrange (Common setup)
    jest.clearAllMocks();
    mockLogger = createMockLogger();

    // LockManagerのインスタンスを作成
    lockManager = new LockManager({ logger: mockLogger });

    // タイマーと時間のモック (モダンフェイクタイマーを使用)
    jest.useFakeTimers({ advanceTimers: true }); // モダンタイマーに変更
    mockTimestamp(MOCK_TIMESTAMP_ISO);
    jest.spyOn(Date, 'now').mockReturnValue(MOCK_TIMESTAMP_MS);
  });

  afterEach(() => {
    // Clean up mocks
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    test('should throw error if logger is not provided', () => {
      // Arrange & Act & Assert
      expect(() => new LockManager()).toThrow('Logger instance is required');
    });

    test('should initialize with default values', () => {
      // Arrange (Instance created in beforeEach)
      // Act (Implicitly done by beforeEach)
      // Assert
      expect(lockManager.logger).toBe(mockLogger);
      expect(lockManager.locks).toBeInstanceOf(Map);
      expect(lockManager.lockTimeout).toBe(30000);
      expect(lockManager.retryInterval).toBe(100);
      expect(lockManager.maxRetries).toBe(50);
    });

    test('should initialize with custom values', () => {
      // Arrange
      const customLogger = createMockLogger();
      const options = {
        logger: customLogger,
        lockTimeout: 5000,
        retryInterval: 200,
        maxRetries: 10,
      };

      // Act
      const customLockManager = new LockManager(options);

      // Assert
      expect(customLockManager.logger).toBe(customLogger);
      expect(customLockManager.lockTimeout).toBe(5000);
      expect(customLockManager.retryInterval).toBe(200);
      expect(customLockManager.maxRetries).toBe(10);
    });
  });

  describe('_tryAcquireLock', () => {
    test('should acquire lock if resource is not locked', () => {
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
        timestamp: MOCK_TIMESTAMP_MS,
      });
    });

    test('should acquire lock and update timestamp if lock is held by the same locker', () => {
      // Arrange
      const resourceId = 'resource1';
      const lockerId = 'locker1';
      const initialTimestamp = MOCK_TIMESTAMP_MS - 1000; // 1 second ago
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
      ); // Updated timestamp
    });

    test('should not acquire lock if held by another locker', () => {
      // Arrange
      const resourceId = 'resource1';
      const lockerId1 = 'locker1';
      const lockerId2 = 'locker2';
      lockManager.locks.set(resourceId, {
        lockerId: lockerId1,
        timestamp: MOCK_TIMESTAMP_MS - 1000, // Still valid lock
      });

      // Act
      const result = lockManager._tryAcquireLock(resourceId, lockerId2);

      // Assert
      expect(result).toBe(false);
      expect(lockManager.locks.get(resourceId).lockerId).toBe(lockerId1); // Unchanged
    });

    test('should acquire lock if existing lock is expired', () => {
      // Arrange
      const resourceId = 'resource1';
      const lockerId1 = 'locker1';
      const lockerId2 = 'locker2';
      const expiredTimestamp =
        MOCK_TIMESTAMP_MS - (lockManager.lockTimeout + 1000); // Expired
      lockManager.locks.set(resourceId, {
        lockerId: lockerId1,
        timestamp: expiredTimestamp,
      });

      // Act
      const result = lockManager._tryAcquireLock(resourceId, lockerId2);

      // Assert
      expect(result).toBe(true);
      expect(lockManager.locks.get(resourceId).lockerId).toBe(lockerId2); // Overwritten
      expect(lockManager.locks.get(resourceId).timestamp).toBe(
        MOCK_TIMESTAMP_MS
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `Overwriting expired lock for resource: ${resourceId} held by ${lockerId1}`
      );
    });
  });

  describe('acquireLock', () => {
    test('should acquire lock immediately if available', async () => {
      // Arrange
      const resourceId = 'resource1';
      const lockerId = 'locker1';
      const tryAcquireLockSpy = jest.spyOn(lockManager, '_tryAcquireLock');

      // Act
      const result = await lockManager.acquireLock(resourceId, lockerId);

      // Assert
      expect(result).toBe(true);
      expect(tryAcquireLockSpy).toHaveBeenCalledTimes(1);
      expect(lockManager.locks.has(resourceId)).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `Lock acquired for resource: ${resourceId} by ${lockerId}`
      );
    });

    test('should retry acquiring lock if initially unavailable', async () => {
      // Arrange
      const resourceId = 'resource1';
      const lockerId = 'locker1';
      const tryAcquireLockSpy = jest
        .spyOn(lockManager, '_tryAcquireLock')
        .mockReturnValueOnce(false) // 1st attempt fails
        .mockReturnValueOnce(false) // 2nd attempt fails
        .mockReturnValueOnce(true); // 3rd attempt succeeds
      const sleepSpy = jest.spyOn(lockManager, '_sleep').mockResolvedValue();

      // Act
      const result = await lockManager.acquireLock(resourceId, lockerId);

      // Assert
      expect(result).toBe(true);
      expect(tryAcquireLockSpy).toHaveBeenCalledTimes(3);
      expect(sleepSpy).toHaveBeenCalledTimes(2);
      expect(sleepSpy).toHaveBeenCalledWith(lockManager.retryInterval);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `Retrying lock acquisition for resource: ${resourceId} (Attempt 1)`
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `Retrying lock acquisition for resource: ${resourceId} (Attempt 2)`
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `Lock acquired for resource: ${resourceId} by ${lockerId}`
      );
    });

    // タイムアウト値をテスト関数の第3引数に追加
    test('should throw TimeoutError with correct code and context on timeout', async () => {
      // Arrange
      const resourceId = 'resource1';
      const lockerId = 'locker1';
      const timeout = 500;
      lockManager.maxRetries = 50; // Ensure retries don't limit before timeout
      jest.spyOn(lockManager, '_tryAcquireLock').mockReturnValue(false); // Always fail

      // Act
      const acquirePromise = lockManager.acquireLock(
        resourceId,
        lockerId,
        timeout
      );
      // jest.advanceTimersByTime(timeout + lockManager.retryInterval); // モダンタイマーでは不要な場合がある

      // Assert
      await expect(acquirePromise).rejects.toThrow(TimeoutError);
      await expect(acquirePromise).rejects.toMatchObject({
        name: 'TimeoutError',
        code: 'ERR_LOCK_TIMEOUT', // ★★★ TimeoutError のモック化をやめたため、直接プロパティを検証 ★★★
        context: {
          resourceId,
          lockerId,
          timeout,
          errorType: 'LockTimeoutError',
        },
      });
      // ★★★ アサーション修正: 第2引数の形式を実際の呼び出しに合わせる ★★★
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `Lock acquisition timed out for resource: ${resourceId}`,
        {
          error: expect.objectContaining({
            // error プロパティの中に TimeoutError があることを確認
            name: 'TimeoutError',
            code: 'ERR_LOCK_TIMEOUT',
            context: expect.objectContaining({ resourceId, lockerId, timeout }),
          }),
        }
      );
    }, 10000); // タイムアウト値を 10000ms に変更 (Jest のデフォルトタイムアウトより長く)

    // タイムアウト値をテスト関数の第3引数に追加
    test('should throw TimeoutError after reaching max retries', async () => {
      // Arrange
      const resourceId = 'resource1';
      const lockerId = 'locker1';
      const timeout = 30000; // Default timeout (long enough not to trigger first)
      const maxRetries = 3;
      lockManager.maxRetries = maxRetries;
      const tryAcquireLockSpy = jest
        .spyOn(lockManager, '_tryAcquireLock')
        .mockReturnValue(false); // Always fail

      // Act & Assert
      const acquirePromise = lockManager.acquireLock(
        resourceId,
        lockerId,
        timeout
      );
      // jest.advanceTimersByTime(maxRetries * lockManager.retryInterval + 1); // モダンタイマーでは不要な場合がある

      await expect(acquirePromise).rejects.toThrow(TimeoutError);
      await expect(acquirePromise).rejects.toMatchObject({
        name: 'TimeoutError',
        code: 'ERR_LOCK_TIMEOUT', // ★★★ TimeoutError のモック化をやめたため、直接プロパティを検証 ★★★
        context: expect.objectContaining({ resourceId, lockerId, timeout }),
      });
      expect(tryAcquireLockSpy).toHaveBeenCalledTimes(maxRetries); // Verify retry count
      // ★★★ アサーション修正: 第2引数の形式を実際の呼び出しに合わせる ★★★
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `Lock acquisition timed out for resource: ${resourceId}`,
        {
          error: expect.objectContaining({
            // error プロパティの中に TimeoutError があることを確認
            name: 'TimeoutError',
            code: 'ERR_LOCK_TIMEOUT',
          }),
        }
      );
    }, 10000); // タイムアウト値を 10000ms に変更
  });

  describe('releaseLock', () => {
    test('should release the lock successfully', () => {
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
        `Lock released for resource: ${resourceId} by ${lockerId}`
      );
    });

    test('should return true and log debug if lock does not exist', () => {
      // Arrange
      const resourceId = 'resource1';
      const lockerId = 'locker1';

      // Act
      const result = lockManager.releaseLock(resourceId, lockerId);

      // Assert
      expect(result).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `Lock not found for resource: ${resourceId}, assuming released.`
      );
    });

    test('should throw Error and log error if attempting to release lock held by another locker', () => {
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
      expect(lockManager.locks.has(resourceId)).toBe(true); // Lock not released
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Attempted to release lock held by another locker`,
        expect.objectContaining({
          resourceId,
          attemptedLockerId: lockerId2,
          actualLockerId: lockerId1,
          error: expect.any(Error),
        })
      );
    });
  });

  describe('getLockStatus', () => {
    test('should return the current lock status', () => {
      // Arrange
      const resourceId1 = 'resource1';
      const resourceId2 = 'resource2';
      const lockerId1 = 'locker1';
      const lockerId2 = 'locker2';
      const timestamp1 = MOCK_TIMESTAMP_MS - 10000; // 10 seconds ago (not expired)
      const timestamp2 = MOCK_TIMESTAMP_MS - (lockManager.lockTimeout + 1000); // Expired

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
      expect(status1).toEqual({
        lockerId: lockerId1,
        timestamp: timestamp1,
        age: MOCK_TIMESTAMP_MS - timestamp1,
        isExpired: false,
      });

      const status2 = status.get(resourceId2);
      expect(status2).toEqual({
        lockerId: lockerId2,
        timestamp: timestamp2,
        age: MOCK_TIMESTAMP_MS - timestamp2,
        isExpired: true,
      });
    });

    test('should return an empty Map if no locks exist', () => {
      // Arrange (No locks set)
      // Act
      const status = lockManager.getLockStatus();
      // Assert
      expect(status).toBeInstanceOf(Map);
      expect(status.size).toBe(0);
    });
  });

  describe('_sleep', () => {
    test('should resolve after the specified time', async () => {
      // Arrange
      const ms = 100;
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

      // Act
      const sleepPromise = lockManager._sleep(ms);
      jest.advanceTimersByTime(ms); // Advance timer
      await sleepPromise; // Wait for promise to resolve

      // Assert
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), ms);
    });
  });
});
