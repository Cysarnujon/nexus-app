import { makeId } from '../editor/blocks';

export type MementoFieldType =
  | 'text'
  | 'number'
  | 'currency'
  | 'date'
  | 'checkbox'
  | 'select'
  | 'rating'
  | 'image'
  | 'formula'
  | 'relation'
  | 'link';

export interface MementoField {
  id: string;
  key: string;
  label: string;
  type: MementoFieldType;
  options?: string[];
  formulaExpr?: string;
  targetDbId?: string;
}

export interface MementoRule {
  id: string;
  triggerFieldKey: string;
  operator: 'equals' | 'contains' | 'gt' | 'lt';
  triggerValue: string;
  actionFieldKey: string;
  actionValue: string;
}

export interface MementoRecord {
  id: string;
  values: Record<string, string | number | boolean>;
  createdAt: number;
  updatedAt: number;
}

export interface MementoDatabase {
  id: string;
  name: string;
  icon: string;
  description: string;
  fields: MementoField[];
  records: MementoRecord[];
  rules: MementoRule[];
  createdAt: number;
}

export interface VibeMiniApp {
  id: string;
  title: string;
  description: string;
  htmlCode: string;
  versions: { htmlCode: string; savedAt: number }[];
  updatedAt: number;
}

export interface MementoStore {
  databases: MementoDatabase[];
  miniApps: VibeMiniApp[];
}

export const FIELD_TYPE_LABELS: { type: MementoFieldType; label: string; icon: string }[] = [
  { type: 'text', label: 'Texto', icon: 'Aa' },
  { type: 'number', label: 'Número', icon: '#' },
  { type: 'currency', label: 'Dinheiro (R$)', icon: '💰' },
  { type: 'date', label: 'Data', icon: '📅' },
  { type: 'checkbox', label: 'Caixa (Sim/Não)', icon: '☑' },
  { type: 'select', label: 'Lista de Opções', icon: '▾' },
  { type: 'rating', label: 'Avaliação (1-5 ★)', icon: '★' },
  { type: 'image', label: 'Foto / Imagem', icon: '🖼️' },
  { type: 'formula', label: 'Fórmula Calculada', icon: 'fx' },
  { type: 'relation', label: 'Relação (Outro Banco)', icon: '🔗' },
  { type: 'link', label: 'Link / Código', icon: '🌐' },
];

// Avaliador seguro de fórmulas matemáticas (+ - * / e parênteses)
export function evaluateFormula(
  expr: string,
  values: Record<string, string | number | boolean>
): number {
  if (!expr.trim()) return 0;
  let replaced = expr;
  for (const [k, v] of Object.entries(values)) {
    const num =
      typeof v === 'number'
        ? v
        : typeof v === 'boolean'
        ? v
          ? 1
          : 0
        : Number(String(v).replace(',', '.').replace(/[^0-9.-]/g, '')) || 0;
    const regex = new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
    replaced = replaced.replace(regex, String(num));
  }

  const tokens = replaced.match(/(\d+\.?\d*|\.\d+|[+\-*/()])/g);
  if (!tokens) return 0;
  let pos = 0;

  const parseExpr = (): number => {
    let val = parseTerm();
    while (tokens[pos] === '+' || tokens[pos] === '-') {
      const op = tokens[pos++];
      const rhs = parseTerm();
      val = op === '+' ? val + rhs : val - rhs;
    }
    return val;
  };

  const parseTerm = (): number => {
    let val = parseFactor();
    while (tokens[pos] === '*' || tokens[pos] === '/') {
      const op = tokens[pos++];
      const rhs = parseFactor();
      val = op === '*' ? val * rhs : rhs !== 0 ? val / rhs : 0;
    }
    return val;
  };

  const parseFactor = (): number => {
    const tok = tokens[pos];
    if (tok === '(') {
      pos++;
      const v = parseExpr();
      if (tokens[pos] === ')') pos++;
      return v;
    }
    if (tok === '-') {
      pos++;
      return -parseFactor();
    }
    pos++;
    const n = Number(tok);
    return isNaN(n) ? 0 : n;
  };

  try {
    const res = parseExpr();
    return isFinite(res) ? Number(res.toFixed(2)) : 0;
  } catch {
    return 0;
  }
}

export function applyAutomationRules(
  db: MementoDatabase,
  values: Record<string, string | number | boolean>
): Record<string, string | number | boolean> {
  const next = { ...values };
  for (const rule of db.rules) {
    const rawVal = next[rule.triggerFieldKey];
    const strVal = String(rawVal ?? '').toLowerCase();
    const targetStr = rule.triggerValue.toLowerCase();
    let matched = false;

    if (rule.operator === 'equals') matched = strVal === targetStr;
    else if (rule.operator === 'contains') matched = strVal.includes(targetStr);
    else if (rule.operator === 'gt') matched = (Number(rawVal) || 0) > (Number(rule.triggerValue) || 0);
    else if (rule.operator === 'lt') matched = (Number(rawVal) || 0) < (Number(rule.triggerValue) || 0);

    if (matched) {
      const targetField = db.fields.find((f) => f.key === rule.actionFieldKey);
      if (targetField?.type === 'checkbox') {
        next[rule.actionFieldKey] =
          rule.actionValue.toLowerCase() === 'true' ||
          rule.actionValue === '1' ||
          rule.actionValue.toLowerCase() === 'sim';
      } else if (
        targetField?.type === 'number' ||
        targetField?.type === 'currency'
      ) {
        next[rule.actionFieldKey] = Number(rule.actionValue) || 0;
      } else {
        next[rule.actionFieldKey] = rule.actionValue;
      }
    }
  }
  return next;
}

export function createDbFromTemplate(
  kind: 'expenses' | 'inventory' | 'crm' | 'catalog' | 'blank',
  customName?: string
): MementoDatabase {
  const now = Date.now();
  if (kind === 'expenses') {
    return {
      id: makeId('mdb'),
      name: customName || 'Controle de Despesas',
      icon: '💰',
      description: 'Gastos mensais com categorias e status',
      fields: [
        { id: makeId('f'), key: 'desc', label: 'Descrição', type: 'text' },
        { id: makeId('f'), key: 'valor', label: 'Valor', type: 'currency' },
        {
          id: makeId('f'),
          key: 'categoria',
          label: 'Categoria',
          type: 'select',
          options: ['Alimentação', 'Moradia', 'Transporte', 'Lazer', 'Estudos'],
        },
        { id: makeId('f'), key: 'data', label: 'Data', type: 'date' },
        { id: makeId('f'), key: 'pago', label: 'Pago', type: 'checkbox' },
      ],
      records: [
        {
          id: makeId('r'),
          values: {
            desc: 'Supermercado',
            valor: 245.5,
            categoria: 'Alimentação',
            data: new Date().toISOString().slice(0, 10),
            pago: true,
          },
          createdAt: now,
          updatedAt: now,
        },
        {
          id: makeId('r'),
          values: {
            desc: 'Internet Fibra',
            valor: 119.9,
            categoria: 'Moradia',
            data: new Date().toISOString().slice(0, 10),
            pago: false,
          },
          createdAt: now + 1,
          updatedAt: now + 1,
        },
      ],
      rules: [
        {
          id: makeId('rl'),
          triggerFieldKey: 'valor',
          operator: 'gt',
          triggerValue: '200',
          actionFieldKey: 'categoria',
          actionValue: 'Alimentação',
        },
      ],
      createdAt: now,
    };
  }

  if (kind === 'inventory') {
    return {
      id: makeId('mdb'),
      name: customName || 'Estoque & Inventário',
      icon: '📦',
      description: 'Produtos com cálculo automático de valor total',
      fields: [
        { id: makeId('f'), key: 'produto', label: 'Produto', type: 'text' },
        { id: makeId('f'), key: 'qtd', label: 'Quantidade', type: 'number' },
        { id: makeId('f'), key: 'preco', label: 'Preço Unit.', type: 'currency' },
        { id: makeId('f'), key: 'total', label: 'Valor Total', type: 'formula', formulaExpr: 'qtd * preco' },
        { id: makeId('f'), key: 'foto', label: 'Foto', type: 'image' },
      ],
      records: [
        {
          id: makeId('r'),
          values: { produto: 'Fone Studio', qtd: 3, preco: 350 },
          createdAt: now,
          updatedAt: now,
        },
      ],
      rules: [],
      createdAt: now,
    };
  }

  if (kind === 'crm') {
    return {
      id: makeId('mdb'),
      name: customName || 'CRM & Contatos',
      icon: '👥',
      description: 'Clientes, leads e acompanhamento',
      fields: [
        { id: makeId('f'), key: 'nome', label: 'Nome', type: 'text' },
        { id: makeId('f'), key: 'contato', label: 'Telefone / E-mail', type: 'text' },
        {
          id: makeId('f'),
          key: 'status',
          label: 'Etapa',
          type: 'select',
          options: ['Novo Lead', 'Em Negociação', 'Fechado', 'Pausado'],
        },
        { id: makeId('f'), key: 'nota', label: 'Prioridade', type: 'rating' },
      ],
      records: [],
      rules: [],
      createdAt: now,
    };
  }

  if (kind === 'catalog') {
    return {
      id: makeId('mdb'),
      name: customName || 'Catálogo Pessoal',
      icon: '📚',
      description: 'Coleção de livros, filmes ou equipamentos',
      fields: [
        { id: makeId('f'), key: 'titulo', label: 'Título', type: 'text' },
        { id: makeId('f'), key: 'nota', label: 'Avaliação', type: 'rating' },
        { id: makeId('f'), key: 'capa', label: 'Imagem', type: 'image' },
        { id: makeId('f'), key: 'link', label: 'Referência', type: 'link' },
      ],
      records: [],
      rules: [],
      createdAt: now,
    };
  }

  return {
    id: makeId('mdb'),
    name: customName || 'Novo Banco de Dados',
    icon: '🗄',
    description: 'Banco personalizado',
    fields: [
      { id: makeId('f'), key: 'titulo', label: 'Título', type: 'text' },
      { id: makeId('f'), key: 'valor', label: 'Valor', type: 'number' },
      { id: makeId('f'), key: 'feito', label: 'Concluído', type: 'checkbox' },
    ],
    records: [],
    rules: [],
    createdAt: now,
  };
}

export function buildLocalDatabaseFromPrompt(prompt: string): MementoDatabase {
  const p = prompt.toLowerCase();
  if (p.includes('gast') || p.includes('despes') || p.includes('finan')) {
    return createDbFromTemplate('expenses', prompt.slice(0, 32));
  }
  if (p.includes('estoq') || p.includes('produt') || p.includes('armaz')) {
    return createDbFromTemplate('inventory', prompt.slice(0, 32));
  }
  if (p.includes('client') || p.includes('contat') || p.includes('crm') || p.includes('vend')) {
    return createDbFromTemplate('crm', prompt.slice(0, 32));
  }
  if (p.includes('livro') || p.includes('film') || p.includes('coleç') || p.includes('jog')) {
    return createDbFromTemplate('catalog', prompt.slice(0, 32));
  }
  return {
    id: makeId('mdb'),
    name: prompt.trim().slice(0, 32) || 'Banco IA',
    icon: '✨',
    description: `Criado para: ${prompt.trim()}`,
    fields: [
      { id: makeId('f'), key: 'nome', label: 'Item / Nome', type: 'text' },
      { id: makeId('f'), key: 'categoria', label: 'Categoria', type: 'select', options: ['Geral', 'Alta Prioridade', 'Concluído'] },
      { id: makeId('f'), key: 'valor', label: 'Quantidade / Valor', type: 'number' },
      { id: makeId('f'), key: 'data', label: 'Data', type: 'date' },
      { id: makeId('f'), key: 'ok', label: 'Concluído', type: 'checkbox' },
    ],
    records: [],
    rules: [],
    createdAt: Date.now(),
  };
}

export function buildStarterMiniAppHtml(title: string, idea: string): string {
  const safeTitle = title.replace(/</g, '&lt;');
  const safeIdea = idea.replace(/</g, '&lt;');
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 20px; }
    .card { background: #1e293b; border-radius: 16px; padding: 18px; border: 1px solid #334155; }
    h2 { margin: 0 0 6px; color: #38bdf8; }
    p { color: #94a3b8; font-size: 13px; margin-bottom: 16px; }
    input { width: 100%; box-sizing: border-box; padding: 10px; border-radius: 10px; border: 1px solid #475569; background: #0f172a; color: #fff; margin-bottom: 10px; font-size: 15px; }
    button { width: 100%; padding: 12px; border-radius: 10px; border: none; background: #6366f1; color: #fff; font-weight: bold; font-size: 15px; }
    ul { list-style: none; padding: 0; margin-top: 14px; }
    li { background: #0f172a; padding: 10px 12px; border-radius: 10px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; }
  </style>
</head>
<body>
  <div class="card">
    <h2>⚡ ${safeTitle}</h2>
    <p>${safeIdea || 'Mini-App interativo criado no Nexus Vibe Builder'}</p>
    <input id="inp" placeholder="Adicionar item ou valor..." />
    <button onclick="addItem()">+ Adicionar</button>
    <ul id="list"></ul>
  </div>
  <script>
    var items = [];
    function render() {
      var ul = document.getElementById('list');
      ul.innerHTML = items.map(function(it, i) {
        return '<li><span>' + it + '</span><span onclick="del(' + i + ')" style="color:#f87171;font-weight:bold;">✕</span></li>';
      }).join('');
    }
    function addItem() {
      var el = document.getElementById('inp');
      if (!el.value.trim()) return;
      items.unshift(el.value.trim());
      el.value = '';
      render();
    }
    function del(i) { items.splice(i, 1); render(); }
  </script>
</body>
</html>`;
}

export const DEFAULT_MEMENTO_STORE: MementoStore = {
  databases: [
    createDbFromTemplate('expenses'),
    createDbFromTemplate('inventory'),
  ],
  miniApps: [
    {
      id: 'vibe-demo-1',
      title: 'Calculadora Rápida / Lista',
      description: 'Mini-App offline editável em HTML/JS',
      htmlCode: buildStarterMiniAppHtml(
        'Lista Rápida Vibe',
        'Edite este código na aba "Código" ou peça um novo app com IA!'
      ),
      versions: [],
      updatedAt: Date.now(),
    },
  ],
};

export function databaseToCsv(db: MementoDatabase): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const headers = db.fields.map((f) => esc(f.label)).join(',');
  const rows = db.records.map((r) =>
    db.fields
      .map((f) => {
        const val =
          f.type === 'formula'
            ? evaluateFormula(f.formulaExpr ?? '', r.values)
            : r.values[f.key] ?? '';
        return esc(String(val));
      })
      .join(',')
  );
  return [headers, ...rows].join('\n');
}
