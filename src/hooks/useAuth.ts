import { useAuthStore } from '../stores/auth';
import { authService } from '../services/authService';
import type {
  EmailCredentials,
  LoginCredentials,
  OtpCredentials,
  ResetTokenCredentials,
  UpdatePasswordCredentials
} from '../interface/Auth';
import type { ApiError } from '../interface/Api';
import type { User } from '../interface/User';

export const useAuth = () => {
  const { user, isAuthenticated, isLoading, error, setAuth, setUser, setLoading, setError, clearError, reset } =
    useAuthStore();

  const login = async (credentials: LoginCredentials) => {
    try {
      setLoading(true);
      clearError();

      // Appel API via le service
      const userData = await authService.login(credentials);

      // Met à jour le store
      setUser(userData);
      const { token } = userData;

      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1])) as User;
        setAuth(payload, token);
      }
      return { success: true, data: userData };
    } catch (err) {
      const error = err as ApiError;
      const errorMessage = error.response?.data?.message || 'Erreur de connexion';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const forgotPassword = async (credentials: EmailCredentials) => {
    try {
      setLoading(true);
      clearError();

      // Appel API via le service
      const userData = await authService.forgotPassword(credentials);

      // Met à jour le store
      setUser(userData);

      return { success: true, data: userData };
    } catch (err) {
      const error = err as ApiError;
      const errorMessage = error.response?.data?.message || 'Email introuvable';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (credentials: OtpCredentials) => {
    try {
      setLoading(true);
      clearError();

      const userData = await authService.verifyOtp(credentials);

      setUser(userData);

      return { success: true, data: userData };
    } catch (err) {
      const error = err as ApiError;
      const errorMessage = error.response?.data?.message || 'Code invalide ou expiré';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (credentials: ResetTokenCredentials) => {
    try {
      setLoading(true);
      clearError();

      const userData = await authService.resetPassword(credentials);
      setUser(userData);

      return { success: true, data: userData };
    } catch (err) {
      const error = err as ApiError;
      const errorMessage = error.response?.data?.message || 'Lien expiré. Veuillez recommencer. ';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const updatePassword = async (credentials: UpdatePasswordCredentials) => {
    try {
      setLoading(true);
      clearError();

      const userData = await authService.updatePassword(credentials);
      console.log('🚀 ~ updatePassword ~ userData:', userData);
      // setUser(userData);

      return { success: true, data: userData };
    } catch (err) {
      const error = err as ApiError;
      const errorMessage = error.response?.data?.message || 'Une erreur est survenue. Veuillez recommencer. ';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const registerUser = async (formData: FormData) => {
    try {
      setLoading(true);
      clearError();

      const userData = await authService.register(formData);
      console.log('🚀11 ~ registerUser ~ userData:', userData);

      setUser(userData);

      return { success: true, data: userData };
    } catch (err) {
      console.log('🚀 ~ err:', err);
      const error = err as ApiError;
      console.log('🚀22 ~ registerUser ~ error:', err);
      const errorMessage = error.response?.data?.message || "Erreur d'inscription";

      setError(errorMessage);

      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);

      // Appel API pour invalider le token (optionnel)
      await authService.logout();
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      // Toujours nettoyer le store
      reset();
    }
  };

  const refreshUser = async () => {
    try {
      setLoading(true);
      const userData = await authService.getProfile();
      setUser(userData);
      return userData;
    } catch (error) {
      // Si le refresh échoue, déconnecter
      reset();
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    forgotPassword,
    verifyOtp,
    resetPassword,
    updatePassword,
    registerUser,
    logout,
    refreshUser,
    clearError
  };
};
