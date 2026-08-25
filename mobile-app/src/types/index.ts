/**
 * 手機 APP 共用型別入口。
 *
 * 透過 re-export @smart-dining/contracts 提供一致型別來源;
 * 並補充手機端專用的本地型別(Vibrate pattern、AppRoute 名稱)。
 */

export * from '@smart-dining/contracts';

export interface OrderViewModel {
  orderNo: string;
  pickupNumber: number;
  status: import('@smart-dining/contracts').OrderStatus;
  stage: import('@smart-dining/contracts').ProgressStage;
  percentage: number;
  estimatedReadyAt: string;
  items: import('@smart-dining/contracts').OrderItem[];
  subtotal: number;
  discount: number;
  totalAmount: number;
  createdAt: string;
  completedAt?: string | null;
}

export type RootStackName = 'track' | 'member' | 'history';

export type VibratePattern = number | number[];

export interface TrackingSubscription {
  orderNo: string;
  vibrateOnReady: boolean;
}
