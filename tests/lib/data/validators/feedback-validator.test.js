/**
 * フィードバックバリデータクラスのテスト
 */

const {
  FeedbackValidator,
} = require('../../../../src/lib/data/validators/feedback-validator');

describe('FeedbackValidator', () => {
  let feedbackValidator;

  beforeEach(() => {
    feedbackValidator = new FeedbackValidator();
  });

  describe('constructor', () => {
    test('should create validator with default options', () => {
      expect(feedbackValidator.feedbackStateTransitions).toBeDefined();
      expect(Object.keys(feedbackValidator.feedbackStateTransitions)).toContain(
        'open'
      );
      expect(Object.keys(feedbackValidator.feedbackStateTransitions)).toContain(
        'resolved'
      );

      expect(feedbackValidator.feedbackTypeWeights).toBeDefined();
      expect(Object.keys(feedbackValidator.feedbackTypeWeights)).toContain(
        'security'
      );
      expect(Object.keys(feedbackValidator.feedbackTypeWeights)).toContain(
        'code_quality'
      );
    });

    test('should create validator with custom options', () => {
      const customOptions = {
        feedbackStateTransitions: {
          custom: ['resolved'],
        },
        feedbackTypeWeights: {
          custom: 10,
        },
      };

      const customValidator = new FeedbackValidator(customOptions);

      expect(customValidator.feedbackStateTransitions).toBe(
        customOptions.feedbackStateTransitions
      );
      expect(customValidator.feedbackTypeWeights).toBe(
        customOptions.feedbackTypeWeights
      );
    });
  });

  describe('validate', () => {
    test('should validate valid feedback', () => {
      const validFeedback = {
        feedback_id: 'feedback-123',
        timestamp: '2025-03-22T12:00:00Z',
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
          feedback_items: [
            {
              description: 'Issue 1',
              type: 'bug',
              priority: 'high',
              location: {
                file: 'src/file.js',
                line: 10,
              },
            },
          ],
          status: 'open',
          feedback_type: 'functional',
          test_results: {
            summary: {
              total_tests: 10,
              passed_tests: 8,
              failed_tests: 2,
              skipped_tests: 0,
              success_rate: 80,
            },
            test_suites: [
              {
                name: 'Test Suite 1',
                status: 'failed',
              },
            ],
            failed_tests: [
              {
                name: 'Test 1',
                message: 'Error message',
              },
            ],
          },
        },
      };

      const result = feedbackValidator.validate(validFeedback);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should validate feedback with minimum required fields', () => {
      const minimalFeedback = {
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
          feedback_items: [
            {
              description: 'Issue 1',
            },
          ],
          status: 'open',
        },
      };

      const result = feedbackValidator.validate(minimalFeedback);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should return errors for missing feedback_loop', () => {
      const invalidFeedback = {};

      const result = feedbackValidator.validate(invalidFeedback);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('フィードバックオブジェクトが不正です');
    });

    test('should return errors for missing required fields', () => {
      const invalidFeedback = {
        feedback_loop: {
          task_id: 'T001',
          // Missing test_execution
          verification_results: {
            status: 'failed',
            timestamp: '2025-03-22T12:00:00Z',
          },
          feedback_items: [
            {
              description: 'Issue 1',
            },
          ],
          status: 'open',
        },
      };

      const result = feedbackValidator.validate(invalidFeedback);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        '必須フィールド test_execution がありません'
      );
    });

    test('should validate task_id format', () => {
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
          feedback_items: [
            {
              description: 'Issue 1',
            },
          ],
          status: 'open',
        },
      };

      const result = feedbackValidator.validate(invalidFeedback);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        '不正なタスクID形式です: invalid-task-id'
      );
    });

    test('should validate status', () => {
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
          feedback_items: [
            {
              description: 'Issue 1',
            },
          ],
          status: 'invalid-status', // Invalid status
        },
      };

      const result = feedbackValidator.validate(invalidFeedback);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('不正な状態です: invalid-status');
    });

    test('should validate feedback type', () => {
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
          feedback_items: [
            {
              description: 'Issue 1',
            },
          ],
          status: 'open',
          feedback_type: 'invalid-type', // Invalid type
        },
      };

      const result = feedbackValidator.validate(invalidFeedback);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        '不正なフィードバックタイプです: invalid-type'
      );
    });

    test('should validate test_execution', () => {
      const invalidFeedback = {
        feedback_loop: {
          task_id: 'T001',
          test_execution: 'not-an-object', // Invalid (should be an object)
          verification_results: {
            status: 'failed',
            timestamp: '2025-03-22T12:00:00Z',
          },
          feedback_items: [
            {
              description: 'Issue 1',
            },
          ],
          status: 'open',
        },
      };

      const result = feedbackValidator.validate(invalidFeedback);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'test_execution はオブジェクトである必要があります'
      );
    });

    test('should validate test_execution required fields', () => {
      const invalidFeedback = {
        feedback_loop: {
          task_id: 'T001',
          test_execution: {
            // Missing command
            timestamp: '2025-03-22T12:00:00Z',
            // Missing environment
          },
          verification_results: {
            status: 'failed',
            timestamp: '2025-03-22T12:00:00Z',
          },
          feedback_items: [
            {
              description: 'Issue 1',
            },
          ],
          status: 'open',
        },
      };

      const result = feedbackValidator.validate(invalidFeedback);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('test_execution.command は必須です');
      expect(result.errors).toContain('test_execution.environment は必須です');
    });

    test('should validate test_results', () => {
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
          feedback_items: [
            {
              description: 'Issue 1',
            },
          ],
          status: 'open',
          test_results: 'not-an-object', // Invalid (should be an object)
        },
      };

      const result = feedbackValidator.validate(invalidFeedback);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'test_results はオブジェクトである必要があります'
      );
    });

    test('should validate test_results.summary', () => {
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
          feedback_items: [
            {
              description: 'Issue 1',
            },
          ],
          status: 'open',
          test_results: {
            summary: {
              total_tests: 'not-a-number', // Invalid (should be a number)
              passed_tests: -1, // Invalid (should be >= 0)
              failed_tests: 2,
              skipped_tests: 0,
              success_rate: 101, // Invalid (should be 0-100)
            },
          },
        },
      };

      const result = feedbackValidator.validate(invalidFeedback);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'test_results.summary.total_tests は数値である必要があります'
      );
      expect(result.errors).toContain(
        'test_results.summary.passed_tests は 0 以上である必要があります'
      );
      expect(result.errors).toContain(
        'test_results.summary.success_rate は 0 から 100 の間である必要があります'
      );
    });

    test('should validate test_results.test_suites', () => {
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
          feedback_items: [
            {
              description: 'Issue 1',
            },
          ],
          status: 'open',
          test_results: {
            test_suites: 'not-an-array', // Invalid (should be an array)
          },
        },
      };

      const result = feedbackValidator.validate(invalidFeedback);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'test_results.test_suites は配列である必要があります'
      );
    });

    test('should validate test_results.test_suites items', () => {
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
          feedback_items: [
            {
              description: 'Issue 1',
            },
          ],
          status: 'open',
          test_results: {
            test_suites: [
              {
                // Missing name
                status: 'invalid-status', // Invalid status
              },
            ],
          },
        },
      };

      const result = feedbackValidator.validate(invalidFeedback);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'test_results.test_suites[0].name は必須です'
      );
      expect(result.errors).toContain(
        'test_results.test_suites[0].status は passed, failed, skipped のいずれかである必要があります'
      );
    });

    test('should validate test_results.failed_tests', () => {
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
          feedback_items: [
            {
              description: 'Issue 1',
            },
          ],
          status: 'open',
          test_results: {
            failed_tests: 'not-an-array', // Invalid (should be an array)
          },
        },
      };

      const result = feedbackValidator.validate(invalidFeedback);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'test_results.failed_tests は配列である必要があります'
      );
    });

    test('should validate test_results.failed_tests items', () => {
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
          feedback_items: [
            {
              description: 'Issue 1',
            },
          ],
          status: 'open',
          test_results: {
            failed_tests: [
              {
                // Missing name
                // Missing message
              },
            ],
          },
        },
      };

      const result = feedbackValidator.validate(invalidFeedback);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'test_results.failed_tests[0].name は必須です'
      );
      expect(result.errors).toContain(
        'test_results.failed_tests[0].message は必須です'
      );
    });

    test('should validate verification_results', () => {
      const invalidFeedback = {
        feedback_loop: {
          task_id: 'T001',
          test_execution: {
            command: 'npm test',
            timestamp: '2025-03-22T12:00:00Z',
            environment: 'node v14',
          },
          verification_results: 'not-an-object', // Invalid (should be an object)
          feedback_items: [
            {
              description: 'Issue 1',
            },
          ],
          status: 'open',
        },
      };

      const result = feedbackValidator.validate(invalidFeedback);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'verification_results はオブジェクトである必要があります'
      );
    });

    test('should validate verification_results required fields', () => {
      const invalidFeedback = {
        feedback_loop: {
          task_id: 'T001',
          test_execution: {
            command: 'npm test',
            timestamp: '2025-03-22T12:00:00Z',
            environment: 'node v14',
          },
          verification_results: {
            // Missing status
            // Missing timestamp
          },
          feedback_items: [
            {
              description: 'Issue 1',
            },
          ],
          status: 'open',
        },
      };

      const result = feedbackValidator.validate(invalidFeedback);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('verification_results.status は必須です');
      expect(result.errors).toContain(
        'verification_results.timestamp は必須です'
      );
    });

    test('should validate verification_results.status', () => {
      const invalidFeedback = {
        feedback_loop: {
          task_id: 'T001',
          test_execution: {
            command: 'npm test',
            timestamp: '2025-03-22T12:00:00Z',
            environment: 'node v14',
          },
          verification_results: {
            status: 'invalid-status', // Invalid status
            timestamp: '2025-03-22T12:00:00Z',
          },
          feedback_items: [
            {
              description: 'Issue 1',
            },
          ],
          status: 'open',
        },
      };

      const result = feedbackValidator.validate(invalidFeedback);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'verification_results.status は passed, failed, partial のいずれかである必要があります'
      );
    });

    test('should validate feedback_items', () => {
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
          feedback_items: 'not-an-array', // Invalid (should be an array)
          status: 'open',
        },
      };

      const result = feedbackValidator.validate(invalidFeedback);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'feedback_items は配列である必要があります'
      );
    });

    test('should validate feedback_items items', () => {
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
          feedback_items: [
            {
              // Missing description
              type: 'invalid-type', // Invalid type
              priority: 'invalid-priority', // Invalid priority
              location: 'not-an-object', // Invalid (should be an object)
            },
          ],
          status: 'open',
        },
      };

      const result = feedbackValidator.validate(invalidFeedback);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'feedback_items[0].description は必須です'
      );
      expect(result.errors).toContain(
        'feedback_items[0].type は bug, improvement, suggestion, question のいずれかである必要があります'
      );
      expect(result.errors).toContain(
        'feedback_items[0].priority は high, medium, low のいずれかである必要があります'
      );
      expect(result.errors).toContain(
        'feedback_items[0].location はオブジェクトである必要があります'
      );
    });

    test('should validate feedback_items.location', () => {
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
          feedback_items: [
            {
              description: 'Issue 1',
              location: {
                // Missing file
              },
            },
          ],
          status: 'open',
        },
      };

      const result = feedbackValidator.validate(invalidFeedback);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'feedback_items[0].location.file は必須です'
      );
    });

    test('should validate resolution_steps', () => {
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
          feedback_items: [
            {
              description: 'Issue 1',
            },
          ],
          status: 'open',
          resolution_steps: 'not-an-array', // Invalid (should be an array)
        },
      };

      const result = feedbackValidator.validate(invalidFeedback);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'resolution_steps は配列である必要があります'
      );
    });
  });

  describe('validateStatusTransition', () => {
    test('should validate valid status transition', () => {
      const result = feedbackValidator.validateStatusTransition(
        'open',
        'in_progress'
      );

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('should validate same status', () => {
      const result = feedbackValidator.validateStatusTransition('open', 'open');

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('should return error for invalid current status', () => {
      const result = feedbackValidator.validateStatusTransition(
        'invalid-status',
        'open'
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('不正な現在の状態です: invalid-status');
    });

    test('should return error for invalid new status', () => {
      const result = feedbackValidator.validateStatusTransition(
        'open',
        'invalid-status'
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('不正な新しい状態です: invalid-status');
    });

    test('should return error for invalid transition', () => {
      const result = feedbackValidator.validateStatusTransition('open', 'open'); // Valid

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();

      const invalidResult = feedbackValidator.validateStatusTransition(
        'resolved',
        'in_progress'
      );

      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.error).toBe(
        'resolved から in_progress への遷移は許可されていません'
      );
    });
  });

  describe('calculatePriority', () => {
    test('should calculate priority based on feedback type', () => {
      const feedback = {
        feedback_loop: {
          feedback_type: 'security', // 重み: 5
        },
      };

      const result = feedbackValidator.calculatePriority(feedback);

      expect(result).toBe(5);
    });

    test('should calculate priority based on test results', () => {
      const feedback = {
        feedback_loop: {
          feedback_type: 'code_quality', // 重み: 2
          test_results: {
            failed_tests: [{}, {}, {}], // 3つの失敗テスト: 3 * 2 = 6
            success_rate: 70, // (100 - 70) / 10 = 3
          },
        },
      };

      const result = feedbackValidator.calculatePriority(feedback);

      // 2 + 6 + 3 = 11 -> 最大値10に制限
      expect(result).toBe(10);
    });

    test('should calculate priority based on feedback items', () => {
      const feedback = {
        feedback_loop: {
          feedback_items: [
            { priority: 'high' }, // 高優先度: 2
            { priority: 'medium' }, // 通常: 1
            { priority: 'high' }, // 高優先度: 2
          ],
        },
      };

      const result = feedbackValidator.calculatePriority(feedback);

      // 3 (アイテム数) + 4 (高優先度) = 7
      expect(result).toBe(7);
    });

    test('should return minimum priority for invalid feedback', () => {
      const result = feedbackValidator.calculatePriority(null);

      expect(result).toBe(1);
    });
  });
});
