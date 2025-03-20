# フィードバックレポート: {{task_id}}

## 概要

- **タスク**: {{task_id}}
- **実装試行回数**: {{implementation_attempt}}
- **コミット**: {{git_commit}}
- **ステータス**: {{feedback_status}}
- **テスト実行日時**: {{test_execution.timestamp}}

## テスト結果

- **結果**: {{passes_tests_text}}
- **テスト数**: {{test_summary.total}}
- **成功**: {{test_summary.passed}}
- **失敗**: {{test_summary.failed}}
- **スキップ**: {{test_summary.skipped}}
- **テスト種別**: {{test_types_formatted}}

{{#if has_failed_tests}}
### 失敗したテスト

{{#each failed_tests}}
#### {{test_name}}

- **エラー**: {{error}}
- **期待値**: {{expected}}
- **実際値**: {{actual}}
- **ファイル**: {{file_path}}:{{line_number}}

{{/each}}
{{/if}}

## 改善提案

{{#each suggestions}}
### {{type}} (優先度: {{priority}})

{{content}}

{{#if affected_files}}
**影響ファイル**:
{{#each affected_files}}
- {{this}}
{{/each}}
{{/if}}

{{/each}}

## 次のイテレーション計画

### 焦点領域

{{#each focus_areas}}
- {{this}}
{{/each}}

### アプローチ

{{approach}}

### 具体的なアクション

{{#each specific_actions}}
- [P{{priority}}] {{description}} {{#if file_path}}({{file_path}}){{/if}}
{{/each}}