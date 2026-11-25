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

export interface NodeSnapshot {
  id: string;
  nodeId: string;
  title: string;
  content: string;
  createdAt: number;
}

export interface CourseItem {
  id: string;
  title: string;
  sortOrder: number;
  createdAt: number;
}

export interface CourseModuleItem {
  id: string;
  courseId: string;
  title: string;
  sortOrder: number;
  createdAt: number;
}

export interface LessonQuestion {
  id: string;
  question: string;
  answer: string;
  resolved: boolean;
}

export interface LessonLink {
  id: string;
  title: string;
  url: string;
}

export type LessonSourceType = 'none' | 'local' | 'youtube' | 'site';

export interface CourseLessonItem {
  id: string;
  moduleId: string;
  courseId: string;
  title: string;
  sourceType: LessonSourceType;
  mediaUri: string;
  isCompleted: boolean;
  notes: string;
  questions: LessonQuestion[];
  links: LessonLink[];
  sortOrder: number;
  createdAt: number;
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

interface SnapshotRow {
  id: string;
  node_id: string;
  title: string;
  content: string;
  created_at: number;
}

interface CourseRow {
  id: string;
  title: string;
  sort_order: number;
  created_at: number;
}

interface ModuleRow {
  id: string;
  course_id: string;
  title: string;
  sort_order: number;
  created_at: number;
}

interface LessonRow {
  id: string;
  module_id: string;
  course_id: string;
  title: string;
  source_type: string;
  media_uri: string;
  is_completed: number;
  notes: string;
  questions_json: string;
  links_json: string;
  sort_order: number;
  created_at: number;
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

function safeParseJsonArray<T>(raw: string): T[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function mapRowToLesson(row: LessonRow): CourseLessonItem {
  const validSource: LessonSourceType =
    row.source_type === 'local' ||
    row.source_type === 'youtube' ||
    row.source_type === 'site'
      ? row.source_type
      : 'none';

  return {
    id: row.id,
    moduleId: row.module_id,
    courseId: row.course_id,
    title: row.title,
    sourceType: validSource,
    mediaUri: row.media_uri,
    isCompleted: row.is_completed === 1,
    notes: row.notes,
    questions: safeParseJsonArray<LessonQuestion>(row.questions_json),
    links: safeParseJsonArray<LessonLink>(row.links_json),
    sortOrder: row.sort_order,
    createdAt: row.created_at,
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
    CREATE TABLE IF NOT EXISTS snapshots (
      id TEXT PRIMARY KEY NOT NULL,
      node_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS course_modules (
      id TEXT PRIMARY KEY NOT NULL,
      course_id TEXT NOT NULL,
      title TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS course_lessons (
      id TEXT PRIMARY KEY NOT NULL,
      module_id TEXT NOT NULL,
      course_id TEXT NOT NULL,
      title TEXT NOT NULL,
      source_type TEXT NOT NULL DEFAULT 'none',
      media_uri TEXT NOT NULL DEFAULT '',
      is_completed INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      questions_json TEXT NOT NULL DEFAULT '[]',
      links_json TEXT NOT NULL DEFAULT '[]',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
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

export function getAppMeta(key: string): string | null {
  const row = db.getFirstSync<MetaRow>(
    'SELECT value FROM app_meta WHERE key = ?',
    [key]
  );
  return row ? row.value : null;
}

export function setAppMeta(key: string, value: string): void {
  db.runSync(
    'INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)',
    [key, value]
  );
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
      db.runSync('DELETE FROM snapshots WHERE node_id = ?', [id]);
    }
  });
}

export function saveNodeSnapshot(
  nodeId: string,
  title: string,
  content: string
): NodeSnapshot {
  const now = Date.now();
  const id = `snap-${now}-${Math.floor(Math.random() * 10000)}`;

  db.withTransactionSync(() => {
    db.runSync(
      `INSERT INTO snapshots (id, node_id, title, content, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, nodeId, title, content, now]
    );
    db.runSync(
      `DELETE FROM snapshots
       WHERE node_id = ?
         AND id NOT IN (
           SELECT id FROM snapshots
           WHERE node_id = ?
           ORDER BY created_at DESC
           LIMIT 15
         )`,
      [nodeId, nodeId]
    );
  });

  return { id, nodeId, title, content, createdAt: now };
}

export function getNodeSnapshots(nodeId: string): NodeSnapshot[] {
  const rows = db.getAllSync<SnapshotRow>(
    'SELECT * FROM snapshots WHERE node_id = ? ORDER BY created_at DESC',
    [nodeId]
  );
  return rows.map((r) => ({
    id: r.id,
    nodeId: r.node_id,
    title: r.title,
    content: r.content,
    createdAt: r.created_at,
  }));
}

// ==========================================
// MEUS CURSOS (CURSOS -> MÓDULOS -> AULAS)
// ==========================================

export function getAllCourses(): CourseItem[] {
  const rows = db.getAllSync<CourseRow>(
    'SELECT * FROM courses ORDER BY sort_order ASC, created_at ASC'
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
  }));
}

export function insertCourse(title: string): CourseItem {
  const now = Date.now();
  const id = `crs-${now}-${Math.floor(Math.random() * 10000)}`;
  const maxRow = db.getFirstSync<MaxOrderRow>(
    'SELECT MAX(sort_order) AS max_order FROM courses'
  );
  const sortOrder =
    maxRow && maxRow.max_order !== null ? maxRow.max_order + 1 : 0;

  db.runSync(
    'INSERT INTO courses (id, title, sort_order, created_at) VALUES (?, ?, ?, ?)',
    [id, title, sortOrder, now]
  );

  return { id, title, sortOrder, createdAt: now };
}

export function renameCourse(id: string, title: string): void {
  db.runSync('UPDATE courses SET title = ? WHERE id = ?', [title, id]);
}

export function swapCourseOrder(
  idA: string,
  orderA: number,
  idB: string,
  orderB: number
): void {
  db.withTransactionSync(() => {
    db.runSync('UPDATE courses SET sort_order = ? WHERE id = ?', [orderB, idA]);
    db.runSync('UPDATE courses SET sort_order = ? WHERE id = ?', [orderA, idB]);
  });
}

export function deleteCourseCascade(courseId: string): void {
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM course_lessons WHERE course_id = ?', [courseId]);
    db.runSync('DELETE FROM course_modules WHERE course_id = ?', [courseId]);
    db.runSync('DELETE FROM courses WHERE id = ?', [courseId]);
  });
}

export function getAllCourseModules(): CourseModuleItem[] {
  const rows = db.getAllSync<ModuleRow>(
    'SELECT * FROM course_modules ORDER BY sort_order ASC, created_at ASC'
  );
  return rows.map((r) => ({
    id: r.id,
    courseId: r.course_id,
    title: r.title,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
  }));
}

export function insertCourseModule(
  courseId: string,
  title: string
): CourseModuleItem {
  const now = Date.now();
  const id = `mod-${now}-${Math.floor(Math.random() * 10000)}`;
  const maxRow = db.getFirstSync<MaxOrderRow>(
    'SELECT MAX(sort_order) AS max_order FROM course_modules WHERE course_id = ?',
    [courseId]
  );
  const sortOrder =
    maxRow && maxRow.max_order !== null ? maxRow.max_order + 1 : 0;

  db.runSync(
    'INSERT INTO course_modules (id, course_id, title, sort_order, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, courseId, title, sortOrder, now]
  );

  return { id, courseId, title, sortOrder, createdAt: now };
}

export function renameCourseModule(id: string, title: string): void {
  db.runSync('UPDATE course_modules SET title = ? WHERE id = ?', [title, id]);
}

export function swapCourseModuleOrder(
  idA: string,
  orderA: number,
  idB: string,
  orderB: number
): void {
  db.withTransactionSync(() => {
    db.runSync('UPDATE course_modules SET sort_order = ? WHERE id = ?', [
      orderB,
      idA,
    ]);
    db.runSync('UPDATE course_modules SET sort_order = ? WHERE id = ?', [
      orderA,
      idB,
    ]);
  });
}

export function deleteCourseModuleCascade(moduleId: string): void {
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM course_lessons WHERE module_id = ?', [moduleId]);
    db.runSync('DELETE FROM course_modules WHERE id = ?', [moduleId]);
  });
}

export function getAllCourseLessons(): CourseLessonItem[] {
  const rows = db.getAllSync<LessonRow>(
    'SELECT * FROM course_lessons ORDER BY sort_order ASC, created_at ASC'
  );
  return rows.map(mapRowToLesson);
}

export function insertCourseLesson(params: {
  moduleId: string;
  courseId: string;
  title: string;
  sourceType: LessonSourceType;
  mediaUri: string;
}): CourseLessonItem {
  const now = Date.now();
  const id = `les-${now}-${Math.floor(Math.random() * 10000)}`;
  const maxRow = db.getFirstSync<MaxOrderRow>(
    'SELECT MAX(sort_order) AS max_order FROM course_lessons WHERE module_id = ?',
    [params.moduleId]
  );
  const sortOrder =
    maxRow && maxRow.max_order !== null ? maxRow.max_order + 1 : 0;

  db.runSync(
    `INSERT INTO course_lessons (id, module_id, course_id, title, source_type, media_uri, is_completed, notes, questions_json, links_json, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, '', '[]', '[]', ?, ?)`,
    [
      id,
      params.moduleId,
      params.courseId,
      params.title,
      params.sourceType,
      params.mediaUri,
      sortOrder,
      now,
    ]
  );

  return {
    id,
    moduleId: params.moduleId,
    courseId: params.courseId,
    title: params.title,
    sourceType: params.sourceType,
    mediaUri: params.mediaUri,
    isCompleted: false,
    notes: '',
    questions: [],
    links: [],
    sortOrder,
    createdAt: now,
  };
}

export function updateCourseLesson(
  id: string,
  patch: Partial<
    Pick<
      CourseLessonItem,
      | 'title'
      | 'sourceType'
      | 'mediaUri'
      | 'isCompleted'
      | 'notes'
      | 'questions'
      | 'links'
    >
  >
): void {
  const row = db.getFirstSync<LessonRow>(
    'SELECT * FROM course_lessons WHERE id = ?',
    [id]
  );
  if (!row) return;
  const current = mapRowToLesson(row);

  const nextTitle = patch.title ?? current.title;
  const nextSource = patch.sourceType ?? current.sourceType;
  const nextUri = patch.mediaUri ?? current.mediaUri;
  const nextCompleted =
    patch.isCompleted !== undefined ? patch.isCompleted : current.isCompleted;
  const nextNotes = patch.notes ?? current.notes;
  const nextQuestions = patch.questions ?? current.questions;
  const nextLinks = patch.links ?? current.links;

  db.runSync(
    `UPDATE course_lessons
     SET title = ?, source_type = ?, media_uri = ?, is_completed = ?, notes = ?, questions_json = ?, links_json = ?
     WHERE id = ?`,
    [
      nextTitle,
      nextSource,
      nextUri,
      nextCompleted ? 1 : 0,
      nextNotes,
      JSON.stringify(nextQuestions),
      JSON.stringify(nextLinks),
      id,
    ]
  );
}

export function swapCourseLessonOrder(
  idA: string,
  orderA: number,
  idB: string,
  orderB: number
): void {
  db.withTransactionSync(() => {
    db.runSync('UPDATE course_lessons SET sort_order = ? WHERE id = ?', [
      orderB,
      idA,
    ]);
    db.runSync('UPDATE course_lessons SET sort_order = ? WHERE id = ?', [
      orderA,
      idB,
    ]);
  });
}

export function deleteCourseLesson(id: string): void {
  db.runSync('DELETE FROM course_lessons WHERE id = ?', [id]);
}

export function exportBackupJson(): string {
  return JSON.stringify(
    {
      app: 'Nexus',
      version: 9,
      exportedAt: Date.now(),
      nodes: getAllNodes(),
      courses: getAllCourses(),
      courseModules: getAllCourseModules(),
      courseLessons: getAllCourseLessons(),
    },
    null,
    2
  );
}

export function importBackupJson(rawJson: string): number {
  const parsed = JSON.parse(rawJson) as {
    nodes?: unknown;
    courses?: unknown;
    courseModules?: unknown;
    courseLessons?: unknown;
  };
  if (!parsed || !Array.isArray(parsed.nodes)) {
    throw new Error('Formato inválido: campo "nodes" não encontrado.');
  }

  let count = 0;
  db.withTransactionSync(() => {
    for (const item of parsed.nodes as Partial<NexusNode>[]) {
      if (
        !item ||
        typeof item.id !== 'string' ||
        typeof item.title !== 'string'
      ) {
        continue;
      }
      const content = typeof item.content === 'string' ? item.content : '';
      const parentId =
        typeof item.parentId === 'string' ? item.parentId : null;
      const isExpanded = item.isExpanded ? 1 : 0;
      const isFavorite = item.isFavorite ? 1 : 0;
      const sortOrder =
        typeof item.sortOrder === 'number' ? item.sortOrder : 0;
      const updatedAt =
        typeof item.updatedAt === 'number' ? item.updatedAt : Date.now();

      db.runSync(
        `INSERT OR REPLACE INTO nodes (id, parent_id, title, content, is_expanded, is_favorite, sort_order, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id,
          parentId,
          item.title,
          content,
          isExpanded,
          isFavorite,
          sortOrder,
          updatedAt,
        ]
      );
      count += 1;
    }

    if (Array.isArray(parsed.courses)) {
      for (const c of parsed.courses as Partial<CourseItem>[]) {
        if (!c || typeof c.id !== 'string' || typeof c.title !== 'string') continue;
        db.runSync(
          `INSERT OR REPLACE INTO courses (id, title, sort_order, created_at) VALUES (?, ?, ?, ?)`,
          [c.id, c.title, c.sortOrder ?? 0, c.createdAt ?? Date.now()]
        );
      }
    }

    if (Array.isArray(parsed.courseModules)) {
      for (const m of parsed.courseModules as Partial<CourseModuleItem>[]) {
        if (!m || typeof m.id !== 'string' || typeof m.courseId !== 'string' || typeof m.title !== 'string') continue;
        db.runSync(
          `INSERT OR REPLACE INTO course_modules (id, course_id, title, sort_order, created_at) VALUES (?, ?, ?, ?, ?)`,
          [m.id, m.courseId, m.title, m.sortOrder ?? 0, m.createdAt ?? Date.now()]
        );
      }
    }

    if (Array.isArray(parsed.courseLessons)) {
      for (const l of parsed.courseLessons as Partial<CourseLessonItem>[]) {
        if (!l || typeof l.id !== 'string' || typeof l.moduleId !== 'string' || typeof l.courseId !== 'string' || typeof l.title !== 'string') continue;
        db.runSync(
          `INSERT OR REPLACE INTO course_lessons (id, module_id, course_id, title, source_type, media_uri, is_completed, notes, questions_json, links_json, sort_order, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            l.id,
            l.moduleId,
            l.courseId,
            l.title,
            l.sourceType ?? 'none',
            l.mediaUri ?? '',
            l.isCompleted ? 1 : 0,
            l.notes ?? '',
            JSON.stringify(l.questions ?? []),
            JSON.stringify(l.links ?? []),
            l.sortOrder ?? 0,
            l.createdAt ?? Date.now(),
          ]
        );
      }
    }
  });

  return count;
}
