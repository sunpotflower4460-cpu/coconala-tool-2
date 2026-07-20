export interface Client {
  id: number;
  name: string;
  contactName: string | null;
  postalCode: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  note: string | null;
}

export interface ClientInput {
  name: string;
  contactName: string | null;
  postalCode: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  note: string | null;
}
