import { useState } from 'react';
import axiosInstance from '../api/axios';
import axios from 'axios';
import { useAuthStore } from '../stores/auth';
import type { User } from '../interface/User';

export function useFaceLogin() {
  const [isScanning, setIsScanning] = useState(false);
  const [faceError, setFaceError] = useState<string | null>(null);
  const { setAuth, setUser, token, user, reset } = useAuthStore();

  const registerFace = async (descriptor: Float32Array): Promise<boolean> => {
    setIsScanning(true);
    setFaceError(null);

    try {
      const response = await axiosInstance.post('/auth/face/register', {
        descriptor: Array.from(descriptor)
      });

      if (response.data?.id) {
        // Mettre à jour l'user dans le store en gardant le token existant
        setUser(response.data as User);
        return true;
      }
      return false;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        setFaceError(error.response?.data?.error ?? "Erreur lors de l'inscription");
      } else {
        setFaceError("Erreur inattendue lors de l'inscription");
      }
      return false;
    } finally {
      setIsScanning(false);
    }
  };

  const deleteFace = async (): Promise<boolean> => {
    setIsScanning(true);
    setFaceError(null);

    try {
      await axiosInstance.delete('/auth/face/delete', {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Mettre à jour l'user dans le store sans le faceDescriptor
      if (user) {
        setUser({ ...user, faceDescriptor: null } as User);
      }

      return true;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        setFaceError(error.response?.data?.error ?? 'Erreur lors de la suppression');
      } else {
        setFaceError('Erreur inattendue lors de la suppression');
      }
      return false;
    } finally {
      setIsScanning(false);
    }
  };

  const updateFace = async (descriptor: Float32Array): Promise<boolean> => {
    setIsScanning(true);
    setFaceError(null);

    try {
      const response = await axiosInstance.put(
        '/auth/face/update',
        { descriptor: Array.from(descriptor) },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.status === 200) {
        if (response.data?.id) {
          setUser(response.data as User);
        } else if (user) {
          // Le backend ne retourne pas l'user complet, on met à jour le faceDescriptor localement
          setUser({ ...user, hasFaceDescriptor: true } as User);
        }
        return true;
      }
      return false;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        setFaceError(error.response?.data?.error ?? 'Erreur lors de la mise à jour');
      } else {
        setFaceError('Erreur inattendue lors de la mise à jour');
      }
      return false;
    } finally {
      setIsScanning(false);
    }
  };

  const loginWithFace = async (descriptor: Float32Array): Promise<boolean> => {
    setIsScanning(true);
    setFaceError(null);

    try {
      const response = await axiosInstance.post('/auth/face/login', {
        descriptor: Array.from(descriptor)
      });

      const { token } = response.data;

      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1])) as User;
        setAuth(payload, token);
        return true;
      }

      return false;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        setFaceError(error.response?.data?.error ?? 'Visage non reconnu');
      } else {
        setFaceError('Erreur inattendue lors de la connexion');
      }
      return false;
    } finally {
      setIsScanning(false);
    }
  };

  const logout = () => reset();

  const getCurrentUser = (): User | null => user;

  return {
    registerFace,
    loginWithFace,
    updateFace,
    logout,
    getCurrentUser,
    deleteFace,
    isScanning,
    faceError
  };
}
