import axiosInstance from '../api/axios';
import type { Product } from '../interface/Product';
import { db } from '../lib/db';
import { createProductOffline, updateProductOffline, deleteProductOffline } from '../lib/db/product.db';

// ─── SERVICE ─────────────────────────────────────────────

export const productService = {
  // GET (online + fallback offline)
  getAll: async (): Promise<Product[]> => {
    try {
      const res = await axiosInstance.get('/products');

      if (navigator.onLine) {
        await db.products.clear(); // optionnel mais recommandé
        await db.products.bulkPut(res.data);
      }

      return res.data;
    } catch (err) {
      console.log('🚀 ~ err:', err);
      return await db.products.toArray();
    }
  },

  // CREATE (offline-first)
  create: async (data: FormData) => {
    const payload = {
      name: data.get('name') as string,
      price: Number(data.get('price')),
      image_url: data.get('image_url') as string
    };

    if (!navigator.onLine) {
      return await createProductOffline(payload);
    }

    const res = await axiosInstance.post('/products', data);
    return res.data;
  },

  // UPDATE (offline-first)
  update: async (id: string, data: FormData) => {
    const payload = {
      name: data.get('name') as string,
      price: Number(data.get('price')),
      image_url: data.get('image_url') as string
    };

    if (!navigator.onLine) {
      return await updateProductOffline(id, payload);
    }

    const res = await axiosInstance.put(`/products/${id}`, data);
    return res.data;
  },

  // DELETE (offline-first)
  delete: async (id: string) => {
    if (!navigator.onLine) {
      return await deleteProductOffline(id);
    }

    await axiosInstance.delete(`/products/${id}`);
  }
};
