interface Props {
  content: string;
  isMe: boolean;
  timestamp: number | string; // 👈 accepte les deux
  senderName?: string;
  avatar?: string;
}

const MessageBubble = ({ content, isMe, timestamp, senderName, avatar }: Props) => {
  // 👉 conversion sécurisée
  const date = new Date(Number(timestamp));

  const time = date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isMe && (
        <img
          src={avatar || '/default-avatar.png'}
          alt={senderName}
          referrerPolicy="no-referrer"
          className="w-7 h-7 rounded-full -translate-y-4 object-cover mb-1 shrink-0"
        />
      )}

      <div className={`flex flex-col max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
        {/* {!isMe && senderName && <span className="text-xs text-gray-400 mb-1 px-1">{senderName}</span>} */}

        <div
          className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm
            ${
              isMe
                ? 'bg-gradient-to-br from-slate-500 via-slate-500 to-slate-600 text-white rounded-br-sm'
                : 'bg-white text-gray-800 border border-gray-100 rounded-bl-sm'
            }
          `}
        >
          {content}
        </div>

        <span className="text-[11px] text-gray-400 mt-1 px-1">{time}</span>
      </div>
    </div>
  );
};

export default MessageBubble;
