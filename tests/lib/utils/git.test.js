/**
 * Gitサービスのテスト
 */

const GitService = require('../../../src/lib/utils/git');

// child_processのモック
jest.mock('child_process');

describe('GitService', () => {
  let gitService;
  let mockLogger;
  let mockEventEmitter;
  let mockErrorHandler;
  let execSync;

  beforeEach(() => {
    // モックのリセット
    jest.clearAllMocks();
    
    // execSyncのモックを取得
    execSync = require('child_process').execSync;
    
    // モックロガー
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };
    
    // モックイベントエミッター
    mockEventEmitter = {
      emit: jest.fn(),
      emitStandardized: jest.fn()
    };
    
    // モックエラーハンドラー
    mockErrorHandler = {
      handle: jest.fn()
    };
    
    // GitServiceのインスタンス作成
    gitService = new GitService({
      repoPath: '/test/repo/path',
      logger: mockLogger,
      eventEmitter: mockEventEmitter,
      errorHandler: mockErrorHandler
    });
  });

  describe('_executeCommand', () => {
    test('コマンドを正常に実行する', () => {
      // execSyncの戻り値を設定
      execSync.mockReturnValue('command output');
      
      const result = gitService._executeCommand('git status');
      
      expect(result).toBe('command output');
      expect(execSync).toHaveBeenCalledWith('git status', {
        cwd: '/test/repo/path',
        encoding: 'utf8'
      });
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('git:command:execute:before', expect.objectContaining({
        command: 'git status'
      }));
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('git:command:execute:after', expect.objectContaining({
        command: 'git status',
        success: true
      }));
    });

    test('コマンド実行時にエラーが発生した場合、エラーハンドラーを呼び出す', () => {
      // execSyncでエラーをスロー
      const error = new Error('コマンド実行エラー');
      execSync.mockImplementation(() => {
        throw error;
      });
      
      // エラーハンドラーの戻り値を設定
      mockErrorHandler.handle.mockReturnValue('');
      
      const result = gitService._executeCommand('git status');
      
      expect(result).toBe('');
      expect(execSync).toHaveBeenCalledWith('git status', {
        cwd: '/test/repo/path',
        encoding: 'utf8'
      });
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('git:command:execute:before', expect.objectContaining({
        command: 'git status'
      }));
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('git:command:execute:after', expect.objectContaining({
        command: 'git status',
        success: false,
        error
      }));
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'GitError',
          message: expect.stringContaining('コマンド実行に失敗しました'),
          cause: error
        }),
        'GitService',
        '_executeCommand',
        expect.objectContaining({
          additionalContext: expect.objectContaining({
            command: 'git status',
            operation: '_executeCommand'
          })
        })
      );
    });
  });

  describe('getCurrentCommitHash', () => {
    test('現在のコミットハッシュを取得する', () => {
      // _executeCommandをモック
      const mockHash = 'abcdef1234567890';
      jest.spyOn(gitService, '_executeCommand').mockReturnValue(mockHash);
      
      const result = gitService.getCurrentCommitHash();
      
      expect(result).toBe(mockHash);
      expect(gitService._executeCommand).toHaveBeenCalledWith('git rev-parse HEAD');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('git:commit:get_hash:before', expect.any(Object));
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('git:commit:get_hash:after', expect.objectContaining({
        hash: mockHash,
        success: true
      }));
    });

    test('エラーが発生した場合、エラーハンドラーを呼び出す', () => {
      // _executeCommandでエラーをスロー
      const error = new Error('コミットハッシュ取得エラー');
      jest.spyOn(gitService, '_executeCommand').mockImplementation(() => {
        throw error;
      });
      
      // エラーハンドラーの戻り値を設定
      mockErrorHandler.handle.mockReturnValue('');
      
      const result = gitService.getCurrentCommitHash();
      
      expect(result).toBe('');
      expect(gitService._executeCommand).toHaveBeenCalledWith('git rev-parse HEAD');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('git:commit:get_hash:before', expect.any(Object));
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('git:commit:get_hash:after', expect.objectContaining({
        success: false,
        error
      }));
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'GitError',
          message: 'コミットハッシュの取得に失敗しました',
          cause: error
        }),
        'GitService',
        'getCurrentCommitHash',
        expect.objectContaining({
          additionalContext: expect.objectContaining({
            operation: 'getCurrentCommitHash'
          })
        })
      );
    });
  });

  describe('extractTaskIdsFromCommitMessage', () => {
    test('コミットメッセージからタスクIDを抽出する', () => {
      const message = 'Fix bug #T001 and implement feature #T002';
      
      const result = gitService.extractTaskIdsFromCommitMessage(message);
      
      expect(result).toEqual(['T001', 'T002']);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('git:commit:extract_task_ids:before', expect.objectContaining({
        message
      }));
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('git:commit:extract_task_ids:after', expect.objectContaining({
        message,
        taskIds: ['T001', 'T002'],
        success: true
      }));
    });

    test('タスクIDがない場合、空配列を返す', () => {
      const message = 'Fix bug and implement feature';
      
      const result = gitService.extractTaskIdsFromCommitMessage(message);
      
      expect(result).toEqual([]);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('git:commit:extract_task_ids:before', expect.objectContaining({
        message
      }));
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('git:commit:extract_task_ids:after', expect.objectContaining({
        message,
        taskIds: [],
        success: true
      }));
    });

    test('エラーが発生した場合、エラーハンドラーを呼び出す', () => {
      // messageをnullにしてエラーを発生させる
      const message = null;
      
      // エラーハンドラーの戻り値を設定
      mockErrorHandler.handle.mockReturnValue([]);
      
      const result = gitService.extractTaskIdsFromCommitMessage(message);
      
      expect(result).toEqual([]);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('git:commit:extract_task_ids:before', expect.objectContaining({
        message
      }));
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('git:commit:extract_task_ids:after', expect.objectContaining({
        message,
        success: false,
        error: expect.any(Error)
      }));
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'GitError',
          message: 'タスクIDの抽出に失敗しました'
        }),
        'GitService',
        'extractTaskIdsFromCommitMessage',
        expect.objectContaining({
          additionalContext: expect.objectContaining({
            message,
            operation: 'extractTaskIdsFromCommitMessage'
          })
        })
      );
    });
  });

  describe('getCommitsBetween', () => {
    test('コミット間のコミット情報を取得する', () => {
      // _executeCommandをモック
      const mockOutput = 'abc123|Fix bug #T001|2025-03-20T10:00:00+09:00|User1\ndef456|Implement feature #T002|2025-03-21T11:00:00+09:00|User2';
      jest.spyOn(gitService, '_executeCommand').mockReturnValue(mockOutput);
      
      // extractTaskIdsFromCommitMessageをモック
      jest.spyOn(gitService, 'extractTaskIdsFromCommitMessage')
        .mockReturnValueOnce(['T001'])
        .mockReturnValueOnce(['T002']);
      
      const result = gitService.getCommitsBetween('start-commit', 'end-commit');
      
      expect(result).toEqual([
        {
          hash: 'abc123',
          message: 'Fix bug #T001',
          timestamp: '2025-03-20T10:00:00+09:00',
          author: 'User1',
          related_tasks: ['T001']
        },
        {
          hash: 'def456',
          message: 'Implement feature #T002',
          timestamp: '2025-03-21T11:00:00+09:00',
          author: 'User2',
          related_tasks: ['T002']
        }
      ]);
      expect(gitService._executeCommand).toHaveBeenCalledWith('git log start-commit..end-commit --pretty=format:"%H|%s|%ai|%an"');
      expect(gitService.extractTaskIdsFromCommitMessage).toHaveBeenCalledWith('Fix bug #T001');
      expect(gitService.extractTaskIdsFromCommitMessage).toHaveBeenCalledWith('Implement feature #T002');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('git:commit:get_between:before', expect.objectContaining({
        startCommit: 'start-commit',
        endCommit: 'end-commit'
      }));
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('git:commit:get_between:after', expect.objectContaining({
        startCommit: 'start-commit',
        endCommit: 'end-commit',
        commits: expect.any(Array),
        success: true
      }));
    });

    test('出力が空の場合、空配列を返す', () => {
      // _executeCommandをモック
      jest.spyOn(gitService, '_executeCommand').mockReturnValue('');
      
      const result = gitService.getCommitsBetween('start-commit', 'end-commit');
      
      expect(result).toEqual([]);
      expect(gitService._executeCommand).toHaveBeenCalledWith('git log start-commit..end-commit --pretty=format:"%H|%s|%ai|%an"');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('git:commit:get_between:before', expect.objectContaining({
        startCommit: 'start-commit',
        endCommit: 'end-commit'
      }));
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('git:commit:get_between:after', expect.objectContaining({
        startCommit: 'start-commit',
        endCommit: 'end-commit',
        commits: [],
        success: true
      }));
    });
  });

  describe('getChangedFilesInCommit', () => {
    test('コミットで変更されたファイルを取得する', () => {
      // _executeCommandをモック
      const mockOutput = 'A\tfile1.txt\nM\tfile2.js\nD\tfile3.md\nR100\told-file.txt\tnew-file.txt';
      jest.spyOn(gitService, '_executeCommand').mockReturnValue(mockOutput);
      
      const result = gitService.getChangedFilesInCommit('commit-hash');
      
      expect(result).toEqual([
        { status: 'added', path: 'file1.txt' },
        { status: 'modified', path: 'file2.js' },
        { status: 'deleted', path: 'file3.md' },
        { status: 'renamed', path: 'new-file.txt', previous_path: 'old-file.txt' }
      ]);
      expect(gitService._executeCommand).toHaveBeenCalledWith('git show --name-status --format="" commit-hash');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('git:commit:get_changed_files:before', expect.objectContaining({
        commitHash: 'commit-hash'
      }));
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('git:commit:get_changed_files:after', expect.objectContaining({
        commitHash: 'commit-hash',
        files: expect.any(Array),
        success: true
      }));
    });

    test('出力が空の場合、空配列を返す', () => {
      // _executeCommandをモック
      jest.spyOn(gitService, '_executeCommand').mockReturnValue('');
      
      const result = gitService.getChangedFilesInCommit('commit-hash');
      
      expect(result).toEqual([]);
      expect(gitService._executeCommand).toHaveBeenCalledWith('git show --name-status --format="" commit-hash');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('git:commit:get_changed_files:before', expect.objectContaining({
        commitHash: 'commit-hash'
      }));
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('git:commit:get_changed_files:after', expect.objectContaining({
        commitHash: 'commit-hash',
        files: [],
        success: true
      }));
    });
  });

  describe('getCommitDiffStats', () => {
    test('コミットの差分統計を取得する', () => {
      // getChangedFilesInCommitをモック
      const mockFiles = [
        { status: 'added', path: 'file1.txt' },
        { status: 'modified', path: 'file2.js' }
      ];
      jest.spyOn(gitService, 'getChangedFilesInCommit').mockReturnValue(mockFiles);
      
      // _executeCommandをモック
      const mockOutput = '10\t5\tfile1.txt\n20\t10\tfile2.js';
      jest.spyOn(gitService, '_executeCommand').mockReturnValue(mockOutput);
      
      const result = gitService.getCommitDiffStats('commit-hash');
      
      expect(result).toEqual({
        files: mockFiles,
        lines_added: 30,
        lines_deleted: 15
      });
      expect(gitService.getChangedFilesInCommit).toHaveBeenCalledWith('commit-hash');
      expect(gitService._executeCommand).toHaveBeenCalledWith('git show --numstat --format="" commit-hash');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('git:commit:get_diff_stats:before', expect.objectContaining({
        commitHash: 'commit-hash'
      }));
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('git:commit:get_diff_stats:after', expect.objectContaining({
        commitHash: 'commit-hash',
        stats: expect.any(Object),
        success: true
      }));
    });

    test('バイナリファイルを含む場合、正しく処理する', () => {
      // getChangedFilesInCommitをモック
      const mockFiles = [
        { status: 'added', path: 'file1.txt' },
        { status: 'added', path: 'image.png' }
      ];
      jest.spyOn(gitService, 'getChangedFilesInCommit').mockReturnValue(mockFiles);
      
      // _executeCommandをモック
      const mockOutput = '10\t5\tfile1.txt\n-\t-\timage.png';
      jest.spyOn(gitService, '_executeCommand').mockReturnValue(mockOutput);
      
      const result = gitService.getCommitDiffStats('commit-hash');
      
      expect(result).toEqual({
        files: mockFiles,
        lines_added: 10,
        lines_deleted: 5
      });
      expect(gitService.getChangedFilesInCommit).toHaveBeenCalledWith('commit-hash');
      expect(gitService._executeCommand).toHaveBeenCalledWith('git show --numstat --format="" commit-hash');
    });
  });

  describe('getBranches', () => {
    test('ブランチ一覧を取得する', () => {
      // _executeCommandをモック
      const mockOutput = '* main\n  develop\n  feature/test';
      jest.spyOn(gitService, '_executeCommand').mockReturnValue(mockOutput);
      
      const result = gitService.getBranches();
      
      expect(result).toEqual(['main', 'develop', 'feature/test']);
      expect(gitService._executeCommand).toHaveBeenCalledWith('git branch');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('git:branch:get_all:before', expect.any(Object));
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('git:branch:get_all:after', expect.objectContaining({
        branches: ['main', 'develop', 'feature/test'],
        success: true
      }));
    });

    test('出力が空の場合、空配列を返す', () => {
      // _executeCommandをモック
      jest.spyOn(gitService, '_executeCommand').mockReturnValue('');
      
      const result = gitService.getBranches();
      
      expect(result).toEqual([]);
      expect(gitService._executeCommand).toHaveBeenCalledWith('git branch');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('git:branch:get_all:before', expect.any(Object));
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('git:branch:get_all:after', expect.objectContaining({
        branches: [],
        success: true
      }));
    });
  });

  describe('getCurrentBranch', () => {
    test('現在のブランチを取得する', () => {
      // _executeCommandをモック
      const mockBranch = 'main';
      jest.spyOn(gitService, '_executeCommand').mockReturnValue(mockBranch);
      
      const result = gitService.getCurrentBranch();
      
      expect(result).toBe(mockBranch);
      expect(gitService._executeCommand).toHaveBeenCalledWith('git branch --show-current');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('git:branch:get_current:before', expect.any(Object));
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('git:branch:get_current:after', expect.objectContaining({
        branch: mockBranch,
        success: true
      }));
    });
  });

  describe('getCommitHistory', () => {
    test('コミット履歴を取得する', () => {
      // _executeCommandをモック
      const mockOutput = 'abc123|Fix bug #T001|2025-03-20T10:00:00+09:00|User1\ndef456|Implement feature #T002|2025-03-21T11:00:00+09:00|User2';
      jest.spyOn(gitService, '_executeCommand').mockReturnValue(mockOutput);
      
      // extractTaskIdsFromCommitMessageをモック
      jest.spyOn(gitService, 'extractTaskIdsFromCommitMessage')
        .mockReturnValueOnce(['T001'])
        .mockReturnValueOnce(['T002']);
      
      const result = gitService.getCommitHistory(2);
      
      expect(result).toEqual([
        {
          hash: 'abc123',
          message: 'Fix bug #T001',
          timestamp: '2025-03-20T10:00:00+09:00',
          author: 'User1',
          related_tasks: ['T001']
        },
        {
          hash: 'def456',
          message: 'Implement feature #T002',
          timestamp: '2025-03-21T11:00:00+09:00',
          author: 'User2',
          related_tasks: ['T002']
        }
      ]);
      expect(gitService._executeCommand).toHaveBeenCalledWith('git log -2 --pretty=format:"%H|%s|%ai|%an"');
      expect(gitService.extractTaskIdsFromCommitMessage).toHaveBeenCalledWith('Fix bug #T001');
      expect(gitService.extractTaskIdsFromCommitMessage).toHaveBeenCalledWith('Implement feature #T002');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('git:commit:get_history:before', expect.objectContaining({
        limit: 2
      }));
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('git:commit:get_history:after', expect.objectContaining({
        limit: 2,
        commits: expect.any(Array),
        success: true
      }));
    });

    test('デフォルトのlimitを使用する', () => {
      // _executeCommandをモック
      jest.spyOn(gitService, '_executeCommand').mockReturnValue('');
      
      gitService.getCommitHistory();
      
      expect(gitService._executeCommand).toHaveBeenCalledWith('git log -10 --pretty=format:"%H|%s|%ai|%an"');
    });
  });

  describe('getFileHistory', () => {
    test('ファイルの変更履歴を取得する', () => {
      // _executeCommandをモック
      const mockOutput = 'abc123|Fix bug #T001|2025-03-20T10:00:00+09:00|User1\ndef456|Implement feature #T002|2025-03-21T11:00:00+09:00|User2';
      jest.spyOn(gitService, '_executeCommand').mockReturnValue(mockOutput);
      
      // extractTaskIdsFromCommitMessageをモック
      jest.spyOn(gitService, 'extractTaskIdsFromCommitMessage')
        .mockReturnValueOnce(['T001'])
        .mockReturnValueOnce(['T002']);
      
      const result = gitService.getFileHistory('path/to/file.js', 2);
      
      expect(result).toEqual([
        {
          hash: 'abc123',
          message: 'Fix bug #T001',
          timestamp: '2025-03-20T10:00:00+09:00',
          author: 'User1',
          related_tasks: ['T001']
        },
        {
          hash: 'def456',
          message: 'Implement feature #T002',
          timestamp: '2025-03-21T11:00:00+09:00',
          author: 'User2',
          related_tasks: ['T002']
        }
      ]);
      expect(gitService._executeCommand).toHaveBeenCalledWith('git log -2 --pretty=format:"%H|%s|%ai|%an" -- "path/to/file.js"');
      expect(gitService.extractTaskIdsFromCommitMessage).toHaveBeenCalledWith('Fix bug #T001');
      expect(gitService.extractTaskIdsFromCommitMessage).toHaveBeenCalledWith('Implement feature #T002');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('git:file:get_history:before', expect.objectContaining({
        filePath: 'path/to/file.js',
        limit: 2
      }));
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('git:file:get_history:after', expect.objectContaining({
        filePath: 'path/to/file.js',
        limit: 2,
        commits: expect.any(Array),
        success: true
      }));
    });
  });

  describe('getCommitDetails', () => {
    test('コミットの詳細情報を取得する', () => {
      // _executeCommandをモック
      jest.spyOn(gitService, '_executeCommand')
        .mockReturnValueOnce('Commit message with #T001') // messageCommand
        .mockReturnValueOnce('abc123|User1|user1@example.com|2025-03-20T10:00:00+09:00|User1|user1@example.com|2025-03-20T10:00:00+09:00|parent1 parent2'); // infoCommand
      
      // getCommitDiffStatsをモック
      jest.spyOn(gitService, 'getCommitDiffStats').mockReturnValue({
        files: [
          { status: 'added', path: 'file1.txt' },
          { status: 'modified', path: 'file2.js' }
        ],
        lines_added: 30,
        lines_deleted: 15
      });
      
      // extractTaskIdsFromCommitMessageをモック
      jest.spyOn(gitService, 'extractTaskIdsFromCommitMessage').mockReturnValue(['T001']);
      
      const result = gitService.getCommitDetails('commit-hash');
      
      expect(result).toEqual({
        hash: 'abc123',
        message: 'Commit message with #T001',
        author: {
          name: 'User1',
          email: 'user1@example.com',
          date: '2025-03-20T10:00:00+09:00'
        },
        committer: {
          name: 'User1',
          email: 'user1@example.com',
          date: '2025-03-20T10:00:00+09:00'
        },
        parents: ['parent1', 'parent2'],
        files: [
          { status: 'added', path: 'file1.txt' },
          { status: 'modified', path: 'file2.js' }
        ],
        stats: {
          lines_added: 30,
          lines_deleted: 15,
          files_changed: 2
        },
        related_tasks: ['T001']
      });
      expect(gitService._executeCommand).toHaveBeenCalledWith('git show -s --format="%B" commit-hash');
      expect(gitService._executeCommand).toHaveBeenCalledWith('git show -s --format="%H|%an|%ae|%ai|%cn|%ce|%ci|%P" commit-hash');
      expect(gitService.getCommitDiffStats).toHaveBeenCalledWith('commit-hash');
      expect(gitService.extractTaskIdsFromCommitMessage).toHaveBeenCalledWith('Commit message with #T001');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('git:commit:get_details:before', expect.objectContaining({
        commitHash: 'commit-hash'
      }));
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('git:commit:get_details:after', expect.objectContaining({
        commitHash: 'commit-hash',
        details: expect.any(Object),
        success: true
      }));
    });
  });

  describe('_emitEvent', () => {
    test('標準化されたイベント発行メソッドがある場合、それを使用する', () => {
      // 標準化されたイベント発行メソッドを持つイベントエミッター
      const mockStandardizedEventEmitter = {
        emitStandardized: jest.fn(),
        emit: jest.fn()
      };
      
      // GitServiceのインスタンス作成
      const gitServiceWithStandardized = new GitService({
        repoPath: '/test/repo/path',
        logger: mockLogger,
        eventEmitter: mockStandardizedEventEmitter,
        errorHandler: mockErrorHandler
      });
      
      // イベント発行
      gitServiceWithStandardized._emitEvent('commit:get_hash', { hash: 'abc123' });
      
      expect(mockStandardizedEventEmitter.emitStandardized).toHaveBeenCalledWith(
        'git',
        'commit:get_hash',
        expect.objectContaining({
          hash: 'abc123',
          timestamp: expect.any(String)
        })
      );
      expect(mockStandardizedEventEmitter.emit).not.toHaveBeenCalled();
    });

    test('標準化されたイベント発行メソッドがない場合、従来のイベント発行を使用する', () => {
      // 従来のイベント発行メソッドのみを持つイベントエミッター
      const mockLegacyEventEmitter = {
        emit: jest.fn()
      };
      
      // GitServiceのインスタンス作成
      const gitServiceWithLegacy = new GitService({
        repoPath: '/test/repo/path',
        logger: mockLogger,
        eventEmitter: mockLegacyEventEmitter,
        errorHandler: mockErrorHandler
      });
      
      // イベント発行
      gitServiceWithLegacy._emitEvent('commit:get_hash', { hash: 'abc123' });
      
      expect(mockLegacyEventEmitter.emit).toHaveBeenCalledWith(
        'git:commit:get_hash',
        expect.objectContaining({
          hash: 'abc123',
          timestamp: expect.any(String)
        })
      );
    });
  });

  describe('_handleError', () => {
    test('エラーハンドラーがある場合、それを使用する', () => {
      // エラーハンドラーの戻り値を設定
      mockErrorHandler.handle.mockReturnValue('');
      
      const error = new Error('テストエラー');
      const context = { commitHash: 'abc123', operation: 'getCurrentCommitHash' };
      
      const result = gitService._handleError('エラーメッセージ', error, context);
      
      expect(result).toBe('');
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'GitError',
          message: 'エラーメッセージ',
          cause: error
        }),
        'GitService',
        'getCurrentCommitHash',
        expect.objectContaining({
          additionalContext: context
        })
      );
    });

    test('エラーハンドラーがない場合、ロガーを使用する', () => {
      // エラーハンドラーなしのGitService
      const gitServiceWithoutHandler = new GitService({
        repoPath: '/test/repo/path',
        logger: mockLogger,
        eventEmitter: mockEventEmitter
      });
      
      const error = new Error('テストエラー');
      const context = { commitHash: 'abc123', operation: 'getCurrentCommitHash' };
      
      const result = gitServiceWithoutHandler._handleError('エラーメッセージ', error, context);
      
      expect(result).toBe('');
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[GitService] エラーメッセージ:',
        expect.objectContaining({
          error_name: 'Error',
          error_message: 'テストエラー',
          stack: error.stack,
          context
        })
      );
    });

    test('操作に応じて適切なデフォルト値を返す', () => {
      // エラーハンドラーなしのGitService
      const gitServiceWithoutHandler = new GitService({
        repoPath: '/test/repo/path',
        logger: mockLogger,
        eventEmitter: mockEventEmitter
      });
      
      const error = new Error('テストエラー');
      
      // getCurrentCommitHash操作
      let result = gitServiceWithoutHandler._handleError('エラーメッセージ', error, { operation: 'getCurrentCommitHash' });
      expect(result).toBe('');
      
      // getCurrentBranch操作
      result = gitServiceWithoutHandler._handleError('エラーメッセージ', error, { operation: 'getCurrentBranch' });
      expect(result).toBe('');
      
      // extractTaskIdsFromCommitMessage操作
      result = gitServiceWithoutHandler._handleError('エラーメッセージ', error, { operation: 'extractTaskIdsFromCommitMessage' });
      expect(result).toEqual([]);
      
      // getCommitDiffStats操作
      result = gitServiceWithoutHandler._handleError('エラーメッセージ', error, { operation: 'getCommitDiffStats' });
      expect(result).toEqual({});
      
      // 不明な操作
      result = gitServiceWithoutHandler._handleError('エラーメッセージ', error, { operation: 'unknown' });
      expect(result).toBeNull();
    });
  });
});