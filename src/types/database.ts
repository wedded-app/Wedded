export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      app_config: {
        Row: {
          key: string;
          updated_at: string;
          value: NonNullable<Json>;
        };
        Insert: {
          key: string;
          updated_at?: string;
          value: NonNullable<Json>;
        };
        Update: {
          key?: string;
          updated_at?: string;
          value?: NonNullable<Json>;
        };
        Relationships: [];
      };
      area_codes: {
        Row: {
          center_city_slug: string;
          code: string;
          created_at: string;
          label: NonNullable<Json>;
          radius_miles: number;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          center_city_slug: string;
          code: string;
          created_at?: string;
          label: NonNullable<Json>;
          radius_miles?: number;
          sort_order: number;
          updated_at?: string;
        };
        Update: {
          center_city_slug?: string;
          code?: string;
          created_at?: string;
          label?: NonNullable<Json>;
          radius_miles?: number;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'area_codes_center_city_slug_fkey';
            columns: ['center_city_slug'];
            isOneToOne: false;
            referencedRelation: 'cities';
            referencedColumns: ['slug'];
          },
        ];
      };
      backgrounds: {
        Row: {
          created_at: string;
          name: NonNullable<Json>;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          name: NonNullable<Json>;
          slug: string;
          sort_order: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          name?: NonNullable<Json>;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      bookings: {
        Row: {
          agreed_cents: number | null;
          booked_by: string | null;
          canceled_reason: string | null;
          created_at: string;
          family_confirmed_at: string | null;
          id: string;
          inquiry_id: string | null;
          slot_id: string;
          status: string;
          updated_at: string;
          vendor_confirmed_at: string | null;
          vendor_id: string | null;
          vendor_name: string | null;
        };
        Insert: {
          agreed_cents?: number | null;
          booked_by?: string | null;
          canceled_reason?: string | null;
          created_at?: string;
          family_confirmed_at?: string | null;
          id?: string;
          inquiry_id?: string | null;
          slot_id: string;
          status?: string;
          updated_at?: string;
          vendor_confirmed_at?: string | null;
          vendor_id?: string | null;
          vendor_name?: string | null;
        };
        Update: {
          agreed_cents?: number | null;
          booked_by?: string | null;
          canceled_reason?: string | null;
          created_at?: string;
          family_confirmed_at?: string | null;
          id?: string;
          inquiry_id?: string | null;
          slot_id?: string;
          status?: string;
          updated_at?: string;
          vendor_confirmed_at?: string | null;
          vendor_id?: string | null;
          vendor_name?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'bookings_inquiry_id_fkey';
            columns: ['inquiry_id'];
            isOneToOne: false;
            referencedRelation: 'inquiries';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bookings_slot_id_fkey';
            columns: ['slot_id'];
            isOneToOne: false;
            referencedRelation: 'wedding_slots';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bookings_vendor_id_fkey';
            columns: ['vendor_id'];
            isOneToOne: false;
            referencedRelation: 'vendors';
            referencedColumns: ['id'];
          },
        ];
      };
      categories: {
        Row: {
          aliases: string[];
          created_at: string;
          group_slug: string;
          is_religious: boolean;
          name: NonNullable<Json>;
          serves_alcohol: boolean;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          aliases?: string[];
          created_at?: string;
          group_slug: string;
          is_religious?: boolean;
          name: NonNullable<Json>;
          serves_alcohol?: boolean;
          slug: string;
          sort_order: number;
          updated_at?: string;
        };
        Update: {
          aliases?: string[];
          created_at?: string;
          group_slug?: string;
          is_religious?: boolean;
          name?: NonNullable<Json>;
          serves_alcohol?: boolean;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'categories_group_slug_fkey';
            columns: ['group_slug'];
            isOneToOne: false;
            referencedRelation: 'category_groups';
            referencedColumns: ['slug'];
          },
        ];
      };
      category_groups: {
        Row: {
          created_at: string;
          name: NonNullable<Json>;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          name: NonNullable<Json>;
          slug: string;
          sort_order: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          name?: NonNullable<Json>;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      cities: {
        Row: {
          area_code: string;
          created_at: string;
          latitude: number;
          location: unknown;
          longitude: number;
          name: string;
          nicknames: string[];
          region_slug: string;
          slug: string;
          state: string;
          updated_at: string;
        };
        Insert: {
          area_code: string;
          created_at?: string;
          latitude: number;
          location?: never;
          longitude: number;
          name: string;
          nicknames?: string[];
          region_slug: string;
          slug: string;
          state?: string;
          updated_at?: string;
        };
        Update: {
          area_code?: string;
          created_at?: string;
          latitude?: number;
          location?: never;
          longitude?: number;
          name?: string;
          nicknames?: string[];
          region_slug?: string;
          slug?: string;
          state?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'cities_region_slug_fkey';
            columns: ['region_slug'];
            isOneToOne: false;
            referencedRelation: 'regions';
            referencedColumns: ['slug'];
          },
        ];
      };
      conversations: {
        Row: {
          created_at: string;
          family_name: string | null;
          family_notified_at: string | null;
          family_read_at: string | null;
          family_user_id: string | null;
          id: string;
          last_message_at: string;
          vendor_id: string;
          vendor_notified_at: string | null;
          vendor_read_at: string | null;
        };
        Insert: {
          created_at?: string;
          family_name?: string | null;
          family_notified_at?: string | null;
          family_read_at?: string | null;
          family_user_id?: string | null;
          id?: string;
          last_message_at?: string;
          vendor_id: string;
          vendor_notified_at?: string | null;
          vendor_read_at?: string | null;
        };
        Update: {
          created_at?: string;
          family_name?: string | null;
          family_notified_at?: string | null;
          family_read_at?: string | null;
          family_user_id?: string | null;
          id?: string;
          last_message_at?: string;
          vendor_id?: string;
          vendor_notified_at?: string | null;
          vendor_read_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'conversations_vendor_id_fkey';
            columns: ['vendor_id'];
            isOneToOne: false;
            referencedRelation: 'vendors';
            referencedColumns: ['id'];
          },
        ];
      };
      culture_events: {
        Row: {
          created_at: string;
          culture_slug: string;
          event_slug: string;
          is_core: boolean;
          local_name: Json | null;
          phase: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          culture_slug: string;
          event_slug: string;
          is_core?: boolean;
          local_name?: Json | null;
          phase: string;
          sort_order: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          culture_slug?: string;
          event_slug?: string;
          is_core?: boolean;
          local_name?: Json | null;
          phase?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'culture_events_culture_slug_fkey';
            columns: ['culture_slug'];
            isOneToOne: false;
            referencedRelation: 'cultures';
            referencedColumns: ['slug'];
          },
          {
            foreignKeyName: 'culture_events_event_slug_fkey';
            columns: ['event_slug'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['slug'];
          },
        ];
      };
      cultures: {
        Row: {
          background_slug: string | null;
          created_at: string;
          faith_slug: string | null;
          is_default: boolean;
          name: NonNullable<Json>;
          shows_auspicious_dates: boolean;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          background_slug?: string | null;
          created_at?: string;
          faith_slug?: string | null;
          is_default?: boolean;
          name: NonNullable<Json>;
          shows_auspicious_dates?: boolean;
          slug: string;
          sort_order: number;
          updated_at?: string;
        };
        Update: {
          background_slug?: string | null;
          created_at?: string;
          faith_slug?: string | null;
          is_default?: boolean;
          name?: NonNullable<Json>;
          shows_auspicious_dates?: boolean;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'cultures_background_slug_fkey';
            columns: ['background_slug'];
            isOneToOne: false;
            referencedRelation: 'backgrounds';
            referencedColumns: ['slug'];
          },
          {
            foreignKeyName: 'cultures_faith_slug_fkey';
            columns: ['faith_slug'];
            isOneToOne: false;
            referencedRelation: 'faiths';
            referencedColumns: ['slug'];
          },
        ];
      };
      deposits: {
        Row: {
          amount_cents: number;
          canceled_at: string | null;
          conversation_id: string;
          created_at: string;
          currency: string;
          event_slug: string | null;
          family_user_id: string | null;
          id: string;
          livemode: boolean;
          note: string | null;
          paid_at: string | null;
          refunded_at: string | null;
          requested_by: string | null;
          status: string;
          stripe_account_id: string | null;
          stripe_payment_intent_id: string | null;
          updated_at: string;
          vendor_id: string;
        };
        Insert: {
          amount_cents: number;
          canceled_at?: string | null;
          conversation_id: string;
          created_at?: string;
          currency?: string;
          event_slug?: string | null;
          family_user_id?: string | null;
          id?: string;
          livemode?: boolean;
          note?: string | null;
          paid_at?: string | null;
          refunded_at?: string | null;
          requested_by?: string | null;
          status?: string;
          stripe_account_id?: string | null;
          stripe_payment_intent_id?: string | null;
          updated_at?: string;
          vendor_id: string;
        };
        Update: {
          amount_cents?: number;
          canceled_at?: string | null;
          conversation_id?: string;
          created_at?: string;
          currency?: string;
          event_slug?: string | null;
          family_user_id?: string | null;
          id?: string;
          livemode?: boolean;
          note?: string | null;
          paid_at?: string | null;
          refunded_at?: string | null;
          requested_by?: string | null;
          status?: string;
          stripe_account_id?: string | null;
          stripe_payment_intent_id?: string | null;
          updated_at?: string;
          vendor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'deposits_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'deposits_event_slug_fkey';
            columns: ['event_slug'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['slug'];
          },
          {
            foreignKeyName: 'deposits_vendor_id_fkey';
            columns: ['vendor_id'];
            isOneToOne: false;
            referencedRelation: 'vendors';
            referencedColumns: ['id'];
          },
        ];
      };
      email_opt_outs: {
        Row: {
          created_at: string;
          email: string;
        };
        Insert: {
          created_at?: string;
          email: string;
        };
        Update: {
          created_at?: string;
          email?: string;
        };
        Relationships: [];
      };
      event_categories: {
        Row: {
          category_slug: string;
          created_at: string;
          event_slug: string;
          importance: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          category_slug: string;
          created_at?: string;
          event_slug: string;
          importance: string;
          sort_order: number;
          updated_at?: string;
        };
        Update: {
          category_slug?: string;
          created_at?: string;
          event_slug?: string;
          importance?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'event_categories_category_slug_fkey';
            columns: ['category_slug'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['slug'];
          },
          {
            foreignKeyName: 'event_categories_event_slug_fkey';
            columns: ['event_slug'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['slug'];
          },
        ];
      };
      events: {
        Row: {
          aliases: string[];
          created_at: string;
          host_side: string;
          name: NonNullable<Json>;
          slug: string;
          summary: Json | null;
          timing: Json | null;
          typical_guests_max: number | null;
          typical_guests_min: number | null;
          updated_at: string;
        };
        Insert: {
          aliases?: string[];
          created_at?: string;
          host_side: string;
          name: NonNullable<Json>;
          slug: string;
          summary?: Json | null;
          timing?: Json | null;
          typical_guests_max?: number | null;
          typical_guests_min?: number | null;
          updated_at?: string;
        };
        Update: {
          aliases?: string[];
          created_at?: string;
          host_side?: string;
          name?: NonNullable<Json>;
          slug?: string;
          summary?: Json | null;
          timing?: Json | null;
          typical_guests_max?: number | null;
          typical_guests_min?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      faiths: {
        Row: {
          created_at: string;
          name: NonNullable<Json>;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          name: NonNullable<Json>;
          slug: string;
          sort_order: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          name?: NonNullable<Json>;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      follows: {
        Row: {
          created_at: string;
          follower_id: string;
          user_id: string | null;
          vendor_id: string | null;
        };
        Insert: {
          created_at?: string;
          follower_id?: string;
          user_id?: string | null;
          vendor_id?: string | null;
        };
        Update: {
          created_at?: string;
          follower_id?: string;
          user_id?: string | null;
          vendor_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'follows_vendor_id_fkey';
            columns: ['vendor_id'];
            isOneToOne: false;
            referencedRelation: 'vendors';
            referencedColumns: ['id'];
          },
        ];
      };
      group_invites: {
        Row: {
          created_at: string;
          created_by: string;
          expires_at: string;
          id: string;
          max_uses: number;
          revoked_at: string | null;
          thread_id: string;
          token: string;
          uses: number;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          expires_at?: string;
          id?: string;
          max_uses?: number;
          revoked_at?: string | null;
          thread_id: string;
          token?: string;
          uses?: number;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          expires_at?: string;
          id?: string;
          max_uses?: number;
          revoked_at?: string | null;
          thread_id?: string;
          token?: string;
          uses?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'group_invites_thread_id_fkey';
            columns: ['thread_id'];
            isOneToOne: false;
            referencedRelation: 'group_threads';
            referencedColumns: ['id'];
          },
        ];
      };
      group_members: {
        Row: {
          added_by: string | null;
          joined_at: string;
          notified_at: string | null;
          read_at: string | null;
          thread_id: string;
          user_id: string;
        };
        Insert: {
          added_by?: string | null;
          joined_at?: string;
          notified_at?: string | null;
          read_at?: string | null;
          thread_id: string;
          user_id: string;
        };
        Update: {
          added_by?: string | null;
          joined_at?: string;
          notified_at?: string | null;
          read_at?: string | null;
          thread_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'group_members_thread_id_fkey';
            columns: ['thread_id'];
            isOneToOne: false;
            referencedRelation: 'group_threads';
            referencedColumns: ['id'];
          },
        ];
      };
      group_messages: {
        Row: {
          body: string | null;
          created_at: string;
          data: NonNullable<Json>;
          id: string;
          kind: string;
          pushed_at: string | null;
          reply_to: string | null;
          sender_role: string;
          sender_user_id: string | null;
          thread_id: string;
          wed_ask: string | null;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          data?: NonNullable<Json>;
          id?: string;
          kind?: string;
          pushed_at?: string | null;
          reply_to?: string | null;
          sender_role: string;
          sender_user_id?: string | null;
          thread_id: string;
          wed_ask?: string | null;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          data?: NonNullable<Json>;
          id?: string;
          kind?: string;
          pushed_at?: string | null;
          reply_to?: string | null;
          sender_role?: string;
          sender_user_id?: string | null;
          thread_id?: string;
          wed_ask?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'group_messages_reply_to_fkey';
            columns: ['thread_id', 'reply_to'];
            isOneToOne: false;
            referencedRelation: 'group_messages';
            referencedColumns: ['thread_id', 'id'];
          },
          {
            foreignKeyName: 'group_messages_thread_id_fkey';
            columns: ['thread_id'];
            isOneToOne: false;
            referencedRelation: 'group_threads';
            referencedColumns: ['id'];
          },
        ];
      };
      group_threads: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          last_message_at: string;
          name: string;
          wedding_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          last_message_at?: string;
          name: string;
          wedding_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          last_message_at?: string;
          name?: string;
          wedding_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'group_threads_wedding_id_fkey';
            columns: ['wedding_id'];
            isOneToOne: false;
            referencedRelation: 'weddings';
            referencedColumns: ['id'];
          },
        ];
      };
      inquiries: {
        Row: {
          channel: string;
          created_at: string;
          details: NonNullable<Json>;
          event_date: string | null;
          event_slugs: string[];
          failure: string | null;
          guest_band: string;
          id: string;
          language: string;
          location: string;
          message: string;
          preferred_contact: string;
          provider_message_id: string | null;
          reply_answer: string | null;
          reply_answered_at: string | null;
          sender_email: string | null;
          sender_name: string | null;
          sender_phone: string | null;
          sent_at: string | null;
          start_time: string | null;
          status: string;
          user_id: string | null;
          vendor_id: string;
        };
        Insert: {
          channel: string;
          created_at?: string;
          details?: NonNullable<Json>;
          event_date?: string | null;
          event_slugs?: string[];
          failure?: string | null;
          guest_band: string;
          id?: string;
          language?: string;
          location: string;
          message: string;
          preferred_contact: string;
          provider_message_id?: string | null;
          reply_answer?: string | null;
          reply_answered_at?: string | null;
          sender_email?: string | null;
          sender_name?: string | null;
          sender_phone?: string | null;
          sent_at?: string | null;
          start_time?: string | null;
          status?: string;
          user_id?: string | null;
          vendor_id: string;
        };
        Update: {
          channel?: string;
          created_at?: string;
          details?: NonNullable<Json>;
          event_date?: string | null;
          event_slugs?: string[];
          failure?: string | null;
          guest_band?: string;
          id?: string;
          language?: string;
          location?: string;
          message?: string;
          preferred_contact?: string;
          provider_message_id?: string | null;
          reply_answer?: string | null;
          reply_answered_at?: string | null;
          sender_email?: string | null;
          sender_name?: string | null;
          sender_phone?: string | null;
          sent_at?: string | null;
          start_time?: string | null;
          status?: string;
          user_id?: string | null;
          vendor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'inquiries_vendor_id_fkey';
            columns: ['vendor_id'];
            isOneToOne: false;
            referencedRelation: 'vendors';
            referencedColumns: ['id'];
          },
        ];
      };
      linked_account_tokens: {
        Row: {
          access_token: string;
          account_id: string;
          expires_at: string | null;
          refresh_token: string | null;
          scopes: string[];
          updated_at: string;
        };
        Insert: {
          access_token: string;
          account_id: string;
          expires_at?: string | null;
          refresh_token?: string | null;
          scopes?: string[];
          updated_at?: string;
        };
        Update: {
          access_token?: string;
          account_id?: string;
          expires_at?: string | null;
          refresh_token?: string | null;
          scopes?: string[];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'linked_account_tokens_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: true;
            referencedRelation: 'linked_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      linked_accounts: {
        Row: {
          external_id: string;
          handle: string | null;
          id: string;
          last_synced_at: string | null;
          linked_at: string;
          platform: string;
          status: string;
          user_id: string;
          vendor_id: string | null;
        };
        Insert: {
          external_id: string;
          handle?: string | null;
          id?: string;
          last_synced_at?: string | null;
          linked_at?: string;
          platform: string;
          status?: string;
          user_id: string;
          vendor_id?: string | null;
        };
        Update: {
          external_id?: string;
          handle?: string | null;
          id?: string;
          last_synced_at?: string | null;
          linked_at?: string;
          platform?: string;
          status?: string;
          user_id?: string;
          vendor_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'linked_accounts_vendor_id_fkey';
            columns: ['vendor_id'];
            isOneToOne: false;
            referencedRelation: 'vendors';
            referencedColumns: ['id'];
          },
        ];
      };
      memory_vaults: {
        Row: {
          created_at: string;
          created_by: string | null;
          guests_see_all: boolean;
          id: string;
          show_vendors: boolean;
          uploads_open: boolean;
          wedding_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          guests_see_all?: boolean;
          id?: string;
          show_vendors?: boolean;
          uploads_open?: boolean;
          wedding_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          guests_see_all?: boolean;
          id?: string;
          show_vendors?: boolean;
          uploads_open?: boolean;
          wedding_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'memory_vaults_wedding_id_fkey';
            columns: ['wedding_id'];
            isOneToOne: true;
            referencedRelation: 'weddings';
            referencedColumns: ['id'];
          },
        ];
      };
      message_reactions: {
        Row: {
          conversation_id: string;
          created_at: string;
          message_id: string;
          reaction: string;
          user_id: string;
        };
        Insert: {
          conversation_id: string;
          created_at?: string;
          message_id: string;
          reaction: string;
          user_id: string;
        };
        Update: {
          conversation_id?: string;
          created_at?: string;
          message_id?: string;
          reaction?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'message_reactions_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'message_reactions_message_id_fkey';
            columns: ['message_id'];
            isOneToOne: false;
            referencedRelation: 'messages';
            referencedColumns: ['id'];
          },
        ];
      };
      messages: {
        Row: {
          body: string | null;
          conversation_id: string;
          created_at: string;
          data: NonNullable<Json>;
          id: string;
          inquiry_id: string | null;
          kind: string;
          pushed_at: string | null;
          reply_to: string | null;
          sender_role: string;
          sender_user_id: string | null;
        };
        Insert: {
          body?: string | null;
          conversation_id: string;
          created_at?: string;
          data?: NonNullable<Json>;
          id?: string;
          inquiry_id?: string | null;
          kind?: string;
          pushed_at?: string | null;
          reply_to?: string | null;
          sender_role: string;
          sender_user_id?: string | null;
        };
        Update: {
          body?: string | null;
          conversation_id?: string;
          created_at?: string;
          data?: NonNullable<Json>;
          id?: string;
          inquiry_id?: string | null;
          kind?: string;
          pushed_at?: string | null;
          reply_to?: string | null;
          sender_role?: string;
          sender_user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'messages_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'messages_inquiry_id_fkey';
            columns: ['inquiry_id'];
            isOneToOne: false;
            referencedRelation: 'inquiries';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'messages_reply_to_fkey';
            columns: ['conversation_id', 'reply_to'];
            isOneToOne: false;
            referencedRelation: 'messages';
            referencedColumns: ['conversation_id', 'id'];
          },
        ];
      };
      profiles: {
        Row: {
          adult_confirmed_at: string;
          city: string;
          created_at: string;
          full_name: string;
          id: string;
          is_sample: boolean;
          joined_as: string | null;
          phone: string;
          planning_for: string | null;
          updated_at: string;
        };
        Insert: {
          adult_confirmed_at?: string;
          city: string;
          created_at?: string;
          full_name: string;
          id: string;
          is_sample?: boolean;
          joined_as?: string | null;
          phone: string;
          planning_for?: string | null;
          updated_at?: string;
        };
        Update: {
          adult_confirmed_at?: string;
          city?: string;
          created_at?: string;
          full_name?: string;
          id?: string;
          is_sample?: boolean;
          joined_as?: string | null;
          phone?: string;
          planning_for?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      push_tokens: {
        Row: {
          created_at: string;
          platform: string;
          token: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          platform: string;
          token: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          platform?: string;
          token?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      reel_comments: {
        Row: {
          body: string;
          created_at: string;
          hidden: boolean;
          id: string;
          reel_id: string;
          user_id: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          hidden?: boolean;
          id?: string;
          reel_id: string;
          user_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          hidden?: boolean;
          id?: string;
          reel_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reel_comments_reel_id_fkey';
            columns: ['reel_id'];
            isOneToOne: false;
            referencedRelation: 'reels';
            referencedColumns: ['id'];
          },
        ];
      };
      reel_likes: {
        Row: {
          created_at: string;
          reel_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          reel_id: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          reel_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reel_likes_reel_id_fkey';
            columns: ['reel_id'];
            isOneToOne: false;
            referencedRelation: 'reels';
            referencedColumns: ['id'];
          },
        ];
      };
      reel_reports: {
        Row: {
          comment_id: string | null;
          created_at: string;
          id: string;
          note: string | null;
          reason: string;
          reel_id: string | null;
          reported_user_id: string | null;
          reporter_id: string | null;
          status: string;
          story_id: string | null;
        };
        Insert: {
          comment_id?: string | null;
          created_at?: string;
          id?: string;
          note?: string | null;
          reason: string;
          reel_id?: string | null;
          reported_user_id?: string | null;
          reporter_id?: string | null;
          status?: string;
          story_id?: string | null;
        };
        Update: {
          comment_id?: string | null;
          created_at?: string;
          id?: string;
          note?: string | null;
          reason?: string;
          reel_id?: string | null;
          reported_user_id?: string | null;
          reporter_id?: string | null;
          status?: string;
          story_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'reel_reports_comment_id_fkey';
            columns: ['comment_id'];
            isOneToOne: false;
            referencedRelation: 'reel_comments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reel_reports_reel_id_fkey';
            columns: ['reel_id'];
            isOneToOne: false;
            referencedRelation: 'reels';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reel_reports_story_id_fkey';
            columns: ['story_id'];
            isOneToOne: false;
            referencedRelation: 'stories';
            referencedColumns: ['id'];
          },
        ];
      };
      reel_vendor_tags: {
        Row: {
          created_at: string;
          decided_at: string | null;
          reel_id: string;
          status: string;
          vendor_id: string;
        };
        Insert: {
          created_at?: string;
          decided_at?: string | null;
          reel_id: string;
          status?: string;
          vendor_id: string;
        };
        Update: {
          created_at?: string;
          decided_at?: string | null;
          reel_id?: string;
          status?: string;
          vendor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reel_vendor_tags_reel_id_fkey';
            columns: ['reel_id'];
            isOneToOne: false;
            referencedRelation: 'reels';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reel_vendor_tags_vendor_id_fkey';
            columns: ['vendor_id'];
            isOneToOne: false;
            referencedRelation: 'vendors';
            referencedColumns: ['id'];
          },
        ];
      };
      reel_views_daily: {
        Row: {
          count: number;
          day: string;
          reel_id: string;
        };
        Insert: {
          count?: number;
          day: string;
          reel_id: string;
        };
        Update: {
          count?: number;
          day?: string;
          reel_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reel_views_daily_reel_id_fkey';
            columns: ['reel_id'];
            isOneToOne: false;
            referencedRelation: 'reels';
            referencedColumns: ['id'];
          },
        ];
      };
      reels: {
        Row: {
          author_id: string;
          caption: string | null;
          created_at: string;
          credit_name: string | null;
          duration_s: number | null;
          event_slug: string | null;
          height: number | null;
          id: string;
          linked_account_id: string | null;
          platform: string | null;
          source: string;
          source_id: string | null;
          source_url: string | null;
          status: string;
          thumb_path: string | null;
          vendor_id: string | null;
          video_path: string | null;
          width: number | null;
        };
        Insert: {
          author_id: string;
          caption?: string | null;
          created_at?: string;
          credit_name?: string | null;
          duration_s?: number | null;
          event_slug?: string | null;
          height?: number | null;
          id?: string;
          linked_account_id?: string | null;
          platform?: string | null;
          source?: string;
          source_id?: string | null;
          source_url?: string | null;
          status?: string;
          thumb_path?: string | null;
          vendor_id?: string | null;
          video_path?: string | null;
          width?: number | null;
        };
        Update: {
          author_id?: string;
          caption?: string | null;
          created_at?: string;
          credit_name?: string | null;
          duration_s?: number | null;
          event_slug?: string | null;
          height?: number | null;
          id?: string;
          linked_account_id?: string | null;
          platform?: string | null;
          source?: string;
          source_id?: string | null;
          source_url?: string | null;
          status?: string;
          thumb_path?: string | null;
          vendor_id?: string | null;
          video_path?: string | null;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'reels_event_slug_fkey';
            columns: ['event_slug'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['slug'];
          },
          {
            foreignKeyName: 'reels_linked_account_id_fkey';
            columns: ['linked_account_id'];
            isOneToOne: false;
            referencedRelation: 'linked_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reels_vendor_id_fkey';
            columns: ['vendor_id'];
            isOneToOne: false;
            referencedRelation: 'vendors';
            referencedColumns: ['id'];
          },
        ];
      };
      regions: {
        Row: {
          created_at: string;
          is_live: boolean;
          launch_vendor_target: number;
          name: NonNullable<Json>;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          is_live?: boolean;
          launch_vendor_target?: number;
          name: NonNullable<Json>;
          slug: string;
          sort_order: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          is_live?: boolean;
          launch_vendor_target?: number;
          name?: NonNullable<Json>;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      request_proposals: {
        Row: {
          answered_at: string | null;
          conversation_id: string | null;
          created_at: string;
          id: string;
          menu_id: string | null;
          note: string;
          price_cents: number | null;
          price_unit: string | null;
          reel_id: string | null;
          request_id: string;
          sent_by: string | null;
          status: string;
          vendor_id: string;
        };
        Insert: {
          answered_at?: string | null;
          conversation_id?: string | null;
          created_at?: string;
          id?: string;
          menu_id?: string | null;
          note: string;
          price_cents?: number | null;
          price_unit?: string | null;
          reel_id?: string | null;
          request_id: string;
          sent_by?: string | null;
          status?: string;
          vendor_id: string;
        };
        Update: {
          answered_at?: string | null;
          conversation_id?: string | null;
          created_at?: string;
          id?: string;
          menu_id?: string | null;
          note?: string;
          price_cents?: number | null;
          price_unit?: string | null;
          reel_id?: string | null;
          request_id?: string;
          sent_by?: string | null;
          status?: string;
          vendor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'request_proposals_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'request_proposals_menu_id_fkey';
            columns: ['menu_id'];
            isOneToOne: false;
            referencedRelation: 'vendor_menus';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'request_proposals_reel_id_fkey';
            columns: ['reel_id'];
            isOneToOne: false;
            referencedRelation: 'reels';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'request_proposals_request_id_fkey';
            columns: ['request_id'];
            isOneToOne: false;
            referencedRelation: 'wedding_requests';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'request_proposals_vendor_id_fkey';
            columns: ['vendor_id'];
            isOneToOne: false;
            referencedRelation: 'vendors';
            referencedColumns: ['id'];
          },
        ];
      };
      saved_vendors: {
        Row: {
          created_at: string;
          id: string;
          note: string | null;
          source: string;
          user_id: string;
          vendor_id: string;
          wedding_event_id: string | null;
          wedding_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          note?: string | null;
          source?: string;
          user_id?: string;
          vendor_id: string;
          wedding_event_id?: string | null;
          wedding_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          note?: string | null;
          source?: string;
          user_id?: string;
          vendor_id?: string;
          wedding_event_id?: string | null;
          wedding_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'saved_vendors_vendor_id_fkey';
            columns: ['vendor_id'];
            isOneToOne: false;
            referencedRelation: 'vendors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'saved_vendors_wedding_event_id_fkey';
            columns: ['wedding_event_id'];
            isOneToOne: false;
            referencedRelation: 'wedding_events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'saved_vendors_wedding_id_fkey';
            columns: ['wedding_id'];
            isOneToOne: false;
            referencedRelation: 'weddings';
            referencedColumns: ['id'];
          },
        ];
      };
      shortlist_reactions: {
        Row: {
          reaction: string;
          updated_at: string;
          user_id: string;
          vendor_id: string;
          wedding_id: string;
        };
        Insert: {
          reaction: string;
          updated_at?: string;
          user_id?: string;
          vendor_id: string;
          wedding_id: string;
        };
        Update: {
          reaction?: string;
          updated_at?: string;
          user_id?: string;
          vendor_id?: string;
          wedding_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'shortlist_reactions_vendor_id_fkey';
            columns: ['vendor_id'];
            isOneToOne: false;
            referencedRelation: 'vendors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'shortlist_reactions_wedding_id_fkey';
            columns: ['wedding_id'];
            isOneToOne: false;
            referencedRelation: 'weddings';
            referencedColumns: ['id'];
          },
        ];
      };
      stories: {
        Row: {
          author_id: string;
          caption: string | null;
          created_at: string;
          duration_s: number | null;
          height: number | null;
          id: string;
          kind: string;
          media_path: string;
          status: string;
          thumb_path: string | null;
          vendor_id: string | null;
          width: number | null;
        };
        Insert: {
          author_id: string;
          caption?: string | null;
          created_at?: string;
          duration_s?: number | null;
          height?: number | null;
          id?: string;
          kind: string;
          media_path: string;
          status?: string;
          thumb_path?: string | null;
          vendor_id?: string | null;
          width?: number | null;
        };
        Update: {
          author_id?: string;
          caption?: string | null;
          created_at?: string;
          duration_s?: number | null;
          height?: number | null;
          id?: string;
          kind?: string;
          media_path?: string;
          status?: string;
          thumb_path?: string | null;
          vendor_id?: string | null;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'stories_vendor_id_fkey';
            columns: ['vendor_id'];
            isOneToOne: false;
            referencedRelation: 'vendors';
            referencedColumns: ['id'];
          },
        ];
      };
      suggestions: {
        Row: {
          category_slug: string;
          created_at: string;
          id: string;
          note: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          status: string;
          suggested_by: string | null;
          vendor_id: string;
          wedding_event_id: string;
          wedding_id: string;
        };
        Insert: {
          category_slug: string;
          created_at?: string;
          id?: string;
          note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: string;
          suggested_by?: string | null;
          vendor_id: string;
          wedding_event_id: string;
          wedding_id: string;
        };
        Update: {
          category_slug?: string;
          created_at?: string;
          id?: string;
          note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: string;
          suggested_by?: string | null;
          vendor_id?: string;
          wedding_event_id?: string;
          wedding_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'suggestions_category_slug_fkey';
            columns: ['category_slug'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['slug'];
          },
          {
            foreignKeyName: 'suggestions_vendor_id_fkey';
            columns: ['vendor_id'];
            isOneToOne: false;
            referencedRelation: 'vendors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'suggestions_wedding_event_fkey';
            columns: ['wedding_id', 'wedding_event_id'];
            isOneToOne: false;
            referencedRelation: 'wedding_events';
            referencedColumns: ['wedding_id', 'id'];
          },
        ];
      };
      user_blocks: {
        Row: {
          blocked_id: string;
          blocker_id: string;
          created_at: string;
        };
        Insert: {
          blocked_id: string;
          blocker_id?: string;
          created_at?: string;
        };
        Update: {
          blocked_id?: string;
          blocker_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      vault_guests: {
        Row: {
          joined_at: string;
          user_id: string;
          vault_id: string;
        };
        Insert: {
          joined_at?: string;
          user_id: string;
          vault_id: string;
        };
        Update: {
          joined_at?: string;
          user_id?: string;
          vault_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vault_guests_vault_id_fkey';
            columns: ['vault_id'];
            isOneToOne: false;
            referencedRelation: 'memory_vaults';
            referencedColumns: ['id'];
          },
        ];
      };
      vault_invites: {
        Row: {
          created_at: string;
          created_by: string | null;
          expires_at: string;
          id: string;
          max_uses: number;
          revoked_at: string | null;
          token_hash: string;
          uses: number;
          vault_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          expires_at?: string;
          id?: string;
          max_uses?: number;
          revoked_at?: string | null;
          token_hash: string;
          uses?: number;
          vault_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          expires_at?: string;
          id?: string;
          max_uses?: number;
          revoked_at?: string | null;
          token_hash?: string;
          uses?: number;
          vault_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vault_invites_vault_id_fkey';
            columns: ['vault_id'];
            isOneToOne: false;
            referencedRelation: 'memory_vaults';
            referencedColumns: ['id'];
          },
        ];
      };
      vault_items: {
        Row: {
          created_at: string;
          duration_ms: number | null;
          event_slug: string | null;
          height: number;
          hidden_at: string | null;
          id: string;
          kind: string;
          path: string;
          taken_at: string | null;
          thumb_path: string | null;
          user_id: string;
          vault_id: string;
          width: number;
        };
        Insert: {
          created_at?: string;
          duration_ms?: number | null;
          event_slug?: string | null;
          height: number;
          hidden_at?: string | null;
          id: string;
          kind: string;
          path: string;
          taken_at?: string | null;
          thumb_path?: string | null;
          user_id: string;
          vault_id: string;
          width: number;
        };
        Update: {
          created_at?: string;
          duration_ms?: number | null;
          event_slug?: string | null;
          height?: number;
          hidden_at?: string | null;
          id?: string;
          kind?: string;
          path?: string;
          taken_at?: string | null;
          thumb_path?: string | null;
          user_id?: string;
          vault_id?: string;
          width?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'vault_items_event_slug_fkey';
            columns: ['event_slug'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['slug'];
          },
          {
            foreignKeyName: 'vault_items_vault_id_fkey';
            columns: ['vault_id'];
            isOneToOne: false;
            referencedRelation: 'memory_vaults';
            referencedColumns: ['id'];
          },
        ];
      };
      vendor_activity_daily: {
        Row: {
          count: number;
          day: string;
          kind: string;
          vendor_id: string;
        };
        Insert: {
          count?: number;
          day: string;
          kind: string;
          vendor_id: string;
        };
        Update: {
          count?: number;
          day?: string;
          kind?: string;
          vendor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vendor_activity_daily_vendor_id_fkey';
            columns: ['vendor_id'];
            isOneToOne: false;
            referencedRelation: 'vendors';
            referencedColumns: ['id'];
          },
        ];
      };
      vendor_categories: {
        Row: {
          category_slug: string;
          created_at: string;
          position: number;
          updated_at: string;
          vendor_id: string;
        };
        Insert: {
          category_slug: string;
          created_at?: string;
          position: number;
          updated_at?: string;
          vendor_id: string;
        };
        Update: {
          category_slug?: string;
          created_at?: string;
          position?: number;
          updated_at?: string;
          vendor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vendor_categories_category_slug_fkey';
            columns: ['category_slug'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['slug'];
          },
          {
            foreignKeyName: 'vendor_categories_vendor_id_fkey';
            columns: ['vendor_id'];
            isOneToOne: false;
            referencedRelation: 'vendors';
            referencedColumns: ['id'];
          },
        ];
      };
      vendor_events: {
        Row: {
          created_at: string;
          event_slug: string;
          updated_at: string;
          vendor_id: string;
        };
        Insert: {
          created_at?: string;
          event_slug: string;
          updated_at?: string;
          vendor_id: string;
        };
        Update: {
          created_at?: string;
          event_slug?: string;
          updated_at?: string;
          vendor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vendor_events_event_slug_fkey';
            columns: ['event_slug'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['slug'];
          },
          {
            foreignKeyName: 'vendor_events_vendor_id_fkey';
            columns: ['vendor_id'];
            isOneToOne: false;
            referencedRelation: 'vendors';
            referencedColumns: ['id'];
          },
        ];
      };
      vendor_leads: {
        Row: {
          business_name: string;
          category: string | null;
          city: string;
          claimed_vendor_id: string | null;
          contact_name: string;
          created_at: string;
          id: string;
          instagram_handle: string | null;
          kind: string;
          language: string;
          note: string | null;
          phone: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          business_name: string;
          category?: string | null;
          city: string;
          claimed_vendor_id?: string | null;
          contact_name: string;
          created_at?: string;
          id?: string;
          instagram_handle?: string | null;
          kind?: string;
          language?: string;
          note?: string | null;
          phone: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          business_name?: string;
          category?: string | null;
          city?: string;
          claimed_vendor_id?: string | null;
          contact_name?: string;
          created_at?: string;
          id?: string;
          instagram_handle?: string | null;
          kind?: string;
          language?: string;
          note?: string | null;
          phone?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vendor_leads_claimed_vendor_id_fkey';
            columns: ['claimed_vendor_id'];
            isOneToOne: false;
            referencedRelation: 'vendors';
            referencedColumns: ['id'];
          },
        ];
      };
      vendor_links: {
        Row: {
          confirmed_by_both: boolean | null;
          confirmed_by_vendor: boolean;
          confirmed_by_venue: boolean;
          created_at: string;
          id: string;
          kind: string;
          updated_at: string;
          vendor_id: string;
          venue_vendor_id: string;
        };
        Insert: {
          confirmed_by_both?: never;
          confirmed_by_vendor?: boolean;
          confirmed_by_venue?: boolean;
          created_at?: string;
          id?: string;
          kind: string;
          updated_at?: string;
          vendor_id: string;
          venue_vendor_id: string;
        };
        Update: {
          confirmed_by_both?: never;
          confirmed_by_vendor?: boolean;
          confirmed_by_venue?: boolean;
          created_at?: string;
          id?: string;
          kind?: string;
          updated_at?: string;
          vendor_id?: string;
          venue_vendor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vendor_links_vendor_id_fkey';
            columns: ['vendor_id'];
            isOneToOne: false;
            referencedRelation: 'vendors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vendor_links_venue_vendor_id_fkey';
            columns: ['venue_vendor_id'];
            isOneToOne: false;
            referencedRelation: 'vendors';
            referencedColumns: ['id'];
          },
        ];
      };
      vendor_media: {
        Row: {
          blurhash: string | null;
          created_at: string;
          credit_text: string | null;
          credit_vendor_id: string | null;
          event_slug: string | null;
          height: number;
          id: string;
          is_cover: boolean;
          kind: string;
          sort_order: number;
          storage_path: string;
          updated_at: string;
          vendor_id: string;
          venue_vendor_id: string | null;
          width: number;
        };
        Insert: {
          blurhash?: string | null;
          created_at?: string;
          credit_text?: string | null;
          credit_vendor_id?: string | null;
          event_slug?: string | null;
          height: number;
          id?: string;
          is_cover?: boolean;
          kind?: string;
          sort_order?: number;
          storage_path: string;
          updated_at?: string;
          vendor_id: string;
          venue_vendor_id?: string | null;
          width: number;
        };
        Update: {
          blurhash?: string | null;
          created_at?: string;
          credit_text?: string | null;
          credit_vendor_id?: string | null;
          event_slug?: string | null;
          height?: number;
          id?: string;
          is_cover?: boolean;
          kind?: string;
          sort_order?: number;
          storage_path?: string;
          updated_at?: string;
          vendor_id?: string;
          venue_vendor_id?: string | null;
          width?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'vendor_media_credit_vendor_id_fkey';
            columns: ['credit_vendor_id'];
            isOneToOne: false;
            referencedRelation: 'vendors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vendor_media_event_slug_fkey';
            columns: ['event_slug'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['slug'];
          },
          {
            foreignKeyName: 'vendor_media_vendor_id_fkey';
            columns: ['vendor_id'];
            isOneToOne: false;
            referencedRelation: 'vendors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vendor_media_venue_vendor_id_fkey';
            columns: ['venue_vendor_id'];
            isOneToOne: false;
            referencedRelation: 'vendors';
            referencedColumns: ['id'];
          },
        ];
      };
      vendor_members: {
        Row: {
          created_at: string;
          role: string;
          user_id: string;
          vendor_id: string;
        };
        Insert: {
          created_at?: string;
          role?: string;
          user_id: string;
          vendor_id: string;
        };
        Update: {
          created_at?: string;
          role?: string;
          user_id?: string;
          vendor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vendor_members_vendor_id_fkey';
            columns: ['vendor_id'];
            isOneToOne: false;
            referencedRelation: 'vendors';
            referencedColumns: ['id'];
          },
        ];
      };
      vendor_menus: {
        Row: {
          created_at: string;
          cuisine: string | null;
          description: string | null;
          diet: string[];
          id: string;
          min_guests: number | null;
          name: string;
          price_from: number | null;
          price_unit: string | null;
          sections: NonNullable<Json>;
          sort_order: number;
          updated_at: string;
          vendor_id: string;
        };
        Insert: {
          created_at?: string;
          cuisine?: string | null;
          description?: string | null;
          diet?: string[];
          id?: string;
          min_guests?: number | null;
          name: string;
          price_from?: number | null;
          price_unit?: string | null;
          sections?: NonNullable<Json>;
          sort_order?: number;
          updated_at?: string;
          vendor_id: string;
        };
        Update: {
          created_at?: string;
          cuisine?: string | null;
          description?: string | null;
          diet?: string[];
          id?: string;
          min_guests?: number | null;
          name?: string;
          price_from?: number | null;
          price_unit?: string | null;
          sections?: NonNullable<Json>;
          sort_order?: number;
          updated_at?: string;
          vendor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vendor_menus_vendor_id_fkey';
            columns: ['vendor_id'];
            isOneToOne: false;
            referencedRelation: 'vendors';
            referencedColumns: ['id'];
          },
        ];
      };
      vendor_payment_accounts: {
        Row: {
          charges_enabled: boolean;
          created_at: string;
          details_submitted: boolean;
          livemode: boolean;
          stripe_account_id: string;
          updated_at: string;
          vendor_id: string;
        };
        Insert: {
          charges_enabled?: boolean;
          created_at?: string;
          details_submitted?: boolean;
          livemode?: boolean;
          stripe_account_id: string;
          updated_at?: string;
          vendor_id: string;
        };
        Update: {
          charges_enabled?: boolean;
          created_at?: string;
          details_submitted?: boolean;
          livemode?: boolean;
          stripe_account_id?: string;
          updated_at?: string;
          vendor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vendor_payment_accounts_vendor_id_fkey';
            columns: ['vendor_id'];
            isOneToOne: true;
            referencedRelation: 'vendors';
            referencedColumns: ['id'];
          },
        ];
      };
      vendor_private: {
        Row: {
          checks_email: boolean | null;
          created_at: string;
          email: string | null;
          exact_location: unknown;
          notes: string | null;
          owner_name: string | null;
          street_address: string | null;
          updated_at: string;
          vendor_id: string;
        };
        Insert: {
          checks_email?: boolean | null;
          created_at?: string;
          email?: string | null;
          exact_location?: unknown;
          notes?: string | null;
          owner_name?: string | null;
          street_address?: string | null;
          updated_at?: string;
          vendor_id: string;
        };
        Update: {
          checks_email?: boolean | null;
          created_at?: string;
          email?: string | null;
          exact_location?: unknown;
          notes?: string | null;
          owner_name?: string | null;
          street_address?: string | null;
          updated_at?: string;
          vendor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vendor_private_vendor_id_fkey';
            columns: ['vendor_id'];
            isOneToOne: true;
            referencedRelation: 'vendors';
            referencedColumns: ['id'];
          },
        ];
      };
      vendor_subscriptions: {
        Row: {
          cancel_at_period_end: boolean;
          created_at: string;
          current_period_end: string | null;
          livemode: boolean;
          plan: string;
          status: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          updated_at: string;
          vendor_id: string;
        };
        Insert: {
          cancel_at_period_end?: boolean;
          created_at?: string;
          current_period_end?: string | null;
          livemode?: boolean;
          plan?: string;
          status: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          updated_at?: string;
          vendor_id: string;
        };
        Update: {
          cancel_at_period_end?: boolean;
          created_at?: string;
          current_period_end?: string | null;
          livemode?: boolean;
          plan?: string;
          status?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          updated_at?: string;
          vendor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vendor_subscriptions_vendor_id_fkey';
            columns: ['vendor_id'];
            isOneToOne: true;
            referencedRelation: 'vendors';
            referencedColumns: ['id'];
          },
        ];
      };
      vendor_unavailable_days: {
        Row: {
          created_at: string;
          day: string;
          part: string;
          status: string;
          vendor_id: string;
        };
        Insert: {
          created_at?: string;
          day: string;
          part?: string;
          status?: string;
          vendor_id: string;
        };
        Update: {
          created_at?: string;
          day?: string;
          part?: string;
          status?: string;
          vendor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vendor_unavailable_days_vendor_id_fkey';
            columns: ['vendor_id'];
            isOneToOne: false;
            referencedRelation: 'vendors';
            referencedColumns: ['id'];
          },
        ];
      };
      vendors: {
        Row: {
          address_line: string | null;
          address_visibility: string;
          bio: string | null;
          calendar_updated_at: string | null;
          call_phone: string | null;
          city: string;
          created_at: string;
          details: NonNullable<Json>;
          founding_number: number | null;
          id: string;
          instagram_handle: string | null;
          is_sample: boolean;
          languages: string[];
          last_verified_at: string | null;
          location: unknown;
          name: string;
          office_hours: string | null;
          preferred_contact: string | null;
          price_display: string;
          price_from: number | null;
          price_note: string | null;
          price_to: number | null;
          price_unit: string | null;
          service_radius_miles: number;
          slug: string;
          source: string;
          status: string;
          tagline: string | null;
          team_size: number | null;
          text_phone: string | null;
          travel_note: string | null;
          updated_at: string;
          website_url: string | null;
          whatsapp_phone: string | null;
          will_travel: boolean;
          years_in_business: number | null;
        };
        Insert: {
          address_line?: string | null;
          address_visibility?: string;
          bio?: string | null;
          calendar_updated_at?: string | null;
          call_phone?: string | null;
          city: string;
          created_at?: string;
          details?: NonNullable<Json>;
          founding_number?: number | null;
          id?: string;
          instagram_handle?: string | null;
          is_sample?: boolean;
          languages?: string[];
          last_verified_at?: string | null;
          location: unknown;
          name: string;
          office_hours?: string | null;
          preferred_contact?: string | null;
          price_display?: string;
          price_from?: number | null;
          price_note?: string | null;
          price_to?: number | null;
          price_unit?: string | null;
          service_radius_miles?: number;
          slug: string;
          source?: string;
          status?: string;
          tagline?: string | null;
          team_size?: number | null;
          text_phone?: string | null;
          travel_note?: string | null;
          updated_at?: string;
          website_url?: string | null;
          whatsapp_phone?: string | null;
          will_travel?: boolean;
          years_in_business?: number | null;
        };
        Update: {
          address_line?: string | null;
          address_visibility?: string;
          bio?: string | null;
          calendar_updated_at?: string | null;
          call_phone?: string | null;
          city?: string;
          created_at?: string;
          details?: NonNullable<Json>;
          founding_number?: number | null;
          id?: string;
          instagram_handle?: string | null;
          is_sample?: boolean;
          languages?: string[];
          last_verified_at?: string | null;
          location?: unknown;
          name?: string;
          office_hours?: string | null;
          preferred_contact?: string | null;
          price_display?: string;
          price_from?: number | null;
          price_note?: string | null;
          price_to?: number | null;
          price_unit?: string | null;
          service_radius_miles?: number;
          slug?: string;
          source?: string;
          status?: string;
          tagline?: string | null;
          team_size?: number | null;
          text_phone?: string | null;
          travel_note?: string | null;
          updated_at?: string;
          website_url?: string | null;
          whatsapp_phone?: string | null;
          will_travel?: boolean;
          years_in_business?: number | null;
        };
        Relationships: [];
      };
      wedding_cultures: {
        Row: {
          created_at: string;
          culture_slug: string;
          wedding_id: string;
        };
        Insert: {
          created_at?: string;
          culture_slug: string;
          wedding_id: string;
        };
        Update: {
          created_at?: string;
          culture_slug?: string;
          wedding_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'wedding_cultures_culture_slug_fkey';
            columns: ['culture_slug'];
            isOneToOne: false;
            referencedRelation: 'cultures';
            referencedColumns: ['slug'];
          },
          {
            foreignKeyName: 'wedding_cultures_wedding_id_fkey';
            columns: ['wedding_id'];
            isOneToOne: false;
            referencedRelation: 'weddings';
            referencedColumns: ['id'];
          },
        ];
      };
      wedding_events: {
        Row: {
          at_home: boolean;
          budget_cents: number | null;
          city_slug: string | null;
          created_at: string;
          ends_at: string | null;
          event_date: string | null;
          event_slug: string;
          guest_band: string | null;
          guest_count: number | null;
          id: string;
          side_id: string | null;
          starts_at: string | null;
          updated_at: string;
          venue_id: string | null;
          venue_text: string | null;
          wedding_id: string;
        };
        Insert: {
          at_home?: boolean;
          budget_cents?: number | null;
          city_slug?: string | null;
          created_at?: string;
          ends_at?: string | null;
          event_date?: string | null;
          event_slug: string;
          guest_band?: string | null;
          guest_count?: number | null;
          id?: string;
          side_id?: string | null;
          starts_at?: string | null;
          updated_at?: string;
          venue_id?: string | null;
          venue_text?: string | null;
          wedding_id: string;
        };
        Update: {
          at_home?: boolean;
          budget_cents?: number | null;
          city_slug?: string | null;
          created_at?: string;
          ends_at?: string | null;
          event_date?: string | null;
          event_slug?: string;
          guest_band?: string | null;
          guest_count?: number | null;
          id?: string;
          side_id?: string | null;
          starts_at?: string | null;
          updated_at?: string;
          venue_id?: string | null;
          venue_text?: string | null;
          wedding_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'wedding_events_city_slug_fkey';
            columns: ['city_slug'];
            isOneToOne: false;
            referencedRelation: 'cities';
            referencedColumns: ['slug'];
          },
          {
            foreignKeyName: 'wedding_events_event_slug_fkey';
            columns: ['event_slug'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['slug'];
          },
          {
            foreignKeyName: 'wedding_events_side_fkey';
            columns: ['wedding_id', 'side_id'];
            isOneToOne: false;
            referencedRelation: 'wedding_sides';
            referencedColumns: ['wedding_id', 'id'];
          },
          {
            foreignKeyName: 'wedding_events_venue_id_fkey';
            columns: ['venue_id'];
            isOneToOne: false;
            referencedRelation: 'vendors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'wedding_events_wedding_id_fkey';
            columns: ['wedding_id'];
            isOneToOne: false;
            referencedRelation: 'weddings';
            referencedColumns: ['id'];
          },
        ];
      };
      wedding_invites: {
        Row: {
          created_at: string;
          created_by: string;
          expires_at: string;
          id: string;
          max_uses: number;
          revoked_at: string | null;
          role: string;
          side_id: string | null;
          token_hash: string;
          uses: number;
          wedding_id: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          expires_at?: string;
          id?: string;
          max_uses?: number;
          revoked_at?: string | null;
          role?: string;
          side_id?: string | null;
          token_hash: string;
          uses?: number;
          wedding_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          expires_at?: string;
          id?: string;
          max_uses?: number;
          revoked_at?: string | null;
          role?: string;
          side_id?: string | null;
          token_hash?: string;
          uses?: number;
          wedding_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'wedding_invites_side_fkey';
            columns: ['wedding_id', 'side_id'];
            isOneToOne: false;
            referencedRelation: 'wedding_sides';
            referencedColumns: ['wedding_id', 'id'];
          },
          {
            foreignKeyName: 'wedding_invites_wedding_id_fkey';
            columns: ['wedding_id'];
            isOneToOne: false;
            referencedRelation: 'weddings';
            referencedColumns: ['id'];
          },
        ];
      };
      wedding_members: {
        Row: {
          invite_id: string | null;
          joined_at: string;
          relation: string | null;
          role: string;
          side_id: string | null;
          user_id: string;
          wedding_id: string;
        };
        Insert: {
          invite_id?: string | null;
          joined_at?: string;
          relation?: string | null;
          role: string;
          side_id?: string | null;
          user_id: string;
          wedding_id: string;
        };
        Update: {
          invite_id?: string | null;
          joined_at?: string;
          relation?: string | null;
          role?: string;
          side_id?: string | null;
          user_id?: string;
          wedding_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'wedding_members_invite_id_fkey';
            columns: ['invite_id'];
            isOneToOne: false;
            referencedRelation: 'wedding_invites';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'wedding_members_side_fkey';
            columns: ['wedding_id', 'side_id'];
            isOneToOne: false;
            referencedRelation: 'wedding_sides';
            referencedColumns: ['wedding_id', 'id'];
          },
          {
            foreignKeyName: 'wedding_members_wedding_id_fkey';
            columns: ['wedding_id'];
            isOneToOne: false;
            referencedRelation: 'weddings';
            referencedColumns: ['id'];
          },
        ];
      };
      wedding_requests: {
        Row: {
          budget_max_cents: number | null;
          budget_min_cents: number | null;
          category_slug: string;
          city_slug: string;
          closed_at: string | null;
          created_at: string;
          created_by: string | null;
          event_date: string | null;
          event_slug: string | null;
          expires_at: string;
          guest_band: string | null;
          id: string;
          note: string;
          proposal_count: number;
          status: string;
          updated_at: string;
          wedding_id: string;
        };
        Insert: {
          budget_max_cents?: number | null;
          budget_min_cents?: number | null;
          category_slug: string;
          city_slug: string;
          closed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          event_date?: string | null;
          event_slug?: string | null;
          expires_at: string;
          guest_band?: string | null;
          id?: string;
          note: string;
          proposal_count?: number;
          status?: string;
          updated_at?: string;
          wedding_id: string;
        };
        Update: {
          budget_max_cents?: number | null;
          budget_min_cents?: number | null;
          category_slug?: string;
          city_slug?: string;
          closed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          event_date?: string | null;
          event_slug?: string | null;
          expires_at?: string;
          guest_band?: string | null;
          id?: string;
          note?: string;
          proposal_count?: number;
          status?: string;
          updated_at?: string;
          wedding_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'wedding_requests_category_slug_fkey';
            columns: ['category_slug'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['slug'];
          },
          {
            foreignKeyName: 'wedding_requests_city_slug_fkey';
            columns: ['city_slug'];
            isOneToOne: false;
            referencedRelation: 'cities';
            referencedColumns: ['slug'];
          },
          {
            foreignKeyName: 'wedding_requests_event_slug_fkey';
            columns: ['event_slug'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['slug'];
          },
          {
            foreignKeyName: 'wedding_requests_wedding_id_fkey';
            columns: ['wedding_id'];
            isOneToOne: false;
            referencedRelation: 'weddings';
            referencedColumns: ['id'];
          },
        ];
      };
      wedding_sides: {
        Row: {
          created_at: string;
          home_city_slug: string | null;
          id: string;
          label: string;
          side_key: string;
          updated_at: string;
          wedding_id: string;
        };
        Insert: {
          created_at?: string;
          home_city_slug?: string | null;
          id?: string;
          label: string;
          side_key: string;
          updated_at?: string;
          wedding_id: string;
        };
        Update: {
          created_at?: string;
          home_city_slug?: string | null;
          id?: string;
          label?: string;
          side_key?: string;
          updated_at?: string;
          wedding_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'wedding_sides_home_city_slug_fkey';
            columns: ['home_city_slug'];
            isOneToOne: false;
            referencedRelation: 'cities';
            referencedColumns: ['slug'];
          },
          {
            foreignKeyName: 'wedding_sides_wedding_id_fkey';
            columns: ['wedding_id'];
            isOneToOne: false;
            referencedRelation: 'weddings';
            referencedColumns: ['id'];
          },
        ];
      };
      wedding_slots: {
        Row: {
          book_by: string | null;
          category_slug: string;
          created_at: string;
          id: string;
          note: string | null;
          quantity: number;
          updated_at: string;
          wedding_event_id: string;
        };
        Insert: {
          book_by?: string | null;
          category_slug: string;
          created_at?: string;
          id?: string;
          note?: string | null;
          quantity?: number;
          updated_at?: string;
          wedding_event_id: string;
        };
        Update: {
          book_by?: string | null;
          category_slug?: string;
          created_at?: string;
          id?: string;
          note?: string | null;
          quantity?: number;
          updated_at?: string;
          wedding_event_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'wedding_slots_category_slug_fkey';
            columns: ['category_slug'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['slug'];
          },
          {
            foreignKeyName: 'wedding_slots_wedding_event_id_fkey';
            columns: ['wedding_event_id'];
            isOneToOne: false;
            referencedRelation: 'wedding_events';
            referencedColumns: ['id'];
          },
        ];
      };
      weddings: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          title: string | null;
          updated_at: string;
          wedding_date: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          title?: string | null;
          updated_at?: string;
          wedding_date?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          title?: string | null;
          updated_at?: string;
          wedding_date?: string | null;
        };
        Relationships: [];
      };
      zip_codes: {
        Row: {
          city_slug: string | null;
          latitude: number;
          location: unknown;
          longitude: number;
          zip: string;
        };
        Insert: {
          city_slug?: string | null;
          latitude: number;
          location?: never;
          longitude: number;
          zip: string;
        };
        Update: {
          city_slug?: string | null;
          latitude?: number;
          location?: never;
          longitude?: number;
          zip?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'zip_codes_city_slug_fkey';
            columns: ['city_slug'];
            isOneToOne: false;
            referencedRelation: 'cities';
            referencedColumns: ['slug'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_group_invite: { Args: { p_token: string }; Returns: string };
      accept_vault_invite: { Args: { p_token: string }; Returns: string };
      accept_wedding_invite: { Args: { p_token: string }; Returns: string };
      add_group_members: {
        Args: { p_thread_id: string; p_user_ids: string[] };
        Returns: undefined;
      };
      add_reel_comment: { Args: { p_body: string; p_reel_id: string }; Returns: string };
      add_vault_item: {
        Args: {
          p_duration_ms?: number;
          p_event_slug?: string;
          p_height: number;
          p_item_id: string;
          p_kind: string;
          p_path: string;
          p_taken_at?: string;
          p_thumb_path?: string;
          p_vault_id: string;
          p_width: number;
        };
        Returns: string;
      };
      add_vendor_photo: {
        Args: {
          p_event_slug?: string;
          p_height: number;
          p_photo_id: string;
          p_vendor_id: string;
          p_width: number;
        };
        Returns: string;
      };
      answer_proposal: { Args: { p_accept: boolean; p_proposal_id: string }; Returns: string };
      attach_payment_intent: {
        Args: { p_deposit_id: string; p_payment_intent_id: string };
        Returns: undefined;
      };
      business_checklist: {
        Args: { p_vendor_id: string };
        Returns: {
          count: number;
          done: boolean;
          key: string;
        }[];
      };
      business_export: { Args: { p_vendor_id: string }; Returns: Json };
      business_insights: {
        Args: { p_from: string; p_to: string; p_vendor_id: string };
        Returns: Json;
      };
      business_leads: {
        Args: { p_before?: string; p_limit?: number; p_vendor_id: string };
        Returns: {
          conversation_id: string;
          created_at: string;
          details: Json;
          email: string;
          event_date: string;
          event_slugs: string[];
          family_name: string;
          guest_band: string;
          id: string;
          is_tour: boolean;
          location: string;
          message: string;
          phone: string;
          preferred_contact: string;
          replied: boolean;
          start_time: string;
        }[];
      };
      business_reels: {
        Args: { p_vendor_id: string };
        Returns: {
          caption: string;
          comments: number;
          created_at: string;
          id: string;
          likes: number;
          own: boolean;
          thumb_path: string;
          views: number;
        }[];
      };
      business_stats: {
        Args: { p_from: string; p_to: string; p_vendor_id: string };
        Returns: {
          calls: number;
          contacts: number;
          directions: number;
          inquiries: number;
          instagram: number;
          reel_views: number;
          saves: number;
          shares: number;
          texts: number;
          views: number;
          website: number;
          whatsapps: number;
        }[];
      };
      cancel_deposit: { Args: { p_deposit_id: string }; Returns: undefined };
      claim_chat_notifications: {
        Args: { p_quiet_minutes?: number };
        Returns: {
          conversation_id: string;
          family_name: string;
          last_body: string;
          last_kind: string;
          notified_at: string;
          notify_side: string;
          recipients: string[];
          unread_count: number;
          vendor_has_account: boolean;
          vendor_name: string;
          vendor_slug: string;
        }[];
      };
      claim_group_notifications: {
        Args: { p_quiet_minutes?: number };
        Returns: {
          last_body: string;
          last_kind: string;
          last_sender_name: string;
          notified_at: string;
          recipient: string;
          thread_id: string;
          thread_name: string;
          unread_count: number;
          user_id: string;
          wedding_title: string;
        }[];
      };
      claim_group_push: {
        Args: Record<PropertyKey, never>;
        Returns: {
          body: string;
          kind: string;
          message_id: string;
          sender_name: string;
          thread_id: string;
          thread_name: string;
          tokens: string[];
        }[];
      };
      claim_push_messages: {
        Args: Record<PropertyKey, never>;
        Returns: {
          body: string;
          conversation_id: string;
          data: Json;
          event_names: string[];
          kind: string;
          message_id: string;
          recipient_side: string;
          title: string;
          tokens: string[];
        }[];
      };
      claim_wed_asks: {
        Args: { p_limit?: number };
        Returns: {
          all_in_wedding: boolean;
          asker_name: string;
          body: string;
          context: Json;
          message_id: string;
          thread_id: string;
          wedding_id: string;
        }[];
      };
      close_request: { Args: { p_booked?: boolean; p_request_id: string }; Returns: undefined };
      create_group_invite: { Args: { p_thread_id: string }; Returns: string };
      create_group_thread: {
        Args: { p_member_ids?: string[]; p_name: string; p_wedding_id: string };
        Returns: string;
      };
      create_inquiry: {
        Args: {
          p_details: Json;
          p_event_date: string;
          p_event_slugs: string[];
          p_guest_band: string;
          p_language: string;
          p_location: string;
          p_message: string;
          p_preferred_contact: string;
          p_send_again?: boolean;
          p_sender_email: string;
          p_sender_name: string;
          p_sender_phone: string;
          p_start_time: string;
          p_user_id: string;
          p_vendor_id: string;
        };
        Returns: Json;
      };
      create_linked_reel: {
        Args: {
          p_caption?: string;
          p_consent?: boolean;
          p_credit_name?: string;
          p_event_slug?: string;
          p_url: string;
          p_vendor_id?: string;
          p_vendor_ids?: string[];
        };
        Returns: string;
      };
      create_reel: {
        Args: {
          p_caption: string;
          p_consent: boolean;
          p_duration_s: number;
          p_event_slug: string;
          p_height: number;
          p_thumb_path: string;
          p_vendor_id: string;
          p_vendor_ids: string[];
          p_video_path: string;
          p_width: number;
        };
        Returns: string;
      };
      create_story: {
        Args: {
          p_caption: string;
          p_consent: boolean;
          p_duration_s: number;
          p_height: number;
          p_kind: string;
          p_media_path: string;
          p_thumb_path: string;
          p_vendor_id: string;
          p_width: number;
        };
        Returns: string;
      };
      create_vault_invite: { Args: { p_vault_id: string }; Returns: string };
      create_wedding: {
        Args: {
          p_booked?: Json;
          p_cultures?: string[];
          p_events?: string[];
          p_guests?: Json;
          p_planning_for?: string;
          p_title?: string;
          p_wedding_date?: string;
        };
        Returns: string;
      };
      create_wedding_invite: { Args: { p_role?: string; p_wedding_id: string }; Returns: string };
      decide_reel_tag: {
        Args: { p_approve: boolean; p_reel_id: string; p_vendor_id: string };
        Returns: undefined;
      };
      deposit_for_payment: {
        Args: { p_deposit_id: string; p_user_id: string };
        Returns: {
          amount_cents: number;
          currency: string;
          event_name: string;
          status: string;
          stripe_account_id: string;
          stripe_payment_intent_id: string;
          vendor_name: string;
        }[];
      };
      expired_stories: {
        Args: { p_limit?: number };
        Returns: {
          id: string;
          media_path: string;
          thumb_path: string;
        }[];
      };
      families_looking: {
        Args: {
          p_before?: string;
          p_category_slug?: string;
          p_from?: string;
          p_limit?: number;
          p_max_miles?: number;
          p_to?: string;
          p_vendor_id: string;
        };
        Returns: {
          already_proposed: boolean;
          budget_max_cents: number;
          budget_min_cents: number;
          category_name: Json;
          category_slug: string;
          city: string;
          created_at: string;
          date_status: string;
          event_date: string;
          event_name: Json;
          event_slug: string;
          family_name: string;
          guest_band: string;
          id: string;
          is_sample: boolean;
          miles: number;
          note: string;
          proposal_count: number;
          proposals_full: boolean;
        }[];
      };
      families_looking_summary: {
        Args: { p_vendor_id: string };
        Returns: {
          category_name: Json;
          category_slug: string;
          open_requests: number;
        }[];
      };
      group_invite_preview: {
        Args: { p_token: string };
        Returns: {
          inviter_name: string;
          member_count: number;
          status: string;
          thread_name: string;
          wedding_title: string;
        }[];
      };
      group_members_list: {
        Args: { p_thread_id: string };
        Returns: {
          can_manage: boolean;
          is_me: boolean;
          joined_at: string;
          name: string;
          user_id: string;
          wedding_role: string;
        }[];
      };
      hide_reel_comment: { Args: { p_comment_id: string }; Returns: undefined };
      hide_vault_item: { Args: { p_hidden?: boolean; p_item_id: string }; Returns: undefined };
      inquiry_emails_left_today: { Args: Record<PropertyKey, never>; Returns: number };
      mark_conversation_read: { Args: { p_conversation_id: string }; Returns: undefined };
      mark_group_read: { Args: { p_thread_id: string }; Returns: undefined };
      memory_vault: {
        Args: { p_vault_id?: string; p_wedding_id?: string };
        Returns: {
          can_add: boolean;
          events: Json;
          guest_count: number;
          guests_see_all: boolean;
          id: string;
          item_count: number;
          my_item_count: number;
          my_role: string;
          show_vendors: boolean;
          title: string;
          uploads_open: boolean;
          wedding_date: string;
          wedding_id: string;
        }[];
      };
      my_businesses: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: string;
          name: string;
          role: string;
          slug: string;
          status: string;
        }[];
      };
      my_conversations: {
        Args: Record<PropertyKey, never>;
        Returns: {
          family_name: string;
          id: string;
          last_body: string;
          last_kind: string;
          last_message_at: string;
          last_sender_role: string;
          other_read_at: string;
          side: string;
          unread_count: number;
          vendor_cover_path: string;
          vendor_id: string;
          vendor_name: string;
          vendor_slug: string;
        }[];
      };
      my_group_threads: {
        Args: Record<PropertyKey, never>;
        Returns: {
          can_manage: boolean;
          id: string;
          last_body: string;
          last_kind: string;
          last_message_at: string;
          last_sender_is_me: boolean;
          last_sender_name: string;
          last_sender_role: string;
          member_count: number;
          name: string;
          unread_count: number;
          wedding_id: string;
        }[];
      };
      my_listing: { Args: { p_vendor_id: string }; Returns: Json };
      my_vaults: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: string;
          item_count: number;
          last_item_at: string;
          my_item_count: number;
          my_role: string;
          title: string;
          uploads_open: boolean;
          wedding_date: string;
          wedding_id: string;
        }[];
      };
      open_memory_vault: { Args: { p_wedding_id: string }; Returns: string };
      orphan_vault_files: {
        Args: { p_limit?: number };
        Returns: {
          name: string;
        }[];
      };
      pending_reel_tags: {
        Args: { p_vendor_id: string };
        Returns: {
          author_name: string;
          caption: string;
          created_at: string;
          reel_id: string;
          thumb_path: string;
        }[];
      };
      post_request: {
        Args: {
          p_budget_max_cents?: number;
          p_budget_min_cents?: number;
          p_category_slug: string;
          p_city_slug: string;
          p_event_date?: string;
          p_event_slug?: string;
          p_guest_band?: string;
          p_note: string;
          p_wedding_id: string;
        };
        Returns: string;
      };
      post_wed_reply: {
        Args: { p_body: string; p_data?: Json; p_message_id: string };
        Returns: string;
      };
      react_to_message: { Args: { p_message_id: string; p_reaction?: string }; Returns: undefined };
      react_to_vendor: {
        Args: { p_reaction: string; p_vendor_id: string; p_wedding_id: string };
        Returns: undefined;
      };
      record_deposit_payment: {
        Args: { p_outcome: string; p_payment_intent_id: string };
        Returns: boolean;
      };
      reel_comments_list: {
        Args: { p_reel_id: string };
        Returns: {
          body: string;
          created_at: string;
          id: string;
          is_mine: boolean;
          name: string;
          user_id: string;
        }[];
      };
      reel_person: {
        Args: { p_user_id: string };
        Returns: {
          blocked: boolean;
          follower_count: number;
          following: boolean;
          following_count: number;
          name: string;
          reel_count: number;
        }[];
      };
      reels_feed: {
        Args: {
          p_before?: string;
          p_event_slug?: string;
          p_limit?: number;
          p_mode?: string;
          p_user_id?: string;
          p_vendor_id?: string;
        };
        Returns: {
          author_id: string;
          author_name: string;
          caption: string;
          comment_count: number;
          created_at: string;
          credit_name: string;
          duration_s: number;
          event_slug: string;
          following: boolean;
          height: number;
          id: string;
          is_mine: boolean;
          is_sample: boolean;
          like_count: number;
          liked: boolean;
          platform: string;
          source: string;
          source_url: string;
          tags: Json;
          thumb_path: string;
          vendor_id: string;
          vendor_name: string;
          vendor_slug: string;
          video_path: string;
          width: number;
        }[];
      };
      refuse_password_sign_in: { Args: { event: Json }; Returns: Json };
      register_push_token: { Args: { p_platform: string; p_token: string }; Returns: undefined };
      remove_group_member: { Args: { p_thread_id: string; p_user_id: string }; Returns: undefined };
      remove_vault_guest: { Args: { p_user_id: string; p_vault_id: string }; Returns: undefined };
      remove_vault_item: { Args: { p_item_id: string }; Returns: undefined };
      remove_vendor_photo: { Args: { p_media_id: string }; Returns: string };
      remove_wedding_member: {
        Args: { p_user_id: string; p_wedding_id: string };
        Returns: undefined;
      };
      rename_group_thread: { Args: { p_name: string; p_thread_id: string }; Returns: undefined };
      reorder_vendor_photos: {
        Args: { p_media_ids: string[]; p_vendor_id: string };
        Returns: undefined;
      };
      report_reel_content: {
        Args: {
          p_comment_id?: string;
          p_note?: string;
          p_reason?: string;
          p_reel_id?: string;
          p_story_id?: string;
          p_user_id?: string;
        };
        Returns: undefined;
      };
      request_deposit: {
        Args: {
          p_amount_cents: number;
          p_conversation_id: string;
          p_event_slug?: string;
          p_note?: string;
        };
        Returns: string;
      };
      request_proposals_for: {
        Args: { p_request_id: string };
        Returns: {
          conversation_id: string;
          cover_path: string;
          created_at: string;
          founding_number: number;
          id: string;
          menu_id: string;
          note: string;
          price_cents: number;
          price_unit: string;
          reel_id: string;
          status: string;
          vendor_city: string;
          vendor_id: string;
          vendor_is_sample: boolean;
          vendor_name: string;
          vendor_slug: string;
        }[];
      };
      resolve_suggestion: {
        Args: { p_accept: boolean; p_suggestion_id: string };
        Returns: undefined;
      };
      revoke_vault_invite: { Args: { p_vault_id: string }; Returns: undefined };
      save_payment_account: {
        Args: {
          p_charges_enabled: boolean;
          p_details_submitted: boolean;
          p_livemode: boolean;
          p_stripe_account_id: string;
          p_vendor_id: string;
        };
        Returns: undefined;
      };
      save_vendor: { Args: { p_event_slug?: string; p_vendor_id: string }; Returns: string };
      search_vendors: {
        Args: {
          available_on?: string;
          category_slug?: string;
          event_slug?: string;
          include_travelers?: boolean;
          language?: string;
          lat?: number;
          lng?: number;
          max_miles?: number;
          max_price?: number;
          min_guests?: number;
          query?: string;
          result_limit?: number;
          result_offset?: number;
          sort?: string;
        };
        Returns: {
          city: string;
          cover_path: string;
          distance_miles: number;
          founding_number: number;
          id: string;
          is_sample: boolean;
          latitude: number;
          longitude: number;
          name: string;
          price_display: string;
          price_from: number;
          price_to: number;
          price_unit: string;
          primary_category_name: Json;
          primary_category_slug: string;
          slug: string;
          within_search_radius: boolean;
        }[];
      };
      send_group_message: {
        Args: { p_body?: string; p_photo?: Json; p_reply_to?: string; p_thread_id: string };
        Returns: string;
      };
      send_message: {
        Args: {
          p_body?: string;
          p_conversation_id: string;
          p_data?: Json;
          p_kind?: string;
          p_reply_to?: string;
        };
        Returns: string;
      };
      send_proposal: {
        Args: {
          p_menu_id?: string;
          p_note: string;
          p_price_cents?: number;
          p_price_unit?: string;
          p_reel_id?: string;
          p_request_id: string;
          p_vendor_id: string;
        };
        Returns: string;
      };
      set_booked: {
        Args: {
          p_booked: boolean;
          p_category_slug: string;
          p_event_slug: string;
          p_wedding_id: string;
        };
        Returns: undefined;
      };
      set_vault_settings: {
        Args: {
          p_guests_see_all?: boolean;
          p_show_vendors?: boolean;
          p_uploads_open?: boolean;
          p_vault_id: string;
        };
        Returns: undefined;
      };
      set_vendor_cover: { Args: { p_media_id: string }; Returns: undefined };
      set_wedding_cultures: {
        Args: { p_culture_slugs: string[]; p_wedding_id: string };
        Returns: undefined;
      };
      set_wedding_member_role: {
        Args: { p_role: string; p_user_id: string; p_wedding_id: string };
        Returns: undefined;
      };
      start_conversation: { Args: { p_vendor_id: string }; Returns: string };
      start_my_business: {
        Args: { p_category_slug: string; p_city_slug: string; p_name: string };
        Returns: Json;
      };
      stories_feed: {
        Args: Record<PropertyKey, never>;
        Returns: {
          author_id: string;
          author_name: string;
          caption: string;
          created_at: string;
          duration_s: number;
          following: boolean;
          height: number;
          id: string;
          is_mine: boolean;
          is_sample: boolean;
          kind: string;
          media_path: string;
          thumb_path: string;
          vendor_id: string;
          vendor_name: string;
          vendor_slug: string;
          width: number;
        }[];
      };
      suggest_vendor: {
        Args: {
          p_category_slug: string;
          p_event_slug: string;
          p_note?: string;
          p_vendor_id: string;
          p_wedding_id: string;
        };
        Returns: string;
      };
      tag_vendor_photo: { Args: { p_event_slug?: string; p_media_id: string }; Returns: undefined };
      touch_vendor_calendar: { Args: { p_vendor_id: string }; Returns: undefined };
      track_reel_view: { Args: { p_reel_id: string }; Returns: undefined };
      track_search_appearances: { Args: { p_vendor_ids: string[] }; Returns: undefined };
      track_vendor_activity: { Args: { p_kind: string; p_vendor_id: string }; Returns: undefined };
      unregister_push_token: { Args: { p_token: string }; Returns: undefined };
      update_my_listing: { Args: { p_changes: Json; p_vendor_id: string }; Returns: Json };
      update_payment_account: {
        Args: {
          p_charges_enabled: boolean;
          p_details_submitted: boolean;
          p_stripe_account_id: string;
        };
        Returns: undefined;
      };
      vault_invite_preview: {
        Args: { p_token: string };
        Returns: {
          events: Json;
          inviter_name: string;
          item_count: number;
          status: string;
          title: string;
          vault_id: string;
        }[];
      };
      vault_items: {
        Args: {
          p_before_at?: string;
          p_before_id?: string;
          p_event_slug?: string;
          p_limit?: number;
          p_vault_id: string;
        };
        Returns: {
          added_by_name: string;
          created_at: string;
          duration_ms: number;
          event_slug: string;
          height: number;
          hidden: boolean;
          id: string;
          is_mine: boolean;
          kind: string;
          path: string;
          taken_at: string;
          thumb_path: string;
          user_id: string;
          width: number;
        }[];
      };
      vault_vendors: {
        Args: { p_vault_id: string };
        Returns: {
          category_slugs: string[];
          city: string;
          event_slugs: string[];
          is_sample: boolean;
          name: string;
          slug: string;
          vendor_id: string;
        }[];
      };
      vendor_date_status: { Args: { p_day: string; p_vendor_id: string }; Returns: string };
      vendor_public_stats: {
        Args: { p_vendor_id: string };
        Returns: {
          answered: number;
          booked_by: number;
          replied: number;
          saved_by: number;
        }[];
      };
      vendor_scorecard: {
        Args: { p_from: string; p_to: string; p_vendor_id: string };
        Returns: {
          answered: number;
          calls: number;
          directions: number;
          inquiries: number;
          instagram: number;
          replied: number;
          saves: number;
          shares: number;
          texts: number;
          views: number;
          website: number;
          whatsapps: number;
        }[];
      };
      wedding_invite_preview: {
        Args: { p_token: string };
        Returns: {
          inviter_name: string;
          role: string;
          status: string;
          title: string;
          wedding_date: string;
        }[];
      };
      wedding_members_list: {
        Args: { p_wedding_id: string };
        Returns: {
          is_me: boolean;
          joined_at: string;
          name: string;
          role: string;
          user_id: string;
        }[];
      };
      wedding_shortlist: {
        Args: { p_wedding_id: string };
        Returns: {
          city: string;
          event_slugs: string[];
          loved_by: string[];
          loves: number;
          maybes: number;
          my_reaction: string;
          name: string;
          nos: number;
          published: boolean;
          saved_by: string[];
          slug: string;
          vendor_id: string;
        }[];
      };
      withdraw_proposal: { Args: { p_proposal_id: string }; Returns: undefined };
      withdraw_suggestion: { Args: { p_suggestion_id: string }; Returns: undefined };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
