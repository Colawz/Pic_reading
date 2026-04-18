import type { VisualSpec } from '../types';

export const buildAssetVisualPrompt = (
  description: string,
  type: 'character' | 'location',
  visualSpec: VisualSpec,
  customRequirement?: string,
) => {
  const basePrompt = type === 'character'
    ? `专业角色设定图: ${description}。
           要求: 三视图（包含正面、侧面、背面）。
           风格: ${visualSpec.promptStyle}。背景: 简单的纯色背景。`
    : `环境概念设计图: ${description}。风格: ${visualSpec.promptStyle}。`;

  if (!customRequirement?.trim()) {
    return basePrompt;
  }

  return `${basePrompt} 额外要求: ${customRequirement.trim()}。`;
};
