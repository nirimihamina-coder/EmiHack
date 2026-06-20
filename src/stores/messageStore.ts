import { create } from 'zustand';
import type { Message } from '../interface/Message';

interface MessageStore {
  // cache par userId → messages
  conversations: Record<string, Message[]>;

  setMessages: (userId: string, messages: Message[]) => void;
  prependMessages: (userId: string, messages: Message[]) => void;
  appendMessage: (userId: string, message: Message) => void;
  clearConversation: (userId: string) => void;
}

export const useMessageStore = create<MessageStore>((set) => ({
  conversations: {},

  setMessages: (userId, messages) =>
    set((state) => ({
      conversations: { ...state.conversations, [userId]: messages }
    })),

  prependMessages: (userId, messages) =>
    set((state) => ({
      conversations: {
        ...state.conversations,
        [userId]: [...messages, ...(state.conversations[userId] ?? [])]
      }
    })),

  appendMessage: (userId, message) =>
    set((state) => ({
      conversations: {
        ...state.conversations,
        [userId]: [...(state.conversations[userId] ?? []), message]
      }
    })),

  clearConversation: (userId) =>
    set((state) => {
      const updated = { ...state.conversations };
      delete updated[userId];
      return { conversations: updated };
    })
}));
