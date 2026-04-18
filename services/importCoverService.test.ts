import { describe, expect, it, vi } from 'vitest';
import { createGeneratedImportCoverResult } from './importCoverService';

describe('createGeneratedImportCoverResult', () => {
  it('returns the remote preview immediately and persists the local cover in the background', async () => {
    const persistRemoteImage = vi.fn().mockResolvedValue({
      localUrl: '/pic_db/test-book/covers/books/封面.png',
    });

    const result = createGeneratedImportCoverResult({
      remoteUrl: 'https://example.com/generated-cover.png',
      title: '测试书籍',
      persistRemoteImage,
    });

    expect(result.previewUrl).toBe('https://example.com/generated-cover.png');
    expect(persistRemoteImage).toHaveBeenCalledWith({
      remoteUrl: 'https://example.com/generated-cover.png',
      bookId: '测试书籍',
      category: 'covers',
      subcategory: 'books',
      fileStem: '封面',
    });
    await expect(result.persistedUrlPromise).resolves.toBe('/pic_db/test-book/covers/books/封面.png');
  });

  it('uses an untitled fallback when the import title is blank', async () => {
    const persistRemoteImage = vi.fn().mockResolvedValue({
      localUrl: '/pic_db/untitled-book/covers/books/封面.png',
    });

    const result = createGeneratedImportCoverResult({
      remoteUrl: 'https://example.com/generated-cover.png',
      title: '   ',
      persistRemoteImage,
    });

    await expect(result.persistedUrlPromise).resolves.toBe('/pic_db/untitled-book/covers/books/封面.png');
    expect(persistRemoteImage).toHaveBeenCalledWith({
      remoteUrl: 'https://example.com/generated-cover.png',
      bookId: 'untitled-book',
      category: 'covers',
      subcategory: 'books',
      fileStem: '封面',
    });
  });
});
