import { describe, expect, it } from 'vitest';
import { VISUAL_PRESETS } from '../constants';
import { buildAssetVisualPrompt } from './assetVisualPrompt';

describe('buildAssetVisualPrompt', () => {
  it('adds per-image custom requirements for character regenerations', () => {
    const prompt = buildAssetVisualPrompt(
      '红衣短发男孩，正面站姿',
      'character',
      VISUAL_PRESETS[0],
      '低机位，突出表情',
    );

    expect(prompt).toContain('专业角色设定图: 红衣短发男孩，正面站姿。');
    expect(prompt).toContain('风格:');
    expect(prompt).toContain('额外要求: 低机位，突出表情');
  });

  it('omits the extra requirement section when nothing is provided', () => {
    const prompt = buildAssetVisualPrompt(
      '被晨雾包围的森林空地',
      'location',
      VISUAL_PRESETS[1],
    );

    expect(prompt).toContain('环境概念设计图: 被晨雾包围的森林空地。');
    expect(prompt).not.toContain('额外要求:');
  });
});
