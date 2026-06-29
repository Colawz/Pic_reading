
import { Book, Illustration, Character, Location, VisualSpec } from '../types';
import { localImageUrlToDataUrl } from './referenceImageService';

type ExportableEntity = Character | Location;
type BookExportOptions = {
  visualSpec?: VisualSpec;
};

const escapeHtml = (value?: string) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const normalizeEntityName = (value: string) => value.trim().toLowerCase();

const getEntityScore = (item: ExportableEntity) => {
  let score = 0;
  if (item.imageUrl) score += 100;
  if (item.locked) score += 20;
  if (item.generationStatus === 'success') score += 10;
  score += Math.min((item.visualSummary || item.description || '').length, 80);
  return score;
};

const prepareEntitiesForExport = <T extends ExportableEntity>(items: T[]): T[] => {
  const byName = new Map<string, T>();

  items.forEach((item) => {
    const nameKey = normalizeEntityName(item.name);
    if (!nameKey) return;

    const existing = byName.get(nameKey);
    if (!existing || getEntityScore(item) > getEntityScore(existing)) {
      byName.set(nameKey, item);
    }
  });

  return Array.from(byName.values()).sort((a, b) => {
    if (Boolean(a.imageUrl) !== Boolean(b.imageUrl)) return a.imageUrl ? -1 : 1;
    if (a.locked !== b.locked) return a.locked ? -1 : 1;
    return a.name.localeCompare(b.name, 'zh-CN');
  });
};

const printReadyScript = `
  <script>
    window.onload = function() {
      const images = document.getElementsByTagName('img');
      const total = images.length;
      let settled = 0;

      if (total === 0) {
        window.parent.postMessage('print-ready', '*');
        return;
      }

      function check() {
        settled++;
        if (settled >= total) {
          window.parent.postMessage('print-ready', '*');
        }
      }

      for (let i = 0; i < total; i++) {
        if (images[i].complete) {
          check();
        } else {
          images[i].onload = check;
          images[i].onerror = check;
        }
      }
    };
  </script>
`;

const responseToDataUrl = async (response: Response): Promise<string> => {
  const blob = await response.blob();
  const mimeType = blob.type || response.headers.get('content-type') || 'image/png';
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return `data:${mimeType};base64,${btoa(binary)}`;
};

const resolveExportImageSrc = async (
  imageUrl?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | undefined> => {
  if (!imageUrl || imageUrl.startsWith('data:')) {
    return imageUrl;
  }

  try {
    if (imageUrl.startsWith('/pic_db/')) {
      return await localImageUrlToDataUrl(imageUrl, fetchImpl);
    }

    const response = await fetchImpl(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch export image: ${response.status}`);
    }

    return await responseToDataUrl(response);
  } catch (error) {
    console.warn('Failed to inline export image, falling back to original URL:', imageUrl, error);
    return imageUrl;
  }
};

const resolveIllustrationsForExport = async (
  illustrations: Record<string, Illustration>,
  fetchImpl: typeof fetch = fetch,
): Promise<Record<string, Illustration>> => {
  const entries = await Promise.all(
    Object.entries(illustrations).map(async ([paragraphId, illustration]) => [
      paragraphId,
      {
        ...illustration,
        imageUrl: await resolveExportImageSrc(illustration.imageUrl, fetchImpl),
      },
    ] as const),
  );

  return Object.fromEntries(entries);
};

const resolveEntitiesForExport = async <T extends Character | Location>(
  items: T[],
  fetchImpl: typeof fetch = fetch,
): Promise<T[]> =>
  Promise.all(
    items.map(async (item) => ({
      ...item,
      imageUrl: await resolveExportImageSrc(item.imageUrl, fetchImpl),
    })),
  );

export const buildBookExportHtml = async (
  book: Book,
  illustrations: Record<string, Illustration>,
  mode: 'full' | 'generated_chapters',
  fetchImpl: typeof fetch = fetch,
  options: BookExportOptions = {},
) => {
  const resolvedIllustrations = await resolveIllustrationsForExport(illustrations, fetchImpl);
  const resolvedCoverUrl = await resolveExportImageSrc(book.coverUrl, fetchImpl);
  const date = new Date().toLocaleDateString();
  const chaptersToExport = book.chapters.filter(chapter => {
    if (mode === 'full') return true;
    return chapter.paragraphs.some(paragraph => {
      const illustration = resolvedIllustrations[paragraph.id];
      return illustration?.status === 'completed' && Boolean(illustration.imageUrl);
    });
  });
  const exportedParagraphCount = chaptersToExport.reduce((sum, chapter) => sum + chapter.paragraphs.length, 0);
  const totalParagraphCount = book.chapters.reduce((sum, chapter) => sum + chapter.paragraphs.length, 0);
  const exportedParagraphIds = new Set(chaptersToExport.flatMap(chapter => chapter.paragraphs.map(paragraph => paragraph.id)));
  const illustrationsInScope = Object.values(resolvedIllustrations).filter(illustration => exportedParagraphIds.has(illustration.paragraphId));
  const completedIllustrations = illustrationsInScope.filter(illustration => illustration.status === 'completed' && illustration.imageUrl);
  const failedIllustrations = illustrationsInScope.filter(illustration => illustration.status === 'failed');
  const pendingIllustrations = illustrationsInScope.filter(illustration => illustration.status === 'pending' || illustration.status === 'generating');
  const illustratedChapterCount = chaptersToExport.filter(chapter =>
    chapter.paragraphs.some(paragraph => {
      const illustration = resolvedIllustrations[paragraph.id];
      return illustration?.status === 'completed' && Boolean(illustration.imageUrl);
    }),
  ).length;
  const exportModeLabel = mode === 'full' ? '完整图文导出' : '精选配图章节';
  const visualSpec = options.visualSpec;

  let htmlContent = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <title>${escapeHtml(book.title)}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700&family=Inter:wght@400;600;700&display=swap');
        * { box-sizing: border-box; }
        body { 
          font-family: 'Noto Serif SC', 'Georgia', serif; 
          line-height: 1.72; 
          color: #1f2937; 
          max-width: 860px; 
          margin: 0 auto; 
          padding: 32px 28px; 
          background: #fff; 
        }
        .cover { 
          position: relative;
          overflow: hidden;
          min-height: 720px;
          padding: 0; 
          margin-bottom: 24px; 
          border: 1px solid #e7ded1; 
          border-radius: 22px; 
          background:
            radial-gradient(circle at 92% 12%, rgba(248, 113, 113, 0.18), transparent 26%),
            linear-gradient(120deg, #fff8ed 0%, #f8efe2 45%, #e8f2ef 100%);
          box-shadow: 0 24px 70px rgba(47, 41, 34, 0.11);
        }
        .cover::before {
          content: "";
          position: absolute;
          inset: 0 auto 0 0;
          width: 16px;
          background: linear-gradient(180deg, #ef5d4a, #f5b85b 48%, #2d7f7a);
        }
        .cover::after {
          content: "";
          position: absolute;
          right: -110px;
          bottom: -130px;
          width: 330px;
          height: 330px;
          border: 1px solid rgba(45, 127, 122, 0.2);
          border-radius: 999px;
        }
        .cover-inner {
          position: relative;
          z-index: 1;
          min-height: inherit;
          display: grid;
          grid-template-rows: 1fr auto;
          padding: 44px 46px 38px 58px;
        }
        .cover-header { display: grid; grid-template-columns: minmax(220px, 280px) minmax(0, 1fr); align-items: center; gap: 44px; }
        .cover-art { 
          width: 100%; 
          aspect-ratio: 3 / 4; 
          border-radius: 18px; 
          overflow: hidden; 
          background: #efe4d1; 
          border: 10px solid rgba(255, 255, 255, 0.82);
          box-shadow: 0 26px 55px rgba(70, 51, 35, 0.24);
          flex-shrink: 0;
          transform: rotate(-1.4deg);
        }
        .cover-art img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .cover-emoji { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 4rem; }
        .cover-main { min-width: 0; }
        .eyebrow { 
          display: inline-flex;
          align-items: center;
          color: #7f2d1c; 
          background: rgba(255, 255, 255, 0.72);
          border: 1px solid rgba(239, 93, 74, 0.28);
          border-radius: 999px;
          font-family: Inter, sans-serif; 
          font-size: 0.72rem; 
          font-weight: 800; 
          letter-spacing: 0.14em; 
          text-transform: uppercase; 
          margin: 0 0 18px; 
          padding: 8px 12px;
        }
        .cover h1 { color: #17231d; font-size: 3.45rem; line-height: 1.02; letter-spacing: 0; margin: 0 0 18px; max-width: 560px; }
        .author { color: #4b5b53; font-family: Inter, sans-serif; font-size: 1.04rem; margin: 0; }
        .meta { margin-top: 18px; color: #7d8a82; font-family: Inter, sans-serif; font-size: 0.84rem; }
        .info-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-top: 36px; }
        .info-card { 
          min-height: 88px;
          background: rgba(255, 255, 255, 0.7); 
          border: 1px solid rgba(255, 255, 255, 0.72); 
          border-radius: 16px; 
          padding: 14px 14px 13px; 
          box-shadow: 0 10px 26px rgba(82, 68, 47, 0.08);
          backdrop-filter: blur(8px);
        }
        .info-label { color: #7a897f; font-family: Inter, sans-serif; font-size: 0.65rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 8px; }
        .info-value { color: #17231d; font-family: Inter, 'Noto Serif SC', sans-serif; font-size: 1.08rem; font-weight: 800; line-height: 1.3; }
        .style-panel { 
          margin-top: 14px; 
          border: 1px solid rgba(45, 127, 122, 0.18); 
          border-radius: 18px; 
          background: rgba(255, 255, 255, 0.58); 
          padding: 16px 18px; 
        }
        .style-panel h3 { margin: 0 0 8px; color: #245e5a; font-family: Inter, sans-serif; font-size: 0.88rem; letter-spacing: 0.04em; }
        .style-panel p { margin: 0; color: #4c5f58; font-family: Inter, 'Noto Serif SC', sans-serif; font-size: 0.82rem; line-height: 1.58; }
        .chapter { padding: 0 4px; margin: 0 0 34px; }
        .chapter + .chapter { break-before: page; page-break-before: always; }
        h2 { 
          color: #334155; 
          margin: 0 0 20px; 
          padding-bottom: 10px; 
          border-bottom: 1px solid #e5e7eb; 
          font-size: 1.55rem; 
          line-height: 1.25;
        }
        .paragraph { margin: 0 0 16px; font-size: 16px; text-align: justify; text-indent: 2em; }
        .illustration { margin: 22px auto 24px; text-align: center; break-inside: avoid; page-break-inside: avoid; }
        .illustration img { 
          max-width: 100%; 
          max-height: 460px;
          width: auto;
          height: auto;
          display: block; 
          margin: 0 auto;
          border-radius: 8px; 
          border: 1px solid #e5e7eb;
          object-fit: contain;
        }
        .illustration-caption { font-size: 12px; color: #64748b; margin-top: 8px; font-family: Inter, sans-serif; }
        .empty-state { color: #94a3b8; font-family: Inter, sans-serif; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 20px; text-align: center; }
        
        @media print {
          @page { margin: 1.2cm 1.35cm; }
          body { padding: 0; margin: 0; width: 100%; background: #fff !important; }
          .cover { 
            min-height: 25.6cm;
            page-break-after: always;
            break-after: page;
            border-radius: 0;
            border: 0;
            margin: 0 0 18px; 
          }
          .cover::before { width: 0.22cm; }
          .cover-inner { padding: 1.35cm 0.8cm 0.8cm 1.05cm; }
          .cover-header { grid-template-columns: 6.35cm minmax(0, 1fr); gap: 0.9cm; }
          .cover-art { border-width: 0.18cm; border-radius: 10px; box-shadow: 0 0.35cm 0.9cm rgba(70, 51, 35, 0.22); }
          .eyebrow { font-size: 8px; padding: 5px 8px; margin-bottom: 0.42cm; }
          .cover h1 { font-size: 31px; line-height: 1.05; margin-bottom: 0.32cm; }
          .author { font-size: 11px; }
          .meta { font-size: 9.5px; margin-top: 0.32cm; }
          .info-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.22cm; margin-top: 0.85cm; }
          .info-card { min-height: 1.72cm; padding: 0.25cm 0.22cm; border-radius: 9px; box-shadow: none; }
          .info-label { font-size: 7.5px; margin-bottom: 0.12cm; }
          .info-value { font-size: 10.6px; }
          .style-panel { margin-top: 0.32cm; padding: 0.28cm 0.34cm; border-radius: 10px; }
          .style-panel h3 { font-size: 10px; }
          .style-panel p { font-size: 10px; line-height: 1.45; }
          .chapter { margin-bottom: 20px; }
          h2 { font-size: 1.35rem; margin-bottom: 14px; }
          .paragraph { font-size: 13.8px; line-height: 1.65; margin-bottom: 10px; }
          .illustration { margin: 14px auto 16px; }
          .illustration img { max-height: 9.2cm; }
          .illustration-caption { font-size: 10.5px; }
          img { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        @media (max-width: 720px) {
          .cover-inner { padding: 28px 26px 26px 36px; }
          .cover-header { grid-template-columns: 1fr; gap: 26px; }
          .cover-art { width: min(220px, 72vw); }
          .cover h1 { font-size: 2.5rem; }
          .info-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
      </style>
    </head>
    <body>
      <div class="cover">
        <div class="cover-inner">
          <div class="cover-header">
            <div class="cover-art">
              ${resolvedCoverUrl ? `<img src="${resolvedCoverUrl}" alt="${escapeHtml(book.title)}封面">` : `<div class="cover-emoji">${escapeHtml(book.coverEmoji || '📘')}</div>`}
            </div>
            <div class="cover-main">
              <p class="eyebrow">${escapeHtml(exportModeLabel)}</p>
              <h1>${escapeHtml(book.title)}</h1>
              <p class="author">作者：${escapeHtml(book.author || '未知作者')} · 类型：${escapeHtml(book.genre || '未分类')}</p>
              <div class="meta">由 智绘阅读 AI 辅助生成 • ${escapeHtml(date)}</div>
            </div>
          </div>
          <div>
            <div class="info-grid">
              <div class="info-card"><div class="info-label">章节范围</div><div class="info-value">${chaptersToExport.length} / ${book.chapters.length} 章</div></div>
              <div class="info-card"><div class="info-label">正文段落</div><div class="info-value">${exportedParagraphCount} / ${totalParagraphCount} 段</div></div>
              <div class="info-card"><div class="info-label">配图数量</div><div class="info-value">${completedIllustrations.length} 张</div></div>
              <div class="info-card"><div class="info-label">配图章节</div><div class="info-value">${illustratedChapterCount} 章</div></div>
              <div class="info-card"><div class="info-label">生成状态</div><div class="info-value">待处理 ${pendingIllustrations.length} · 失败 ${failedIllustrations.length}</div></div>
              <div class="info-card"><div class="info-label">导出模式</div><div class="info-value">${escapeHtml(exportModeLabel)}</div></div>
              <div class="info-card"><div class="info-label">绘图风格</div><div class="info-value">${escapeHtml(visualSpec?.label || '当前书籍默认风格')}</div></div>
              <div class="info-card"><div class="info-label">图片来源</div><div class="info-value">AI 图文阅读插图</div></div>
            </div>
            <div class="style-panel">
              <h3>绘图风格说明</h3>
              <p>${escapeHtml(visualSpec?.promptStyle || '使用当前书籍绑定的视觉风格生成插图。')}</p>
            </div>
          </div>
        </div>
      </div>
  `;

  if (chaptersToExport.length === 0) {
    htmlContent += `<div class="empty-state">当前没有可导出的配图章节。</div>`;
  }

  chaptersToExport.forEach(chapter => {
    htmlContent += `<section class="chapter"><h2>${escapeHtml(chapter.title)}</h2>`;
    chapter.paragraphs.forEach(paragraph => {
      htmlContent += `<div class="paragraph">${escapeHtml(paragraph.text)}</div>`;
      
      const illustration = resolvedIllustrations[paragraph.id];
      if (illustration && illustration.status === 'completed' && illustration.imageUrl) {
        htmlContent += `
          <div class="illustration">
            <img src="${illustration.imageUrl}" alt="Illustration">
            ${illustration.extractedFacts ? `<div class="illustration-caption">场景：${escapeHtml(illustration.extractedFacts.location)} | 氛围：${escapeHtml(illustration.extractedFacts.mood)}</div>` : ''}
          </div>
        `;
      }
    });
    htmlContent += `</section>`;
  });

  htmlContent += `
      ${printReadyScript}
    </body>
    </html>
  `;
  return htmlContent;
};

const printViaIframe = (htmlContent: string) => {
  const existing = document.getElementById('pdf-export-iframe');
  if (existing) existing.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'pdf-export-iframe';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '1px';
  iframe.style.height = '1px';
  iframe.style.border = '0';
  iframe.style.opacity = '0.01';
  document.body.appendChild(iframe);

  const onMessage = (event: MessageEvent) => {
    if (event.data === 'print-ready') {
      window.removeEventListener('message', onMessage);
      
      // Delay to allow layout to settle
      setTimeout(() => {
        if (iframe.contentWindow) {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        }
        
        // Clean up the iframe after the print dialog is handled
        setTimeout(() => {
          if (iframe.parentNode) {
            document.body.removeChild(iframe);
          }
        }, 5000);
      }, 500);
    }
  };

  window.addEventListener('message', onMessage);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    window.removeEventListener('message', onMessage);
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(htmlContent);
  doc.close();
};

export const exportBookToHtml = (book: Book, illustrations: Record<string, Illustration>, mode: 'full' | 'generated_chapters', options?: BookExportOptions) => {
  void (async () => {
    const htmlContent = await buildBookExportHtml(book, illustrations, mode, fetch, options);
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${book.title}_${mode === 'full' ? '完整' : '精选'}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  })().catch(error => {
    console.error('导出 HTML 失败:', error);
    alert('导出 HTML 失败，请稍后重试。');
  });
};

export const exportBookToPdf = (book: Book, illustrations: Record<string, Illustration>, mode: 'full' | 'generated_chapters', options?: BookExportOptions) => {
  void (async () => {
    const htmlContent = await buildBookExportHtml(book, illustrations, mode, fetch, options);
    printViaIframe(htmlContent);
  })().catch(error => {
    console.error('导出 PDF 失败:', error);
    alert('导出 PDF 失败，请稍后重试。');
  });
};

export const buildAssetExportHtml = async (
  bookTitle: string,
  characters: Character[],
  locations: Location[],
  fetchImpl: typeof fetch = fetch,
) => {
  const exportCharacters = prepareEntitiesForExport(characters);
  const exportLocations = prepareEntitiesForExport(locations);
  const [resolvedCharacters, resolvedLocations] = await Promise.all([
    resolveEntitiesForExport(exportCharacters, fetchImpl),
    resolveEntitiesForExport(exportLocations, fetchImpl),
  ]);
  const date = new Date().toLocaleDateString();
  const renderEntityCard = (item: Character | Location, label: string) => {
    const body = item.visualSummary || item.description || '暂无文字设定';
    const secondary = item.visualSummary && item.description && item.visualSummary !== item.description
      ? `<p class="desc">${escapeHtml(item.description)}</p>`
      : '';

    return `
      <article class="entity-card">
        <div class="thumb">
          ${item.imageUrl ? `<img src="${item.imageUrl}" alt="${escapeHtml(item.name)}" />` : '<div class="placeholder">暂无图片</div>'}
        </div>
        <div class="card-content">
          <span class="badge">${label}</span>
          <h3>${escapeHtml(item.name)}</h3>
          <p>${escapeHtml(body)}</p>
          ${secondary}
        </div>
      </article>
    `;
  };

  return `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <title>${escapeHtml(bookTitle)} - 世界观</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700&family=Inter:wght@400;600&display=swap');
        * { box-sizing: border-box; }
        body { font-family: Inter, 'Noto Serif SC', sans-serif; background: #fff; color: #1f2937; margin: 0 auto; padding: 28px; max-width: 980px; }
        .cover { border: 1px solid #e5e7eb; border-radius: 18px; background: #f8fafc; padding: 28px 30px; margin-bottom: 26px; }
        .cover h1 { font-family: 'Noto Serif SC', serif; font-size: 2.45rem; line-height: 1.18; margin: 0 0 10px; color: #111827; }
        .cover p { color: #64748b; margin: 0; }
        .stats { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 18px; }
        .stat { border: 1px solid #e2e8f0; border-radius: 999px; background: #fff; padding: 7px 12px; color: #475569; font-size: 12px; }
        .section { margin-top: 24px; }
        .section-title { font-family: 'Noto Serif SC', serif; font-size: 1.65rem; margin: 0 0 14px; border-bottom: 2px solid #111827; padding-bottom: 10px; color: #111827; }
        .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
        .entity-card { display: grid; grid-template-columns: 132px minmax(0, 1fr); gap: 14px; background: #fff; border-radius: 12px; break-inside: avoid; page-break-inside: avoid; border: 1px solid #e5e7eb; padding: 12px; }
        .thumb { width: 132px; height: 132px; border-radius: 10px; overflow: hidden; background: #f1f5f9; border: 1px solid #e2e8f0; }
        .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 12px; }
        .card-content { min-width: 0; }
        .entity-card h3 { margin: 6px 0 8px; font-size: 1.18rem; line-height: 1.25; font-family: 'Noto Serif SC', serif; color: #111827; }
        .entity-card p { color: #475569; line-height: 1.58; margin: 0; font-size: 13px; }
        .entity-card .desc { color: #64748b; margin-top: 8px; font-size: 12px; }
        .badge { display: inline-block; background: #eef2ff; padding: 4px 9px; border-radius: 6px; font-size: 10px; font-weight: bold; color: #4338ca; letter-spacing: 0.04em; }
        .empty-state { border: 1px dashed #cbd5e1; border-radius: 12px; color: #94a3b8; padding: 18px; text-align: center; }
        @media print { 
          @page { margin: 1.2cm; }
          body { padding: 0; max-width: none; }
          .cover { border-radius: 0; padding: 18px 0; margin-bottom: 18px; border-left: 0; border-right: 0; }
          .cover h1 { font-size: 1.9rem; }
          .section { margin-top: 16px; }
          .section-title { font-size: 1.35rem; margin-bottom: 10px; }
          .grid { gap: 9px; }
          .entity-card { grid-template-columns: 2.6cm minmax(0, 1fr); gap: 9px; padding: 8px; border-radius: 8px; }
          .thumb { width: 2.6cm; height: 2.6cm; border-radius: 6px; }
          .entity-card h3 { font-size: 1rem; margin: 4px 0 5px; }
          .entity-card p { font-size: 10.5px; line-height: 1.45; }
          .entity-card .desc { font-size: 10px; margin-top: 5px; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          img { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        @media (max-width: 760px) {
          body { padding: 18px; }
          .grid { grid-template-columns: 1fr; }
          .entity-card { grid-template-columns: 108px minmax(0, 1fr); }
          .thumb { width: 108px; height: 108px; }
        }
      </style>
    </head>
    <body>
      <div class="cover">
        <h1>${escapeHtml(bookTitle)} 视觉设定集</h1>
        <p>由 智绘阅读 AI 辅助整理 • ${escapeHtml(date)}</p>
        <div class="stats">
          <span class="stat">角色 ${resolvedCharacters.length} 个</span>
          <span class="stat">场景 ${resolvedLocations.length} 个</span>
          <span class="stat">已内嵌本地图片，离线可读</span>
        </div>
      </div>
      <section class="section">
        <h2 class="section-title">核心角色</h2>
        ${resolvedCharacters.length > 0 ? `<div class="grid">${resolvedCharacters.map(c => renderEntityCard(c, 'CHARACTER')).join('')}</div>` : '<div class="empty-state">暂无可导出的角色设定。</div>'}
      </section>
      <section class="section">
        <h2 class="section-title">核心场景</h2>
        ${resolvedLocations.length > 0 ? `<div class="grid">${resolvedLocations.map(l => renderEntityCard(l, 'LOCATION')).join('')}</div>` : '<div class="empty-state">暂无可导出的场景设定。</div>'}
      </section>
      ${printReadyScript}
    </body>
    </html>
  `;
};

export const exportAssetsToHtml = (bookTitle: string, characters: Character[], locations: Location[]) => {
  void (async () => {
    const htmlContent = await buildAssetExportHtml(bookTitle, characters, locations);
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${bookTitle}_世界观.html`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  })().catch(error => {
    console.error('导出世界观 HTML 失败:', error);
    alert('导出世界观 HTML 失败，请稍后重试。');
  });
};

export const exportAssetsToPdf = (bookTitle: string, characters: Character[], locations: Location[]) => {
  void (async () => {
    const htmlContent = await buildAssetExportHtml(bookTitle, characters, locations);
    printViaIframe(htmlContent);
  })().catch(error => {
    console.error('导出世界观 PDF 失败:', error);
    alert('导出世界观 PDF 失败，请稍后重试。');
  });
};
