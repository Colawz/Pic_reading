import type { Character, Location, NarrativeFacts } from '../types';
import { isLocalPicDbUrl } from './localImageService';

const toBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
};

export const localImageUrlToDataUrl = async (
  localUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> => {
  if (!isLocalPicDbUrl(localUrl)) {
    throw new Error(`Only local pic_db images can be uploaded as references: ${localUrl}`);
  }

  const response = await fetchImpl(localUrl);
  if (!response.ok) {
    throw new Error(`Failed to load local reference image: ${localUrl}`);
  }

  const blob = await response.blob();
  const mimeType = blob.type || response.headers.get('content-type') || 'image/png';
  const base64 = toBase64(await blob.arrayBuffer());
  return `data:${mimeType};base64,${base64}`;
};

const findMatchedCharacter = (name: string, characters: Character[]) =>
  characters.find(character => name.includes(character.name) || character.name.includes(name));

const findMatchedLocation = (locationName: string, locations: Location[]) =>
  locations.find(location => locationName.includes(location.name) || location.name.includes(locationName));

export const collectIllustrationReferenceLocalUrls = (
  facts: NarrativeFacts,
  characters: Character[],
  locations: Location[],
): string[] => {
  const urls = new Set<string>();

  facts.characters.forEach((name) => {
    const matchedCharacter = findMatchedCharacter(name, characters);
    if (isLocalPicDbUrl(matchedCharacter?.imageUrl)) {
      urls.add(matchedCharacter.imageUrl);
    }
  });

  const matchedLocation = findMatchedLocation(facts.location, locations);
  if (isLocalPicDbUrl(matchedLocation?.imageUrl)) {
    urls.add(matchedLocation.imageUrl);
  }

  return Array.from(urls);
};

export const resolveIllustrationReferenceImages = async (
  facts: NarrativeFacts,
  characters: Character[],
  locations: Location[],
  fetchImpl: typeof fetch = fetch,
): Promise<string[]> => {
  const localReferenceUrls = collectIllustrationReferenceLocalUrls(facts, characters, locations);
  return Promise.all(localReferenceUrls.map((localUrl) => localImageUrlToDataUrl(localUrl, fetchImpl)));
};
