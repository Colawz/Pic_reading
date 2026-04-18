
import { Book, Illustration, Character, Location } from '../types';
import { localImageUrlToDataUrl } from './referenceImageService';

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
) => {
  const resolvedIllustrations = await resolveIllustrationsForExport(illustrations, fetchImpl);
  const date = new Date().toLocaleDateString();
  let htmlContent = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <title>${book.title}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700&display=swap');
        body { 
          font-family: 'Noto Serif SC', 'Georgia', serif; 
          line-height: 1.8; 
          color: #333; 
          max-width: 800px; 
          margin: 0 auto; 
          padding: 40px; 
          background: #fff; 
        }
        .page-container { background: #fff; padding: 40px; margin-bottom: 20px; }
        h1 { text-align: center; color: #2c3e50; border-bottom: 3px solid #2c3e50; padding-bottom: 20px; font-size: 3.5rem; margin-top: 0; }
        h2 { color: #8e44ad; margin-top: 60px; border-bottom: 1px solid #eee; padding-bottom: 15px; font-size: 2rem; page-break-before: always; }
        .author { text-align: center; font-style: italic; color: #7f8c8d; margin-bottom: 100px; font-size: 1.25rem; }
        .paragraph { margin-bottom: 28px; font-size: 18px; text-align: justify; text-indent: 2em; }
        .illustration { margin: 40px 0; text-align: center; break-inside: avoid; }
        .illustration img { 
          max-width: 100%; 
          display: block; 
          margin: 0 auto;
          border-radius: 8px; 
          border: 1px solid #ddd;
        }
        .illustration-caption { font-size: 14px; color: #666; margin-top: 15px; font-style: italic; font-family: sans-serif; }
        .footer { text-align: center; margin-top: 100px; color: #999; font-size: 0.8rem; }
        
        @media print {
          @page { margin: 1cm; }
          body { padding: 0; margin: 0; width: 100%; background: #fff !important; }
          .page-container { padding: 20px; margin: 0; box-shadow: none; border: none; }
          .illustration { page-break-inside: avoid; }
          img { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
    </head>
    <body>
      <div class="page-container">
        <h1>${book.title}</h1>
        <div class="author">By ${book.author}</div>
        <div style="height: 30vh"></div>
        <div class="footer">由 智绘阅读 AI 辅助生成 • ${date}</div>
      </div>
  `;

  book.chapters.forEach(chapter => {
    if (mode === 'generated_chapters') {
      const hasIllustrations = chapter.paragraphs.some(p => {
        const ill = illustrations[p.id];
        return ill && ill.status === 'completed';
      });
      if (!hasIllustrations) return;
    }

    htmlContent += `<div class="page-container"><h2>${chapter.title}</h2>`;

    chapter.paragraphs.forEach(paragraph => {
      htmlContent += `<div class="paragraph">${paragraph.text}</div>`;
      
      const illustration = resolvedIllustrations[paragraph.id];
      if (illustration && illustration.status === 'completed' && illustration.imageUrl) {
        htmlContent += `
          <div class="illustration">
            <img src="${illustration.imageUrl}" alt="Illustration">
            ${illustration.extractedFacts ? `<div class="illustration-caption">场景：${illustration.extractedFacts.location} | 氛围：${illustration.extractedFacts.mood}</div>` : ''}
          </div>
        `;
      }
    });
    htmlContent += `</div>`;
  });

  htmlContent += `
      <script>
        window.onload = function() {
          const images = document.getElementsByTagName('img');
          const total = images.length;
          let loaded = 0;
          
          if (total === 0) {
            window.parent.postMessage('print-ready', '*');
            return;
          }

          function check() {
            loaded++;
            if (loaded >= total) {
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

export const exportBookToHtml = (book: Book, illustrations: Record<string, Illustration>, mode: 'full' | 'generated_chapters') => {
  void (async () => {
    const htmlContent = await buildBookExportHtml(book, illustrations, mode);
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

export const exportBookToPdf = (book: Book, illustrations: Record<string, Illustration>, mode: 'full' | 'generated_chapters') => {
  void (async () => {
    const htmlContent = await buildBookExportHtml(book, illustrations, mode);
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
  const [resolvedCharacters, resolvedLocations] = await Promise.all([
    resolveEntitiesForExport(characters, fetchImpl),
    resolveEntitiesForExport(locations, fetchImpl),
  ]);
  const date = new Date().toLocaleDateString();
  return `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <title>${bookTitle} - 世界观</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700&family=Inter:wght@400;600&display=swap');
        body { font-family: 'Inter', sans-serif; background: #fff; color: #333; margin: 0; padding: 0; }
        .cover { height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; background: #1a1a1a; color: white; text-align: center; page-break-after: always; }
        .cover h1 { font-family: 'Noto Serif SC', serif; font-size: 4rem; margin-bottom: 10px; }
        .section-title { font-family: 'Noto Serif SC', serif; font-size: 2.5rem; margin: 60px 40px 30px; border-bottom: 4px solid #1a1a1a; padding-bottom: 15px; page-break-before: always; }
        .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 40px; padding: 40px; }
        .card { background: #fff; border-radius: 20px; overflow: hidden; break-inside: avoid; border: 1px solid #eee; }
        .card img { width: 100%; aspect-ratio: 1/1; object-fit: cover; background: #eee; display: block; }
        .card-content { padding: 25px; }
        .card h3 { margin: 0 0 10px 0; font-size: 1.6rem; font-family: 'Noto Serif SC', serif; }
        .card p { color: #666; line-height: 1.6; margin: 0; }
        .badge { display: inline-block; background: #f0f0f0; padding: 5px 12px; border-radius: 6px; font-size: 0.75rem; font-weight: bold; margin-bottom: 15px; color: #555; }
        @media print { 
          .card { border: 1px solid #ddd; } 
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          img { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
    </head>
    <body>
      <div class="cover">
        <h1>${bookTitle}</h1>
        <p>视觉世界观 • AI 辅助生成</p>
        <p style="margin-top: 50px; color: #666;">${date}</p>
      </div>
      <h2 class="section-title">核心角色</h2>
      <div class="grid">${resolvedCharacters.map(c => `
        <div class="card">
          ${c.imageUrl ? `<img src="${c.imageUrl}" />` : '<div style="aspect-ratio:1/1; background:#eee;"></div>'}
          <div class="card-content">
            <span class="badge">CHARACTER</span>
            <h3>${c.name}</h3>
            <p>${c.visualSummary || c.description}</p>
          </div>
        </div>`).join('')}</div>
      <h2 class="section-title">核心场景</h2>
      <div class="grid">${resolvedLocations.map(l => `
        <div class="card">
          ${l.imageUrl ? `<img src="${l.imageUrl}" />` : '<div style="aspect-ratio:1/1; background:#eee;"></div>'}
          <div class="card-content">
            <span class="badge">LOCATION</span>
            <h3>${l.name}</h3>
            <p>${l.description}</p>
          </div>
        </div>`).join('')}</div>
      <script>
        window.onload = function() {
          const images = document.getElementsByTagName('img');
          const total = images.length;
          let loaded = 0;
          if (total === 0) { window.parent.postMessage('print-ready', '*'); return; }
          function check() { loaded++; if (loaded >= total) { window.parent.postMessage('print-ready', '*'); } }
          for (let i = 0; i < total; i++) {
            if (images[i].complete) check();
            else { images[i].onload = check; images[i].onerror = check; }
          }
        };
      </script>
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
