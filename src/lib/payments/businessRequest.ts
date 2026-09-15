import type { CeloPaymentNetwork } from "@/lib/celo";
import type { StablecoinSymbol } from "@/lib/assets";

export type BusinessPaymentRequestStatus = "pending" | "paid" | "cancelled";

export type BusinessPaymentRequest = {
  id: string;
  recipient: `0x${string}`;
  asset: StablecoinSymbol;
  network: CeloPaymentNetwork;
  amount: string;
  memo?: string;
  businessName?: string;
  externalReference?: string;
  status: BusinessPaymentRequestStatus;
  paymentTxHash?: `0x${string}`;
  createdAt: string;
  paidAt?: string;
  cancelledAt?: string;
};
