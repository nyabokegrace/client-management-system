import {
  User,
  Client,
  Contact,
  Matter,
  Document,
  CaseUpdate,
  Hearing,
  Task,
  AuditLog,
  DashboardSummary,
  ClientReport,
} from '../types';

const API_BASE_URL = '/api/v1';

class ApiClient {
  private getAuthHeader(): Record<string, string> {
    if (typeof window === 'undefined') return {};
    const token = localStorage.getItem('siwolo_token');
    return token ? { Authorization: `Token ${token}` } : {};
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const headers: Record<string, string> = {
      ...this.getAuthHeader(),
      ...((options.headers as Record<string, string>) || {}),
    };

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (res.status === 401 && typeof window !== 'undefined') {
      // Clear token if invalid
      localStorage.removeItem('siwolo_token');
      localStorage.removeItem('siwolo_user');
    }

    if (!res.ok) {
      let errorMsg = `API request failed with status ${res.status}`;
      try {
        const errorData = await res.json();
        errorMsg =
          typeof errorData === 'object'
            ? Object.entries(errorData)
                .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
                .join('; ')
            : String(errorData);
      } catch {
        // fallback
      }
      throw new Error(errorMsg);
    }

    if (res.status === 204) {
      return {} as T;
    }

    return res.json() as Promise<T>;
  }

  // Authentication
  auth = {
    getSetupStatus: async () => {
      return this.request<{
        has_users: boolean;
        needs_setup: boolean;
        setup_required: boolean;
        setup_enabled: boolean;
        firm_name: string;
        advocate_title?: string;
      }>('/auth/setup-status/');
    },
    setup: async (data: { setup_code: string; name: string; email: string; password: string; username?: string }) => {
      return this.request<{
        message: string;
        user_id?: number;
        username?: string;
        otpauth_url?: string;
      }>('/auth/setup/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    setupConfirm: async (data: { code: string; user_id?: number; username?: string }) => {
      const res = await this.request<{
        token: string;
        user: User;
        recovery_codes: string[];
        message: string;
      }>('/auth/setup/confirm/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (res.token && res.user && typeof window !== 'undefined') {
        localStorage.setItem('siwolo_token', res.token);
        localStorage.setItem('siwolo_user', JSON.stringify(res.user));
      }
      return res;
    },
    login: async (credentials: { username: string; password: string }) => {
      const data = await this.request<{
        token?: string;
        user?: User;
        message?: string;
      }>('/auth/login/', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });
      if (data.token && data.user && typeof window !== 'undefined') {
        localStorage.setItem('siwolo_token', data.token);
        localStorage.setItem('siwolo_user', JSON.stringify(data.user));
      }
      return data;
    },
    generateRecoveryCodes: async (password: string) => {
      return this.request<{
        recovery_codes: string[];
        count: number;
        message: string;
      }>('/auth/recovery-codes/generate/', {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
    },
    getRecoveryCodesCount: async () => {
      return this.request<{ remaining: number }>('/auth/recovery-codes/count/');
    },
    logout: async () => {
      try {
        await this.request('/auth/logout/', { method: 'POST' });
      } finally {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('siwolo_token');
          localStorage.removeItem('siwolo_user');
        }
      }
    },
    me: async () => {
      return this.request<User>('/auth/me/');
    },
    updateProfile: async (data: Partial<User>) => {
      const updated = await this.request<User>('/auth/me/', {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      if (typeof window !== 'undefined') {
        localStorage.setItem('siwolo_user', JSON.stringify(updated));
      }
      return updated;
    },
    changePassword: async (data: { old_password: string; new_password: string }) => {
      return this.request<{ message: string }>('/auth/change-password/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
  };

  firmSettings = {
    get: async () => {
      return this.request<{
        firm_name: string;
        advocate_name: string;
        advocate_title: string;
        firm_phone: string;
        firm_email: string;
        firm_address?: string;
      }>('/firm-settings/');
    },
  };

  // Dashboard & Reports
  reports = {
    dashboard: async (): Promise<DashboardSummary> => {
      return this.request<DashboardSummary>('/reports/dashboard/');
    },
    analytics: async () => {
      return this.request<{
        matters_by_status: { status: string; count: number }[];
        matters_by_type: { matter_type: string; count: number }[];
        clients_by_type: { client_type: string; count: number }[];
        advocate_workload: {
          advocate_id: number;
          advocate_name: string;
          active_matters: number;
          pending_tasks: number;
          upcoming_hearings: number;
        }[];
      }>('/reports/analytics/');
    },
    getExportUrl: (type: 'matters' | 'clients' | 'tasks') => {
      return `${API_BASE_URL}/reports/export/?type=${type}`;
    },
  };

  // Clients
  clients = {
    list: async (params?: Record<string, string | number>) => {
      const query = params
        ? `?${new URLSearchParams(params as Record<string, string>).toString()}`
        : '';
      return this.request<{ results: Client[]; count: number } | Client[]>(
        `/clients/${query}`
      );
    },
    get: async (id: number) => {
      return this.request<Client>(`/clients/${id}/`);
    },
    create: async (data: Partial<Client>) => {
      return this.request<Client>('/clients/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    update: async (id: number, data: Partial<Client>) => {
      return this.request<Client>(`/clients/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    archive: async (id: number) => {
      return this.request<{ status: string; client: Client }>(
        `/clients/${id}/archive/`,
        { method: 'POST' }
      );
    },
    delete: async (id: number) => {
      return this.request(`/clients/${id}/`, { method: 'DELETE' });
    },
    deleteSummary: async (id: number) => {
      return this.request<{
        name: string;
        reference: string;
        matters_count: number;
        documents_count: number;
        tasks_count: number;
        can_delete: boolean;
        blocked_reason?: string;
        message: string;
      }>(`/clients/${id}/delete_summary/`);
    },
    suggestReference: async () => {
      return this.request<{ suggested_reference: string }>(
        '/clients/suggest_reference/'
      );
    },
  };

  // Contacts
  contacts = {
    list: async (params?: Record<string, string | number>) => {
      const query = params
        ? `?${new URLSearchParams(params as Record<string, string>).toString()}`
        : '';
      return this.request<{ results: Contact[]; count: number } | Contact[]>(
        `/contacts/${query}`
      );
    },
    get: async (id: number) => {
      return this.request<Contact>(`/contacts/${id}/`);
    },
    create: async (data: Partial<Contact>) => {
      return this.request<Contact>('/contacts/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    update: async (id: number, data: Partial<Contact>) => {
      return this.request<Contact>(`/contacts/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    delete: async (id: number) => {
      return this.request(`/contacts/${id}/`, { method: 'DELETE' });
    },
    deleteSummary: async (id: number) => {
      return this.request<{
        name: string;
        reference: string;
        matters_count: number;
        blocked: boolean;
        blocked_reason?: string | null;
        message: string;
      }>(`/contacts/${id}/delete_summary/`);
    },
  };

  // Matters
  matters = {
    list: async (params?: Record<string, string | number>) => {
      const query = params
        ? `?${new URLSearchParams(params as Record<string, string>).toString()}`
        : '';
      return this.request<{ results: Matter[]; count: number } | Matter[]>(
        `/matters/${query}`
      );
    },
    get: async (id: number) => {
      return this.request<Matter>(`/matters/${id}/`);
    },
    create: async (data: Partial<Matter>) => {
      return this.request<Matter>('/matters/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    update: async (id: number, data: Partial<Matter>) => {
      return this.request<Matter>(`/matters/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    delete: async (id: number) => {
      return this.request(`/matters/${id}/`, { method: 'DELETE' });
    },
    deleteSummary: async (id: number) => {
      return this.request<{
        name: string;
        reference: string;
        hearings_count: number;
        tasks_count: number;
        case_updates_count: number;
        documents_count: number;
        message: string;
      }>(`/matters/${id}/delete_summary/`);
    },
    suggestReference: async (params?: {
      location?: string;
      date_opened?: string;
      matter_type?: string;
    }) => {
      const query = params
        ? `?${new URLSearchParams(params as Record<string, string>).toString()}`
        : '';
      return this.request<{ suggested_reference: string }>(
        `/matters/suggest_reference/${query}`
      );
    },
    locations: async () => {
      return this.request<string[]>('/matters/locations/');
    },
    changeStatus: async (id: number, status: string) => {
      return this.request<{ status: string; matter: Matter }>(
        `/matters/${id}/change_status/`,
        {
          method: 'POST',
          body: JSON.stringify({ status }),
        }
      );
    },
  };

  // Documents
  documents = {
    list: async (params?: Record<string, string | number>) => {
      const query = params
        ? `?${new URLSearchParams(params as Record<string, string>).toString()}`
        : '';
      return this.request<{ results: Document[]; count: number } | Document[]>(
        `/documents/${query}`
      );
    },
    upload: async (formData: FormData) => {
      return this.request<Document>('/documents/', {
        method: 'POST',
        body: formData,
      });
    },
    update: async (id: number, data: Partial<Document>) => {
      return this.request<Document>(`/documents/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    downloadUrl: (id: number) => {
      return `${API_BASE_URL}/documents/${id}/download/`;
    },
    delete: async (id: number) => {
      return this.request(`/documents/${id}/`, { method: 'DELETE' });
    },
    deleteSummary: async (id: number) => {
      return this.request<{
        name: string;
        filename: string;
        reference: string;
        message: string;
      }>(`/documents/${id}/delete_summary/`);
    },
  };

  // Case Updates
  caseUpdates = {
    list: async (params?: Record<string, string | number>) => {
      const query = params
        ? `?${new URLSearchParams(params as Record<string, string>).toString()}`
        : '';
      return this.request<{ results: CaseUpdate[]; count: number } | CaseUpdate[]>(
        `/case-updates/${query}`
      );
    },
    create: async (data: Partial<CaseUpdate>) => {
      return this.request<CaseUpdate>('/case-updates/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    update: async (id: number, data: Partial<CaseUpdate>) => {
      return this.request<CaseUpdate>(`/case-updates/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    delete: async (id: number, removeLinked: boolean = true) => {
      const query = removeLinked ? '?remove_linked=true' : '';
      return this.request(`/case-updates/${id}/${query}`, { method: 'DELETE' });
    },
    deleteSummary: async (id: number) => {
      return this.request<{
        name: string;
        reference: string;
        message: string;
        generated_hearings?: Array<{ id: number; hearing_type: string; hearing_date: string }>;
        generated_tasks?: Array<{ id: number; title: string; due_date: string; status: string }>;
        has_completed_tasks?: boolean;
      }>(`/case-updates/${id}/delete_summary/`);
    },
  };

  // Hearings
  hearings = {
    list: async (params?: Record<string, string | number>) => {
      const query = params
        ? `?${new URLSearchParams(params as Record<string, string>).toString()}`
        : '';
      return this.request<{ results: Hearing[]; count: number } | Hearing[]>(
        `/hearings/${query}`
      );
    },
    upcoming: async () => {
      return this.request<Hearing[]>('/hearings/upcoming/');
    },
    create: async (data: Partial<Hearing>) => {
      return this.request<Hearing>('/hearings/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    update: async (id: number, data: Partial<Hearing>) => {
      return this.request<Hearing>(`/hearings/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    delete: async (id: number) => {
      return this.request(`/hearings/${id}/`, { method: 'DELETE' });
    },
    deleteSummary: async (id: number) => {
      return this.request<{
        name: string;
        reference: string;
        message: string;
      }>(`/hearings/${id}/delete_summary/`);
    },
    recordOutcome: async (
      id: number,
      data: { outcome_summary: string; next_hearing_date?: string }
    ) => {
      return this.request<Hearing>(`/hearings/${id}/record_outcome/`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
  };

  // Tasks
  tasks = {
    list: async (params?: Record<string, string | number>) => {
      const query = params
        ? `?${new URLSearchParams(params as Record<string, string>).toString()}`
        : '';
      return this.request<{ results: Task[]; count: number } | Task[]>(
        `/tasks/${query}`
      );
    },
    overdue: async () => {
      return this.request<Task[]>('/tasks/overdue/');
    },
    create: async (data: Partial<Task>) => {
      return this.request<Task>('/tasks/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    update: async (id: number, data: Partial<Task>) => {
      return this.request<Task>(`/tasks/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    delete: async (id: number) => {
      return this.request(`/tasks/${id}/`, { method: 'DELETE' });
    },
    deleteSummary: async (id: number) => {
      return this.request<{
        name: string;
        message: string;
      }>(`/tasks/${id}/delete_summary/`);
    },
    complete: async (id: number) => {
      return this.request<{ status: string; task: Task }>(
        `/tasks/${id}/complete/`,
        { method: 'POST' }
      );
    },
  };

  // Users & Staff
  users = {
    list: async (params?: Record<string, string | number>) => {
      const query = params
        ? `?${new URLSearchParams(params as Record<string, string>).toString()}`
        : '';
      return this.request<{ results: User[]; count: number } | User[]>(
        `/users/${query}`
      );
    },
  };

  // Audit Logs
  audit = {
    list: async (params?: Record<string, string | number>) => {
      const query = params
        ? `?${new URLSearchParams(params as Record<string, string>).toString()}`
        : '';
      return this.request<{ results: AuditLog[]; count: number } | AuditLog[]>(
        `/audit-logs/${query}`
      );
    },
  };

  // Client Progress Reports
  clientReports = {
    list: async (matterId: number) => {
      return this.request<{
        matter_id: number;
        matter_reference: string;
        has_sent_report: boolean;
        last_sent_at?: string | null;
        last_sent_at_display?: string | null;
        reports: ClientReport[];
      }>(`/reports/client-reports/?matter=${matterId}`);
    },
    generate: async (data: {
      matter_id: number;
      mode: string;
      start_date?: string;
      end_date?: string;
    }) => {
      return this.request<ClientReport>('/reports/client-reports/generate/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    markSent: async (id: number) => {
      return this.request<ClientReport>(`/reports/client-reports/${id}/mark-sent/`, {
        method: 'POST',
      });
    },
  };
}

export const api = new ApiClient();
