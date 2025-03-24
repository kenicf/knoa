/**
 * ロック管理クラスのテスト
 */

const LockManager = require('../../../src/lib/utils/lock-manager');
const { LockTimeoutError } = require('../../../src/lib/utils/errors');
const { mockTimestamp } = require('../../helpers/mock-factory');

// errorsモジュールのモック
jest.mock('../../../src/lib/utils/errors', () => ({
  LockTimeoutError: class LockTimeoutError extends Error {
    constructor(message) {
      super(message);
      this.name = 'LockTimeoutError';
    }
  }
}));

describe('LockManager', () => {
  let lockManager;
  
  beforeEach(() => {
    // モックのセットアップ
    jest.clearAllMocks();
    
    // デフォルト設定でLockManagerのインスタンスを作成
    lockManager = new LockManager();
    
    // タイマーをモック化
    jest.useFakeTimers();
    
    // 日付・時間関連のモックを設定
    mockTimestamp('2025-03-24T00:00:00.000Z');
  });
  
  afterEach(() => {
    // タイマーを元に戻す
    jest.useRealTimers();
    jest.restoreAllMocks();
  });
  
  describe('constructor', () => {
    test('デフォルト値で初期化される', () => {
      expect(lockManager.locks).toBeInstanceOf(Map);
      expect(lockManager.lockTimeout).toBe(30000);
      expect(lockManager.retryInterval).toBe(100);
      expect(lockManager.maxRetries).toBe(50);
    });
    
    test('カスタム値で初期化される', () => {
      const customLockManager = new LockManager({
        lockTimeout: 5000,
        retryInterval: 200,
        maxRetries: 10
      });
      
      expect(customLockManager.lockTimeout).toBe(5000);
      expect(customLockManager.retryInterval).toBe(200);
      expect(customLockManager.maxRetries).toBe(10);
    });
  });
  
  describe('_tryAcquireLock', () => {
    test('ロックがない場合、ロックを取得できる', () => {
      const resourceId = 'resource1';
      const lockerId = 'locker1';
      
      const result = lockManager._tryAcquireLock(resourceId, lockerId);
      
      expect(result).toBe(true);
      expect(lockManager.locks.has(resourceId)).toBe(true);
      expect(lockManager.locks.get(resourceId)).toEqual({
        lockerId,
        timestamp: expect.any(Number)
      });
    });
    
    test('同じプロセスによるロックの場合、ロックを取得できる', () => {
      // Arrange
      const resourceId = 'resource1';
      const lockerId = 'locker1';
      
      // mockTimestampを使用しているため、Date.now()は固定値を返す
      // 代わりに、初期タイムスタンプを手動で設定
      const initialTimestamp = 1742774400000 - 1000; // 現在のモックタイムスタンプより1秒前
      
      // 既存のロックを設定
      lockManager.locks.set(resourceId, {
        lockerId,
        timestamp: initialTimestamp
      });
      
      // Act
      const result = lockManager._tryAcquireLock(resourceId, lockerId);
      
      // Assert
      expect(result).toBe(true);
      // 新しいタイムスタンプは初期値より大きい
      expect(lockManager.locks.get(resourceId).timestamp).toBeGreaterThan(initialTimestamp);
    });
    
    test('別のプロセスによるロックがある場合、ロックを取得できない', () => {
      const resourceId = 'resource1';
      const lockerId1 = 'locker1';
      const lockerId2 = 'locker2';
      
      // 既存のロックを設定
      lockManager.locks.set(resourceId, {
        lockerId: lockerId1,
        timestamp: Date.now()
      });
      
      const result = lockManager._tryAcquireLock(resourceId, lockerId2);
      
      expect(result).toBe(false);
      expect(lockManager.locks.get(resourceId).lockerId).toBe(lockerId1);
    });
    
    test('期限切れのロックがある場合、新しいロックを取得できる', () => {
      const resourceId = 'resource1';
      const lockerId1 = 'locker1';
      const lockerId2 = 'locker2';
      
      // 既存のロックを設定
      lockManager.locks.set(resourceId, {
        lockerId: lockerId1,
        timestamp: Date.now() - 40000 // 30秒のタイムアウトより古い
      });
      
      const result = lockManager._tryAcquireLock(resourceId, lockerId2);
      
      expect(result).toBe(true);
      expect(lockManager.locks.get(resourceId).lockerId).toBe(lockerId2);
    });
  });
  
  describe('acquireLock', () => {
    test('ロックがない場合、すぐにロックを取得できる', async () => {
      // Arrange
      const resourceId = 'resource1';
      const lockerId = 'locker1';
      
      // _tryAcquireLockをスパイ
      jest.spyOn(lockManager, '_tryAcquireLock');
      
      // Act
      const result = await lockManager.acquireLock(resourceId, lockerId);
      
      // Assert
      expect(result).toBe(true);
      expect(lockManager._tryAcquireLock).toHaveBeenCalledWith(resourceId, lockerId);
      expect(lockManager.locks.has(resourceId)).toBe(true);
    });
    
    test('ロックが取得できない場合、再試行する', async () => {
      // Arrange
      const resourceId = 'resource1';
      const lockerId = 'locker1';
      
      // _tryAcquireLockをモック
      jest.spyOn(lockManager, '_tryAcquireLock')
        .mockReturnValueOnce(false) // 1回目は失敗
        .mockReturnValueOnce(false) // 2回目も失敗
        .mockReturnValueOnce(true); // 3回目は成功
      
      // _sleepをモック
      jest.spyOn(lockManager, '_sleep').mockResolvedValue();
      
      // Act
      const result = await lockManager.acquireLock(resourceId, lockerId);
      
      // Assert
      expect(result).toBe(true);
      expect(lockManager._tryAcquireLock).toHaveBeenCalledTimes(3);
      expect(lockManager._sleep).toHaveBeenCalledTimes(2);
      expect(lockManager._sleep).toHaveBeenCalledWith(lockManager.retryInterval);
    });
    
    test('タイムアウトと最大再試行回数に達した場合、LockTimeoutErrorをスローする', async () => {
      // Arrange
      const resourceId = 'resource1';
      const lockerId = 'locker1';
      const maxRetries = 3;
      
      // 最大再試行回数を設定
      lockManager.maxRetries = maxRetries;
      
      // _tryAcquireLockをモック（常に失敗）
      jest.spyOn(lockManager, '_tryAcquireLock').mockReturnValue(false);
      
      // _sleepをモック
      jest.spyOn(lockManager, '_sleep').mockResolvedValue();
      
      // Act & Assert
      await expect(lockManager.acquireLock(resourceId, lockerId))
        .rejects.toThrow(LockTimeoutError);
      
      // 最大再試行回数だけ試行していることを確認
      expect(lockManager._tryAcquireLock).toHaveBeenCalledTimes(maxRetries);
      expect(lockManager._tryAcquireLock).toHaveBeenCalledWith(resourceId, lockerId);
    });
  });
  
  describe('releaseLock', () => {
    test('ロックを解放できる', () => {
      const resourceId = 'resource1';
      const lockerId = 'locker1';
      
      // ロックを設定
      lockManager.locks.set(resourceId, {
        lockerId,
        timestamp: Date.now()
      });
      
      const result = lockManager.releaseLock(resourceId, lockerId);
      
      expect(result).toBe(true);
      expect(lockManager.locks.has(resourceId)).toBe(false);
    });
    
    test('ロックがない場合、trueを返す', () => {
      const resourceId = 'resource1';
      const lockerId = 'locker1';
      
      const result = lockManager.releaseLock(resourceId, lockerId);
      
      expect(result).toBe(true);
    });
    
    test('別のプロセスによるロックを解放しようとすると、エラーをスローする', () => {
      const resourceId = 'resource1';
      const lockerId1 = 'locker1';
      const lockerId2 = 'locker2';
      
      // ロックを設定
      lockManager.locks.set(resourceId, {
        lockerId: lockerId1,
        timestamp: Date.now()
      });
      
      expect(() => lockManager.releaseLock(resourceId, lockerId2))
        .toThrow(`リソース ${resourceId} のロックは別のプロセスが保持しています`);
      
      // ロックは解放されていない
      expect(lockManager.locks.has(resourceId)).toBe(true);
    });
  });
  
  describe('getLockStatus', () => {
    test('ロック状態を取得できる', () => {
      const resourceId1 = 'resource1';
      const resourceId2 = 'resource2';
      const lockerId1 = 'locker1';
      const lockerId2 = 'locker2';
      const timestamp1 = Date.now() - 10000; // 10秒前
      const timestamp2 = Date.now() - 40000; // 40秒前（期限切れ）
      
      // ロックを設定
      lockManager.locks.set(resourceId1, {
        lockerId: lockerId1,
        timestamp: timestamp1
      });
      
      lockManager.locks.set(resourceId2, {
        lockerId: lockerId2,
        timestamp: timestamp2
      });
      
      const status = lockManager.getLockStatus();
      
      expect(status).toBeInstanceOf(Map);
      expect(status.size).toBe(2);
      
      // resource1のロック状態
      const status1 = status.get(resourceId1);
      expect(status1.lockerId).toBe(lockerId1);
      expect(status1.timestamp).toBe(timestamp1);
      expect(status1.age).toBeGreaterThanOrEqual(10000);
      expect(status1.isExpired).toBe(false);
      
      // resource2のロック状態（期限切れ）
      const status2 = status.get(resourceId2);
      expect(status2.lockerId).toBe(lockerId2);
      expect(status2.timestamp).toBe(timestamp2);
      expect(status2.age).toBeGreaterThanOrEqual(40000);
      expect(status2.isExpired).toBe(true);
    });
    
    test('ロックがない場合、空のMapを返す', () => {
      const status = lockManager.getLockStatus();
      
      expect(status).toBeInstanceOf(Map);
      expect(status.size).toBe(0);
    });
  });
  
  describe('_sleep', () => {
    test('指定時間後にresolveする', async () => {
      // Arrange
      const ms = 100;
      
      // setTimeoutをスパイ
      jest.spyOn(global, 'setTimeout');
      
      // Act & Assert
      await expect(async () => {
        const promise = lockManager._sleep(ms);
        jest.advanceTimersByTime(ms);
        await promise;
      }).not.toThrow();
      
      // タイマーが正しく呼び出されたことを確認
      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), ms);
    });
    
    test('resolves.toBeUndefinedパターンを使用した非同期テスト', async () => {
      // Arrange
      const ms = 100;
      
      // Act & Assert
      await expect(
        (async () => {
          const promise = lockManager._sleep(ms);
          jest.advanceTimersByTime(ms);
          return promise;
        })()
      ).resolves.toBeUndefined();
    });
  });
});