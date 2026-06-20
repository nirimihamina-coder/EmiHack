import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getSocket = (): Socket | null => {
  return socket;
};

export const connectSocket = (token: string): Socket => {
  if (socket) return socket;

  socket = io(import.meta.env.VITE_SOCKET_URL, {
    transports: ['polling', 'websocket'], // ✅ polling EN PREMIER
    extraHeaders: {
      'ngrok-skip-browser-warning': 'true'
    },
    auth: { token },
    reconnection: true,
    reconnectionAttempts: 5
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
