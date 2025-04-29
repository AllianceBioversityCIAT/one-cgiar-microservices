export interface StarRole {
  sec_role_id: number;
  name: string;
  focus_id: number;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  justification_update: string | null;
}

export interface StarUserRole {
  sec_user_role_id: number;
  user_id: number;
  role_id: number;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  role: StarRole;
}

export interface StarUser {
  sec_user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  status_id: number;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  user_role_list: StarUserRole[];
}

export interface StarTokenValidationResponse {
  isValid: boolean;
  user?: StarUser;
}
