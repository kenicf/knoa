/**
 * フィードバックリポジトリクラスのテスト
 */

const {
  FeedbackRepository,
} = require('../../../src/lib/data/feedback-repository');
const { NotFoundError } = require('../../../src/lib/data/repository');
const { createMockDependencies } = require('../../helpers/mock-factory');

describe('FeedbackRepository', () => {
  let feedbackRepository;
  let mockDeps;
  let mockValidator;

  beforeEach(() => {
    mockDeps = createMockDependencies();
    mockValidator = {
      validate: jest.fn().mockReturnValue({ isValid: true }),
    };
    feedbackRepository = new FeedbackRepository(
      mockDeps.storageService,
      mockValidator
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should create repository with default options', () => {
      expect(feedbackRepository.entityName).toBe('feedback');
      expect(feedbackRepository.directory).toBe('ai-context/feedback');
      expect(feedbackRepository.currentFile).toBe('pending-feedback.json');
      expect(feedbackRepository.historyDirectory).toBe('feedback-history');
      expect(feedbackRepository.validator).toBe(mockValidator);

      // フィードバックの状態遷移の定義が正しいか確認
      expect(
        Object.keys(feedbackRepository.feedbackStateTransitions)
      ).toContain('open');
      expect(
        Object.keys(feedbackRepository.feedbackStateTransitions)
      ).toContain('resolved');

      // フィードバックの種類と優先度の重み付けが正しいか確認
      expect(Object.keys(feedbackRepository.feedbackTypeWeights)).toContain(
        'security'
      );
      expect(Object.keys(feedbackRepository.feedbackTypeWeights)).toContain(
        'code_quality'
      );
    });

    test('should create repository with custom options', () => {
      const customOptions = {
        directory: 'custom-feedback',
        currentFile: 'custom-feedback.json',
        historyDirectory: 'custom-history',
        feedbackStateTransitions: {
          custom: ['resolved'],
        },
        feedbackTypeWeights: {
          custom: 10,
        },
      };

      const customRepo = new FeedbackRepository(
        mockDeps.storageService,
        mockValidator,
        customOptions
      );

      expect(customRepo.directory).toBe('custom-feedback');
      expect(customRepo.currentFile).toBe('custom-feedback.json');
      expect(customRepo.historyDirectory).toBe('custom-history');
      expect(customRepo.feedbackStateTransitions).toBe(
        customOptions.feedbackStateTransitions
      );
      expect(customRepo.feedbackTypeWeights).toBe(
        customOptions.feedbackTypeWeights
      );
    });
  });

  describe('getPendingFeedback', () => {
    test('should return pending feedback if exists', async () => {
      const mockFeedback = [
        { feedback_id: 'feedback-1', feedback_loop: { status: 'open' } },
        { feedback_id: 'feedback-2', feedback_loop: { status: 'in_progress' } },
      ];

      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue(mockFeedback);

      const result = await feedbackRepository.getPendingFeedback();

      expect(result).toEqual(mockFeedback);
      expect(mockDeps.storageService.fileExists).toHaveBeenCalledWith(
        'ai-context/feedback',
        'pending-feedback.json'
      );
      expect(mockDeps.storageService.readJSON).toHaveBeenCalledWith(
        'ai-context/feedback',
        'pending-feedback.json'
      );
    });

    test('should return empty array if pending feedback does not exist', async () => {
      mockDeps.storageService.fileExists.mockReturnValue(false);

      const result = await feedbackRepository.getPendingFeedback();

      expect(result).toEqual([]);
      expect(mockDeps.storageService.readJSON).not.toHaveBeenCalled();
    });

    test('should return empty array if pending feedback is not an array', async () => {
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue('not an array');

      const result = await feedbackRepository.getPendingFeedback();

      expect(result).toEqual([]);
    });

    test('should handle error from storage service', async () => {
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockRejectedValue(
        new Error('Read error')
      );

      await expect(feedbackRepository.getPendingFeedback()).rejects.toThrow(
        'Failed to get pending feedback: Read error'
      );
    });
  });

  describe('saveFeedback', () => {
    test('should validate feedback before saving', async () => {
      const mockFeedback = {
        feedback_id: 'feedback-1',
        feedback_loop: {
          task_id: 'T001',
          implementation_attempt: 1,
        },
      };

      // Mock _validateFeedback method
      jest
        .spyOn(feedbackRepository, '_validateFeedback')
        .mockReturnValue(false);

      await expect(
        feedbackRepository.saveFeedback(mockFeedback)
      ).rejects.toThrow('Invalid feedback');
      expect(feedbackRepository._validateFeedback).toHaveBeenCalledWith(
        mockFeedback
      );
    });

    test('should add new feedback to pending feedback', async () => {
      const mockFeedback = {
        feedback_id: 'feedback-1',
        feedback_loop: {
          task_id: 'T001',
          implementation_attempt: 1,
        },
      };

      const existingFeedback = [
        {
          feedback_id: 'feedback-2',
          feedback_loop: {
            task_id: 'T002',
            implementation_attempt: 1,
          },
        },
      ];

      // Mock _validateFeedback method
      jest.spyOn(feedbackRepository, '_validateFeedback').mockReturnValue(true);

      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue(existingFeedback);

      const result = await feedbackRepository.saveFeedback(mockFeedback);

      expect(result).toBe(true);
      expect(mockDeps.storageService.writeJSON).toHaveBeenCalledWith(
        'ai-context/feedback',
        'pending-feedback.json',
        [...existingFeedback, mockFeedback]
      );
    });

    test('should update existing feedback in pending feedback', async () => {
      const mockFeedback = {
        feedback_id: 'feedback-1',
        feedback_loop: {
          task_id: 'T001',
          implementation_attempt: 1,
          status: 'in_progress',
        },
      };

      const existingFeedback = [
        {
          feedback_id: 'feedback-1',
          feedback_loop: {
            task_id: 'T001',
            implementation_attempt: 1,
            status: 'open',
          },
        },
      ];

      // Mock _validateFeedback method
      jest.spyOn(feedbackRepository, '_validateFeedback').mockReturnValue(true);

      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue(existingFeedback);

      const result = await feedbackRepository.saveFeedback(mockFeedback);

      expect(result).toBe(true);
      expect(mockDeps.storageService.writeJSON).toHaveBeenCalledWith(
        'ai-context/feedback',
        'pending-feedback.json',
        [mockFeedback]
      );
    });

    test('should handle error from storage service', async () => {
      const mockFeedback = {
        feedback_id: 'feedback-1',
        feedback_loop: {
          task_id: 'T001',
          implementation_attempt: 1,
        },
      };

      // Mock _validateFeedback method
      jest.spyOn(feedbackRepository, '_validateFeedback').mockReturnValue(true);

      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockRejectedValue(
        new Error('Read error')
      );

      await expect(
        feedbackRepository.saveFeedback(mockFeedback)
      ).rejects.toThrow('Failed to save feedback: Read error');
    });
  });

  describe('moveFeedbackToHistory', () => {
    test('should validate feedback before moving', async () => {
      const mockFeedback = {
        feedback_id: 'feedback-1',
        feedback_loop: {
          task_id: 'T001',
          implementation_attempt: 1,
        },
      };

      // Mock _validateFeedback method
      jest
        .spyOn(feedbackRepository, '_validateFeedback')
        .mockReturnValue(false);

      await expect(
        feedbackRepository.moveFeedbackToHistory(mockFeedback)
      ).rejects.toThrow('Invalid feedback');
      expect(feedbackRepository._validateFeedback).toHaveBeenCalledWith(
        mockFeedback
      );
    });

    test('should move feedback to history and remove from pending', async () => {
      const mockFeedback = {
        feedback_id: 'feedback-1',
        feedback_loop: {
          task_id: 'T001',
          implementation_attempt: 1,
        },
      };

      const existingFeedback = [
        mockFeedback,
        {
          feedback_id: 'feedback-2',
          feedback_loop: {
            task_id: 'T002',
            implementation_attempt: 1,
          },
        },
      ];

      // Mock _validateFeedback method
      jest.spyOn(feedbackRepository, '_validateFeedback').mockReturnValue(true);

      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue(existingFeedback);

      const result =
        await feedbackRepository.moveFeedbackToHistory(mockFeedback);

      expect(result).toBe(true);
      expect(mockDeps.storageService.writeJSON).toHaveBeenCalledWith(
        'ai-context/feedback/feedback-history',
        'feedback-T001-1.json',
        mockFeedback
      );
      expect(mockDeps.storageService.writeJSON).toHaveBeenCalledWith(
        'ai-context/feedback',
        'pending-feedback.json',
        [existingFeedback[1]]
      );
    });

    test('should handle error from storage service', async () => {
      const mockFeedback = {
        feedback_id: 'feedback-1',
        feedback_loop: {
          task_id: 'T001',
          implementation_attempt: 1,
        },
      };

      // Mock _validateFeedback method
      jest.spyOn(feedbackRepository, '_validateFeedback').mockReturnValue(true);

      mockDeps.storageService.writeJSON.mockRejectedValue(
        new Error('Write error')
      );

      await expect(
        feedbackRepository.moveFeedbackToHistory(mockFeedback)
      ).rejects.toThrow('Failed to move feedback to history: Write error');
    });
  });

  describe('getFeedbackHistoryByTaskId', () => {
    test('should return feedback history for task', async () => {
      const mockFeedback1 = {
        feedback_id: 'feedback-1',
        feedback_loop: {
          task_id: 'T001',
          implementation_attempt: 1,
          timestamp: '2025-03-22T10:00:00Z',
        },
      };

      const mockFeedback2 = {
        feedback_id: 'feedback-2',
        feedback_loop: {
          task_id: 'T001',
          implementation_attempt: 2,
          timestamp: '2025-03-22T11:00:00Z',
        },
      };

      mockDeps.storageService.listFiles.mockReturnValue([
        'feedback-T001-1.json',
        'feedback-T001-2.json',
      ]);
      mockDeps.storageService.readJSON
        .mockResolvedValueOnce(mockFeedback1)
        .mockResolvedValueOnce(mockFeedback2);

      const result =
        await feedbackRepository.getFeedbackHistoryByTaskId('T001');

      expect(result).toEqual([mockFeedback2, mockFeedback1]); // 新しい順
      expect(mockDeps.storageService.listFiles).toHaveBeenCalledWith(
        'ai-context/feedback/feedback-history',
        'feedback-T001-.*\\.json'
      );
      expect(mockDeps.storageService.readJSON).toHaveBeenCalledWith(
        'ai-context/feedback/feedback-history',
        'feedback-T001-1.json'
      );
      expect(mockDeps.storageService.readJSON).toHaveBeenCalledWith(
        'ai-context/feedback/feedback-history',
        'feedback-T001-2.json'
      );
    });

    test('should return empty array if no feedback history found', async () => {
      mockDeps.storageService.listFiles.mockReturnValue([]);

      const result =
        await feedbackRepository.getFeedbackHistoryByTaskId('T001');

      expect(result).toEqual([]);
    });

    test('should handle error from storage service', async () => {
      mockDeps.storageService.listFiles.mockRejectedValue(
        new Error('List error')
      );

      await expect(
        feedbackRepository.getFeedbackHistoryByTaskId('T001')
      ).rejects.toThrow(
        'Failed to get feedback history for task T001: List error'
      );
    });
  });

  describe('updateFeedbackStatus', () => {
    test('should throw NotFoundError if feedback not found', async () => {
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue([]);

      await expect(
        feedbackRepository.updateFeedbackStatus('feedback-1', 'resolved')
      ).rejects.toThrow(NotFoundError);
    });

    test('should throw error if transition is not allowed', async () => {
      const mockFeedback = {
        feedback_id: 'feedback-1',
        feedback_loop: {
          status: 'open',
        },
      };

      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue([mockFeedback]);

      // open から invalid への遷移は許可されていない
      await expect(
        feedbackRepository.updateFeedbackStatus('feedback-1', 'invalid')
      ).rejects.toThrow('Transition from open to invalid is not allowed');
    });

    test('should update feedback status', async () => {
      const mockFeedback = {
        feedback_id: 'feedback-1',
        feedback_loop: {
          status: 'open',
        },
      };

      const resolutionDetails = {
        resolution_comment: 'Fixed issue',
        resolution_commit: 'commit-hash',
      };

      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue([mockFeedback]);

      // Mock Date.toISOString to return a fixed timestamp
      const originalDateToISOString = Date.prototype.toISOString;
      const mockTimestamp = '2025-03-22T12:00:00.000Z';
      Date.prototype.toISOString = jest.fn(() => mockTimestamp);

      const result = await feedbackRepository.updateFeedbackStatus(
        'feedback-1',
        'resolved',
        resolutionDetails
      );

      // Restore original Date.toISOString
      Date.prototype.toISOString = originalDateToISOString;

      expect(result.feedback_loop.status).toBe('resolved');
      expect(result.feedback_loop.resolution_details).toBe(resolutionDetails);
      expect(result.feedback_loop.updated_at).toBe(mockTimestamp);

      expect(mockDeps.storageService.writeJSON).toHaveBeenCalledWith(
        'ai-context/feedback',
        'pending-feedback.json',
        [result]
      );
    });
  });

  describe('calculatePriority', () => {
    test('should calculate priority based on feedback type', () => {
      const mockFeedback = {
        feedback_loop: {
          feedback_type: 'security', // 重み: 5
        },
      };

      const result = feedbackRepository.calculatePriority(mockFeedback);

      expect(result).toBe(5);
    });

    test('should calculate priority based on test results', () => {
      const mockFeedback = {
        feedback_loop: {
          feedback_type: 'code_quality', // 重み: 2
          test_results: {
            failed_tests: [{}, {}, {}], // 3つの失敗テスト: 3 * 2 = 6
            success_rate: 70, // (100 - 70) / 10 = 3
          },
        },
      };

      const result = feedbackRepository.calculatePriority(mockFeedback);

      // 2 + 6 + 3 = 11 -> 最大値10に制限
      expect(result).toBe(10);
    });

    test('should calculate priority based on feedback items', () => {
      const mockFeedback = {
        feedback_loop: {
          feedback_items: [
            { priority: 'high' }, // 高優先度: 2
            { priority: 'medium' }, // 通常: 1
            { priority: 'high' }, // 高優先度: 2
          ],
        },
      };

      const result = feedbackRepository.calculatePriority(mockFeedback);

      // 3 (アイテム数) + 4 (高優先度) = 7
      expect(result).toBe(7);
    });

    test('should return minimum priority for invalid feedback', () => {
      const result = feedbackRepository.calculatePriority(null);

      expect(result).toBe(1);
    });
  });

  describe('_validateFeedback', () => {
    test('should validate feedback structure', () => {
      const validFeedback = {
        feedback_loop: {
          task_id: 'T001',
          test_execution: {
            command: 'npm test',
            timestamp: '2025-03-22T12:00:00Z',
            environment: 'node v14',
          },
          verification_results: {
            status: 'failed',
            timestamp: '2025-03-22T12:00:00Z',
          },
          feedback_items: [{ description: 'Issue 1' }],
          status: 'open',
        },
      };

      const result = feedbackRepository._validateFeedback(validFeedback);

      expect(result).toBe(true);
    });

    test('should return false for invalid feedback structure', () => {
      const invalidFeedback = {
        // Missing feedback_loop
      };

      const result = feedbackRepository._validateFeedback(invalidFeedback);

      expect(result).toBe(false);
    });

    test('should return false for missing required fields', () => {
      const invalidFeedback = {
        feedback_loop: {
          task_id: 'T001',
          // Missing test_execution
          verification_results: {
            status: 'failed',
            timestamp: '2025-03-22T12:00:00Z',
          },
          feedback_items: [{ description: 'Issue 1' }],
          status: 'open',
        },
      };

      const result = feedbackRepository._validateFeedback(invalidFeedback);

      expect(result).toBe(false);
    });

    test('should return false for invalid task ID', () => {
      const invalidFeedback = {
        feedback_loop: {
          task_id: 'invalid-task-id', // Invalid format
          test_execution: {
            command: 'npm test',
            timestamp: '2025-03-22T12:00:00Z',
            environment: 'node v14',
          },
          verification_results: {
            status: 'failed',
            timestamp: '2025-03-22T12:00:00Z',
          },
          feedback_items: [{ description: 'Issue 1' }],
          status: 'open',
        },
      };

      const result = feedbackRepository._validateFeedback(invalidFeedback);

      expect(result).toBe(false);
    });

    test('should return false for invalid status', () => {
      const invalidFeedback = {
        feedback_loop: {
          task_id: 'T001',
          test_execution: {
            command: 'npm test',
            timestamp: '2025-03-22T12:00:00Z',
            environment: 'node v14',
          },
          verification_results: {
            status: 'failed',
            timestamp: '2025-03-22T12:00:00Z',
          },
          feedback_items: [{ description: 'Issue 1' }],
          status: 'invalid-status', // Invalid status
        },
      };

      const result = feedbackRepository._validateFeedback(invalidFeedback);

      expect(result).toBe(false);
    });
  });

  describe('searchFeedback', () => {
    test('should search feedback by task ID', async () => {
      const pendingFeedback = [
        {
          feedback_id: 'feedback-1',
          feedback_loop: {
            task_id: 'T001',
            status: 'open',
            timestamp: '2025-03-22T10:00:00Z',
          },
        },
      ];

      const historyFeedback = [
        {
          feedback_id: 'feedback-2',
          feedback_loop: {
            task_id: 'T001',
            status: 'resolved',
            timestamp: '2025-03-22T09:00:00Z',
          },
        },
        {
          feedback_id: 'feedback-3',
          feedback_loop: {
            task_id: 'T002',
            status: 'resolved',
            timestamp: '2025-03-22T08:00:00Z',
          },
        },
      ];

      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue(pendingFeedback);
      mockDeps.storageService.listFiles.mockReturnValue([
        'feedback-T001-1.json',
        'feedback-T002-1.json',
      ]);

      // Mock readJSON for history feedback
      jest
        .spyOn(mockDeps.storageService, 'readJSON')
        .mockResolvedValueOnce(pendingFeedback) // For pending feedback
        .mockResolvedValueOnce(historyFeedback[0]) // For feedback-T001-1.json
        .mockResolvedValueOnce(historyFeedback[1]); // For feedback-T002-1.json

      const result = await feedbackRepository.searchFeedback({
        taskId: 'T001',
      });

      expect(result).toHaveLength(2);
      expect(result[0].feedback_id).toBe('feedback-1');
      expect(result[1].feedback_id).toBe('feedback-2');
    });

    test('should search feedback by status', async () => {
      const pendingFeedback = [
        {
          feedback_id: 'feedback-1',
          feedback_loop: {
            task_id: 'T001',
            status: 'open',
            timestamp: '2025-03-22T10:00:00Z',
          },
        },
      ];

      const historyFeedback = [
        {
          feedback_id: 'feedback-2',
          feedback_loop: {
            task_id: 'T001',
            status: 'resolved',
            timestamp: '2025-03-22T09:00:00Z',
          },
        },
      ];

      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue(pendingFeedback);
      mockDeps.storageService.listFiles.mockReturnValue([
        'feedback-T001-1.json',
      ]);

      // Mock readJSON for history feedback
      jest
        .spyOn(mockDeps.storageService, 'readJSON')
        .mockResolvedValueOnce(pendingFeedback) // For pending feedback
        .mockResolvedValueOnce(historyFeedback[0]); // For feedback-T001-1.json

      const result = await feedbackRepository.searchFeedback({
        status: 'resolved',
      });

      expect(result).toHaveLength(1);
      expect(result[0].feedback_id).toBe('feedback-2');
    });

    test('should search feedback by text', async () => {
      const pendingFeedback = [
        {
          feedback_id: 'feedback-1',
          feedback_loop: {
            task_id: 'T001',
            status: 'open',
            timestamp: '2025-03-22T10:00:00Z',
            feedback_items: [{ description: 'This is a test issue' }],
          },
        },
      ];

      const historyFeedback = [
        {
          feedback_id: 'feedback-2',
          feedback_loop: {
            task_id: 'T001',
            status: 'resolved',
            timestamp: '2025-03-22T09:00:00Z',
            feedback_items: [{ description: 'Another issue' }],
          },
        },
      ];

      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue(pendingFeedback);
      mockDeps.storageService.listFiles.mockReturnValue([
        'feedback-T001-1.json',
      ]);

      // Mock readJSON for history feedback
      jest
        .spyOn(mockDeps.storageService, 'readJSON')
        .mockResolvedValueOnce(pendingFeedback) // For pending feedback
        .mockResolvedValueOnce(historyFeedback[0]); // For feedback-T001-1.json

      const result = await feedbackRepository.searchFeedback({ text: 'test' });

      expect(result).toHaveLength(1);
      expect(result[0].feedback_id).toBe('feedback-1');
    });

    test('should handle error from storage service', async () => {
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockRejectedValue(
        new Error('Read error')
      );

      await expect(feedbackRepository.searchFeedback()).rejects.toThrow(
        'Failed to search feedback: Read error'
      );
    });
  });
});
