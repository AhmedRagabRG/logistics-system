export interface Admin {
  id: number;
  username: string;
  display_name: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface AdminSafe {
  id: number;
  username: string;
  display_name: string | null;
}

export interface Session {
  id: number;
  session_token: string;
  admin_id: number;
  ip_address: string | null;
  user_agent: string | null;
  expires_at: Date;
  last_activity_at: Date;
  created_at: Date;
}

export interface AuthResult {
  success: boolean;
  admin?: AdminSafe;
  error?: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface SessionValidationResult {
  valid: boolean;
  admin?: AdminSafe;
  expires_at?: Date;
}
