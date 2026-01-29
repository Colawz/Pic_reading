import { GoogleGenAI, Type } from "@google/genai";
import { NarrativeFacts, VisualSpec, Character, Location } from "../types";

// Helper to get client safely
const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found in environment variables");
  }
  return new GoogleGenAI({ apiKey });
};

export const scanChapterForAssets = async (
    chapterText: string
): Promise<{ characters: Partial<Character>[], locations: Partial<Location>[] }> => {
    const ai = getClient();
    
    // Truncate text if too long to save tokens
    const textToAnalyze = chapterText.slice(0, 15000);

    const prompt = `
      Please analyze the following chapter text and extract ALL potential major Characters and Locations that appear or are described.
      
      For each Character:
      - Name
      - A short visual description summary (appearance).

      For each Location:
      - Name
      - A short visual description summary.

      Text:
      "${textToAnalyze}"
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        characters: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    visualSummary: { type: Type.STRING }
                                }
                            }
                        },
                        locations: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    visualSummary: { type: Type.STRING }
                                }
                            }
                        }
                    }
                }
            }
        });

        const jsonText = response.text || "{}";
        const result = JSON.parse(jsonText);
        
        return {
            characters: result.characters || [],
            locations: result.locations || []
        };
    } catch (error) {
        console.error("Asset Scan Error:", error);
        return { characters: [], locations: [] };
    }
};

export const analyzeNarrative = async (
  targetText: string,
  contextText: string,
  existingCharacters: Character[],
  existingLocations: Location[]
): Promise<NarrativeFacts> => {
  const ai = getClient();
  
  const knownAssetsContext = `
    已知的角色: ${existingCharacters.map(c => c.name).join(", ") || "无"}
    已知的地点: ${existingLocations.map(l => l.name).join(", ") || "无"}
  `;

  const prompt = `
    请分析以下小说片段。
    
    [背景信息]
    ${knownAssetsContext}

    [上下文语境 (Context)]
    ${contextText}

    [当前需要分析的段落 (Target)]
    "${targetText}"

    请基于 [当前需要分析的段落]，结合 [上下文语境] 补充细节，提取以下结构化数据：
    1. 出场的角色 (characters)
    2. 具体的地点描述 (location)
    3. 发生的关键动作 (action)
    4. 氛围/情绪 (mood)
    5. 关键的物理道具/物品 (objects)

    请用 JSON 格式返回。
  `;

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

    const jsonText = response.text || "{}";
    return JSON.parse(jsonText) as NarrativeFacts;
  } catch (error) {
    console.error("NLU Error:", error);
    return {
      characters: [],
      location: "未知",
      action: "静止",
      mood: "平静",
      objects: [],
    };
  }
};

export const generateIllustration = async (
  facts: NarrativeFacts,
  visualSpec: VisualSpec,
  characters: Character[],
  locations: Location[]
): Promise<string> => {
  const ai = getClient();

  let charDescriptions = "";
  facts.characters.forEach(name => {
    const match = characters.find(c => name.includes(c.name) || c.name.includes(name));
    if (match) {
      charDescriptions += `${match.name}: ${match.visualSummary}. `;
    } else {
      charDescriptions += `${name} (generic appearance). `;
    }
  });

  const prompt = `
    Draw this scene:
    Description: ${facts.location}, ${facts.action}.
    Cast: ${charDescriptions}
    Vibe: ${facts.mood}
    Key Items: ${facts.objects.join(", ")}
    
    Style Guidelines: ${visualSpec.promptStyle}
    Framing: ${visualSpec.cameraLanguage}
    Avoid: ${visualSpec.negatives}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [{ text: prompt }]
      },
      config: {
        systemInstruction: "COMMAND: ONLY OUTPUT IMAGE DATA. DO NOT TALK. DO NOT DESCRIBE. DO NOT APOLOGIZE. IF YOU CANNOT DRAW, RETURN NOTHING. NEVER START YOUR RESPONSE WITH TEXT.",
        imageConfig: {
            aspectRatio: "16:9"
        }
      }
    });

    const candidate = response.candidates?.[0];
    const parts = candidate?.content?.parts;

    if (parts) {
      // Prioritize finding an image part
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
      
      // If we got here, no image was returned. Check for text errors.
      const textPart = parts.find(p => p.text);
      if (textPart) {
          throw new Error(`AI refused image generation and returned text instead: ${textPart.text.slice(0, 50)}...`);
      }
    }

    if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
        throw new Error(`Generation interrupted: ${candidate.finishReason}`);
    }

    throw new Error("No image data found in response.");
  } catch (error) {
    console.error("Image Gen Error:", error);
    throw error;
  }
};

export const generateAssetVisual = async (
  description: string,
  type: 'character' | 'location',
  visualSpec: VisualSpec
): Promise<string> => {
    const ai = getClient();
    
    const prompt = `
        Create a professional concept art design for:
        ${type === 'character' ? 'A character' : 'A location'}: ${description}
        Art Style: ${visualSpec.promptStyle}
        Environment: Clean studio background.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-image",
            contents: { parts: [{ text: prompt }] },
            config: {
                systemInstruction: "STRICT: IMAGE OUTPUT ONLY. DO NOT USE TEXT. NO CHAT. NO EXPLANATIONS.",
                imageConfig: {
                    aspectRatio: "1:1"
                }
            }
        });

        const candidate = response.candidates?.[0];
        const parts = candidate?.content?.parts;

        if (parts) {
            for (const part of parts) {
                if (part.inlineData && part.inlineData.data) {
                    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                }
            }
            const textPart = parts.find(p => p.text);
            if (textPart) {
                throw new Error(`AI returned text instead of image: ${textPart.text.slice(0, 50)}...`);
            }
        }
        
        if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
            throw new Error(`Generation blocked: ${candidate.finishReason}`);
        }

        throw new Error("No image data returned from model.");
    } catch (error) {
        console.error("Asset Gen Error:", error);
        throw error;
    }
}