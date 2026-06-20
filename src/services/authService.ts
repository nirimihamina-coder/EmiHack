import axiosInstance from '../api/axios';
import type {
  EmailCredentials,
  LoginCredentials,
  OtpCredentials,
  ResetTokenCredentials,
  UpdatePasswordCredentials,
  UserResponse
} from '../interface/Auth';

const decodeToken = (token: string) => {
  return JSON.parse(atob(token.split('.')[1]));
};

export const authService = {
  login: async (credentials: LoginCredentials): Promise<UserResponse> => {
    const response = await axiosInstance.post('/auth/login', credentials);
    const { token } = response.data;
    return { ...decodeToken(token), token };
  },

  forgotPassword: async (credentials: EmailCredentials): Promise<UserResponse> => {
    const response = await axiosInstance.post('/auth/forgot', credentials);
    const { token } = response.data;
    return { ...decodeToken(token), token };
  },

  verifyOtp: async (credentials: OtpCredentials): Promise<UserResponse> => {
    const response = await axiosInstance.post('/auth/otp', credentials);
    const { token } = response.data;
    return { ...decodeToken(token), token };
  },

  resetPassword: async (credentials: ResetTokenCredentials): Promise<UserResponse> => {
    const response = await axiosInstance.post('auth/resetPassword', credentials);
    const { token } = response.data;
    return { ...decodeToken(token), token };
  },

  register: async (formData: FormData): Promise<UserResponse> => {
    const response = await axiosInstance.post('/auth/register', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    const { token } = response.data;
    return { ...decodeToken(token), token };
  },

  logout: async (): Promise<void> => {
    await axiosInstance.post('/auth/logout');
  },

  getProfile: async (): Promise<UserResponse> => {
    const response = await axiosInstance.get('/auth/profil');
    return response.data;
  },

  updatePassword: async (credentials: UpdatePasswordCredentials): Promise<UserResponse> => {
    const response = await axiosInstance.post('/auth/update-password', credentials);
    console.log('🚀 ~ responseé2222:', response);
    return response.data;
  },

  refreshToken: async (): Promise<{ token: string }> => {
    const response = await axiosInstance.post('/auth/refresh');
    return response.data;
  }
};
