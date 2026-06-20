import { useContext, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Settings, LogOut, ChevronDown, Bell } from 'lucide-react';
import { useModal } from '../../context/ModalContext';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../hooks/useSocket';
import { SocketContext } from '../../context/SocketContext';
import type { Notification } from '../../interface/Notification';

interface HeaderProps {
  title?: string;
  description?: string;
}

const Header = ({ title = 'Tableau de bord', description = 'Bienvenue sur votre espace de travail' }: HeaderProps) => {
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const { socket } = useSocket();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);

  const { user } = useAuth();
  const { isConnected } = useContext(SocketContext);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    if (!socket || !isConnected) return;

    const onGlobal = (data: { message: string }) => {
      setNotifications((prev) => [
        {
          id: crypto.randomUUID(),
          userId: '', // à remplir si dispo
          message: data.message,
          isRead: false,
          createdAt: new Date().toISOString()
        },
        ...prev
      ]);
      console.log(notifications);
    };

    socket.on('notification', onGlobal);

    return () => {
      socket.off('global_notification', onGlobal);
    };
  }, [socket, isConnected]);

  const markAllRead = () => {
    setNotifications((prev) => {
      console.log('Toutes les notifications :', prev);
      return prev.map((n) => ({ ...n, read: true }));
    });
  };

  const markOneRead = (id: string) => {
    setNotifications((prev) => {
      const selected = prev.find((n) => n.id === id);

      console.log('Notification sélectionnée :', selected);

      return prev.map((n) => (n.id === id ? { ...n, read: true } : n));
    });
  };

  const clearAll = () => setNotifications([]);

  const formatTime = (date: Date) => {
    const diff = Math.floor((now - date.getTime()) / 1000);
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}min`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  };

  const userEmail = user?.email || 'user@example.com';
  const firstName = user?.firstName || '-';
  const lastName = user?.lastName || '-';
  const avatar = user?.avatar || '';
  const { openModal } = useModal();

  const sendNotification = () => {
    if (!socket) return;
    socket.emit('global_notification', {
      message: '🚀 Notification globale !',
      timestamp: new Date().toISOString()
    });
  };

  return (
    <header className="bg-white border m-3 rounded-lg border-gray-200 sticky top-0 z-10">
      <div className="px-4 py-2.5 flex items-center justify-between">
        {/* Titre et description */}
        <div>
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
          <p className="text-sm text-gray-500 mt-1">{description}</p>
        </div>

        {/* Bouton socket */}
        <button
          onClick={sendNotification}
          className="bg-gray-600 cursor-pointer text-white transition-all hover:bg-gray-900 px-4 py-1.5 rounded-lg"
        >
          Socket
        </button>

        {/* Barre d'actions et profil */}
        <div className="flex items-center gap-4">
          {/* ── Cloche notifications ── */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => {
                setShowNotifMenu((v) => !v);
                setShowUserMenu(false);
              }}
              className="relative flex items-center justify-center cursor-pointer rounded-lg p-2 border border-gray-200 hover:bg-gray-100 transition-colors"
            >
              <Bell size={20} className="text-gray-600" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifMenu && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowNotifMenu(false)} />
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-100 z-30 animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden">
                  {/* Header dropdown */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <Bell size={15} className="text-gray-500" />
                      <span className="text-sm font-semibold text-gray-800">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-bold">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllRead}
                          className="text-xs text-blue-500 hover:text-blue-700 cursor-pointer transition-colors"
                        >
                          Tout lire
                        </button>
                      )}
                      {notifications.length > 0 && (
                        <button
                          onClick={clearAll}
                          className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer transition-colors"
                        >
                          Effacer
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Liste */}
                  <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-400">
                        <Bell size={28} className="opacity-30" />
                        <p className="text-sm">Aucune notification</p>
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <button
                          key={notif.id}
                          onClick={() => markOneRead(notif.id)}
                          className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors cursor-pointer ${
                            !notif.isRead ? 'bg-blue-50/50' : ''
                          }`}
                        >
                          {/* Dot non-lue */}
                          <span
                            className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${
                              !notif.isRead ? 'bg-blue-500' : 'bg-transparent'
                            }`}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-700 leading-snug">{notif.message}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{formatTime(new Date(notif.createdAt))}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── Menu utilisateur ── */}
          <div className="relative">
            <button
              onClick={() => {
                setShowUserMenu(!showUserMenu);
                setShowNotifMenu(false);
              }}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <img
                src={avatar || `https://ui-avatars.com/api/?background=random&name=${firstName}+${lastName}`}
                referrerPolicy="no-referrer"
                className="w-9 h-9 border border-gray-200 bg-blue-50 rounded-full"
                alt="logo"
              />
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-gray-900">{firstName}</p>
                <p className="text-xs text-gray-500">{userEmail}</p>
              </div>
              <ChevronDown
                size={16}
                className={`hidden md:block text-gray-400 transition-transform duration-200 ${
                  showUserMenu ? 'rotate-180' : ''
                }`}
              />
            </button>

            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowUserMenu(false)} />
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-30 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex pl-4 items-center justify-between">
                    <img
                      src={`https://ui-avatars.com/api/?background=random&name=${firstName}+${lastName}`}
                      alt="logo"
                      className="w-9 h-9 border border-gray-200 bg-blue-50 rounded-full"
                    />
                    <div className="py-3 border-b border-gray-100 w-40">
                      <p className="text-sm font-medium text-ellipsis text-gray-900">{firstName}</p>
                      <p className="text-xs text-gray-500 text-ellipsis truncate">{userEmail}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      navigate('/dashboard/settings/profil');
                    }}
                    className="w-full flex items-center cursor-pointer gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <User size={16} />
                    Mon profil
                  </button>

                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      navigate('/dashboard/settings');
                    }}
                    className="w-full flex items-center cursor-pointer gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Settings size={16} />
                    Paramètres
                  </button>

                  <div className="border-t border-gray-100 my-1" />

                  <button
                    onClick={() => openModal('logout')}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={16} />
                    Se déconnecter
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
