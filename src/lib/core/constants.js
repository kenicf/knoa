/**
 * アプリケーション全体で使用される定数
 */

// TaskRepository および TaskValidator で使用
const PROGRESS_STATES = {
  not_started: {
    description: 'タスクがまだ開始されていない状態',
    default_percentage: 0,
  },
  planning: { description: 'タスクの計画段階', default_percentage: 10 },
  in_development: { description: '開発中の状態', default_percentage: 30 },
  implementation_complete: {
    description: '実装が完了した状態',
    default_percentage: 60,
  },
  in_review: { description: 'レビュー中の状態', default_percentage: 70 },
  review_complete: {
    description: 'レビューが完了した状態',
    default_percentage: 80,
  },
  in_testing: { description: 'テスト中の状態', default_percentage: 90 },
  completed: { description: 'タスクが完了した状態', default_percentage: 100 },
};

// TaskRepository で使用
const STATE_TRANSITIONS = {
  not_started: ['planning', 'in_development'],
  planning: ['in_development'],
  in_development: ['implementation_complete', 'in_review'],
  implementation_complete: ['in_review'],
  in_review: ['review_complete', 'in_development'],
  review_complete: ['in_testing'],
  in_testing: ['completed', 'in_development'],
  completed: [],
};

// FeedbackRepository および FeedbackValidator で使用
const FEEDBACK_STATE_TRANSITIONS = {
  open: ['in_progress', 'resolved', 'wontfix'],
  in_progress: ['resolved', 'wontfix', 'open'],
  resolved: ['open'],
  wontfix: ['open'],
};

// FeedbackRepository および FeedbackValidator で使用
const FEEDBACK_TYPE_WEIGHTS = {
  security: 5,
  functional: 5,
  performance: 4,
  ux: 3,
  code_quality: 2,
};

module.exports = {
  PROGRESS_STATES,
  STATE_TRANSITIONS,
  FEEDBACK_STATE_TRANSITIONS,
  FEEDBACK_TYPE_WEIGHTS,
};
