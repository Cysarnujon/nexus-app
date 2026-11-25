import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { EditorBlock, parseContentToBlocks } from '../editor/blocks';

const MEDIA_DIR = `${FileSystem.documentDirectory ?? ''}nexus_media/`;

export async function persistMediaFile(
  sourceUri: string,
  originalName?: string
): Promise<string> {
  if (!FileSystem.documentDirectory) return sourceUri;

  try {
    const dirInfo = await FileSystem.getInfoAsync(MEDIA_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(MEDIA_DIR, { intermediates: true });
    }

    const cleanName = (originalName || 'media')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(-45);
    const extFromUri = sourceUri.split('?')[0].split('.').pop();
    const hasExt = cleanName.includes('.');
    const finalName = hasExt
      ? `${Date.now()}-${cleanName}`
      : `${Date.now()}-${cleanName}.${extFromUri && extFromUri.length <= 5 ? extFromUri : 'bin'}`;

    const destUri = `${MEDIA_DIR}${finalName}`;
    await FileSystem.copyAsync({ from: sourceUri, to: destUri });
    return destUri;
  } catch {
    return sourceUri;
  }
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function shareLocalFile(
  uri: string,
  mimeType?: string
): Promise<void> {
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('Compartilhamento indisponível neste dispositivo.');
  }
  await Sharing.shareAsync(
    uri,
    mimeType ? { mimeType } : undefined
  );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatInlineHtml(text: string): string {
  let out = escapeHtml(text);
  out = out.replace(/==(.*?)==/g, '<mark>$1</mark>');
  out = out.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*(.*?)\*/g, '<em>$1</em>');
  out = out.replace(/__(.*?)__/g, '<u>$1</u>');
  out = out.replace(/~~(.*?)~~/g, '<del>$1</del>');
  out = out.replace(/\^(.*?)\^/g, '<sup>$1</sup>');
  out = out.replace(/~(.*?)~/g, '<sub>$1</sub>');
  out = out.replace(/`(.*?)`/g, '<code>$1</code>');
  return out;
}

function blockToHtml(b: EditorBlock, listNum: number): string {
  const align = b.align ?? 'left';
  const indentPx = (b.indent ?? 0) * 20;
  const styleAttr = `style="text-align:${align};margin-left:${indentPx}px;"`;
  const txt = formatInlineHtml(b.text);

  switch (b.type) {
    case 'h1':
    case 'toggle_h1':
      return `<h1 ${styleAttr}>${txt}</h1>${b.toggleBody ? `<p ${styleAttr}>${formatInlineHtml(b.toggleBody)}</p>` : ''}`;
    case 'h2':
    case 'toggle_h2':
      return `<h2 ${styleAttr}>${txt}</h2>${b.toggleBody ? `<p ${styleAttr}>${formatInlineHtml(b.toggleBody)}</p>` : ''}`;
    case 'h3':
      return `<h3 ${styleAttr}>${txt}</h3>`;
    case 'h4':
      return `<h4 ${styleAttr}>${txt}</h4>`;
    case 'h5':
      return `<h5 ${styleAttr}>${txt}</h5>`;
    case 'h6':
      return `<h6 ${styleAttr}>${txt}</h6>`;
    case 'subtitle':
      return `<p class="subtitle" ${styleAttr}>${txt}</p>`;
    case 'caption':
    case 'small':
      return `<p class="small" ${styleAttr}>${txt}</p>`;
    case 'bullet':
      return `<div class="list-item" ${styleAttr}>• ${txt}</div>`;
    case 'numbered':
      return `<div class="list-item" ${styleAttr}>${listNum}. ${txt}</div>`;
    case 'steps':
      return `<div class="list-item" ${styleAttr}><strong>Passo ${listNum}:</strong> ${txt}</div>`;
    case 'todo':
      return `<div class="list-item" ${styleAttr}>${b.checked ? '☑' : '☐'} <span style="${b.checked ? 'text-decoration:line-through;color:#64748b;' : ''}">${txt}</span></div>`;
    case 'definition':
      return `<div class="box" ${styleAttr}><strong>${escapeHtml(b.defTerm ?? 'Termo')}:</strong> ${txt}</div>`;
    case 'quote':
      return `<blockquote ${styleAttr}>${txt}</blockquote>`;
    case 'callout':
      return `<div class="callout" ${styleAttr}>${txt}</div>`;
    case 'code':
    case 'preformatted':
    case 'math':
      return `<pre>${escapeHtml(b.text)}</pre>`;
    case 'footnote':
      return `<p class="small" ${styleAttr}>[1] ${txt}</p>`;
    case 'divider':
      return '<hr />';
    case 'pagebreak':
      return '<div style="page-break-after:always;"></div>';
    case 'toggle':
      return `<div class="box" ${styleAttr}><strong>▸ ${txt}</strong><div>${formatInlineHtml(b.toggleBody ?? '')}</div></div>`;
    case 'table': {
      const rows = b.tableData ?? [];
      if (rows.length === 0) return '';
      const trs = rows
        .map((row, rIdx) => {
          const tag = rIdx === 0 ? 'th' : 'td';
          const tds = row.map((c) => `<${tag}>${escapeHtml(c)}</${tag}>`).join('');
          return `<tr>${tds}</tr>`;
        })
        .join('');
      return `<table>${trs}</table>`;
    }
    case 'kanban': {
      const cols = b.kanbanData?.columns ?? [];
      return `<div class="box">${cols
        .map(
          (c) =>
            `<div><strong>${escapeHtml(c.title)}:</strong> ${c.cards.map((x) => escapeHtml(x.text)).join(' • ') || '—'}</div>`
        )
        .join('')}</div>`;
    }
    case 'chart': {
      const items = b.chartData ?? [];
      return `<div class="box">${items
        .map((i) => `<div><strong>${escapeHtml(i.label)}:</strong> ${i.value}</div>`)
        .join('')}</div>`;
    }
    case 'tabs': {
      const tabs = b.tabsData ?? [];
      return `<div class="box">${tabs
        .map((t) => `<div><strong>[${escapeHtml(t.title)}]</strong> ${formatInlineHtml(t.body)}</div>`)
        .join('')}</div>`;
    }
    case 'timeline': {
      const items = b.timelineData ?? [];
      return `<div class="box">${items
        .map((t) => `<div><strong>${escapeHtml(t.date)}:</strong> ${escapeHtml(t.title)}</div>`)
        .join('')}</div>`;
    }
    case 'bookmark':
      return `<div class="box">🌐 <strong>${txt}</strong> (${escapeHtml(b.url ?? '')})</div>`;
    case 'button':
      return `<div class="box">⚡ <strong>${txt}</strong></div>`;
    case 'image':
      return `<div class="box">🖼️ <strong>Imagem:</strong> ${txt || escapeHtml(b.mediaName ?? 'Anexo de imagem')}</div>`;
    case 'gallery':
      return `<div class="box">🗂 <strong>Galeria de Imagens:</strong> ${(b.galleryUris ?? []).length} foto(s) ${txt ? `— ${txt}` : ''}</div>`;
    case 'video':
      return `<div class="box">🎬 <strong>Vídeo:</strong> ${txt || escapeHtml(b.mediaName ?? 'Anexo de vídeo')}</div>`;
    case 'audio':
      return `<div class="box">🎙 <strong>Áudio:</strong> ${txt || escapeHtml(b.mediaName ?? 'Nota de voz')}</div>`;
    case 'file':
      return `<div class="box">📎 <strong>Arquivo:</strong> ${escapeHtml(b.mediaName ?? 'Documento')} ${b.mediaSize ? `(${formatFileSize(b.mediaSize)})` : ''}</div>`;
    default:
      return txt.trim() ? `<p ${styleAttr}>${txt}</p>` : '';
  }
}

export function buildNoteHtml(title: string, rawContent: string): string {
  const blocks = parseContentToBlocks(rawContent);
  let counter = 0;
  const body = blocks
    .map((b) => {
      if (b.type === 'numbered' || b.type === 'steps') {
        counter += 1;
      } else {
        counter = 0;
      }
      return blockToHtml(b, counter);
    })
    .join('\n');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { margin: 28px; }
    body { font-family: -apple-system, Roboto, Arial, sans-serif; color: #0f172a; line-height: 1.5; font-size: 14px; }
    h1.doc-title { font-size: 26px; border-bottom: 2px solid #6366f1; padding-bottom: 8px; margin-bottom: 18px; }
    h1 { font-size: 21px; margin-top: 16px; }
    h2 { font-size: 18px; margin-top: 14px; }
    h3 { font-size: 16px; margin-top: 12px; }
    .subtitle { color: #475569; font-style: italic; }
    .small { color: #64748b; font-size: 12px; }
    .list-item { margin: 4px 0; }
    blockquote { border-left: 4px solid #6366f1; background: #f1f5f9; padding: 8px 12px; margin: 10px 0; }
    .callout { border-left: 4px solid #0284c7; background: #e0f2fe; padding: 10px 12px; border-radius: 6px; margin: 10px 0; }
    .box { border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; margin: 10px 0; background: #f8fafc; }
    pre { background: #0f172a; color: #e2e8f0; padding: 10px; border-radius: 6px; font-family: monospace; white-space: pre-wrap; }
    code { background: #e2e8f0; padding: 1px 4px; border-radius: 4px; font-family: monospace; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
    th { background: #e2e8f0; font-weight: bold; }
    hr { border: none; border-top: 1px solid #cbd5e1; margin: 14px 0; }
    mark { background: #fef08a; padding: 0 2px; }
  </style>
</head>
<body>
  <h1 class="doc-title">${escapeHtml(title)}</h1>
  ${body}
</body>
</html>`;
}

export async function exportNoteToPdf(
  title: string,
  rawContent: string
): Promise<void> {
  const html = buildNoteHtml(title, rawContent);
  const { uri } = await Print.printToFileAsync({ html });
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('Compartilhamento indisponível neste dispositivo.');
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: '.pdf',
    dialogTitle: `${title}.pdf`,
  });
}

export async function printNote(
  title: string,
  rawContent: string
): Promise<void> {
  const html = buildNoteHtml(title, rawContent);
  await Print.printAsync({ html });
}
