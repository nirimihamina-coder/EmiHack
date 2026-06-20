import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { User } from '../interface/User';
import type { Message } from '../interface/Message';
import { messageService } from '../services/messageService';
import { useMessageStore } from '../stores/messageStore';

const LIMIT = 20;

interface UseMessagesOptions {
  selectedUser?: User;
  currentUser?: User;
  socket?: Socket;
  onNewMessage?: (senderId: string, message: Message) => void; // 👈 AJOUTÉ
}

export const useMessages = ({ selectedUser, currentUser, socket, onNewMessage }: UseMessagesOptions) => {
  const { conversations, setMessages, prependMessages, appendMessage } = useMessageStore();
  const messages: Message[] = selectedUser ? (conversations[selectedUser.id] ?? []) : [];

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // refs stables pour l'IntersectionObserver
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);
  const oldestMessageIdRef = useRef<string | undefined>(undefined);

  // refs scroll
  const scrollRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // ── Fetch ────────────────────────────────────────────────────────
  const fetchMessages = useCallback(
    async (cursor?: string) => {
      if (!selectedUser?.id || !currentUser?.id) return;

      if (cursor) {
        setLoadingMore(true);
        loadingMoreRef.current = true;
      } else {
        setLoading(true);
      }

      try {
        const data = await messageService.getHistory(currentUser.id, selectedUser.id, cursor);

        const noMore = data.length < LIMIT;
        setHasMore(!noMore);
        hasMoreRef.current = !noMore;

        if (cursor) {
          const container = scrollRef.current;
          const prevHeight = container?.scrollHeight ?? 0;

          prependMessages(selectedUser.id, data);
          oldestMessageIdRef.current = data[0]?.id ?? oldestMessageIdRef.current;

          requestAnimationFrame(() => {
            if (container) {
              container.scrollTop = container.scrollHeight - prevHeight;
            }
          });
        } else {
          setMessages(selectedUser.id, data);
          oldestMessageIdRef.current = data[0]?.id;
          setTimeout(() => bottomRef.current?.scrollIntoView(), 80);
        }
      } catch (err) {
        console.error('[useMessages] fetchMessages:', err);
      } finally {
        if (cursor) {
          setLoadingMore(false);
          loadingMoreRef.current = false;
        } else {
          setLoading(false);
        }
      }
    },
    [selectedUser, currentUser]
  );

  // ── Reset + chargement initial ───────────────────────────────────
  useEffect(() => {
    if (!selectedUser) return;
    setHasMore(true);
    hasMoreRef.current = true;
    oldestMessageIdRef.current = undefined;

    if (conversations[selectedUser.id]?.length) {
      setTimeout(() => bottomRef.current?.scrollIntoView(), 80);
      return;
    }

    fetchMessages();
  }, [selectedUser?.id]);

  // ── Scroll infini ────────────────────────────────────────────────
  useEffect(() => {
    const sentinel = topRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMoreRef.current && !loadingMoreRef.current && oldestMessageIdRef.current) {
          fetchMessages(oldestMessageIdRef.current);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchMessages]);

  // ── Réception temps réel ─────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleReceive = (msg: Message) => {
      if (msg.senderId !== currentUser?.id) {
        onNewMessage?.(msg.senderId, msg);
      }

      appendMessage(msg.senderId, msg);

      if (msg.senderId === selectedUser?.id) {
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
    };

    socket.on('receive_message', handleReceive);
    return () => {
      socket.off('receive_message', handleReceive);
    };
  }, [socket, selectedUser?.id, currentUser?.id, onNewMessage, appendMessage]);

  // ── Envoi ────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    (content: string) => {
      if (!content.trim() || !currentUser || !selectedUser || !socket) return;

      const msg: Message = {
        id: crypto.randomUUID(),
        senderId: currentUser.id,
        content: content.trim(),
        timestamp: Date.now()
      };

      socket.emit('send_message', { to: selectedUser.id, ...msg });
      appendMessage(selectedUser.id, msg);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    },
    [currentUser, selectedUser, socket]
  );

  const forceReload = useCallback(() => {
    if (selectedUser?.id) {
      fetchMessages();
    }
  }, [selectedUser, fetchMessages]);

  return {
    messages,
    loading,
    loadingMore,
    hasMore,
    scrollRef,
    topRef,
    bottomRef,
    sendMessage,
    forceReload
  };
};
