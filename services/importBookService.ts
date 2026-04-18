import { createBook } from '../constants';
import type { Book, VisualSpec } from '../types';

export const resolveImportVisualSpec = (
  styleId: string,
  availableSpecs: VisualSpec[],
  fallbackSpec: VisualSpec,
): VisualSpec =>
  availableSpecs.find(spec => spec.id === styleId) ||
  fallbackSpec ||
  availableSpecs[0];

interface CreateImportedBookParams {
  id: string;
  title: string;
  content: string;
  styleId: string;
  coverUrl?: string;
  availableSpecs: VisualSpec[];
  fallbackSpec: VisualSpec;
}

export const createImportedBook = ({
  id,
  title,
  content,
  styleId,
  coverUrl,
  availableSpecs,
  fallbackSpec,
}: CreateImportedBookParams): Book => {
  const spec = resolveImportVisualSpec(styleId, availableSpecs, fallbackSpec);
  return createBook(id, title, '未知作者', '自定义', '📚', spec.id, content, coverUrl);
};
