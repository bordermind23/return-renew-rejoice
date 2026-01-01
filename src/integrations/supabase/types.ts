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
      case_notes: {
        Row: {
          case_id: string
          content: string
          created_at: string
          created_by: string
          id: string
          note_type: string | null
        }
        Insert: {
          case_id: string
          content: string
          created_at?: string
          created_by: string
          id?: string
          note_type?: string | null
        }
        Update: {
          case_id?: string
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          note_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      case_types: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          label: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          label: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          label?: string
        }
        Relationships: []
      }
      cases: {
        Row: {
          actual_sku: string | null
          amazon_case_id: string | null
          amazon_case_url: string | null
          approved_amount: number | null
          case_number: string
          case_type: Database["public"]["Enums"]["case_type"]
          claim_amount: number | null
          created_at: string
          created_by: string
          currency: string | null
          damage_description: string | null
          description: string | null
          expected_sku: string | null
          id: string
          lpn: string | null
          missing_items: string[] | null
          order_id: string | null
          removal_order_id: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["case_status"]
          submitted_at: string | null
          title: string
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          actual_sku?: string | null
          amazon_case_id?: string | null
          amazon_case_url?: string | null
          approved_amount?: number | null
          case_number: string
          case_type: Database["public"]["Enums"]["case_type"]
          claim_amount?: number | null
          created_at?: string
          created_by: string
          currency?: string | null
          damage_description?: string | null
          description?: string | null
          expected_sku?: string | null
          id?: string
          lpn?: string | null
          missing_items?: string[] | null
          order_id?: string | null
          removal_order_id?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["case_status"]
          submitted_at?: string | null
          title: string
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          actual_sku?: string | null
          amazon_case_id?: string | null
          amazon_case_url?: string | null
          approved_amount?: number | null
          case_number?: string
          case_type?: Database["public"]["Enums"]["case_type"]
          claim_amount?: number | null
          created_at?: string
          created_by?: string
          currency?: string | null
          damage_description?: string | null
          description?: string | null
          expected_sku?: string | null
          id?: string
          lpn?: string | null
          missing_items?: string[] | null
          order_id?: string | null
          removal_order_id?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["case_status"]
          submitted_at?: string | null
          title?: string
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cases_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      deleted_refurbishment_records: {
        Row: {
          created_at: string
          deleted_at: string
          deleted_by: string | null
          grade: string
          id: string
          is_restored: boolean
          lpn: string
          original_inbound_id: string | null
          product_name: string
          product_sku: string
          refurbished_at: string | null
          refurbished_by: string | null
          refurbishment_grade: string | null
          refurbishment_notes: string | null
          refurbishment_photos: string[] | null
          refurbishment_videos: string[] | null
          removal_order_id: string
          restored_at: string | null
          restored_by: string | null
          return_reason: string | null
          tracking_number: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string
          deleted_by?: string | null
          grade?: string
          id?: string
          is_restored?: boolean
          lpn: string
          original_inbound_id?: string | null
          product_name: string
          product_sku: string
          refurbished_at?: string | null
          refurbished_by?: string | null
          refurbishment_grade?: string | null
          refurbishment_notes?: string | null
          refurbishment_photos?: string[] | null
          refurbishment_videos?: string[] | null
          removal_order_id: string
          restored_at?: string | null
          restored_by?: string | null
          return_reason?: string | null
          tracking_number?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string
          deleted_by?: string | null
          grade?: string
          id?: string
          is_restored?: boolean
          lpn?: string
          original_inbound_id?: string | null
          product_name?: string
          product_sku?: string
          refurbished_at?: string | null
          refurbished_by?: string | null
          refurbishment_grade?: string | null
          refurbishment_notes?: string | null
          refurbishment_photos?: string[] | null
          refurbishment_videos?: string[] | null
          removal_order_id?: string
          restored_at?: string | null
          restored_by?: string | null
          return_reason?: string | null
          tracking_number?: string | null
        }
        Relationships: []
      }
      inbound_items: {
        Row: {
          accessories_photo: string | null
          created_at: string
          detail_photo: string | null
          grade: string
          id: string
          lpn: string
          lpn_label_photo: string | null
          missing_parts: string[] | null
          package_photo: string | null
          packaging_photo_1: string | null
          packaging_photo_2: string | null
          packaging_photo_3: string | null
          packaging_photo_4: string | null
          packaging_photo_5: string | null
          packaging_photo_6: string | null
          processed_at: string
          processed_by: string
          product_name: string
          product_photo: string | null
          product_sku: string
          refurbished_at: string | null
          refurbished_by: string | null
          refurbishment_grade: string | null
          refurbishment_notes: string | null
          refurbishment_photos: string[] | null
          refurbishment_videos: string[] | null
          removal_order_id: string
          return_reason: string | null
          shipment_id: string | null
          tracking_number: string | null
        }
        Insert: {
          accessories_photo?: string | null
          created_at?: string
          detail_photo?: string | null
          grade?: string
          id?: string
          lpn: string
          lpn_label_photo?: string | null
          missing_parts?: string[] | null
          package_photo?: string | null
          packaging_photo_1?: string | null
          packaging_photo_2?: string | null
          packaging_photo_3?: string | null
          packaging_photo_4?: string | null
          packaging_photo_5?: string | null
          packaging_photo_6?: string | null
          processed_at?: string
          processed_by: string
          product_name: string
          product_photo?: string | null
          product_sku: string
          refurbished_at?: string | null
          refurbished_by?: string | null
          refurbishment_grade?: string | null
          refurbishment_notes?: string | null
          refurbishment_photos?: string[] | null
          refurbishment_videos?: string[] | null
          removal_order_id: string
          return_reason?: string | null
          shipment_id?: string | null
          tracking_number?: string | null
        }
        Update: {
          accessories_photo?: string | null
          created_at?: string
          detail_photo?: string | null
          grade?: string
          id?: string
          lpn?: string
          lpn_label_photo?: string | null
          missing_parts?: string[] | null
          package_photo?: string | null
          packaging_photo_1?: string | null
          packaging_photo_2?: string | null
          packaging_photo_3?: string | null
          packaging_photo_4?: string | null
          packaging_photo_5?: string | null
          packaging_photo_6?: string | null
          processed_at?: string
          processed_by?: string
          product_name?: string
          product_photo?: string | null
          product_sku?: string
          refurbished_at?: string | null
          refurbished_by?: string | null
          refurbishment_grade?: string | null
          refurbishment_notes?: string | null
          refurbishment_photos?: string[] | null
          refurbishment_videos?: string[] | null
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
          asin: string | null
          buyer_note: string | null
          country: string | null
          created_at: string
          fnsku: string | null
          grade: string | null
          id: string
          inbound_at: string | null
          internal_order_no: string | null
          inventory_attribute: string | null
          lpn: string
          msku: string | null
          order_number: string
          order_time: string | null
          product_name: string | null
          product_sku: string | null
          removal_order_id: string
          removed_at: string | null
          return_quantity: number | null
          return_reason: string | null
          return_time: string | null
          station: string
          status: Database["public"]["Enums"]["order_status"]
          store_name: string
          warehouse_location: string | null
        }
        Insert: {
          asin?: string | null
          buyer_note?: string | null
          country?: string | null
          created_at?: string
          fnsku?: string | null
          grade?: string | null
          id?: string
          inbound_at?: string | null
          internal_order_no?: string | null
          inventory_attribute?: string | null
          lpn: string
          msku?: string | null
          order_number: string
          order_time?: string | null
          product_name?: string | null
          product_sku?: string | null
          removal_order_id: string
          removed_at?: string | null
          return_quantity?: number | null
          return_reason?: string | null
          return_time?: string | null
          station: string
          status?: Database["public"]["Enums"]["order_status"]
          store_name: string
          warehouse_location?: string | null
        }
        Update: {
          asin?: string | null
          buyer_note?: string | null
          country?: string | null
          created_at?: string
          fnsku?: string | null
          grade?: string | null
          id?: string
          inbound_at?: string | null
          internal_order_no?: string | null
          inventory_attribute?: string | null
          lpn?: string
          msku?: string | null
          order_number?: string
          order_time?: string | null
          product_name?: string | null
          product_sku?: string | null
          removal_order_id?: string
          removed_at?: string | null
          return_quantity?: number | null
          return_reason?: string | null
          return_time?: string | null
          station?: string
          status?: Database["public"]["Enums"]["order_status"]
          store_name?: string
          warehouse_location?: string | null
        }
        Relationships: []
      }
      product_categories: {
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
      product_parts: {
        Row: {
          created_at: string
          id: string
          image: string | null
          name: string
          product_id: string
          quantity: number
        }
        Insert: {
          created_at?: string
          id?: string
          image?: string | null
          name: string
          product_id: string
          quantity?: number
        }
        Update: {
          created_at?: string
          id?: string
          image?: string | null
          name?: string
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_parts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          created_at: string
          id: string
          image: string | null
          name: string
          sku: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          image?: string | null
          name: string
          sku: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          image?: string | null
          name?: string
          sku?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      removal_shipments: {
        Row: {
          carrier: string
          country: string | null
          created_at: string
          duplicate_confirmed: boolean
          fnsku: string
          id: string
          msku: string | null
          note: string | null
          order_id: string
          product_image: string | null
          product_name: string | null
          product_sku: string | null
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
          duplicate_confirmed?: boolean
          fnsku: string
          id?: string
          msku?: string | null
          note?: string | null
          order_id: string
          product_image?: string | null
          product_name?: string | null
          product_sku?: string | null
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
          duplicate_confirmed?: boolean
          fnsku?: string
          id?: string
          msku?: string | null
          note?: string | null
          order_id?: string
          product_image?: string | null
          product_name?: string | null
          product_sku?: string | null
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
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_authenticated: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "warehouse_staff" | "viewer"
      case_status:
        | "pending"
        | "submitted"
        | "in_progress"
        | "approved"
        | "rejected"
        | "closed"
      case_type:
        | "lpn_missing"
        | "sku_mismatch"
        | "accessory_missing"
        | "product_damaged"
        | "other"
      order_status: "未到货" | "到货" | "出库"
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
    Enums: {
      app_role: ["admin", "warehouse_staff", "viewer"],
      case_status: [
        "pending",
        "submitted",
        "in_progress",
        "approved",
        "rejected",
        "closed",
      ],
      case_type: [
        "lpn_missing",
        "sku_mismatch",
        "accessory_missing",
        "product_damaged",
        "other",
      ],
      order_status: ["未到货", "到货", "出库"],
    },
  },
} as const
