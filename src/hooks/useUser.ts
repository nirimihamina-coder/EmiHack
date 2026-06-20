import { useUserStore } from '../stores/user';
import { useAuthStore } from '../stores/auth';
import { userService } from '../services/userService';
import type { ApiError } from '../interface/Api';
import type { User } from '../interface/User';

export const useUser = () => {
  const { profile, isLoading, error, setProfile, setLoading, setError, clearError, reset } = useUserStore();

  const setAuthUser = useAuthStore((state) => state.setUser);

  const updateProfile = async (id: string, formData: FormData) => {
    try {
      setLoading(true);
      clearError();

      for (const [key, value] of formData.entries()) {
        console.log(`formData → ${key}:`, value);
      }

      const updatedProfile = await userService.updateProfile(id, formData);
      console.log('🚀 ~ updateProfile ~ updatedProfile:', updatedProfile);

      // ✅ Met à jour les deux stores
      setProfile(updatedProfile); // ← sync useAuth pour que le composant se re-render
      setAuthUser(updatedProfile as unknown as User);

      return { success: true, data: updatedProfile };
    } catch (err) {
      const error = err as ApiError;
      const errorMessage = error.response?.data?.message || 'Erreur lors de la mise à jour du profil';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const fetchProfile = async () => {
    try {
      setLoading(true);
      clearError();

      const profileData = await userService.getProfile();
      setProfile(profileData);

      return { success: true, data: profileData };
    } catch (err) {
      const error = err as ApiError;
      const errorMessage = error.response?.data?.message || 'Erreur lors de la récupération du profil';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const deleteAccount = async (id: string) => {
    try {
      setLoading(true);
      clearError();

      await userService.deleteAccount(id);
      reset(); // logout / clear state

      return { success: true };
    } catch (err) {
      const error = err as ApiError;
      const errorMessage = error.response?.data?.message || 'Erreur lors de la suppression du compte';

      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  return {
    profile,
    isLoading,
    error,
    updateProfile,
    fetchProfile,
    deleteAccount,
    clearError
  };
};