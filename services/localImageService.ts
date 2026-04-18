interface SaveGeneratedImageParams {
  remoteUrl: string;
  bookId: string;
  category: 'assets' | 'illustrations' | 'covers';
  subcategory: string;
  fileStem: string;
}

interface SaveGeneratedImageResult {
  localUrl: string;
}

interface DeleteGeneratedImageParams {
  localUrl: string;
}

interface CheckGeneratedImageParams {
  localUrl: string;
}

interface RelocateGeneratedImageParams {
  localUrl: string;
  targetBookFolder: string;
}

interface FindGeneratedImageParams {
  bookFolder: string;
  category: 'assets' | 'illustrations' | 'covers';
  subcategory: string;
  fileStem: string;
}

interface NormalizeGeneratedImageParams {
  localUrl: string;
  targetBookFolder: string;
  category: 'assets' | 'illustrations' | 'covers';
  subcategory: string;
  fileStem: string;
}

export interface BootstrapLocalLibraryResult {
  txtBooks: Array<{
    title: string;
    content: string;
  }>;
  books: Array<{
    bookFolder: string;
    coverUrl: string | null;
    characters: Array<{ name: string; localUrl: string }>;
    locations: Array<{ name: string; localUrl: string }>;
    illustrations: Array<{ fileStem: string; localUrl: string }>;
  }>;
}

interface SaveAppSnapshotParams {
  snapshot: unknown;
}

export const stripLocalImageVersion = (localUrl: string): string => localUrl.split('#')[0].split('?')[0];

export const appendLocalImageVersion = (localUrl: string, version = Date.now()): string => {
  if (!localUrl.startsWith('/pic_db/')) {
    return localUrl;
  }

  const cleanUrl = stripLocalImageVersion(localUrl);
  return `${cleanUrl}?v=${version}`;
};

export const saveGeneratedImageLocally = async ({
  remoteUrl,
  bookId,
  category,
  subcategory,
  fileStem,
}: SaveGeneratedImageParams): Promise<SaveGeneratedImageResult> => {
  const response = await fetch('/api/save-generated-image', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      remoteUrl,
      bookId,
      category,
      subcategory,
      fileStem,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || '保存图片到本地失败');
  }

  const result = await response.json() as SaveGeneratedImageResult;
  return {
    localUrl: appendLocalImageVersion(result.localUrl),
  };
};

export const deleteGeneratedImageLocally = async ({
  localUrl,
}: DeleteGeneratedImageParams): Promise<void> => {
  const canonicalLocalUrl = stripLocalImageVersion(localUrl);

  if (!canonicalLocalUrl.startsWith('/pic_db/')) {
    return;
  }

  const response = await fetch('/api/delete-generated-image', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ localUrl: canonicalLocalUrl }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || '删除本地图片失败');
  }
};

export const checkGeneratedImageLocally = async ({
  localUrl,
}: CheckGeneratedImageParams): Promise<boolean> => {
  const canonicalLocalUrl = stripLocalImageVersion(localUrl);

  if (!canonicalLocalUrl.startsWith('/pic_db/')) {
    return false;
  }

  const response = await fetch('/api/check-generated-image', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ localUrl: canonicalLocalUrl }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || '检查本地图片失败');
  }

  const data = await response.json() as { exists: boolean };
  return data.exists;
};

export const relocateGeneratedImageLocally = async ({
  localUrl,
  targetBookFolder,
}: RelocateGeneratedImageParams): Promise<{ localUrl: string }> => {
  const canonicalLocalUrl = stripLocalImageVersion(localUrl);

  if (!canonicalLocalUrl.startsWith('/pic_db/')) {
    return { localUrl };
  }

  const response = await fetch('/api/relocate-generated-image', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ localUrl: canonicalLocalUrl, targetBookFolder }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || '迁移本地图片失败');
  }

  const result = await response.json() as { localUrl: string };
  return { localUrl: appendLocalImageVersion(result.localUrl) };
};

export const findGeneratedImageLocally = async ({
  bookFolder,
  category,
  subcategory,
  fileStem,
}: FindGeneratedImageParams): Promise<string | null> => {
  const response = await fetch('/api/find-generated-image', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ bookFolder, category, subcategory, fileStem }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || '查找本地图片失败');
  }

  const data = await response.json() as { localUrl: string | null };
  return data.localUrl ? appendLocalImageVersion(data.localUrl) : null;
};

export const normalizeGeneratedImageLocally = async ({
  localUrl,
  targetBookFolder,
  category,
  subcategory,
  fileStem,
}: NormalizeGeneratedImageParams): Promise<{ localUrl: string }> => {
  const canonicalLocalUrl = stripLocalImageVersion(localUrl);

  if (!canonicalLocalUrl.startsWith('/pic_db/')) {
    return { localUrl };
  }

  const response = await fetch('/api/normalize-generated-image', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ localUrl: canonicalLocalUrl, targetBookFolder, category, subcategory, fileStem }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || '规范化本地图片命名失败');
  }

  const result = await response.json() as { localUrl: string };
  return { localUrl: appendLocalImageVersion(result.localUrl) };
};

export const isLocalPicDbUrl = (url?: string) => Boolean(url && stripLocalImageVersion(url).startsWith('/pic_db/'));

export const bootstrapLocalLibrary = async (): Promise<BootstrapLocalLibraryResult | null> => {
  const response = await fetch('/api/bootstrap-local-library').catch(() => null);
  if (!response || !response.ok) {
    return null;
  }

  return response.json() as Promise<BootstrapLocalLibraryResult>;
};

export const saveAppSnapshotLocally = async ({ snapshot }: SaveAppSnapshotParams): Promise<void> => {
  const response = await fetch('/api/save-app-snapshot', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ snapshot }),
  }).catch(() => null);

  if (!response || !response.ok) {
    return;
  }
};

export const loadAppSnapshotLocally = async <T = unknown>(): Promise<T | null> => {
  const response = await fetch('/api/load-app-snapshot').catch(() => null);
  if (!response || !response.ok) {
    return null;
  }

  const data = await response.json() as { snapshot?: T | null };
  return data.snapshot ?? null;
};
