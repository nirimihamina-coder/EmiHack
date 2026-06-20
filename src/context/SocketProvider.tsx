import { useEffect, useState } from 'react';
import { connectSocket, disconnectSocket } from '../lib/socket';
import { SocketContext } from './SocketContext';
import type { Socket } from 'socket.io-client';

export const SocketProvider = ({ children, token }: { children: React.ReactNode; token: string }) => {
  const [isConnected, setIsConnected] = useState(false);

  // ✅ socket créé une seule fois, stable, lisible au render
  const [socket] = useState<Socket>(() => connectSocket(token));

  useEffect(() => {
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      disconnectSocket();
    };
  }, [socket]);

  return <SocketContext.Provider value={{ socket, isConnected }}>{children}</SocketContext.Provider>;
};
