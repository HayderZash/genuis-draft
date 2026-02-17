import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is admin
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await userClient.auth.getUser();
    if (claimsError || !claimsData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check admin role
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", claimsData.user.id)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: Admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { action, ...body } = await req.json();

    if (action === "list-users") {
      const { data: profiles } = await adminClient
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      // Get roles for all users
      const { data: roles } = await adminClient.from("user_roles").select("*");

      // Get auth users for email
      const { data: { users: authUsers } } = await adminClient.auth.admin.listUsers({ perPage: 1000 });

      const enriched = (profiles || []).map((p: any) => {
        const authUser = authUsers?.find((u: any) => u.id === p.user_id);
        const userRoles = (roles || []).filter((r: any) => r.user_id === p.user_id);
        return {
          ...p,
          email: authUser?.email || "",
          roles: userRoles.map((r: any) => r.role),
        };
      });

      return new Response(JSON.stringify({ users: enriched }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "create-user") {
      const { email, password, displayName, phone, durationDays, durationHours } = body;
      
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (durationDays || 30));
      expiresAt.setHours(expiresAt.getHours() + (durationHours || 0));

      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: displayName },
      });

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Update profile with phone and expiry
      await adminClient
        .from("profiles")
        .update({ phone, expires_at: expiresAt.toISOString(), display_name: displayName })
        .eq("user_id", newUser.user.id);

      return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "toggle-active") {
      const { userId, isActive } = body;
      await adminClient.from("profiles").update({ is_active: isActive }).eq("user_id", userId);
      
      if (!isActive) {
        // Ban the user in auth
        await adminClient.auth.admin.updateUserById(userId, { ban_duration: "876000h" }); // ~100 years
      } else {
        await adminClient.auth.admin.updateUserById(userId, { ban_duration: "none" });
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "extend-duration") {
      const { userId, days, hours } = body;
      
      // Get current expiry
      const { data: profile } = await adminClient
        .from("profiles")
        .select("expires_at")
        .eq("user_id", userId)
        .single();

      const baseDate = profile?.expires_at ? new Date(profile.expires_at) : new Date();
      const now = new Date();
      const startFrom = baseDate > now ? baseDate : now;
      
      startFrom.setDate(startFrom.getDate() + (days || 0));
      startFrom.setHours(startFrom.getHours() + (hours || 0));

      await adminClient
        .from("profiles")
        .update({ expires_at: startFrom.toISOString() })
        .eq("user_id", userId);

      return new Response(JSON.stringify({ success: true, new_expires_at: startFrom.toISOString() }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "delete-user") {
      const { userId } = body;
      await adminClient.auth.admin.deleteUser(userId);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
