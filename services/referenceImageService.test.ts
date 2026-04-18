import { describe, expect, it, vi } from 'vitest';
import type { Character, Location, NarrativeFacts } from '../types';
import {
  localImageUrlToDataUrl,
  resolveIllustrationReferenceImages,
} from './referenceImageService';

const baseFacts: NarrativeFacts = {
  characters: ['小明'],
  location: '森林空地',
  action: '奔跑',
  mood: '紧张',
  objects: [],
};

const baseCharacter: Character = {
  id: 'char-1',
  bookId: 'book-1',
  name: '小明',
  description: '主角',
  visualSummary: '红衣短发男孩',
  locked: true,
  generationStatus: 'success',
};

const baseLocation: Location = {
  id: 'loc-1',
  bookId: 'book-1',
  name: '森林',
  description: '林间空地',
  visualSummary: '被晨雾包围的森林空地',
  locked: true,
  generationStatus: 'success',
};

describe('localImageUrlToDataUrl', () => {
  it('converts a local pic_db image into a data url for Volc image uploads', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(new Blob([Uint8Array.from([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' }), {
        status: 200,
      }),
    );

    const result = await localImageUrlToDataUrl('/pic_db/book/assets/characters/xiaoming.png', fetchMock as typeof fetch);

    expect(fetchMock).toHaveBeenCalledWith('/pic_db/book/assets/characters/xiaoming.png');
    expect(result).toBe('data:image/png;base64,iVBORw==');
  });
});

describe('resolveIllustrationReferenceImages', () => {
  it('uses only local asset files as illustration references and ignores expiring remote urls', async () => {
    const characters: Character[] = [
      {
        ...baseCharacter,
        imageUrl: '/pic_db/book/assets/characters/xiaoming.png',
        referenceImageUrl: 'https://expired.example.com/xiaoming.png',
      },
      {
        ...baseCharacter,
        id: 'char-2',
        name: '路人甲',
        imageUrl: 'https://cdn.example.com/side-character.png',
        referenceImageUrl: 'https://expired.example.com/side-character.png',
      },
    ];
    const locations: Location[] = [
      {
        ...baseLocation,
        imageUrl: '/pic_db/book/assets/locations/forest.png',
        referenceImageUrl: 'https://expired.example.com/forest.png',
      },
    ];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(new Blob(['character'], { type: 'image/png' }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(new Blob(['location'], { type: 'image/jpeg' }), { status: 200 }),
      );

    const result = await resolveIllustrationReferenceImages(baseFacts, characters, locations, fetchMock as typeof fetch);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/pic_db/book/assets/characters/xiaoming.png');
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/pic_db/book/assets/locations/forest.png');
    expect(result).toEqual([
      'data:image/png;base64,Y2hhcmFjdGVy',
      'data:image/jpeg;base64,bG9jYXRpb24=',
    ]);
  });

  it('returns no references when matched assets do not have local image files', async () => {
    const characters: Character[] = [
      {
        ...baseCharacter,
        imageUrl: 'https://cdn.example.com/xiaoming.png',
        referenceImageUrl: 'https://expired.example.com/xiaoming.png',
      },
    ];
    const locations: Location[] = [
      {
        ...baseLocation,
        imageUrl: 'https://cdn.example.com/forest.png',
        referenceImageUrl: 'https://expired.example.com/forest.png',
      },
    ];
    const fetchMock = vi.fn();

    const result = await resolveIllustrationReferenceImages(baseFacts, characters, locations, fetchMock as typeof fetch);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});
