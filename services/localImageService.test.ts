import { describe, expect, it } from 'vitest';
import { appendLocalImageVersion, stripLocalImageVersion } from './localImageService';

describe('local image cache busting', () => {
  it('appends a timestamp query to pic_db urls so overwritten files refresh immediately', () => {
    const versioned = appendLocalImageVersion('/pic_db/book/assets/locations/farm.jpg', 123456);

    expect(versioned).toBe('/pic_db/book/assets/locations/farm.jpg?v=123456');
  });

  it('replaces an existing timestamp query instead of stacking more params', () => {
    const versioned = appendLocalImageVersion('/pic_db/book/assets/locations/farm.jpg?v=1', 2);

    expect(versioned).toBe('/pic_db/book/assets/locations/farm.jpg?v=2');
  });

  it('strips the timestamp query before local file operations', () => {
    expect(stripLocalImageVersion('/pic_db/book/assets/locations/farm.jpg?v=123456')).toBe('/pic_db/book/assets/locations/farm.jpg');
  });
});
