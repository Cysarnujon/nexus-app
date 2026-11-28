export type ProductivityToolKind =
  | 'pomodoro'
  | 'countdown'
  | 'wheel'
  | 'habits'
  | 'flashcards'
  | 'budget'
  | 'stats'
  | 'wordcloud'
  | 'milanote'
  | 'mindmap'
  | 'tasks_link'
  | 'spaces_link'
  | 'framework'
  | 'flow_editor';

export interface FrameworkSectionDef {
  key: string;
  title: string;
  color: string;
  hint: string;
}

export interface ProductivityToolDef {
  id: string;
  title: string;
  icon: string;
  color: string;
  subtitle: string;
  kind: ProductivityToolKind;
  sections?: FrameworkSectionDef[];
}

export interface ProductivityCategoryDef {
  id: string;
  title: string;
  tools: ProductivityToolDef[];
}

export const PRODUCTIVITY_CATEGORIES: ProductivityCategoryDef[] = [
  {
    id: 'daily_flow',
    title: 'Fluxo Diário',
    tools: [
      {
        id: 'pomodoro',
        title: 'Pomodoro',
        icon: '🍅',
        color: '#EF4444',
        subtitle: 'Timer de foco 25/5 min',
        kind: 'pomodoro',
      },
      {
        id: 'cronograma',
        title: 'Cronograma',
        icon: '🗓',
        color: '#3B82F6',
        subtitle: 'Blocos de horário do dia',
        kind: 'framework',
        sections: [
          { key: 'morning', title: 'Manhã (06:00 – 12:00)', color: '#F59E0B', hint: 'Principais blocos da manhã...' },
          { key: 'afternoon', title: 'Tarde (12:00 – 18:00)', color: '#3B82F6', hint: 'Atividades da tarde...' },
          { key: 'night', title: 'Noite (18:00 – 23:00)', color: '#6366F1', hint: 'Estudos e encerramento...' },
        ],
      },
      {
        id: 'checklist',
        title: 'Checklist',
        icon: '☑',
        color: '#10B981',
        subtitle: 'Central global de tarefas',
        kind: 'tasks_link',
      },
      {
        id: 'countdown',
        title: 'Contagem Regressiva',
        icon: '⏳',
        color: '#8B5CF6',
        subtitle: 'Dias para metas e provas',
        kind: 'countdown',
      },
      {
        id: 'bullet_journal',
        title: 'Bullet Journal',
        icon: '📓',
        color: '#F59E0B',
        subtitle: 'Registro rápido diário',
        kind: 'framework',
        sections: [
          { key: 'tasks', title: '• Tarefas do Dia', color: '#3B82F6', hint: 'O que precisa ser feito hoje...' },
          { key: 'events', title: '○ Eventos / Compromissos', color: '#8B5CF6', hint: 'Reuniões, aulas, horários...' },
          { key: 'notes', title: '— Notas e Ideias Rápidas', color: '#10B981', hint: 'Insights, lembretes...' },
          { key: 'gratitude', title: '★ Conquistas / Gratidão', color: '#F59E0B', hint: 'O que deu certo hoje...' },
        ],
      },
      {
        id: 'agenda',
        title: 'Agenda & Lembretes',
        icon: '📅',
        color: '#0EA5E9',
        subtitle: 'Semana e compromissos',
        kind: 'framework',
        sections: [
          { key: 'today', title: 'Hoje (Urgente)', color: '#EF4444', hint: 'Compromissos de hoje...' },
          { key: 'week', title: 'Esta Semana', color: '#3B82F6', hint: 'Prazos da semana...' },
          { key: 'later', title: 'Próximos Dias', color: '#10B981', hint: 'Lembretes futuros...' },
        ],
      },
      {
        id: 'outline',
        title: 'Outline & Tópicos',
        icon: '☰',
        color: '#6366F1',
        subtitle: 'Árvore infinita de notas',
        kind: 'spaces_link',
      },
    ],
  },
  {
    id: 'missions',
    title: 'Missões Centrais (Metas & OKRs)',
    tools: [
      {
        id: 'smart_goals',
        title: 'SMART Goals',
        icon: '🎯',
        color: '#10B981',
        subtitle: 'Metas bem definidas',
        kind: 'framework',
        sections: [
          { key: 's', title: 'S — Específica (O que exatamente?)', color: '#3B82F6', hint: 'Descreva a meta com clareza...' },
          { key: 'm', title: 'M — Mensurável (Como medir?)', color: '#10B981', hint: 'Números, métricas, quantidade...' },
          { key: 'a', title: 'A — Atingível (É possível?)', color: '#F59E0B', hint: 'Recursos e passos necessários...' },
          { key: 'r', title: 'R — Relevante (Por que importa?)', color: '#A855F7', hint: 'Impacto na sua vida...' },
          { key: 't', title: 'T — Temporal (Qual o prazo?)', color: '#EF4444', hint: 'Data limite exata...' },
        ],
      },
      {
        id: 'okr',
        title: 'OKRs',
        icon: '🧭',
        color: '#06B6D4',
        subtitle: 'Objetivos e Resultados-Chave',
        kind: 'framework',
        sections: [
          { key: 'obj', title: 'O — Objetivo Inspirador', color: '#6366F1', hint: 'Onde quero chegar neste trimestre...' },
          { key: 'kr1', title: 'KR 1 — Resultado-Chave 1', color: '#10B981', hint: 'Ex: Concluir 100% do módulo...' },
          { key: 'kr2', title: 'KR 2 — Resultado-Chave 2', color: '#38BDF8', hint: 'Ex: Publicar 12 projetos...' },
          { key: 'kr3', title: 'KR 3 — Resultado-Chave 3', color: '#F59E0B', hint: 'Ex: Economizar R$ X...' },
        ],
      },
      {
        id: 'metas_mapa',
        title: 'Mapa de Objetivos',
        icon: '🗺',
        color: '#8B5CF6',
        subtitle: 'Curto, médio e longo prazo',
        kind: 'framework',
        sections: [
          { key: 'short', title: 'Curto Prazo (1–3 meses)', color: '#10B981', hint: 'Foco imediato...' },
          { key: 'mid', title: 'Médio Prazo (6–12 meses)', color: '#3B82F6', hint: 'Metas do ano...' },
          { key: 'long', title: 'Longo Prazo (2–5 anos)', color: '#A855F7', hint: 'Visão de futuro...' },
        ],
      },
    ],
  },
  {
    id: 'projects',
    title: 'Gestão de Projetos',
    tools: [
      {
        id: 'kanban_proj',
        title: 'Kanban',
        icon: '▥',
        color: '#6366F1',
        subtitle: 'Fluxo visual de tarefas',
        kind: 'framework',
        sections: [
          { key: 'todo', title: '📋 A Fazer (Backlog)', color: '#64748B', hint: 'Tarefas pendentes...' },
          { key: 'doing', title: '⚡ Em Andamento', color: '#3B82F6', hint: 'O que está sendo executado...' },
          { key: 'done', title: '✅ Concluído', color: '#10B981', hint: 'Entregas finalizadas...' },
        ],
      },
      {
        id: 'roadmap_gantt',
        title: 'Roadmap / Gantt',
        icon: '📊',
        color: '#0EA5E9',
        subtitle: 'Fases e cronograma',
        kind: 'framework',
        sections: [
          { key: 'f1', title: 'Fase 1 — Descoberta & Escopo', color: '#6366F1', hint: 'Semana 1–2: atividades e marcos...' },
          { key: 'f2', title: 'Fase 2 — Construção', color: '#3B82F6', hint: 'Semana 3–5: entregas principais...' },
          { key: 'f3', title: 'Fase 3 — Testes & Ajustes', color: '#F59E0B', hint: 'Semana 6: revisão...' },
          { key: 'f4', title: 'Fase 4 — Lançamento', color: '#10B981', hint: 'Semana 7: publicação...' },
        ],
      },
      {
        id: 'scrum',
        title: 'Scrum Sprint',
        icon: '🔄',
        color: '#8B5CF6',
        subtitle: 'Planejamento e Review',
        kind: 'framework',
        sections: [
          { key: 'goal', title: 'Meta da Sprint', color: '#6366F1', hint: 'Principal objetivo desta semana/quinzena...' },
          { key: 'backlog', title: 'Sprint Backlog', color: '#3B82F6', hint: 'Histórias e tarefas selecionadas...' },
          { key: 'review', title: 'Review & Retrospectiva', color: '#10B981', hint: 'O que foi bom e o que melhorar...' },
        ],
      },
      {
        id: 'raci',
        title: 'Matriz RACI',
        icon: '👥',
        color: '#EC4899',
        subtitle: 'Papéis e responsabilidades',
        kind: 'framework',
        sections: [
          { key: 'r', title: 'R — Responsável (Quem executa)', color: '#3B82F6', hint: 'Pessoas e tarefas...' },
          { key: 'a', title: 'A — Aprovador (Dono final)', color: '#EF4444', hint: 'Quem aprova...' },
          { key: 'c', title: 'C — Consultado (Especialistas)', color: '#F59E0B', hint: 'Quem contribui...' },
          { key: 'i', title: 'I — Informado (Acompanha)', color: '#10B981', hint: 'Quem recebe status...' },
        ],
      },
      {
        id: 'kaizen',
        title: 'Kaizen',
        icon: '📈',
        color: '#10B981',
        subtitle: 'Melhoria contínua diária',
        kind: 'framework',
        sections: [
          { key: 'prob', title: 'Pequeno Gargalo Identificado', color: '#F59E0B', hint: 'O que está travando hoje...' },
          { key: 'fix', title: 'Melhoria de 1% Hoje', color: '#10B981', hint: 'Ação simples imediata...' },
          { key: 'result', title: 'Impacto Observado', color: '#3B82F6', hint: 'Resultado após aplicar...' },
        ],
      },
      {
        id: 'fluxograma',
        title: 'Fluxograma',
        icon: '🔀',
        color: '#6366F1',
        subtitle: 'Editor visual completo de processos',
        kind: 'flow_editor',
      },
    ],
  },
  {
    id: 'personal_journey',
    title: 'Jornada Pessoal & Métodos',
    tools: [
      {
        id: 'wheel_life',
        title: 'Roda da Vida',
        icon: '🎡',
        color: '#8B5CF6',
        subtitle: 'Equilíbrio em 8 áreas (1–10)',
        kind: 'wheel',
      },
      {
        id: 'habits',
        title: 'Hábitos & Rotina',
        icon: '🔥',
        color: '#F59E0B',
        subtitle: 'Check-in diário e streaks',
        kind: 'habits',
      },
      {
        id: 'ikigai',
        title: 'Ikigai',
        icon: '☯',
        color: '#10B981',
        subtitle: 'Propósito de vida',
        kind: 'framework',
        sections: [
          { key: 'love', title: '❤️ O que você AMA fazer', color: '#EF4444', hint: 'Paixões e interesses...' },
          { key: 'good', title: '⭐ No que você é BOM', color: '#F59E0B', hint: 'Talentos e habilidades...' },
          { key: 'world', title: '🌍 O que o MUNDO precisa', color: '#10B981', hint: 'Problemas que você ajuda a resolver...' },
          { key: 'paid', title: '💰 Pelo que pode ser PAGO', color: '#3B82F6', hint: 'Profissão, serviços, produtos...' },
          { key: 'center', title: '✨ Meu Ikigai (Síntese)', color: '#A855F7', hint: 'A união dos 4 pilares...' },
        ],
      },
      {
        id: 'maslow',
        title: 'Pirâmide de Maslow',
        icon: '🔺',
        color: '#EC4899',
        subtitle: 'Necessidades e prioridades',
        kind: 'framework',
        sections: [
          { key: 'self', title: '5. Autorrealização (Propósito)', color: '#A855F7', hint: 'Criatividade, legado...' },
          { key: 'esteem', title: '4. Estima (Reconhecimento)', color: '#3B82F6', hint: 'Confiança, conquistas...' },
          { key: 'social', title: '3. Sociais (Conexões)', color: '#10B981', hint: 'Família, amigos, comunidade...' },
          { key: 'safety', title: '2. Segurança (Estabilidade)', color: '#F59E0B', hint: 'Finanças, moradia, saúde...' },
          { key: 'physio', title: '1. Fisiológicas (Base)', color: '#EF4444', hint: 'Sono, alimentação, exercício...' },
        ],
      },
      {
        id: 'ivy_lee',
        title: 'Método Ivy Lee',
        icon: '6️⃣',
        color: '#3B82F6',
        subtitle: 'As 6 prioridades do dia',
        kind: 'framework',
        sections: [
          { key: 'p1', title: '1. Tarefa #1 (Mais Importante)', color: '#EF4444', hint: 'Não passe para a #2 antes de acabar esta...' },
          { key: 'p2', title: '2–3. Prioridades Médias', color: '#F59E0B', hint: 'Tarefa 2 e Tarefa 3...' },
          { key: 'p4', title: '4–6. Demais Tarefas', color: '#10B981', hint: 'Tarefas 4, 5 e 6...' },
        ],
      },
      {
        id: 'gtd',
        title: 'Método GTD',
        icon: '📥',
        color: '#06B6D4',
        subtitle: 'Capturar, Esclarecer, Organizar',
        kind: 'framework',
        sections: [
          { key: 'inbox', title: '1. Caixa de Entrada (Capturar)', color: '#6366F1', hint: 'Tire tudo da cabeça aqui...' },
          { key: 'next', title: '2. Próximas Ações (< 2 min faça já)', color: '#10B981', hint: 'Ações concretas...' },
          { key: 'wait', title: '3. Aguardando / Delegado', color: '#F59E0B', hint: 'Depende de outras pessoas...' },
          { key: 'someday', title: '4. Algum Dia / Talvez', color: '#64748B', hint: 'Ideias para o futuro...' },
        ],
      },
      {
        id: 'cha_alpen',
        title: 'CHA / ALPEN / 2 Min',
        icon: '🧩',
        color: '#6366F1',
        subtitle: 'Competências e foco rápido',
        kind: 'framework',
        sections: [
          { key: 'c', title: 'C — Conhecimento (O que aprender)', color: '#3B82F6', hint: 'Teoria e estudos...' },
          { key: 'h', title: 'H — Habilidade (O que praticar)', color: '#10B981', hint: 'Execução prática...' },
          { key: 'a', title: 'A — Atitude (Comportamento)', color: '#F59E0B', hint: 'Disciplina e ação...' },
          { key: 'twomin', title: '⚡ Regra dos 2 Minutos & Minimalismo', color: '#EF4444', hint: 'O que eliminar e o que fazer em 2 minutos...' },
        ],
      },
    ],
  },
  {
    id: 'strategic',
    title: 'Ferramentas Estratégicas',
    tools: [
      {
        id: 'swot',
        title: 'Análise SWOT',
        icon: '⊞',
        color: '#3B82F6',
        subtitle: 'Forças, Fraquezas, Oportunidades',
        kind: 'framework',
        sections: [
          { key: 's', title: 'Forças (Strengths - Interno)', color: '#10B981', hint: 'Seus pontos fortes e diferenciais...' },
          { key: 'w', title: 'Fraquezas (Weaknesses - Interno)', color: '#EF4444', hint: 'O que precisa melhorar...' },
          { key: 'o', title: 'Oportunidades (Externo)', color: '#3B82F6', hint: 'Tendências e chances de mercado...' },
          { key: 't', title: 'Ameaças (Threats - Externo)', color: '#F59E0B', hint: 'Riscos e concorrentes...' },
        ],
      },
      {
        id: 'pestel',
        title: 'Análise PESTEL',
        icon: '🌐',
        color: '#8B5CF6',
        subtitle: 'Cenário macroambiental',
        kind: 'framework',
        sections: [
          { key: 'p', title: 'P — Político', color: '#6366F1', hint: 'Leis, impostos, incentivos...' },
          { key: 'e', title: 'E — Econômico', color: '#10B981', hint: 'Juros, renda, inflação...' },
          { key: 's', title: 'S — Social', color: '#F59E0B', hint: 'Comportamento e hábitos...' },
          { key: 't', title: 'T — Tecnológico', color: '#38BDF8', hint: 'IA, automação, ferramentas...' },
          { key: 'ec', title: 'E — Ecológico / Legal (L)', color: '#EC4899', hint: 'Sustentabilidade e normas...' },
        ],
      },
      {
        id: 'w2h',
        title: '5W2H',
        icon: '📋',
        color: '#0EA5E9',
        subtitle: 'Plano de ação completo',
        kind: 'framework',
        sections: [
          { key: 'what', title: '1. O Quê? (What)', color: '#3B82F6', hint: 'Qual ação será feita...' },
          { key: 'why', title: '2. Por Quê? (Why)', color: '#8B5CF6', hint: 'Justificativa e objetivo...' },
          { key: 'where', title: '3. Onde? (Where)', color: '#10B981', hint: 'Local ou plataforma...' },
          { key: 'when', title: '4. Quando? (When)', color: '#F59E0B', hint: 'Data de início e fim...' },
          { key: 'who', title: '5. Quem? (Who)', color: '#EC4899', hint: 'Responsável pela execução...' },
          { key: 'how', title: '6. Como? (How)', color: '#06B6D4', hint: 'Passo a passo do método...' },
          { key: 'much', title: '7. Quanto Custa? (How Much)', color: '#EF4444', hint: 'Orçamento ou tempo...' },
        ],
      },
      {
        id: 'pdca',
        title: 'Ciclo PDCA',
        icon: '♻',
        color: '#10B981',
        subtitle: 'Plan, Do, Check, Act',
        kind: 'framework',
        sections: [
          { key: 'p', title: 'P — Planejar (Plan)', color: '#3B82F6', hint: 'Meta e plano...' },
          { key: 'd', title: 'D — Executar (Do)', color: '#10B981', hint: 'Ações realizadas...' },
          { key: 'c', title: 'C — Verificar (Check)', color: '#F59E0B', hint: 'Resultados medidos...' },
          { key: 'a', title: 'A — Agir / Corrigir (Act)', color: '#EF4444', hint: 'Ajustes para o próximo ciclo...' },
        ],
      },
      {
        id: 'ooda',
        title: 'Ciclo OODA',
        icon: '⚡',
        color: '#F59E0B',
        subtitle: 'Decisão rápida sob pressão',
        kind: 'framework',
        sections: [
          { key: 'obs', title: '1. Observar', color: '#3B82F6', hint: 'Fatos e sinais atuais...' },
          { key: 'ori', title: '2. Orientar', color: '#8B5CF6', hint: 'Contexto e análise...' },
          { key: 'dec', title: '3. Decidir', color: '#F59E0B', hint: 'Hipótese escolhida...' },
          { key: 'act', title: '4. Agir', color: '#10B981', hint: 'Execução imediata...' },
        ],
      },
      {
        id: 'ishikawa',
        title: 'Ishikawa / Pareto',
        icon: '🐟',
        color: '#6366F1',
        subtitle: 'Causa raiz e regra 80/20',
        kind: 'framework',
        sections: [
          { key: 'effect', title: 'Problema / Efeito Principal', color: '#EF4444', hint: 'Qual problema queremos resolver...' },
          { key: 'causes', title: 'Causas (Método, Mão de Obra, Ferramenta)', color: '#F59E0B', hint: 'Liste as possíveis causas...' },
          { key: 'pareto', title: 'Regra 80/20 (20% que gera 80%)', color: '#10B981', hint: 'As 2 causas mais críticas para atacar já...' },
        ],
      },
    ],
  },
  {
    id: 'special',
    title: 'Ferramentas Especiais',
    tools: [
      {
        id: 'milanote_vision',
        title: 'Quadro de Visão',
        icon: '🎨',
        color: '#EC4899',
        subtitle: 'Estilo Milanote completo',
        kind: 'milanote',
      },
      {
        id: 'mindmap',
        title: 'Mapa Mental',
        icon: '🧠',
        color: '#A855F7',
        subtitle: 'Estilo miMind completo',
        kind: 'mindmap',
      },
      {
        id: 'flashcards',
        title: 'Flashcards',
        icon: '🃏',
        color: '#6366F1',
        subtitle: 'Memorização frente e verso',
        kind: 'flashcards',
      },
      {
        id: 'budget',
        title: 'Planilha Orçamento',
        icon: '💰',
        color: '#10B981',
        subtitle: 'Entradas, saídas e saldo',
        kind: 'budget',
      },
      {
        id: 'wordcloud',
        title: 'Nuvem de Palavras',
        icon: '☁',
        color: '#38BDF8',
        subtitle: 'Termos mais usados no app',
        kind: 'wordcloud',
      },
      {
        id: 'canvas',
        title: 'Business Canvas',
        icon: '🧱',
        color: '#F59E0B',
        subtitle: 'Modelo de negócio / projeto',
        kind: 'framework',
        sections: [
          { key: 'vp', title: 'Proposta de Valor', color: '#6366F1', hint: 'Que dor você resolve?' },
          { key: 'seg', title: 'Público / Clientes', color: '#3B82F6', hint: 'Para quem você cria valor?' },
          { key: 'ch', title: 'Canais & Relacionamento', color: '#0EA5E9', hint: 'Como chega até o público?' },
          { key: 'rev', title: 'Fontes de Receita', color: '#10B981', hint: 'Como monetiza?' },
          { key: 'cost', title: 'Atividades, Recursos & Custos', color: '#EF4444', hint: 'O que precisa e quanto custa?' },
        ],
      },
      {
        id: 'storytelling',
        title: 'Storytelling',
        icon: '🎬',
        color: '#EC4899',
        subtitle: 'Estrutura narrativa',
        kind: 'framework',
        sections: [
          { key: 'hook', title: '1. Gancho / Contexto', color: '#6366F1', hint: 'Como a história começa...' },
          { key: 'conflict', title: '2. Conflito / Desafio', color: '#EF4444', hint: 'O obstáculo principal...' },
          { key: 'climax', title: '3. Virada / Clímax', color: '#F59E0B', hint: 'A descoberta ou solução...' },
          { key: 'vision', title: '4. Resolução', color: '#10B981', hint: 'Transformação final...' },
        ],
      },
      {
        id: 'zettelkasten',
        title: 'Zettelkasten',
        icon: '🗂',
        color: '#06B6D4',
        subtitle: 'Notas atômicas permanentes',
        kind: 'framework',
        sections: [
          { key: 'id', title: 'Código / Tema Atômico', color: '#06B6D4', hint: 'Ex: 2026-A1 — Uma única ideia clara...' },
          { key: 'body', title: 'Explicação com suas palavras', color: '#3B82F6', hint: 'Desenvolva a ideia sem copiar...' },
          { key: 'links', title: 'Conexões [[Links]] e Fontes', color: '#A855F7', hint: 'Com quais notas se conecta...' },
        ],
      },
    ],
  },
  {
    id: 'insights',
    title: 'Insights & Dados',
    tools: [
      {
        id: 'kpi_stats',
        title: 'KPIs & Estatísticas',
        icon: '📊',
        color: '#3B82F6',
        subtitle: 'Desempenho do segundo cérebro',
        kind: 'stats',
      },
    ],
  },
];
