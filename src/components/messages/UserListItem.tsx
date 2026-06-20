import type { UserWithLastSeen } from './usePresence';
import type { User } from '../../interface/User';
import { Bell } from 'lucide-react';

interface Props {
  user: UserWithLastSeen | User;
  label?: string;
  sublabel?: string;
  status: 'online' | 'offline';
  isMe?: boolean;
  onClick?: () => void;
  isActive?: boolean;
  hasUnread?: boolean; // 👈 Ajouté
}

const UserListItem = ({ user, label, sublabel, status, isMe, onClick, isActive, hasUnread }: Props) => {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 mb-4 px-3 py-2.5 rounded-xl transition-all duration-200 text-left group relative
        ${isActive ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'hover:bg-gray-50'}
        ${hasUnread && !isActive && 'bg-white ring-1 ring-red-500'}
      `}
    >
      {/* Avatar + dot */}
      <div className="relative shrink-0">
        <img
          src={(user as User).avatar || '/default-avatar.png'}
          alt="avatar"
          referrerPolicy="no-referrer"
          className="w-9 h-9 rounded-full object-cover ring-2 ring-white shadow-sm"
        />
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white
            ${status === 'online' ? 'bg-emerald-400' : 'bg-amber-400'}
          `}
        />
      </div>

      {hasUnread && !isActive && (
        <div className="absolute flex items-center justify-center text-white -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full border-2 border-white">
          <Bell size={13} fill="#fff" stroke="#fff" className="animate-bell-ring origin-top" />
        </div>
      )}

      {/* Text */}
      <div className="flex flex-col min-w-0 flex-1">
        <span className={`text-sm font-semibold truncate ${isActive ? 'text-indigo-700' : 'text-gray-800'}`}>
          {isMe ? 'Moi' : label}
        </span>
        {sublabel && <span className="text-xs text-gray-400 truncate">{sublabel}</span>}
      </div>
    </button>
  );
};

export default UserListItem;
