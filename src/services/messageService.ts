// services/message.service.ts
import axiosInstance from '../api/axios';
import type { Message } from '../interface/Message';

const LIMIT = 20;

export const messageService = {
  async getHistory(
    currentUserId: string, // ← ajouter
    withUserId: string,
    cursor?: string
  ): Promise<Message[]> {
    const params: Record<string, string> = {
      userA: currentUserId, // ← ajouter
      userB: withUserId,
      limit: String(LIMIT)
    };
    if (cursor) params.cursor = cursor;

    const { data } = await axiosInstance.get<Message[]>('/messages/conversation', { params });
    console.log('🚀 ~ data:', data);
    return data;
  }
};
