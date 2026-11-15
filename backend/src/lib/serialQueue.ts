/**
 * 依序執行的工作佇列（同一個 backend 行程內）。
 *
 * 建立訂單時要在同一個交易內決定訂單號、取餐號、扣庫存、使用優惠券。
 * SQLite 同一時間只允許一個寫入交易；多筆訂單同時進來時，交易會互相等鎖，
 * 在較慢的機器上會逾時變成 500（CI 實測）。把建單交易排隊執行，可以：
 *   - 避免鎖競爭與逾時
 *   - 讓流水號、取餐號依序產生，不靠撞號重試
 * 前提：backend 為單一行程（目前的部署方式，SPEC §7 要求長連線環境）。
 * 改成多行程或 PostgreSQL 時，需改用資料庫層級的鎖或序列。
 */
export type SerialQueue = <T>(task: () => Promise<T>) => Promise<T>;

export function createSerialQueue(): SerialQueue {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(task: () => Promise<T>): Promise<T> => {
    const run = tail.then(task, task);
    // 失敗的工作不能卡住後面的工作
    tail = run.catch(() => undefined);
    return run;
  };
}
