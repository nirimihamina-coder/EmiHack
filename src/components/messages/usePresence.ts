import { useEffect, useState } from 'react';
import { useSocket } from '../../hooks/useSocket';
import type { User } from '../../interface/User';

export interface UserWithLastSeen extends User {
  lastSeen?: number;
}

const FIVE_MIN = 5 * 60 * 1000;

export function usePresence() {
  const { socket } = useSocket();
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const [recentOffline, setRecentOffline] = useState<UserWithLastSeen[]>([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!socket) return;

    const handleUsersOnline = (users: User[]) => {
      setOnlineUsers(users);
      const now = Date.now();
      setRecentOffline((prev) =>
        prev.filter((o) => !users.some((u) => u.id === o.id)).filter((u) => now - (u.lastSeen || 0) < FIVE_MIN)
      );
    };

    const handleUserDisconnected = (user: User) => {
      setRecentOffline((prev) => {
        if (prev.find((u) => u.id === user.id)) return prev;
        return [{ ...user, lastSeen: Date.now() }, ...prev];
      });
    };

    socket.on('connected_users', handleUsersOnline);
    socket.on('user_offline', handleUserDisconnected);
    return () => {
      socket.off('connected_users', handleUsersOnline);
      socket.off('user_offline', handleUserDisconnected);
    };
  }, [socket]);

  // tick toutes les 30s pour rafraîchir les timestamps
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // nettoyage auto des offline > 5 min
  useEffect(() => {
    const id = setInterval(() => {
      setRecentOffline((prev) => prev.filter((u) => Date.now() - (u.lastSeen || 0) < FIVE_MIN));
    }, 10_000);
    return () => clearInterval(id);
  }, []);

  const formatLastSeen = (timestamp?: number) => {
    if (!timestamp) return '';
    const diff = now - timestamp;
    if (diff < 60_000) return "à l'instant";
    if (diff < 3_600_000) return `il y a ${Math.floor(diff / 60_000)} min`;
    return new Date(timestamp).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  return { onlineUsers, recentOffline, formatLastSeen, socket };
}
