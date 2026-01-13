import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

declare const Deno: any;

type Action = "create_user" | "update_user" | "delete_user" | "activate_user";

type CreateUserPayload = {
  email: string;
  redirect_to?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  role?: string | null;
};

type UpdateUserPayload = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  role?: string | null;
  approval_status?: string | null;
};

type DeleteUserPayload = {
  id: string;
};

type ActivateUserPayload = {
  id?: string | null;
};

type RequestBody =
  | { action: "create_user"; payload: CreateUserPayload }
  | { action: "update_user"; payload: UpdateUserPayload }
  | { action: "delete_user"; payload: DeleteUserPayload }
  | { action: "activate_user"; payload?: ActivateUserPayload };

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return json(200, { ok: true });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" });
  }

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return json(401, { error: "Missing Bearer token" });

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Validate caller
  const { data: userData, error: userErr } = await adminClient.auth.getUser(token);
  if (userErr || !userData?.user) return json(401, { error: "Invalid user" });

  const callerId = userData.user.id;

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  try {
    if (body.action === "activate_user") {
      const targetId = String((body.payload as any)?.id || callerId).trim();
      if (targetId !== callerId) return json(403, { error: "Cannot activate another user" });

      const updates: Record<string, unknown> = {
        approval_status: "approved",
        updated_at: new Date().toISOString(),
      };

      const { error: updErr } = await adminClient.from("profiles").update(updates).eq("id", callerId);
      if (updErr) return json(400, { error: updErr.message || "Failed to activate user" });

      return json(200, { ok: true });
    }

    const { data: callerProfile, error: callerProfileErr } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", callerId)
      .maybeSingle();

    if (callerProfileErr) return json(500, { error: "Failed to load caller profile" });

    const callerRole = String((callerProfile as any)?.role || "").toLowerCase();
    if (callerRole !== "admin") return json(403, { error: "Admin only" });

    if (body.action === "create_user") {
      const { email, redirect_to, first_name, last_name, role } = body.payload;
      const normalizedEmail = String(email || "").trim().toLowerCase();
      if (!normalizedEmail) return json(400, { error: "Email is required" });

      const redirectTo = redirect_to ? String(redirect_to) : undefined;

      const { data: inviteData, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(
        normalizedEmail,
        redirectTo ? { redirectTo } : undefined,
      );
      if (inviteErr) return json(400, { error: inviteErr.message || "Failed to invite user" });

      const invitedUserId = inviteData?.user?.id;
      if (!invitedUserId) return json(500, { error: "Invite succeeded but no user id returned" });

      const profileRow: Record<string, unknown> = {
        id: invitedUserId,
        email: normalizedEmail,
        first_name: first_name ?? null,
        last_name: last_name ?? null,
        role: role ?? "client",
        updated_at: new Date().toISOString(),
        approval_status: "pending",
      };

      const { error: upsertErr } = await adminClient
        .from("profiles")
        .upsert(profileRow, { onConflict: "id" });

      if (upsertErr) return json(400, { error: upsertErr.message || "Failed to upsert profile" });

      return json(200, { ok: true, user_id: invitedUserId });
    }

    if (body.action === "update_user") {
      const { id, first_name, last_name, role, approval_status } = body.payload;
      const userId = String(id || "").trim();
      if (!userId) return json(400, { error: "User id is required" });

      if (userId === callerId && (role !== undefined || approval_status !== undefined)) {
        return json(400, { error: "Cannot change your own role or status" });
      }

      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (first_name !== undefined) updates.first_name = first_name;
      if (last_name !== undefined) updates.last_name = last_name;
      if (role !== undefined) updates.role = role;
      if (approval_status !== undefined) updates.approval_status = approval_status;

      const { error: updErr } = await adminClient.from("profiles").update(updates).eq("id", userId);
      if (updErr) return json(400, { error: updErr.message || "Failed to update profile" });

      return json(200, { ok: true });
    }

    if (body.action === "delete_user") {
      const userId = String(body.payload?.id || "").trim();
      if (!userId) return json(400, { error: "User id is required" });
      if (userId === callerId) return json(400, { error: "Cannot delete your own account" });

      const { error: delErr } = await adminClient.auth.admin.deleteUser(userId);
      if (delErr) return json(400, { error: delErr.message || "Failed to delete user" });

      return json(200, { ok: true });
    }

    return json(400, { error: "Unknown action" });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : "Unknown error" });
  }
});
