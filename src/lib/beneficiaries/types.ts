export type PartnerType = "business" | "private";

export type BeneficiaryWallet = {
  id: string;
  address: `0x${string}`;
  createdAt: string;
  updatedAt: string;
};

export type BeneficiaryPartner = {
  id: string;
  name: string;
  partnerType: PartnerType;
  wallets: BeneficiaryWallet[];
  createdAt: string;
  updatedAt: string;
};
