/**
 * 訂單狀態變更的 Socket.IO 廣播（/tracking namespace，房間 order:<orderNo>）。
 * admin advance 與 PATCH status 共用。
 */
import type { FastifyInstance } from 'fastify';
import type { OrderStatus } from '../../../shared-contracts/src/index.js';
import { PROGRESS_STAGE_MAP, type ProgressStage } from '../../../shared-contracts/src/realtime/stages.js';
import { orderRoom } from '../../../shared-contracts/src/realtime/events.js';

export function broadcastStatusChange(
  app: FastifyInstance,
  order: { orderNo: string; pickupNumber: number; estimatedReadyAt: Date },
  status: OrderStatus,
): void {
  const timestamp = new Date().toISOString();
  const room = app.io.of('/tracking').to(orderRoom(order.orderNo));

  // 通知 KDS／後台重新整理（只有已登入的員工連得上 /kds）
  app.kds.emit('kds:orderChanged', { orderNo: order.orderNo, status, reason: 'status' });

  // 1. order:statusChanged — 所有狀態變更都發
  room.emit('order:statusChanged', {
    orderNo: order.orderNo,
    status,
    pickupNumber: order.pickupNumber,
    timestamp,
    stage: status as ProgressStage,
  });

  // 2. order:progress — 製作階段
  if (status === 'PREPARING' || status === 'COOKING' || status === 'PLATING' || status === 'READY') {
    room.emit('order:progress', {
      orderNo: order.orderNo,
      stage: status,
      percentage: PROGRESS_STAGE_MAP[status].percentage,
      estimatedReadyAt: order.estimatedReadyAt.toISOString(),
    });
  }

  // 3. order:ready — 可取餐
  if (status === 'READY') {
    room.emit('order:ready', { orderNo: order.orderNo, pickupNumber: order.pickupNumber, timestamp });
  }
}
