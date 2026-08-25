/**
 * 製作階段定義
 *
 * 流程:QUEUED → PREPARING → COOKING → PLATING → READY
 * 結束後訂單進入 COMPLETED(或 CANCELLED)。
 *
 * 每階段皆提供:
 *   - displayName: 終端使用者看到的文案
 *   - percentage:  進度條百分比(用於手機 APP 進度視覺化)
 *   - estimatedSeconds: 此階段典型耗時(用於後端預估 estimatedReadyAt)
 */

export const PROGRESS_STAGES = [
  'QUEUED',
  'PREPARING',
  'COOKING',
  'PLATING',
  'READY',
] as const;

export type ProgressStage = (typeof PROGRESS_STAGES)[number];

export interface ProgressStageMeta {
  stage: ProgressStage;
  displayName: string;
  percentage: number;
  estimatedSeconds: number;
}

export const PROGRESS_STAGE_MAP: Record<ProgressStage, ProgressStageMeta> = {
  QUEUED: {
    stage: 'QUEUED',
    displayName: '已成立訂單,排隊中',
    percentage: 10,
    estimatedSeconds: 30,
  },
  PREPARING: {
    stage: 'PREPARING',
    displayName: '廚房準備中',
    percentage: 30,
    estimatedSeconds: 45,
  },
  COOKING: {
    stage: 'COOKING',
    displayName: '製作中',
    percentage: 60,
    estimatedSeconds: 90,
  },
  PLATING: {
    stage: 'PLATING',
    displayName: '盛盤中',
    percentage: 85,
    estimatedSeconds: 30,
  },
  READY: {
    stage: 'READY',
    displayName: '可取餐',
    percentage: 100,
    estimatedSeconds: 0,
  },
};

/**
 * 取得下一階段;若已為 READY 則回傳 null(由後端決定是否進入 COMPLETED)。
 */
export function getNextStage(current: ProgressStage): ProgressStage | null {
  const idx = PROGRESS_STAGES.indexOf(current);
  if (idx < 0 || idx >= PROGRESS_STAGES.length - 1) return null;
  return PROGRESS_STAGES[idx + 1];
}
