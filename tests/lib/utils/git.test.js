/**
 * Gitサービスのテスト (simple-git 使用版)
 */

const GitService = require('../../../src/lib/utils/git');
const { GitError } = require('../../../src/lib/utils/errors');
const {
  createMockLogger,
  createMockEventEmitter,
  mockTimestamp,
} = require('../../helpers/mock-factory');
const {
  expectStandardizedEventEmitted,
} = require('../../helpers/test-helpers');

// simple-git をモック化
const mockGit = {
  revparse: jest.fn(),
  log: jest.fn(),
  show: jest.fn(),
  branchLocal: jest.fn(),
  add: jest.fn(),
  commit: jest.fn(),
};
jest.mock('simple-git', () => {
  return jest.fn(() => mockGit);
});

describe('GitService (simple-git)', () => {
  let gitService;
  let mockLogger;
  let mockEventEmitter;
  const MOCK_TIMESTAMP_ISO = '2025-03-24T00:00:00.000Z';

  beforeEach(() => {
    // モックのリセット
    jest.clearAllMocks();

    // 時間のモック
    mockTimestamp(MOCK_TIMESTAMP_ISO);

    // 共通モックファクトリを使用
    mockLogger = createMockLogger();
    mockEventEmitter = createMockEventEmitter();

    // GitServiceのインスタンス作成
    // エラーハンドラもモックして渡す
    const mockErrorHandler = { handle: jest.fn((err) => err) }; // エラーをそのまま返すモック
    gitService = new GitService({
      repoPath: '/test/repo/path',
      logger: mockLogger,
      eventEmitter: mockEventEmitter,
      errorHandler: mockErrorHandler, // errorHandler を渡す
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    test('logger がないとエラーをスローする', () => {
      expect(() => new GitService({ eventEmitter: mockEventEmitter })).toThrow(
        'Logger instance is required'
      );
    });

    test('オプションなしでデフォルト値が正しく設定される', () => {
      // Arrange & Act
      const defaultGitService = new GitService({ logger: createMockLogger() });
      // Assert
      expect(defaultGitService.repoPath).toBe(process.cwd());
      expect(defaultGitService.logger).toBeDefined();
      expect(defaultGitService.eventEmitter).toBeUndefined();
      expect(defaultGitService.errorHandler).toBeUndefined();
      expect(defaultGitService.taskIdPattern).toEqual(/#(T[0-9]{3})/g);
      expect(require('simple-git')).toHaveBeenCalledWith(process.cwd());
    });

    test('カスタム値で初期化される', () => {
      // Assert (beforeEach で初期化済み)
      expect(gitService.repoPath).toBe('/test/repo/path');
      expect(gitService.logger).toBe(mockLogger);
      expect(gitService.eventEmitter).toBe(mockEventEmitter);
      expect(require('simple-git')).toHaveBeenCalledWith('/test/repo/path');
    });
  });

  test('eventEmitter がない場合でもエラーなく動作する', async () => {
    // Arrange
    const gitServiceWithoutEmitter = new GitService({ logger: mockLogger });
    const mockHash = 'abcdef1234567890';
    mockGit.revparse.mockResolvedValue(mockHash);

    // Act & Assert
    await expect(gitServiceWithoutEmitter.getCurrentCommitHash()).resolves.toBe(
      mockHash
    );
    // emitStandardized が呼ばれないことを確認 (アサーションは不要)
  });

  describe('getCurrentCommitHash', () => {
    test('現在のコミットハッシュを取得する', async () => {
      // Arrange
      const mockHash = 'abcdef1234567890';
      mockGit.revparse.mockResolvedValue(mockHash);

      // Act
      const result = await gitService.getCurrentCommitHash();

      // Assert
      expect(result).toBe(mockHash);
      expect(mockGit.revparse).toHaveBeenCalledWith(['HEAD']);
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_hash_before',
        { timestamp: 'any' }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_hash_after',
        { hash: mockHash, success: true, timestamp: 'any' }
      );
    });

    test('エラーが発生した場合、GitErrorをスローし、エラー情報をログに出力する', async () => {
      // Arrange
      const error = new Error('Git revparse error');
      mockGit.revparse.mockRejectedValue(error);
      // emitStandardized のエラーテストは別ケースで行うため、ここでは不要

      // Act & Assert
      await expect(gitService.getCurrentCommitHash()).rejects.toThrow(GitError); // 元のエラーがスローされることを確認
      expect(mockGit.revparse).toHaveBeenCalledWith(['HEAD']);
      // イベント発行は _handleError に移譲されるか、エラー前に発行される
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_hash_before',
        { timestamp: 'any' }
      );
      // エラーハンドリングの確認 (logger.error は削除済み)

      // errorHandler.handle が呼び出されることを確認
      expect(gitService.errorHandler.handle).toHaveBeenCalledWith(
        expect.any(GitError),
        'GitService',
        'getCurrentCommitHash',
        { operation: 'getCurrentCommitHash' }
      );
      // errorHandler.handle が呼び出されたことも確認
      expect(gitService.errorHandler.handle).toHaveBeenCalledWith(
        expect.any(GitError),
        'GitService',
        'getCurrentCommitHash',
        { operation: 'getCurrentCommitHash' }
      );
    });
  });

  describe('extractTaskIdsFromCommitMessage', () => {
    test.each([
      ['Fix bug #T001 and implement feature #T002', ['T001', 'T002']],
      ['Fix bug and implement feature', []],
      ['Message with #T123 and #T456', ['T123', 'T456']],
      ['Invalid ID #TABC', []],
      ['No hash T001', []],
      ['', []],
      // null や undefined の場合はエラーではなく空配列を返すことを確認
      [null, []],
      [undefined, []],
    ])('メッセージ "%s" からタスクID %p を抽出する', (message, expected) => {
      // Act
      const result = gitService.extractTaskIdsFromCommitMessage(message);
      // Assert
      expect(result).toEqual(expected);
    });

    test('message.match がエラーをスローする場合、GitErrorをスローし、エラー情報をログに出力する', () => {
      // Arrange
      const invalidMessage = {
        toString: () => {
          throw new Error('Invalid message object');
        },
      };
      // Act & Assert
      expect(() =>
        gitService.extractTaskIdsFromCommitMessage(invalidMessage)
      ).toThrow(GitError);
    });
  });

  describe('getCommitsBetween', () => {
    test('コミット間のコミット情報を取得する', async () => {
      // Arrange
      const mockLog = {
        all: [
          {
            hash: 'abc123',
            message: 'Fix bug #T001',
            date: '2025-03-20T10:00:00+09:00',
            author_name: 'User1',
          },
          {
            hash: 'def456',
            message: 'Implement feature #T002',
            date: '2025-03-21T11:00:00+09:00',
            author_name: 'User2',
          },
        ],
        latest: { hash: 'def456' },
        total: 2,
      };
      mockGit.log.mockResolvedValue(mockLog);
      jest
        .spyOn(gitService, 'extractTaskIdsFromCommitMessage')
        .mockReturnValueOnce(['T001'])
        .mockReturnValueOnce(['T002']);

      // Act
      const result = await gitService.getCommitsBetween(
        'start-commit',
        'end-commit'
      );

      // Assert
      expect(result).toEqual([
        {
          hash: 'abc123',
          message: 'Fix bug #T001',
          timestamp: '2025-03-20T10:00:00+09:00',
          author: 'User1',
          related_tasks: ['T001'],
        },
        {
          hash: 'def456',
          message: 'Implement feature #T002',
          timestamp: '2025-03-21T11:00:00+09:00',
          author: 'User2',
          related_tasks: ['T002'],
        },
      ]);
      expect(mockGit.log).toHaveBeenCalledWith({
        from: 'start-commit',
        to: 'end-commit',
        format: { hash: '%H', message: '%s', date: '%ad', author_name: '%an' },
        '--date': 'iso',
      });
      expect(gitService.extractTaskIdsFromCommitMessage).toHaveBeenCalledTimes(
        2
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_between_before',
        {
          startCommit: 'start-commit',
          endCommit: 'end-commit',
          timestamp: 'any',
        }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_between_after',
        {
          startCommit: 'start-commit',
          endCommit: 'end-commit',
          commits: expect.any(Array),
          success: true,
          timestamp: 'any',
        }
      );
    });

    test('コミットがない場合、空配列を返す', async () => {
      // Arrange
      const mockLog = { all: [], latest: null, total: 0 };
      mockGit.log.mockResolvedValue(mockLog);

      // Act
      const result = await gitService.getCommitsBetween(
        'start-commit',
        'end-commit'
      );

      // Assert
      expect(result).toEqual([]);
      expect(mockGit.log).toHaveBeenCalledWith(expect.any(Object));
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_between_after',
        {
          startCommit: 'start-commit',
          endCommit: 'end-commit',
          commits: [],
          success: true,
          timestamp: 'any',
        }
      );
    });

    test('エラーが発生した場合、GitErrorをスローし、エラー情報をログに出力する', async () => {
      // Arrange
      const error = new Error('Git log error');
      mockGit.log.mockRejectedValue(error);

      // Act & Assert
      await expect(
        gitService.getCommitsBetween('start', 'end')
      ).rejects.toThrow(GitError);
      expect(mockGit.log).toHaveBeenCalled();
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_between_before',
        { startCommit: 'start', endCommit: 'end', timestamp: 'any' }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_between_after',
        {
          startCommit: 'start',
          endCommit: 'end',
          success: false,
          error: error.message,
          timestamp: 'any',
        }
      );
    });
  });

  describe('getChangedFilesInCommit', () => {
    test('コミットで変更されたファイルを取得する', async () => {
      // Arrange
      const mockOutput =
        'A\tfile1.txt\nM\tfile2.js\nD\tfile3.md\nR100\told-file.txt\tnew-file.txt';
      mockGit.show.mockResolvedValue(mockOutput);

      // Act
      const result = await gitService.getChangedFilesInCommit('commit-hash');

      // Assert
      expect(result).toEqual([
        { status: 'added', path: 'file1.txt' },
        { status: 'modified', path: 'file2.js' },
        { status: 'deleted', path: 'file3.md' },
        { status: 'renamed', path: 'new-file.txt' },
      ]);
      expect(mockGit.show).toHaveBeenCalledWith([
        'commit-hash',
        '--name-status',
        '--format=',
      ]);
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_changed_files_before',
        { commitHash: 'commit-hash', timestamp: 'any' }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_changed_files_after',
        {
          commitHash: 'commit-hash',
          files: expect.any(Array),
          success: true,
          timestamp: 'any',
        }
      );
    });

    test('変更がない場合、空配列を返す', async () => {
      // Arrange
      mockGit.show.mockResolvedValue('');
      // Act
      const result = await gitService.getChangedFilesInCommit('commit-hash');
      // Assert
      expect(result).toEqual([]);
      expect(mockGit.show).toHaveBeenCalledWith([
        'commit-hash',
        '--name-status',
        '--format=',
      ]);
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_changed_files_after',
        {
          commitHash: 'commit-hash',
          files: [],
          success: true,
          timestamp: 'any',
        }
      );
    });

    test('エラーが発生した場合、GitErrorをスローし、エラー情報をログに出力する', async () => {
      // Arrange
      const error = new Error('Git show error');
      mockGit.show.mockRejectedValue(error);

      // Act & Assert
      await expect(gitService.getChangedFilesInCommit('hash')).rejects.toThrow(
        GitError
      );
      expect(mockGit.show).toHaveBeenCalled();
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_changed_files_before',
        { commitHash: 'hash', timestamp: 'any' }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_changed_files_after',
        {
          commitHash: 'hash',
          success: false,
          error: error.message,
          timestamp: 'any',
        }
      );
    });

    test('コピーされたファイル(C)や未知のステータスも正しく処理する', async () => {
      // Arrange
      const mockOutput = 'C100\tsrc/a.txt\tdst/a.txt\nX\tunknown.file'; // 改行を \n に修正
      mockGit.show.mockResolvedValue(mockOutput);

      // Act
      const result = await gitService.getChangedFilesInCommit('commit-hash');

      // Assert
      expect(result).toEqual([
        { status: 'copied', path: 'dst/a.txt' }, // コピー先ファイルパスが取得される
        { status: 'X', path: 'unknown.file' }, // 未知のステータスはそのまま返される
      ]);
      expect(mockGit.show).toHaveBeenCalledWith([
        'commit-hash',
        '--name-status',
        '--format=',
      ]);
    });
  });

  describe('getCommitDiffStats', () => {
    test('コミットの差分統計を取得する', async () => {
      // Arrange
      const mockFiles = [
        { status: 'added', path: 'file1.txt' },
        { status: 'modified', path: 'file2.js' },
      ];
      const mockNumstatOutput = '10\t5\tfile1.txt\n20\t10\tfile2.js';
      jest
        .spyOn(gitService, 'getChangedFilesInCommit')
        .mockResolvedValue(mockFiles);
      mockGit.show.mockResolvedValue(mockNumstatOutput);

      // Act
      const result = await gitService.getCommitDiffStats('commit-hash');

      // Assert
      expect(result).toEqual({
        files: mockFiles,
        lines_added: 30,
        lines_deleted: 15,
      });
      expect(gitService.getChangedFilesInCommit).toHaveBeenCalledWith(
        'commit-hash'
      );
      expect(mockGit.show).toHaveBeenCalledWith([
        'commit-hash',
        '--numstat',
        '--format=',
      ]);
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_diff_stats_before',
        { commitHash: 'commit-hash', timestamp: 'any' }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_diff_stats_after',
        {
          commitHash: 'commit-hash',
          stats: expect.any(Object),
          success: true,
          timestamp: 'any',
        }
      );
    });

    test('バイナリファイルを含む場合、正しく処理する', async () => {
      // Arrange
      const mockFiles = [
        { status: 'added', path: 'file1.txt' },
        { status: 'added', path: 'image.png' },
      ];
      const mockNumstatOutput = '10\t5\tfile1.txt\n-\t-\timage.png';
      jest
        .spyOn(gitService, 'getChangedFilesInCommit')
        .mockResolvedValue(mockFiles);
      mockGit.show.mockResolvedValue(mockNumstatOutput);

      // Act
      const result = await gitService.getCommitDiffStats('commit-hash');

      // Assert
      expect(result).toEqual({
        files: mockFiles,
        lines_added: 10,
        lines_deleted: 5,
      });
      expect(mockGit.show).toHaveBeenCalledWith([
        'commit-hash',
        '--numstat',
        '--format=',
      ]);
    });

    test('エラーが発生した場合、GitErrorをスローし、エラー情報をログに出力する', async () => {
      // Arrange
      const error = new Error('Git show numstat error');
      jest.spyOn(gitService, 'getChangedFilesInCommit').mockResolvedValue([]);
      mockGit.show.mockRejectedValue(error);

      // Act & Assert
      await expect(gitService.getCommitDiffStats('hash')).rejects.toThrow(
        GitError
      );
      expect(gitService.getChangedFilesInCommit).toHaveBeenCalledWith('hash');
      expect(mockGit.show).toHaveBeenCalledWith([
        'hash',
        '--numstat',
        '--format=',
      ]);
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_diff_stats_before',
        { commitHash: 'hash', timestamp: 'any' }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_diff_stats_after',
        {
          commitHash: 'hash',
          success: false,
          error: error.message,
          timestamp: 'any',
        }
      );
    });
  });

  describe('getBranches', () => {
    test('ブランチ一覧を取得する', async () => {
      // Arrange
      const mockBranchSummary = {
        all: ['main', 'develop', 'feature/test'],
        current: 'main',
      };
      mockGit.branchLocal.mockResolvedValue(mockBranchSummary);

      // Act
      const result = await gitService.getBranches();

      // Assert
      expect(result).toEqual(['main', 'develop', 'feature/test']);
      expect(mockGit.branchLocal).toHaveBeenCalled();
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'branch_get_all_before',
        { timestamp: 'any' }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'branch_get_all_after',
        { branches: expect.any(Array), success: true, timestamp: 'any' }
      );
    });

    test('ブランチがない場合、空配列を返す', async () => {
      // Arrange
      const mockBranchSummary = { all: [], current: '' };
      mockGit.branchLocal.mockResolvedValue(mockBranchSummary);
      // Act
      const result = await gitService.getBranches();
      // Assert
      expect(result).toEqual([]);
      expect(mockGit.branchLocal).toHaveBeenCalled();
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'branch_get_all_after',
        { branches: [], success: true, timestamp: 'any' }
      );
    });

    test('エラーが発生した場合、GitErrorをスローし、エラー情報をログに出力する', async () => {
      // Arrange
      const error = new Error('Git branch error');
      mockGit.branchLocal.mockRejectedValue(error);

      // Act & Assert
      await expect(gitService.getBranches()).rejects.toThrow(GitError);
      expect(mockGit.branchLocal).toHaveBeenCalled();
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'branch_get_all_before',
        { timestamp: 'any' }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'branch_get_all_after',
        { success: false, error: error.message, timestamp: 'any' }
      );
    });
  });

  describe('getCurrentBranch', () => {
    test('現在のブランチを取得する', async () => {
      // Arrange
      const mockBranchSummary = { all: ['main', 'develop'], current: 'main' };
      mockGit.branchLocal.mockResolvedValue(mockBranchSummary);

      // Act
      const result = await gitService.getCurrentBranch();

      // Assert
      expect(result).toBe('main');
      expect(mockGit.branchLocal).toHaveBeenCalled();
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'branch_get_current_before',
        { timestamp: 'any' }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'branch_get_current_after',
        { branch: 'main', success: true, timestamp: 'any' }
      );
    });

    test('エラーが発生した場合、GitErrorをスローし、エラー情報をログに出力する', async () => {
      // Arrange
      const error = new Error('Git branch current error');
      mockGit.branchLocal.mockRejectedValue(error);

      // Act & Assert
      await expect(gitService.getCurrentBranch()).rejects.toThrow(GitError);
      expect(mockGit.branchLocal).toHaveBeenCalled();
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'branch_get_current_before',
        { timestamp: 'any' }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'branch_get_current_after',
        { success: false, error: error.message, timestamp: 'any' }
      );
    });
  });

  describe('getCommitHistory', () => {
    test('コミット履歴を取得する', async () => {
      // Arrange
      const mockLog = {
        all: [
          {
            hash: 'abc123',
            message: 'Fix bug #T001',
            date: '2025-03-20T10:00:00+09:00',
            author_name: 'User1',
          },
          {
            hash: 'def456',
            message: 'Implement feature #T002',
            date: '2025-03-21T11:00:00+09:00',
            author_name: 'User2',
          },
        ],
        latest: { hash: 'def456' },
        total: 2,
      };
      mockGit.log.mockResolvedValue(mockLog);
      jest
        .spyOn(gitService, 'extractTaskIdsFromCommitMessage')
        .mockReturnValueOnce(['T001'])
        .mockReturnValueOnce(['T002']);

      // Act
      const result = await gitService.getCommitHistory(2);

      // Assert
      expect(result).toEqual([
        {
          hash: 'abc123',
          message: 'Fix bug #T001',
          timestamp: '2025-03-20T10:00:00+09:00',
          author: 'User1',
          related_tasks: ['T001'],
        },
        {
          hash: 'def456',
          message: 'Implement feature #T002',
          timestamp: '2025-03-21T11:00:00+09:00',
          author: 'User2',
          related_tasks: ['T002'],
        },
      ]);
      expect(mockGit.log).toHaveBeenCalledWith({
        n: 2,
        format: { hash: '%H', message: '%s', date: '%ad', author_name: '%an' },
        '--date': 'iso',
      });
      expect(gitService.extractTaskIdsFromCommitMessage).toHaveBeenCalledTimes(
        2
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_history_before',
        { limit: 2, timestamp: 'any' }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_history_after',
        {
          limit: 2,
          commits: expect.any(Array),
          success: true,
          timestamp: 'any',
        }
      );
    });

    test('デフォルトのlimitを使用する', async () => {
      // Arrange
      const mockLog = { all: [], latest: null, total: 0 };
      mockGit.log.mockResolvedValue(mockLog);
      // Act
      await gitService.getCommitHistory();
      // Assert
      expect(mockGit.log).toHaveBeenCalledWith(
        expect.objectContaining({ n: 10 })
      );
    });

    test('エラーが発生した場合、GitErrorをスローし、エラー情報をログに出力する', async () => {
      // Arrange
      const error = new Error('Git log history error');
      mockGit.log.mockRejectedValue(error);

      // Act & Assert
      await expect(gitService.getCommitHistory(5)).rejects.toThrow(GitError);
      expect(mockGit.log).toHaveBeenCalled();
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_history_before',
        { limit: 5, timestamp: 'any' }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_history_after',
        { limit: 5, success: false, error: error.message, timestamp: 'any' }
      );
    });
  });

  describe('getFileHistory', () => {
    test('ファイルの変更履歴を取得する', async () => {
      // Arrange
      const mockLog = {
        all: [
          {
            hash: 'abc123',
            message: 'Fix bug #T001',
            date: '2025-03-20T10:00:00+09:00',
            author_name: 'User1',
          },
        ],
        latest: { hash: 'abc123' },
        total: 1,
      };
      mockGit.log.mockResolvedValue(mockLog);
      jest
        .spyOn(gitService, 'extractTaskIdsFromCommitMessage')
        .mockReturnValue(['T001']);

      // Act
      const result = await gitService.getFileHistory('path/to/file.js', 1);

      // Assert
      expect(result).toEqual([
        {
          hash: 'abc123',
          message: 'Fix bug #T001',
          timestamp: '2025-03-20T10:00:00+09:00',
          author: 'User1',
          related_tasks: ['T001'],
        },
      ]);
      expect(mockGit.log).toHaveBeenCalledWith({
        file: 'path/to/file.js',
        n: 1,
        format: { hash: '%H', message: '%s', date: '%ad', author_name: '%an' },
        '--date': 'iso',
      });
      expect(gitService.extractTaskIdsFromCommitMessage).toHaveBeenCalledTimes(
        1
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'file_get_history_before',
        { filePath: 'path/to/file.js', limit: 1, timestamp: 'any' }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'file_get_history_after',
        {
          filePath: 'path/to/file.js',
          limit: 1,
          commits: expect.any(Array),
          success: true,
          timestamp: 'any',
        }
      );
    });

    test('履歴がない場合、空配列を返す', async () => {
      // Arrange
      const mockLog = { all: [], latest: null, total: 0 };
      mockGit.log.mockResolvedValue(mockLog);
      // Act
      const result = await gitService.getFileHistory('path/to/file.js');
      // Assert
      expect(result).toEqual([]);
      expect(mockGit.log).toHaveBeenCalledWith(
        expect.objectContaining({ file: 'path/to/file.js' })
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'file_get_history_after',
        {
          filePath: 'path/to/file.js',
          limit: 10,
          commits: [],
          success: true,
          timestamp: 'any',
        }
      );
    });

    test('エラーが発生した場合、GitErrorをスローし、エラー情報をログに出力する', async () => {
      // Arrange
      const error = new Error('Git log file error');
      mockGit.log.mockRejectedValue(error);

      // Act & Assert
      await expect(
        gitService.getFileHistory('path/to/file.js')
      ).rejects.toThrow(GitError);
      expect(mockGit.log).toHaveBeenCalled();
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'file_get_history_before',
        { filePath: 'path/to/file.js', limit: 10, timestamp: 'any' }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'file_get_history_after',
        {
          filePath: 'path/to/file.js',
          limit: 10,
          success: false,
          error: error.message,
          timestamp: 'any',
        }
      );
    });
  });

  describe('getCommitDetails', () => {
    test('コミットの詳細情報を取得する', async () => {
      // Arrange
      const mockLog = {
        latest: {
          hash: 'abc123',
          message: 'Commit message with #T001\n',
          author_name: 'User1',
          author_email: 'user1@example.com',
          author_date: '2025-03-20T10:00:00+09:00',
          committer_name: 'User1',
          committer_email: 'user1@example.com',
          committer_date: '2025-03-20T10:00:00+09:00',
          parents: 'parent1 parent2',
        },
        all: [],
        total: 1,
      };
      const mockStats = {
        files: [{ status: 'added', path: 'file1.txt' }],
        lines_added: 10,
        lines_deleted: 5,
      };
      mockGit.log.mockResolvedValue(mockLog);
      jest.spyOn(gitService, 'getCommitDiffStats').mockResolvedValue(mockStats);
      jest
        .spyOn(gitService, 'extractTaskIdsFromCommitMessage')
        .mockReturnValue(['T001']);

      // Act
      const result = await gitService.getCommitDetails('abc123');

      // Assert
      expect(result).toEqual({
        hash: 'abc123',
        message: 'Commit message with #T001',
        author: {
          name: 'User1',
          email: 'user1@example.com',
          date: '2025-03-20T10:00:00+09:00',
        },
        committer: {
          name: 'User1',
          email: 'user1@example.com',
          date: '2025-03-20T10:00:00+09:00',
        },
        parents: ['parent1', 'parent2'],
        files: mockStats.files,
        stats: { lines_added: 10, lines_deleted: 5, files_changed: 1 },
        related_tasks: ['T001'],
      });
      expect(mockGit.log).toHaveBeenCalledWith({
        format: expect.any(Object),
        n: 1,
        abc123: null,
      });
      expect(gitService.getCommitDiffStats).toHaveBeenCalledWith('abc123');
      expect(gitService.extractTaskIdsFromCommitMessage).toHaveBeenCalledWith(
        'Commit message with #T001\n'
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_details_before',
        { commitHash: 'abc123', timestamp: 'any' }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_details_after',
        {
          commitHash: 'abc123',
          details: expect.any(Object),
          success: true,
          timestamp: 'any',
        }
      );
    });

    test('コミットが見つからない場合、GitErrorをスローし、エラー情報をログに出力する', async () => {
      // Arrange
      const mockLog = { latest: null, all: [], total: 0 };
      mockGit.log.mockResolvedValue(mockLog);

      // Act & Assert
      await expect(gitService.getCommitDetails('unknown-hash')).rejects.toThrow(
        GitError
      );
      expect(mockGit.log).toHaveBeenCalled();
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_details_before',
        { commitHash: 'unknown-hash', timestamp: 'any' }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_details_after',
        {
          commitHash: 'unknown-hash',
          details: null,
          success: false,
          error: 'Commit info not found',
          timestamp: 'any',
        }
      );
    });

    test('エラーが発生した場合、GitErrorをスローし、エラー情報をログに出力する', async () => {
      // Arrange
      const error = new Error('Git log details error');
      mockGit.log.mockRejectedValue(error);

      // Act & Assert
      await expect(gitService.getCommitDetails('hash')).rejects.toThrow(
        GitError
      );
      expect(mockGit.log).toHaveBeenCalled();
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_details_before',
        { commitHash: 'hash', timestamp: 'any' }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_details_after',
        {
          commitHash: 'hash',
          success: false,
          error: error.message,
          timestamp: 'any',
        }
      );
    });
  });

  describe('stageFiles', () => {
    test('ファイルをステージする', async () => {
      // Arrange
      mockGit.add.mockResolvedValue(undefined);
      // Act
      const result = await gitService.stageFiles(['file1.txt', 'file2.js']);
      // Assert
      expect(result).toBe(true);
      expect(mockGit.add).toHaveBeenCalledWith(['file1.txt', 'file2.js']);
      expectStandardizedEventEmitted(mockEventEmitter, 'git', 'stage_before', {
        files: ['file1.txt', 'file2.js'],
        timestamp: 'any',
      });
      expectStandardizedEventEmitted(mockEventEmitter, 'git', 'stage_after', {
        files: ['file1.txt', 'file2.js'],
        success: true,
        timestamp: 'any',
      });
    });

    test('エラーが発生した場合、GitErrorをスローし、エラー情報をログに出力する', async () => {
      // Arrange
      const error = new Error('Git add error');
      mockGit.add.mockRejectedValue(error);

      // Act & Assert
      await expect(gitService.stageFiles('file.txt')).rejects.toThrow(GitError);
      expect(mockGit.add).toHaveBeenCalledWith('file.txt');
      expectStandardizedEventEmitted(mockEventEmitter, 'git', 'stage_before', {
        files: 'file.txt',
        timestamp: 'any',
      });
      expectStandardizedEventEmitted(mockEventEmitter, 'git', 'stage_after', {
        files: 'file.txt',
        success: false,
        error: error.message,
        timestamp: 'any',
      });
    });
  });

  describe('createCommit', () => {
    test('コミットを作成する', async () => {
      // Arrange
      const mockCommitSummary = { commit: 'new-commit-hash' };
      mockGit.commit.mockResolvedValue(mockCommitSummary);

      // Act
      const result = await gitService.createCommit('Test commit message');

      // Assert
      expect(result).toBe('new-commit-hash');
      expect(mockGit.commit).toHaveBeenCalledWith('Test commit message');
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_create_before',
        { message: 'Test commit message', timestamp: 'any' }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_create_after',
        {
          message: 'Test commit message',
          hash: 'new-commit-hash',
          success: true,
          timestamp: 'any',
        }
      );
    });

    test('コミットメッセージが空の場合、GitErrorをスローし、エラー情報をログに出力する', async () => {
      // Act & Assert
      await expect(gitService.createCommit('')).rejects.toThrow(GitError);
      expect(mockGit.commit).not.toHaveBeenCalled();
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_create_after',
        {
          message: '',
          success: false,
          error: 'コミットメッセージが空です',
          timestamp: 'any',
        }
      );
    });

    test('エラーが発生した場合、GitErrorをスローし、エラー情報をログに出力する', async () => {
      // Arrange
      const error = new Error('Git commit error');
      mockGit.commit.mockRejectedValue(error);

      // Act & Assert
      await expect(gitService.createCommit('message')).rejects.toThrow(
        GitError
      );
      expect(mockGit.commit).toHaveBeenCalledWith('message');
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_create_before',
        { message: 'message', timestamp: 'any' }
      );
      // エラー時の after イベントは _handleError 内で発行される
    });
  });

  describe('_emitEvent (Error Handling)', () => {
    test('イベント発行中にエラーが発生した場合、警告ログを出力する', async () => {
      // Arrange
      const emitError = new Error('ID generation failed');
      // IDジェネレーターがエラーをスローするようにモック
      // 注意: beforeEach で設定したモックを上書きするため、テストケース内で再定義
      const mockErrorHandler = { handle: jest.fn((err) => err) };
      gitService = new GitService({
        repoPath: '/test/repo/path',
        logger: mockLogger,
        eventEmitter: mockEventEmitter,
        errorHandler: mockErrorHandler,
      });
      gitService._traceIdGenerator = jest.fn().mockImplementation(() => {
        throw emitError;
      });
      mockGit.revparse.mockResolvedValue('some-hash'); // getCurrentCommitHash が正常に完了するように

      // Act
      await gitService.getCurrentCommitHash(); // _emitEvent を呼び出すメソッドを実行

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `イベント発行中にエラーが発生しました: git:commit_get_hash_before`,
        emitError
      );
      // エラーは _emitEvent 内でキャッチされるため、getCurrentCommitHash は正常に完了するはず
      expect(mockGit.revparse).toHaveBeenCalled();
    });
  });
});
