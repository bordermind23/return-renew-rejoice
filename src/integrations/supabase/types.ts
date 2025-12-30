export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      carriers: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      inbound_items: {
        Row: {
          created_at: string
          grade: string
          id: string
          lpn: string
          missing_parts: string[] | null
          package_photo: string | null
          processed_at: string
          processed_by: string
          product_name: string
          product_photo: string | null
          product_sku: string
          removal_order_id: string
          return_reason: string | null
          shipment_id: string | null
          tracking_number: string | null
        }
        Insert: {
          created_at?: string
          grade?: string
          id?: string
          lpn: string
          missing_parts?: string[] | null
          package_photo?: string | null
          processed_at?: string
          processed_by: string
          product_name: string
          product_photo?: string | null
          product_sku: string
          removal_order_id: string
          return_reason?: string | null
          shipment_id?: string | null
          tracking_number?: string | null
        }
        Update: {
          created_at?: string
          grade?: string
          id?: string
          lpn?: string
          missing_parts?: string[] | null
          package_photo?: string | null
          processed_at?: string
          processed_by?: string
          product_name?: string
          product_photo?: string | null
          product_sku?: string
          removal_order_id?: string
          return_reason?: string | null
          shipment_id?: string | null
          tracking_number?: string | null
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          created_at: string
          grade_a_stock: number
          grade_b_stock: number
          grade_c_stock: number
          id: string
          new_stock: number
          product_category: string | null
          product_image: string | null
          product_name: string
          sku: string
          total_stock: number
          updated_at: string
          warehouse: string
        }
        Insert: {
          created_at?: string
          grade_a_stock?: number
          grade_b_stock?: number
          grade_c_stock?: number
          id?: string
          new_stock?: number
          product_category?: string | null
          product_image?: string | null
          product_name: string
          sku: string
          total_stock?: number
          updated_at?: string
          warehouse?: string
        }
        Update: {
          created_at?: string
          grade_a_stock?: number
          grade_b_stock?: number
          grade_c_stock?: number
          id?: string
          new_stock?: number
          product_category?: string | null
          product_image?: string | null
          product_name?: string
          sku?: string
          total_stock?: number
          updated_at?: string
          warehouse?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          created_at: string
          id: string
          inbound_at: string | null
          lpn: string
          order_number: string
          removal_order_id: string
          removed_at: string | null
          station: string
          store_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          inbound_at?: string | null
          lpn: string
          order_number: string
          removal_order_id: string
          removed_at?: string | null
          station: string
          store_name: string
        }
        Update: {
          created_at?: string
          id?: string
          inbound_at?: string | null
          lpn?: string
          order_number?: string
          removal_order_id?: string
          removed_at?: string | null
          station?: string
          store_name?: string
        }
        Relationships: []
      }
      removal_shipments: {
        Row: {
          carrier: string
          country: string | null
          created_at: string
          fnsku: string
          id: string
          msku: string | null
          note: string | null
          order_id: string
          product_image: string | null
          product_name: string
          product_sku: string
          product_type: string | null
          quantity: number
          ship_date: string | null
          status: string
          store_name: string | null
          tracking_number: string
          updated_at: string
        }
        Insert: {
          carrier: string
          country?: string | null
          created_at?: string
          fnsku: string
          id?: string
          msku?: string | null
          note?: string | null
          order_id: string
          product_image?: string | null
          product_name: string
          product_sku: string
          product_type?: string | null
          quantity?: number
          ship_date?: string | null
          status?: string
          store_name?: string | null
          tracking_number: string
          updated_at?: string
        }
        Update: {
          carrier?: string
          country?: string | null
          created_at?: string
          fnsku?: string
          id?: string
          msku?: string | null
          note?: string | null
          order_id?: string
          product_image?: string | null
          product_name?: string
          product_sku?: string
          product_type?: string | null
          quantity?: number
          ship_date?: string | null
          status?: string
          store_name?: string | null
          tracking_number?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
