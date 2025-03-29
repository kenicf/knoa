/**
 * アプリケーション設定
 *
 * 環境ごとの設定を管理します。
 */

const path = require('path');

// 基本設定
const config = {
  // 環境設定
  env: process.env.NODE_ENV || 'development',

  // ストレージ設定
  storage: {
    basePath: process.cwd(),
  },

  // Git設定
  git: {
    repoPath: process.cwd(),
  },

  // セッション設定
  session: {
    sessionsDir: path.join(process.cwd(), 'ai-context', 'sessions'),
    templateDir: path.join(process.cwd(), 'src', 'templates', 'docs'),
  },

  // フィードバック設定
  feedback: {
    feedbackDir: path.join(process.cwd(), 'ai-context', 'feedback'),
    templateDir: path.join(process.cwd(), 'src', 'templates', 'docs'),
  },

  // ロガー設定
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    format: 'text',
    timestamp: true,
  },

  // イベントエミッター設定
  eventEmitter: {
    debugMode: process.env.EVENT_DEBUG === 'true',
    keepHistory: process.env.EVENT_HISTORY === 'true',
    historyLimit: parseInt(process.env.EVENT_HISTORY_LIMIT || '100', 10),
  },

  // エラーハンドラー設定
  errorHandler: {
    enableDetailedLogs: true,
    recoveryAttempts: 3,
  },

  // キャッシュ設定
  cache: {
    ttl: 60000, // 1分
    maxSize: 100,
  },

  // ロック設定
  lock: {
    timeout: 5000, // 5秒
  },

  // 状態設定
  state: {
    persistPath: path.join(process.cwd(), 'ai-context', 'state'),
  },
};

// 環境ごとの設定をマージ
if (config.env === 'development') {
  Object.assign(config, {
    logger: {
      ...config.logger,
      level: 'debug',
    },
  });
} else if (config.env === 'production') {
  Object.assign(config, {
    logger: {
      ...config.logger,
      level: 'info',
    },
  });
} else if (config.env === 'test') {
  Object.assign(config, {
    storage: {
      ...config.storage,
      basePath: path.join(process.cwd(), 'test-data'),
    },
    logger: {
      ...config.logger,
      level: 'error',
    },
  });
}

module.exports = config;
