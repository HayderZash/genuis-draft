import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { action, ...body } = await req.json();
    const json = (data: any, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // consume-points does NOT require admin - it's called by regular users
    if (action === "consume-points") {
      const { userId, feature, cost } = body;
      
      // Check profile
      const { data: profile } = await adminClient.from("profiles").select("account_type, is_active, expires_at").eq("user_id", userId).single();
      if (!profile) return json({ allowed: false, error: "No profile found" });
      
      // Check if user is active
      if (!profile.is_active) return json({ allowed: false, error: "Account disabled" });
      
      // Check expiry
      if (profile.expires_at && new Date(profile.expires_at) < new Date()) {
        return json({ allowed: false, error: "Account expired" });
      }

      // Check feature access (applies to ALL account types)
      const { data: access } = await adminClient.from("user_feature_access").select("is_enabled").eq("user_id", userId).eq("feature", feature).single();
      if (access && !access.is_enabled) return json({ allowed: false, error: "Feature disabled" });

      // Unlimited accounts don't need point checks
      if (profile.account_type !== 'points') return json({ allowed: true });

      if (cost === 0) return json({ allowed: true });

      // Check points
      const { data: pts } = await adminClient.from("user_feature_points").select("*").eq("user_id", userId).eq("feature", feature).single();
      if (!pts) return json({ allowed: false, error: "No points allocated" });
      if (pts.expires_at && new Date(pts.expires_at) < new Date()) return json({ allowed: false, error: "Points expired" });
      if (pts.points_remaining < cost) return json({ allowed: false, error: "Insufficient points" });

      // Deduct
      await adminClient.from("user_feature_points").update({ points_remaining: pts.points_remaining - cost }).eq("id", pts.id);
      return json({ allowed: true, remaining: pts.points_remaining - cost });
    }

    // All other actions require admin auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await userClient.auth.getUser();
    if (claimsError || !claimsData.user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const ADMIN_EMAIL = "hayderpailot@gmail.com";
    const userEmail = (claimsData.user.email || "").toLowerCase();
    let isAdmin = userEmail === ADMIN_EMAIL;

    if (!isAdmin) {
      const { data: roleData } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", claimsData.user.id)
        .eq("role", "admin")
        .maybeSingle();
      isAdmin = !!roleData;
    }

    if (!isAdmin) {
      return json({ error: "Forbidden: Admin only" }, 403);
    }

    // Self-heal: ensure admin role row exists for the hard-coded admin
    if (userEmail === ADMIN_EMAIL) {
      await adminClient.from("user_roles").upsert(
        { user_id: claimsData.user.id, role: "admin" },
        { onConflict: "user_id,role" }
      );
    }

    // ── LIST USERS ──
    if (action === "list-users") {
      const { data: profiles } = await adminClient.from("profiles").select("*").order("created_at", { ascending: false });
      const { data: roles } = await adminClient.from("user_roles").select("*");
      const { data: featureAccess } = await adminClient.from("user_feature_access").select("*");
      const { data: featurePoints } = await adminClient.from("user_feature_points").select("*");
      const { data: { users: authUsers } } = await adminClient.auth.admin.listUsers({ perPage: 1000 });

      const enriched = (profiles || []).map((p: any) => {
        const authUser = authUsers?.find((u: any) => u.id === p.user_id);
        const userRoles = (roles || []).filter((r: any) => r.user_id === p.user_id);
        const userFA: Record<string, boolean> = {};
        (featureAccess || []).filter((f: any) => f.user_id === p.user_id).forEach((f: any) => { userFA[f.feature] = f.is_enabled; });
        const userFP: Record<string, any> = {};
        (featurePoints || []).filter((f: any) => f.user_id === p.user_id).forEach((f: any) => { userFP[f.feature] = { points: f.points_remaining, expires_at: f.expires_at }; });

        return {
          ...p,
          email: authUser?.email || "",
          roles: userRoles.map((r: any) => r.role),
          feature_access: userFA,
          feature_points: userFP,
        };
      });

      return json({ users: enriched });
    }

    // ── CREATE USER ──
    if (action === "create-user") {
      const { email, password, displayName, phone, durationDays, durationHours, accountType, featureAccess, featurePoints, pointsExpiresAt } = body;

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (durationDays || 30));
      expiresAt.setHours(expiresAt.getHours() + (durationHours || 0));

      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { display_name: displayName },
      });
      if (createError) return json({ error: createError.message }, 400);

      const userId = newUser.user.id;

      await adminClient.from("profiles").update({
        phone, expires_at: expiresAt.toISOString(), display_name: displayName,
        account_type: accountType || 'unlimited',
      }).eq("user_id", userId);

      if (featureAccess) {
        const rows = Object.entries(featureAccess).map(([feature, enabled]) => ({
          user_id: userId, feature, is_enabled: enabled as boolean,
        }));
        await adminClient.from("user_feature_access").upsert(rows, { onConflict: "user_id,feature" });
      }

      if (accountType === 'points' && featurePoints) {
        const rows = Object.entries(featurePoints).map(([feature, points]) => ({
          user_id: userId, feature, points_remaining: points as number,
          expires_at: pointsExpiresAt ? new Date(pointsExpiresAt).toISOString() : null,
        }));
        await adminClient.from("user_feature_points").upsert(rows, { onConflict: "user_id,feature" });
      }

      return json({ success: true, user_id: userId });
    }

    // ── UPDATE USER ──
    if (action === "update-user") {
      const { userId, displayName, phone, accountType, featureAccess, featurePoints, pointsExpiresAt } = body;

      await adminClient.from("profiles").update({
        display_name: displayName, phone, account_type: accountType || 'unlimited',
      }).eq("user_id", userId);

      if (featureAccess) {
        const rows = Object.entries(featureAccess).map(([feature, enabled]) => ({
          user_id: userId, feature, is_enabled: enabled as boolean,
        }));
        await adminClient.from("user_feature_access").upsert(rows, { onConflict: "user_id,feature" });
      }

      if (accountType === 'points' && featurePoints) {
        const rows = Object.entries(featurePoints).map(([feature, points]) => ({
          user_id: userId, feature, points_remaining: points as number,
          expires_at: pointsExpiresAt ? new Date(pointsExpiresAt).toISOString() : null,
        }));
        await adminClient.from("user_feature_points").upsert(rows, { onConflict: "user_id,feature" });
      }

      return json({ success: true });
    }

    // ── TOGGLE ACTIVE ──
    if (action === "toggle-active") {
      const { userId, isActive } = body;
      await adminClient.from("profiles").update({ is_active: isActive }).eq("user_id", userId);
      if (!isActive) {
        await adminClient.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
      } else {
        await adminClient.auth.admin.updateUserById(userId, { ban_duration: "none" });
      }
      return json({ success: true });
    }

    // ── EXTEND DURATION ──
    if (action === "extend-duration") {
      const { userId, days, hours } = body;
      const { data: profile } = await adminClient.from("profiles").select("expires_at").eq("user_id", userId).single();
      const baseDate = profile?.expires_at ? new Date(profile.expires_at) : new Date();
      const now = new Date();
      const startFrom = baseDate > now ? baseDate : now;
      startFrom.setDate(startFrom.getDate() + (days || 0));
      startFrom.setHours(startFrom.getHours() + (hours || 0));
      await adminClient.from("profiles").update({ expires_at: startFrom.toISOString() }).eq("user_id", userId);
      return json({ success: true, new_expires_at: startFrom.toISOString() });
    }

    // ── DELETE USER ──
    if (action === "delete-user") {
      const { userId } = body;
      await adminClient.auth.admin.deleteUser(userId);
      return json({ success: true });
    }

    // ── UPDATE SETTINGS ──
    if (action === "update-settings") {
      const { settings } = body;
      for (const s of settings) {
        await adminClient.from("platform_settings").upsert(
          { key: s.key, value: s.value, updated_at: new Date().toISOString() },
          { onConflict: "key" }
        );
      }
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
