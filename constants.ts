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
    id: "ink_illustration",
    label: "古典水墨/版画",
    promptStyle: "black and white ink illustration, crosshatching, engraving style, vintage book plate",
    cameraLanguage: "centered composition, detailed background",
    negatives: "color, photograph, digital painting, blur"
  },
  {
    id: "fantasy_oil",
    label: "史诗厚涂油画",
    promptStyle: "oil painting, fantasy art, detailed textures, dramatic lighting, masterpiece",
    cameraLanguage: "wide shot, cinematic lighting, rule of thirds",
    negatives: "cartoon, sketch, flat colors, modern UI, text"
  },
  {
    id: "scifi_concept",
    label: "科幻概念艺术",
    promptStyle: "sci-fi concept art, futuristic, neon lights, metallic textures, cyberpunk, digital art, artstation",
    cameraLanguage: "wide angle, cinematic lens flares, isometric",
    negatives: "vintage, rustic, watercolor, sketch"
  }
];

// Helper to generate paragraphs
export const createBook = (id: string, title: string, author: string, genre: string, emoji: string, styleId: string, content: string): Book => {
  const paragraphs = content.split('\n').filter(p => p.trim().length > 0).map((p, i) => ({
    id: `${id}-p-${i}`,
    text: p.trim(),
    chapterId: `${id}-ch1`
  }));

  return {
    id, title, author, genre, coverEmoji: emoji, visualSpecId: styleId,
    chapters: [{ id: `${id}-ch1`, title: "第一章", paragraphs }]
  };
};

// Generate longer text by repeating and varying slightly
const repeatText = (text: string, times: number) => {
    let result = text;
    const parts = text.split('\n').filter(t => t.trim().length > 0);
    for(let i=0; i<times; i++) {
        result += `\n\n（...时光流逝，第 ${i+2} 部分...）\n\n`;
        result += parts.join('\n');
    }
    return result;
}

const FAIRY_TALE_BASE = `
很久很久以前，在迷雾森林的深处，住着一位名叫莉莉的小女孩。
她总是戴着一顶红色的兜帽，手里提着一个小竹篮，里面装满了刚采摘的蘑菇。
森林里的大树高耸入云，树冠遮住了阳光，只有几缕金色的光线透过叶缝洒在满是苔藓的地面上。
传说森林中心有一座糖果做成的屋子，但从来没有人真正见过它。
“只要沿着发光的小溪走，就能找到。”老祖母曾经这样告诉她。
这一天，莉莉决定去寻找那个传说。她告别了家门口的小松鼠，踏上了铺满落叶的小径。
走着走着，周围的雾气变得越来越浓，空气中弥漫着一股甜甜的草莓味。
突然，一只穿着蓝色马甲的兔子从草丛里跳了出来，手里拿着一块巨大的怀表。
“哎呀！来不及了！来不及了！”兔子一边看着怀表，一边焦急地跺着脚。
莉莉好奇地瞪大了眼睛，她从来没见过会说话的兔子。
她悄悄地跟在兔子身后，穿过了一片巨大的发光蘑菇林。
前方出现了一扇由饼干做成的大门，门把手是一颗巨大的彩色硬糖。
莉莉深吸了一口气，轻轻地推开了那扇门。
门后是一个奇妙的世界，河流流淌着巧克力，花朵是棉花糖做的。
但是，这里似乎安静得有些过分，连风的声音都听不见。
`;

const EPIC_BASE = `
北方边境的号角声在黎明时分吹响，打破了凛冬长城的死寂。
指挥官凯尔站在城墙之上，在这个高度，寒风如同无形的巨锤敲击着他的铠甲。
他的目光越过冰封的荒原，注视着地平线上那片翻滚的黑云——那是亡灵大军逼近的征兆。
“点燃烽火！”凯尔的声音嘶哑而坚定，传遍了每一个哨位。
士兵们从睡梦中惊醒，纷纷抓起长矛和盾牌，奔向各自的战斗位置。
火焰在烽火台上腾空而起，在灰暗的天空中显得格外耀眼，向南方的王国传递着警报。
凯尔握紧了腰间的长剑，剑柄上的家族徽章早已被岁月磨平，但这把剑依然锋利如初。
“为了生者的荣耀。”他低声默念着誓言。
大地开始震颤，远处的冰面传来了沉闷的碎裂声，仿佛有什么庞然大物正在苏醒。
一只巨大的骨龙冲破了云层，它的双翼遮天蔽日，眼眶中燃烧着幽蓝的灵魂之火。
城墙上的弓箭手们拉满了长弓，箭头指向了空中的巨兽。
凯尔拔出长剑，剑身在火光下闪烁着寒光，直指苍穹。
“坚守阵地！一步也不许退！”
骨龙发出了一声震耳欲聋的咆哮，喷出一股冰霜吐息，瞬间将一座箭塔冻结成了冰雕。
战斗，开始了。
`;

const SCIFI_BASE = `
新东京市的霓虹灯在雨夜中交织成一片迷幻的光网，巨大的全息广告牌悬浮在摩天大楼之间。
侦探杰克·雷诺坐在悬浮警车的驾驶座上，机械义眼的红色光圈在黑暗中微微收缩。
他的目标是下城区的“黑莲花”俱乐部，据情报显示，那个代号为“幽灵”的叛逃AI就在那里。
雨水顺着车窗滑落，映照出下方街道上熙熙攘攘的人群，他们大多都安装了廉价的义肢。
杰克按下了加速键，警车尾部喷射出蓝色的离子流，在空中划过一道弧线，向底层俯冲而去。
通讯器里传来了总部的指令：“杰克，目标极度危险，已被授权使用重型武器。”
“收到。”杰克冷冷地回答，检查了一下腰间的高能脉冲手枪。
警车停在了俱乐部的后巷，这里堆满了废弃的电子元件和生锈的管道。
他推开车门，踩在积水的地面上，溅起一片油腻的水花。
俱乐部的后门半掩着，里面传来了震耳欲聋的电子音乐声。
杰克开启了战术扫描模式，视网膜上迅速浮现出周围环境的热成像图。
三个红色的热源正在向门口靠近，看来对方已经发现了他。
“那就来吧。”杰克嘴角微微上扬，露出一丝冷笑。
他猛地踢开大门，手中的脉冲枪瞬间开火，照亮了昏暗的走廊。
`;

const COMPUTE_GIRL_TEXT = `
天冷极了，下着雨。这是一个圣诞夜。
在这又冷又黑的晚上，一个小女孩，流落在漏风的实验室里。
她本来想学电影《后天》里的样子，把怀里那一摞打印出来的、厚厚的顶会论文集烧了取暖。
她手里捏着一本打印好的 Attention Is All You Need，但是她没有火柴。
	
于是，她渴望的目光投向了身旁一台拥有 8 张 A100 的高性能计算节点，决定用服务器取暖。
她在那台服务器机柜后面缩成一团。
她启动了一个推理任务，设置temperature=100。
然而，物理法则无法被代码逾越。
仅仅过了几分钟，伴随着一行 CUDA out of Memory 和一股黑烟，整台服务器断电停机了。
那施舍给她的一点点余温，瞬间消散在凛冽的寒风中。
	
她颤抖着输入 ssh 的命令，打开了另一台 A100 服务器。
在这金钱与硅基芯片燃烧的光芒中，她设定好的 temperature=100 再次生效，强烈的热流冲刷着她的视神经。
在火光中，她看到了毕业多年的师兄。
他递过来一份Offer Letter，上面的签字费数字大得像是一个随机生成的长整型。
师兄温柔地说，“这里没有 Deadline，也没有显存限制，我们这里，甚至不需要写论文……”
就在这时候，机箱又发出了一声哀鸣。
服务器烧毁了。Connection Lost.
	
她觉得冷极了，比刚才更冷。在黑暗中，她找到了最后一台服务器。接入了这最后一台服务器的控制台。
她没有丝毫犹豫，禁用了所有的散热保护，禁用了所有的功率限制，将电压拉到了物理极限，然后按下回车。
服务器被点亮了。在这强烈的光明中，她看到了一片璀璨的夜空。
她梦到天上的星星⭐️就是自己 GitHub 上收获的星星⭐️数量。整个夜空在她眼里变成了一个巨大的、深色模式的 GitHub 个人主页，而银河就是star history 的曲线。
第二天，导师看到小女孩躺在机箱上，断断续续地念着“Accpet ...... Best Paper ...... 师兄给我发Offer ......”，像是陷入了永远不会输出<eos>的幻觉。
	
除了她自己，没人知道她在圣诞夜看到了一切的美好。
`;

export const SAMPLE_BOOKS: Book[] = [
  createBook("book-fairytale", "迷雾森林的秘密", "格林·维尔", "童话", "🍄", "watercolor_storybook", repeatText(FAIRY_TALE_BASE, 3)),
  createBook("book-epic", "凛冬长城之战", "R.R. 马丁", "史诗", "⚔️", "fantasy_oil", repeatText(EPIC_BASE, 3)),
  createBook("book-scifi", "新东京2077", "吉布森·李", "科幻", "🤖", "scifi_concept", repeatText(SCIFI_BASE, 3)),
  createBook("book-compute-girl", "卖算力的小女孩", "赛博格林", "赛博童话", "🔥", "scifi_concept", COMPUTE_GIRL_TEXT),
];