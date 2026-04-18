import { describe, expect, it, vi } from 'vitest';
import type { Character, Location } from '../types';
import { buildAssetExportHtml } from './exportService';

const characters: Character[] = [
  {
    id: 'char-1',
    bookId: 'book-1',
    name: '小明',
    description: '主角',
    visualSummary: '红衣短发男孩',
    imageUrl: '/pic_db/book/assets/characters/xiaoming.png',
    locked: true,
    generationStatus: 'success',
  },
];

const locations: Location[] = [
  {
    id: 'loc-1',
    bookId: 'book-1',
    name: '森林',
    description: '被晨雾包围的森林空地',
    visualSummary: '被晨雾包围的森林空地',
    imageUrl: '/pic_db/book/assets/locations/forest.png',
    locked: true,
    generationStatus: 'success',
  },
];

describe('buildAssetExportHtml', () => {
  it('inlines local pic_db images so exported worldview html can render outside the app', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(new Blob(['character'], { type: 'image/png' }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(new Blob(['location'], { type: 'image/jpeg' }), { status: 200 }),
      );

    const html = await buildAssetExportHtml('测试书籍', characters, locations, fetchMock as typeof fetch);

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/pic_db/book/assets/characters/xiaoming.png');
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/pic_db/book/assets/locations/forest.png');
    expect(html).toContain('data:image/png;base64,Y2hhcmFjdGVy');
    expect(html).toContain('data:image/jpeg;base64,bG9jYXRpb24=');
    expect(html).not.toContain('/pic_db/book/assets/characters/xiaoming.png');
    expect(html).not.toContain('/pic_db/book/assets/locations/forest.png');
  });
});
