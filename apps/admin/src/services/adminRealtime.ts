import { io, Socket } from 'socket.io-client';
import { SERVER_ORIGIN } from '../config/api';

// Admin-side Socket.IO connector for the live-ops map. Separate from
// packages/shared's realtime.ts (that one reads the token from
// expo-secure-store, which doesn't exist on the web) -- this reads from the
// same localStorage key store/authSlice.ts already uses ('adminToken').

let socket: Socket | null = null;

export function getAdminSocket(): Socket {
  const token = localStorage.getItem('adminToken');

  if (socket && socket.auth && (socket.auth as any).token !== token) {
    socket.disconnect();
    socket = null;
  }

  if (socket?.connected || socket?.active) return socket;

  socket = io(SERVER_ORIGIN, {
    path: '/socket.io',
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });

  socket.on('connect_error', (err) => console.log('[admin-realtime] connect_error:', err.message));

  return socket;
}

export function disconnectAdminSocket(): void {
  socket?.disconnect();
  socket = null;
}
