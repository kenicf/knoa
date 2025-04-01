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
  CliError, // CliError をインポート
} = require('../../../src/lib/utils/errors');

describe('Custom Error Classes', () => {
  describe('GitError', () => {
    test('should instantiate correctly and set properties', () => {
      // Arrange
      const message = 'Git operation failed';
      const cause = new Error('Underlying git command error');
      const context = { command: 'git push' };

      // Act
      // GitError のコンストラクタは (message, cause, context) を受け取るため変更不要
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

    test('should instantiate without cause and context', () => {
      // Arrange
      const message = 'Simple Git error';

      // Act
      const error = new GitError(message);

      // Assert
      expect(error.message).toBe(message);
      expect(error.cause).toBeUndefined();
      expect(error.context).toEqual({}); // Default is an empty object
    });
  });

  describe('StorageError', () => {
    test('should instantiate correctly and set properties', () => {
      // Arrange
      const message = 'Storage operation failed';
      const cause = new Error('File system error');
      const context = { filePath: '/path/to/file' };

      // Act
      // StorageError のコンストラクタは (message, options) を受け取る
      // cause と context を options オブジェクトに含めるように修正
      const error = new StorageError(message, {
        cause: cause,
        context: context,
      });

      // Assert
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ApplicationError);
      expect(error).toBeInstanceOf(StorageError);
      expect(error.name).toBe('StorageError');
      expect(error.message).toBe(message);
      expect(error.cause).toBe(cause); // cause が正しく設定されることを確認
      expect(error.code).toBe('ERR_STORAGE'); // Core StorageError code
      expect(error.context).toEqual(context);
    });

    test('should instantiate without cause and context', () => {
      // Arrange
      const message = 'Simple Storage error';

      // Act
      const error = new StorageError(message); // options は省略

      // Assert
      expect(error.message).toBe(message);
      expect(error.cause).toBeUndefined();
      expect(error.context).toEqual({}); // Default is an empty object
    });
  });

  // --- CliError のテストを追加 ---
  describe('CliError', () => {
    test('should instantiate correctly and set properties with default code', () => {
      // Arrange
      const message = 'CLI command failed';
      const cause = new Error('Command execution error');
      const context = { command: 'npm run build' };

      // Act
      // CliError のコンストラクタは (message, cause, context) を受け取るため変更不要
      const error = new CliError(message, cause, context);

      // Assert
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ApplicationError);
      expect(error).toBeInstanceOf(CliError);
      expect(error.name).toBe('CliError');
      expect(error.message).toBe(message);
      expect(error.cause).toBe(cause);
      expect(error.code).toBe('ERR_CLI'); // Default code
      expect(error.context).toEqual(context); // Original context without code property
    });

    test('should use code from context if provided', () => {
      // Arrange
      const message = 'CLI command failed with custom code';
      const cause = new Error('Command execution error');
      const context = { command: 'npm test', code: 'ERR_TEST_FAILED' };
      const expectedContext = { command: 'npm test' }; // code should be removed

      // Act
      const error = new CliError(message, cause, context);

      // Assert
      expect(error.code).toBe('ERR_TEST_FAILED'); // Code from context
      expect(error.context).toEqual(expectedContext); // Context without code property
    });

    test('should instantiate without cause and context', () => {
      // Arrange
      const message = 'Simple CLI error';

      // Act
      const error = new CliError(message);

      // Assert
      expect(error.message).toBe(message);
      expect(error.cause).toBeUndefined();
      expect(error.code).toBe('ERR_CLI'); // Default code
      expect(error.context).toEqual({}); // Default is an empty object
    });
  });
  // --- CliError のテスト終了 ---

  // 再エクスポートされたコアエラークラスの基本的なテスト（必要に応じて）
  describe('Re-exported Core Errors', () => {
    // test.each を個別のテストに分割
    test('ApplicationError should be re-exported correctly', () => {
      // Arrange
      const message = 'Test ApplicationError';
      // Act
      const error = new ApplicationError(message);
      // Assert
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ApplicationError');
      expect(error.message).toBe(message);
    });
    test('ValidationError should be re-exported correctly', () => {
      // Arrange
      const message = 'Test ValidationError';
      // Act
      const error = new ValidationError(message);
      // Assert
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe(message);
    });
    test('StateError should be re-exported correctly', () => {
      // Arrange
      const message = 'Test StateError';
      // Act
      const error = new StateError(message);
      // Assert
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('StateError');
      expect(error.message).toBe(message);
    });
    test('DataConsistencyError should be re-exported correctly', () => {
      // Arrange
      const message = 'Test DataConsistencyError';
      // Act
      const error = new DataConsistencyError(message);
      // Assert
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('DataConsistencyError');
      expect(error.message).toBe(message);
    });
    test('TimeoutError should be re-exported correctly', () => {
      // Arrange
      const message = 'Test TimeoutError';
      // Act
      const error = new TimeoutError(message);
      // Assert
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('TimeoutError');
      expect(error.message).toBe(message);
    });
    test('LockError should be re-exported correctly', () => {
      // Arrange
      const message = 'Test LockError';
      // Act
      const error = new LockError(message);
      // Assert
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('LockError');
      expect(error.message).toBe(message);
    });
    test('ConfigurationError should be re-exported correctly', () => {
      // Arrange
      const message = 'Test ConfigurationError';
      // Act
      const error = new ConfigurationError(message);
      // Assert
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ConfigurationError');
      expect(error.message).toBe(message);
    });
    test('AuthorizationError should be re-exported correctly', () => {
      // Arrange
      const message = 'Test AuthorizationError';
      // Act
      const error = new AuthorizationError(message);
      // Assert
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('AuthorizationError');
      expect(error.message).toBe(message);
    });
    test('NotFoundError should be re-exported correctly', () => {
      // Arrange
      const message = 'Test NotFoundError';
      // Act
      const error = new NotFoundError(message);
      // Assert
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('NotFoundError');
      expect(error.message).toBe(message);
    });
    test('ExternalServiceError should be re-exported correctly', () => {
      // Arrange
      const message = 'Test ExternalServiceError';
      // Act
      const error = new ExternalServiceError(message);
      // Assert
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ExternalServiceError');
      expect(error.message).toBe(message);
    });
  });
});
