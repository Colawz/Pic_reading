interface PersistGeneratedCoverParams {
  remoteUrl: string;
  bookId: string;
  category: 'covers';
  subcategory: string;
  fileStem: string;
}

interface GeneratedImportCoverResult {
  previewUrl: string;
  persistedUrlPromise: Promise<string>;
}

interface CreateGeneratedImportCoverParams {
  remoteUrl: string;
  title: string;
  persistRemoteImage: (params: PersistGeneratedCoverParams) => Promise<{ localUrl: string }>;
}

export const createGeneratedImportCoverResult = ({
  remoteUrl,
  title,
  persistRemoteImage,
}: CreateGeneratedImportCoverParams): GeneratedImportCoverResult => {
  const bookId = title.trim() || 'untitled-book';

  return {
    previewUrl: remoteUrl,
    persistedUrlPromise: persistRemoteImage({
      remoteUrl,
      bookId,
      category: 'covers',
      subcategory: 'books',
      fileStem: '封面',
    }).then(result => result.localUrl),
  };
};
