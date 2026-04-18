type EnvLike = Record<string, string | boolean | undefined>;

const readFirstNonEmpty = (env: EnvLike, keys: string[]) => {
  for (const key of keys) {
    const rawValue = env[key];
    if (typeof rawValue === 'string' && rawValue.trim()) {
      return rawValue.trim();
    }
  }

  return undefined;
};

export const getArkApiKey = (env: EnvLike = import.meta.env): string => {
  const value = readFirstNonEmpty(env, ['VITE_ARK_API_KEY', 'ARK_API_KEY']);
  if (!value) {
    throw new Error('Missing ARK API key. Set VITE_ARK_API_KEY in .env.local.');
  }

  return value;
};
