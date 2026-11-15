/**
 * 台灣時區（Asia/Taipei）的「營業日」計算（AC-003）。
 *
 * 訂單號與取餐號每天從 1 開始；「每天」以台灣時間 00:00 為界，
 * 而且每次呼叫都以當下時間計算（不在模組載入時固定），服務跨日不需重啟。
 */
export const TAIPEI_TIME_ZONE = 'Asia/Taipei';

const ymdFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TAIPEI_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export interface TaipeiDay {
  /** 台灣日期，格式 YYYYMMDD（用於訂單號） */
  dateKey: string;
  /** 該台灣日 00:00:00 的時間點 */
  start: Date;
  /** 隔天台灣時間 00:00:00（不含） */
  end: Date;
}

export function taipeiDay(now: Date = new Date()): TaipeiDay {
  const parts = ymdFormatter.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const year = get('year');
  const month = get('month');
  const day = get('day');
  // 台灣沒有日光節約時間，固定為 UTC+8
  const start = new Date(`${year}-${month}-${day}T00:00:00+08:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { dateKey: `${year}${month}${day}`, start, end };
}
