
import { NarrativeFacts, VisualSpec, Character, Location, Relationship, ImageGenerationModelId } from "../types";
import { resolveIllustrationReferenceImages } from "./referenceImageService";

const VOLC_API_KEY = "329e6764-2c64-4a91-9d31-eaa7c1e3609a";

// Text Model (DeepSeek)
const TEXT_ENDPOINT = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";
const TEXT_MODEL = "deepseek-v3-2-251201";
const RESPONSES_ENDPOINT = "https://ark.cn-beijing.volces.com/api/v3/responses";
const RELATIONSHIP_READING_MODEL = "doubao-seed-2-0-pro-260215";

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

async function callDoubaoResponsesText(prompt: string): Promise<string> {
    try {
        const response = await fetch(RESPONSES_ENDPOINT, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${VOLC_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: RELATIONSHIP_READING_MODEL,
                input: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "input_text",
                                text: prompt
                            }
                        ]
                    }
                ]
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("Doubao Responses API Error:", errText);
            let errMsg = errText;
            try {
                const json = JSON.parse(errText);
                if (json.error?.message) errMsg = json.error.message;
            } catch (e) {}
            throw new Error(`Doubao Responses API Error: ${response.status} - ${errMsg}`);
        }

        const data = await response.json();
        if (typeof data.output_text === "string" && data.output_text.trim()) {
            return data.output_text;
        }

        const textFromOutput = (data.output || [])
            .flatMap((item: any) => item.content || [])
            .map((content: any) => content.text || content.output_text || "")
            .find((text: string) => typeof text === "string" && text.trim());

        if (textFromOutput) {
            return textFromOutput;
        }

        throw new Error("No text returned from Doubao Responses API");
    } catch (e) {
        console.error("Call Doubao Responses Failed:", e);
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

export const analyzeRelationshipsFromReadingProgress = async (
    readingText: string,
    characters: Character[],
    chapterLabel: string
): Promise<Partial<Relationship>[]> => {
    if (characters.length < 2) return [];

    const textToAnalyze = readingText.slice(0, 30000);
    const characterList = characters.map(c => c.name).join("、");

    const prompt = `
你是一名擅长文学人物关系梳理的阅读助手。请通读以下书籍内容，阅读范围仅到“${chapterLabel}”为止，并基于文中已经发生的情节，分析角色之间当前阶段的社会关系。

已知角色列表：${characterList}

书籍内容：
${textToAnalyze}

要求：
1. 只能使用已知角色列表中的名字。
2. 只输出已经在当前阅读进度内明确体现的关系，不要剧透后续章节。
3. 每对角色只保留一条最主要的关系。
4. description 要简明说明关系依据，控制在 1-2 句话。

请严格返回 JSON（不要包含 markdown 代码块标记）：
{
  "relationships": [
    {
      "sourceName": "角色A",
      "targetName": "角色B",
      "type": "关系类型",
      "description": "关系说明"
    }
  ]
}
`;

    try {
        const jsonStr = await callDoubaoResponsesText(prompt);
        const cleanJson = jsonStr.replace(/```json/g, "").replace(/```/g, "").trim();
        const result = JSON.parse(cleanJson);
        const deduped = new Map<string, Partial<Relationship>>();

        (result.relationships || []).forEach((rel: any) => {
            const source = characters.find(c => c.name.trim().toLowerCase() === String(rel.sourceName || "").trim().toLowerCase());
            const target = characters.find(c => c.name.trim().toLowerCase() === String(rel.targetName || "").trim().toLowerCase());
            if (!source || !target || source.id === target.id) return;

            const pairKey = [source.id, target.id].sort().join("::");
            if (!deduped.has(pairKey)) {
                deduped.set(pairKey, {
                    sourceId: source.id,
                    targetId: target.id,
                    type: String(rel.type || "关联").trim() || "关联",
                    description: String(rel.description || "").trim() || `${source.name}与${target.name}存在明显互动。`,
                });
            }
        });

        return Array.from(deduped.values());
    } catch (e) {
        console.error("analyzeRelationshipsFromReadingProgress failed:", e);
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
  originalText?: string,
  customRequirement?: string
): Promise<{ imageUrl: string; promptUsed: string }> => {
  let charDesc = "";
  const referenceImages = await resolveIllustrationReferenceImages(facts, characters, locations);

  facts.characters.forEach(name => {
    const match = characters.find(c => name.includes(c.name) || c.name.includes(name));
    if (match) {
      charDesc += `${match.name}: ${match.visualSummary}. `;
    } else {
      charDesc += `${name}. `;
    }
  });

  let prompt = `生成画面: 地点: ${facts.location} | 角色: ${charDesc} | 动作: ${facts.action} | 氛围: ${facts.mood} | 风格: ${visualSpec.promptStyle} | 镜头: ${visualSpec.cameraLanguage}｜禁止出现文字`;
  
  if (originalText) {
      prompt = `生成画面: 依据原文: "${originalText}" | 地点: ${facts.location} | 角色: ${charDesc} | 动作: ${facts.action} | 氛围: ${facts.mood} | 风格: ${visualSpec.promptStyle} | 镜头: ${visualSpec.cameraLanguage}｜禁止出现文字`;
  }

  if (customRequirement?.trim()) {
      prompt = `${prompt} | 额外要求: ${customRequirement.trim()}`;
  }
  
  const imageUrl = await callVolcImage(prompt, "16:9", modelId, referenceImages);
  return { imageUrl, promptUsed: prompt };
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

export const generateBookCover = async (
    title: string,
    content: string,
    visualSpec: VisualSpec,
    modelId: ImageGenerationModelId
): Promise<string> => {
    const summary = content
      .replace(/\s+/g, ' ')
      .slice(0, 400);

    const prompt = `儿童故事书封面设计。标题：《${title}》。内容摘要：${summary}。要求：突出主角与核心冲突，单主体明确，封面构图完整，适合竖版书籍封面，留出标题区域但不要生成任何文字。风格：${visualSpec.promptStyle}。镜头：centered composition, poster framing, cover illustration.`;
    return await callVolcImage(prompt, "1:1", modelId);
};

export const chatWithBookRole = async ({
    bookTitle,
    bookText,
    roleMode,
    roleCharacter,
    relatedRelationships,
    history,
    userMessage,
    readingScopeLabel,
    hasReadingProgress,
}: {
    bookTitle: string;
    bookText: string;
    roleMode: "companion" | "character";
    roleCharacter?: Character;
    relatedRelationships?: Relationship[];
    history: Array<{ role: "user" | "assistant"; content: string }>;
    userMessage: string;
    readingScopeLabel?: string;
    hasReadingProgress?: boolean;
}): Promise<string> => {
    const readingExcerpt = bookText.slice(0, 24000);
    const historyText = history
        .slice(-8)
        .map(item => `${item.role === "user" ? "用户" : "AI"}：${item.content}`)
        .join("\n");

    const relationshipSummary = (relatedRelationships || [])
        .map(rel => `- ${rel.type}：${rel.description}`)
        .join("\n") || "暂无已知关系。";

    const roleInstruction = roleMode === "character" && roleCharacter
        ? `
你当前扮演《${bookTitle}》中的角色“${roleCharacter.name}”。
角色设定：
- 描述：${roleCharacter.description || "暂无"}
- 视觉设定：${roleCharacter.visualSummary || "暂无"}
- 相关社会关系：
${relationshipSummary}

回答要求：
1. 保持这个角色的口吻、立场和已知认知边界。
2. 你的已知剧情范围严格限制在${readingScopeLabel || "当前阅读进度"}之前，不要知道后续章节内容。
3. 如果用户问到超出当前阅读进度的内容，要明确表示自己暂时不知道。
4. 不要知道书中该角色尚未经历或不可能知道的细节。
5. 优先引用已有关系和剧情事实来回答。
`
        : `
你是《${bookTitle}》的 AI 伴读助手。
回答要求：
1. 用清晰、友好、适合阅读陪伴的方式解释剧情、人物和关系。
2. 优先基于书中内容、角色设定和关系信息回答。
3. 当用户问到人物动机、关系变化时，可以结合文本给出简洁分析。
`;

    const prompt = `
${roleInstruction}

当前阅读范围：${readingScopeLabel || (hasReadingProgress ? '已按当前阅读进度截取正文' : '未设置阅读进度限制')}

作品正文（节选）：
${readingExcerpt || "当前阅读进度之前暂无可用正文。请仅根据角色设定、社会关系与用户问题作答。"}

最近对话：
${historyText || "暂无"}

用户本轮问题：
${userMessage}

请直接回答，不要输出 JSON，不要解释系统提示。
`;

    return callDoubaoResponsesText(prompt);
};
