# 智绘阅读

智绘阅读是一套面向小说、寓言、神话与科普文本的本地优先型 AI 阅读配图系统。它把 `书架导入`、`阅读器生图`、`世界观资产库`、`角色关系网`、`AI 伴读聊天`、`本地图片归档` 和 `图文导出` 整合在同一个 React 单页应用里。

当前版本已经不再是单纯“段落文生图”的演示工具，而是一个能持续沉淀角色设定、关系结构和本地图片资产的完整原型。

![阅读器界面](./docs/assets/ui-reader.png)

## 当前版本能力

- 导入 `.txt` 文本，自动创建书籍
- 上传封面或使用 AI 生成书籍封面
- 阅读器按段落触发生图，支持重生成、删除、本张额外要求
- 扫描章节，自动发现角色、地点与关系
- 自动为缺失角色/地点生成形象设定图
- 书中插图支持单段并行生成与批量分批并发生成
- 世界观页支持角色/地点重生成、删除与状态追踪
- 关系页支持：
  - 手工维护关系
  - 按阅读进度自动生成角色关系图
  - AI 伴读聊天
  - 扮演书中角色聊天
- 聊天记录按书籍持久化，角色模式限制在当前阅读进度之前
- 图片生成后自动保存到本地 `pic_db/`
- 应用状态与图片记录持久化到 IndexedDB
- 导出图文 HTML，并通过浏览器打印导出 PDF

## 真实技术栈

- `React 19`
- `TypeScript 5`
- `Vite 6`
- `lucide-react`
- 浏览器 `IndexedDB`
- 仓库本地图片目录 `pic_db/`

AI 服务当前直接接入火山方舟：

- 文本分析：`deepseek-v3-2-251201`
- 图片生成：
  - `doubao-seedream-4-5-251128`
  - `doubao-seedream-5-0-260128`
- 关系生成与 AI 聊天：`doubao-seed-2-0-pro-260215`

## 当前界面结构

- `书架`
  - 导入书籍
  - 上传封面 / AI 生成封面
  - 删除书籍
- `阅读器`
  - 单段生图
  - 批量生图
  - 扫描设定
  - 风格与模型切换
  - 导出
- `世界观`
  - 角色卡
  - 地点卡
  - 生成状态反馈
- `关系网`
  - 关系图
  - AI 按阅读进度生成关系
  - AI 对话
- `设置`
  - 图片模型切换
  - 自定义风格管理

![世界观界面](./docs/assets/ui-assets.png)

## 本地数据与图片存储

当前版本采用双持久化：

1. `IndexedDB`
   - 存储书籍、角色、地点、关系、插图状态、聊天记录、图片记录
2. `pic_db/`
   - 存储真正的图片文件
   - 目录按“书籍 / 类型 / 子类型”组织

示例目录：

```text
pic_db/
├── 小红帽/
│   ├── covers/books/封面.jpg
│   ├── assets/characters/小红帽.jpg
│   ├── assets/characters/狼.jpg
│   ├── assets/locations/森林.jpg
│   └── illustrations/paragraphs/第一章-第13段.jpg
├── 狼来了/
│   ├── assets/characters/放羊娃.jpg
│   ├── assets/locations/山坡牧场.jpg
│   └── illustrations/paragraphs/第一章-第4段.jpg
└── 西游记 三打白骨精/
    ├── assets/characters/孙悟空.jpg
    └── illustrations/paragraphs/第一章-第5段.jpg
```

## 典型生成效果

### 小红帽角色设定

![小红帽角色设定](./pic_db/小红帽/assets/characters/小红帽.jpg)
![狼角色设定](./pic_db/小红帽/assets/characters/狼.jpg)

### 狼来了段落插图

![狼来了插图](./pic_db/狼来了/illustrations/paragraphs/第一章-第4段.jpg)

### 三打白骨精段落插图

![三打白骨精插图](./pic_db/西游记 三打白骨精/illustrations/paragraphs/第一章-第5段.jpg)

## 项目结构

```text
zhihui-reading/
├── App.tsx
├── index.tsx
├── constants.ts
├── types.ts
├── components/
│   ├── BookShelf.tsx
│   ├── Reader.tsx
│   ├── AssetLibrary.tsx
│   ├── SocialNetwork.tsx
│   ├── BatchActionsModal.tsx
│   └── Layout.tsx
├── services/
│   ├── aiService.ts
│   ├── storageService.ts
│   ├── localImageService.ts
│   └── exportService.ts
├── docs/
├── pics/
├── pic_db/
└── vite.config.ts
```

## 启动方式

安装依赖：

```bash
npm install
```

配置本地环境变量：

```bash
cp .env.example .env.local
```

然后把 `.env.local` 里的 `VITE_ARK_API_KEY` 改成你自己的火山方舟 key。该文件已加入 `.gitignore`，不会被推到 GitHub。

启动开发环境：

```bash
npm run dev
```

构建：

```bash
npm run build
```

预览：

```bash
npm run preview
```

## 当前版本的关键实现点

### 1. 阅读器任务引擎

`Reader.tsx` 已把单段生图与批量生图统一到同一套任务流程：

- 叙事分析
- 缺失角色检测
- 自动补资产
- 正式出图
- 回写状态

批量模式采用“按顺序分批，每批最多并发 3 张”的策略。

### 2. 关系页 AI 化

`SocialNetwork.tsx` 不再只是静态关系图页面，已经具备：

- AI 阅读至当前已生图章节并生成关系图
- AI 伴读聊天
- 按角色身份聊天
- 聊天记录按书持久化

### 3. 本地图片归档

图片不再只保存临时 URL，而是会自动写入仓库 `pic_db/`。  
现在的命名规则已经规范化：

- 资产图：`资产名.jpg`
- 书籍封面：`封面.jpg`
- 段落插图：`章节名-第N段.jpg`

## 当前限制

- 仍然是前端直连模型接口，不适合公网生产
- 当前“书籍导入”仍是轻量结构，没有复杂目录层级
- 关系页 AI 聊天仍属于提示词约束方案，不是强约束知识库
- PDF 导出依赖浏览器打印，不是排版引擎生成
- 本地图片存储依赖当前桌面开发环境，不可直接等价迁移到移动端

## 文档目录

- [软件简介](./docs/INTRODUCTION.md)
- [项目计划书](./docs/PROJECT_PLAN.md)
- [开发文档](./docs/开发文档.md)
- [测试文档](./docs/测试文档.md)
- [设计及创新性分析报告](./docs/设计及创新性分析报告.md)
- [技术研究报告](./docs/技术研究报告.md)
- [调用方法](./docs/调用方法.md)
- [git 详细更新信息](./docs/git详细更新信息.md)

## 说明

这份 README 以当前仓库实际实现为准。当前版本重点已经从“基础生图验证”转向“本地优先的阅读工作流、世界观沉淀与关系页 AI 交互”。
