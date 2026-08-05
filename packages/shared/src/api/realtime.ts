import { io, Socket } from 'socket.io-client';
import { getApiBaseUrl } from './client';
import * as SecureStore from 'expo-secure-store';

// Thin Socket.IO wrapper shared by every RN app (mobile, mechanic,
// admin-mobile, seller-mobile, rider). One socket per app process, connected
// lazily on first use and reused for the app's lifetime -- mirrors how
// apiClient in client.ts is a single shared axios instance rather than one
// per screen.
//
// Auth: the same Bearer JWT the REST client uses, read from SecureStore at
// connect time and passed via `auth.token` in the handshake (gateway.ts on
// the backend reads it from there first, falling back to an Authorization
// header for non-RN callers).

let socket: Socket | null = null;
let currentToken: string | null = null;

function deriveSocketUrl(): string {
  // getApiBaseUrl() returns something like https://mechbazar.com/api or
  // http://192.168.x.x:5001/api -- Socket.IO connects to the origin, not the
  // /api path (the gateway is mounted at /socket.io on the same HTTP server).
  const apiUrl = getApiBaseUrl();
  return apiUrl.replace(/\/api\/?$/, '');
}

/**
 * Returns the shared socket, creating and connecting it on first call. Safe
 * to call from anywhere -- screens don't need to know whether a connection
 * already exists.
 */
export async function getSocket(): Promise<Socket> {
  const token = await SecureStore.getItemAsync('token');

  // Reconnect fresh if the token changed since the last connect (login,
  // logout, or a token refresh) -- a stale socket would keep acting as
  // whichever user connected it first.
  if (socket && currentToken !== token) {
    socket.disconnect();
    socket = null;
  }

  if (socket?.connected || socket?.active) return socket;

  currentToken = token;
  socket = io(deriveSocketUrl(), {
    path: '/socket.io',
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 10000,
    autoConnect: true,
  });

  socket.on('connect_error', (err) => {
    console.log('[realtime] connect_error:', err.message);
  });
  socket.on('session:invalidated', (payload: { reason: string }) => {
    console.log('[realtime] session invalidated:', payload.reason);
  });

  return socket;
}

/** Tears the socket down entirely -- call on logout so the next login gets a clean connection. */
export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
  currentToken = null;
}

/**
 * Subscribes to a job's room and returns an unsubscribe function. The pattern
 * every screen should use:
 *
 *   useEffect(() => {
 *     let cleanup: (() => void) | undefined;
 *     subscribeToJob(bookingId).then((fn) => { cleanup = fn; });
 *     return () => cleanup?.();
 *   }, [bookingId]);
 */
export async function subscribeToJob(bookingId: string): Promise<() => void> {
  const s = await getSocket();
  s.emit('job:subscribe', { bookingId });
  return () => {
    s.emit('job:unsubscribe', { bookingId });
  };
}

/** Order's counterpart to subscribeToJob -- same pattern, same usage. */
export async function subscribeToOrder(orderId: string): Promise<() => void> {
  const s = await getSocket();
  s.emit('order:subscribe', { orderId });
  return () => {
    s.emit('order:unsubscribe', { orderId });
  };
}

export type { Socket };
