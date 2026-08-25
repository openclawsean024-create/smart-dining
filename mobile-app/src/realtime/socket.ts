import { io, Socket } from 'socket.io-client';
import {
  TRACKING_NAMESPACE,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '@smart-dining/contracts';

export type TrackingSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TrackingSocket | null = null;
let refCount = 0;

/**
 * 取得(或建立) Socket.IO 連線。採 lazy + 引用計數,
 * 引用歸零時主動斷線,避免行動裝置空轉連線。
 */
export function getSocket(): TrackingSocket {
  if (socket && socket.connected) return socket;
  if (socket) return socket; // reconnecting,reuse instance

  const url =
    (import.meta.env.VITE_WS_URL as string | undefined) ??
    (import.meta.env.VITE_API_BASE as string | undefined) ??
    '';

  socket = io(url + TRACKING_NAMESPACE, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 8000,
  }) as TrackingSocket;

  socket.on('connect', () => {
    // eslint-disable-next-line no-console
    console.info('[socket] connected', socket?.id);
  });
  socket.on('disconnect', (reason) => {
    // eslint-disable-next-line no-console
    console.warn('[socket] disconnected:', reason);
  });
  socket.on('connect_error', (err) => {
    // eslint-disable-next-line no-console
    console.warn('[socket] connect_error:', err.message);
  });

  return socket;
}

export function acquireSocket(): TrackingSocket {
  refCount += 1;
  return getSocket();
}

export function releaseSocket(): void {
  refCount = Math.max(0, refCount - 1);
  if (refCount === 0 && socket) {
    socket.disconnect();
    socket = null;
  }
}

export function isSocketConnected(): boolean {
  return Boolean(socket?.connected);
}
