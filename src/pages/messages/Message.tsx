import { useRef, useState } from 'react';
import type { User } from '../../interface/User';
import { usePresence } from '../../components/messages/usePresence';
import UserSidebar from '../../components/messages/UserSidebar';
import ConversationPanel from '../../components/messages/ConversationPanel';
import type { UserWithLastSeen } from '../../components/messages/usePresence';

const Messages = () => {
  const { onlineUsers, recentOffline, formatLastSeen, socket } = usePresence();
  const [selectedUser, setSelectedUser] = useState<User | UserWithLastSeen | undefined>();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [unreadMessages, setUnreadMessages] = useState<Record<string, boolean>>({});

  const forceReloadRef = useRef<(() => void) | null>(null);

  const authStorage = JSON.parse(localStorage.getItem('auth-storage') || '{}');
  const currentUser: User | undefined = authStorage?.state?.user;
  const token: string = authStorage?.state?.token ?? '';

  // 👈 Fonction pour marquer comme non lu quand un message arrive
  const handleNewMessage = (senderId: string) => {
    console.log('📩 Nouveau message reçu de:', senderId);
    console.log('selectedUser actuel:', selectedUser?.id);

    if (selectedUser?.id !== senderId) {
      console.log('✅ Marquer comme non lu pour:', senderId);
      setUnreadMessages((prev) => ({ ...prev, [senderId]: true }));
    }
  };

  // 👈 Fonction pour marquer comme lu quand on ouvre une conversation
  const handleReadUser = (userId: string) => {
    setUnreadMessages((prev) => ({ ...prev, [userId]: false }));
  };

  const handleSelectUser = (user: User | UserWithLastSeen) => {
    setSelectedUser(user);
    setSidebarOpen(false);
    handleReadUser(user.id);
    if (forceReloadRef.current) {
      setTimeout(() => forceReloadRef.current?.(), 100);
    }
  };

  return (
    <div className="flex h-[calc(100vh-150px)] overflow-hidden rounded-2xl shadow-lg border border-gray-100">
      {/* Sidebar mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div
        className={`
        w-72 shrink-0 z-30 transition-transform duration-300
        fixed md:relative inset-y-0 left-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}
      >
        <UserSidebar
          onlineUsers={onlineUsers}
          recentOffline={recentOffline}
          formatLastSeen={formatLastSeen}
          currentUserId={currentUser?.id}
          selectedUserId={(selectedUser as User)?.id}
          onSelectUser={handleSelectUser}
          unreadMessages={unreadMessages} // 👈 Passer l'état des non lus
          onReadUser={handleReadUser} // 👈 Passer la fonction
        />
      </div>

      {/* Panel principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Bouton burger mobile */}
        <div className="md:hidden flex items-center px-4 py-3 bg-white border-b border-gray-100">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-gray-100 transition">
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="ml-3 text-sm font-semibold text-gray-700">
            {selectedUser
              ? `${(selectedUser as User).firstName ?? ''} ${(selectedUser as User).lastName ?? ''}`.trim()
              : 'Messages'}
          </span>
        </div>

        <ConversationPanel
          selectedUser={selectedUser as User}
          currentUser={currentUser}
          socket={socket ?? undefined}
          token={token}
          onNewMessage={handleNewMessage} // 👈 Passer le callback
          onForceReload={(fn) => {
            forceReloadRef.current = fn;
          }}
        />
      </div>
    </div>
  );
};

export default Messages;
