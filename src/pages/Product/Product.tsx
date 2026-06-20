// pages/ProductPage.tsx
import { useState } from 'react';
import { useProducts } from '../../hooks/useProducts';

export default function ProductPage() {
  const { products, createProduct, deleteProduct } = useProducts();

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append('name', name);
    formData.append('price', price);
    if (image) formData.append('image', image);

    await createProduct(formData);

    setName('');
    setPrice('');
    setImage(null);
  };

  const handleImageChange = (file: File | null) => {
    setImage(file);
    if (file) {
      setPreview(URL.createObjectURL(file));
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">CRUD Products</h1>

      {/* FORM */}
      <form onSubmit={handleSubmit} className="space-y-3 mb-6">
        <input
          type="text"
          placeholder="Name"
          className="border p-2 w-full"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <input
          type="number"
          placeholder="Price"
          className="border p-2 w-full"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />

        <input type="file" onChange={(e) => handleImageChange(e.target.files?.[0] || null)} />

        {preview && <img src={preview} className="h-32 object-cover rounded" />}

        <button className="bg-blue-500 text-white px-4 py-2">Add Product</button>
      </form>

      {/* LIST */}
      <div className="grid grid-cols-3 gap-4">
        {products.map((p) => (
          <div key={p.id} className="border p-3 rounded">
            <img src={p.image_url} alt={p.name} className="h-32 w-full object-cover mb-2" />
            <h2>{p.name}</h2>
            <p>{p.price} Ar</p>

            <button onClick={() => deleteProduct(p.id!)} className="bg-red-500 text-white px-2 py-1 mt-2">
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
