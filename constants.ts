
import { Book, VisualSpec } from "./types";

export const VISUAL_PRESETS: VisualSpec[] = [
  {
    id: "watercolor_storybook",
    label: "水彩绘本风",
    promptStyle: "soft watercolor illustration, gentle brush strokes, dreamy atmosphere, high quality storybook art",
    cameraLanguage: "cinematic composition, shallow depth of field",
    negatives: "text, watermark, logo, modern objects, photograph, realism, distorted face"
  },
  {
    id: "anime_cel_shaded",
    label: "日系赛璐珞",
    promptStyle: "anime style, cel shaded, vibrant colors, clean lines, studio ghibli inspired",
    cameraLanguage: "dynamic angle, emotional lighting",
    negatives: "3d render, realistic, sketch, messy, text, watermark"
  },
  {
    id: "cute_pixel_art",
    label: "可爱像素风",
    promptStyle: "cute pixel art style, 16-bit, vibrant colors, clean pixels, game boy advance aesthetic, retro gaming, isometric perspective",
    cameraLanguage: "orthographic view, flat 2D perspective",
    negatives: "photograph, blur, noisy, gradient, realistic, 3d render, text, watermark, sloppy pixels"
  },
  {
    id: "ink_illustration",
    label: "古典水墨/版画",
    promptStyle: "traditional Chinese ink wash painting style, black and white ink illustration, brush strokes, elegant atmosphere",
    cameraLanguage: "centered composition, detailed background",
    negatives: "color, photograph, digital painting, blur"
  },
  {
    id: "chinese_line_art",
    label: "工笔白描/年画风",
    promptStyle: "traditional chinese line art, gongbi style, new year picture aesthetic, flat coloring, large color blocks, ink line outlines, decorative lines, retro color palette, low saturation, earthy background, chinese opera character styling, exaggerated poses, strong narrative, lianhuanhua style",
    cameraLanguage: "flat perspective, 2D composition, narrative framing",
    negatives: "volumetric lighting, gradient, 3d render, realistic, photograph, oil painting, impasto, thick paint, modern, shiny"
  },
  {
    id: "minimalist_lines",
    label: "简约线条风",
    promptStyle: "minimalist line art, continuous line drawing, abstract style, clean background, high contrast, monochrome or limited color palette, vector art style, simple shapes, modern aesthetic",
    cameraLanguage: "flat lay, 2D perspective, plenty of negative space",
    negatives: "detailed, complex, realistic, 3d, shading, gradient, cluttered, messy, photograph, texture"
  }
];

export const createBook = (id: string, title: string, author: string, genre: string, emoji: string, styleId: string, content: string, coverUrl?: string): Book => {
  const paragraphs = content.split('\n').filter(p => p.trim().length > 0).map((p, i) => ({
    id: `${id}-p-${i}`,
    text: p.trim(),
    chapterId: `${id}-ch1`
  }));

  return {
    id, title, author, genre, coverEmoji: emoji, visualSpecId: styleId, coverUrl,
    chapters: [{ id: `${id}-ch1`, title: "第一章", paragraphs }]
  };
};

const WHITE_BONE_TEXT = `
唐僧师徒行至白虎岭，孙悟空奉唐僧之命前往南山摘桃解饥。此时白骨精察觉唐僧行踪，欲食其肉以求长生，但因八戒、沙僧护持未敢贸然行动，决定先试探一番。

白骨精首次化身为一美貌女子，左手提青砂罐，右手持绿磁瓶，谎称为僧人提供斋饭。八戒动了凡心，轻信其言，催促唐僧用斋。唐僧持疑，询问女子来历，白骨精编造身世，称家住山脚，为田中人送饭。
悟空摘桃归来，识破妖身，举棒便打。白骨精使“解尸法”脱身，留假尸于地。唐僧见女子毙命，怒斥悟空滥杀无辜。八戒趁机挑唆，称悟空使障眼法掩盖罪行。唐僧念紧箍咒惩戒，悟空苦求方止。
此时罐中现出长蛆、蛤蟆，唐僧半信半疑，但仍责怪悟空行凶。
白骨精不甘失败，第二次变作八旬老妇，拄杖哭寻“女儿”。八戒惊惶，断言老妇为死者之母，悟空反驳：“八十老妇岂能生十八之女？”近前辨出妖气，挥棒再击。
白骨精故技重施，元神遁走，假尸倒地。唐僧惊骇坠马，念紧箍咒20遍，悟空头痛欲裂，伏地求饶。
八戒又进谗言，说：“师父，他要和你分行李哩。”唐僧决意驱逐，悟空以恩情恳求师父不要驱逐他。唐僧心软，暂时饶恕悟空，师徒继续前行。
白骨精第三次化身为白发老翁，佯装寻妻女骸骨。八戒再称祸事临头，悟空识破老翁真身，暗地里召唤土地、山神作证，不顾唐僧紧箍咒威胁，一棒打死妖精，使其现出白骨本相，白骨的脊梁上刻“白骨夫人”四字。
唐僧见骷髅稍微相信悟空的话，但是八戒又诬陷悟空伪造证据。唐僧耳软，写下贬书驱逐悟空。
悟空分身四面拜别唐僧，又嘱托沙僧防妖后，含泪拜别，驾云返回花果山，唐僧一行继续西行。自此，取经团队少一主力，前途凶险未卜。
`;

const TORTOISE_HARE_TEXT = `
兔子长了四条腿，一蹦一跳，跑得可快啦。乌龟也长了四条腿，爬呀，爬呀，爬得真慢。
龟兔赛跑，谁才是冠军？
有一天，兔子碰见乌龟，看见乌龟爬得这么慢，就想戏弄戏弄他，于是笑眯眯地说：“乌龟，乌龟，咱们来赛跑，好吗？”乌龟知道兔子在开他玩笑，瞪着一双小眼睛，不理也不踩。兔子知道乌龟不敢跟他赛跑，乐得摆着耳朵直蹦跳，还编了一支山歌笑话他：
乌龟，乌龟，爬爬爬，
一早出门采花；
乌龟，乌龟，走走走，
傍晚还在门口。
乌龟生气了，说：“兔子，兔子，你别神灵活现的，咱们这就来赛跑!”
“什么？乌龟，你说什么？”
“咱们这就来赛跑。”
兔子一听，差点笑破了肚子：“乌龟，你真敢跟我赛跑？那好，咱们从这儿跑起，看谁先跑到那边山脚下的一棵大树。预备！一，二，三，－－－”兔子撒开腿就跑，跑得真快，一会儿就跑得很远了。他回头一看，乌龟才爬了一小段路呢，心心想：乌龟敢跟兔子赛跑，真是天大的笑话！我呀，在这儿睡上一大觉，让他爬到这儿，不，让他爬到前面去吧，我三蹦二跳的就追上他了。
“啦啦啦，胜利准是我的嘛。”兔子把身子往地上一躺，合上眼皮，真的睡着了。再说乌龟，爬得也真慢，可是他一个劲儿地爬，爬呀，爬呀，爬，等他爬到兔子身边，已经筋疲力尽了。兔子还在睡觉，乌龟也想休息一会儿，可他知道兔子跑得比他快，只有坚持爬下去才有可能赢。于是，他不停地往前爬、爬、爬。离大树越来越近了，只差几十步了，十几步了，几步了………终于到了。
兔子为什么睡着了？
兔子呢？他还在睡觉呢。兔子醒来后往后一看，唉，乌龟怎么不见了？再往前一看，哎呀，不得了了。乌龟已经爬到大树底下的。兔子一看可急了，急忙赶上去，可已经晚了，乌龟已经赢了。
兔子跑得快，乌龟跑得慢，为什么这次比赛乌龟反而赢了呢？
`;


const WATER_CYCLE_TEXT = `
水循环是地球上水在海洋、陆地与大气之间不断往返的过程，靠的主要是太阳能驱动蒸发与大气运动，外加重力让水回到地表并汇入江河湖海。海洋、湖泊、土壤和植物把水以水汽形式送入空气（蒸发/蒸腾），水汽随气流上升冷却后形成云，并在合适条件下变成雨、雪等降到地面（凝结与降水）。降到陆地的水一部分沿地表流动汇成溪流河流（地表径流），一部分渗入土壤和岩层成为地下水并缓慢流动（下渗与地下径流），最终又回到海洋；同时地表水还会再次蒸发。正是这套循环，持续补给淡水资源、调节气候，也影响着洪涝与干旱的发生。

水循环可以按“海洋/陆地 → 大气 → 陆地/海洋 → 回到海洋”这条闭环来理解。首先，太阳加热海面、湖泊、河流和湿润地表，使水变成水汽上升（蒸发）；植物通过叶片把水分释放到空气中（蒸腾），两者合起来常写作“蒸散”。水汽被风带走并抬升到更高处，温度降低后在尘埃等凝结核上形成小水滴或冰晶，聚集成云（凝结/成云）。当云滴长大到空气托不住，就会落到地面或海面，形成雨、雪、冰雹等（降水）。降到陆地的水有几条去路：一部分顺坡流入沟渠、溪流、江河，最后入海（地表径流）；一部分渗入土壤成为土壤水，被植物吸收后再蒸腾回到空气（入渗—植物吸收—蒸腾）；还有一部分继续下渗到更深处形成含水层中的地下水，缓慢流动并在泉、河道或海岸处补给地表水/海洋（地下径流与出露）。在寒冷地区，降水会暂时以积雪、冰川的形式储存，气温回升后融化补给河流（冻结—融化）。这样，水不断在各“水库”（海洋、大气、河流湖泊、土壤、地下水、冰雪）之间转移，构成一张用箭头就能清晰表达的循环流程图。
`;

export const SAMPLE_BOOKS: Book[] = [
  createBook("book-white-bone", "西游记：三打白骨精", "吴承恩", "神魔小说", "🐵", "chinese_line_art", WHITE_BONE_TEXT, "/covers/white-bone-demon.png"),
  createBook("book-tortoise-hare", "寓言：龟兔赛跑", "伊索", "寓言故事", "🐢", "watercolor_storybook", TORTOISE_HARE_TEXT, "/covers/tortoise-hare.png"),
  createBook("book-water-cycle", "科普：水循环", "科普", "科普百科", "💧", "minimalist_lines", WATER_CYCLE_TEXT, "/covers/water-cycle.png"),
];
