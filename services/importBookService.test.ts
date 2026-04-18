import { describe, expect, it } from 'vitest';
import { VISUAL_PRESETS } from '../constants';
import { createImportedBook, resolveImportVisualSpec } from './importBookService';

describe('resolveImportVisualSpec', () => {
  it('returns the selected visual spec for imported books and cover generation', () => {
    const selected = VISUAL_PRESETS[2];
    const fallback = VISUAL_PRESETS[0];

    const result = resolveImportVisualSpec(selected.id, VISUAL_PRESETS, fallback);

    expect(result.id).toBe(selected.id);
  });

  it('falls back to the provided default spec when the selected style is missing', () => {
    const fallback = VISUAL_PRESETS[1];

    const result = resolveImportVisualSpec('missing-style', VISUAL_PRESETS, fallback);

    expect(result.id).toBe(fallback.id);
  });
});

describe('createImportedBook', () => {
  it('creates an imported book using the selected visual style and optional cover', () => {
    const selected = VISUAL_PRESETS[3];

    const book = createImportedBook({
      id: 'imported-1',
      title: '测试导入',
      content: '第一段\n第二段',
      styleId: selected.id,
      coverUrl: '/pic_db/test/covers/book-cover.png',
      availableSpecs: VISUAL_PRESETS,
      fallbackSpec: VISUAL_PRESETS[0],
    });

    expect(book.visualSpecId).toBe(selected.id);
    expect(book.coverUrl).toBe('/pic_db/test/covers/book-cover.png');
    expect(book.chapters[0].paragraphs).toHaveLength(2);
  });
});
