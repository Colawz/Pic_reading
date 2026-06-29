import { describe, expect, it, vi } from 'vitest';
import type { Book, Character, Illustration, Location } from '../types';
import { buildAssetExportHtml, buildBookExportHtml } from './exportService';

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

  it('deduplicates exported entities and keeps the richer image-backed record', async () => {
    const duplicateCharacters: Character[] = [
      {
        ...characters[0],
        id: 'char-duplicate-empty',
        name: '小明',
        visualSummary: '短描述',
        imageUrl: undefined,
        locked: false,
      },
      characters[0],
    ];

    const html = await buildAssetExportHtml('测试书籍', duplicateCharacters, [], vi.fn() as unknown as typeof fetch);

    expect(html.match(/<article class="entity-card">/g)).toHaveLength(1);
    expect(html).toContain('红衣短发男孩');
    expect(html).not.toContain('短描述');
  });
});

describe('buildBookExportHtml', () => {
  it('uses compact export layout with bounded illustrations and no cover spacer', async () => {
    const book: Book = {
      id: 'book-1',
      title: '测试书籍',
      author: '作者',
      genre: '童话',
      coverEmoji: '📘',
      coverUrl: '/pic_db/book/covers/cover.png',
      visualSpecId: 'default',
      chapters: [
        {
          id: 'chapter-1',
          title: '第一章',
          paragraphs: [
            { id: 'paragraph-1', chapterId: 'chapter-1', text: '第一段文字。' },
          ],
        },
      ],
    };
    const illustrations: Record<string, Illustration> = {
      'paragraph-1': {
        id: 'ill-1',
        paragraphId: 'paragraph-1',
        status: 'completed',
        imageUrl: 'data:image/png;base64,abc',
      },
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(new Blob(['cover'], { type: 'image/png' }), { status: 200 }),
      );

    const html = await buildBookExportHtml(book, illustrations, 'full', fetchMock as typeof fetch, {
      visualSpec: {
        id: 'default',
        label: '国风水彩',
        promptStyle: '温柔国风水彩，细腻笔触，干净明亮',
        cameraLanguage: '中景',
        negatives: '低清晰度',
      },
    });

    expect(fetchMock).toHaveBeenCalledWith('/pic_db/book/covers/cover.png');
    expect(html).toContain('data:image/png;base64,Y292ZXI=');
    expect(html).toContain('国风水彩');
    expect(html).toContain('温柔国风水彩，细腻笔触，干净明亮');
    expect(html).toContain('1 / 1 章');
    expect(html).toContain('1 / 1 段');
    expect(html).toContain('1 张');
    expect(html).toContain('page-break-after: always');
    expect(html).toContain('max-height: 460px');
    expect(html).toContain('max-height: 9.2cm');
    expect(html).not.toContain('height: 30vh');
    expect(html).not.toContain('margin-bottom: 100px');
  });
});
