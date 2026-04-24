// Hand-written Supabase types for the Haven Ring schema.
// If the schema in `docs/database-schema.md` changes, update this file in the
// same commit. (You can also regenerate with `supabase gen types typescript`.)
//
// Note: we use `type` aliases (not `interface`) for the Row shapes so that they
// remain assignable to `Record<string, unknown>`, which Supabase's generic
// schema constraints require.

export type RingStatus = "unclaimed" | "active" | "revoked";
export type HavenMemberRole = "owner" | "member";

export type RingRow = {
  id: string;
  haven_id: string | null;
  owner_id: string | null;
  status: RingStatus;
  token_hash: string;
  created_at: string;
  claimed_at: string | null;
};

export type MomentRow = {
  id: string;
  haven_id: string | null;
  ring_id: string;
  text: string | null;
  image_url: string | null;
  audio_url: string | null;
  encrypted_vault: string;
  iv: string;
  is_sealed: boolean;
  created_at: string;
  sealed_at: string | null;
};

export type HavenRow = {
  id: string;
  created_by: string;
  created_at: string;
};

export type HavenMemberRow = {
  id: string;
  haven_id: string;
  user_id: string;
  role: HavenMemberRole;
  created_at: string;
};

export type RingInviteRow = {
  id: string;
  haven_id: string;
  created_by: string;
  invite_hash: string;
  expires_at: string;
  consumed_by: string | null;
  consumed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
};

export type RingEventAction =
  | "claim"
  | "ring_link_request"
  | "ring_link_approved"
  | "ring_link_rejected"
  | "token_issue"
  | "token_revoke"
  | "wipe";

export type RingEventRow = {
  id: string;
  ring_id: string;
  actor_user_id: string | null;
  action: RingEventAction;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      rings: {
        Row: RingRow;
        Insert: {
          id?: string;
          haven_id?: string | null;
          owner_id?: string | null;
          status?: RingStatus;
          token_hash: string;
          created_at?: string;
          claimed_at?: string | null;
        };
        Update: Partial<RingRow>;
        Relationships: [
          {
            foreignKeyName: "rings_haven_id_fkey";
            columns: ["haven_id"];
            isOneToOne: false;
            referencedRelation: "havens";
            referencedColumns: ["id"];
          },
        ];
      };
      havens: {
        Row: HavenRow;
        Insert: {
          id?: string;
          created_by: string;
          created_at?: string;
        };
        Update: Partial<HavenRow>;
        Relationships: [];
      };
      haven_members: {
        Row: HavenMemberRow;
        Insert: {
          id?: string;
          haven_id: string;
          user_id: string;
          role?: HavenMemberRole;
          created_at?: string;
        };
        Update: Partial<HavenMemberRow>;
        Relationships: [
          {
            foreignKeyName: "haven_members_haven_id_fkey";
            columns: ["haven_id"];
            isOneToOne: false;
            referencedRelation: "havens";
            referencedColumns: ["id"];
          },
        ];
      };
      ring_invites: {
        Row: RingInviteRow;
        Insert: {
          id?: string;
          haven_id: string;
          created_by: string;
          invite_hash: string;
          expires_at: string;
          consumed_by?: string | null;
          consumed_at?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
        };
        Update: Partial<RingInviteRow>;
        Relationships: [
          {
            foreignKeyName: "ring_invites_haven_id_fkey";
            columns: ["haven_id"];
            isOneToOne: false;
            referencedRelation: "havens";
            referencedColumns: ["id"];
          },
        ];
      };
      moments: {
        Row: MomentRow;
        Insert: {
          id?: string;
          haven_id?: string | null;
          ring_id: string;
          text?: string | null;
          image_url?: string | null;
          audio_url?: string | null;
          encrypted_vault: string;
          iv: string;
          is_sealed?: boolean;
          created_at?: string;
          sealed_at?: string | null;
        };
        Update: Partial<MomentRow>;
        Relationships: [
          {
            foreignKeyName: "moments_haven_id_fkey";
            columns: ["haven_id"];
            isOneToOne: false;
            referencedRelation: "havens";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "moments_ring_id_fkey";
            columns: ["ring_id"];
            isOneToOne: false;
            referencedRelation: "rings";
            referencedColumns: ["id"];
          },
        ];
      };
      ring_events: {
        Row: RingEventRow;
        Insert: {
          id?: string;
          ring_id: string;
          actor_user_id?: string | null;
          action: RingEventAction;
          metadata?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: Partial<RingEventRow>;
        Relationships: [
          {
            foreignKeyName: "ring_events_ring_id_fkey";
            columns: ["ring_id"];
            isOneToOne: false;
            referencedRelation: "rings";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      seal_moment: {
        Args: { p_ring_id: string; p_token: string };
        Returns: MomentRow;
      };
      resolve_ring_by_token: {
        Args: { p_token: string };
        Returns: string;
      };
      resolve_haven_by_token: {
        Args: { p_token: string };
        Returns: { haven_id: string; ring_id: string }[];
      };
      wipe_ring: {
        Args: { p_ring_id: string; p_token: string };
        Returns: null;
      };
      claim_ring_by_token: {
        Args: { p_token: string };
        Returns: RingRow;
      };
      rotate_ring_token: {
        Args: { p_ring_id: string };
        Returns: { ring_id: string; token: string }[];
      };
      revoke_ring_token: {
        Args: { p_ring_id: string };
        Returns: null;
      };
      issue_ring_invite: {
        Args: { p_haven_id: string };
        Returns: { invite_code: string; expires_at: string }[];
      };
      link_ring_by_invite: {
        Args: { p_token: string; p_invite_code: string };
        Returns: { haven_id: string; ring_id: string }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
