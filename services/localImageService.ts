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

  return response.json() as Promise<SaveGeneratedImageResult>;
};

export const deleteGeneratedImageLocally = async ({
  localUrl,
}: DeleteGeneratedImageParams): Promise<void> => {
  if (!localUrl.startsWith('/pic_db/')) {
    return;
  }

  const response = await fetch('/api/delete-generated-image', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ localUrl }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || '删除本地图片失败');
  }
};

export const checkGeneratedImageLocally = async ({
  localUrl,
}: CheckGeneratedImageParams): Promise<boolean> => {
  if (!localUrl.startsWith('/pic_db/')) {
    return false;
  }

  const response = await fetch('/api/check-generated-image', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ localUrl }),
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
  if (!localUrl.startsWith('/pic_db/')) {
    return { localUrl };
  }

  const response = await fetch('/api/relocate-generated-image', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ localUrl, targetBookFolder }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || '迁移本地图片失败');
  }

  return response.json() as Promise<{ localUrl: string }>;
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
  return data.localUrl;
};

export const isLocalPicDbUrl = (url?: string) => Boolean(url && url.startsWith('/pic_db/'));
