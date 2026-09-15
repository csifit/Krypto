import { isAddress } from "viem";
import type {
  BeneficiaryPartner,
  BeneficiaryWallet,
  PartnerType,
} from "@/lib/beneficiaries/types";
import { AccessPolicyError, requireSensitiveAction } from "@/lib/server/access";
import { AuthError, requirePrivyUser } from "@/lib/server/privy";
import { ensureProfile } from "@/lib/server/profile";
import { getSupabaseAdmin } from "@/lib/server/supabase";

export const runtime = "nodejs";

type PartnerRow = {
  id: string;
  name: string;
  partner_type: string;
  created_at: string;
  updated_at: string;
};

type WalletRow = {
  id: string;
  partner_id: string;
  address: string;
  created_at: string;
  updated_at: string;
};

function mapWallet(row: WalletRow): BeneficiaryWallet {
  return {
    id: row.id,
    address: row.address as `0x${string}`,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPartners(
  partners: PartnerRow[],
  wallets: WalletRow[],
): BeneficiaryPartner[] {
  const walletMap = new Map<string, BeneficiaryWallet[]>();

  for (const wallet of wallets) {
    const current = walletMap.get(wallet.partner_id) ?? [];
    current.push(mapWallet(wallet));
    walletMap.set(wallet.partner_id, current);
  }

  return partners
    .map((partner) => ({
      id: partner.id,
      name: partner.name,
      partnerType: partner.partner_type as PartnerType,
      wallets: walletMap.get(partner.id) ?? [],
      createdAt: partner.created_at,
      updatedAt: partner.updated_at,
    }))
    .sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
}

async function loadPartners(userId: string) {
  const supabase = getSupabaseAdmin();

  const [{ data: partners, error: partnerError }, { data: wallets, error: walletError }] =
    await Promise.all([
      supabase
        .from("beneficiary_partners")
        .select("id, name, partner_type, created_at, updated_at")
        .eq("privy_user_id", userId)
        .order("name", { ascending: true }),
      supabase
        .from("beneficiary_wallets")
        .select("id, partner_id, address, created_at, updated_at")
        .eq("privy_user_id", userId)
        .order("created_at", { ascending: true }),
    ]);

  if (partnerError) throw partnerError;
  if (walletError) throw walletError;

  return mapPartners(
    (partners ?? []) as PartnerRow[],
    (wallets ?? []) as WalletRow[],
  );
}

async function requirePartner(userId: string, partnerId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("beneficiary_partners")
    .select("id, name")
    .eq("id", partnerId)
    .eq("privy_user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new AccessPolicyError("Partner not found", 404);
  return data;
}

export async function GET(request: Request) {
  try {
    const { userId } = await requirePrivyUser(request);
    return Response.json({ partners: await loadPartners(userId) });
  } catch (error) {
    if (error instanceof AuthError || error instanceof AccessPolicyError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("beneficiary partner list failed", error);
    return Response.json({ error: "Could not load beneficiaries" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await requirePrivyUser(request);
    await requireSensitiveAction(userId);

    const body = (await request.json()) as {
      name?: string;
      partnerType?: PartnerType;
      address?: string;
    };

    const name = body.name?.trim() ?? "";
    const address = body.address?.trim() ?? "";

    if (!name || name.length > 120) {
      return Response.json({ error: "Enter a partner name" }, { status: 400 });
    }
    if (body.partnerType !== "business" && body.partnerType !== "private") {
      return Response.json({ error: "Choose Business or Private" }, { status: 400 });
    }
    if (!isAddress(address)) {
      return Response.json({ error: "Enter a valid wallet address" }, { status: 400 });
    }

    await ensureProfile(userId);
    const supabase = getSupabaseAdmin();

    const { data: partner, error: partnerError } = await supabase
      .from("beneficiary_partners")
      .insert({
        privy_user_id: userId,
        name,
        partner_type: body.partnerType,
      })
      .select("id")
      .single();

    if (partnerError) throw partnerError;

    const { error: walletError } = await supabase
      .from("beneficiary_wallets")
      .insert({
        partner_id: partner.id,
        privy_user_id: userId,
        address,
      });

    if (walletError) {
      await supabase
        .from("beneficiary_partners")
        .delete()
        .eq("id", partner.id)
        .eq("privy_user_id", userId);

      if (walletError.code === "23505") {
        return Response.json(
          { error: "This wallet is already saved to a partner" },
          { status: 409 },
        );
      }
      throw walletError;
    }

    return Response.json({ partners: await loadPartners(userId) });
  } catch (error) {
    if (error instanceof AuthError || error instanceof AccessPolicyError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("beneficiary partner create failed", error);
    return Response.json({ error: "Could not save partner" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { userId } = await requirePrivyUser(request);
    await requireSensitiveAction(userId);

    const body = (await request.json()) as {
      action?:
        | "update-partner"
        | "add-wallet"
        | "update-wallet"
        | "remove-wallet"
        | "attach-payment";
      partnerId?: string;
      walletId?: string;
      name?: string;
      partnerType?: PartnerType;
      address?: string;
      paymentId?: string;
    };

    if (!body.partnerId) {
      return Response.json({ error: "Missing partner" }, { status: 400 });
    }

    const partner = await requirePartner(userId, body.partnerId);
    const supabase = getSupabaseAdmin();

    if (body.action === "update-partner") {
      const name = body.name?.trim() ?? "";
      if (!name || name.length > 120) {
        return Response.json({ error: "Enter a partner name" }, { status: 400 });
      }
      if (body.partnerType !== "business" && body.partnerType !== "private") {
        return Response.json({ error: "Choose Business or Private" }, { status: 400 });
      }

      const { error } = await supabase
        .from("beneficiary_partners")
        .update({
          name,
          partner_type: body.partnerType,
        })
        .eq("id", body.partnerId)
        .eq("privy_user_id", userId);

      if (error) throw error;
    } else if (body.action === "add-wallet") {
      const address = body.address?.trim() ?? "";
      if (!isAddress(address)) {
        return Response.json({ error: "Enter a valid wallet address" }, { status: 400 });
      }

      const { error } = await supabase
        .from("beneficiary_wallets")
        .insert({
          partner_id: body.partnerId,
          privy_user_id: userId,
          address,
        });

      if (error?.code === "23505") {
        return Response.json(
          { error: "This wallet is already saved to a partner" },
          { status: 409 },
        );
      }
      if (error) throw error;
    } else if (body.action === "update-wallet") {
      const address = body.address?.trim() ?? "";
      if (!body.walletId || !isAddress(address)) {
        return Response.json({ error: "Enter a valid wallet address" }, { status: 400 });
      }

      const { data, error } = await supabase
        .from("beneficiary_wallets")
        .update({ address })
        .eq("id", body.walletId)
        .eq("partner_id", body.partnerId)
        .eq("privy_user_id", userId)
        .select("id")
        .maybeSingle();

      if (error?.code === "23505") {
        return Response.json(
          { error: "This wallet is already saved to a partner" },
          { status: 409 },
        );
      }
      if (error) throw error;
      if (!data) return Response.json({ error: "Wallet not found" }, { status: 404 });
    } else if (body.action === "remove-wallet") {
      if (!body.walletId) {
        return Response.json({ error: "Missing wallet" }, { status: 400 });
      }

      const { error } = await supabase
        .from("beneficiary_wallets")
        .delete()
        .eq("id", body.walletId)
        .eq("partner_id", body.partnerId)
        .eq("privy_user_id", userId);

      if (error) throw error;
    } else if (body.action === "attach-payment") {
      if (!body.paymentId) {
        return Response.json({ error: "Missing payment" }, { status: 400 });
      }

      const { data: wallets, error: walletError } = await supabase
        .from("beneficiary_wallets")
        .select("address")
        .eq("partner_id", body.partnerId)
        .eq("privy_user_id", userId);

      if (walletError) throw walletError;

      const walletSet = new Set(
        (wallets ?? []).map((wallet) => wallet.address.toLowerCase()),
      );

      const { data: payment, error: paymentError } = await supabase
        .from("payments")
        .select("id, destination")
        .eq("id", body.paymentId)
        .eq("privy_user_id", userId)
        .maybeSingle();

      if (paymentError) throw paymentError;
      if (!payment) return Response.json({ error: "Payment not found" }, { status: 404 });

      if (!walletSet.has(payment.destination.toLowerCase())) {
        return Response.json(
          { error: "Payment destination is not one of this partner's wallets" },
          { status: 409 },
        );
      }

      const { error: attachError } = await supabase
        .from("payments")
        .update({
          beneficiary_partner_id: body.partnerId,
          beneficiary_name: partner.name,
        })
        .eq("id", body.paymentId)
        .eq("privy_user_id", userId);

      if (attachError) throw attachError;
    } else {
      return Response.json({ error: "Unsupported partner action" }, { status: 400 });
    }

    return Response.json({ partners: await loadPartners(userId) });
  } catch (error) {
    if (error instanceof AuthError || error instanceof AccessPolicyError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("beneficiary partner update failed", error);
    return Response.json({ error: "Could not update partner" }, { status: 500 });
  }
}
