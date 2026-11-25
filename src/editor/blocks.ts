export type BlockType =
  | 'paragraph'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bullet'
  | 'numbered'
  | 'todo'
  | 'quote'
  | 'callout'
  | 'code'
  | 'toggle'
  | 'table'
  | 'divider';

export type BlockColor =
  | 'default'
  | 'indigo'
  | 'sky'
  | 'emerald'
  | 'amber'
  | 'purple'
  | 'rose';

export type CalloutVariant = 'info' | 'success' | 'warning' | 'error';

export interface EditorBlock {
  id: string;
  type: BlockType;
  text: string;
  checked?: boolean;
  color?: BlockColor;
  calloutVariant?: CalloutVariant;
  toggleBody?: string;
  isOpen?: boolean;
  tableData?: string[][];
}

interface SerializedBlocksV3 {
  v: 3;
  blocks: EditorBlock[];
}

let blockSeq = 0;

export function createBlock(
  type: BlockType = 'paragraph',
  text = '',
  extra?: Partial<EditorBlock>
): EditorBlock {
  blockSeq += 1;
  return {
    id: `${Date.now()}-${blockSeq}-${Math.floor(Math.random() * 10000)}`,
    type,
    text,
    checked: type === 'todo' ? false : undefined,
    color: 'default',
    calloutVariant: type === 'callout' ? 'info' : undefined,
    toggleBody: type === 'toggle' ? '' : undefined,
    isOpen: type === 'toggle' ? true : undefined,
    tableData:
      type === 'table'
        ? [
            ['Coluna 1', 'Coluna 2'],
            ['', ''],
            ['', ''],
          ]
        : undefined,
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
    if (line === '') {
      continue;
    }

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
              return b.tableData.map((row) => row.join(' ')).join('\n');
            }
            if (b.type === 'toggle' && b.toggleBody) {
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
    if (b.type === 'numbered') {
      numCounter += 1;
    } else {
      numCounter = 0;
    }

    switch (b.type) {
      case 'h1':
        lines.push(`# ${b.text}`);
        break;
      case 'h2':
        lines.push(`## ${b.text}`);
        break;
      case 'h3':
        lines.push(`### ${b.text}`);
        break;
      case 'bullet':
        lines.push(`- ${b.text}`);
        break;
      case 'numbered':
        lines.push(`${numCounter}. ${b.text}`);
        break;
      case 'todo':
        lines.push(`- [${b.checked ? 'x' : ' '}] ${b.text}`);
        break;
      case 'quote':
        lines.push(`> ${b.text}`);
        break;
      case 'callout':
        lines.push(`> **Aviso:** ${b.text}`);
        break;
      case 'code':
        lines.push('```');
        lines.push(b.text);
        lines.push('```');
        break;
      case 'toggle':
        lines.push(`### ▸ ${b.text}`);
        if (b.toggleBody) lines.push(b.toggleBody);
        break;
      case 'divider':
        lines.push('---');
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
      default:
        if (b.text.trim().length > 0) {
          lines.push(b.text);
        }
        break;
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}

export function detectMarkdownShortcut(
  text: string
): { type: BlockType; cleanText: string } | null {
  if (text.startsWith('### ')) {
    return { type: 'h3', cleanText: text.slice(4) };
  }
  if (text.startsWith('## ')) {
    return { type: 'h2', cleanText: text.slice(3) };
  }
  if (text.startsWith('# ')) {
    return { type: 'h1', cleanText: text.slice(2) };
  }
  if (text.startsWith('[] ') || text.startsWith('[ ] ')) {
    return {
      type: 'todo',
      cleanText: text.replace(/^\[ ?\] /, ''),
    };
  }
  if (text.startsWith('- ') || text.startsWith('* ')) {
    return { type: 'bullet', cleanText: text.slice(2) };
  }
  if (text.startsWith('1. ')) {
    return { type: 'numbered', cleanText: text.slice(3) };
  }
  if (text.startsWith('> ')) {
    return { type: 'quote', cleanText: text.slice(2) };
  }
  if (text === '---') {
    return { type: 'divider', cleanText: '' };
  }
  if (text === '```') {
    return { type: 'code', cleanText: '' };
  }
  return null;
}

export const BLOCK_TYPE_OPTIONS: {
  type: BlockType;
  label: string;
  icon: string;
  hint: string;
}[] = [
  { type: 'paragraph', label: 'Texto', icon: '¶', hint: 'Parágrafo simples' },
  { type: 'h1', label: 'Título 1', icon: 'H1', hint: 'Atalho: # ' },
  { type: 'h2', label: 'Título 2', icon: 'H2', hint: 'Atalho: ## ' },
  { type: 'h3', label: 'Título 3', icon: 'H3', hint: 'Atalho: ### ' },
  { type: 'todo', label: 'Checklist', icon: '☑', hint: 'Atalho: [] ' },
  { type: 'bullet', label: 'Lista', icon: '•', hint: 'Atalho: - ' },
  { type: 'numbered', label: 'Numerada', icon: '1.', hint: 'Atalho: 1. ' },
  { type: 'table', label: 'Tabela', icon: '⊞', hint: 'Linhas e colunas' },
  { type: 'quote', label: 'Citação', icon: '❝', hint: 'Atalho: > ' },
  { type: 'callout', label: 'Bloco Aviso', icon: '💡', hint: 'Destaque colorido' },
  { type: 'toggle', label: 'Expansível', icon: '▸', hint: 'Bloco recolhível' },
  { type: 'code', label: 'Código', icon: '</>', hint: 'Atalho: ```' },
  { type: 'divider', label: 'Divisor', icon: '—', hint: 'Atalho: ---' },
];

export const COLOR_PALETTE: {
  key: BlockColor;
  label: string;
  textHex: string;
  bgHex: string;
}[] = [
  { key: 'default', label: 'Padrão', textHex: '#CBD5E1', bgHex: 'transparent' },
  { key: 'indigo', label: 'Índigo', textHex: '#A5B4FC', bgHex: 'rgba(99, 102, 241, 0.14)' },
  { key: 'sky', label: 'Azul', textHex: '#7DD3FC', bgHex: 'rgba(14, 165, 233, 0.14)' },
  { key: 'emerald', label: 'Verde', textHex: '#6EE7B7', bgHex: 'rgba(16, 185, 129, 0.14)' },
  { key: 'amber', label: 'Âmbar', textHex: '#FCD34D', bgHex: 'rgba(245, 158, 11, 0.14)' },
  { key: 'purple', label: 'Roxo', textHex: '#D8B4FE', bgHex: 'rgba(168, 85, 247, 0.14)' },
  { key: 'rose', label: 'Rosa', textHex: '#FDA4AF', bgHex: 'rgba(244, 63, 94, 0.14)' },
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
        createBlock('h2', 'Próximas Ações'),
        createBlock('todo', 'Definir escopo inicial'),
        createBlock('todo', 'Executar primeira entrega'),
        createBlock('h2', 'Cronograma'),
        createBlock('table', '', {
          tableData: [
            ['Etapa', 'Prazo', 'Status'],
            ['Planejamento', 'Semana 1', 'Em andamento'],
            ['Execução', 'Semana 2', 'Pendente'],
          ],
        }),
        createBlock('paragraph', '#projeto #metas'),
      ]);

    case 'study':
      return serializeBlocks([
        createBlock('h2', 'Ideias Principais'),
        createBlock('bullet', 'Ponto-chave 1'),
        createBlock('bullet', 'Ponto-chave 2'),
        createBlock('h2', 'Perguntas para Revisão'),
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
