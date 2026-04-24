import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import {
  BotItem,
  ChatItem,
  ClientDetails,
  ClientListItem,
  GlobalSearchResult,
  ManagerClientReportItem,
  ManagerReportSummary,
  MessageItem,
  MetricsOverview,
  SidebarData,
} from './types';

type Tab = 'monitor' | 'reports' | 'clients' | 'admin' | 'analytics';
const DEMO_ACCOUNT_ID = 'demo-account';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function formatTime(value?: string | null) {
  if (!value) return '--:--';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function chatTitle(chat: ChatItem) {
  return chat.title || (chat.username ? `@${chat.username}` : chat.telegramChatId);
}

function userLabel(user?: { username: string | null; firstName: string | null; lastName: string | null; telegramUserId: string } | null) {
  if (!user) return 'Unknown';
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  if (fullName) return fullName;
  if (user.username) return `@${user.username}`;
  return user.telegramUserId;
}

function clientLabel(sidebar: SidebarData | null, selectedChat: ChatItem | null) {
  if (selectedChat?.username) return `@${selectedChat.username}`;
  if (sidebar?.client?.username) return `@${sidebar.client.username}`;
  return userLabel(sidebar?.client || null);
}

function isIncomingMessage(message: MessageItem, sidebar: SidebarData | null): boolean {
  const metaChatId = message.metadata?.chat?.id !== undefined ? String(message.metadata.chat.id) : undefined;
  const metaFromId = message.metadata?.from?.id !== undefined ? String(message.metadata.from.id) : undefined;

  if (metaChatId && metaFromId) {
    return metaFromId === metaChatId;
  }

  const senderId = message.user?.telegramUserId;
  if (!senderId) return true;

  if (sidebar?.manager?.telegramUserId) {
    return senderId !== sidebar.manager.telegramUserId;
  }

  if (sidebar?.client?.telegramUserId) {
    return senderId === sidebar.client.telegramUserId;
  }

  return true;
}

export function App() {
  const [tab, setTab] = useState<Tab>('monitor');

  const tabs: Array<{ key: Tab; label: string; icon: string }> = [
    { key: 'monitor', label: 'Мониторинг', icon: 'M' },
    { key: 'reports', label: 'Отчеты', icon: 'R' },
    { key: 'clients', label: 'Клиенты', icon: 'C' },
    { key: 'admin', label: 'Управление', icon: 'A' },
    { key: 'analytics', label: 'Аналитика', icon: 'S' },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1800px] items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-sm">T</div>
            <div>
              <div className="text-sm font-semibold leading-tight">TG Business Monitor</div>
              <div className="text-[11px] text-zinc-500">CRM | Аналитика | Мониторинг</div>
            </div>
          </div>
          <nav className="flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900 p-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cx(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all',
                  tab === t.key
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100',
                )}
              >
                <span className="text-xs">{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1800px] p-3">
        {tab === 'monitor' && <MonitorView accountId={DEMO_ACCOUNT_ID} />}
        {tab === 'reports' && <ReportsView accountId={DEMO_ACCOUNT_ID} />}
        {tab === 'clients' && <ClientsView accountId={DEMO_ACCOUNT_ID} />}
        {tab === 'admin' && <AdminView accountId={DEMO_ACCOUNT_ID} />}
        {tab === 'analytics' && <AnalyticsView accountId={DEMO_ACCOUNT_ID} />}
      </div>
    </div>
  );
}

function MonitorView({ accountId }: { accountId: string }) {
  const [chatSearch, setChatSearch] = useState('');
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [managerBots, setManagerBots] = useState<BotItem[]>([]);
  const [selectedManagerBotId, setSelectedManagerBotId] = useState<string>('all');

  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [sidebar, setSidebar] = useState<SidebarData | null>(null);

  const [globalText, setGlobalText] = useState('');
  const [globalResults, setGlobalResults] = useState<GlobalSearchResult[]>([]);

  const [newChatTag, setNewChatTag] = useState('');
  const [newManagerTag, setNewManagerTag] = useState('');
  const [newClientTag, setNewClientTag] = useState('');
  const [showChatTagInput, setShowChatTagInput] = useState(false);
  const [showManagerTagInput, setShowManagerTagInput] = useState(false);
  const [showClientTagInput, setShowClientTagInput] = useState(false);
  const [metrics, setMetrics] = useState<MetricsOverview>({
    managersCount: 0,
    activeChatsCount: 0,
    unansweredChatsCount: 0,
  });

  const selectedChat = useMemo(
    () => chats.find((chat) => chat.id === selectedChatId) || null,
    [chats, selectedChatId],
  );

  useEffect(() => {
    api.bootstrap(accountId).catch(() => undefined);
  }, [accountId]);

  const loadChats = () => {
    api.getChats(accountId, chatSearch, selectedManagerBotId).then(setChats).catch(() => setChats([]));
  };

  const loadManagers = () => {
    api.getBots().then(setManagerBots).catch(() => setManagerBots([]));
  };

  const loadMetrics = () => {
    api.getMetrics(accountId).then(setMetrics).catch(() => undefined);
  };

  useEffect(() => {
    loadChats();
    loadMetrics();
    loadManagers();
  }, [accountId, chatSearch, selectedManagerBotId]);

  useEffect(() => {
    const timer = setInterval(loadChats, 3000);
    return () => clearInterval(timer);
  }, [accountId, chatSearch, selectedManagerBotId]);

  useEffect(() => {
    const timer = setInterval(loadMetrics, 5000);
    return () => clearInterval(timer);
  }, [accountId]);

  useEffect(() => {
    if (!selectedChatId && chats.length) {
      setSelectedChatId(chats[0].id);
    }
  }, [chats, selectedChatId]);

  const loadChatDetails = () => {
    if (!selectedChatId) return;
    api.getMessages(selectedChatId).then(setMessages).catch(() => setMessages([]));
    api.getSidebar(selectedChatId).then(setSidebar).catch(() => setSidebar(null));
  };

  useEffect(() => {
    loadChatDetails();
  }, [selectedChatId]);

  useEffect(() => {
    if (!selectedChatId) return;
    const timer = setInterval(loadChatDetails, 3000);
    return () => clearInterval(timer);
  }, [selectedChatId]);

  const runGlobalSearch = () => {
    api.globalSearch({ accountId, text: globalText }).then(setGlobalResults).catch(() => setGlobalResults([]));
  };

  const createChatTag = async () => {
    if (!selectedChatId || !newChatTag.trim()) return;
    await api.createNote({
      accountId,
      targetType: 'CHAT',
      targetId: selectedChatId,
      text: newChatTag.trim(),
      tags: [newChatTag.trim()],
    });
    setNewChatTag('');
    setShowChatTagInput(false);
    loadChatDetails();
    loadChats();
  };

  const createManagerTag = async () => {
    if (!sidebar?.manager?.id || !newManagerTag.trim()) return;
    await api.createNote({
      accountId,
      targetType: 'USER',
      targetId: sidebar.manager.id,
      text: newManagerTag.trim(),
      tags: [newManagerTag.trim()],
    });
    setNewManagerTag('');
    setShowManagerTagInput(false);
    loadChatDetails();
  };

  const createClientTag = async () => {
    if (!sidebar?.client?.id || !newClientTag.trim()) return;
    await api.createNote({
      accountId,
      targetType: 'USER',
      targetId: sidebar.client.id,
      text: newClientTag.trim(),
      tags: [newClientTag.trim()],
    });
    setNewClientTag('');
    setShowClientTagInput(false);
    loadChatDetails();
  };

  return (
    <div className="grid h-[calc(100vh-70px)] grid-cols-1 gap-2.5 lg:grid-cols-[200px_340px_1fr] xl:grid-cols-[200px_340px_1fr_300px]">
      <aside className="flex min-h-0 flex-col rounded-xl border border-zinc-800 bg-zinc-900">
        <div className="border-b border-zinc-800 px-3 py-2.5">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Менеджеры</div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <button
            onClick={() => setSelectedManagerBotId('all')}
            className={cx(
              'mb-1.5 w-full rounded-lg px-3 py-2 text-left text-sm transition',
              selectedManagerBotId === 'all'
                ? 'bg-violet-600/20 text-violet-300 ring-1 ring-violet-500/30'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200',
            )}
          >
            <div className="font-medium">Все менеджеры</div>
            <div className="text-[11px] text-zinc-500">{managerBots.length} ботов</div>
          </button>
          <div className="space-y-1">
            {managerBots.map((bot) => (
              <button
                key={bot.id}
                onClick={() => setSelectedManagerBotId(bot.id)}
                className={cx(
                  'w-full rounded-lg px-3 py-2 text-left text-sm transition',
                  selectedManagerBotId === bot.id
                    ? 'bg-violet-600/20 text-violet-300 ring-1 ring-violet-500/30'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200',
                )}
              >
                <div className="truncate font-medium text-zinc-200">{bot.name}</div>
                <div className="truncate text-[10px] text-zinc-500">{bot.tokenMasked}</div>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <aside className="flex min-h-0 flex-col rounded-xl border border-zinc-800 bg-zinc-900">
        <div className="border-b border-zinc-800 p-3">
          <div className="mb-3 grid grid-cols-3 gap-2">
            {[
              { value: metrics.managersCount, label: 'Боты', color: 'text-violet-400' },
              { value: metrics.activeChatsCount, label: 'Чаты', color: 'text-sky-400' },
              { value: metrics.unansweredChatsCount, label: 'Без ответа', color: 'text-amber-400' },
            ].map((m) => (
              <div key={m.label} className="rounded-lg border border-zinc-800 bg-zinc-950 p-2 text-center">
                <div className={cx('text-lg font-bold', m.color)}>{m.value}</div>
                <div className="text-[10px] text-zinc-500">{m.label}</div>
              </div>
            ))}
          </div>
          <input
            value={chatSearch}
            onChange={(e) => setChatSearch(e.target.value)}
            placeholder="Поиск чатов..."
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-violet-500"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {chats.map((chat, idx) => {
            const initials = (chat.title || chat.username || 'U').slice(0, 1).toUpperCase();
            const tags = (chat.notes || []).map((n) => n.text).filter(Boolean).slice(0, 2);
            const isSelected = selectedChatId === chat.id;
            const colors = [
              'from-violet-500 to-purple-600',
              'from-sky-500 to-blue-600',
              'from-emerald-500 to-teal-600',
              'from-orange-500 to-amber-600',
              'from-pink-500 to-rose-600',
            ];

            return (
              <button
                key={chat.id}
                onClick={() => setSelectedChatId(chat.id)}
                className={cx(
                  'w-full border-b border-zinc-800/60 px-3 py-3 text-left transition',
                  isSelected ? 'bg-zinc-800' : 'hover:bg-zinc-800/50',
                )}
              >
                <div className="flex items-start gap-2.5">
                  <div className={cx('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold text-white', colors[idx % colors.length])}>
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <div className="truncate text-sm font-semibold text-zinc-100">{chatTitle(chat)}</div>
                      <div className="shrink-0 text-[10px] text-zinc-500">{formatTime(chat.messages[0]?.sentAt)}</div>
                    </div>
                    <div className="truncate text-xs text-zinc-500">{chat.messages[0]?.text || 'Нет сообщений'}</div>
                    {tags.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {tags.map((tag, i) => (
                          <span
                            key={`${chat.id}-${i}-${tag}`}
                            className="rounded bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-400 ring-1 ring-violet-500/20"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
          {!chats.length && <div className="p-8 text-center text-sm text-zinc-600">Нет чатов</div>}
        </div>
      </aside>

      <main className="flex min-h-0 flex-col rounded-xl border border-zinc-800 bg-zinc-900">
        <div className="border-b border-zinc-800 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">{selectedChat ? chatTitle(selectedChat) : 'Выберите чат'}</div>
              <div className="text-[11px] text-zinc-500">Обновление каждые 3 сек</div>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              value={globalText}
              onChange={(e) => setGlobalText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runGlobalSearch()}
              placeholder="Поиск по всем сообщениям..."
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-violet-500"
            />
            <button
              onClick={runGlobalSearch}
              className="shrink-0 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500"
            >
              Найти
            </button>
          </div>
          {!!globalResults.length && (
            <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 p-2">
              {globalResults.map((result) => (
                <button
                  key={result.messageId}
                  onClick={() => setSelectedChatId(result.chatId)}
                  className="w-full rounded-lg border border-zinc-800 px-2.5 py-2 text-left hover:border-violet-500/40 hover:bg-zinc-900"
                >
                  <div className="text-xs font-semibold text-zinc-200">{result.chatTitle}</div>
                  <div className="truncate text-[11px] text-zinc-500">{result.text || 'Медиа'}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {messages.map((message) => {
            const incoming = isIncomingMessage(message, sidebar);
            return (
              <div key={message.id} className={cx('flex', !incoming && 'justify-end')}>
                <article
                  className={cx(
                    'max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm',
                    incoming
                      ? 'rounded-tl-sm bg-zinc-800 text-zinc-100'
                      : 'rounded-tr-sm bg-violet-600 text-white',
                  )}
                >
                  <div className={cx('mb-1 text-[10px] font-medium', incoming ? 'text-zinc-500' : 'text-violet-200')}>
                    {message.user?.firstName || message.user?.username || message.user?.telegramUserId || '?'}
                  </div>
                  <div className="leading-relaxed">
                    {message.deletedAt ? (
                      <span className="italic opacity-50">Сообщение удалено</span>
                    ) : (
                      message.text || <span className="italic opacity-50">[медиа]</span>
                    )}
                  </div>
                  {!!message.reactions.length && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {message.reactions.map((r) => (
                        <span key={r.id} className="rounded-full bg-black/20 px-2 py-0.5 text-[11px]">
                          {r.emoji} {r.count}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className={cx('mt-1 text-[10px]', incoming ? 'text-zinc-600' : 'text-violet-300')}>
                    {new Date(message.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {message.isEdited && ' · ред.'}
                  </div>
                </article>
              </div>
            );
          })}
          {!messages.length && (
            <div className="flex h-full items-center justify-center text-sm text-zinc-600">
              {selectedChat ? 'Пока нет сообщений' : 'Выберите чат слева'}
            </div>
          )}
        </div>
      </main>

      <aside className="hidden min-h-0 flex-col rounded-xl border border-zinc-800 bg-zinc-900 xl:flex">
        <div className="border-b border-zinc-800 px-3 py-2.5">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Информация о чате</div>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Участники</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-[10px] text-zinc-600">Менеджер</div>
                <div className="mt-0.5 truncate text-xs font-medium text-zinc-200">{userLabel(sidebar?.manager || null)}</div>
              </div>
              <div>
                <div className="text-[10px] text-zinc-600">Клиент</div>
                <div className="mt-0.5 truncate text-xs font-medium text-zinc-200">{clientLabel(sidebar, selectedChat)}</div>
              </div>
            </div>
          </div>

          {(sidebar?.customFieldValues.length || 0) > 0 && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Кастомные поля</div>
              <div className="space-y-1.5">
                {sidebar?.customFieldValues.map((f) => (
                  <div key={f.id} className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-zinc-500">{f.customField.label}</span>
                    <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[11px] text-zinc-200">
                      {f.valueText || f.valueNumber || '-'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(
            [
              {
                title: 'Теги менеджера',
                notes: sidebar?.managerNotes,
                showInput: showManagerTagInput,
                setShowInput: setShowManagerTagInput,
                value: newManagerTag,
                setValue: setNewManagerTag,
                onSave: createManagerTag,
                color: 'text-violet-400 bg-violet-500/10 ring-violet-500/20',
              },
              {
                title: 'Теги клиента',
                notes: sidebar?.clientNotes,
                showInput: showClientTagInput,
                setShowInput: setShowClientTagInput,
                value: newClientTag,
                setValue: setNewClientTag,
                onSave: createClientTag,
                color: 'text-sky-400 bg-sky-500/10 ring-sky-500/20',
              },
              {
                title: 'Теги чата',
                notes: sidebar?.notes,
                showInput: showChatTagInput,
                setShowInput: setShowChatTagInput,
                value: newChatTag,
                setValue: setNewChatTag,
                onSave: createChatTag,
                color: 'text-emerald-400 bg-emerald-500/10 ring-emerald-500/20',
              },
            ] as Array<{
              title: string;
              notes?: Array<{ id: string; text: string }>;
              showInput: boolean;
              setShowInput: (v: boolean) => void;
              value: string;
              setValue: (v: string) => void;
              onSave: () => void;
              color: string;
            }>
          ).map((section) => (
            <div key={section.title} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{section.title}</div>
                <button
                  onClick={() => section.setShowInput(!section.showInput)}
                  className="rounded px-1.5 py-0.5 text-[11px] text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                >
                  + добавить
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {section.notes?.map((note) => (
                  <span key={note.id} className={cx('rounded px-1.5 py-0.5 text-[10px] font-medium ring-1', section.color)}>
                    {note.text}
                  </span>
                ))}
                {!section.notes?.length && !section.showInput && (
                  <span className="text-[11px] text-zinc-600">Нет тегов</span>
                )}
              </div>
              {section.showInput && (
                <div className="mt-2 flex gap-1.5">
                  <input
                    value={section.value}
                    onChange={(e) => section.setValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && section.onSave()}
                    placeholder="Тег..."
                    autoFocus
                    className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-violet-500"
                  />
                  <button
                    onClick={section.onSave}
                    className="shrink-0 rounded-lg bg-violet-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-violet-500"
                  >
                    ОК
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

function AdminView({ accountId }: { accountId: string }) {
  const [bots, setBots] = useState<BotItem[]>([]);
  const [users, setUsers] = useState<
    Array<{ id: string; username: string | null; telegramUserId: string; role: string }>
  >([]);
  const [customFields, setCustomFields] = useState<Array<{ id: string; key: string; label: string; type: string }>>([]);
  const [logs, setLogs] = useState<Array<{ id: string; action: string; entityType: string; createdAt: string }>>([]);

  const [botName, setBotName] = useState('');
  const [botToken, setBotToken] = useState('');
  const [connectingBotId, setConnectingBotId] = useState<string | null>(null);
  const [connectStatus, setConnectStatus] = useState<Record<string, string>>({});

  const [fieldKey, setFieldKey] = useState('');
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldType, setFieldType] = useState<'TEXT' | 'NUMBER' | 'SELECT'>('TEXT');

  const refresh = () => {
    api
      .bootstrap(accountId)
      .then(() =>
        Promise.all([api.getBots(), api.getUsers(accountId), api.getCustomFields(accountId), api.getLogs(accountId)]),
      )
      .then(([botsData, usersData, fieldsData, logsData]) => {
        setBots(botsData);
        setUsers(usersData as Array<{ id: string; username: string | null; telegramUserId: string; role: string }>);
        setCustomFields(fieldsData as Array<{ id: string; key: string; label: string; type: string }>);
        setLogs(logsData as Array<{ id: string; action: string; entityType: string; createdAt: string }>);
      })
      .catch(() => {
        setBots([]);
        setUsers([]);
        setCustomFields([]);
        setLogs([]);
      });
  };

  useEffect(() => {
    refresh();
  }, [accountId]);

  const setRole = async (userId: string, role: 'ADMIN' | 'MANAGER' | 'VIEWER') => {
    await api.setUserRole(userId, role);
    refresh();
  };

  const createBot = async (e: FormEvent) => {
    e.preventDefault();
    if (!botName || !botToken) return;
    await api.createBot({ accountId, name: botName, token: botToken });
    setBotName('');
    setBotToken('');
    refresh();
  };

  const createField = async (e: FormEvent) => {
    e.preventDefault();
    if (!fieldKey || !fieldLabel) return;
    await api.createCustomField({
      accountId,
      key: fieldKey,
      label: fieldLabel,
      type: fieldType,
    });
    setFieldKey('');
    setFieldLabel('');
    refresh();
  };

  const connectWebhook = async (botId: string) => {
    setConnectingBotId(botId);
    try {
      const result = await api.connectBotWebhook(botId);
      setConnectStatus((prev) => ({
        ...prev,
        [botId]: result.ok ? 'Webhook подключен' : `Ошибка: ${result.description}`,
      }));
    } catch {
      setConnectStatus((prev) => ({
        ...prev,
        [botId]: 'Ошибка подключения webhook',
      }));
    } finally {
      setConnectingBotId(null);
    }
  };

  return (
    <div className="grid h-[calc(100vh-94px)] grid-cols-1 gap-3 lg:grid-cols-3">
      <section className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-3">
        <h3 className="mb-3 text-sm font-semibold">Управление ботами</h3>
        <form onSubmit={createBot} className="mb-3 space-y-2">
          <input
            value={botName}
            onChange={(e) => setBotName(e.target.value)}
            placeholder="Имя бота"
            className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-2.5 py-2 text-sm outline-none focus:border-violet-500"
          />
          <input
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            placeholder="Токен бота"
            className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-2.5 py-2 text-sm outline-none focus:border-violet-500"
          />
          <button className="rounded-lg bg-violet-500 px-3 py-1.5 text-sm text-white hover:bg-violet-400">Добавить</button>
        </form>
        <div className="space-y-2 text-xs">
          {bots.map((bot) => (
            <div key={bot.id} className="rounded-xl border border-neutral-800 bg-neutral-950 p-2.5">
              <div className="font-semibold">{bot.name}</div>
              <div className="text-neutral-400">{bot.tokenMasked}</div>
              <div className="mt-1 break-all text-neutral-500">/telegram/webhook/{bot.webhookPath}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                  onClick={() => connectWebhook(bot.id)}
                  disabled={connectingBotId === bot.id}
                  className="rounded-md border border-violet-500/40 px-2 py-1 text-[11px] text-violet-200 hover:bg-violet-500/10 disabled:opacity-60"
                >
                  {connectingBotId === bot.id ? 'Подключение...' : 'Подключить webhook'}
                </button>
                <a
                  href={`https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=${encodeURIComponent(`${window.location.origin}/telegram/webhook/${bot.webhookPath}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-neutral-700 px-2 py-1 text-[11px] text-neutral-300 hover:border-violet-500"
                  title="Ручная ссылка: вставь токен бота вместо <YOUR_BOT_TOKEN>"
                >
                  Ручная ссылка
                </a>
              </div>
              {connectStatus[bot.id] && (
                <div className="mt-1 text-[11px] text-neutral-400">{connectStatus[bot.id]}</div>
              )}
              <div className="mt-1 text-neutral-500">
                Активность: {bot.lastActivityAt ? new Date(bot.lastActivityAt).toLocaleString() : 'нет'}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-3">
        <h3 className="mb-3 text-sm font-semibold">Кастомные поля</h3>
        <form onSubmit={createField} className="mb-3 space-y-2">
          <input
            value={fieldKey}
            onChange={(e) => setFieldKey(e.target.value)}
            placeholder="Ключ"
            className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-2.5 py-2 text-sm outline-none focus:border-violet-500"
          />
          <input
            value={fieldLabel}
            onChange={(e) => setFieldLabel(e.target.value)}
            placeholder="Название"
            className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-2.5 py-2 text-sm outline-none focus:border-violet-500"
          />
          <select
            value={fieldType}
            onChange={(e) => setFieldType(e.target.value as 'TEXT' | 'NUMBER' | 'SELECT')}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-2.5 py-2 text-sm outline-none focus:border-violet-500"
          >
            <option value="TEXT">Текст</option>
            <option value="NUMBER">Число</option>
            <option value="SELECT">Список</option>
          </select>
          <button className="rounded-lg bg-violet-500 px-3 py-1.5 text-sm text-white hover:bg-violet-400">Создать</button>
        </form>

        <div className="space-y-1.5 text-xs">
          {customFields.map((field) => (
            <div key={field.id} className="rounded-xl border border-neutral-800 bg-neutral-950 p-2.5">
              <div>{field.label} ({field.key})</div>
              <div className="mt-1 text-neutral-500">Тип: {field.type}</div>
              <div className="mt-2 flex gap-1.5">
                <button
                  onClick={async () => {
                    const next = prompt('Новое название поля', field.label);
                    if (!next) return;
                    await api.updateCustomField(field.id, { label: next });
                    refresh();
                  }}
                  className="rounded-md border border-neutral-700 px-2 py-0.5 hover:border-violet-500"
                >
                  Изменить
                </button>
                <button
                  onClick={async () => {
                    await api.deleteCustomField(field.id);
                    refresh();
                  }}
                  className="rounded-md border border-rose-500/40 px-2 py-0.5 text-rose-300 hover:bg-rose-500/10"
                >
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-3">
        <h3 className="mb-3 text-sm font-semibold">Пользователи и лог</h3>
        <div className="mb-3 max-h-60 space-y-1.5 overflow-y-auto text-xs">
          {users.map((user) => (
            <div key={user.id} className="rounded-xl border border-neutral-800 bg-neutral-950 p-2.5">
              <div>{user.username ? `@${user.username}` : user.telegramUserId}</div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-neutral-500">Роль: {user.role}</span>
                <select
                  value={user.role}
                  onChange={(e) => setRole(user.id, e.target.value as 'ADMIN' | 'MANAGER' | 'VIEWER')}
                  className="rounded-md border border-neutral-700 bg-neutral-900 px-1.5 py-0.5 text-[11px]"
                >
                  <option value="ADMIN">ADMIN</option>
                  <option value="MANAGER">MANAGER</option>
                  <option value="VIEWER">VIEWER</option>
                </select>
              </div>
            </div>
          ))}
        </div>

        <h4 className="mb-2 text-xs font-semibold text-neutral-300">Лог действий</h4>
        <div className="max-h-56 space-y-1.5 overflow-y-auto text-[11px]">
          {logs.map((log) => (
            <div key={log.id} className="rounded-lg border border-neutral-800 bg-neutral-950 p-2">
              <div>{log.action} - {log.entityType}</div>
              <div className="text-neutral-500">{new Date(log.createdAt).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ReportsView({ accountId }: { accountId: string }) {
  const [managers, setManagers] = useState<ManagerReportSummary[]>([]);
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [rows, setRows] = useState<ManagerClientReportItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const loadManagers = () => {
    api.getReportManagers(accountId).then((data) => {
      setManagers(data);
      if (!selectedBotId && data[0]) setSelectedBotId(data[0].id);
    });
  };

  const loadRows = () => {
    if (!selectedBotId) {
      setRows([]);
      return;
    }
    api.getManagerReport(accountId, selectedBotId).then(setRows).catch(() => setRows([]));
  };

  useEffect(() => {
    loadManagers();
  }, [accountId]);

  useEffect(() => {
    loadRows();
  }, [accountId, selectedBotId]);

  const runAnalysis = async () => {
    setIsRunning(true);
    try {
      await api.runAnalysis(accountId, selectedBotId || undefined);
      loadManagers();
      loadRows();
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="grid h-[calc(100vh-94px)] grid-cols-1 gap-3 lg:grid-cols-[280px_1fr]">
      <aside className="min-h-0 rounded-2xl border border-neutral-800 bg-neutral-900/70 p-3">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Менеджеры</h3>
          <button
            onClick={runAnalysis}
            disabled={isRunning}
            className="rounded-lg bg-violet-500 px-3 py-1.5 text-xs text-white disabled:opacity-50"
          >
            {isRunning ? 'Анализ...' : 'Запустить AI анализ'}
          </button>
        </div>

        <div className="space-y-2 overflow-y-auto">
          {managers.map((manager) => (
            <button
              key={manager.id}
              onClick={() => setSelectedBotId(manager.id)}
              className={cx(
                'w-full rounded-xl border p-2 text-left text-xs',
                selectedBotId === manager.id
                  ? 'border-violet-500/40 bg-violet-500/10'
                  : 'border-neutral-800 bg-neutral-950',
              )}
            >
              <div className="font-semibold">{manager.name}</div>
              <div className="mt-1 text-neutral-400">Клиентов: {manager.clientsCount}</div>
              <div className="text-neutral-400">Архив: {manager.archivedCount}</div>
              <div className="text-neutral-400">Средний балл: {manager.avgScore}</div>
              <div className={manager.criticalCount > 0 ? 'text-rose-300' : 'text-emerald-300'}>
                Критические: {manager.criticalCount}
              </div>
            </button>
          ))}
        </div>
      </aside>

      <section className="min-h-0 rounded-2xl border border-neutral-800 bg-neutral-900/70 p-3">
        <h3 className="mb-3 text-sm font-semibold">Отчет по клиентам менеджера</h3>
        <div className="max-h-[calc(100vh-180px)] overflow-auto rounded-xl border border-neutral-800">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-neutral-950 text-neutral-300">
              <tr>
                <th className="px-2 py-2">Клиент</th>
                <th className="px-2 py-2">Кружки</th>
                <th className="px-2 py-2">Фото</th>
                <th className="px-2 py-2">Голос</th>
                <th className="px-2 py-2">Ответ, сек</th>
                <th className="px-2 py-2">Вечер</th>
                <th className="px-2 py-2">Темы</th>
                <th className="px-2 py-2">Остался на след. день</th>
                <th className="px-2 py-2">Архив</th>
                <th className="px-2 py-2">Оценка</th>
                <th className="px-2 py-2">Проблемы</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.chatId} className="border-t border-neutral-800">
                  <td className="px-2 py-2">{row.title || (row.username ? `@${row.username}` : row.telegramChatId)}</td>
                  <td className="px-2 py-2">{row.videoNotesCount}</td>
                  <td className="px-2 py-2">{row.photosCount}</td>
                  <td className="px-2 py-2">{row.voiceCount}</td>
                  <td className="px-2 py-2">{row.avgResponseTimeSec ? Math.round(row.avgResponseTimeSec) : '-'}</td>
                  <td className="px-2 py-2">{row.eveningMsgCount}</td>
                  <td className="px-2 py-2">{row.topicsCount}</td>
                  <td className="px-2 py-2">{row.newChatsNextDay == null ? '-' : row.newChatsNextDay ? 'Да' : 'Нет'}</td>
                  <td className="px-2 py-2">{row.isArchived ? `Да (${row.archiveReason || '-'})` : 'Нет'}</td>
                  <td className={cx('px-2 py-2 font-semibold', row.qualityScore < 50 ? 'text-rose-300' : 'text-emerald-300')}>
                    {Math.round(row.qualityScore)}
                  </td>
                  <td className="px-2 py-2">
                    <div className="space-y-1">
                      {row.qualityIssues.map((issue, index) => (
                        <div key={`${row.chatId}-${index}`} className={issue.level === 'CRITICAL' ? 'text-rose-300' : 'text-amber-300'}>
                          {issue.text}
                        </div>
                      ))}
                      {!row.qualityIssues.length && <span className="text-neutral-500">Нет</span>}
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={11} className="px-2 py-6 text-center text-neutral-500">
                    Нет данных. Запусти AI анализ.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ClientsView({ accountId }: { accountId: string }) {
  const [q, setQ] = useState('');
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [details, setDetails] = useState<ClientDetails | null>(null);

  useEffect(() => {
    api.getClients(accountId, q).then((data) => {
      setClients(data);
      if (!selectedChatId && data[0]) setSelectedChatId(data[0].chatId);
    });
  }, [accountId, q]);

  useEffect(() => {
    if (!selectedChatId) {
      setDetails(null);
      return;
    }
    api.getClientDetails(selectedChatId).then(setDetails).catch(() => setDetails(null));
  }, [selectedChatId]);

  return (
    <div className="grid h-[calc(100vh-94px)] grid-cols-1 gap-3 lg:grid-cols-[360px_1fr]">
      <aside className="min-h-0 rounded-2xl border border-neutral-800 bg-neutral-900/70 p-3">
        <h3 className="mb-2 text-sm font-semibold">База клиентов</h3>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск клиента"
          className="mb-3 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-2.5 py-2 text-sm outline-none focus:border-violet-500"
        />
        <div className="space-y-2 overflow-y-auto">
          {clients.map((client) => (
            <button
              key={client.chatId}
              onClick={() => setSelectedChatId(client.chatId)}
              className={cx(
                'w-full rounded-xl border p-2 text-left text-xs',
                selectedChatId === client.chatId
                  ? 'border-violet-500/40 bg-violet-500/10'
                  : 'border-neutral-800 bg-neutral-950',
              )}
            >
              <div className="font-semibold">{client.displayName}</div>
              <div className="text-neutral-400">Менеджер: {client.manager}</div>
              <div className={client.hasCritical ? 'text-rose-300' : 'text-emerald-300'}>
                Балл: {Math.round(client.qualityScore)}
              </div>
            </button>
          ))}
        </div>
      </aside>

      <section className="min-h-0 rounded-2xl border border-neutral-800 bg-neutral-900/70 p-3">
        {!details ? (
          <div className="text-sm text-neutral-500">Выбери клиента слева</div>
        ) : (
          <div className="space-y-3 overflow-y-auto text-sm">
            <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
              <div className="font-semibold">{details.clientProfile?.displayName || details.chat.title || details.chat.telegramChatId}</div>
              <div className="text-xs text-neutral-400">Менеджер: {details.manager?.name || 'Не назначен'}</div>
              <div className="mt-2 text-xs text-neutral-300">Архив: {details.chat.isArchived ? `Да (${details.chat.archiveReason || '-'})` : 'Нет'}</div>
            </div>

            <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
              <h4 className="mb-2 text-xs font-semibold text-neutral-300">Профиль клиента</h4>
              <div className="grid grid-cols-1 gap-1 text-xs md:grid-cols-2">
                <div>Хобби: {(details.clientProfile?.hobbies || []).join(', ') || '-'}</div>
                <div>Родом: {details.clientProfile?.hometown || '-'}</div>
                <div>Отношения: {details.clientProfile?.maritalStatus || '-'}</div>
                <div>Дети: {details.clientProfile?.hasKids == null ? '-' : details.clientProfile.hasKids ? 'Да' : 'Нет'}</div>
                <div>Питомцы: {details.clientProfile?.hasPets == null ? '-' : details.clientProfile.hasPets ? 'Да' : 'Нет'}</div>
                <div>Кухня: {details.clientProfile?.favoriteCuisine || '-'}</div>
                <div>Готовит: {details.clientProfile?.canCook == null ? '-' : details.clientProfile.canCook ? 'Да' : 'Нет'}</div>
                <div>Фильмы: {(details.clientProfile?.favoriteMovies || []).join(', ') || '-'}</div>
                <div>Путешествия: {(details.clientProfile?.travelPlaces || []).join(', ') || '-'}</div>
                <div>Образование: {details.clientProfile?.education || '-'}</div>
                <div>Работа: {details.clientProfile?.currentJob || '-'}</div>
                <div>Вредные привычки: {(details.clientProfile?.badHabits || []).join(', ') || '-'}</div>
                <div>Мечты: {details.clientProfile?.dreams || '-'}</div>
                <div>Страхи: {details.clientProfile?.fears || '-'}</div>
                <div>Финансы: {details.clientProfile?.financialInfo || '-'}</div>
              </div>
            </div>

            <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
              <h4 className="mb-2 text-xs font-semibold text-neutral-300">Последние сообщения</h4>
              <div className="space-y-2 text-xs">
                {details.recentMessages.map((message) => (
                  <div key={message.id} className="rounded-lg border border-neutral-800 bg-neutral-900 p-2">
                    <div className="text-neutral-400">
                      {message.user?.username || message.user?.firstName || message.user?.telegramUserId || 'unknown'}
                    </div>
                    <div>{message.text || '[медиа]'}</div>
                    <div className="text-neutral-500">{new Date(message.sentAt).toLocaleString()}</div>
                  </div>
                ))}
                {!details.recentMessages.length && <div className="text-neutral-500">Нет сообщений</div>}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function AnalyticsView({ accountId }: { accountId: string }) {
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await api.getChannelsStats(accountId);
      setStats(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load channel stats:', error);
      setStats([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [accountId]);

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Аналитика каналов менеджеров</h2>
        <button
          onClick={loadStats}
          disabled={loading}
          className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-white hover:bg-violet-400 disabled:opacity-50"
        >
          {loading ? 'Загрузка...' : 'Обновить'}
        </button>
      </div>

      <div className="space-y-2">
        {stats.length === 0 ? (
          <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-4 text-center text-neutral-400">
            {loading ? 'Загрузка данных...' : 'Нет данных'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-300">Менеджер</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-300">Канал</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-300">Подписчики</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-300">Обновлено</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-300">Статус</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((stat, idx) => (
                  <tr key={idx} className="border-b border-neutral-800/50 hover:bg-neutral-800/30">
                    <td className="px-4 py-3">{stat.managerName || 'Неизвестно'}</td>
                    <td className="px-4 py-3">
                      <a
                        href={`https://t.me/${stat.channelUsername}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-violet-400 hover:underline"
                      >
                        @{stat.channelUsername}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      {stat.error ? (
                        <span className="text-rose-400">{stat.error}</span>
                      ) : (
                        <span className="font-semibold text-emerald-400">{stat.subscriberCount?.toLocaleString() || '—'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-500">
                      {stat.lastUpdated ? new Date(stat.lastUpdated).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {stat.error ? (
                        <span className="flex items-center gap-1 text-rose-400">
                          <span className="inline-block h-2 w-2 rounded-full bg-rose-400"></span>
                          Ошибка
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-emerald-400">
                          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400"></span>
                          ОК
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-neutral-800/50 bg-neutral-950/50 p-3 text-xs text-neutral-400">
        <p>Отображает количество подписчиков в каналах менеджеров из Telegram Business API</p>
        <p className="mt-2">Требует Premium аккаунт и активный токен бота</p>
      </div>
    </div>
  );
}