/**
 * タスク管理ユーティリティのテスト
 */

const taskManager = require('../src/utils/task-manager');

// テスト用のヘルパー関数
function runTest(testName, testFn) {
  try {
    testFn();
    console.log(`✅ PASS: ${testName}`);
    return true;
  } catch (error) {
    console.error(`❌ FAIL: ${testName}`);
    console.error(`   Error: ${error.message}`);
    return false;
  }
}

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTrue(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed: expected true');
  }
}

function assertFalse(condition, message) {
  if (condition) {
    throw new Error(message || 'Assertion failed: expected false');
  }
}

// テストデータ
const validTask = {
  id: "T001",
  title: "テストタスク",
  description: "テスト用のタスク",
  status: "in_progress",
  dependencies: [],
  priority: 3,
  estimated_hours: 2,
  progress_percentage: 50,
  progress_state: "in_development",
  git_commits: []
};

const tasksWithDependencies = [
  {
    id: "T001",
    title: "タスク1",
    description: "タスク1の説明",
    status: "completed",
    dependencies: [],
    priority: 5,
    progress_percentage: 100,
    progress_state: "completed"
  },
  {
    id: "T002",
    title: "タスク2",
    description: "タスク2の説明",
    status: "in_progress",
    dependencies: [
      {
        task_id: "T001",
        type: "strong"
      }
    ],
    priority: 4,
    progress_percentage: 50,
    progress_state: "in_development"
  },
  {
    id: "T003",
    title: "タスク3",
    description: "タスク3の説明",
    status: "pending",
    dependencies: [
      {
        task_id: "T002",
        type: "strong"
      },
      {
        task_id: "T001",
        type: "weak"
      }
    ],
    priority: 3,
    progress_percentage: 0,
    progress_state: "not_started"
  }
];

// テストケース
const tests = [
  // タスク検証のテスト
  function testValidateTask() {
    const result = taskManager.validateTask(validTask);
    assertTrue(result.isValid, "有効なタスクは検証に合格するべき");
    assertEqual(result.errors.length, 0, "エラーがないはず");
    
    const invalidTask = { ...validTask, id: "invalid" };
    const invalidResult = taskManager.validateTask(invalidTask);
    assertFalse(invalidResult.isValid, "無効なIDを持つタスクは検証に失敗するべき");
    assertTrue(invalidResult.errors.length > 0, "エラーがあるはず");
    
    const missingFieldTask = { id: "T001", title: "Missing Fields" };
    const missingResult = taskManager.validateTask(missingFieldTask);
    assertFalse(missingResult.isValid, "必須フィールドがないタスクは検証に失敗するべき");
  },
  
  // 依存関係管理のテスト
  function testCheckDependencies() {
    const result = taskManager.checkDependencies("T003", tasksWithDependencies);
    assertTrue(result.isValid, "依存関係が正しいタスクは検証に合格するべき");
    
    // 循環依存のテスト
    const cyclicTasks = [
      ...tasksWithDependencies,
      {
        id: "T004",
        title: "タスク4",
        description: "タスク4の説明",
        status: "pending",
        dependencies: [
          {
            task_id: "T005",
            type: "strong"
          }
        ]
      },
      {
        id: "T005",
        title: "タスク5",
        description: "タスク5の説明",
        status: "pending",
        dependencies: [
          {
            task_id: "T004",
            type: "strong"
          }
        ]
      }
    ];
    
    const cyclicResult = taskManager.checkDependencies("T004", cyclicTasks);
    assertFalse(cyclicResult.isValid, "循環依存があるタスクは検証に失敗するべき");
    assertTrue(cyclicResult.errors.length > 0, "エラーがあるはず");
  },
  
  // 進捗管理のテスト
  function testCalculateProgress() {
    const progress = taskManager.calculateProgress("T002", tasksWithDependencies);
    assertEqual(progress, 50, "タスクT002の進捗率は50%のはず");
    
    const completedProgress = taskManager.calculateProgress("T001", tasksWithDependencies);
    assertEqual(completedProgress, 100, "完了したタスクの進捗率は100%のはず");
  },
  
  // タスクフィルタリングのテスト
  function testTaskFiltering() {
    const inProgressTasks = taskManager.getTasksByStatus(tasksWithDependencies, "in_progress");
    assertEqual(inProgressTasks.length, 1, "進行中のタスクは1つのはず");
    assertEqual(inProgressTasks[0].id, "T002", "進行中のタスクはT002のはず");
    
    const inDevTasks = taskManager.getTasksByProgressState(tasksWithDependencies, "in_development");
    assertEqual(inDevTasks.length, 1, "開発中のタスクは1つのはず");
    assertEqual(inDevTasks[0].id, "T002", "開発中のタスクはT002のはず");
  },
  
  // 進捗更新のテスト
  function testUpdateTaskProgress() {
    const tasks = JSON.parse(JSON.stringify(tasksWithDependencies)); // ディープコピー
    
    const result = taskManager.updateTaskProgress("T003", 30, "in_development", tasks);
    assertTrue(result.success, "タスクの進捗更新は成功するべき");
    
    const updatedTask = result.updatedTasks.find(t => t.id === "T003");
    assertEqual(updatedTask.progress_percentage, 30, "進捗率が30%に更新されているはず");
    assertEqual(updatedTask.progress_state, "in_development", "進捗状態が開発中に更新されているはず");
    assertEqual(updatedTask.status, "in_progress", "ステータスが進行中に更新されているはず");
  },
  
  // Git連携のテスト
  function testGitIntegration() {
    const tasks = JSON.parse(JSON.stringify(tasksWithDependencies)); // ディープコピー
    
    const result = taskManager.addGitCommitToTask("T002", "abc123", tasks);
    assertTrue(result.success, "Gitコミットの追加は成功するべき");
    
    const updatedTask = result.updatedTasks.find(t => t.id === "T002");
    assertTrue(updatedTask.git_commits.includes("abc123"), "コミットハッシュが追加されているはず");
    
    const extractedIds = taskManager.extractTaskIdsFromCommitMessage("Fix bug in login form #T001 and add tests #T002");
    assertEqual(extractedIds.length, 2, "2つのタスクIDが抽出されるはず");
    assertTrue(extractedIds.includes("T001"), "T001が抽出されるはず");
    assertTrue(extractedIds.includes("T002"), "T002が抽出されるはず");
  },
  
  // 進捗状態遷移のテスト
  function testProgressStateTransition() {
    const nextState = taskManager.getNextProgressState("in_development");
    assertEqual(nextState, "implementation_complete", "開発中の次の状態は実装完了のはず");
    
    const completedNextState = taskManager.getNextProgressState("completed");
    assertEqual(completedNextState, null, "完了状態の次の状態はないはず");
  },
  
  // タスク移行のテスト
  function testTaskMigration() {
    const oldTask = {
      id: "T001",
      title: "古い形式のタスク",
      description: "古い形式のタスクの説明",
      status: "in_progress",
      dependencies: ["T002"]
    };
    
    const migratedTask = taskManager.migrateTaskToNewFormat(oldTask);
    assertEqual(migratedTask.dependencies[0].task_id, "T002", "依存関係がオブジェクト形式に変換されているはず");
    assertEqual(migratedTask.dependencies[0].type, "strong", "依存タイプがstrongに設定されているはず");
    assertEqual(migratedTask.priority, 3, "優先度のデフォルト値が設定されているはず");
    assertEqual(migratedTask.progress_percentage, 50, "進捗率が推定されているはず");
    assertEqual(migratedTask.progress_state, "in_development", "進捗状態が推定されているはず");
    assertTrue(Array.isArray(migratedTask.git_commits), "git_commitsが配列として初期化されているはず");
  }
];

// テストの実行
console.log("タスク管理ユーティリティのテストを実行中...");
let passedCount = 0;
let failedCount = 0;

for (const test of tests) {
  const passed = runTest(test.name, test);
  if (passed) {
    passedCount++;
  } else {
    failedCount++;
  }
}

console.log(`\nテスト結果: ${passedCount}個成功, ${failedCount}個失敗`);
if (failedCount === 0) {
  console.log("すべてのテストが成功しました！");
} else {
  console.error("テストに失敗があります。");
  process.exit(1);
}