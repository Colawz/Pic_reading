
import { GoogleGenAI, Type } from "@google/genai";
import { NarrativeFacts, VisualSpec, Character, Location, Relationship } from "../types";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key not found in environment variables");
  return new GoogleGenAI({ apiKey });
};

export const scanChapterForAssets = async (chapterText: string): Promise<{ characters: Partial<Character>[], locations: Partial<Location>[] }> => {
    const ai = getClient();
    const textToAnalyze = chapterText.slice(0, 15000);
    const prompt = `分析以下章节，提取主要角色和地点。Text: "${textToAnalyze}"`;
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        characters: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, visualSummary: { type: Type.STRING } } } },
                        locations: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, visualSummary: { type: Type.STRING } } } }
                    }
                }
            }
        });
        const result = JSON.parse(response.text || "{}");
        return { characters: result.characters || [], locations: result.locations || [] };
    } catch (e) { return { characters: [], locations: [] }; }
};

export const analyzeRelationships = async (chapterText: string, characters: Character[]): Promise<Partial<Relationship>[]> => {
    if (characters.length < 2) return [];
    const ai = getClient();
    const textToAnalyze = chapterText.slice(0, 10000);
    const charList = characters.map(c => c.name).join(", ");
    const prompt = `分析角色间的社会关系。角色列表: [${charList}]。文本: "${textToAnalyze}"`;
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        relationships: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { sourceName: { type: Type.STRING }, targetName: { type: Type.STRING }, type: { type: Type.STRING }, description: { type: Type.STRING } }, required: ["sourceName", "targetName", "type", "description"] } }
                    }
                }
            }
        });
        const result = JSON.parse(response.text || "{}");
        const found: Partial<Relationship>[] = [];
        (result.relationships || []).forEach((rel: any) => {
            const s = characters.find(c => c.name.toLowerCase() === rel.sourceName.toLowerCase());
            const t = characters.find(c => c.name.toLowerCase() === rel.targetName.toLowerCase());
            if (s && t && s.id !== t.id) found.push({ sourceId: s.id, targetId: t.id, type: rel.type, description: rel.description });
        });
        return found;
    } catch (e) { return []; }
};

export const analyzeNarrative = async (targetText: string, contextText: string, existingCharacters: Character[], existingLocations: Location[]): Promise<NarrativeFacts> => {
  const ai = getClient();
  const knownAssets = `已知的角色: ${existingCharacters.map(c => c.name).join(", ") || "无"} | 已知的地点: ${existingLocations.map(l => l.name).join(", ") || "无"}`;
  const prompt = `分析小说片段并提取绘图事实。背景: ${knownAssets} | 上下文: ${contextText} | 当前段落: "${targetText}"`;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            characters: { type: Type.ARRAY, items: { type: Type.STRING } },
            location: { type: Type.STRING },
            action: { type: Type.STRING },
            mood: { type: Type.STRING },
            objects: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
        },
      },
    });
    return JSON.parse(response.text || "{}") as NarrativeFacts;
  } catch (e) {
    return { characters: [], location: "未知", action: "静止", mood: "平静", objects: [] };
  }
};

export const generateIllustration = async (facts: NarrativeFacts, visualSpec: VisualSpec, characters: Character[], locations: Location[]): Promise<string> => {
  const ai = getClient();
  let charDesc = "";
  facts.characters.forEach(name => {
    const match = characters.find(c => name.includes(c.name) || c.name.includes(name));
    charDesc += match ? `${match.name}: ${match.visualSummary}. ` : `${name}. `;
  });
  const prompt = `Generate a scene: Location: ${facts.location} | Characters: ${charDesc} | Action: ${facts.action} | Mood: ${facts.mood} | Style: ${visualSpec.promptStyle} | Camera: ${visualSpec.cameraLanguage}`;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: { parts: [{ text: prompt }] },
      config: {
        systemInstruction: "Strictly generate an image based on the prompt. Do not provide text. Aspect: 16:9.",
        imageConfig: { aspectRatio: "16:9" }
      }
    });
    const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (part?.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    throw new Error("No image data returned.");
  } catch (e) { console.error(e); throw e; }
};

export const generateAssetVisual = async (description: string, type: 'character' | 'location', visualSpec: VisualSpec): Promise<string> => {
    const ai = getClient();
    const prompt = type === 'character' 
        ? `Professional character concept design sheet: ${description}. 
           Required: Three-view layout showing front view, side view, and back view. 
           Style: ${visualSpec.promptStyle}. Background: Simple neutral background.`
        : `Environment concept art: ${description}. Style: ${visualSpec.promptStyle}. Aspect: 1:1.`;
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-image",
            contents: { parts: [{ text: prompt }] },
            config: {
                systemInstruction: "Generate a single asset image. No text. Aspect: 1:1.",
                imageConfig: { aspectRatio: "1:1" }
            }
        });
        const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
        if (part?.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        throw new Error("No asset image returned.");
    } catch (e) { console.error(e); throw e; }
}
