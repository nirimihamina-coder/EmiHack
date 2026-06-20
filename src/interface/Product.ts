export interface Product {
  id?: string;
  name: string;
  price: number;
  image_url: string;

  isLocal?: boolean;
  isSynced?: boolean;
}
