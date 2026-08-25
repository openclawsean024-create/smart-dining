/**
 * Socket.IO 事件契約
 *
 * Namespace: '/tracking'
 * 房間命名: 'order:' + orderNo
 *
 * 方向說明:
 *   - C2S = Client → Server
 *   - S2C = Server → Client
 */

import type { OrderStatus } from '../types/order.js';
import type { ProgressStage } from './stages.js';

// ============================================================
// Client → Server
// ============================================================

export interface TrackOrderRequest {
  orderNo: string;
}

export interface TrackOrderResponse {
  ok: boolean;
  orderNo: string;
}

// ============================================================
// Server → Client
// ============================================================

export interface OrderStatusChangedEvent {
  orderNo: string;
  status: OrderStatus;
  pickupNumber: number;
  timestamp: string; // ISO 8601
  stage: ProgressStage;
}

export interface OrderProgressEvent {
  orderNo: string;
  stage: ProgressStage;
  percentage: number;
  estimatedReadyAt: string; // ISO 8601
}

export interface OrderReadyEvent {
  orderNo: string;
  pickupNumber: number;
  timestamp: string; // ISO 8601
}

// ============================================================
// Socket.IO Event Map
// ============================================================

export interface ClientToServerEvents {
  'track:order': (
    payload: TrackOrderRequest,
    ack?: (response: TrackOrderResponse) => void,
  ) => void;
}

export interface ServerToClientEvents {
  'order:statusChanged': (payload: OrderStatusChangedEvent) => void;
  'order:progress': (payload: OrderProgressEvent) => void;
  'order:ready': (payload: OrderReadyEvent) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  memberId?: string;
}

export const TRACKING_NAMESPACE = '/tracking';
export const orderRoom = (orderNo: string): string => `order:${orderNo}`;
