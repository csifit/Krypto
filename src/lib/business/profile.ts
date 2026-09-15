import type { StablecoinSymbol } from "@/lib/assets";

export type BusinessProfile = {
  businessName: string;
  countryCode?: string;
  businessEmail?: string;
  defaultReceiveWallet?: `0x${string}`;
  defaultReceiveAsset?: StablecoinSymbol;
  createdAt: string;
  updatedAt: string;
};
