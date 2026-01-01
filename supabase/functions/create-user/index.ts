import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  console.log("Create user function called, method:", req.method);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    console.log("SUPABASE_URL exists:", !!supabaseUrl);
    console.log("SUPABASE_SERVICE_ROLE_KEY exists:", !!supabaseServiceRoleKey);

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error("Missing environment variables");
      return new Response(
        JSON.stringify({ error: "服务器配置错误" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the authorization header from the request
    const authHeader = req.headers.get("Authorization");
    console.log("Authorization header present:", !!authHeader);
    
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "未授权" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a client with service role key
    const supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Verify the requesting user is an admin
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: requestingUser }, error: userError } = await supabaseClient.auth.getUser(token);
    
    console.log("Requesting user ID:", requestingUser?.id);
    console.log("User verification error:", userError?.message);
    
    if (userError || !requestingUser) {
      return new Response(
        JSON.stringify({ error: "无效的认证令牌" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if the requesting user is an admin
    const { data: roleData, error: roleError } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", requestingUser.id)
      .single();

    console.log("User role:", roleData?.role);
    console.log("Role query error:", roleError?.message);

    if (roleError || roleData?.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "只有管理员可以创建用户" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the request body
    const body = await req.json();
    console.log("Request body:", JSON.stringify({ ...body, password: "***" }));
    
    const { email, username, password, role } = body;

    // Support both email and username - if username provided without @, treat as username
    let finalEmail = email || username;
    
    // If it looks like a username (no @), create a fake email for it
    if (finalEmail && !finalEmail.includes("@")) {
      // Store the username in user metadata
      finalEmail = `${finalEmail}@placeholder.local`;
    }

    if (!finalEmail || !password || !role) {
      console.error("Missing required params:", { email: !!finalEmail, password: !!password, role: !!role });
      return new Response(
        JSON.stringify({ error: "缺少必要参数（邮箱/用户名、密码、角色）" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create the user using service role
    console.log("Creating user with email:", finalEmail);
    
    const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
      email: finalEmail,
      password,
      email_confirm: true, // Auto-confirm the email
      user_metadata: {
        username: email || username,
        display_name: email || username,
      }
    });

    if (createError) {
      console.error("Error creating user:", createError.message, createError);
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("User created successfully:", newUser?.user?.id);

    // The user_roles entry should be created by the trigger, but let's update it with the correct role
    if (newUser.user) {
      // Wait a moment for the trigger to create the role entry
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // First check if role exists
      const { data: existingRole } = await supabaseClient
        .from("user_roles")
        .select("id")
        .eq("user_id", newUser.user.id)
        .single();

      if (existingRole) {
        // Update existing role
        const { error: updateRoleError } = await supabaseClient
          .from("user_roles")
          .update({ role })
          .eq("user_id", newUser.user.id);

        if (updateRoleError) {
          console.error("Error updating role:", updateRoleError.message);
        } else {
          console.log("Role updated to:", role);
        }
      } else {
        // Insert new role
        const { error: insertRoleError } = await supabaseClient
          .from("user_roles")
          .insert({ user_id: newUser.user.id, role });
        
        if (insertRoleError) {
          console.error("Error inserting role:", insertRoleError.message);
        } else {
          console.log("Role inserted:", role);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, user: newUser.user }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    const errorMessage = error instanceof Error ? error.message : "未知错误";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
