const fs = require("fs");
const path = require("path");
const PptxGenJS = require("pptxgenjs");

const root = "/Users/wangzixing/Desktop/各种软件集合/智绘阅读/zhihui-reading";
const outDir = path.join(root, "output", "ppt");
const assetsDir = path.join(outDir, "assets");
const pptxPath = path.join(outDir, "智绘阅读-计算机设计大赛汇报.pptx");
const promptPath = path.join(outDir, "智绘阅读-比赛汇报-每页生图提示词.md");

const img = (...parts) => path.join(root, ...parts);
const localAsset = (...parts) => path.join(assetsDir, ...parts);

const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "OpenAI Codex";
pptx.company = "Colawz";
pptx.subject = "智绘阅读项目比赛汇报";
pptx.title = "智绘阅读 - 计算机设计大赛汇报";
pptx.lang = "zh-CN";
pptx.theme = {
  headFontFace: "Microsoft YaHei",
  bodyFontFace: "Microsoft YaHei",
  lang: "zh-CN",
};

const colors = {
  navy: "17324D",
  blue: "2E6FD8",
  cyan: "4BB8E6",
  sky: "EAF4FF",
  mint: "EAF9F2",
  gold: "F2B94B",
  ink: "1F2A37",
  slate: "61758A",
  light: "F6F8FB",
  white: "FFFFFF",
  border: "DCE6F2",
  dark: "0F172A",
  red: "E65B63",
};

function coverImage(slide, x, y, w, h, file, radius = 0.18) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h,
    rectRadius: radius,
    line: { color: colors.white, transparency: 100 },
    fill: { color: colors.white, transparency: 100 },
    shadow: { type: "outer", color: "AAB8CC", blur: 2, angle: 45, distance: 2, opacity: 0.12 }
  });
  slide.addImage({ path: file, x, y, w, h });
}

function addTitle(slide, title, subtitle) {
  slide.addText(title, {
    x: 0.7, y: 0.45, w: 8.7, h: 0.42,
    fontFace: "Microsoft YaHei",
    fontSize: 26,
    bold: true,
    color: colors.ink,
    margin: 0,
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.72, y: 0.88, w: 8.7, h: 0.24,
      fontFace: "Microsoft YaHei",
      fontSize: 10.5,
      color: colors.slate,
      margin: 0,
    });
  }
}

function addBulletList(slide, items, x, y, w, h, options = {}) {
  const runs = [];
  items.forEach((item) => {
    runs.push({
      text: item,
      options: {
        bullet: { indent: 14 },
        hanging: 2,
        breakLine: true,
      },
    });
  });
  slide.addText(runs, {
    x, y, w, h,
    fontFace: "Microsoft YaHei",
    fontSize: options.fontSize || 16,
    color: options.color || colors.ink,
    valign: "top",
    margin: 0.04,
    paraSpaceAfterPt: options.paraSpaceAfterPt || 10,
    breakLine: false,
  });
}

function addStatCard(slide, x, y, w, h, value, label, fill) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h,
    rectRadius: 0.16,
    line: { color: fill, transparency: 100 },
    fill: { color: fill },
  });
  slide.addText(String(value), {
    x: x + 0.12, y: y + 0.12, w: w - 0.24, h: 0.34,
    fontSize: 22, bold: true, color: colors.navy, margin: 0,
    align: "center",
  });
  slide.addText(label, {
    x: x + 0.12, y: y + 0.56, w: w - 0.24, h: 0.24,
    fontSize: 10, color: colors.slate, margin: 0,
    align: "center",
  });
}

const prompts = [
  {
    page: 1,
    title: "封面页主视觉",
    prompt: "为“智绘阅读”生成一张计算机设计大赛风格的产品封面主视觉：一位中国儿童读者在明亮的数字阅读工作台前阅读童话，屏幕中同时出现书架、角色设定卡、段落插图、关系图谱与AI伴读气泡，画面强调“文本阅读 + AI生图 + 世界观构建”的融合，科技感但温暖、教育与创作兼具、蓝白主色、干净高端、适合PPT封面、16:9横版。"
  },
  {
    page: 2,
    title: "问题背景页配图",
    prompt: "生成一张信息图风格插画，表达传统电子阅读“只有文字、缺少画面感、人物关系难理解、图片难长期保存”的痛点：左侧是单调纯文本阅读，右侧是带插图、角色和关系的智能阅读界面，对比强烈，现代UI插画风，蓝灰和暖橙点缀，适合比赛答辩PPT。"
  },
  {
    page: 3,
    title: "产品定位页配图",
    prompt: "生成一张产品定位主图，展示“智绘阅读”是连接阅读、世界观构建、关系理解与AI对话的本地优先型系统：中心为阅读器，四周延展出书架、角色卡、地点卡、关系图、AI聊天、图片存档模块，信息可视化、科技感、学术竞赛风、清晰专业、16:9。"
  },
  {
    page: 4,
    title: "阅读工作台页配图",
    prompt: "生成一张高级UI展示图：三栏式AI阅读工作台，左侧书架，中间正文与段落插图，右侧角色设定与AI伴读对话，整体像成熟桌面应用，留白充分，蓝白灰配色，儿童文学气质，产品设计比赛风格，16:9横版。"
  },
  {
    page: 5,
    title: "导入与封面生成页配图",
    prompt: "生成一张界面概念图，展示导入TXT书籍后自动创建作品并支持AI生成封面：左侧为导入弹窗与封面生成按钮，右侧是完成后的书架封面墙，风格轻盈、现代、教育科技产品视觉，16:9横版。"
  },
  {
    page: 6,
    title: "段落生图页配图",
    prompt: "生成一张叙事型产品展示图：AI根据童话段落实时生成插图，文字段落与画面一一对应，主角小红帽与狼在森林中相遇，底部浮现“场景、情绪、关键词、风格”的提示，强调阅读中即时生图体验，唯美童话插画风。"
  },
  {
    page: 7,
    title: "世界观资产库页配图",
    prompt: "生成一张视觉世界观资产库展示图：界面中整齐排列角色设定卡与地点设定卡，包括小红帽、狼、奶奶、猎人、森林、奶奶家等，每张卡带图像、名称和设定摘要，像专业角色设定管理工具，浅色科技产品UI风。"
  },
  {
    page: 8,
    title: "关系与AI伴读页配图",
    prompt: "生成一张角色关系与AI伴读结合的产品图：上方是角色之间的关系连线图，下方是AI伴读和角色扮演聊天界面，能够解释剧情、人物动机和关系变化，现代教育产品感、清晰可视、适合比赛汇报。"
  },
  {
    page: 9,
    title: "本地存储与架构页配图",
    prompt: "生成一张专业系统架构信息图，展示AI阅读配图系统的本地优先存储结构：左侧为阅读器和AI模型，右侧为IndexedDB与pic_db双存储，箭头表示图片生成、保存、索引恢复与桌面版状态迁移，白底、蓝灰技术图风、论文级清晰度。"
  },
  {
    page: 10,
    title: "创新点总结页配图",
    prompt: "生成一张比赛总结页主视觉：把阅读、生图、设定、关系、聊天、本地存储六个能力以六边形或放射式结构统一到一个中心品牌“智绘阅读”，视觉简洁有力，体现创新整合与完整产品闭环，适合答辩收尾。"
  }
];

// Slide 1: Cover
{
  const slide = pptx.addSlide();
  slide.background = { color: colors.light };
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: "F8FBFF" }, line: { color: "F8FBFF" } });
  slide.addShape(pptx.ShapeType.arc, { x: -1.3, y: -1.0, w: 5.6, h: 3.6, line: { color: colors.sky, transparency: 100 }, fill: { color: "DFF2FF", transparency: 20 } });
  slide.addShape(pptx.ShapeType.arc, { x: 9.9, y: 5.4, w: 4.6, h: 2.8, line: { color: colors.sky, transparency: 100 }, fill: { color: "DDF8F2", transparency: 10 } });
  slide.addText("智绘阅读", { x: 0.75, y: 0.72, w: 3.2, h: 0.55, fontSize: 28, bold: true, color: colors.navy, margin: 0 });
  slide.addText("面向文本阅读场景的本地优先型 AI 阅读配图系统", { x: 0.78, y: 1.32, w: 4.9, h: 0.3, fontSize: 12.5, color: colors.slate, margin: 0 });
  slide.addText("计算机设计大赛项目汇报", { x: 0.78, y: 1.78, w: 3.0, h: 0.28, fontSize: 13, bold: true, color: colors.blue, margin: 0 });
  slide.addText("关键词：阅读工作台｜AI 生图｜世界观资产库｜关系图谱｜AI 伴读｜本地存储", {
    x: 0.78, y: 2.18, w: 5.2, h: 0.5, fontSize: 10.5, color: colors.slate, margin: 0
  });
  coverImage(slide, 6.15, 0.55, 6.5, 3.7, img("docs", "assets", "ui-reader.png"), 0.22);
  coverImage(slide, 6.2, 4.45, 1.9, 2.25, img("pic_db", "小红帽", "assets", "characters", "小红帽.jpg"));
  coverImage(slide, 8.2, 4.45, 1.9, 2.25, img("pic_db", "小红帽", "illustrations", "paragraphs", "第一章-第13段.jpg"));
  coverImage(slide, 10.2, 4.45, 1.9, 2.25, img("pic_db", "狼来了", "illustrations", "paragraphs", "第一章-第4段.jpg"));
  coverImage(slide, 12.2, 4.45, 0.9, 2.25, img("pic_db", "寓言 龟兔赛跑", "assets", "characters", "兔子.jpg"));
  slide.addText("将阅读、设定、关系、对话与图片归档整合为一个完整工作流", {
    x: 0.78, y: 6.52, w: 5.3, h: 0.35, fontSize: 15, color: colors.ink, bold: true, margin: 0
  });
  slide.addText("项目特色：边阅读、边生图、边沉淀世界观，最终形成可持续积累的阅读创作资产。", {
    x: 0.78, y: 6.95, w: 6.1, h: 0.28, fontSize: 10.5, color: colors.slate, margin: 0
  });
}

// Slide 2: Background
{
  const slide = pptx.addSlide();
  slide.background = { color: colors.white };
  addTitle(slide, "一、项目背景与问题痛点", "为什么我们需要“会读书、会生图、会构建世界观”的阅读系统");
  slide.addShape(pptx.ShapeType.roundRect, { x: 0.72, y: 1.35, w: 5.1, h: 4.95, rectRadius: 0.16, fill: { color: "FFF6F6" }, line: { color: "F6D7D9" } });
  slide.addText("传统阅读产品的局限", { x: 1.0, y: 1.65, w: 2.2, h: 0.28, fontSize: 18, bold: true, color: colors.red, margin: 0 });
  addBulletList(slide, [
    "电子书通常只有文字，缺少即时画面感与角色可视化。",
    "通用 AI 生图工具无法天然理解长文本的叙事连续性。",
    "角色关系、地点设定与正文阅读割裂，用户需要来回切换工具。",
    "生成图片常停留在临时 URL 阶段，难以长期管理与复用。"
  ], 0.98, 2.1, 4.4, 3.8, { fontSize: 16 });
  slide.addShape(pptx.ShapeType.roundRect, { x: 6.1, y: 1.35, w: 6.5, h: 4.95, rectRadius: 0.16, fill: { color: colors.sky }, line: { color: colors.border } });
  coverImage(slide, 6.45, 1.75, 3.0, 4.1, img("docs", "assets", "ui-bookshelf.png"));
  coverImage(slide, 9.72, 1.75, 2.45, 1.85, img("pic_db", "小红帽", "illustrations", "paragraphs", "第一章-第13段.jpg"));
  coverImage(slide, 9.72, 3.86, 2.45, 1.85, img("pic_db", "狼来了", "illustrations", "paragraphs", "第一章-第4段.jpg"));
  slide.addText("我们的机会：把阅读器、世界观、关系图与 AI 对话统一成一条产品链路。", {
    x: 6.42, y: 6.38, w: 5.6, h: 0.35, fontSize: 15, bold: true, color: colors.blue, margin: 0
  });
}

// Slide 3: Product positioning
{
  const slide = pptx.addSlide();
  slide.background = { color: colors.light };
  addTitle(slide, "二、项目定位与核心价值", "“智绘阅读”不是单次生图工具，而是一套本地优先的阅读创作系统");
  addStatCard(slide, 0.82, 1.45, 1.6, 0.95, 5, "当前内置/导入书籍", "E6F1FF");
  addStatCard(slide, 2.58, 1.45, 1.6, 0.95, 17, "角色资产", "E9F8EE");
  addStatCard(slide, 4.34, 1.45, 1.6, 0.95, 24, "关系记录", "FFF4DD");
  addStatCard(slide, 6.10, 1.45, 1.6, 0.95, 25, "段落插图", "FDECEF");
  slide.addShape(pptx.ShapeType.roundRect, { x: 0.82, y: 2.75, w: 7.0, h: 3.95, rectRadius: 0.16, fill: { color: colors.white }, line: { color: colors.border } });
  slide.addText("产品定位", { x: 1.05, y: 3.02, w: 1.2, h: 0.25, fontSize: 18, bold: true, color: colors.navy, margin: 0 });
  addBulletList(slide, [
    "面向小说、寓言、神话、科普等文本阅读场景。",
    "在“阅读中”完成生图、设定沉淀、关系理解与AI伴读。",
    "以本地图片库 + IndexedDB 的方式，保证长期可展示与可迁移。",
    "适合比赛展示、课堂教学、创作验证和个人作品集构建。"
  ], 1.0, 3.42, 6.45, 2.8, { fontSize: 16 });
  coverImage(slide, 8.18, 1.45, 4.45, 5.25, img("docs", "assets", "ui-reader.png"));
}

// Slide 4: Reader workspace
{
  const slide = pptx.addSlide();
  slide.background = { color: colors.white };
  addTitle(slide, "三、阅读工作台设计", "三栏结构把书架、正文与智能辅助放到同一工作面中");
  coverImage(slide, 0.78, 1.3, 9.2, 5.7, img("docs", "assets", "ui-reader.png"), 0.22);
  slide.addShape(pptx.ShapeType.roundRect, { x: 10.15, y: 1.4, w: 2.45, h: 1.1, rectRadius: 0.12, fill: { color: colors.sky }, line: { color: colors.border } });
  slide.addText("左侧\n书架切换", { x: 10.45, y: 1.65, w: 1.9, h: 0.58, fontSize: 18, align: "center", bold: true, color: colors.navy, margin: 0 });
  slide.addShape(pptx.ShapeType.roundRect, { x: 10.15, y: 2.75, w: 2.45, h: 1.35, rectRadius: 0.12, fill: { color: "F4FBF7" }, line: { color: colors.border } });
  slide.addText("中间\n正文阅读 + 段落生图", { x: 10.35, y: 3.05, w: 2.05, h: 0.7, fontSize: 17, align: "center", bold: true, color: colors.navy, margin: 0 });
  slide.addShape(pptx.ShapeType.roundRect, { x: 10.15, y: 4.35, w: 2.45, h: 1.55, rectRadius: 0.12, fill: { color: "FFF8EA" }, line: { color: colors.border } });
  slide.addText("右侧\n角色设定 + AI伴读", { x: 10.35, y: 4.78, w: 2.0, h: 0.52, fontSize: 17, align: "center", bold: true, color: colors.navy, margin: 0 });
  slide.addText("设计亮点：不离开阅读场景，就能完成扫描设定、单段生图、批量生图、风格切换与对话解释。", {
    x: 0.92, y: 7.02, w: 11.3, h: 0.22, fontSize: 10.8, color: colors.slate, margin: 0
  });
}

// Slide 5: Import and cover generation
{
  const slide = pptx.addSlide();
  slide.background = { color: colors.light };
  addTitle(slide, "四、导入书籍与封面生成", "支持 TXT 导入、封面上传与 AI 自动封面生成");
  coverImage(slide, 0.82, 1.42, 5.9, 4.7, img("docs", "assets", "ui-bookshelf.png"));
  coverImage(slide, 7.12, 1.42, 2.0, 2.35, img("pic_db", "小红帽", "covers", "books", "封面.jpg"));
  coverImage(slide, 9.35, 1.42, 2.0, 2.35, img("pic_db", "狼来了", "covers", "books", "封面.jpg"));
  coverImage(slide, 11.58, 1.42, 1.0, 2.35, img("pic_db", "小红帽", "assets", "characters", "小红帽.jpg"));
  slide.addShape(pptx.ShapeType.roundRect, { x: 7.05, y: 4.05, w: 5.55, h: 2.08, rectRadius: 0.14, fill: { color: colors.white }, line: { color: colors.border } });
  addBulletList(slide, [
    "导入 `.txt` 文本后自动创建书籍、章节与段落结构。",
    "支持上传封面，也支持调用图片模型生成书籍封面。",
    "封面会落到 `pic_db/<书名>/covers/books/封面.jpg`，便于桌面版同步。"
  ], 7.28, 4.3, 5.0, 1.5, { fontSize: 14.5, paraSpaceAfterPt: 7 });
}

// Slide 6: Paragraph generation
{
  const slide = pptx.addSlide();
  slide.background = { color: colors.white };
  addTitle(slide, "五、段落生图与阅读体验", "让插图在阅读过程中自然出现，而不是脱离正文单独生成");
  coverImage(slide, 0.8, 1.45, 4.0, 2.25, img("pic_db", "小红帽", "illustrations", "paragraphs", "第一章-第13段.jpg"));
  coverImage(slide, 0.8, 3.95, 4.0, 2.25, img("pic_db", "狼来了", "illustrations", "paragraphs", "第一章-第4段.jpg"));
  coverImage(slide, 5.12, 1.45, 4.0, 4.75, img("pic_db", "西游记 三打白骨精", "illustrations", "paragraphs", "第一章-第5段.jpg"));
  slide.addShape(pptx.ShapeType.roundRect, { x: 9.45, y: 1.45, w: 3.15, h: 4.75, rectRadius: 0.16, fill: { color: colors.sky }, line: { color: colors.border } });
  slide.addText("阅读器支持", { x: 9.75, y: 1.82, w: 1.7, h: 0.25, fontSize: 18, bold: true, color: colors.navy, margin: 0 });
  addBulletList(slide, [
    "单段手动生图",
    "本张额外要求",
    "重生成与删除",
    "批量分批并发生成",
    "缺失角色资产自动补齐",
    "生图结果实时回写并持久化"
  ], 9.68, 2.18, 2.55, 3.2, { fontSize: 15, paraSpaceAfterPt: 7 });
  slide.addText("核心价值：把“阅读中的想象”转化为“可持续积累的视觉结果”。", {
    x: 0.95, y: 6.95, w: 6.8, h: 0.24, fontSize: 11, color: colors.slate, margin: 0
  });
}

// Slide 7: Worldbuilding
{
  const slide = pptx.addSlide();
  slide.background = { color: colors.light };
  addTitle(slide, "六、世界观资产库", "角色与地点不再是中间结果，而是可复用的视觉资产");
  coverImage(slide, 0.82, 1.45, 4.25, 5.6, img("docs", "assets", "ui-assets.png"));
  coverImage(slide, 5.4, 1.45, 1.6, 1.95, img("pic_db", "小红帽", "assets", "characters", "小红帽.jpg"));
  coverImage(slide, 7.15, 1.45, 1.6, 1.95, img("pic_db", "小红帽", "assets", "characters", "狼.jpg"));
  coverImage(slide, 8.9, 1.45, 1.6, 1.95, img("pic_db", "小红帽", "assets", "characters", "奶奶.jpg"));
  coverImage(slide, 10.65, 1.45, 1.6, 1.95, img("pic_db", "小红帽", "assets", "characters", "猎人.jpg"));
  coverImage(slide, 5.4, 3.68, 1.6, 1.95, img("pic_db", "小红帽", "assets", "locations", "森林.jpg"));
  coverImage(slide, 7.15, 3.68, 1.6, 1.95, img("pic_db", "小红帽", "assets", "locations", "奶奶家.jpg"));
  coverImage(slide, 8.9, 3.68, 1.6, 1.95, img("pic_db", "狼来了", "assets", "characters", "放羊娃.jpg"));
  coverImage(slide, 10.65, 3.68, 1.6, 1.95, img("pic_db", "狼来了", "assets", "characters", "狼.jpg"));
  slide.addText("系统可以扫描章节、发现新角色和新地点，并为其生成统一风格的设定图，供后续插图持续复用。", {
    x: 5.4, y: 6.2, w: 6.7, h: 0.45, fontSize: 14.5, color: colors.ink, margin: 0
  });
}

// Slide 8: Relations + companion
{
  const slide = pptx.addSlide();
  slide.background = { color: colors.white };
  addTitle(slide, "七、关系理解与 AI 伴读", "关系页不仅展示关系图，还能继续阅读、继续解释、继续对话");
  slide.addShape(pptx.ShapeType.roundRect, { x: 0.82, y: 1.45, w: 5.2, h: 5.55, rectRadius: 0.16, fill: { color: colors.sky }, line: { color: colors.border } });
  slide.addText("关系页能力", { x: 1.12, y: 1.78, w: 1.8, h: 0.26, fontSize: 18, bold: true, color: colors.navy, margin: 0 });
  addBulletList(slide, [
    "从书籍开头阅读到“已生图章节”为止，自动生成角色关系图。",
    "支持手工维护角色关系，补充描述与关系类型。",
    "AI 伴读可解释剧情、人物动机与关系变化。",
    "支持扮演书中角色进行聊天，并限制在当前阅读进度之前。"
  ], 1.08, 2.18, 4.4, 2.7, { fontSize: 15.5, paraSpaceAfterPt: 8 });
  coverImage(slide, 0.98, 4.95, 4.82, 1.62, localAsset("relationship-chat.png"));
  coverImage(slide, 6.38, 1.42, 2.0, 2.35, img("pic_db", "小红帽", "assets", "characters", "小红帽.jpg"));
  coverImage(slide, 8.62, 1.42, 2.0, 2.35, img("pic_db", "小红帽", "assets", "characters", "狼.jpg"));
  coverImage(slide, 10.86, 1.42, 1.5, 2.35, img("pic_db", "小红帽", "assets", "characters", "猎人.jpg"));
  coverImage(slide, 6.38, 4.1, 5.98, 2.47, img("docs", "assets", "ui-reader.png"));
}

// Slide 9: Architecture
{
  const slide = pptx.addSlide();
  slide.background = { color: colors.light };
  addTitle(slide, "八、本地优先架构与数据存储", "既保存应用状态，也保存真实图片文件，解决临时 URL 易失效的问题");
  coverImage(slide, 0.84, 1.42, 5.95, 2.35, localAsset("arch-overview.png"));
  coverImage(slide, 0.84, 4.02, 5.95, 2.35, localAsset("storage-sync.png"));
  slide.addShape(pptx.ShapeType.roundRect, { x: 7.08, y: 1.42, w: 5.45, h: 4.95, rectRadius: 0.16, fill: { color: colors.white }, line: { color: colors.border } });
  slide.addText("本地持久化方案", { x: 7.38, y: 1.76, w: 2.0, h: 0.26, fontSize: 18, bold: true, color: colors.navy, margin: 0 });
  addBulletList(slide, [
    "IndexedDB：存储书籍、角色、地点、关系、对话记录、插图状态等结构化信息。",
    "pic_db：存储封面、角色图、地点图、段落插图等真实文件。",
    "app_state_snapshot.json：用于将网页版完整状态迁移到桌面版。"
  ], 7.28, 2.15, 4.85, 2.2, { fontSize: 15, paraSpaceAfterPt: 8 });
  slide.addText("图片命名规则", { x: 7.38, y: 4.72, w: 1.6, h: 0.22, fontSize: 16, bold: true, color: colors.blue, margin: 0 });
  slide.addText("• 资产图：资产名.jpg\n• 段落插图：章节名-第N段.jpg\n• 封面：封面.jpg", {
    x: 7.45, y: 5.02, w: 3.1, h: 0.9, fontSize: 14.5, color: colors.ink, margin: 0.02
  });
}

// Slide 10: Tech stack
{
  const slide = pptx.addSlide();
  slide.background = { color: colors.white };
  addTitle(slide, "九、技术路线与工程实现", "前端单页应用 + 火山方舟模型 + 本地文件归档 + 桌面版迁移");
  slide.addShape(pptx.ShapeType.roundRect, { x: 0.82, y: 1.45, w: 3.9, h: 4.85, rectRadius: 0.16, fill: { color: colors.sky }, line: { color: colors.border } });
  slide.addText("核心技术栈", { x: 1.12, y: 1.78, w: 1.8, h: 0.24, fontSize: 18, bold: true, color: colors.navy, margin: 0 });
  addBulletList(slide, [
    "React 19 + TypeScript 5 + Vite 6",
    "lucide-react 组件图标体系",
    "IndexedDB 状态持久化",
    "Electron 桌面包装与状态快照同步"
  ], 1.08, 2.14, 3.25, 2.2, { fontSize: 15.2, paraSpaceAfterPt: 8 });
  slide.addShape(pptx.ShapeType.roundRect, { x: 5.02, y: 1.45, w: 3.75, h: 4.85, rectRadius: 0.16, fill: { color: "F4FBF7" }, line: { color: colors.border } });
  slide.addText("模型分工", { x: 5.3, y: 1.78, w: 1.5, h: 0.24, fontSize: 18, bold: true, color: colors.navy, margin: 0 });
  addBulletList(slide, [
    "文本分析：deepseek-v3-2-251201",
    "图片生成：doubao-seedream-4.5 / 5.0",
    "关系生成与对话：doubao-seed-2-0-pro-260215"
  ], 5.28, 2.14, 3.05, 2.0, { fontSize: 14.5, paraSpaceAfterPt: 10 });
  slide.addShape(pptx.ShapeType.roundRect, { x: 9.02, y: 1.45, w: 3.55, h: 4.85, rectRadius: 0.16, fill: { color: "FFF8EA" }, line: { color: colors.border } });
  slide.addText("工程特性", { x: 9.3, y: 1.78, w: 1.5, h: 0.24, fontSize: 18, bold: true, color: colors.navy, margin: 0 });
  addBulletList(slide, [
    "单段并行生图与批量分批并发",
    "缺失资产自动补齐",
    "本地图片索引与恢复",
    "支持 Word/PDF/HTML 文档导出"
  ], 9.26, 2.14, 2.95, 2.1, { fontSize: 14.8, paraSpaceAfterPt: 8 });
}

// Slide 11: Innovation and competition value
{
  const slide = pptx.addSlide();
  slide.background = { color: colors.light };
  addTitle(slide, "十、创新点与参赛价值", "项目的重点不是“能生图”，而是把阅读、理解与视觉沉淀真正组织成产品流程");
  slide.addShape(pptx.ShapeType.roundRect, { x: 0.84, y: 1.42, w: 12.0, h: 5.7, rectRadius: 0.18, fill: { color: colors.white }, line: { color: colors.border } });
  const ideas = [
    ["阅读即生图", "在正文阅读过程中完成单段与批量插图生成。"],
    ["生图即建模", "角色、地点与关系被沉淀为后续可复用的世界观资产。"],
    ["关系页继续阅读", "关系图不止展示，还能继续解释文本并进行角色对话。"],
    ["角色遵守阅读边界", "角色扮演聊天只知道当前进度之前的剧情，减少剧透。"],
    ["本地优先双持久化", "状态保存在 IndexedDB，图片保存在 pic_db，便于长期展示。"],
    ["桌面版可迁移", "通过快照把网页版完整状态导入桌面 demo，适合比赛提交。"]
  ];
  ideas.forEach(([title, desc], idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = 1.12 + col * 5.75;
    const y = 1.85 + row * 1.55;
    slide.addShape(pptx.ShapeType.roundRect, {
      x, y, w: 5.0, h: 1.15, rectRadius: 0.12,
      fill: { color: row % 2 === 0 ? colors.sky : "F7FBF8" },
      line: { color: colors.border }
    });
    slide.addText(title, { x: x + 0.18, y: y + 0.16, w: 1.8, h: 0.24, fontSize: 16, bold: true, color: colors.navy, margin: 0 });
    slide.addText(desc, { x: x + 0.18, y: y + 0.46, w: 4.56, h: 0.46, fontSize: 11.5, color: colors.slate, margin: 0 });
  });
  slide.addText("适合比赛展示的原因：界面完成度高、链路完整、视觉结果丰富、文档体系齐全、可直接演示网页与桌面版。", {
    x: 1.12, y: 6.58, w: 10.8, h: 0.28, fontSize: 12.5, color: colors.ink, bold: true, margin: 0
  });
}

// Slide 12: Closing
{
  const slide = pptx.addSlide();
  slide.background = { color: colors.navy };
  slide.addText("谢谢观看", { x: 0.95, y: 0.95, w: 3.2, h: 0.58, fontSize: 28, bold: true, color: colors.white, margin: 0 });
  slide.addText("智绘阅读：让阅读过程本身具备视觉生成、关系理解与本地沉淀能力", {
    x: 0.96, y: 1.62, w: 6.4, h: 0.32, fontSize: 13, color: "D8E7F7", margin: 0
  });
  coverImage(slide, 7.05, 0.9, 2.15, 2.55, img("pic_db", "小红帽", "assets", "characters", "小红帽.jpg"));
  coverImage(slide, 9.4, 0.9, 2.15, 2.55, img("pic_db", "狼来了", "illustrations", "paragraphs", "第一章-第4段.jpg"));
  coverImage(slide, 7.05, 3.78, 2.15, 2.55, img("pic_db", "寓言 龟兔赛跑", "illustrations", "paragraphs", "第一章-第13段.jpg"));
  coverImage(slide, 9.4, 3.78, 2.15, 2.55, img("pic_db", "西游记 三打白骨精", "illustrations", "paragraphs", "第一章-第5段.jpg"));
  slide.addText("演示建议：\n1. 先展示书架与阅读器工作台\n2. 再展示段落生图与角色设定库\n3. 最后展示关系页、AI伴读与本地图片归档", {
    x: 0.98, y: 3.35, w: 5.2, h: 1.25, fontSize: 15.5, color: colors.white, margin: 0.05
  });
  slide.addText("项目数据：5本书｜17个角色｜9个地点｜24条关系｜25张插图", {
    x: 0.98, y: 5.65, w: 4.8, h: 0.28, fontSize: 12.5, bold: true, color: "B7D7FF", margin: 0
  });
}

const promptText = [
  "# 智绘阅读比赛汇报 PPT 每页生图提示词",
  "",
  "以下提示词按 PPT 页码整理，可用于后续继续生成封面图、背景图或替换插图。",
  ""
].concat(
  prompts.flatMap(item => [
    `## 第${item.page}页｜${item.title}`,
    "",
    item.prompt,
    ""
  ])
).join("\n");

fs.writeFileSync(promptPath, promptText, "utf8");

pptx.writeFile({ fileName: pptxPath }).then(() => {
  console.log(`PPT written to: ${pptxPath}`);
  console.log(`Prompts written to: ${promptPath}`);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
