import { describe, expect, it } from 'vitest';
import { getArkApiKey } from './runtimeConfig';

describe('getArkApiKey', () => {
  it('reads the ark key from VITE_ARK_API_KEY', () => {
    expect(getArkApiKey({ VITE_ARK_API_KEY: 'test-ark-key' })).toBe('test-ark-key');
  });

  it('throws a clear error when the ark key is missing', () => {
    expect(() => getArkApiKey({})).toThrowError('Missing ARK API key. Set VITE_ARK_API_KEY in .env.local.');
  });
});
