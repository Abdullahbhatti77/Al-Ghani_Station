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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      fuel_prices: {
        Row: {
          created_at: string
          created_by: string
          effective_at: string
          id: string
          note: string | null
          price_per_litre: number
          product_id: string
          station_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          effective_at: string
          id?: string
          note?: string | null
          price_per_litre: number
          product_id: string
          station_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          effective_at?: string
          id?: string
          note?: string | null
          price_per_litre?: number
          product_id?: string
          station_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fuel_prices_product_id_station_id_fkey"
            columns: ["product_id", "station_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "station_id"]
          },
          {
            foreignKeyName: "fuel_prices_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      nozzles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          meter_reading: number
          number: number
          product_id: string
          station_id: string
          tank_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
          meter_reading?: number
          number: number
          product_id: string
          station_id: string
          tank_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          meter_reading?: number
          number?: number
          product_id?: string
          station_id?: string
          tank_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nozzles_product_id_station_id_fkey"
            columns: ["product_id", "station_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "station_id"]
          },
          {
            foreignKeyName: "nozzles_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nozzles_tank_id_station_id_fkey"
            columns: ["tank_id", "station_id"]
            isOneToOne: false
            referencedRelation: "tanks"
            referencedColumns: ["id", "station_id"]
          },
        ]
      }
      products: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          is_fuel: boolean
          name: string
          station_id: string
          unit: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_fuel?: boolean
          name: string
          station_id: string
          unit?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_fuel?: boolean
          name?: string
          station_id?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          preferred_language: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          preferred_language?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          preferred_language?: string
          updated_at?: string
        }
        Relationships: []
      }
      station_members: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["station_role"]
          station_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["station_role"]
          station_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["station_role"]
          station_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "station_members_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      stations: {
        Row: {
          city: string
          contact_phone: string
          created_at: string
          created_by: string
          id: string
          name: string
          preferred_language: string
          updated_at: string
        }
        Insert: {
          city: string
          contact_phone: string
          created_at?: string
          created_by: string
          id?: string
          name: string
          preferred_language?: string
          updated_at?: string
        }
        Update: {
          city?: string
          contact_phone?: string
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          preferred_language?: string
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          business_name: string
          contact_person: string | null
          created_at: string
          id: string
          is_active: boolean
          notes: string | null
          opening_payable: number
          phone: string | null
          station_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          business_name: string
          contact_person?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          opening_payable?: number
          phone?: string | null
          station_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          business_name?: string
          contact_person?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          opening_payable?: number
          phone?: string | null
          station_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      tank_stock_corrections: {
        Row: {
          created_at: string
          created_by: string
          id: string
          new_litres: number
          old_litres: number
          reason: string
          station_id: string
          tank_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          new_litres: number
          old_litres: number
          reason: string
          station_id: string
          tank_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          new_litres?: number
          old_litres?: number
          reason?: string
          station_id?: string
          tank_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tank_stock_corrections_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tank_stock_corrections_tank_id_station_id_fkey"
            columns: ["tank_id", "station_id"]
            isOneToOne: false
            referencedRelation: "tanks"
            referencedColumns: ["id", "station_id"]
          },
        ]
      }
      tanks: {
        Row: {
          capacity_litres: number
          created_at: string
          id: string
          is_active: boolean
          low_stock_litres: number
          name: string
          opening_stock_litres: number
          product_id: string
          station_id: string
          updated_at: string
        }
        Insert: {
          capacity_litres: number
          created_at?: string
          id?: string
          is_active?: boolean
          low_stock_litres?: number
          name: string
          opening_stock_litres?: number
          product_id: string
          station_id: string
          updated_at?: string
        }
        Update: {
          capacity_litres?: number
          created_at?: string
          id?: string
          is_active?: boolean
          low_stock_litres?: number
          name?: string
          opening_stock_litres?: number
          product_id?: string
          station_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tanks_product_id_station_id_fkey"
            columns: ["product_id", "station_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "station_id"]
          },
          {
            foreignKeyName: "tanks_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      correct_tank_stock: {
        Args: { _new_litres: number; _reason: string; _tank_id: string }
        Returns: undefined
      }
      create_station_with_owner: {
        Args: {
          _city: string
          _language: string
          _name: string
          _phone: string
        }
        Returns: string
      }
      has_station_role: {
        Args: {
          _roles: Database["public"]["Enums"]["station_role"][]
          _station_id: string
          _user_id: string
        }
        Returns: boolean
      }
      is_station_member: {
        Args: { _station_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      station_role: "owner" | "manager" | "staff"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      station_role: ["owner", "manager", "staff"],
    },
  },
} as const
