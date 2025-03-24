/**
 * 状態管理マネージャーのテスト
 */

const StateManager = require('../../../src/lib/managers/state-manager');
const { createMockDependencies } = require('../../helpers/mock-factory');

describe('StateManager', () => {
  let stateManager;
  let mockDeps;
  
  beforeEach(() => {
    // モック依存関係の作成
    mockDeps = createMockDependencies();
    
    // StateManagerのインスタンスを作成
    stateManager = new StateManager({
      logger: mockDeps.logger,
      eventEmitter: mockDeps.eventEmitter,
      errorHandler: mockDeps.errorHandler,
      config: {
        // 必要に応じて設定を追加
      }
    });
  });
  
  describe('基本機能', () => {
    test('初期状態がUNINITIALIZEDであること', () => {
      expect(stateManager.getCurrentState()).toBe(stateManager.states.UNINITIALIZED);
    });
    
    test('状態履歴が初期化されていること', () => {
      const history = stateManager.getStateHistory();
      expect(history).toHaveLength(1);
      expect(history[0].state).toBe(stateManager.states.UNINITIALIZED);
    });
  });
  
  describe('状態遷移', () => {
    test('有効な状態遷移が成功すること', () => {
      // UNINITIALIZED -> INITIALIZED
      expect(stateManager.canTransitionTo(stateManager.states.INITIALIZED)).toBe(true);
      expect(stateManager.transitionTo(stateManager.states.INITIALIZED)).toBe(true);
      expect(stateManager.getCurrentState()).toBe(stateManager.states.INITIALIZED);
      
      // INITIALIZED -> SESSION_STARTED
      expect(stateManager.canTransitionTo(stateManager.states.SESSION_STARTED)).toBe(true);
      expect(stateManager.transitionTo(stateManager.states.SESSION_STARTED)).toBe(true);
      expect(stateManager.getCurrentState()).toBe(stateManager.states.SESSION_STARTED);
    });
    
    test('無効な状態遷移が失敗すること', () => {
      // UNINITIALIZED -> TASK_IN_PROGRESS (無効)
      expect(stateManager.canTransitionTo(stateManager.states.TASK_IN_PROGRESS)).toBe(false);
      expect(() => {
        stateManager.transitionTo(stateManager.states.TASK_IN_PROGRESS);
      }).toThrow();
      expect(stateManager.getCurrentState()).toBe(stateManager.states.UNINITIALIZED);
    });
    
    test('状態遷移時にイベントが発行されること', () => {
      stateManager.transitionTo(stateManager.states.INITIALIZED);
      
      expect(mockDeps.eventEmitter.emit).toHaveBeenCalledWith(
        'state:changed',
        expect.objectContaining({
          prevState: stateManager.states.UNINITIALIZED,
          newState: stateManager.states.INITIALIZED
        })
      );
    });
  });
  
  describe('状態の直接設定', () => {
    test('有効な状態を設定できること', () => {
      expect(stateManager.setState(stateManager.states.INITIALIZED)).toBe(true);
      expect(stateManager.getCurrentState()).toBe(stateManager.states.INITIALIZED);
    });
    
    test('無効な状態を設定するとエラーになること', () => {
      expect(() => {
        stateManager.setState('invalid_state');
      }).toThrow();
    });
    
    test('状態設定時にイベントが発行されること', () => {
      stateManager.setState(stateManager.states.INITIALIZED);
      
      expect(mockDeps.eventEmitter.emit).toHaveBeenCalledWith(
        'state:changed',
        expect.objectContaining({
          prevState: stateManager.states.UNINITIALIZED,
          newState: stateManager.states.INITIALIZED
        })
      );
    });
  });
  
  describe('状態履歴', () => {
    test('状態履歴が正しく記録されること', () => {
      stateManager.transitionTo(stateManager.states.INITIALIZED);
      stateManager.transitionTo(stateManager.states.SESSION_STARTED);
      
      const history = stateManager.getStateHistory();
      expect(history).toHaveLength(3);
      expect(history[0].state).toBe(stateManager.states.UNINITIALIZED);
      expect(history[1].state).toBe(stateManager.states.INITIALIZED);
      expect(history[2].state).toBe(stateManager.states.SESSION_STARTED);
    });
    
    test('制限付きで状態履歴を取得できること', () => {
      stateManager.transitionTo(stateManager.states.INITIALIZED);
      stateManager.transitionTo(stateManager.states.SESSION_STARTED);
      
      const limitedHistory = stateManager.getStateHistory(2);
      expect(limitedHistory).toHaveLength(2);
      expect(limitedHistory[0].state).toBe(stateManager.states.INITIALIZED);
      expect(limitedHistory[1].state).toBe(stateManager.states.SESSION_STARTED);
    });
  });
  
  describe('前の状態', () => {
    test('前の状態を取得できること', () => {
      stateManager.transitionTo(stateManager.states.INITIALIZED);
      expect(stateManager.getPreviousState()).toBe(stateManager.states.UNINITIALIZED);
      
      stateManager.transitionTo(stateManager.states.SESSION_STARTED);
      expect(stateManager.getPreviousState()).toBe(stateManager.states.INITIALIZED);
    });
    
    test('状態履歴が1つしかない場合はnullを返すこと', () => {
      // 初期状態のみの場合
      const newStateManager = new StateManager({
        logger: mockDeps.logger
      });
      
      expect(newStateManager.getPreviousState()).toBeNull();
    });
  });
  
  describe('状態変更リスナー', () => {
    test('リスナーが状態変更時に呼び出されること', () => {
      const mockListener = jest.fn();
      stateManager.registerStateChangeListener(mockListener);
      
      stateManager.transitionTo(stateManager.states.INITIALIZED);
      
      expect(mockListener).toHaveBeenCalledWith(
        stateManager.states.UNINITIALIZED,
        stateManager.states.INITIALIZED,
        expect.any(Object)
      );
    });
    
    test('リスナー解除関数が正しく動作すること', () => {
      const mockListener = jest.fn();
      const unregister = stateManager.registerStateChangeListener(mockListener);
      
      // リスナー解除前
      stateManager.transitionTo(stateManager.states.INITIALIZED);
      expect(mockListener).toHaveBeenCalledTimes(1);
      
      // リスナー解除
      unregister();
      
      // リスナー解除後
      stateManager.transitionTo(stateManager.states.SESSION_STARTED);
      expect(mockListener).toHaveBeenCalledTimes(1); // 呼び出し回数が変わらないこと
    });
  });
  
  describe('エラー状態', () => {
    test('エラー状態にリセットできること', () => {
      // 通常の状態遷移
      stateManager.transitionTo(stateManager.states.INITIALIZED);
      stateManager.transitionTo(stateManager.states.SESSION_STARTED);
      
      // エラー状態に設定
      stateManager.setState(stateManager.states.ERROR);
      expect(stateManager.getCurrentState()).toBe(stateManager.states.ERROR);
      
      // エラー状態をリセット
      expect(stateManager.resetErrorState()).toBe(true);
      expect(stateManager.getCurrentState()).toBe(stateManager.states.SESSION_STARTED);
    });
    
    test('エラー状態でない場合はリセットに失敗すること', () => {
      stateManager.transitionTo(stateManager.states.INITIALIZED);
      expect(stateManager.resetErrorState()).toBe(false);
      expect(stateManager.getCurrentState()).toBe(stateManager.states.INITIALIZED);
    });
  });
});