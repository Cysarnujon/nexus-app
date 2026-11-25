export type BlockType =
  | 'paragraph'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'subtitle'
  | 'caption'
  | 'small'
  | 'preformatted'
  | 'bullet'
  | 'numbered'
  | 'todo'
  | 'steps'
  | 'definition'
  | 'toggle'
  | 'toggle_h1'
  | 'toggle_h2'
  | 'quote'
  | 'callout'
  | 'code'
  | 'math'
  | 'footnote'
  | 'divider'
  | 'pagebreak'
  | 'table'
  | 'kanban'
  | 'chart'
  | 'tabs'
  | 'timeline'
  | 'toc'
  | 'button'
  | 'bookmark'
  | 'image'
  | 'gallery'
  | 'video'
  | 'audio'
  | 'file';

export type BlockColor =
  | 'default'
  | 'indigo'
  | 'sky'
  | 'emerald'
  | 'amber'
  | 'purple'
  | 'rose';

export type CalloutVariant =
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'question'
  | 'answer';

export type TextAlignMode = 'left' | 'center' | 'right' | 'justify';

export interface KanbanCard {
  id: string;
  text: string;
}

export interface KanbanColumn {
  id: string;
  title: string;
  cards: KanbanCard[];
}

export interface ChartItem {
  id: string;
  label: string;
  value: number;
  color: string;
}

export interface TabItem {
  id: string;
  title: string;
  body: string;
}

export interface TimelineItem {
  id: string;
  date: string;
  title: string;
}

export interface EditorBlock {
  id: string;
  type: BlockType;
  text: string;
  checked?: boolean;
  color?: BlockColor;
  align?: TextAlignMode;
  indent?: number;
  calloutVariant?: CalloutVariant;
  toggleBody?: string;
  isOpen?: boolean;
  defTerm?: string;
  tableData?: string[][];
  tableAlign?: 'left' | 'center' | 'right';
  kanbanData?: { columns: KanbanColumn[] };
  chartData?: ChartItem[];
  tabsData?: TabItem[];
  timelineData?: TimelineItem[];
  url?: string;
  buttonAction?: 'url' | 'note' | 'todo';
  mediaUri?: string;
  mediaName?: string;
  mediaSize?: number;
  mediaMime?: string;
  galleryUris?: string[];
}

export interface EditorTheme {
  isDark: boolean;
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  textDim: string;
  accent: string;
}

export const DARK_THEME: EditorTheme = {
  isDark: true,
  bg: '#0B0F17',
  surface: '#111827',
  surfaceAlt: '#1E293B',
  border: '#1E293B',
  text: '#F8FAFC',
  textMuted: '#CBD5E1',
  textDim: '#64748B',
  accent: '#6366F1',
};

export const LIGHT_THEME: EditorTheme = {
  isDark: false,
  bg: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceAlt: '#E2E8F0',
  border: '#CBD5E1',
  text: '#0F172A',
  textMuted: '#334155',
  textDim: '#64748B',
  accent: '#4F46E5',
};

export interface EditorPrefs {
  fontSize: 'small' | 'normal' | 'large';
  lineHeight: 'compact' | 'normal' | 'wide';
  fontFamily: 'default' | 'serif' | 'mono';
}

export const DEFAULT_EDITOR_PREFS: EditorPrefs = {
  fontSize: 'normal',
  lineHeight: 'normal',
  fontFamily: 'default',
};

interface SerializedBlocksV3 {
  v: 3;
  blocks: EditorBlock[];
}

let blockSeq = 0;

export function makeId(prefix = 'b'): string {
  blockSeq += 1;
  return `${prefix}-${Date.now()}-${blockSeq}-${Math.floor(Math.random() * 10000)}`;
}

export function createBlock(
  type: BlockType = 'paragraph',
  text = '',
  extra?: Partial<EditorBlock>
): EditorBlock {
  const isToggleLike =
    type === 'toggle' || type === 'toggle_h1' || type === 'toggle_h2';

  return {
    id: makeId('blk'),
    type,
    text,
    checked: type === 'todo' ? false : undefined,
    color: 'default',
    align: 'left',
    indent: 0,
    calloutVariant: type === 'callout' ? 'info' : undefined,
    toggleBody: isToggleLike ? '' : undefined,
    isOpen: isToggleLike ? true : undefined,
    defTerm: type === 'definition' ? 'Termo' : undefined,
    tableData:
      type === 'table'
        ? [
            ['Coluna 1', 'Coluna 2'],
            ['', ''],
            ['', ''],
          ]
        : undefined,
    tableAlign: type === 'table' ? 'left' : undefined,
    kanbanData:
      type === 'kanban'
        ? {
            columns: [
              {
                id: makeId('col'),
                title: 'A Fazer',
                cards: [{ id: makeId('crd'), text: 'Nova tarefa' }],
              },
              { id: makeId('col'), title: 'Fazendo', cards: [] },
              { id: makeId('col'), title: 'Feito', cards: [] },
            ],
          }
        : undefined,
    chartData:
      type === 'chart'
        ? [
            { id: makeId('ch'), label: 'Meta A', value: 75, color: '#6366F1' },
            { id: makeId('ch'), label: 'Meta B', value: 45, color: '#38BDF8' },
            { id: makeId('ch'), label: 'Meta C', value: 90, color: '#34D399' },
          ]
        : undefined,
    tabsData:
      type === 'tabs'
        ? [
            { id: makeId('tb'), title: 'Resumo', body: 'Conteúdo da aba 1...' },
            { id: makeId('tb'), title: 'Detalhes', body: 'Conteúdo da aba 2...' },
          ]
        : undefined,
    timelineData:
      type === 'timeline'
        ? [
            { id: makeId('tl'), date: 'Etapa 1', title: 'Início do projeto' },
            { id: makeId('tl'), date: 'Etapa 2', title: 'Entrega principal' },
          ]
        : undefined,
    url: type === 'bookmark' ? 'https://' : type === 'button' ? '' : undefined,
    buttonAction: type === 'button' ? 'todo' : undefined,
    galleryUris: type === 'gallery' ? [] : undefined,
    ...extra,
  };
}

export function serializeBlocks(blocks: EditorBlock[]): string {
  const payload: SerializedBlocksV3 = {
    v: 3,
    blocks,
  };
  return JSON.stringify(payload);
}

export function parseContentToBlocks(content: string): EditorBlock[] {
  const trimmed = content.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as Partial<SerializedBlocksV3>;
      if (parsed.v === 3 && Array.isArray(parsed.blocks)) {
        return parsed.blocks.length > 0
          ? parsed.blocks
          : [createBlock('paragraph', '')];
      }
    } catch {
      // Fallback para texto simples
    }
  }

  if (!trimmed) {
    return [createBlock('paragraph', '')];
  }

  const lines = content.split('\n');
  const blocks: EditorBlock[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line === '') continue;

    if (line.startsWith('### ')) {
      blocks.push(createBlock('h3', line.slice(4)));
    } else if (line.startsWith('## ')) {
      blocks.push(createBlock('h2', line.slice(3)));
    } else if (line.startsWith('# ')) {
      blocks.push(createBlock('h1', line.slice(2)));
    } else if (/^-\s*\[x\]\s*/i.test(line)) {
      blocks.push(
        createBlock('todo', line.replace(/^-\s*\[x\]\s*/i, ''), {
          checked: true,
        })
      );
    } else if (/^-\s*\[\s*\]\s*/.test(line)) {
      blocks.push(
        createBlock('todo', line.replace(/^-\s*\[\s*\]\s*/, ''), {
          checked: false,
        })
      );
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      blocks.push(createBlock('bullet', line.slice(2)));
    } else if (/^\d+\.\s+/.test(line)) {
      blocks.push(createBlock('numbered', line.replace(/^\d+\.\s+/, '')));
    } else if (line.startsWith('> ')) {
      blocks.push(createBlock('quote', line.slice(2)));
    } else if (line === '---') {
      blocks.push(createBlock('divider', ''));
    } else {
      blocks.push(createBlock('paragraph', line));
    }
  }

  return blocks.length > 0 ? blocks : [createBlock('paragraph', '')];
}

export function extractPlainTextFromContent(content: string): string {
  const trimmed = content.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as Partial<SerializedBlocksV3>;
      if (parsed.v === 3 && Array.isArray(parsed.blocks)) {
        return parsed.blocks
          .map((b) => {
            if (b.type === 'table' && Array.isArray(b.tableData)) {
              return b.tableData.map((r) => r.join(' ')).join('\n');
            }
            if (b.type === 'kanban' && b.kanbanData) {
              return b.kanbanData.columns
                .map((c) => `${c.title} ${c.cards.map((x) => x.text).join(' ')}`)
                .join('\n');
            }
            if (b.type === 'chart' && Array.isArray(b.chartData)) {
              return b.chartData.map((c) => `${c.label} ${c.value}`).join(' ');
            }
            if (b.type === 'tabs' && Array.isArray(b.tabsData)) {
              return b.tabsData.map((t) => `${t.title} ${t.body}`).join('\n');
            }
            if (b.type === 'timeline' && Array.isArray(b.timelineData)) {
              return b.timelineData
                .map((t) => `${t.date} ${t.title}`)
                .join('\n');
            }
            if (b.type === 'definition') {
              return `${b.defTerm ?? ''}: ${b.text}`;
            }
            if (
              b.type === 'image' ||
              b.type === 'video' ||
              b.type === 'audio' ||
              b.type === 'file'
            ) {
              return [b.mediaName ?? '', b.text].filter(Boolean).join(' ');
            }
            if (b.toggleBody) {
              return `${b.text}\n${b.toggleBody}`;
            }
            return b.text;
          })
          .filter((t) => t.trim().length > 0)
          .join('\n');
      }
    } catch {
      return content;
    }
  }
  return content;
}

export function blocksToMarkdown(title: string, rawContent: string): string {
  const blocks = parseContentToBlocks(rawContent);
  const lines: string[] = [`# ${title}`, ''];
  let numCounter = 0;

  for (const b of blocks) {
    if (b.type === 'numbered' || b.type === 'steps') {
      numCounter += 1;
    } else {
      numCounter = 0;
    }

    switch (b.type) {
      case 'h1':
      case 'toggle_h1':
        lines.push(`# ${b.text}`);
        if (b.toggleBody) lines.push(b.toggleBody);
        break;
      case 'h2':
      case 'toggle_h2':
        lines.push(`## ${b.text}`);
        if (b.toggleBody) lines.push(b.toggleBody);
        break;
      case 'h3':
        lines.push(`### ${b.text}`);
        break;
      case 'h4':
        lines.push(`#### ${b.text}`);
        break;
      case 'h5':
        lines.push(`##### ${b.text}`);
        break;
      case 'h6':
        lines.push(`###### ${b.text}`);
        break;
      case 'subtitle':
        lines.push(`*${b.text}*`);
        break;
      case 'bullet':
        lines.push(`- ${b.text}`);
        break;
      case 'numbered':
        lines.push(`${numCounter}. ${b.text}`);
        break;
      case 'steps':
        lines.push(`${numCounter}. **Passo ${numCounter}:** ${b.text}`);
        break;
      case 'definition':
        lines.push(`**${b.defTerm ?? 'Termo'}:** ${b.text}`);
        break;
      case 'todo':
        lines.push(`- [${b.checked ? 'x' : ' '}] ${b.text}`);
        break;
      case 'quote':
        lines.push(`> ${b.text}`);
        break;
      case 'callout':
        lines.push(`> **Destaque:** ${b.text}`);
        break;
      case 'math':
        lines.push('$$');
        lines.push(b.text);
        lines.push('$$');
        break;
      case 'code':
      case 'preformatted':
        lines.push('```');
        lines.push(b.text);
        lines.push('```');
        break;
      case 'footnote':
        lines.push(`[^1]: ${b.text}`);
        break;
      case 'toggle':
        lines.push(`### ▸ ${b.text}`);
        if (b.toggleBody) lines.push(b.toggleBody);
        break;
      case 'divider':
      case 'pagebreak':
        lines.push('---');
        break;
      case 'bookmark':
        lines.push(`[${b.text || b.url || 'Link'}](${b.url || ''})`);
        break;
      case 'image':
        lines.push(`![${b.text || b.mediaName || 'Imagem'}](${b.mediaUri ?? ''})`);
        break;
      case 'gallery':
        lines.push(`🖼️ **Galeria:** ${(b.galleryUris ?? []).length} imagem(ns) ${b.text}`);
        break;
      case 'video':
        lines.push(`🎬 **Vídeo:** ${b.text || b.mediaName || 'Anexo'}`);
        break;
      case 'audio':
        lines.push(`🎙 **Áudio:** ${b.text || b.mediaName || 'Nota de voz'}`);
        break;
      case 'file':
        lines.push(`📎 **Arquivo:** ${b.mediaName || b.text || 'Documento'}`);
        break;
      case 'table': {
        const rows = b.tableData ?? [];
        if (rows.length > 0) {
          const header = rows[0] ?? [];
          lines.push(`| ${header.map((c) => c || ' ').join(' | ')} |`);
          lines.push(`| ${header.map(() => '---').join(' | ')} |`);
          for (let r = 1; r < rows.length; r++) {
            lines.push(`| ${rows[r].map((c) => c || ' ').join(' | ')} |`);
          }
        }
        break;
      }
      case 'kanban':
        b.kanbanData?.columns.forEach((col) => {
          lines.push(`**${col.title}**`);
          col.cards.forEach((c) => lines.push(`- ${c.text}`));
        });
        break;
      case 'tabs':
        b.tabsData?.forEach((t) => {
          lines.push(`**${t.title}**`);
          lines.push(t.body);
        });
        break;
      case 'timeline':
        b.timelineData?.forEach((t) => {
          lines.push(`- **${t.date}:** ${t.title}`);
        });
        break;
      case 'chart':
        b.chartData?.forEach((c) => {
          lines.push(`- ${c.label}: ${c.value}`);
        });
        break;
      default:
        if (b.text.trim().length > 0) lines.push(b.text);
        break;
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}

export function stripInlineFormatting(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/==(.*?)==/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/\^(.*?)\^/g, '$1')
    .replace(/~(.*?)~/g, '$1');
}

export function detectMarkdownShortcut(
  text: string
): { type: BlockType; cleanText: string } | null {
  if (text.startsWith('###### ')) return { type: 'h6', cleanText: text.slice(7) };
  if (text.startsWith('##### ')) return { type: 'h5', cleanText: text.slice(6) };
  if (text.startsWith('#### ')) return { type: 'h4', cleanText: text.slice(5) };
  if (text.startsWith('### ')) return { type: 'h3', cleanText: text.slice(4) };
  if (text.startsWith('## ')) return { type: 'h2', cleanText: text.slice(3) };
  if (text.startsWith('# ')) return { type: 'h1', cleanText: text.slice(2) };
  if (text.startsWith('[] ') || text.startsWith('[ ] ')) {
    return { type: 'todo', cleanText: text.replace(/^\[ ?\] /, '') };
  }
  if (text.startsWith('- ') || text.startsWith('* ')) {
    return { type: 'bullet', cleanText: text.slice(2) };
  }
  if (text.startsWith('1. ')) return { type: 'numbered', cleanText: text.slice(3) };
  if (text.startsWith('> ')) return { type: 'quote', cleanText: text.slice(2) };
  if (text === '---') return { type: 'divider', cleanText: '' };
  if (text === '```') return { type: 'code', cleanText: '' };
  if (text === '$$') return { type: 'math', cleanText: '' };
  return null;
}

export interface BlockCategory {
  title: string;
  items: { type: BlockType; label: string; icon: string; hint: string }[];
}

export const BLOCK_CATEGORIES: BlockCategory[] = [
  {
    title: 'Mídia e Arquivos do Celular',
    items: [
      { type: 'image', label: 'Imagem / Foto', icon: '🖼️', hint: 'Galeria ou Câmera' },
      { type: 'gallery', label: 'Galeria de Fotos', icon: '🗂', hint: 'Várias imagens' },
      { type: 'video', label: 'Vídeo', icon: '🎬', hint: 'Reproduzir na nota' },
      { type: 'audio', label: 'Áudio / Voz', icon: '🎙', hint: 'Gravar ou anexar áudio' },
      { type: 'file', label: 'Arquivo / PDF', icon: '📎', hint: 'PDF, DOC, anexos...' },
    ],
  },
  {
    title: 'Blocos Básicos e Títulos',
    items: [
      { type: 'paragraph', label: 'Texto Normal', icon: '¶', hint: 'Parágrafo padrão' },
      { type: 'h1', label: 'Título 1 (H1)', icon: 'H1', hint: 'Atalho: # ' },
      { type: 'h2', label: 'Título 2 (H2)', icon: 'H2', hint: 'Atalho: ## ' },
      { type: 'h3', label: 'Título 3 (H3)', icon: 'H3', hint: 'Atalho: ### ' },
      { type: 'h4', label: 'Título 4 (H4)', icon: 'H4', hint: 'Atalho: #### ' },
      { type: 'h5', label: 'Título 5 (H5)', icon: 'H5', hint: 'Atalho: ##### ' },
      { type: 'h6', label: 'Título 6 (H6)', icon: 'H6', hint: 'Atalho: ###### ' },
      { type: 'subtitle', label: 'Subtítulo', icon: 'Sub', hint: 'Subtítulo suave' },
      { type: 'caption', label: 'Legenda', icon: 'Leg', hint: 'Texto descritivo' },
      { type: 'small', label: 'Texto Pequeno', icon: 'aa', hint: 'Nota discreta' },
      { type: 'preformatted', label: 'Pré-formatado', icon: 'Pre', hint: 'Fonte fixa' },
    ],
  },
  {
    title: 'Listas e Estrutura',
    items: [
      { type: 'todo', label: 'Checklist / Tarefas', icon: '☑', hint: 'Atalho: [] ' },
      { type: 'bullet', label: 'Lista Marcadores', icon: '•', hint: 'Atalho: - ' },
      { type: 'numbered', label: 'Lista Numerada', icon: '1.', hint: 'Atalho: 1. ' },
      { type: 'steps', label: 'Lista de Passos', icon: '⚑', hint: 'Passo 1, Passo 2...' },
      { type: 'definition', label: 'Lista Definições', icon: '≡', hint: 'Termo : Descrição' },
      { type: 'toggle', label: 'Bloco Expansível', icon: '▸', hint: 'Toggle recolhível' },
      { type: 'toggle_h1', label: 'H1 Alternável', icon: '▸H1', hint: 'Título H1 expansível' },
      { type: 'toggle_h2', label: 'H2 Alternável', icon: '▸H2', hint: 'Título H2 expansível' },
    ],
  },
  {
    title: 'Blocos Especiais',
    items: [
      { type: 'quote', label: 'Citação', icon: '❝', hint: 'Atalho: > ' },
      { type: 'callout', label: 'Bloco Aviso/Nota', icon: '💡', hint: 'Info, Erro, Pergunta...' },
      { type: 'code', label: 'Bloco de Código', icon: '</>', hint: 'Atalho: ```' },
      { type: 'math', label: 'Equação Matemática', icon: '∑', hint: 'Atalho: $$' },
      { type: 'footnote', label: 'Nota de Rodapé', icon: '1_', hint: 'Referência inferior' },
      { type: 'divider', label: 'Divisor Horizontal', icon: '—', hint: 'Atalho: ---' },
      { type: 'pagebreak', label: 'Quebra de Página', icon: '⤓', hint: 'Separador para PDF' },
    ],
  },
  {
    title: 'Tabelas, Dados e Componentes',
    items: [
      { type: 'table', label: 'Tabela', icon: '⊞', hint: 'Ordenar e alinhar' },
      { type: 'kanban', label: 'Quadro Kanban', icon: '▥', hint: 'Colunas e cartões' },
      { type: 'chart', label: 'Gráfico de Barras', icon: '📊', hint: 'Dados visuais' },
      { type: 'tabs', label: 'Guias / Abas', icon: '🗂', hint: 'Conteúdo em abas' },
      { type: 'timeline', label: 'Linha do Tempo', icon: '⏳', hint: 'Etapas cronológicas' },
      { type: 'toc', label: 'Índice Automático', icon: '📑', hint: 'Mapa dos títulos' },
      { type: 'button', label: 'Botão de Ação', icon: '🔘', hint: 'Ação rápida na nota' },
      { type: 'bookmark', label: 'Link Externo / Web', icon: '🌐', hint: 'Cartão de URL' },
    ],
  },
];

export const COLOR_PALETTE: {
  key: BlockColor;
  label: string;
  textHexDark: string;
  textHexLight: string;
  bgHex: string;
}[] = [
  { key: 'default', label: 'Padrão', textHexDark: '#CBD5E1', textHexLight: '#1E293B', bgHex: 'transparent' },
  { key: 'indigo', label: 'Índigo', textHexDark: '#A5B4FC', textHexLight: '#4338CA', bgHex: 'rgba(99, 102, 241, 0.14)' },
  { key: 'sky', label: 'Azul', textHexDark: '#7DD3FC', textHexLight: '#0369A1', bgHex: 'rgba(14, 165, 233, 0.14)' },
  { key: 'emerald', label: 'Verde', textHexDark: '#6EE7B7', textHexLight: '#047857', bgHex: 'rgba(16, 185, 129, 0.14)' },
  { key: 'amber', label: 'Âmbar', textHexDark: '#FCD34D', textHexLight: '#B45309', bgHex: 'rgba(245, 158, 11, 0.14)' },
  { key: 'purple', label: 'Roxo', textHexDark: '#D8B4FE', textHexLight: '#6D28D9', bgHex: 'rgba(168, 85, 247, 0.14)' },
  { key: 'rose', label: 'Rosa', textHexDark: '#FDA4AF', textHexLight: '#BE123C', bgHex: 'rgba(244, 63, 94, 0.14)' },
];

export type ToolbarToolId =
  | 'add_block'
  | 'convert_type'
  | 'undo'
  | 'redo'
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'highlight'
  | 'inline_code'
  | 'sup'
  | 'sub'
  | 'clear_fmt'
  | 'link'
  | 'tag'
  | 'color'
  | 'align'
  | 'indent_inc'
  | 'indent_dec'
  | 'date'
  | 'time'
  | 'find_replace'
  | 'move_up'
  | 'move_down'
  | 'duplicate'
  | 'delete';

export interface ToolbarToolDef {
  id: ToolbarToolId;
  icon: string;
  label: string;
}

export const ALL_TOOLBAR_TOOLS: ToolbarToolDef[] = [
  { id: 'add_block', icon: '+', label: 'Inserir bloco' },
  { id: 'convert_type', icon: '⇄', label: 'Alternar tipo do bloco' },
  { id: 'undo', icon: '↶', label: 'Desfazer' },
  { id: 'redo', icon: '↷', label: 'Refazer' },
  { id: 'link', icon: '[[]]', label: 'Adicionar link interno' },
  { id: 'tag', icon: '#', label: 'Adicionar etiqueta (#tag)' },
  { id: 'bold', icon: 'B', label: 'Negrito (**texto**)' },
  { id: 'italic', icon: 'I', label: 'Itálico (*texto*)' },
  { id: 'underline', icon: 'U', label: 'Sublinhado (__texto__)' },
  { id: 'strike', icon: 'S', label: 'Tachado (~~texto~~)' },
  { id: 'highlight', icon: '🖍', label: 'Destaque colorido (==texto==)' },
  { id: 'inline_code', icon: '</>', label: 'Código inline (`código`)' },
  { id: 'sup', icon: 'x²', label: 'Sobrescrito (^sup^)' },
  { id: 'sub', icon: 'x₂', label: 'Subscrito (~sub~)' },
  { id: 'clear_fmt', icon: '🧹', label: 'Limpar formatação' },
  { id: 'color', icon: '🎨', label: 'Cor / Fundo do bloco' },
  { id: 'align', icon: '☰', label: 'Alinhar texto (Esq/Centro/Dir/Just)' },
  { id: 'indent_inc', icon: '→|', label: 'Aumentar recuo' },
  { id: 'indent_dec', icon: '|←', label: 'Diminuir recuo' },
  { id: 'date', icon: '📅', label: 'Inserir data atual' },
  { id: 'time', icon: '🕒', label: 'Inserir hora atual' },
  { id: 'find_replace', icon: '🔍', label: 'Localizar e substituir' },
  { id: 'move_up', icon: '↑', label: 'Mover bloco para cima' },
  { id: 'move_down', icon: '↓', label: 'Mover bloco para baixo' },
  { id: 'duplicate', icon: '⎘', label: 'Duplicar bloco' },
  { id: 'delete', icon: '🗑', label: 'Excluir bloco' },
];

export const DEFAULT_TOOLBAR_IDS: ToolbarToolId[] = [
  'add_block',
  'convert_type',
  'undo',
  'redo',
  'link',
  'tag',
  'bold',
  'italic',
  'underline',
  'strike',
  'highlight',
  'color',
  'align',
  'indent_inc',
  'indent_dec',
  'date',
  'find_replace',
  'clear_fmt',
  'move_up',
  'move_down',
  'duplicate',
  'delete',
];

export interface PageTemplateOption {
  id: string;
  icon: string;
  label: string;
}

export const PAGE_TEMPLATES: PageTemplateOption[] = [
  { id: 'blank', icon: '📄', label: 'Em Branco' },
  { id: 'project', icon: '🚀', label: 'Projeto / Meta' },
  { id: 'study', icon: '📚', label: 'Resumo de Estudo' },
  { id: 'weekly', icon: '📅', label: 'Semana' },
  { id: 'finance', icon: '💰', label: 'Financeiro' },
];

export function buildTemplateContent(templateId: string): string {
  switch (templateId) {
    case 'project':
      return serializeBlocks([
        createBlock('callout', 'Objetivo principal deste projeto...', {
          calloutVariant: 'info',
        }),
        createBlock('toc', ''),
        createBlock('h2', 'Quadro de Tarefas'),
        createBlock('kanban', ''),
        createBlock('h2', 'Cronograma'),
        createBlock('timeline', ''),
        createBlock('paragraph', '#projeto #metas'),
      ]);

    case 'study':
      return serializeBlocks([
        createBlock('h2', 'Ideias Principais'),
        createBlock('bullet', 'Ponto-chave 1'),
        createBlock('bullet', 'Ponto-chave 2'),
        createBlock('h2', 'Glossário Rápido'),
        createBlock('definition', 'Explicação clara do conceito.', {
          defTerm: 'Conceito',
        }),
        createBlock('h2', 'Revisão Ativa'),
        createBlock('toggle', 'O que aprendi hoje?', {
          toggleBody: 'Escreva sua explicação com suas próprias palavras...',
          isOpen: true,
        }),
        createBlock('todo', 'Revisar conteúdo em 3 dias'),
        createBlock('paragraph', '#estudos #resumo'),
      ]);

    case 'weekly':
      return serializeBlocks([
        createBlock('h2', 'Prioridades da Semana'),
        createBlock('todo', 'Prioridade #1'),
        createBlock('todo', 'Prioridade #2'),
        createBlock('h2', 'Agenda'),
        createBlock('table', '', {
          tableData: [
            ['Dia', 'Foco Principal'],
            ['Segunda', ''],
            ['Terça', ''],
            ['Quarta', ''],
            ['Quinta', ''],
            ['Sexta', ''],
          ],
        }),
        createBlock('paragraph', '#semana #rotina'),
      ]);

    case 'finance':
      return serializeBlocks([
        createBlock('callout', 'Meta do mês: manter controle dos gastos.', {
          calloutVariant: 'success',
        }),
        createBlock('chart', ''),
        createBlock('table', '', {
          tableData: [
            ['Descrição', 'Categoria', 'Valor'],
            ['Salário / Entrada', 'Receita', 'R$ 0,00'],
            ['Despesa Fixa', 'Moradia', 'R$ 0,00'],
          ],
        }),
        createBlock('todo', 'Separar reserva de emergência'),
        createBlock('paragraph', '#financas #controle'),
      ]);

    default:
      return serializeBlocks([
        createBlock('paragraph', ''),
        createBlock('todo', 'Primeira tarefa'),
      ]);
  }
}
