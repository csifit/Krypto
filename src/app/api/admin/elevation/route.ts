import { NextResponse } from "next/server";
import { AccessPolicyError, requireSuperAdmin } from "@/lib/server/access";
import {
  ADMIN_ELEVATION_COOKIE,
  revokeAdminElevation,
} from "@/lib/server/adminElevation";
import { AuthError, requirePrivyUser } from "@/lib/server/privy";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  try {
    const { userId } = await requirePrivyUser(request);
    await requireSuperAdmin(userId);
    await revokeAdminElevation(request, userId);

    const response = NextResponse.json({ ok: true });
    response.cookies.set({
      name: ADMIN_ELEVATION_COOKIE,
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/admin",
      maxAge: 0,
    });
    return response;
  } catch (error) {
    if (error instanceof AuthError || error instanceof AccessPolicyError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("admin elevation lock failed", error);
    return Response.json(
      { error: "Could not lock privileged access" },
      { status: 500 },
    );
  }
}
