import { Book, Character, Illustration, Location, Relationship, VisualSpec, ImageGenerationModelId, ImageGenerationStats, StoredImageRecord, RelationshipChatState } from "../types";

const DB_NAME = "zhihui-reading-db";
const DB_VERSION = 2;
const STORE_NAME = "app_state";
const APP_STATE_KEY = "main";
const IMAGE_RECORDS_STORE_NAME = "image_records";
const IMAGE_RECORDS_KEY = "all";

export interface PersistedAppState {
  books: Book[];
  availableSpecs: VisualSpec[];
  characters: Character[];
  locations: Location[];
  relationships: Relationship[];
  relationshipChats?: Record<string, RelationshipChatState>;
  illustrations: Record<string, Illustration>;
  currentBookId: string | null;
  preferredVisualSpecId: string | null;
  imageModelId: ImageGenerationModelId | null;
  imageGenerationStats: ImageGenerationStats | null;
}

const openDatabase = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
      if (!db.objectStoreNames.contains(IMAGE_RECORDS_STORE_NAME)) {
        db.createObjectStore(IMAGE_RECORDS_STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const runTransaction = async <T>(
  mode: IDBTransactionMode,
  executor: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void
): Promise<T> => {
  const db = await openDatabase();

  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);

    transaction.oncomplete = () => db.close();
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);

    executor(store, resolve, reject);
  });
};

export const loadPersistedAppState = async (): Promise<PersistedAppState | null> => {
  return runTransaction<PersistedAppState | null>("readonly", (store, resolve, reject) => {
    const request = store.get(APP_STATE_KEY);
    request.onsuccess = () => resolve((request.result as PersistedAppState | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
};

export const savePersistedAppState = async (state: PersistedAppState): Promise<void> => {
  return runTransaction<void>("readwrite", (store, resolve, reject) => {
    const request = store.put(state, APP_STATE_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

const runImageRecordsTransaction = async <T>(
  mode: IDBTransactionMode,
  executor: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void
): Promise<T> => {
  const db = await openDatabase();

  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(IMAGE_RECORDS_STORE_NAME, mode);
    const store = transaction.objectStore(IMAGE_RECORDS_STORE_NAME);

    transaction.oncomplete = () => db.close();
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);

    executor(store, resolve, reject);
  });
};

export const loadStoredImageRecords = async (): Promise<StoredImageRecord[]> => {
  return runImageRecordsTransaction<StoredImageRecord[]>("readonly", (store, resolve, reject) => {
    const request = store.get(IMAGE_RECORDS_KEY);
    request.onsuccess = () => resolve((request.result as StoredImageRecord[] | undefined) ?? []);
    request.onerror = () => reject(request.error);
  });
};

export const saveStoredImageRecords = async (records: StoredImageRecord[]): Promise<void> => {
  return runImageRecordsTransaction<void>("readwrite", (store, resolve, reject) => {
    const request = store.put(records, IMAGE_RECORDS_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};
