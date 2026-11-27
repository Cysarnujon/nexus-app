import { makeId } from '../editor/blocks';

export type CanvaLayerType = 'text' | 'rect' | 'circle' | 'star' | 'image' | 'sticker';
export type CanvaFilter = 'none' | 'grayscale' | 'sepia' | 'contrast' | 'bright';

export interface CanvaLayer {
  id: string;
  type: CanvaLayerType;
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string;
  fontSize?: number;
  bold?: boolean;
  color?: string;
  bgColor?: string;
  borderRadius?: number;
  src?: string;
  filter?: CanvaFilter;
}

export interface CanvaPage {
  id: string;
  bgColor: string;
  bgGradient?: string;
  layers: CanvaLayer[];
}

export interface CanvaProject {
  id: string;
  title: string;
  categoryTitle: string;
  width: number;
  height: number;
  pages: CanvaPage[];
  updatedAt: number;
}

export interface CanvaTemplateDef {
  id: string;
  label: string;
  icon: string;
  width: number;
  height: number;
  bgColor: string;
  bgGradient?: string;
  starterTitle: string;
  starterSub: string;
  extraPages?: number;
}

export interface CanvaCategoryDef {
  id: string;
  title: string;
  templates: CanvaTemplateDef[];
}

export const CANVA_GRADIENTS: { label: string; css: string; fallback: string }[] = [
  { label: 'Nenhum', css: '', fallback: '#1E293B' },
  { label: 'Índigo Neon', css: 'linear-gradient(135deg, #4F46E5, #EC4899)', fallback: '#4F46E5' },
  { label: 'Oceano', css: 'linear-gradient(135deg, #0284C7, #10B981)', fallback: '#0284C7' },
  { label: 'Pôr do Sol', css: 'linear-gradient(135deg, #F97316, #E11D48)', fallback: '#F97316' },
  { label: 'Roxo Real', css: 'linear-gradient(135deg, #3B0764, #7C3AED)', fallback: '#7C3AED' },
  { label: 'Minimal Claro', css: 'linear-gradient(135deg, #F8FAFC, #E2E8F0)', fallback: '#F8FAFC' },
  { label: 'Ouro Escuro', css: 'linear-gradient(135deg, #0F172A, #78350F)', fallback: '#0F172A' },
];

export const CANVA_CATEGORIES: CanvaCategoryDef[] = [
  {
    id: 'social',
    title: '1. Redes Sociais e Conteúdo Digital',
    templates: [
      { id: 'ig_post', label: 'Post Instagram (1:1)', icon: '📱', width: 1080, height: 1080, bgColor: '#4F46E5', bgGradient: 'linear-gradient(135deg, #4F46E5, #EC4899)', starterTitle: 'SEU TÍTULO AQUI', starterSub: 'Arraste e edite no Estúdio Nexus' },
      { id: 'ig_story', label: 'Story / Reels / TikTok (9:16)', icon: '📲', width: 1080, height: 1920, bgColor: '#0F172A', bgGradient: 'linear-gradient(135deg, #3B0764, #7C3AED)', starterTitle: 'NOVIDADE!', starterSub: 'Toque para editar seu Story' },
      { id: 'yt_thumb', label: 'Capa de YouTube (16:9)', icon: '▶️', width: 1280, height: 720, bgColor: '#DC2626', bgGradient: 'linear-gradient(135deg, #0F172A, #DC2626)', starterTitle: 'COMO FAZER ISSO', starterSub: 'ASSISTA AGORA 🔥' },
      { id: 'pin', label: 'Pin do Pinterest (2:3)', icon: '📌', width: 1000, height: 1500, bgColor: '#FCE7F3', starterTitle: '5 Dicas Práticas', starterSub: 'Salve para consultar depois' },
      { id: 'carousel', label: 'Carrossel (3 Páginas)', icon: '🎠', width: 1080, height: 1080, bgColor: '#0284C7', bgGradient: 'linear-gradient(135deg, #0284C7, #10B981)', starterTitle: 'DESLIZE PARA O LADO →', starterSub: 'Guia completo passo a passo', extraPages: 2 },
      { id: 'podcast', label: 'Capa de Podcast', icon: '🎙️', width: 1080, height: 1080, bgColor: '#1E1B4B', starterTitle: 'PODCAST NEXUS', starterSub: 'Episódio #01 • Novo papo' },
    ],
  },
  {
    id: 'edu',
    title: '2. Apresentações e Educação',
    templates: [
      { id: 'slides', label: 'Apresentação (16:9)', icon: '📽️', width: 1920, height: 1080, bgColor: '#0F172A', bgGradient: 'linear-gradient(135deg, #0F172A, #1E3A8A)', starterTitle: 'Título da Apresentação', starterSub: 'Subtítulo • Autor / Data', extraPages: 2 },
      { id: 'infographic', label: 'Infográfico Vertical', icon: '📊', width: 800, height: 1800, bgColor: '#F8FAFC', starterTitle: 'INFOGRÁFICO', starterSub: '1. Dado A • 2. Dado B • 3. Conclusão' },
      { id: 'certificate', label: 'Certificado', icon: '🏅', width: 1400, height: 990, bgColor: '#FFFBEB', starterTitle: 'CERTIFICADO DE CONCLUSÃO', starterSub: 'Conferido a [Seu Nome]' },
      { id: 'study_sheet', label: 'Resumo Visual / Ficha', icon: '📚', width: 1080, height: 1350, bgColor: '#1E293B', starterTitle: 'Resumo de Estudo', starterSub: 'Conceitos-chave e fórmulas' },
    ],
  },
  {
    id: 'diagrams',
    title: '3. Diagramas e Esquemas Visuais',
    templates: [
      { id: 'swot_vis', label: 'Análise SWOT Visual', icon: '⊞', width: 1200, height: 1200, bgColor: '#0B0F17', starterTitle: 'MATRIZ SWOT', starterSub: 'Forças | Fraquezas | Oportunidades | Ameaças' },
      { id: 'compare', label: 'Quadro Comparativo', icon: '⚖️', width: 1200, height: 900, bgColor: '#111827', starterTitle: 'OPÇÃO A  vs  OPÇÃO B', starterSub: 'Prós, Contras e Conclusão' },
      { id: 'timeline_vis', label: 'Linha do Tempo Visual', icon: '⏳', width: 1400, height: 800, bgColor: '#061A2E', starterTitle: 'LINHA DO TEMPO', starterSub: 'Etapa 1 → Etapa 2 → Etapa 3' },
    ],
  },
  {
    id: 'photos',
    title: '4. Fotografias e Colagens',
    templates: [
      { id: 'collage', label: 'Colagem / Montagem', icon: '🖼️', width: 1080, height: 1080, bgColor: '#0F172A', starterTitle: 'MINHA COLAGEM', starterSub: 'Adicione fotos da galeria com + Foto' },
      { id: 'mockup', label: 'Arte / Avatar / Wallpaper', icon: '🎨', width: 1080, height: 1920, bgColor: '#3B0764', bgGradient: 'linear-gradient(135deg, #4F46E5, #EC4899)', starterTitle: 'ARTE DIGITAL', starterSub: 'Personalize formas e filtros' },
    ],
  },
  {
    id: 'video_anim',
    title: '5. Slides Animados e Vinhetas',
    templates: [
      { id: 'anim_slides', label: 'Slides Animados (Play ▶)', icon: '🎬', width: 1280, height: 720, bgColor: '#05050A', bgGradient: 'linear-gradient(135deg, #3B0764, #7C3AED)', starterTitle: 'CENA 1 — ABERTURA', starterSub: 'Adicione páginas e toque ▶ Reproduzir', extraPages: 2 },
    ],
  },
  {
    id: 'business',
    title: '6. Empresas e Negócios',
    templates: [
      { id: 'logo', label: 'Logotipo (1:1)', icon: '💎', width: 1000, height: 1000, bgColor: '#0F172A', starterTitle: 'SUA MARCA', starterSub: 'SLOGAN DA EMPRESA' },
      { id: 'biz_card', label: 'Cartão de Visita', icon: '🪪', width: 1050, height: 600, bgColor: '#1E293B', starterTitle: 'Seu Nome', starterSub: 'Cargo • (00) 99999-9999 • @insta' },
      { id: 'menu', label: 'Cardápio / Catálogo', icon: '🍽️', width: 1080, height: 1528, bgColor: '#1C1917', starterTitle: 'CARDÁPIO DO DIA', starterSub: 'Item 1 — R$ 25,00\nItem 2 — R$ 32,00' },
      { id: 'flyer', label: 'Panfleto / Promoção', icon: '📢', width: 1080, height: 1350, bgColor: '#EA580C', bgGradient: 'linear-gradient(135deg, #F97316, #E11D48)', starterTitle: 'SUPER OFERTA!', starterSub: 'Aproveite hoje com 30% OFF' },
    ],
  },
  {
    id: 'planner',
    title: '7. Planejamento Pessoal',
    templates: [
      { id: 'daily_plan', label: 'Planejador Diário', icon: '🗓️', width: 1080, height: 1528, bgColor: '#F8FAFC', starterTitle: 'MEU DIA', starterSub: 'Top 3 Prioridades • Horários • Gratidão' },
      { id: 'vision_canva', label: 'Quadro de Visão Visual', icon: '🌟', width: 1400, height: 1000, bgColor: '#1E1B4B', starterTitle: 'VISÃO 2026', starterSub: 'Sonhos, Metas e Inspirações' },
    ],
  },
  {
    id: 'books',
    title: '8. Livros e Publicações',
    templates: [
      { id: 'ebook_cover', label: 'Capa de E-book', icon: '📖', width: 1000, height: 1500, bgColor: '#0C4A6E', bgGradient: 'linear-gradient(135deg, #0284C7, #10B981)', starterTitle: 'TÍTULO DO E-BOOK', starterSub: 'Um guia definitivo • Por Seu Nome', extraPages: 2 },
      { id: 'newsletter', label: 'Newsletter / Revista', icon: '📰', width: 1080, height: 1528, bgColor: '#FFFFFF', starterTitle: 'EDIÇÃO #01', starterSub: 'Destaques da semana' },
    ],
  },
  {
    id: 'print',
    title: '9. Impressão, Convites e Estampas',
    templates: [
      { id: 'invite', label: 'Convite', icon: '💌', width: 1080, height: 1528, bgColor: '#500724', starterTitle: 'VOCÊ É CONVIDADO!', starterSub: 'Data • Hora • Local' },
      { id: 'tshirt', label: 'Estampa de Camiseta / Adesivo', icon: '👕', width: 1200, height: 1200, bgColor: '#000000', starterTitle: 'ESTAMPA ORIGINAL', starterSub: 'ARTE PARA IMPRESSÃO' },
    ],
  },
  {
    id: 'web',
    title: '10. Sites, Wireframes e Portfólios',
    templates: [
      { id: 'landing', label: 'Landing Page / Portfólio', icon: '🌐', width: 1440, height: 1024, bgColor: '#0F172A', starterTitle: 'Transforme Suas Ideias', starterSub: 'Conheça nossa solução • [ Começar Agora ]' },
      { id: 'wireframe', label: 'Wireframe / Protótipo App', icon: '📐', width: 1080, height: 1920, bgColor: '#F1F5F9', starterTitle: 'TELA DO APP', starterSub: 'Cabeçalho • Card Principal • Botão CTA' },
    ],
  },
];

export function buildProjectFromCanvaTemplate(
  tpl: CanvaTemplateDef,
  categoryTitle: string
): CanvaProject {
  const isLight =
    tpl.bgColor === '#F8FAFC' ||
    tpl.bgColor === '#FFFBEB' ||
    tpl.bgColor === '#FCE7F3' ||
    tpl.bgColor === '#FFFFFF' ||
    tpl.bgColor === '#F1F5F9';

  const txtColor = isLight ? '#0F172A' : '#FFFFFF';
  const subColor = isLight ? '#475569' : '#E2E8F0';
  const totalPages = 1 + (tpl.extraPages ?? 0);
  const pages: CanvaPage[] = [];

  for (let p = 0; p < totalPages; p++) {
    const cx = Math.round(tpl.width * 0.1);
    const cy = Math.round(tpl.height * 0.25);
    pages.push({
      id: makeId('cpg'),
      bgColor: tpl.bgColor,
      bgGradient: tpl.bgGradient,
      layers: [
        {
          id: makeId('lyr'),
          type: 'rect',
          x: Math.round(tpl.width * 0.08),
          y: Math.round(tpl.height * 0.16),
          w: Math.round(tpl.width * 0.84),
          h: Math.round(tpl.height * 0.68),
          bgColor: isLight ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.12)',
          borderRadius: 36,
        },
        {
          id: makeId('lyr'),
          type: 'text',
          x: cx,
          y: cy,
          w: Math.round(tpl.width * 0.8),
          h: 140,
          text: p === 0 ? tpl.starterTitle : `PÁGINA ${p + 1}`,
          fontSize: Math.round(Math.min(tpl.width, tpl.height) * 0.065),
          bold: true,
          color: txtColor,
        },
        {
          id: makeId('lyr'),
          type: 'text',
          x: cx,
          y: cy + Math.round(tpl.height * 0.18),
          w: Math.round(tpl.width * 0.8),
          h: 120,
          text: p === 0 ? tpl.starterSub : 'Toque para editar este conteúdo...',
          fontSize: Math.round(Math.min(tpl.width, tpl.height) * 0.036),
          bold: false,
          color: subColor,
        },
      ],
    });
  }

  return {
    id: makeId('cnv'),
    title: tpl.label,
    categoryTitle,
    width: tpl.width,
    height: tpl.height,
    pages,
    updatedAt: Date.now(),
  };
}
