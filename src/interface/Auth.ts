export interface LoginCredentials {
  email: string;
  password: string;
}

export interface EmailCredentials {
  email: string;
}

export interface OtpCredentials {
  email: string;
  code: string;
}

export interface ResetTokenCredentials {
  resetToken: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  lastName: string;
  firstName: string;
  avatar: File;
}

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  token: string;
  role?: string;
  status?: string;
}

export interface UpdatePasswordCredentials {
  oldPassword: string;
  newPassword: string;
}
