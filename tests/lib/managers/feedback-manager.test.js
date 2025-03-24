/**
 * フィードバック管理ユーティリティのテスト
 */

const { FeedbackManager } = require('../../../src/lib/managers/feedback-manager');
const { createMockDependencies } = require('../../helpers/mock-factory');

describe('FeedbackManager', () => {
  let feedbackManager;
  let mockDeps;
  let mockFeedback;
  
  beforeEach(() => {
    // モック依存関係の作成
    mockDeps = createMockDependencies();
    
    // FeedbackManagerのインスタンスを作成
    feedbackManager = new FeedbackManager(
      mockDeps.storageService,
      mockDeps.gitService,
      mockDeps.logger,
      mockDeps.eventEmitter,
      mockDeps.errorHandler,
      mockDeps.handlebars,
      {
        feedbackDir: 'test-feedback',
        templateDir: 'test-templates'
      }
    );
    
    // モックフィードバックの作成
    mockFeedback = {
      feedback_loop: {
        task_id: 'T001',
        implementation_attempt: 1,
        git_commit: 'abc123',
        test_execution: {
          command: 'npm test',
          timestamp: '2025-03-20T15:30:00Z',
          duration_ms: 1500,
          test_types: ['unit']
        },
        verification_results: {
          passes_tests: false,
          test_summary: {
            total: 10,
            passed: 8,
            failed: 2,
            skipped: 0
          },
          failures: [
            {
              test_name: 'should validate input correctly',
              message: 'Expected true but got false',
              location: 'src/test.js:42'
            },
            {
              test_name: 'should handle edge cases',
              message: 'TypeError: Cannot read property of undefined',
              location: 'src/test.js:56'
            }
          ]
        },
        feedback_items: [
          {
            type: 'functional',
            severity: 4,
            description: 'Input validation is not working correctly',
            suggested_fix: 'Add proper validation for null values',
            related_files: ['src/test.js']
          },
          {
            type: 'code_quality',
            severity: 2,
            description: 'Function is too complex',
            suggested_fix: 'Refactor into smaller functions',
            related_files: ['src/test.js']
          }
        ],
        status: 'open',
        created_at: '2025-03-20T15:35:00Z',
        updated_at: '2025-03-20T15:35:00Z'
      }
    };
  });
  
  test('コンストラクタで依存関係を正しく設定する', () => {
    expect(feedbackManager.storageService).toBe(mockDeps.storageService);
    expect(feedbackManager.gitService).toBe(mockDeps.gitService);
    expect(feedbackManager.logger).toBe(mockDeps.logger);
    expect(feedbackManager.eventEmitter).toBe(mockDeps.eventEmitter);
    expect(feedbackManager.errorHandler).toBe(mockDeps.errorHandler);
    expect(feedbackManager.handlebars).toBe(mockDeps.handlebars);
    expect(feedbackManager.feedbackDir).toBe('test-feedback');
    expect(feedbackManager.templateDir).toBe('test-templates');
  });
  
  test('必須の依存関係が欠けている場合はエラーをスローする', () => {
    expect(() => new FeedbackManager(null, mockDeps.gitService, mockDeps.logger, mockDeps.eventEmitter, mockDeps.errorHandler, mockDeps.handlebars))
      .toThrow('FeedbackManager requires a storageService instance');
    
    expect(() => new FeedbackManager(mockDeps.storageService, null, mockDeps.logger, mockDeps.eventEmitter, mockDeps.errorHandler, mockDeps.handlebars))
      .toThrow('FeedbackManager requires a gitService instance');
    
    expect(() => new FeedbackManager(mockDeps.storageService, mockDeps.gitService, null, mockDeps.eventEmitter, mockDeps.errorHandler, mockDeps.handlebars))
      .toThrow('FeedbackManager requires a logger instance');
    
    expect(() => new FeedbackManager(mockDeps.storageService, mockDeps.gitService, mockDeps.logger, null, mockDeps.errorHandler, mockDeps.handlebars))
      .toThrow('FeedbackManager requires an eventEmitter instance');
    
    expect(() => new FeedbackManager(mockDeps.storageService, mockDeps.gitService, mockDeps.logger, mockDeps.eventEmitter, null, mockDeps.handlebars))
      .toThrow('FeedbackManager requires an errorHandler instance');
    
    expect(() => new FeedbackManager(mockDeps.storageService, mockDeps.gitService, mockDeps.logger, mockDeps.eventEmitter, mockDeps.errorHandler, null))
      .toThrow('FeedbackManager requires a handlebars instance');
  });
  
  describe('validateFeedback', () => {
    test('有効なフィードバックを検証できること', () => {
      const result = feedbackManager.validateFeedback(mockFeedback);
      expect(result).toBe(true);
    });
    
    test('フィードバックオブジェクトがない場合はfalseを返すこと', () => {
      const result = feedbackManager.validateFeedback(null);
      expect(result).toBe(false);
      expect(mockDeps.logger.error).toHaveBeenCalled();
    });
    
    test('feedback_loopがない場合はfalseを返すこと', () => {
      const result = feedbackManager.validateFeedback({});
      expect(result).toBe(false);
      expect(mockDeps.logger.error).toHaveBeenCalled();
    });
  });
  
  describe('getPendingFeedback', () => {
    test('保留中のフィードバックを取得できること', () => {
      // モックの設定
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockReturnValue([mockFeedback]);
      
      const result = feedbackManager.getPendingFeedback();
      
      // 結果の検証
      expect(result).toEqual([mockFeedback]);
      expect(mockDeps.storageService.fileExists).toHaveBeenCalledWith('test-feedback', 'pending-feedback.json');
      expect(mockDeps.storageService.readJSON).toHaveBeenCalledWith('test-feedback', 'pending-feedback.json');
    });
    
    test('保留中のフィードバックが存在しない場合は空配列を返すこと', () => {
      mockDeps.storageService.fileExists.mockReturnValue(false);
      
      const result = feedbackManager.getPendingFeedback();
      expect(result).toEqual([]);
    });
  });
  
  describe('saveFeedback', () => {
    test('フィードバックを保存できること', () => {
      // validateFeedbackをモック
      feedbackManager.validateFeedback = jest.fn().mockReturnValue(true);
      
      // getPendingFeedbackをモック
      feedbackManager.getPendingFeedback = jest.fn().mockReturnValue([]);
      
      const result = feedbackManager.saveFeedback(mockFeedback);
      
      expect(result).toBe(true);
      expect(mockDeps.storageService.writeJSON).toHaveBeenCalledWith('test-feedback', 'pending-feedback.json', [mockFeedback]);
    });
    
    test('不正なフィードバックは保存できないこと', () => {
      // validateFeedbackをモック
      feedbackManager.validateFeedback = jest.fn().mockReturnValue(false);
      
      const result = feedbackManager.saveFeedback(mockFeedback);
      
      expect(result).toBe(false);
      expect(mockDeps.storageService.writeJSON).not.toHaveBeenCalled();
      expect(mockDeps.logger.error).toHaveBeenCalled();
    });
  });
  
  // 他のテストも同様に修正
});