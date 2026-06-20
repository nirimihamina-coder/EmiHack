import axiosInstance from '../api/axios';

export interface UpdateProfileData {
  firstName: string;
  lastName: string;
  email: string;
  avatar?: File;
}

export interface UserProfileResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  role?: string;
}

export const userService = {
  updateProfile: async (id: string, formData: FormData): Promise<UserProfileResponse> => {
    const payload: Record<string, any> = {};

    formData.forEach((value, key) => {
      if (value instanceof File) {
        // fichier traité séparément
      } else {
        payload[key] = value;
      }
    });

    const file = formData.get('file') as File | null;

    // Envoi des champs texte en JSON
    const response = await axiosInstance.put(`/users/${id}`, payload);

    // Envoi du fichier séparément si présent
    if (file && file.size > 0) {
      const fileForm = new FormData();
      fileForm.append('file', file);
      await axiosInstance.put(`/users/${id}/avatar`, fileForm, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    }

    console.log('🚀 ~ response:', response);
    return response.data;
  },

  getProfile: async (): Promise<UserProfileResponse> => {
    const response = await axiosInstance.get('/user/profile');
    return response.data;
  },

  deleteAccount: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/users/${id}`);
  }
};