export interface User {
  id: string;
  email: string;
  lastName?: string;
  firstName?: string;
  token: string;
  role?: string;
  permission?: string[];
  avatar?: string;
  status?: string;
}
