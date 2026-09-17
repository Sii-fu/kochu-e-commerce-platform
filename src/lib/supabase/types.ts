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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          city: string
          created_at: string
          district: string | null
          id: string
          is_default: boolean
          label: string | null
          line1: string
          line2: string | null
          phone: string
          postal_code: string | null
          recipient: string
          user_id: string
        }
        Insert: {
          city: string
          created_at?: string
          district?: string | null
          id?: string
          is_default?: boolean
          label?: string | null
          line1: string
          line2?: string | null
          phone: string
          postal_code?: string | null
          recipient: string
          user_id: string
        }
        Update: {
          city?: string
          created_at?: string
          district?: string | null
          id?: string
          is_default?: boolean
          label?: string | null
          line1?: string
          line2?: string | null
          phone?: string
          postal_code?: string | null
          recipient?: string
          user_id?: string
        }
        Relationships: []
      }
      articles: {
        Row: {
          abstract: string
          author_id: string | null
          collection_id: string | null
          content: string
          created_at: string
          featured_image: string | null
          id: string
          is_published: boolean
          published_at: string | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          abstract: string
          author_id?: string | null
          collection_id?: string | null
          content: string
          created_at?: string
          featured_image?: string | null
          id?: string
          is_published?: boolean
          published_at?: string | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          abstract?: string
          author_id?: string | null
          collection_id?: string | null
          content?: string
          created_at?: string
          featured_image?: string | null
          id?: string
          is_published?: boolean
          published_at?: string | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "articles_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          cover_image: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          season: string | null
          slug: string
          sort_order: number
          title: string
        }
        Insert: {
          cover_image?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          season?: string | null
          slug: string
          sort_order?: number
          title: string
        }
        Update: {
          cover_image?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          season?: string | null
          slug?: string
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      discount_codes: {
        Row: {
          code: string
          created_at: string
          description: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          min_order_minor: number
          starts_at: string | null
          type: Database["public"]["Enums"]["discount_type"]
          used_count: number
          value: number
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_order_minor?: number
          starts_at?: string | null
          type: Database["public"]["Enums"]["discount_type"]
          used_count?: number
          value: number
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_order_minor?: number
          starts_at?: string | null
          type?: Database["public"]["Enums"]["discount_type"]
          used_count?: number
          value?: number
        }
        Relationships: []
      }
      drop_access: {
        Row: {
          drop_id: string
          granted_at: string
          user_id: string
        }
        Insert: {
          drop_id: string
          granted_at?: string
          user_id: string
        }
        Update: {
          drop_id?: string
          granted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drop_access_drop_id_fkey"
            columns: ["drop_id"]
            isOneToOne: false
            referencedRelation: "drops"
            referencedColumns: ["id"]
          },
        ]
      }
      drops: {
        Row: {
          access_key: string | null
          cover_image: string | null
          created_at: string
          description: string | null
          early_access_at: string | null
          ends_at: string | null
          id: string
          is_published: boolean
          slug: string
          starts_at: string
          title: string
        }
        Insert: {
          access_key?: string | null
          cover_image?: string | null
          created_at?: string
          description?: string | null
          early_access_at?: string | null
          ends_at?: string | null
          id?: string
          is_published?: boolean
          slug: string
          starts_at: string
          title: string
        }
        Update: {
          access_key?: string | null
          cover_image?: string | null
          created_at?: string
          description?: string | null
          early_access_at?: string | null
          ends_at?: string | null
          id?: string
          is_published?: boolean
          slug?: string
          starts_at?: string
          title?: string
        }
        Relationships: []
      }
      early_access: {
        Row: {
          created_at: string
          drop_id: string | null
          email: string
          id: string
          source: string | null
        }
        Insert: {
          created_at?: string
          drop_id?: string | null
          email: string
          id?: string
          source?: string | null
        }
        Update: {
          created_at?: string
          drop_id?: string | null
          email?: string
          id?: string
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "early_access_drop_id_fkey"
            columns: ["drop_id"]
            isOneToOne: false
            referencedRelation: "drops"
            referencedColumns: ["id"]
          },
        ]
      }
      mfs_transactions: {
        Row: {
          amount_minor: number
          created_at: string
          id: string
          order_id: string
          provider: Database["public"]["Enums"]["payment_method"]
          receipt_path: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          sender_msisdn: string
          status: Database["public"]["Enums"]["mfs_status"]
          trx_id: string
        }
        Insert: {
          amount_minor: number
          created_at?: string
          id?: string
          order_id: string
          provider: Database["public"]["Enums"]["payment_method"]
          receipt_path?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          sender_msisdn: string
          status?: Database["public"]["Enums"]["mfs_status"]
          trx_id: string
        }
        Update: {
          amount_minor?: number
          created_at?: string
          id?: string
          order_id?: string
          provider?: Database["public"]["Enums"]["payment_method"]
          receipt_path?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          sender_msisdn?: string
          status?: Database["public"]["Enums"]["mfs_status"]
          trx_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mfs_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          image_path: string | null
          line_total_minor: number
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          unit_price_minor: number
          variant_id: string | null
          variant_label: string
        }
        Insert: {
          id?: string
          image_path?: string | null
          line_total_minor: number
          order_id: string
          product_id?: string | null
          product_name: string
          quantity: number
          unit_price_minor: number
          variant_id?: string | null
          variant_label: string
        }
        Update: {
          id?: string
          image_path?: string | null
          line_total_minor?: number
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          unit_price_minor?: number
          variant_id?: string | null
          variant_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          admin_note: string | null
          cancelled_at: string | null
          courier: string | null
          customer_name: string
          delivered_at: string | null
          discount_code: string | null
          discount_minor: number
          guest_email: string | null
          guest_token: string
          id: string
          idempotency_key: string
          order_number: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status: Database["public"]["Enums"]["payment_status"]
          phone: string
          placed_at: string
          processing_at: string | null
          shipped_at: string | null
          shipping_address: Json
          shipping_minor: number
          status: Database["public"]["Enums"]["order_status"]
          stock_released: boolean
          subtotal_minor: number
          total_minor: number
          tracking_code: string | null
          user_id: string | null
        }
        Insert: {
          admin_note?: string | null
          cancelled_at?: string | null
          courier?: string | null
          customer_name: string
          delivered_at?: string | null
          discount_code?: string | null
          discount_minor?: number
          guest_email?: string | null
          guest_token?: string
          id?: string
          idempotency_key: string
          order_number?: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone: string
          placed_at?: string
          processing_at?: string | null
          shipped_at?: string | null
          shipping_address: Json
          shipping_minor?: number
          status?: Database["public"]["Enums"]["order_status"]
          stock_released?: boolean
          subtotal_minor: number
          total_minor: number
          tracking_code?: string | null
          user_id?: string | null
        }
        Update: {
          admin_note?: string | null
          cancelled_at?: string | null
          courier?: string | null
          customer_name?: string
          delivered_at?: string | null
          discount_code?: string | null
          discount_minor?: number
          guest_email?: string | null
          guest_token?: string
          id?: string
          idempotency_key?: string
          order_number?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone?: string
          placed_at?: string
          processing_at?: string | null
          shipped_at?: string | null
          shipping_address?: Json
          shipping_minor?: number
          status?: Database["public"]["Enums"]["order_status"]
          stock_released?: boolean
          subtotal_minor?: number
          total_minor?: number
          tracking_code?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      product_images: {
        Row: {
          alt: string | null
          id: string
          path: string
          product_id: string
          sort_order: number
        }
        Insert: {
          alt?: string | null
          id?: string
          path: string
          product_id: string
          sort_order?: number
        }
        Update: {
          alt?: string | null
          id?: string
          path?: string
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          id: string
          is_active: boolean
          label: string
          price_delta_minor: number
          product_id: string
          sku: string | null
          sort_order: number
          stock: number
        }
        Insert: {
          id?: string
          is_active?: boolean
          label: string
          price_delta_minor?: number
          product_id: string
          sku?: string | null
          sort_order?: number
          stock?: number
        }
        Update: {
          id?: string
          is_active?: boolean
          label?: string
          price_delta_minor?: number
          product_id?: string
          sku?: string | null
          sort_order?: number
          stock?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          collection_id: string | null
          compare_at_minor: number | null
          created_at: string
          description: string | null
          details: string | null
          drop_id: string | null
          id: string
          is_featured: boolean
          name: string
          price_minor: number
          search_tsv: unknown
          slug: string
          status: Database["public"]["Enums"]["product_status"]
          updated_at: string
        }
        Insert: {
          category: string
          collection_id?: string | null
          compare_at_minor?: number | null
          created_at?: string
          description?: string | null
          details?: string | null
          drop_id?: string | null
          id?: string
          is_featured?: boolean
          name: string
          price_minor: number
          search_tsv?: unknown
          slug: string
          status?: Database["public"]["Enums"]["product_status"]
          updated_at?: string
        }
        Update: {
          category?: string
          collection_id?: string | null
          compare_at_minor?: number | null
          created_at?: string
          description?: string | null
          details?: string | null
          drop_id?: string | null
          id?: string
          is_featured?: boolean
          name?: string
          price_minor?: number
          search_tsv?: unknown
          slug?: string
          status?: Database["public"]["Enums"]["product_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_drop_id_fkey"
            columns: ["drop_id"]
            isOneToOne: false
            referencedRelation: "drops"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      store_settings: {
        Row: {
          announcement: string | null
          bkash_number: string | null
          flat_shipping_minor: number
          free_shipping_threshold_minor: number
          id: boolean
          nagad_number: string | null
          support_email: string | null
          support_phone: string | null
          updated_at: string
        }
        Insert: {
          announcement?: string | null
          bkash_number?: string | null
          flat_shipping_minor?: number
          free_shipping_threshold_minor?: number
          id?: boolean
          nagad_number?: string | null
          support_email?: string | null
          support_phone?: string | null
          updated_at?: string
        }
        Update: {
          announcement?: string | null
          bkash_number?: string | null
          flat_shipping_minor?: number
          free_shipping_threshold_minor?: number
          id?: boolean
          nagad_number?: string | null
          support_email?: string | null
          support_phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_dashboard_stats: { Args: { p_days?: number }; Returns: Json }
      admin_update_order_status: {
        Args: {
          p_courier?: string
          p_next: Database["public"]["Enums"]["order_status"]
          p_note?: string
          p_order_id: string
          p_tracking_code?: string
        }
        Returns: Json
      }
      create_order: { Args: { payload: Json }; Returns: Json }
      drop_is_live: { Args: { p_drop: string }; Returns: boolean }
      get_order_by_token: {
        Args: { p_order_id: string; p_token: string }
        Returns: Json
      }
      grant_drop_access: {
        Args: { p_drop_id: string; p_emails: string[] }
        Returns: number
      }
      has_early_access: { Args: { p_drop: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      redeem_drop_key: {
        Args: { p_drop_id: string; p_key: string }
        Returns: Json
      }
      shipping_for: { Args: { p_subtotal_minor: number }; Returns: number }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      submit_mfs_transaction: {
        Args: {
          p_msisdn: string
          p_order_id: string
          p_provider: Database["public"]["Enums"]["payment_method"]
          p_receipt_path?: string
          p_token: string
          p_trx_id: string
        }
        Returns: Json
      }
      validate_discount: {
        Args: { p_code: string; p_subtotal_minor: number }
        Returns: Json
      }
      verify_mfs_transaction: {
        Args: { p_approve: boolean; p_note?: string; p_tx_id: string }
        Returns: Json
      }
    }
    Enums: {
      discount_type: "PERCENT" | "FIXED"
      mfs_status: "SUBMITTED" | "VERIFIED" | "REJECTED"
      order_status:
        | "PENDING_PAYMENT"
        | "PROCESSING"
        | "SHIPPED"
        | "DELIVERED"
        | "CANCELLED"
      payment_method: "COD" | "BKASH" | "NAGAD"
      payment_status:
        | "UNPAID"
        | "AWAITING_VERIFICATION"
        | "PAID"
        | "REFUNDED"
        | "FAILED"
      product_status: "DRAFT" | "ACTIVE" | "ARCHIVED"
      user_role: "customer" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string | null
          versioning_status: string
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
          versioning_status?: string
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
          versioning_status?: string
        }
        Relationships: []
      }
      buckets_analytics: {
        Row: {
          created_at: string
          deleted_at: string | null
          format: string
          id: string
          name: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      buckets_vectors: {
        Row: {
          created_at: string
          id: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          archived_at: string | null
          bucket_id: string | null
          created_at: string | null
          id: string
          is_delete_marker: boolean
          is_versioned: boolean
          last_accessed_at: string | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          archived_at?: string | null
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          is_delete_marker?: boolean
          is_versioned?: boolean
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          archived_at?: string | null
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          is_delete_marker?: boolean
          is_versioned?: boolean
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          metadata: Json | null
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      vector_indexes: {
        Row: {
          bucket_id: string
          created_at: string
          data_type: string
          dimension: number
          distance_metric: string
          id: string
          metadata_configuration: Json | null
          name: string
          updated_at: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          data_type: string
          dimension: number
          distance_metric: string
          id?: string
          metadata_configuration?: Json | null
          name: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          data_type?: string
          dimension?: number
          distance_metric?: string
          id?: string
          metadata_configuration?: Json | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vector_indexes_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets_vectors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      allow_any_operation: {
        Args: { expected_operations: string[] }
        Returns: boolean
      }
      allow_only_operation: {
        Args: { expected_operation: string }
        Returns: boolean
      }
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string }
        Returns: undefined
      }
      extension: { Args: { name: string }; Returns: string }
      filename: { Args: { name: string }; Returns: string }
      foldername: { Args: { name: string }; Returns: string[] }
      get_common_prefix: {
        Args: { p_delimiter: string; p_key: string; p_prefix: string }
        Returns: string
      }
      get_size_by_bucket: {
        Args: never
        Returns: {
          bucket_id: string
          size: number
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
          prefix_param: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          _bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_token?: string
          prefix_param: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      operation: { Args: never; Returns: string }
      search: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_by_timestamp: {
        Args: {
          p_bucket_id: string
          p_level: number
          p_limit: number
          p_prefix: string
          p_sort_column: string
          p_sort_column_after: string
          p_sort_order: string
          p_start_after: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v2: {
        Args: {
          bucket_name: string
          levels?: number
          limits?: number
          prefix: string
          sort_column?: string
          sort_column_after?: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
    }
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS" | "VECTOR"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      discount_type: ["PERCENT", "FIXED"],
      mfs_status: ["SUBMITTED", "VERIFIED", "REJECTED"],
      order_status: [
        "PENDING_PAYMENT",
        "PROCESSING",
        "SHIPPED",
        "DELIVERED",
        "CANCELLED",
      ],
      payment_method: ["COD", "BKASH", "NAGAD"],
      payment_status: [
        "UNPAID",
        "AWAITING_VERIFICATION",
        "PAID",
        "REFUNDED",
        "FAILED",
      ],
      product_status: ["DRAFT", "ACTIVE", "ARCHIVED"],
      user_role: ["customer", "admin"],
    },
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS", "VECTOR"],
    },
  },
} as const
