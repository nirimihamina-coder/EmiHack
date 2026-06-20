import { useEffect } from 'react';
import { productService } from '../services/productService';
import { useProductStore } from '../stores/productStore';
import { db } from '../lib/db';

export const useProducts = () => {
  const { products, setProducts, addProduct, removeProduct } = useProductStore();

  // ─── FETCH (ONLINE + OFFLINE FALLBACK) ───────────────────
  const fetchProducts = async () => {
    try {
      if (!navigator.onLine) {
        const localData = await db.products.toArray();
        setProducts(localData);
        return;
      }

      const data = await productService.getAll();

      // sync local cache
      await db.products.clear();
      await db.products.bulkPut(data);

      setProducts(data);
    } catch (err) {
      console.log('🚀 ~ err:', err);
      const localData = await db.products.toArray();
      setProducts(localData);
    }
  };

  // ─── CREATE ─────────────────────────────────────────────
  const createProduct = async (formData: FormData) => {
    const newProduct = await productService.create(formData);

    // optimistic update
    addProduct(newProduct);
  };

  // ─── DELETE ─────────────────────────────────────────────
  const deleteProduct = async (id: string) => {
    await productService.delete(id);

    removeProduct(id);
  };

  // ─── INIT ───────────────────────────────────────────────
  useEffect(() => {
    fetchProducts();

    const handleOnline = () => fetchProducts();

    window.addEventListener('online', handleOnline);

    return () => window.removeEventListener('online', handleOnline);
  }, []);

  return { products, createProduct, deleteProduct };
};
