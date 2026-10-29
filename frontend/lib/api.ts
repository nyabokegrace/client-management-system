import {
  User,
  Client,
  Matter,
  Document,
  CaseUpdate,
  Hearing,
  Task,
  AuditLog,
  DashboardSummary,
} from '../types';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

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
    login: async (credentials: { username: string; password: string }) => {
      const data = await this.request<{
        token: string;
        user: User;
        message: string;
      }>('/auth/login/', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });
      if (typeof window !== 'undefined') {
        localStorage.setItem('siwolo_token', data.token);
        localStorage.setItem('siwolo_user', JSON.stringify(data.user));
      }
      return data;
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
    downloadUrl: (id: number) => {
      return `${API_BASE_URL}/documents/${id}/download/`;
    },
    delete: async (id: number) => {
      return this.request(`/documents/${id}/`, { method: 'DELETE' });
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
}

export const api = new ApiClient();
