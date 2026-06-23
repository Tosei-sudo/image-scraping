const STATE = {
    READY: 0,      // 準備完了
    UNACQUIRED: 1, // 未取得
    OBTAINING: 2,  // 取得中
    OBTAINED: 3,   // 取得済
    SAVED: 4,      // 保存済
    FAILED: 5,     // 失敗
    LOADING: 99,   // ロード中
};

export { STATE };