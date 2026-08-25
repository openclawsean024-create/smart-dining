import { useEffect, useMemo, useRef, useState } from 'react';
import {
  type Order,
  type OrderProgressEvent,
  type OrderReadyEvent,
  type OrderStatusChangedEvent,
  type ProgressStage,
  PROGRESS_STAGE_MAP,
} from '@smart-dining/contracts';
import { getOrder } from '../api/orders';
import { acquireSocket, releaseSocket } from '../realtime/socket';
import { useTrackStore } from '../store/trackStore';

export interface OrderTrackingState {
  order: Order | null;
  stage: ProgressStage | null;
  percentage: number;
  estimatedReadyAt: string | null;
  lastEvent: 'statusChanged' | 'progress' | 'ready' | 'rest' | null;
  isReady: boolean;
  isConnected: boolean;
  isPolling: boolean;
  error: Error | null;
}

const initial: OrderTrackingState = {
  order: null,
  stage: null,
  percentage: 0,
  estimatedReadyAt: null,
  lastEvent: null,
  isReady: false,
  isConnected: false,
  isPolling: false,
  error: null,
};

/**
 * 訂單即時追蹤 hook:
 *   1. 初次載入以 REST 取得訂單細節(SWR 風格);
 *   2. 進入時訂閱 Socket.IO 房間,離開時取消;
 *   3. 連線失敗時 fallback 為每 10 秒輪詢。
 */
export function useOrderTracking(orderNo: string | null): OrderTrackingState {
  const [state, setState] = useState<OrderTrackingState>(initial);
  const pollTimer = useRef<number | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!orderNo) {
      setState(initial);
      return;
    }

    const vibrateOnReady = useTrackStore.getState().vibrateOnReady;
    const socket = acquireSocket();
    let lastStage: ProgressStage | null = null;
    let readyFired = false;

    const stopPolling = () => {
      if (pollTimer.current !== null) {
        window.clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
      if (mountedRef.current) {
        setState((s) => ({ ...s, isPolling: false }));
      }
    };

    const startPolling = () => {
      if (pollTimer.current !== null) return;
      const tick = async () => {
        try {
          const { order } = await getOrder(orderNo);
          if (!mountedRef.current) return;
          setState((s) => ({
            ...s,
            order,
            stage: lastStage ?? inferStageFromStatus(order.status),
            percentage: lastStage
              ? PROGRESS_STAGE_MAP[lastStage].percentage
              : percentageFromStatus(order.status),
            estimatedReadyAt: s.estimatedReadyAt ?? order.estimatedReadyAt,
            isPolling: true,
            isReady: order.status === 'READY',
            lastEvent: s.lastEvent ?? 'rest',
          }));
        } catch (err) {
          if (!mountedRef.current) return;
          setState((s) => ({ ...s, error: err as Error }));
        }
      };
      void tick();
      pollTimer.current = window.setInterval(tick, 10_000);
    };

    const onConnect = () => {
      if (!mountedRef.current) return;
      setState((s) => ({ ...s, isConnected: true }));
      stopPolling();
      socket.emit('track:order', { orderNo }, (resp) => {
        if (!resp?.ok) {
          // server rejected track — fall back to polling
          startPolling();
        }
      });
    };

    const onDisconnect = () => {
      if (!mountedRef.current) return;
      setState((s) => ({ ...s, isConnected: false }));
      startPolling();
    };

    const onStatusChanged = (payload: OrderStatusChangedEvent) => {
      if (payload.orderNo !== orderNo || !mountedRef.current) return;
      lastStage = payload.stage;
      setState((s) => ({
        ...s,
        stage: payload.stage,
        percentage: PROGRESS_STAGE_MAP[payload.stage].percentage,
        order: s.order
          ? { ...s.order, status: payload.status, pickupNumber: payload.pickupNumber }
          : s.order,
        lastEvent: 'statusChanged',
        isReady: payload.status === 'READY',
      }));
      if (payload.status === 'READY') {
        readyFired = true;
        tryVibrate(vibrateOnReady);
      }
    };

    const onProgress = (payload: OrderProgressEvent) => {
      if (payload.orderNo !== orderNo || !mountedRef.current) return;
      lastStage = payload.stage;
      setState((s) => ({
        ...s,
        stage: payload.stage,
        percentage: payload.percentage,
        estimatedReadyAt: payload.estimatedReadyAt,
        lastEvent: 'progress',
      }));
    };

    const onReady = (payload: OrderReadyEvent) => {
      if (payload.orderNo !== orderNo || !mountedRef.current) return;
      if (readyFired) return;
      readyFired = true;
      tryVibrate(vibrateOnReady);
      setState((s) => ({
        ...s,
        isReady: true,
        stage: 'READY',
        percentage: 100,
        order: s.order ? { ...s.order, status: 'READY', pickupNumber: payload.pickupNumber } : s.order,
        lastEvent: 'ready',
      }));
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('order:statusChanged', onStatusChanged);
    socket.on('order:progress', onProgress);
    socket.on('order:ready', onReady);

    // 立即更新一次連線狀態
    if (socket.connected) {
      onConnect();
    } else {
      // 還沒連上,先以 REST 取得初始資料並進入輪詢
      startPolling();
    }

    // REST 初始 fetch
    (async () => {
      try {
        const { order } = await getOrder(orderNo);
        if (!mountedRef.current) return;
        const stage = inferStageFromStatus(order.status);
        setState((s) => ({
          ...s,
          order,
          stage: s.stage ?? stage,
          percentage: s.percentage || (stage ? PROGRESS_STAGE_MAP[stage].percentage : 0),
          estimatedReadyAt: order.estimatedReadyAt,
          isReady: order.status === 'READY',
        }));
      } catch (err) {
        if (!mountedRef.current) return;
        setState((s) => ({ ...s, error: err as Error, isPolling: true }));
      }
    })();

    return () => {
      // event map 僅宣告 track:order;untrack 由 disconnect 自動處理(releaseSocket)
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('order:statusChanged', onStatusChanged);
      socket.off('order:progress', onProgress);
      socket.off('order:ready', onReady);
      stopPolling();
      releaseSocket();
    };
  }, [orderNo]);

  return state;
}

function tryVibrate(pattern: boolean) {
  if (!pattern) return;
  if (typeof navigator === 'undefined') return;
  if (typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate([300, 100, 300, 100, 300]);
  } catch {
    /* noop */
  }
}

function inferStageFromStatus(status: Order['status']): ProgressStage | null {
  switch (status) {
    case 'QUEUED':
      return 'QUEUED';
    case 'PREPARING':
      return 'PREPARING';
    case 'COOKING':
      return 'COOKING';
    case 'PLATING':
      return 'PLATING';
    case 'READY':
    case 'COMPLETED':
      return 'READY';
    case 'CANCELLED':
      return null;
    default:
      return null;
  }
}

function percentageFromStatus(status: Order['status']): number {
  const stage = inferStageFromStatus(status);
  return stage ? PROGRESS_STAGE_MAP[stage].percentage : 0;
}
