import fp from 'fastify-plugin';
import { Server, type Namespace } from 'socket.io';
import { env } from '../config/env.js';
import type {
  ServerToClientEvents, ClientToServerEvents, InterServerEvents, SocketData,
  TrackOrderRequest, TrackOrderResponse, KdsServerToClientEvents, JwtPayload,
} from '../../../shared-contracts/src/index.js';
import { KDS_NAMESPACE, orderRoom } from '../../../shared-contracts/src/realtime/events.js';

type TrackingServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type KdsNamespace = Namespace<Record<string, never>, KdsServerToClientEvents>;

declare module 'fastify' {
  interface FastifyInstance {
    io: TrackingServer;
    /** KDS／後台用的 namespace（需員工 JWT）。 */
    kds: KdsNamespace;
  }
}

export default fp(async (app) => {
  const io: TrackingServer = new Server(app.server, { cors: { origin: env.CORS_ORIGIN.split(',') } });

  // /tracking：顧客以訂單號追蹤進度（公開）
  io.of('/tracking').on('connection', (socket) => {
    socket.on('track:order', (payload: TrackOrderRequest, ack?: (r: TrackOrderResponse) => void) => {
      if (!payload || typeof payload.orderNo !== 'string') {
        ack?.({ ok: false, orderNo: '' });
        return;
      }
      void socket.join(orderRoom(payload.orderNo));
      ack?.({ ok: true, orderNo: payload.orderNo });
    });
  });

  // /kds：訂單異動通知，只給已登入且仍啟用的員工（AC-004、AC-011）
  const kds = io.of(KDS_NAMESPACE) as unknown as KdsNamespace;
  kds.use(async (socket, next) => {
    try {
      const token = (socket.handshake.auth as { token?: unknown } | undefined)?.token;
      if (typeof token !== 'string' || !token) throw new Error('missing token');
      const claims = app.jwt.verify<JwtPayload>(token);
      if (claims.kind !== 'staff') throw new Error('staff only');
      const staff = await app.prisma.staff.findUnique({ where: { id: claims.sub } });
      if (!staff || !staff.active) throw new Error('inactive');
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  app.decorate('io', io);
  app.decorate('kds', kds);
  app.addHook('onClose', async () => {
    await io.close();
  });
});
