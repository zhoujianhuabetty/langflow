# LangFlow

> 一个极简的语言学习平台，支持每日翻译练习和 AI 日记润色。
> A minimalist language learning platform with daily translation practice and AI diary polishing.

## 功能特性

- **每日翻译练习** — 中译英 / 中译日，AI 实时评分反馈
- **AI 日记润色** — 写外语日记，AI 纠错并给出高级表达
- **生词本** — 自动收集 AI 推荐词汇，支持发音朗读
- **历史日历** — 按日期查看翻译和日记的历史记录
- **学习统计** — 可视化图表展示学习进度和趋势
- **Google 登录** — Firebase Auth 支持跨设备数据同步
- **深色模式** — 自动跟随系统主题

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + TypeScript + Tailwind CSS 4 |
| 构建 | Vite 6 |
| 后端 | Express (API 代理) |
| AI | 智谱 GLM (glm-4-flash / glm-5) |
| 认证 | Firebase Authentication |
| 图表 | Recharts |
| 动画 | Motion |

## 快速开始

### 环境要求

- Node.js >= 18

### 安装与运行

```bash
# 1. 克隆项目
git clone https://github.com/YOUR_USERNAME/langflow.git
cd langflow

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local，填入你的智谱 GLM API Key

# 4. 启动开发服务器（前端 + 后端）
npm run dev        # 前端: http://localhost:3000
npm run server     # 后端: http://localhost:3001 (新终端)
```

> 没有 API Key 也能运行，会使用内置句子，AI 评分功能不可用。

### 获取 GLM API Key

1. 访问 [智谱AI开放平台](https://open.bigmodel.cn/usercenter/apikeys)
2. 注册并创建 API Key
3. 填入 `.env.local` 的 `GLM_API_KEY` 字段
4. 可选：修改 `GLM_MODEL` 切换模型（`glm-4-flash` 免费额度大，`glm-5` 效果最好）

## 项目结构

```
langflow/
├── server.js                # Express 后端 (智谱 GLM API 代理 + 降级处理)
├── src/
│   ├── App.tsx              # 主应用组件
│   ├── components/          # React 组件
│   │   ├── TranslationPractice.tsx  # 翻译练习
│   │   ├── DiaryMode.tsx            # 日记润色
│   │   ├── VocabularyList.tsx       # 生词本
│   │   ├── HistoryCalendar.tsx      # 历史日历
│   │   └── Stats.tsx                # 学习统计
│   ├── lib/
│   │   ├── gemini.ts        # AI 接口封装
│   │   ├── storage.ts       # 本地存储管理
│   │   └── firebase.ts      # Firebase 配置
│   └── index.css            # 全局样式
├── .env.example             # 环境变量模板
├── vite.config.ts           # Vite 配置 (含 API 代理)
└── package.json
```

## 部署

### Vercel / Netlify (仅前端)

需要单独部署后端，或改用 Serverless Functions 包装 `server.js` 的路由。

### VPS / Docker

```bash
npm run build           # 构建前端
node server.js          # 启动后端 (同时服务静态文件)
```

## 开发日志

详见 [CHANGELOG.md](CHANGELOG.md)

## License

MIT
