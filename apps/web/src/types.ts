export interface ChatItem {
  id: string;
  botId?: string | null;
  bot?: {
    id: string;
    name: string;
  } | null;
  telegramChatId: string;
  title: string | null;
  username: string | null;
  messages: Array<{ text: string | null; sentAt: string }>;
  notes?: Array<{
    id: string;
    text: string;
  }>;
  _count?: {
    notes?: number;
  };
}

export interface MessageItem {
  id: string;
  telegramMessageId: string;
  text: string | null;
  messageType: string;
  sentAt: string;
  isEdited: boolean;
  deletedAt: string | null;
  metadata?: {
    chat?: {
      id?: string | number;
    };
    from?: {
      id?: string | number;
    };
  };
  user: {
    id: string;
    telegramUserId: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    role?: 'ADMIN' | 'MANAGER' | 'VIEWER';
  } | null;
  attachments: Array<{
    id: string;
    fileName: string | null;
    mimeType: string | null;
    url: string | null;
  }>;
  reactions: Array<{
    id: string;
    emoji: string;
    count: number;
  }>;
}

export interface SidebarData {
  id: string;
  manager?: {
    id: string;
    telegramUserId: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
  } | null;
  client?: {
    id: string;
    telegramUserId: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
  } | null;
  users: Array<{
    id: string;
    telegramUserId: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
  }>;
  notes: Array<{
    id: string;
    text: string;
    tags: string[];
    createdAt: string;
  }>;
  managerNotes?: Array<{
    id: string;
    text: string;
    tags: string[];
    createdAt: string;
  }>;
  clientNotes?: Array<{
    id: string;
    text: string;
    tags: string[];
    createdAt: string;
  }>;
  customFieldValues: Array<{
    id: string;
    valueText: string | null;
    valueNumber: number | null;
    customField: {
      id: string;
      label: string;
      type: string;
    };
  }>;
}

export interface MetricsOverview {
  managersCount: number;
  activeChatsCount: number;
  unansweredChatsCount: number;
}

export interface GlobalSearchResult {
  messageId: string;
  text: string | null;
  date: string;
  chatId: string;
  chatTitle: string;
  username: string | null;
  userId: string | undefined;
  jumpTo: string;
}

export interface BotItem {
  id: string;
  name: string;
  tokenMasked: string;
  webhookPath: string;
  isActive: boolean;
  lastActivityAt: string | null;
  account: {
    id: string;
    name: string;
  };
}

export interface ConnectWebhookResult {
  ok: boolean;
  description: string;
  webhookUrl: string;
  botId: string;
  botName: string;
}

export interface ManagerReportSummary {
  id: string;
  name: string;
  tokenMasked: string;
  clientsCount: number;
  archivedCount: number;
  avgScore: number;
  criticalCount: number;
}

export interface ManagerClientReportItem {
  chatId: string;
  title: string | null;
  username: string | null;
  telegramChatId: string;
  isArchived: boolean;
  archiveReason: string | null;
  videoNotesCount: number;
  photosCount: number;
  voiceCount: number;
  avgResponseTimeSec: number | null;
  eveningMsgCount: number;
  newChatsNextDay: boolean | null;
  topicsCovered: string[];
  topicsCount: number;
  qualityScore: number;
  qualityIssues: Array<{ level: 'CRITICAL' | 'WARN'; text: string; code?: string }>;
  hasCritical: boolean;
  analyzedAt: string | null;
  clientProfile?: {
    displayName?: string | null;
    hobbies?: string[];
    hometown?: string | null;
    maritalStatus?: string | null;
    hasKids?: boolean | null;
    hasPets?: boolean | null;
    favoriteCuisine?: string | null;
    canCook?: boolean | null;
    favoriteMovies?: string[];
    travelPlaces?: string[];
    education?: string | null;
    currentJob?: string | null;
    badHabits?: string[];
    dreams?: string | null;
    fears?: string | null;
    financialInfo?: string | null;
  } | null;
}

export interface ClientListItem {
  chatId: string;
  displayName: string;
  username: string | null;
  telegramChatId: string;
  manager: string;
  qualityScore: number;
  hasCritical: boolean;
  isArchived: boolean;
  archiveReason: string | null;
  lastMessageAt: string | null;
}

export interface ClientDetails {
  chat: {
    id: string;
    title: string | null;
    username: string | null;
    telegramChatId: string;
    isArchived: boolean;
    archiveReason: string | null;
  };
  analysis: ManagerClientReportItem | null;
  clientProfile: ManagerClientReportItem['clientProfile'] | null;
  manager: {
    id: string;
    name: string;
    tokenMasked: string;
  } | null;
  recentMessages: Array<{
    id: string;
    text: string | null;
    sentAt: string;
    user: {
      telegramUserId: string;
      username: string | null;
      firstName: string | null;
    } | null;
  }>;
}

// Analytics types
export interface ChannelStats {
  managerId: string;
  managerName: string;
  channelUsername: string;
  subscriberCount?: number;
  lastUpdated?: string;
  error?: string;
}
