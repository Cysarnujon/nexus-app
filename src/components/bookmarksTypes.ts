export type BookmarkStatus =
  | 'unread'
  | 'read'
  | 'in_progress'
  | 'completed';

export type BookmarkViewMode = 'list' | 'card' | 'compact';

export interface BookmarkCollection {
  id: string;
  parentId: string | null;
  name: string;
  isPinned: boolean;
  isFavorite: boolean;
  isArchived?: boolean;
  createdAt: number;
}

export interface BookmarkItem {
  id: string;
  url: string;
  title: string;
  description: string;
  domain: string;
  collectionId: string | null;
  tags: string[];
  status: BookmarkStatus;
  isPinned: boolean;
  isFavorite: boolean;
  isArchived: boolean;
  isTrashed: boolean;
  expiresAt: number | null;
  openCount: number;
  lastOpenedAt: number | null;
  notes: string;
  createdAt: number;
}

export interface BookmarkNote {
  id: string;
  title: string;
  body: string;
  tags: string[];
  isPinned: boolean;
  linkedUrl?: string;
  createdAt: number;
  updatedAt: number;
}

export interface BookmarksStore {
  collections: BookmarkCollection[];
  bookmarks: BookmarkItem[];
  notes: BookmarkNote[];
  tags: string[];
}

export const STARTER_BOOKMARK_TAGS: string[] = [
  'alimentação',
  'animes',
  'anotações',
  'assistindo',
  'beatmaker',
  'esporte',
  'espiritualidade',
  'finanças',
  'humor',
  'inteligência artificial',
  'investimento',
  'jogos',
  'loja de apps',
  'minimalismo',
  'notícias',
  'podcast',
];

export const DEFAULT_BOOKMARKS_STORE: BookmarksStore = {
  collections: [
    {
      id: 'col-watch',
      parentId: null,
      name: 'assistindo',
      isPinned: true,
      isFavorite: false,
      createdAt: Date.now(),
    },
    {
      id: 'col-read',
      parentId: null,
      name: 'ler depois',
      isPinned: false,
      isFavorite: false,
      createdAt: Date.now(),
    },
  ],
  bookmarks: [],
  notes: [],
  tags: STARTER_BOOKMARK_TAGS,
};

export function extractDomain(rawUrl: string): string {
  try {
    const clean = rawUrl.replace(/^https?:\/\//i, '').split('/')[0];
    return clean.replace(/^www\./i, '') || 'web';
  } catch {
    return 'web';
  }
}

export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function formatRelativeTimePt(ts: number): string {
  const diffMin = Math.max(1, Math.floor((Date.now() - ts) / 60000));
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `há ${diffHrs} h`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 30) return `há ${diffDays} dia(s)`;
  const diffMonths = Math.floor(diffDays / 30);
  return `há ${diffMonths} mês(es)`;
}

export async function fetchPageMetadata(
  rawUrl: string
): Promise<{ title: string; description: string }> {
  const url = normalizeUrl(rawUrl);
  const res = await fetch(url);
  const html = await res.text();
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const descMatch =
    html.match(
      /<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["'][^>]*>/i
    ) ||
    html.match(
      /<meta[^>]*property=["']og:description["'][^>]*content=["']([\s\S]*?)["'][^>]*>/i
    );

  const decode = (s: string) =>
    s
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();

  return {
    title: decode(titleMatch?.[1] ?? extractDomain(url)),
    description: decode(descMatch?.[1] ?? '').slice(0, 180),
  };
}

export function bookmarksToCsv(items: BookmarkItem[]): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = 'title,url,description,tags,status';
  const rows = items.map((b) =>
    [
      esc(b.title),
      esc(b.url),
      esc(b.description),
      esc(b.tags.join(';')),
      esc(b.status),
    ].join(',')
  );
  return [header, ...rows].join('\n');
}

export function bookmarksToHtml(items: BookmarkItem[]): string {
  const links = items
    .map(
      (b) =>
        `<DT><A HREF="${b.url}">${b.title}</A><DD>${b.description} [${b.tags.join(', ')}]`
    )
    .join('\n');
  return `<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<TITLE>Nexus Marcadores</TITLE>\n<H1>Marcadores</H1>\n<DL><p>\n${links}\n</DL><p>`;
}

export function parseImportedTextUrls(rawText: string): string[] {
  const lines = rawText
    .split(/[\n,]+/)
    .map((l) => l.trim().replace(/^"|"$/g, ''))
    .filter((l) => l.includes('.') && !l.includes(' '));
  return Array.from(new Set(lines.map(normalizeUrl)));
}
