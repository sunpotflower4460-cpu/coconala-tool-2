import type { ClientInput } from "@/domain/clients/types";

export const sampleClients: ClientInput[] = [
  {
    name: "サンプル株式会社",
    contactName: "鈴木一郎",
    postalCode: "150-0001",
    address: "東京都渋谷区神宮前1-1-1",
    phone: "03-1234-5678",
    email: "contact@example.com",
    note: null,
  },
  {
    name: "デモ制作合同会社",
    contactName: "田中花子",
    postalCode: "530-0001",
    address: "大阪府大阪市北区梅田1-1-1",
    phone: "06-1234-5678",
    email: "info@demo-example.com",
    note: "YouTube案件が中心",
  },
];
