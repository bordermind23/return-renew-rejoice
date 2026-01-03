import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Safe error response - logs details server-side, returns generic message to client
function safeErrorResponse(error: unknown, fallbackMessage: string, status = 500) {
  console.error("[Error Details]", error);
  return new Response(
    JSON.stringify({ error: fallbackMessage }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// Input validation functions
function validateUsername(username: string): { valid: boolean; error?: string } {
  if (!username || typeof username !== "string") {
    return { valid: false, error: "用户名不能为空" };
  }
  if (username.length < 3 || username.length > 20) {
    return { valid: false, error: "用户名长度必须为3-20个字符" };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return { valid: false, error: "用户名只能包含字母、数字、下划线和连字符" };
  }
  return { valid: true };
}

function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password || typeof password !== "string") {
    return { valid: false, error: "密码不能为空" };
  }
  if (password.length < 8) {
    return { valid: false, error: "密码长度必须至少8个字符" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: "密码必须包含至少一个大写字母" };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: "密码必须包含至少一个小写字母" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: "密码必须包含至少一个数字" };
  }
  return { valid: true };
}

function validateRole(role: string): { valid: boolean; error?: string } {
  const validRoles = ["admin", "warehouse_staff", "viewer"];
  if (!role || typeof role !== "string") {
    return { valid: false, error: "角色不能为空" };
  }
  if (!validRoles.includes(role)) {
    return { valid: false, error: "无效的角色" };
  }
  return { valid: true };
}

Deno.serve(async (req) => {
  console.log("[create-user] Function called, method:", req.method);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error("[create-user] Missing environment variables");
      return safeErrorResponse(null, "服务器配置错误");
    }

    // Get the authorization header from the request
    const authHeader = req.headers.get("Authorization");
    
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
    
    if (userError || !requestingUser) {
      console.error("[create-user] Token verification failed");
      return new Response(
        JSON.stringify({ error: "认证失败" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if the requesting user is an admin
    const { data: roleData, error: roleError } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", requestingUser.id)
      .single();

    if (roleError || roleData?.role !== "admin") {
      console.error("[create-user] Non-admin user attempted to create user");
      return new Response(
        JSON.stringify({ error: "只有管理员可以创建用户" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the request body
    const body = await req.json();
    const { username, password, role } = body;

    // Validate inputs
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
      return new Response(
        JSON.stringify({ error: usernameValidation.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return new Response(
        JSON.stringify({ error: passwordValidation.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const roleValidation = validateRole(role);
    if (!roleValidation.valid) {
      return new Response(
        JSON.stringify({ error: roleValidation.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[create-user] Creating user:", username);

    // Create a placeholder email for Supabase Auth (required)
    const placeholderEmail = `${username}@placeholder.local`;

    // Create the user using service role
    const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
      email: placeholderEmail,
      password,
      email_confirm: true,
      user_metadata: {
        username: username,
        display_name: username,
      }
    });

    if (createError) {
      console.error("[create-user] Failed to create user");
      // Return generic error instead of exposing auth API details
      return new Response(
        JSON.stringify({ error: "创建用户失败，请检查用户名是否已存在" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[create-user] User created successfully:", newUser?.user?.id);

    // Update the profiles table to show the actual username instead of placeholder email
    if (newUser.user) {
      const { error: profileUpdateError } = await supabaseClient
        .from("profiles")
        .update({ email: username })
        .eq("id", newUser.user.id);
      
      if (profileUpdateError) {
        console.error("[create-user] Profile update failed");
      }
    }

    // Handle role assignment
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
          console.error("[create-user] Role update failed");
        }
      } else {
        // Insert new role
        const { error: insertRoleError } = await supabaseClient
          .from("user_roles")
          .insert({ user_id: newUser.user.id, role });
        
        if (insertRoleError) {
          console.error("[create-user] Role insert failed");
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, user: newUser.user }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return safeErrorResponse(error, "创建用户失败，请稍后重试");
  }
});
