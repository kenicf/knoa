/**
 * イベント名の定数定義
 *
 * 新旧のイベント名のマッピングを提供します。
 * イベント駆動アーキテクチャの標準化と後方互換性をサポートします。
 */

/**
 * イベント名の定数定義
 * 新旧のイベント名のマッピングを提供
 */
const EVENT_NAMES = {
  TASK: {
    CREATED: { new: 'task:task_created', old: 'task:created' },
    UPDATED: { new: 'task:task_updated', old: 'task:updated' },
    PROGRESS_UPDATED: {
      new: 'task:task_progress_updated',
      old: 'task:progress',
    },
    GIT_COMMIT_ADDED: { new: 'task:git_commit_added', old: 'task:commit' },
    TASKS_INITIALIZED: {
      new: 'task:tasks_initialized',
      old: 'task:initialized',
    },
  },
  SESSION: {
    CREATED: { new: 'session:session_created', old: 'session:started' },
    UPDATED: { new: 'session:session_updated', old: 'session:updated' },
    ENDED: { new: 'session:session_ended', old: 'session:ended' },
    TASK_ADDED: { new: 'session:task_added', old: 'session:task:added' },
    TASK_REMOVED: { new: 'session:task_removed', old: 'session:task:removed' },
    GIT_COMMIT_ADDED: {
      new: 'session:git_commit_added',
      old: 'session:commit:added',
    },
  },
  FEEDBACK: {
    CREATED: { new: 'feedback:feedback_created', old: 'feedback:created' },
    TEST_RESULTS_COLLECTED: {
      new: 'feedback:test_results_collected',
      old: 'feedback:test:collected',
    },
    PRIORITIZED: {
      new: 'feedback:feedback_prioritized',
      old: 'feedback:prioritized',
    },
    STATUS_UPDATED: {
      new: 'feedback:status_updated',
      old: 'feedback:status:updated',
    },
    INTEGRATED_WITH_SESSION: {
      new: 'feedback:integrated_with_session',
      old: 'feedback:integrated:session',
    },
    INTEGRATED_WITH_TASK: {
      new: 'feedback:integrated_with_task',
      old: 'feedback:integrated:task',
    },
  },
  STATE: {
    CHANGED: { new: 'state:state_changed', old: 'state:changed' },
    TRANSITION: { new: 'state:state_transition', old: 'state:transition' },
  },
  SYSTEM: {
    INITIALIZED: { new: 'system:initialized', old: 'system:init' },
    SHUTDOWN: { new: 'system:shutdown', old: 'system:exit' },
  },
  STORAGE: {
    FILE_READ: { new: 'storage:file_read', old: 'storage:file:read' },
    FILE_WRITE: { new: 'storage:file_write', old: 'storage:file:write' },
    FILE_DELETE: { new: 'storage:file_delete', old: 'storage:file:delete' },
  },
  INTEGRATION: {
    MANAGER_INITIALIZED: {
      new: 'integration:manager_initialized',
      old: 'integration:manager:initialized',
    },
  },
  LOG: {
    MESSAGE_CREATED: { new: 'log:message_created', old: 'log:entry' },
    ALERT_CREATED: { new: 'log:alert_created', old: 'log:alert' },
  },
  CACHE: {
    ITEM_SET: { new: 'cache:item_set', old: 'cache:set' },
    SYSTEM_INITIALIZED: {
      new: 'cache:system_initialized',
      old: 'cache:initialized',
    },
  },
};

/**
 * イベント名のマッピングを生成
 * @returns {Object} 新しいイベント名から古いイベント名へのマッピング
 */
function generateEventMap() {
  const eventMap = {};

  Object.values(EVENT_NAMES).forEach((category) => {
    Object.values(category).forEach((eventPair) => {
      eventMap[eventPair.new] = eventPair.old;
    });
  });

  return eventMap;
}

const EVENT_MAP = generateEventMap();

module.exports = {
  EVENT_NAMES,
  EVENT_MAP,
};
