# StorageServiceテスト改善計画

## 1. 問題の詳細分析

`StorageService`の`_emitEvent`メソッドでは、`emitStandardized`メソッドがあれば優先的に使用し、なければ従来の`emit`メソッドを使用しています。テストでは`mockEventEmitter`に`emitStandardized`メソッドを定義していますが、実際には呼び出しを検証していません。

`emitStandardized`メソッドの引数は以下の通りです：
1. `component` - コンポーネント名（例：'storage'）
2. `action` - アクション名（例：'directory:created'）
3. `data` - イベントデータ（オブジェクト）
4. `options` - オプション（オブジェクト、省略可能）

## 2. 修正の詳細計画

### 2.1 mockEventEmitterの修正

```javascript
mockEventEmitter = {
  emit: jest.fn().mockImplementation((eventName, data) => {
    console.log(`Event emitted: ${eventName}`, data);
    return true;
  }),
  emitStandardized: jest.fn().mockImplementation((component, eventName, data, options) => {
    console.log(`Standardized event emitted: ${component}:${eventName}`, data, options);
    return true;
  })
};
```

### 2.2 テストケースの修正パターン

#### パターン1: ディレクトリ作成イベント

```javascript
// 修正前
expect(mockEventEmitter.emit).toHaveBeenCalled();
expect(mockEventEmitter.emit.mock.calls[0][0]).toBe('storage:directory:created');
expect(mockEventEmitter.emit.mock.calls[0][1]).toEqual(expect.objectContaining({
  path: '/test/base/path/test-dir'
}));

// 修正後
expect(mockEventEmitter.emitStandardized).toHaveBeenCalled();
expect(mockEventEmitter.emitStandardized.mock.calls[0][0]).toBe('storage');
expect(mockEventEmitter.emitStandardized.mock.calls[0][1]).toBe('directory:created');
expect(mockEventEmitter.emitStandardized.mock.calls[0][2]).toEqual(expect.objectContaining({
  path: '/test/base/path/test-dir'
}));
```

#### パターン2: ファイル操作イベント（読み込み/書き込み）

```javascript
// 修正前
expect(mockEventEmitter.emit).toHaveBeenCalledTimes(1);
expect(mockEventEmitter.emit.mock.calls[0][0]).toBe('storage:file:read:before');
expect(mockEventEmitter.emit.mock.calls[0][1]).toEqual(expect.objectContaining({
  directory: 'test-dir',
  filename: 'test-file.json',
  type: 'json'
}));

// 修正後
expect(mockEventEmitter.emitStandardized).toHaveBeenCalledTimes(2); // before + after
expect(mockEventEmitter.emitStandardized.mock.calls[0][0]).toBe('storage');
expect(mockEventEmitter.emitStandardized.mock.calls[0][1]).toBe('file:read:before');
expect(mockEventEmitter.emitStandardized.mock.calls[0][2]).toEqual(expect.objectContaining({
  directory: 'test-dir',
  filename: 'test-file.json',
  type: 'json'
}));

// afterイベントの検証
expect(mockEventEmitter.emitStandardized.mock.calls[1][0]).toBe('storage');
expect(mockEventEmitter.emitStandardized.mock.calls[1][1]).toBe('file:read:after');
expect(mockEventEmitter.emitStandardized.mock.calls[1][2]).toEqual(expect.objectContaining({
  directory: 'test-dir',
  filename: 'test-file.json',
  type: 'json',
  success: true
}));
```

## 3. 具体的な修正内容

以下に、`tests/lib/utils/storage.test.js`の具体的な修正内容を示します。

### 3.1 テストファイルの修正

```javascript
describe('StorageService', () => {
  let storageService;
  let mockLogger;
  let mockEventEmitter;
  let mockErrorHandler;
  let fs;
  let path;

  beforeEach(() => {
    // モックのリセット
    jest.clearAllMocks();
    
    // fsとpathのモックを取得
    fs = require('fs');
    path = require('path');
    
    // パスの結合をシミュレート
    path.join.mockImplementation((...args) => args.join('/'));
    
    // モックロガー
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };
    
    // モックイベントエミッター（修正）
    mockEventEmitter = {
      emit: jest.fn().mockImplementation((eventName, data) => {
        console.log(`Event emitted: ${eventName}`, data);
        return true;
      }),
      emitStandardized: jest.fn().mockImplementation((component, eventName, data, options) => {
        console.log(`Standardized event emitted: ${component}:${eventName}`, data, options);
        return true;
      })
    };
    
    // モックエラーハンドラー
    mockErrorHandler = {
      handle: jest.fn()
    };
    
    // StorageServiceのインスタンス作成
    storageService = new StorageService({
      basePath: '/test/base/path',
      logger: mockLogger,
      eventEmitter: mockEventEmitter,
      errorHandler: mockErrorHandler
    });
    
    // モックをリセット
    jest.clearAllMocks();
  });

  // 以下、各テストケースの修正...
}
```

### 3.2 getFilePathテストの修正

```javascript
describe('getFilePath', () => {
  test('ディレクトリが存在する場合、正しいパスを返す', () => {
    // 変更なし
    fs.existsSync.mockReturnValue(true);
    
    const result = storageService.getFilePath('test-dir', 'test-file.json');
    
    expect(result).toBe('/test/base/path/test-dir/test-file.json');
    expect(path.join).toHaveBeenCalledWith('/test/base/path', 'test-dir');
    expect(path.join).toHaveBeenCalledWith('/test/base/path/test-dir', 'test-file.json');
    expect(fs.existsSync).toHaveBeenCalledWith('/test/base/path/test-dir');
    expect(fs.mkdirSync).not.toHaveBeenCalled();
  });

  test('ディレクトリが存在しない場合、ディレクトリを作成して正しいパスを返す', () => {
    fs.existsSync.mockReturnValue(false);
    
    const result = storageService.getFilePath('test-dir', 'test-file.json');
    
    expect(result).toBe('/test/base/path/test-dir/test-file.json');
    expect(path.join).toHaveBeenCalledWith('/test/base/path', 'test-dir');
    expect(path.join).toHaveBeenCalledWith('/test/base/path/test-dir', 'test-file.json');
    expect(fs.existsSync).toHaveBeenCalledWith('/test/base/path/test-dir');
    expect(fs.mkdirSync).toHaveBeenCalledWith('/test/base/path/test-dir', { recursive: true });
    
    // イベント発行の検証を修正
    expect(mockEventEmitter.emitStandardized).toHaveBeenCalled();
    expect(mockEventEmitter.emitStandardized.mock.calls[0][0]).toBe('storage');
    expect(mockEventEmitter.emitStandardized.mock.calls[0][1]).toBe('directory:created');
    expect(mockEventEmitter.emitStandardized.mock.calls[0][2]).toEqual(expect.objectContaining({
      path: '/test/base/path/test-dir'
    }));
  });
});
```

### 3.3 ensureDirectoryExistsテストの修正

```javascript
describe('ensureDirectoryExists', () => {
  test('ディレクトリが存在する場合、何もしない', () => {
    // 変更なし
    fs.existsSync.mockReturnValue(true);
    
    storageService.ensureDirectoryExists('/test/dir');
    
    expect(fs.existsSync).toHaveBeenCalledWith('/test/dir');
    expect(fs.mkdirSync).not.toHaveBeenCalled();
    expect(mockEventEmitter.emitStandardized).not.toHaveBeenCalled();
  });

  test('ディレクトリが存在しない場合、ディレクトリを作成する', () => {
    fs.existsSync.mockReturnValue(false);
    
    storageService.ensureDirectoryExists('/test/dir');
    
    expect(fs.existsSync).toHaveBeenCalledWith('/test/dir');
    expect(fs.mkdirSync).toHaveBeenCalledWith('/test/dir', { recursive: true });
    
    // イベント発行の検証を修正
    expect(mockEventEmitter.emitStandardized).toHaveBeenCalled();
    expect(mockEventEmitter.emitStandardized.mock.calls[0][0]).toBe('storage');
    expect(mockEventEmitter.emitStandardized.mock.calls[0][1]).toBe('directory:created');
    expect(mockEventEmitter.emitStandardized.mock.calls[0][2]).toEqual(expect.objectContaining({
      path: '/test/dir'
    }));
  });

  // エラーハンドリングのテストは変更なし
});
```

### 3.4 readJSONテストの修正

```javascript
describe('readJSON', () => {
  test('ファイルが存在する場合、JSONオブジェクトを返す', () => {
    fs.existsSync.mockReturnValue(true);
    
    const jsonContent = '{"key": "value"}';
    fs.readFileSync.mockReturnValue(jsonContent);
    
    const result = storageService.readJSON('test-dir', 'test-file.json');
    
    expect(result).toEqual({ key: 'value' });
    expect(fs.existsSync).toHaveBeenCalledWith('/test/base/path/test-dir/test-file.json');
    expect(fs.readFileSync).toHaveBeenCalledWith('/test/base/path/test-dir/test-file.json', 'utf8');
    
    // イベント発行の検証を修正
    expect(mockEventEmitter.emitStandardized).toHaveBeenCalledTimes(2);
    expect(mockEventEmitter.emitStandardized.mock.calls[0][0]).toBe('storage');
    expect(mockEventEmitter.emitStandardized.mock.calls[0][1]).toBe('file:read:before');
    expect(mockEventEmitter.emitStandardized.mock.calls[0][2]).toEqual(expect.objectContaining({
      directory: 'test-dir',
      filename: 'test-file.json',
      type: 'json'
    }));
    
    expect(mockEventEmitter.emitStandardized.mock.calls[1][0]).toBe('storage');
    expect(mockEventEmitter.emitStandardized.mock.calls[1][1]).toBe('file:read:after');
    expect(mockEventEmitter.emitStandardized.mock.calls[1][2]).toEqual(expect.objectContaining({
      directory: 'test-dir',
      filename: 'test-file.json',
      type: 'json',
      success: true
    }));
  });

  // 他のテストケースも同様に修正
});
```

## 4. 実装手順

1. テストファイルのバックアップを作成
2. `mockEventEmitter`の実装を修正
3. 各テストケースのイベント発行検証部分を修正
4. テストを実行して結果を確認
5. 必要に応じて追加の修正を行う

## 5. 期待される結果

- すべてのテストが成功するようになる
- イベント発行の検証が正確に行われる
- 依存性注入の導入後もStorageServiceが正常に機能することが確認できる