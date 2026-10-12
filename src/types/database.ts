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
          aliases: string[];
          area_code: string;
          census_geoid: string | null;
          created_at: string;
          latitude: number;
          location: unknown;
          longitude: number;
          name: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          aliases?: string[];
          area_code: string;
          census_geoid?: string | null;
          created_at?: string;
          latitude: number;
          location?: never;
          longitude: number;
          name: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          aliases?: string[];
          area_code?: string;
          census_geoid?: string | null;
          created_at?: string;
          latitude?: number;
          location?: never;
          longitude?: number;
          name?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
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
          script: string;
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
          script: string;
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
          script?: string;
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
          phone: string;
          updated_at: string;
        };
        Insert: {
          adult_confirmed_at?: string;
          city: string;
          created_at?: string;
          full_name: string;
          id: string;
          phone: string;
          updated_at?: string;
        };
        Update: {
          adult_confirmed_at?: string;
          city?: string;
          created_at?: string;
          full_name?: string;
          id?: string;
          phone?: string;
          updated_at?: string;
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
      saved_vendors: {
        Row: {
          created_at: string;
          event_slug: string | null;
          id: string;
          user_id: string;
          vendor_id: string;
        };
        Insert: {
          created_at?: string;
          event_slug?: string | null;
          id?: string;
          user_id?: string;
          vendor_id: string;
        };
        Update: {
          created_at?: string;
          event_slug?: string | null;
          id?: string;
          user_id?: string;
          vendor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'saved_vendors_event_slug_fkey';
            columns: ['event_slug'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['slug'];
          },
          {
            foreignKeyName: 'saved_vendors_vendor_id_fkey';
            columns: ['vendor_id'];
            isOneToOne: false;
            referencedRelation: 'vendors';
            referencedColumns: ['id'];
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
          description_pa: string | null;
          diet: string[];
          id: string;
          min_guests: number | null;
          name: string;
          name_pa: string | null;
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
          description_pa?: string | null;
          diet?: string[];
          id?: string;
          min_guests?: number | null;
          name: string;
          name_pa?: string | null;
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
          description_pa?: string | null;
          diet?: string[];
          id?: string;
          min_guests?: number | null;
          name?: string;
          name_pa?: string | null;
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
          bio_pa: string | null;
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
          name_pa: string | null;
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
          tagline_pa: string | null;
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
          bio_pa?: string | null;
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
          name_pa?: string | null;
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
          tagline_pa?: string | null;
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
          bio_pa?: string | null;
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
          name_pa?: string | null;
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
          tagline_pa?: string | null;
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
      wedding_bookings: {
        Row: {
          category_slug: string;
          created_at: string;
          event_slug: string;
          note: string | null;
          updated_at: string;
          updated_by: string | null;
          vendor_id: string | null;
          wedding_id: string;
        };
        Insert: {
          category_slug: string;
          created_at?: string;
          event_slug: string;
          note?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          vendor_id?: string | null;
          wedding_id: string;
        };
        Update: {
          category_slug?: string;
          created_at?: string;
          event_slug?: string;
          note?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          vendor_id?: string | null;
          wedding_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'wedding_bookings_category_slug_fkey';
            columns: ['category_slug'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['slug'];
          },
          {
            foreignKeyName: 'wedding_bookings_vendor_id_fkey';
            columns: ['vendor_id'];
            isOneToOne: false;
            referencedRelation: 'vendors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'wedding_bookings_wedding_id_event_slug_fkey';
            columns: ['wedding_id', 'event_slug'];
            isOneToOne: false;
            referencedRelation: 'wedding_events';
            referencedColumns: ['wedding_id', 'event_slug'];
          },
        ];
      };
      wedding_events: {
        Row: {
          created_at: string;
          event_date: string | null;
          event_slug: string;
          guest_band: string | null;
          updated_at: string;
          wedding_id: string;
        };
        Insert: {
          created_at?: string;
          event_date?: string | null;
          event_slug: string;
          guest_band?: string | null;
          updated_at?: string;
          wedding_id: string;
        };
        Update: {
          created_at?: string;
          event_date?: string | null;
          event_slug?: string;
          guest_band?: string | null;
          updated_at?: string;
          wedding_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'wedding_events_event_slug_fkey';
            columns: ['event_slug'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['slug'];
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
          token: string;
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
          token?: string;
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
          token?: string;
          uses?: number;
          wedding_id?: string;
        };
        Relationships: [
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
          invited_by: string | null;
          joined_at: string;
          role: string;
          user_id: string;
          wedding_id: string;
        };
        Insert: {
          invited_by?: string | null;
          joined_at?: string;
          role: string;
          user_id: string;
          wedding_id: string;
        };
        Update: {
          invited_by?: string | null;
          joined_at?: string;
          role?: string;
          user_id?: string;
          wedding_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'wedding_members_wedding_id_fkey';
            columns: ['wedding_id'];
            isOneToOne: false;
            referencedRelation: 'weddings';
            referencedColumns: ['id'];
          },
        ];
      };
      wedding_reactions: {
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
            foreignKeyName: 'wedding_reactions_vendor_id_fkey';
            columns: ['vendor_id'];
            isOneToOne: false;
            referencedRelation: 'vendors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'wedding_reactions_wedding_id_fkey';
            columns: ['wedding_id'];
            isOneToOne: false;
            referencedRelation: 'weddings';
            referencedColumns: ['id'];
          },
        ];
      };
      wedding_suggestions: {
        Row: {
          category_slug: string;
          created_at: string;
          event_slug: string;
          id: string;
          note: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          status: string;
          suggested_by: string | null;
          vendor_id: string;
          wedding_id: string;
        };
        Insert: {
          category_slug: string;
          created_at?: string;
          event_slug: string;
          id?: string;
          note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: string;
          suggested_by?: string | null;
          vendor_id: string;
          wedding_id: string;
        };
        Update: {
          category_slug?: string;
          created_at?: string;
          event_slug?: string;
          id?: string;
          note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: string;
          suggested_by?: string | null;
          vendor_id?: string;
          wedding_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'wedding_suggestions_category_slug_fkey';
            columns: ['category_slug'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['slug'];
          },
          {
            foreignKeyName: 'wedding_suggestions_vendor_id_fkey';
            columns: ['vendor_id'];
            isOneToOne: false;
            referencedRelation: 'vendors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'wedding_suggestions_wedding_id_event_slug_fkey';
            columns: ['wedding_id', 'event_slug'];
            isOneToOne: false;
            referencedRelation: 'wedding_events';
            referencedColumns: ['wedding_id', 'event_slug'];
          },
        ];
      };
      weddings: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          planning_for: string | null;
          title: string | null;
          traditions: string[];
          updated_at: string;
          wedding_date: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          planning_for?: string | null;
          title?: string | null;
          traditions?: string[];
          updated_at?: string;
          wedding_date?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          planning_for?: string | null;
          title?: string | null;
          traditions?: string[];
          updated_at?: string;
          wedding_date?: string | null;
        };
        Relationships: [];
      };
      zip_codes: {
        Row: {
          latitude: number;
          location: unknown;
          longitude: number;
          zip: string;
        };
        Insert: {
          latitude: number;
          location?: never;
          longitude: number;
          zip: string;
        };
        Update: {
          latitude?: number;
          location?: never;
          longitude?: number;
          zip?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_wedding_invite: { Args: { p_token: string }; Returns: string };
      add_reel_comment: { Args: { p_body: string; p_reel_id: string }; Returns: string };
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
      create_wedding: {
        Args: {
          p_booked?: Json;
          p_events?: string[];
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
      hide_reel_comment: { Args: { p_comment_id: string }; Returns: undefined };
      inquiry_emails_left_today: { Args: Record<PropertyKey, never>; Returns: number };
      mark_conversation_read: { Args: { p_conversation_id: string }; Returns: undefined };
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
          vendor_name_pa: string;
          vendor_slug: string;
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
      react_to_message: { Args: { p_message_id: string; p_reaction?: string }; Returns: undefined };
      react_to_vendor: {
        Args: { p_reaction: string; p_vendor_id: string; p_wedding_id: string };
        Returns: undefined;
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
      remove_wedding_member: {
        Args: { p_user_id: string; p_wedding_id: string };
        Returns: undefined;
      };
      report_reel_content: {
        Args: {
          p_comment_id?: string;
          p_note?: string;
          p_reason?: string;
          p_reel_id?: string;
          p_user_id?: string;
        };
        Returns: undefined;
      };
      resolve_suggestion: {
        Args: { p_accept: boolean; p_suggestion_id: string };
        Returns: undefined;
      };
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
          latitude: number;
          longitude: number;
          name: string;
          name_pa: string;
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
      set_wedding_member_role: {
        Args: { p_role: string; p_user_id: string; p_wedding_id: string };
        Returns: undefined;
      };
      start_conversation: { Args: { p_vendor_id: string }; Returns: string };
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
      touch_vendor_calendar: { Args: { p_vendor_id: string }; Returns: undefined };
      track_vendor_activity: { Args: { p_kind: string; p_vendor_id: string }; Returns: undefined };
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
          name_pa: string;
          nos: number;
          published: boolean;
          saved_by: string[];
          slug: string;
          vendor_id: string;
        }[];
      };
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
