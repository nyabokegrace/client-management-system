export type UserRole = 'admin' | 'advocate' | 'staff';

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: UserRole;
  phone_number?: string;
  is_active: boolean;
  created_at: string;
}

export type ClientType = 'individual' | 'organization';
export type ClientStatus = 'active' | 'inactive' | 'archived';

export interface Client {
  id: number;
  client_reference: string;
  client_type: ClientType;
  display_name: string;
  first_name?: string;
  last_name?: string;
  national_id?: string;
  organization_name?: string;
  registration_number?: string;
  primary_contact_person?: string;
  email?: string;
  phone_number: string;
  alternate_phone?: string;
  postal_address?: string;
  physical_address?: string;
  assigned_advocate?: number | null;
  assigned_advocate_details?: User | null;
  status: ClientStatus;
  internal_notes?: string;
  created_by?: number | null;
  created_by_name?: string;
  matters_count?: number;
  created_at: string;
  updated_at: string;
}

export type MatterStatus =
  | 'new'
  | 'active'
  | 'pending'
  | 'awaiting_client'
  | 'awaiting_court'
  | 'concluded'
  | 'archived';

export type MatterPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Matter {
  id: number;
  matter_reference: string;
  title: string;
  client: number;
  client_name?: string;
  client_reference?: string;
  client_details?: Client;
  matter_type: string;
  matter_type_display?: string;
  description?: string;
  status: MatterStatus;
  status_display?: string;
  priority: MatterPriority;
  priority_display?: string;
  assigned_advocate?: number | null;
  assigned_advocate_name?: string;
  assigned_advocate_details?: User | null;
  supporting_staff?: number[];
  supporting_staff_details?: User[];
  court?: string;
  case_number?: string;
  opposing_party?: string;
  opposing_advocate?: string;
  date_opened: string;
  date_closed?: string | null;
  internal_notes?: string;
  updates_count?: number;
  documents_count?: number;
  hearings_count?: number;
  tasks_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: number;
  title: string;
  category: string;
  category_display?: string;
  confidentiality: 'standard' | 'confidential' | 'restricted';
  confidentiality_display?: string;
  client: number;
  client_name?: string;
  matter?: number | null;
  matter_title?: string;
  matter_reference?: string;
  original_filename: string;
  file_type: string;
  file_size_bytes: number;
  file_size_display: string;
  description?: string;
  uploaded_by?: number | null;
  uploaded_by_details?: User | null;
  created_at: string;
  updated_at: string;
}

export interface CaseUpdate {
  id: number;
  matter: number;
  matter_title?: string;
  matter_reference?: string;
  title: string;
  description: string;
  category: string;
  category_display?: string;
  event_datetime: string;
  author?: number | null;
  author_details?: User | null;
  author_name?: string;
  created_at: string;
  updated_at: string;
}

export interface Hearing {
  id: number;
  matter: number;
  matter_title?: string;
  matter_reference?: string;
  client_name?: string;
  hearing_type: string;
  hearing_type_display?: string;
  hearing_date: string;
  court?: string;
  court_case_number?: string;
  location_details?: string;
  assigned_advocate?: number | null;
  assigned_advocate_details?: User | null;
  assigned_advocate_name?: string;
  status: 'scheduled' | 'completed' | 'adjourned' | 'cancelled';
  status_display?: string;
  notes?: string;
  outcome_summary?: string;
  next_hearing_date?: string | null;
  created_at: string;
  updated_at: string;
}

export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'cancelled';

export interface Task {
  id: number;
  title: string;
  description?: string;
  client?: number | null;
  client_name?: string;
  matter?: number | null;
  matter_title?: string;
  matter_reference?: string;
  assigned_to?: number | null;
  assigned_to_details?: User | null;
  assigned_to_name?: string;
  priority: TaskPriority;
  priority_display?: string;
  status: TaskStatus;
  status_display?: string;
  due_date?: string | null;
  is_overdue: boolean;
  completed_at?: string | null;
  created_by?: number | null;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: number;
  actor?: number | null;
  actor_name: string;
  action: string;
  action_display?: string;
  module: string;
  module_display?: string;
  target_id: string;
  target_repr: string;
  details: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
}

export interface DashboardSummary {
  kpis: {
    active_matters: number;
    registered_clients: number;
    upcoming_hearings: number;
    overdue_tasks: number;
  };
  upcoming_hearings: Hearing[];
  tasks_requiring_attention: Task[];
  recently_updated_matters: Matter[];
  recent_case_updates: CaseUpdate[];
  recent_activity: AuditLog[];
}
