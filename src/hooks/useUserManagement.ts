import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type AppRole = "admin" | "warehouse_staff" | "viewer";

export interface UserWithRole {
  id: string;
  email: string;
  created_at: string;
  role: AppRole | null;
  role_id: string | null;
}

export function useUsersWithRoles() {
  return useQuery({
    queryKey: ["users-with-roles"],
    queryFn: async (): Promise<UserWithRole[]> => {
      // First get all profiles (admin can see all)
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, created_at");

      if (profilesError) throw profilesError;

      // Then get all roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("id, user_id, role");

      if (rolesError) throw rolesError;

      // Combine profiles with roles
      return (profiles || []).map((profile) => {
        const userRole = roles?.find((r) => r.user_id === profile.id);
        return {
          id: profile.id,
          email: profile.email,
          created_at: profile.created_at,
          role: userRole?.role as AppRole | null,
          role_id: userRole?.id || null,
        };
      });
    },
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      roleId,
      newRole,
    }: {
      userId: string;
      roleId: string | null;
      newRole: AppRole;
    }) => {
      if (roleId) {
        // Update existing role
        const { error } = await supabase
          .from("user_roles")
          .update({ role: newRole })
          .eq("id", roleId);
        if (error) throw error;
      } else {
        // Insert new role
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: newRole });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      toast.success("用户角色已更新");
    },
    onError: (error) => {
      console.error("Failed to update role:", error);
      toast.error("更新角色失败，请确认您有管理员权限");
    },
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      username,
      password,
      role,
    }: {
      username: string;
      password: string;
      role: AppRole;
    }) => {
      // Use Supabase Admin API via edge function to create user
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: { username, password, role },
      });

      if (error) {
        console.error("Edge function error:", error);
        throw new Error(error.message || "Edge Function 调用失败");
      }
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      toast.success("用户创建成功");
    },
    onError: (error) => {
      console.error("Failed to create user:", error);
      toast.error(`创建用户失败: ${error.message}`);
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { userId },
      });

      if (error) {
        console.error("Edge function error:", error);
        throw new Error(error.message || "Edge Function 调用失败");
      }
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      toast.success("用户已删除");
    },
    onError: (error) => {
      console.error("Failed to delete user:", error);
      toast.error(`删除用户失败: ${error.message}`);
    },
  });
}

export function useCurrentUserRole() {
  return useQuery({
    queryKey: ["current-user-role"],
    queryFn: async (): Promise<AppRole | null> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (error) {
        console.error("Error fetching user role:", error);
        return null;
      }

      return data?.role as AppRole;
    },
  });
}
