import { useState } from 'react';
import type { User } from '../../interface/User';
import type { UserWithLastSeen } from './usePresence';
import UserListItem from './UserListItem';

interface Props {
  onlineUsers: User[];
  recentOffline: UserWithLastSeen[];
  formatLastSeen: (ts?: number) => string;
  currentUserId?: string;
  selectedUserId?: string;
  onSelectUser: (user: User | UserWithLastSeen) => void;
  unreadMessages?: Record<string, boolean>; // 👈 Ajouté
  onReadUser?: (userId: string) => void; // 👈 Ajouté
}

const getName = (user: User) => `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email;

const UserSidebar = ({
  onlineUsers,
  recentOffline,
  // formatLastSeen,
  currentUserId,
  selectedUserId,
  onSelectUser,
  unreadMessages = {},
  onReadUser
}: Props) => {
  const [search, setSearch] = useState('');

  const filteredOnline = onlineUsers.filter((u) => getName(u).toLowerCase().includes(search.toLowerCase()));
  const filteredOffline = recentOffline.filter((u) => getName(u).toLowerCase().includes(search.toLowerCase()));

  const handleSelectUser = (user: User | UserWithLastSeen) => {
    onSelectUser(user);
    if (onReadUser) {
      onReadUser(user.id);
    }
  };

  return (
    <aside className="flex flex-col h-full bg-white border-r border-gray-100">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 border-b border-gray-100">
        <h1 className="text-lg font-bold text-gray-900 tracking-tight">Messages</h1>
        <p className="text-xs text-gray-400 mt-0.5">{onlineUsers.length} en ligne</p>
      </div>

      {/* Search */}
      <div className="px-4 py-3">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent transition"
          />
        </div>
      </div>

      {/* Lists */}
      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-5">
        {/* Online */}
        <div>
          <p className="text-xs font-semibold text-emerald-500 uppercase tracking-widest px-1 mb-1">
            🟢 En ligne — {filteredOnline.length}
          </p>
          {filteredOnline.length === 0 ? (
            <p className="text-xs text-gray-400 px-2">Aucun utilisateur connecté</p>
          ) : (
            filteredOnline.map((user) => (
              <UserListItem
                key={user.id}
                user={user}
                label={getName(user)}
                sublabel={user.email}
                status="online"
                isMe={user.id === currentUserId}
                isActive={selectedUserId === user.id}
                onClick={() => handleSelectUser(user)}
                hasUnread={unreadMessages[user.id] === true} // 👈 Passer l'indicateur
              />
            ))
          )}
        </div>

        {/* Offline récent */}
        {filteredOffline.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-amber-500 uppercase tracking-widest px-1 mb-1">
              🟡 Récemment déconnectés
            </p>
            {filteredOnline.map((user) => {
              const hasUnread = unreadMessages[user.id] === true;
              console.log(`👤 ${getName(user)} - hasUnread:`, hasUnread); // 👈 Debug
              return (
                <UserListItem
                  key={user.id}
                  user={user}
                  label={getName(user)}
                  sublabel={user.email}
                  status="online"
                  isMe={user.id === currentUserId}
                  isActive={selectedUserId === user.id}
                  onClick={() => handleSelectUser(user)}
                  hasUnread={hasUnread}
                />
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
};

export default UserSidebar;
