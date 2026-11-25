import * as SQLite from 'expo-sqlite';

export interface NexusNode {
  id: string;
  parentId: string | null;
  title: string;
  content: string;
  isExpanded: boolean;
  isFavorite: boolean;
  sortOrder: number;
  updatedAt: number;
}

interface NodeRow {
  id: string;
  parent_id: string | null;
  title: string;
  content: string;
  is_expanded: number;
  is_favorite: number;
  sort_order: number;
  updated_at: number;
}

interface MetaRow {
  value: string;
}

interface MaxOrderRow {
  max_order: number | null;
}

const db = SQLite.openDatabaseSync('nexus.db');

const STARTER_NODES: Omit<NexusNode, 'updatedAt'>[] = [
  {
    id: '1',
    parentId: null,
    title: 'Estudos',
    content:
      'Central de aprendizado contínuo.\n\nConectado com [[Teoria musical]] e [[Investimentos]].\n\n#estudos #foco',
    isExpanded: true,
    isFavorite: true,
    sortOrder: 0,
  },
  {
    id: '2',
    parentId: null,
    title: 'Produção musical',
    content: 'Projetos de áudio, beats e mixagem.\n\n#musica #producao',
    isExpanded: true,
    isFavorite: true,
    sortOrder: 1,
  },
  {
    id: '3',
    parentId: '2',
    title: 'FL Studio',
    content:
      '- Atalhos de Piano Roll\n- Cadeia de masterização\n- Aplicar conceitos de [[Teoria musical]] nos acordes.\n\n#daw #flstudio',
    isExpanded: false,
    isFavorite: false,
    sortOrder: 0,
  },
  {
    id: '4',
    parentId: '2',
    title: 'Teoria musical',
    content:
      'Escalas maiores, menores e campo harmônico.\n\nPraticar progressões II-V-I no [[FL Studio]].\n\n#teoria #harmonia',
    isExpanded: false,
    isFavorite: false,
    sortOrder: 1,
  },
  {
    id: '5',
    parentId: '2',
    title: 'Videoaulas',
    content:
      'Lista de aulas pendentes sobre sound design e compressão paralela.\n\n#aulas #estudos',
    isExpanded: false,
    isFavorite: false,
    sortOrder: 2,
  },
  {
    id: '6',
    parentId: null,
    title: 'Investimentos',
    content:
      'Reserva de emergência, renda fixa e metas de longo prazo.\n\n#financas #metas',
    isExpanded: false,
    isFavorite: false,
    sortOrder: 2,
  },
];

function mapRowToNode(row: NodeRow): NexusNode {
  return {
    id: row.id,
    parentId: row.parent_id,
    title: row.title,
    content: row.content,
    isExpanded: row.is_expanded === 1,
    isFavorite: row.is_favorite === 1,
    sortOrder: row.sort_order,
    updatedAt: row.updated_at,
  };
}

export function initDatabase(): void {
  db.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY NOT NULL,
      parent_id TEXT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      is_expanded INTEGER NOT NULL DEFAULT 1,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);

  const seededRow = db.getFirstSync<MetaRow>(
    'SELECT value FROM app_meta WHERE key = ?',
    ['seeded']
  );

  if (!seededRow) {
    const now = Date.now();
    db.withTransactionSync(() => {
      for (const item of STARTER_NODES) {
        db.runSync(
          `INSERT OR IGNORE INTO nodes (id, parent_id, title, content, is_expanded, is_favorite, sort_order, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id,
            item.parentId,
            item.title,
            item.content,
            item.isExpanded ? 1 : 0,
            item.isFavorite ? 1 : 0,
            item.sortOrder,
            now,
          ]
        );
      }
      db.runSync(
        `INSERT OR REPLACE INTO app_meta (key, value) VALUES ('seeded', '1')`
      );
    });
  }
}

export function getAllNodes(): NexusNode[] {
  const rows = db.getAllSync<NodeRow>(
    'SELECT * FROM nodes ORDER BY sort_order ASC, updated_at ASC'
  );
  return rows.map(mapRowToNode);
}

function getNextSortOrder(parentId: string | null): number {
  const row =
    parentId === null
      ? db.getFirstSync<MaxOrderRow>(
          'SELECT MAX(sort_order) AS max_order FROM nodes WHERE parent_id IS NULL'
        )
      : db.getFirstSync<MaxOrderRow>(
          'SELECT MAX(sort_order) AS max_order FROM nodes WHERE parent_id = ?',
          [parentId]
        );
  return row && row.max_order !== null ? row.max_order + 1 : 0;
}

export function insertNode(params: {
  id: string;
  parentId: string | null;
  title: string;
  content: string;
  isExpanded?: boolean;
  isFavorite?: boolean;
}): NexusNode {
  const now = Date.now();
  const sortOrder = getNextSortOrder(params.parentId);
  const isExpanded = params.isExpanded ?? true;
  const isFavorite = params.isFavorite ?? false;

  db.runSync(
    `INSERT INTO nodes (id, parent_id, title, content, is_expanded, is_favorite, sort_order, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.id,
      params.parentId,
      params.title,
      params.content,
      isExpanded ? 1 : 0,
      isFavorite ? 1 : 0,
      sortOrder,
      now,
    ]
  );

  return {
    id: params.id,
    parentId: params.parentId,
    title: params.title,
    content: params.content,
    isExpanded,
    isFavorite,
    sortOrder,
    updatedAt: now,
  };
}

export function updateNodeContent(
  id: string,
  title: string,
  content: string
): number {
  const now = Date.now();
  db.runSync(
    'UPDATE nodes SET title = ?, content = ?, updated_at = ? WHERE id = ?',
    [title, content, now, id]
  );
  return now;
}

export function setNodeExpanded(id: string, isExpanded: boolean): void {
  db.runSync('UPDATE nodes SET is_expanded = ? WHERE id = ?', [
    isExpanded ? 1 : 0,
    id,
  ]);
}

export function setAllNodesExpanded(isExpanded: boolean): void {
  db.runSync('UPDATE nodes SET is_expanded = ?', [isExpanded ? 1 : 0]);
}

export function setNodeFavorite(id: string, isFavorite: boolean): void {
  db.runSync('UPDATE nodes SET is_favorite = ? WHERE id = ?', [
    isFavorite ? 1 : 0,
    id,
  ]);
}

export function updateNodeParent(id: string, newParentId: string | null): number {
  const nextOrder = getNextSortOrder(newParentId);
  db.runSync(
    'UPDATE nodes SET parent_id = ?, sort_order = ? WHERE id = ?',
    [newParentId, nextOrder, id]
  );
  return nextOrder;
}

export function swapSiblingOrder(
  idA: string,
  orderA: number,
  idB: string,
  orderB: number
): void {
  db.withTransactionSync(() => {
    db.runSync('UPDATE nodes SET sort_order = ? WHERE id = ?', [orderB, idA]);
    db.runSync('UPDATE nodes SET sort_order = ? WHERE id = ?', [orderA, idB]);
  });
}

export function deleteNodesByIds(ids: string[]): void {
  if (ids.length === 0) return;
  db.withTransactionSync(() => {
    for (const id of ids) {
      db.runSync('DELETE FROM nodes WHERE id = ?', [id]);
    }
  });
}
