import { useEffect, useState, useRef } from 'react';
import type { User } from '../../interface/User';
import MessageBubble from './MessageBubble';
import type { Socket } from 'socket.io-client';
import { useMessages } from '../../hooks/useMessages';
import { ArrowDownIcon } from 'lucide-react';

interface Props {
  selectedUser?: User;
  currentUser?: User;
  socket?: Socket;
  token: string;
  onNewMessage?: (senderId: string) => void;
  onForceReload?: (fn: () => void) => void;
}

const getName = (user?: User) => (user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email : '');

const ConversationPanel = ({ selectedUser, currentUser, socket, onNewMessage }: Props) => {
  const [input, setInput] = useState('');
  const [showScrollButton, setShowScrollButton] = useState(false);
  const isUserScrolledUpRef = useRef(false);
  const prevMessagesLengthRef = useRef(0);

  const { messages, loading, loadingMore, hasMore, scrollRef, topRef, bottomRef, sendMessage } = useMessages({
    selectedUser,
    currentUser,
    socket,
    onNewMessage: (senderId: string) => {
      onNewMessage?.(senderId);
    }
  });

  const handleSend = () => {
    sendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollButton(false);
  };

  // Détecter le scroll pour afficher/masquer la flèche
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (!container) return;
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;

      // Mise à jour asynchrone via callback
      requestAnimationFrame(() => {
        setShowScrollButton(messages.length > 6 && !isNearBottom);
      });

      isUserScrolledUpRef.current = !isNearBottom;
    };

    container.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => container.removeEventListener('scroll', handleScroll);
  }, [messages.length, scrollRef]);

  // Gérer l'arrivée de nouveaux messages SANS setState synchrone
  useEffect(() => {
    if (messages.length === 0 || messages.length === prevMessagesLengthRef.current) return;

    const hasNewMessage = messages.length > prevMessagesLengthRef.current;
    prevMessagesLengthRef.current = messages.length;

    if (!hasNewMessage) return;

    // Utiliser requestAnimationFrame pour éviter le setState synchrone
    requestAnimationFrame(() => {
      if (!isUserScrolledUpRef.current) {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        setShowScrollButton(false);
      } else if (messages.length > 6) {
        setShowScrollButton(true);
      }
    });
  }, [messages]);

  if (!selectedUser) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#f9ffe4] relative overflow-hidden">
        {/* Cercles décoratifs de fond */}
        <div className="absolute -top-16 -left-16 w-64 h-64 rounded-full border border-indigo-100 animate-pulse pointer-events-none" />
        <div
          className="absolute -top-8 -left-8 w-44 h-44 rounded-full border border-indigo-200/40 animate-pulse pointer-events-none"
          style={{ animationDelay: '0.8s' }}
        />
        <div
          className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full border border-indigo-100 animate-pulse pointer-events-none"
          style={{ animationDelay: '0.4s' }}
        />
        <div
          className="absolute -bottom-10 -right-10 w-52 h-52 rounded-full border border-indigo-200/50 animate-pulse pointer-events-none"
          style={{ animationDelay: '1.2s' }}
        />

        {/* Losanges flottants */}
        <div
          className="absolute top-24 left-14 w-3 h-3 bg-indigo-300 rotate-45 opacity-60 animate-bounce pointer-events-none"
          style={{ animationDuration: '3s' }}
        />
        <div
          className="absolute bottom-24 right-16 w-2.5 h-2.5 bg-indigo-400 rotate-45 opacity-50 animate-bounce pointer-events-none"
          style={{ animationDuration: '4s', animationDelay: '1s' }}
        />
        <div
          className="absolute top-40 right-12 w-2 h-2 bg-violet-400 rotate-45 opacity-40 animate-bounce pointer-events-none"
          style={{ animationDuration: '5s', animationDelay: '0.5s' }}
        />

        {/* Points flottants */}
        <div className="absolute top-16 left-20 w-2 h-2 rounded-full bg-indigo-200 animate-pulse pointer-events-none" />
        <div
          className="absolute top-20 right-24 w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse pointer-events-none"
          style={{ animationDelay: '1s' }}
        />
        <div
          className="absolute bottom-16 left-28 w-2 h-2 rounded-full bg-violet-300 animate-pulse pointer-events-none"
          style={{ animationDelay: '0.6s' }}
        />

        {/* Lignes pointillées */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="xMidYMid slice">
          <line x1="0" y1="33%" x2="20%" y2="33%" stroke="#c2c2c2" strokeWidth="1" strokeDasharray="4 6" />
          <line x1="80%" y1="70%" x2="100%" y2="70%" stroke="#c4c4c4" strokeWidth="1" strokeDasharray="4 6" />
        </svg>

        {/* Contenu central */}
        <div className="relative z-10 flex flex-col items-center text-center">
          {/* Icône avec rings animés */}
          <div className="relative w-24 h-24 flex items-center justify-center mb-6">
            <div
              className="absolute inset-0 rounded-full border border-indigo-300/30 animate-ping"
              style={{ animationDuration: '2.8s' }}
            />
            <div
              className="absolute inset-0 rounded-full border border-indigo-200/20 animate-ping"
              style={{ animationDuration: '2.8s', animationDelay: '0.9s' }}
            />

            <div className="w-24 h-24 rounded-2xl bg-linear-to-br from-indigo-50 to-indigo-100 flex items-center justify-center shadow-sm ring-1 ring-indigo-200/60 animate-[float_3.6s_ease-in-out_infinite]">
              <svg className="w-12 h-12 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>

            {/* Petit badge check */}
            <div className="absolute -top-6 animate-bounce -right-6 w-5 h-5 rounded-full bg-green-50 border border-green-500 flex items-center justify-center">
              <svg
                className="w-2.5 h-2.5 text-green-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          <p className="text-sm font-semibold text-gray-800 mb-1.5">Sélectionne un utilisateur</p>
          <p className="text-xs text-gray-400 mb-7">pour démarrer une conversation</p>

          {/* Pills indicateurs */}
          <div className="flex gap-2 flex-wrap justify-center">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 bg-white">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              <span className="text-[11px] text-gray-400">Utilisateurs en ligne</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 bg-white">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
              <span className="text-[11px] text-gray-400">Récemment actifs</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-50 min-h-0 relative">
      {/* Header conversation */}
      <div className="flex items-center gap-3 px-5 py-3.5 bg-white border-b border-gray-100 shadow-sm">
        <div className="relative">
          <img
            src={selectedUser.avatar || '/default-avatar.png'}
            alt="avatar"
            className="w-9 h-9 rounded-full object-cover"
          />
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">{getName(selectedUser)}</p>
          <p className="text-xs text-emerald-500">En ligne</p>
        </div>
      </div>

      {/* Zone messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <div ref={topRef}>
          {loadingMore && (
            <div className="flex justify-center py-3">
              <div className="w-4 h-4 rounded-full border-2 border-indigo-300 border-t-indigo-600 animate-spin" />
            </div>
          )}
          {!hasMore && messages.length > 0 && (
            <p className="text-center text-xs text-gray-400 py-3">— Début de la conversation —</p>
          )}
        </div>

        {/* Loader initial */}
        {loading ? (
          <div className="flex justify-center items-center py-10">
            <div className="w-5 h-5 rounded-full border-2 border-indigo-300 border-t-indigo-600 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-gray-400 mt-8">
            Début de la conversation avec <span className="font-medium">{getName(selectedUser)}</span>
          </p>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              content={msg.content}
              isMe={msg.senderId === currentUser?.id}
              timestamp={msg.timestamp}
              senderName={getName(selectedUser)}
              avatar={selectedUser.avatar}
            />
          ))
        )}

        {/* Sentinelle bas — auto-scroll */}
        <div ref={bottomRef} />
      </div>

      {/* Bouton flèche vers le bas */}
      {showScrollButton && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10 bg-gray-400/20 border border-gray-300 cursor-pointer hover:bg-gray-700 hover:text-white text-black rounded-full p-2 backdrop-blur-lg shadow-lg transition-all duration-200"
        >
          <ArrowDownIcon size={18} />
        </button>
      )}

      {/* Input */}
      <div className="px-4 py-3 bg-white border-t border-gray-100">
        <div className="flex items-end gap-2">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message à ${getName(selectedUser)}…`}
            className="flex-1 resize-none px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent transition max-h-32"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || !socket}
            className="shrink-0 w-10 h-10 group bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 cursor-pointer disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center transition-all duration-200 shadow-sm"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="group-hover:-rotate-20 transition-all w-8 h-8"
              width="24"
              height="24"
              fill="none"
              viewBox="0 0 24 24"
              id="send"
            >
              <path
                fill="currentColor"
                fillRule="evenodd"
                d="M3.48935 7.06989C2.63559 4.93551 4.87248 2.8773 6.92858 3.90535L18.6458 9.76397C20.4884 10.6853 20.4884 13.3148 18.6458 14.2361L6.92857 20.0947C4.87247 21.1228 2.6356 19.0646 3.48935 16.9302L5.4614 12L3.48935 7.06989ZM6.48136 4.79977C5.2477 4.18294 3.90557 5.41788 4.41782 6.6985L6.46416 11.8143C6.51184 11.9335 6.51184 12.0665 6.46416 12.1857L4.41782 17.3016C3.90557 18.5822 5.2477 19.8171 6.48136 19.2003L18.1986 13.3417C19.3042 12.7889 19.3042 11.2112 18.1986 10.6584L6.48136 4.79977Z"
                clipRule="evenodd"
              />
              <path fill="currentColor" fillRule="evenodd" d="M5.5 11.5H10V12.5H5.5V11.5Z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        <p className="text-[11px] text-gray-400 mt-1.5 px-1">Entrée pour envoyer · Shift+Entrée pour saut de ligne</p>
      </div>
    </div>
  );
};

export default ConversationPanel;
