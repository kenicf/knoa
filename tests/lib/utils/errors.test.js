/**
 * エラークラス定義のテスト
 */

const {
  ApplicationError,
  ValidationError,
  StateError,
  DataConsistencyError,
  TimeoutError,
  LockError,
  ConfigurationError,
  AuthorizationError,
  NotFoundError,
  ExternalServiceError,
  GitError,
  StorageError,
} = require('../../../src/lib/utils/errors');

describe('Custom Error Classes', () => {
  describe('GitError', () => {
    test('正しくインスタンス化され、プロパティが設定される', () => {
      // Arrange
      const message = 'Git operation failed';
      const cause = new Error('Underlying git command error');
      const context = { command: 'git push' };

      // Act
      const error = new GitError(message, cause, context);

      // Assert
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ApplicationError);
      expect(error).toBeInstanceOf(GitError);
      expect(error.name).toBe('GitError');
      expect(error.message).toBe(message);
      expect(error.cause).toBe(cause);
      expect(error.code).toBe('ERR_GIT');
      expect(error.context).toEqual(context);
    });

    test('cause と context がなくてもインスタンス化できる', () => {
        // Arrange
        const message = 'Simple Git error';
        // Act
        const error = new GitError(message);
        // Assert
        expect(error.message).toBe(message);
        expect(error.cause).toBeUndefined();
        expect(error.context).toEqual({}); // デフォルトは空オブジェクト
      });
  });

  describe('StorageError', () => {
    test('正しくインスタンス化され、プロパティが設定される', () => {
      // Arrange
      const message = 'Storage operation failed';
      const cause = new Error('File system error');
      const context = { filePath: '/path/to/file' };

      // Act
      const error = new StorageError(message, cause, context); // この呼び出しで L49-50 がカバーされるはず

      // Assert
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ApplicationError);
      expect(error).toBeInstanceOf(StorageError);
      expect(error.name).toBe('StorageError');
      expect(error.message).toBe(message);
      expect(error.cause).toBe(cause);
      expect(error.code).toBe('ERR_STORAGE');
      expect(error.context).toEqual(context);
    });

    test('cause と context がなくてもインスタンス化できる', () => {
        // Arrange
        const message = 'Simple Storage error';
        // Act
        const error = new StorageError(message);
        // Assert
        expect(error.message).toBe(message);
        expect(error.cause).toBeUndefined();
        expect(error.context).toEqual({}); // デフォルトは空オブジェクト
      });
  });

  // 再エクスポートされたコアエラークラスの基本的なテスト（必要に応じて）
  describe('Re-exported Core Errors', () => {
    test.each([
      ['ApplicationError', ApplicationError],
      ['ValidationError', ValidationError],
      ['StateError', StateError],
      ['DataConsistencyError', DataConsistencyError],
      ['TimeoutError', TimeoutError],
      ['LockError', LockError],
      ['ConfigurationError', ConfigurationError],
      ['AuthorizationError', AuthorizationError],
      ['NotFoundError', NotFoundError],
      ['ExternalServiceError', ExternalServiceError],
    ])('%s が正しく再エクスポートされている', (name, ErrorClass) => {
      // Arrange
      const message = `Test ${name}`;
      // Act
      const error = new ErrorClass(message);
      // Assert
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe(name);
      expect(error.message).toBe(message);
    });
  });
});