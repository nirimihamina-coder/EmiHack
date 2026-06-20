export type ApiError = {
  response?: {
    data?: {
      message?: string;
    };
  };
  message: string;
};
