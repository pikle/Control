import {
  BotItem,
  ChatItem,
  ClientDetails,
  ClientListItem,
  ConnectWebhookResult,
  GlobalSearchResult,
  ManagerClientReportItem,
  ManagerReportSummary,
  MessageItem,
  MetricsOverview,
  SidebarData,
} from './types';

function resolveApiUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL?.trim();

  if (!envUrl) {
    return '/api';
  }

  const normalized = envUrl.replace(/\/+$/, '');
  const isLocalApi = /https?:\/\/(localhost|127\.0\.0\.1):4000$/i.test(normalized);
  const isLocalPage = typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);

  // If a production page was accidentally built with localhost API, fall back to nginx proxy.
  if (isLocalApi && !isLocalPage) {
    return '/api';
  }

  return normalized;
}

const API_URL = resolveApiUrl();

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  getChats(accountId: string, q: string, managerBotId?: string) {
    const params = new URLSearchParams({ accountId, q });
    if (managerBotId && managerBotId !== 'all') {
      params.set('managerBotId', managerBotId);
    }
    return req<ChatItem[]>(`/chats?${params.toString()}`);
  },
  getMessages(chatId: string) {
    return req<MessageItem[]>(`/chats/${chatId}/messages?limit=200`);
  },
  getSidebar(chatId: string) {
    return req<SidebarData>(`/chats/${chatId}/sidebar`);
  },
  globalSearch(params: Record<string, string>) {
    const query = new URLSearchParams(params);
    return req<GlobalSearchResult[]>(`/search/global?${query.toString()}`);
  },
  bootstrap(accountId: string, accountName = 'Demo Account') {
    return req('/admin/bootstrap', {
      method: 'POST',
      body: JSON.stringify({ accountId, accountName }),
    });
  },
  getNotes(accountId: string, targetType: string, targetId: string) {
    const query = new URLSearchParams({ accountId, targetType, targetId });
    return req(`/notes?${query.toString()}`);
  },
  createNote(body: {
    accountId: string;
    targetType: 'USER' | 'CHAT' | 'MESSAGE';
    targetId: string;
    text: string;
    tags: string[];
  }) {
    return req('/notes', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  getBots() {
    return req<BotItem[]>('/admin/bots');
  },
  createBot(body: { accountId: string; name: string; token: string; webhookSecret?: string }) {
    return req('/admin/bots', { method: 'POST', body: JSON.stringify(body) });
  },
  connectBotWebhook(botId: string) {
    return req<ConnectWebhookResult>(`/admin/bots/${botId}/connect-webhook`, { method: 'POST' });
  },
  getCustomFields(accountId: string) {
    return req(`/admin/custom-fields/${accountId}`);
  },
  createCustomField(body: {
    accountId: string;
    key: string;
    label: string;
    type: 'TEXT' | 'NUMBER' | 'SELECT';
    options?: string[];
  }) {
    return req('/admin/custom-fields', { method: 'POST', body: JSON.stringify(body) });
  },
  updateCustomField(
    fieldId: string,
    body: {
      label?: string;
      type?: 'TEXT' | 'NUMBER' | 'SELECT';
      options?: string[];
      sortOrder?: number;
      isRequired?: boolean;
    },
  ) {
    return req(`/admin/custom-fields/${fieldId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },
  deleteCustomField(fieldId: string) {
    return req(`/admin/custom-fields/${fieldId}/delete`, {
      method: 'POST',
    });
  },
  getUsers(accountId: string) {
    return req(`/admin/users/${accountId}`);
  },
  setUserRole(userId: string, role: 'ADMIN' | 'MANAGER' | 'VIEWER') {
    return req(`/admin/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  },
  getLogs(accountId: string) {
    return req(`/admin/logs/${accountId}`);
  },
  exportChat(chatId: string) {
    return req(`/exports/chat/${chatId}`);
  },
  getMetrics(accountId: string) {
    return req<MetricsOverview>(`/metrics/overview?accountId=${encodeURIComponent(accountId)}`);
  },
  runAnalysis(accountId: string, managerBotId?: string) {
    const params = new URLSearchParams({ accountId });
    if (managerBotId && managerBotId !== 'all') params.set('managerBotId', managerBotId);
    return req<{ processed: number }>(`/analysis/run?${params.toString()}`);
  },
  getReportManagers(accountId: string) {
    return req<ManagerReportSummary[]>(`/reports/managers?accountId=${encodeURIComponent(accountId)}`);
  },
  getManagerReport(accountId: string, botId: string) {
    return req<ManagerClientReportItem[]>(`/reports/manager/${botId}?accountId=${encodeURIComponent(accountId)}`);
  },
  getClients(accountId: string, q: string) {
    const params = new URLSearchParams({ accountId, q });
    return req<ClientListItem[]>(`/clients?${params.toString()}`);
  },
  getClientDetails(chatId: string) {
    return req<ClientDetails>(`/clients/${chatId}`);
  },
  // Analytics
  getChannelsStats(accountId: string) {
    return req(`/telegram-analytics/channels/${accountId}`);
  },
};
