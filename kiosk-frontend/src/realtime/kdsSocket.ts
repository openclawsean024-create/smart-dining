/**
 * KDS 即時通知(Socket.IO /kds namespace,需員工 JWT;AC-004)。
 *
 * 後端在訂單建立或狀態變更時送出 kds:orderChanged;KDS 收到後重新抓清單。
 * 連不上時 KDS 仍會定時輪詢,所以這裡不需要處理重試以外的錯誤。
 */
import { io, type Socket } from 'socket.io-client';
import { KDS_NAMESPACE } from '@smart-dining/contracts';
import type { KdsOrderChangedEvent, KdsServerToClientEvents } from '@smart-dining/contracts';

const API_BASE: string = (import.meta.env.VITE_API_BASE ?? '').replace(/\/+$/, '');

export interface KdsSubscription {
  /** 取消訂閱並斷線 */
  close: () => void;
}

export function subscribeKds(
  token: string,
  handlers: {
    onChange: (event: KdsOrderChangedEvent) => void;
    onConnectionChange?: (connected: boolean) => void;
  },
): KdsSubscription {
  const socket: Socket<KdsServerToClientEvents> = io(API_BASE + KDS_NAMESPACE, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    auth: { token },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });
  socket.on('kds:orderChanged', handlers.onChange);
  socket.on('connect', () => handlers.onConnectionChange?.(true));
  socket.on('disconnect', () => handlers.onConnectionChange?.(false));
  socket.on('connect_error', () => handlers.onConnectionChange?.(false));
  return {
    close: () => {
      socket.removeAllListeners();
      socket.disconnect();
    },
  };
}
