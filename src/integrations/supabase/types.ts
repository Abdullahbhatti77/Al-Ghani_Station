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
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          entity: string
          entity_id: string | null
          id: string
          reason: string | null
          station_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity: string
          entity_id?: string | null
          id?: string
          reason?: string | null
          station_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity?: string
          entity_id?: string | null
          id?: string
          reason?: string | null
          station_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_transactions: {
        Row: {
          amount: number
          approval_reason: string | null
          approved_by: string | null
          client_key: string
          created_at: string
          created_by: string
          customer_id: string
          id: string
          kind: string
          litres: number | null
          method: string | null
          notes: string | null
          occurred_at: string
          over_limit: boolean
          price_id: string | null
          product_id: string | null
          rate: number | null
          reference: string | null
          reversal_reason: string | null
          reversed_at: string | null
          reversed_by: string | null
          shift_id: string | null
          station_id: string
          vehicle: string | null
        }
        Insert: {
          amount: number
          approval_reason?: string | null
          approved_by?: string | null
          client_key: string
          created_at?: string
          created_by: string
          customer_id: string
          id?: string
          kind: string
          litres?: number | null
          method?: string | null
          notes?: string | null
          occurred_at?: string
          over_limit?: boolean
          price_id?: string | null
          product_id?: string | null
          rate?: number | null
          reference?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          shift_id?: string | null
          station_id: string
          vehicle?: string | null
        }
        Update: {
          amount?: number
          approval_reason?: string | null
          approved_by?: string | null
          client_key?: string
          created_at?: string
          created_by?: string
          customer_id?: string
          id?: string
          kind?: string
          litres?: number | null
          method?: string | null
          notes?: string | null
          occurred_at?: string
          over_limit?: boolean
          price_id?: string | null
          product_id?: string | null
          rate?: number | null
          reference?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          shift_id?: string | null
          station_id?: string
          vehicle?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_transactions_price_id_fkey"
            columns: ["price_id"]
            isOneToOne: false
            referencedRelation: "fuel_prices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_transactions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_transactions_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_transactions_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          business_name: string | null
          created_at: string
          created_by: string
          credit_limit: number | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          opening_balance: number
          phone: string | null
          station_id: string
          updated_at: string
          vehicles: string[]
        }
        Insert: {
          address?: string | null
          business_name?: string | null
          created_at?: string
          created_by?: string
          credit_limit?: number | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          opening_balance?: number
          phone?: string | null
          station_id: string
          updated_at?: string
          vehicles?: string[]
        }
        Update: {
          address?: string | null
          business_name?: string | null
          created_at?: string
          created_by?: string
          credit_limit?: number | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          opening_balance?: number
          phone?: string | null
          station_id?: string
          updated_at?: string
          vehicles?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "customers_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          station_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          station_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          station_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category_id: string
          client_key: string
          created_at: string
          created_by: string
          description: string
          id: string
          method: string
          occurred_at: string
          reference: string | null
          reversal_reason: string | null
          reversed_at: string | null
          reversed_by: string | null
          shift_id: string | null
          station_id: string
        }
        Insert: {
          amount: number
          category_id: string
          client_key: string
          created_at?: string
          created_by: string
          description: string
          id?: string
          method: string
          occurred_at: string
          reference?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          shift_id?: string | null
          station_id: string
        }
        Update: {
          amount?: number
          category_id?: string
          client_key?: string
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          method?: string
          occurred_at?: string
          reference?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          shift_id?: string | null
          station_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_deliveries: {
        Row: {
          calculated_amount: number
          challan_no: string
          created_at: string
          delivered_at: string
          id: string
          invoice_amount: number
          litres: number
          notes: string | null
          product_id: string
          rate_per_litre: number
          received_by: string
          reversal_reason: string | null
          reversed_at: string | null
          reversed_by: string | null
          station_id: string
          supplier_id: string
          tank_id: string
        }
        Insert: {
          calculated_amount: number
          challan_no: string
          created_at?: string
          delivered_at: string
          id?: string
          invoice_amount: number
          litres: number
          notes?: string | null
          product_id: string
          rate_per_litre: number
          received_by: string
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          station_id: string
          supplier_id: string
          tank_id: string
        }
        Update: {
          calculated_amount?: number
          challan_no?: string
          created_at?: string
          delivered_at?: string
          id?: string
          invoice_amount?: number
          litres?: number
          notes?: string | null
          product_id?: string
          rate_per_litre?: number
          received_by?: string
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          station_id?: string
          supplier_id?: string
          tank_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fuel_deliveries_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_deliveries_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_deliveries_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_deliveries_tank_id_fkey"
            columns: ["tank_id"]
            isOneToOne: false
            referencedRelation: "tanks"
            referencedColumns: ["id"]
          },
        ]
      }
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
      shift_cash_movements: {
        Row: {
          amount: number
          client_key: string
          created_at: string
          created_by: string
          id: string
          kind: string
          reason: string
          reversed_at: string | null
          reversed_by: string | null
          shift_id: string
          station_id: string
        }
        Insert: {
          amount: number
          client_key: string
          created_at?: string
          created_by: string
          id?: string
          kind: string
          reason: string
          reversed_at?: string | null
          reversed_by?: string | null
          shift_id: string
          station_id: string
        }
        Update: {
          amount?: number
          client_key?: string
          created_at?: string
          created_by?: string
          id?: string
          kind?: string
          reason?: string
          reversed_at?: string | null
          reversed_by?: string | null
          shift_id?: string
          station_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_cash_movements_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_cash_movements_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_corrections: {
        Row: {
          created_at: string
          created_by: string
          field: string
          id: string
          new_value: number | null
          old_value: number | null
          reading_id: string | null
          reason: string
          shift_id: string
          station_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          field: string
          id?: string
          new_value?: number | null
          old_value?: number | null
          reading_id?: string | null
          reason: string
          shift_id: string
          station_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          field?: string
          id?: string
          new_value?: number | null
          old_value?: number | null
          reading_id?: string | null
          reason?: string
          shift_id?: string
          station_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_corrections_shift_id_station_id_fkey"
            columns: ["shift_id", "station_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id", "station_id"]
          },
        ]
      }
      shift_readings: {
        Row: {
          amount: number | null
          closing_reading: number | null
          created_at: string
          id: string
          is_draft: boolean
          litres_sold: number | null
          nozzle_id: string
          opening_reading: number
          opening_source: string
          price_id: string | null
          price_per_litre: number | null
          product_id: string
          rollover_max: number | null
          shift_id: string
          station_id: string
          test_litres: number
          updated_at: string
        }
        Insert: {
          amount?: number | null
          closing_reading?: number | null
          created_at?: string
          id?: string
          is_draft?: boolean
          litres_sold?: number | null
          nozzle_id: string
          opening_reading: number
          opening_source: string
          price_id?: string | null
          price_per_litre?: number | null
          product_id: string
          rollover_max?: number | null
          shift_id: string
          station_id: string
          test_litres?: number
          updated_at?: string
        }
        Update: {
          amount?: number | null
          closing_reading?: number | null
          created_at?: string
          id?: string
          is_draft?: boolean
          litres_sold?: number | null
          nozzle_id?: string
          opening_reading?: number
          opening_source?: string
          price_id?: string | null
          price_per_litre?: number | null
          product_id?: string
          rollover_max?: number | null
          shift_id?: string
          station_id?: string
          test_litres?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_readings_nozzle_id_fkey"
            columns: ["nozzle_id"]
            isOneToOne: false
            referencedRelation: "nozzles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_readings_price_id_fkey"
            columns: ["price_id"]
            isOneToOne: false
            referencedRelation: "fuel_prices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_readings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_readings_shift_id_station_id_fkey"
            columns: ["shift_id", "station_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id", "station_id"]
          },
        ]
      }
      shifts: {
        Row: {
          attendant_id: string
          bank_received: number
          card_received: number
          cash_counted: number | null
          cash_in: number
          cash_out: number
          cash_received: number
          cash_repayments: number
          cash_variance: number | null
          closed_at: string | null
          closed_by: string | null
          created_at: string
          created_by: string
          credit_sales: number
          difference: number | null
          drawer_expected: number | null
          drawer_expenses: number
          id: string
          name: string
          notes: string | null
          opening_float: number
          other_received: number
          price_at: string
          shift_date: string
          station_id: string
          status: string
          total_collected: number | null
          total_litres: number | null
          total_sales: number | null
          updated_at: string
          variance_approved_by: string | null
          variance_reason: string | null
          wallet_received: number
        }
        Insert: {
          attendant_id: string
          bank_received?: number
          card_received?: number
          cash_counted?: number | null
          cash_in?: number
          cash_out?: number
          cash_received?: number
          cash_repayments?: number
          cash_variance?: number | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string
          credit_sales?: number
          difference?: number | null
          drawer_expected?: number | null
          drawer_expenses?: number
          id?: string
          name: string
          notes?: string | null
          opening_float?: number
          other_received?: number
          price_at: string
          shift_date: string
          station_id: string
          status?: string
          total_collected?: number | null
          total_litres?: number | null
          total_sales?: number | null
          updated_at?: string
          variance_approved_by?: string | null
          variance_reason?: string | null
          wallet_received?: number
        }
        Update: {
          attendant_id?: string
          bank_received?: number
          card_received?: number
          cash_counted?: number | null
          cash_in?: number
          cash_out?: number
          cash_received?: number
          cash_repayments?: number
          cash_variance?: number | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string
          credit_sales?: number
          difference?: number | null
          drawer_expected?: number | null
          drawer_expenses?: number
          id?: string
          name?: string
          notes?: string | null
          opening_float?: number
          other_received?: number
          price_at?: string
          shift_date?: string
          station_id?: string
          status?: string
          total_collected?: number | null
          total_litres?: number | null
          total_sales?: number | null
          updated_at?: string
          variance_approved_by?: string | null
          variance_reason?: string | null
          wallet_received?: number
        }
        Relationships: [
          {
            foreignKeyName: "shifts_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
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
          dip_variance_litres: number | null
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
          dip_variance_litres?: number | null
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
          dip_variance_litres?: number | null
          id?: string
          name?: string
          preferred_language?: string
          updated_at?: string
        }
        Relationships: []
      }
      stock_adjustments: {
        Row: {
          dip_id: string | null
          id: string
          litres: number
          reason: string
          requested_at: string
          requested_by: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          station_id: string
          status: string
          tank_id: string
        }
        Insert: {
          dip_id?: string | null
          id?: string
          litres: number
          reason: string
          requested_at?: string
          requested_by: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          station_id: string
          status?: string
          tank_id: string
        }
        Update: {
          dip_id?: string | null
          id?: string
          litres?: number
          reason?: string
          requested_at?: string
          requested_by?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          station_id?: string
          status?: string
          tank_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_adjustments_dip_id_fkey"
            columns: ["dip_id"]
            isOneToOne: false
            referencedRelation: "tank_dips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustments_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustments_tank_id_fkey"
            columns: ["tank_id"]
            isOneToOne: false
            referencedRelation: "tanks"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          kind: string
          litres: number
          note: string | null
          occurred_at: string
          shift_id: string | null
          source_id: string
          station_id: string
          tank_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          litres: number
          note?: string | null
          occurred_at: string
          shift_id?: string | null
          source_id: string
          station_id: string
          tank_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          litres?: number
          note?: string | null
          occurred_at?: string
          shift_id?: string | null
          source_id?: string
          station_id?: string
          tank_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_tank_id_fkey"
            columns: ["tank_id"]
            isOneToOne: false
            referencedRelation: "tanks"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_payments: {
        Row: {
          amount: number
          client_key: string
          created_at: string
          created_by: string
          id: string
          method: string
          notes: string | null
          paid_at: string
          reference: string | null
          reversal_reason: string | null
          reversed_at: string | null
          reversed_by: string | null
          station_id: string
          supplier_id: string
        }
        Insert: {
          amount: number
          client_key: string
          created_at?: string
          created_by: string
          id?: string
          method: string
          notes?: string | null
          paid_at: string
          reference?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          station_id: string
          supplier_id: string
        }
        Update: {
          amount?: number
          client_key?: string
          created_at?: string
          created_by?: string
          id?: string
          method?: string
          notes?: string | null
          paid_at?: string
          reference?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          station_id?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
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
      tank_dips: {
        Row: {
          created_at: string
          created_by: string
          id: string
          measured_at: string
          measured_litres: number
          notes: string | null
          station_id: string
          tank_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          measured_at: string
          measured_litres: number
          notes?: string | null
          station_id: string
          tank_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          measured_at?: string
          measured_litres?: number
          notes?: string | null
          station_id?: string
          tank_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tank_dips_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tank_dips_tank_id_fkey"
            columns: ["tank_id"]
            isOneToOne: false
            referencedRelation: "tanks"
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
      _audit: {
        Args: {
          _action: string
          _details: Json
          _entity: string
          _entity_id: string
          _reason: string
          _station: string
        }
        Returns: undefined
      }
      _open_shift: {
        Args: { _shift_id: string; _station_id: string }
        Returns: undefined
      }
      _price_shift_reading: {
        Args: { _reading_id: string }
        Returns: undefined
      }
      _total_shift: { Args: { _shift_id: string }; Returns: undefined }
      add_station_member: {
        Args: {
          _email: string
          _role: Database["public"]["Enums"]["station_role"]
          _station_id: string
        }
        Returns: string
      }
      close_shift: {
        Args: { _reason?: string; _shift_id: string }
        Returns: undefined
      }
      correct_closed_collections: {
        Args: { _reason: string; _shift_id: string; _values: Json }
        Returns: undefined
      }
      correct_closed_reading: {
        Args: {
          _closing: number
          _reading_id: string
          _reason: string
          _test: number
        }
        Returns: undefined
      }
      correct_shift_opening: {
        Args: { _reading_id: string; _reason: string; _value: number }
        Returns: undefined
      }
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
      customer_balance: { Args: { _customer_id: string }; Returns: number }
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
      pay_supplier: {
        Args: {
          _amount: number
          _client_key: string
          _method: string
          _notes: string
          _paid_at: string
          _reference: string
          _supplier_id: string
        }
        Returns: string
      }
      receive_customer_payment: {
        Args: {
          _amount: number
          _client_key: string
          _customer_id: string
          _method: string
          _notes: string
          _occurred_at: string
          _reference: string
          _shift_id: string
        }
        Returns: string
      }
      record_credit_sale: {
        Args: {
          _amount: number
          _approval_reason: string
          _client_key: string
          _customer_id: string
          _litres: number
          _notes: string
          _product_id: string
          _reference: string
          _shift_id: string
          _vehicle: string
        }
        Returns: string
      }
      record_delivery: {
        Args: {
          _challan: string
          _delivered_at: string
          _invoice: number
          _litres: number
          _notes: string
          _rate: number
          _station_id: string
          _supplier_id: string
          _tank_id: string
        }
        Returns: string
      }
      record_expense: {
        Args: {
          _amount: number
          _category_id: string
          _client_key: string
          _description: string
          _method: string
          _occurred_at: string
          _reference: string
          _shift_id: string
          _station_id: string
        }
        Returns: string
      }
      record_shift_cash_movement: {
        Args: {
          _amount: number
          _client_key: string
          _kind: string
          _reason: string
          _shift_id: string
        }
        Returns: string
      }
      record_tank_dip: {
        Args: {
          _litres: number
          _measured_at: string
          _notes: string
          _tank_id: string
        }
        Returns: string
      }
      remove_station_member: {
        Args: { _member_id: string }
        Returns: undefined
      }
      request_stock_adjustment: {
        Args: {
          _dip_id: string
          _litres: number
          _reason: string
          _tank_id: string
        }
        Returns: string
      }
      reverse_customer_txn: {
        Args: { _reason: string; _txn_id: string }
        Returns: undefined
      }
      reverse_delivery: {
        Args: { _delivery_id: string; _reason: string }
        Returns: undefined
      }
      reverse_expense: {
        Args: { _expense_id: string; _reason: string }
        Returns: undefined
      }
      reverse_shift_cash_movement: { Args: { _id: string }; Returns: undefined }
      reverse_supplier_payment: {
        Args: { _payment_id: string; _reason: string }
        Returns: undefined
      }
      review_stock_adjustment: {
        Args: { _adjustment_id: string; _approve: boolean; _note: string }
        Returns: undefined
      }
      save_shift_draft: {
        Args: { _header: Json; _readings: Json; _shift_id: string }
        Returns: undefined
      }
      set_member_role: {
        Args: {
          _member_id: string
          _role: Database["public"]["Enums"]["station_role"]
        }
        Returns: undefined
      }
      set_shift_rollover: {
        Args: { _reading_id: string; _reason: string; _rollover: number }
        Returns: undefined
      }
      shift_litres: {
        Args: {
          _closing: number
          _opening: number
          _rollover: number
          _test: number
        }
        Returns: number
      }
      start_shift: {
        Args: {
          _attendant: string
          _date: string
          _float: number
          _name: string
          _station_id: string
        }
        Returns: string
      }
      station_people: {
        Args: { _station_id: string }
        Returns: {
          full_name: string
          role: Database["public"]["Enums"]["station_role"]
          user_id: string
        }[]
      }
      station_role_of: {
        Args: { _station_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["station_role"]
      }
      station_staff: {
        Args: { _station_id: string }
        Returns: {
          created_at: string
          email: string
          full_name: string
          member_id: string
          role: Database["public"]["Enums"]["station_role"]
          user_id: string
        }[]
      }
      supplier_balance: { Args: { _supplier_id: string }; Returns: number }
      tank_expected: {
        Args: { _at?: string; _tank_id: string }
        Returns: number
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
