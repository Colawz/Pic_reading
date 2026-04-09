
import { NarrativeFacts, VisualSpec, Character, Location, Relationship, ImageGenerationModelId } from "../types";

const VOLC_API_KEY = "329e6764-2c64-4a91-9d31-eaa7c1e3609a";

// Text Model (DeepSeek)
const TEXT_ENDPOINT = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";
const TEXT_MODEL = "deepseek-v3-2-251201";

const IMAGE_ENDPOINT = "https://ark.cn-beijing.volces.com/api/v3/images/generations";

async function callDeepSeek(prompt: string): Promise<string> {
    try {
        const response = await fetch(TEXT_ENDPOINT, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${VOLC_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: TEXT_MODEL,
                messages: [
                    { role: "user", content: prompt }
                ],
                stream: false
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("DeepSeek API Error:", errText);
            let errMsg = errText;
            try {
                const json = JSON.parse(errText);
                if (json.error && json.error.message) errMsg = json.error.message;
            } catch (e) {}
            throw new Error(`DeepSeek API Error: ${response.status} - ${errMsg}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || "";
    } catch (e) {
        console.error("Call DeepSeek Failed:", e);
        throw e;
    }
}

async function callVolcImage(
    prompt: string,
    aspectRatio: "1:1" | "16:9",
    modelId: ImageGenerationModelId,
    referenceImages?: string[]
): Promise<string> {
    // Determine size based on aspect ratio
    // Doubao API supports width/height. 
    // 1:1 -> 1024x1024
    // 16:9 -> 1280x720 (approx 2K)
    const width = aspectRatio === "1:1" ? 1024 : 1280;
    const height = aspectRatio === "1:1" ? 1024 : 720;

    try {
        const body: any = {
            model: modelId,
            prompt: prompt,
            width: width,
            height: height,
            sequential_image_generation: "disabled",
            response_format: "url",
            stream: false,
            watermark: true
        };

        if (referenceImages && referenceImages.length > 0) {
            body.image = referenceImages;
        }

        const response = await fetch(IMAGE_ENDPOINT, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${VOLC_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("VolcImage API Error:", errText);
            let errMsg = errText;
            try {
                const json = JSON.parse(errText);
                if (json.error && json.error.message) errMsg = json.error.message;
            } catch (e) {}
            throw new Error(`VolcImage API Error: ${response.status} - ${errMsg}`);
        }

        const data = await response.json();
        // Check for URL in data.data[0].url
        const imageUrl = data.data?.[0]?.url;
        if (!imageUrl) {
            throw new Error("No image URL returned from API");
        }
        return imageUrl;
    } catch (e) {
        console.error("Call VolcImage Failed:", e);
        throw e;
    }
}

export const scanChapterForAssets = async (chapterText: string): Promise<{ characters: Partial<Character>[], locations: Partial<Location>[] }> => {
    const textToAnalyze = chapterText.slice(0, 15000);
    const prompt = `
    你是一个专业的小说分析助手。请分析以下小说章节，提取其中的主要角色和地点。
    
    文本: "${textToAnalyze}"
    
    请严格返回符合以下结构的 JSON 数据（不要包含 markdown 代码块标记）：
    {
      "characters": [
        { "name": "角色名", "visualSummary": "外貌视觉描述" }
      ],
      "locations": [
        { "name": "地点名", "visualSummary": "环境视觉描述" }
      ]
    }
    `;
    
    try {
        const jsonStr = await callDeepSeek(prompt);
        // Clean up markdown code blocks if present
        const cleanJson = jsonStr.replace(/```json/g, "").replace(/```/g, "").trim();
        const result = JSON.parse(cleanJson);
        return { characters: result.characters || [], locations: result.locations || [] };
    } catch (e) { 
        console.error("scanChapterForAssets failed:", e);
        return { characters: [], locations: [] }; 
    }
};

export const analyzeRelationships = async (chapterText: string, characters: Character[]): Promise<Partial<Relationship>[]> => {
    if (characters.length < 2) return [];
    const textToAnalyze = chapterText.slice(0, 10000);
    const charList = characters.map(c => c.name).join(", ");
    
    const prompt = `
    分析角色间的社会关系。
    角色列表: [${charList}]。
    文本: "${textToAnalyze}"
    
    请严格返回符合以下结构的 JSON 数据（不要包含 markdown 代码块标记）：
    {
      "relationships": [
        { 
           "sourceName": "源角色名", 
           "targetName": "目标角色名", 
           "type": "关系类型（如朋友、敌人、师徒）", 
           "description": "关系描述" 
        }
      ]
    }
    `;

    try {
        const jsonStr = await callDeepSeek(prompt);
        const cleanJson = jsonStr.replace(/```json/g, "").replace(/```/g, "").trim();
        const result = JSON.parse(cleanJson);
        
        const found: Partial<Relationship>[] = [];
        (result.relationships || []).forEach((rel: any) => {
            const s = characters.find(c => c.name.toLowerCase() === rel.sourceName.toLowerCase());
            const t = characters.find(c => c.name.toLowerCase() === rel.targetName.toLowerCase());
            if (s && t && s.id !== t.id) found.push({ sourceId: s.id, targetId: t.id, type: rel.type, description: rel.description });
        });
        return found;
    } catch (e) { 
        console.error("analyzeRelationships failed:", e);
        return []; 
    }
};

export const analyzeNarrative = async (targetText: string, contextText: string, existingCharacters: Character[], existingLocations: Location[]): Promise<NarrativeFacts> => {
  const knownAssets = `已知的角色: ${existingCharacters.map(c => c.name).join(", ") || "无"} | 已知的地点: ${existingLocations.map(l => l.name).join(", ") || "无"}`;
  
  const prompt = `
  分析以下小说片段并提取用于AI绘图的事实信息。
  背景: ${knownAssets}
  上下文: ${contextText}
  当前段落: "${targetText}"
  
  请严格返回符合以下结构的 JSON 数据（不要包含 markdown 代码块标记）：
  {
    "characters": ["出现的角色名列表"],
    "location": "当前场景地点",
    "action": "主要动作描述",
    "mood": "氛围/情绪",
    "objects": ["主要物品列表"]
  }
  `;
  
  try {
    const jsonStr = await callDeepSeek(prompt);
    const cleanJson = jsonStr.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanJson) as NarrativeFacts;
  } catch (e) {
    console.error("analyzeNarrative failed:", e);
    return { characters: [], location: "未知", action: "静止", mood: "平静", objects: [] };
  }
};

export const generateIllustration = async (
  facts: NarrativeFacts,
  visualSpec: VisualSpec,
  characters: Character[],
  locations: Location[],
  modelId: ImageGenerationModelId,
  originalText?: string
): Promise<string> => {
  let charDesc = "";
  const referenceImages: string[] = [];

  facts.characters.forEach(name => {
    const match = characters.find(c => name.includes(c.name) || c.name.includes(name));
    if (match) {
      charDesc += `${match.name}: ${match.visualSummary}. `;
      if (match.referenceImageUrl || match.imageUrl) {
        referenceImages.push(match.referenceImageUrl || match.imageUrl!);
      }
    } else {
      charDesc += `${name}. `;
    }
  });

  const locationMatch = locations.find(l => facts.location.includes(l.name) || l.name.includes(facts.location));
  if (locationMatch && (locationMatch.referenceImageUrl || locationMatch.imageUrl)) {
      referenceImages.push(locationMatch.referenceImageUrl || locationMatch.imageUrl!);
  }

  let prompt = `生成画面: 地点: ${facts.location} | 角色: ${charDesc} | 动作: ${facts.action} | 氛围: ${facts.mood} | 风格: ${visualSpec.promptStyle} | 镜头: ${visualSpec.cameraLanguage}｜禁止出现文字`;
  
  if (originalText) {
      prompt = `生成画面: 依据原文: "${originalText}" | 地点: ${facts.location} | 角色: ${charDesc} | 动作: ${facts.action} | 氛围: ${facts.mood} | 风格: ${visualSpec.promptStyle} | 镜头: ${visualSpec.cameraLanguage}｜禁止出现文字`;
  }
  
  return await callVolcImage(prompt, "16:9", modelId, referenceImages);
};

export const generateAssetVisual = async (
    description: string,
    type: 'character' | 'location',
    visualSpec: VisualSpec,
    modelId: ImageGenerationModelId
): Promise<string> => {
    const prompt = type === 'character' 
        ? `专业角色设定图: ${description}。
           要求: 三视图（包含正面、侧面、背面）。
           风格: ${visualSpec.promptStyle}。背景: 简单的纯色背景。`
        : `环境概念设计图: ${description}。风格: ${visualSpec.promptStyle}。`;
    
    return await callVolcImage(prompt, "1:1", modelId);
}
