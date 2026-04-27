# LangFlow 更新日志

## [1.4.0] - 2026-04-26

### Bug Fixes
- **修复移动端数据无法保存**: `crypto.randomUUID()` 在 HTTP 环境的移动端不可用，改为兼容写法 (`src/lib/storage.ts`)

### UI/UX
- **移动端底部导航栏**: 手机端功能菜单移至底部固定栏，适配刘海屏安全区域 (`src/App.tsx`)
- **词汇积累移动端优化**: 布局改为上下堆叠、待学词汇可折叠（默认展开）、翻页显示（移动端6个/页，桌面端9个/页）、卡片尺寸缩小双列显示 (`src/components/VocabularyList.tsx`)
- **favicon 颜色统一**: 浏览器标签页 logo 从紫色改为品牌绿色 (`public/favicon.svg`)

### Features
- **AI 日记 prompt 优化**: 润色结果优先口语化表达，不刻意堆砌复杂书面词汇 (`server.js` 3个润色接口)
- **AI 日记移除预置内容**: 刷新页面后日记输入区为空白，切换 tab 不受影响 (`src/components/DiaryPolishing.tsx`)

### Deployment
- **生产环境静态文件托管**: server.js 新增 Express 托管 dist 目录，单端口同时提供 API 和前端 (`server.js`)
- **首次部署上线**: 百度云轻量服务器 + PM2 + 安全组配置

---

## [1.3.0] - 2026-04-25

### Bug Fixes
- **翻译记录立即保存**: fast 结果返回后立即写入 localStorage，防止刷新页面丢失 (`src/components/TranslationPractice.tsx`)
- **弹跳句子去重**: 修复句子减少时出现重复显示的问题，动态切换布局（≤5 静态浮动，≥6 滚动lanes）(`src/components/BouncingSentences.tsx`)

### UI/UX
- **词汇积累已掌握功能**: 每个词卡增加"已掌握"按钮，左侧折叠栏展示已掌握词汇 (`src/components/VocabularyList.tsx`)
- **统一语言选择**: 顶层语言切换控制所有模块（翻译、日记、历史、词汇），Stats 展示全部语言 (`src/App.tsx`)
- **历史记录按语言筛选**: 日历活动点和记录列表按当前语言过滤 (`src/components/HistoryCalendar.tsx`)

### Features
- **AI 翻译 prompt 优化**: 优先口语化表达，同时在 feedback 末尾提供正式场合表达供参考 (`server.js` 3个反馈接口)
- **词汇 language 字段**: 新增词汇自动标记语言，支持英日分类 (`src/lib/storage.ts`)

---

## [1.2.0] - 2026-04-20

### AI 模型切换
- **server.js**: 从 Google Gemini 切换到智谱 GLM（OpenAI 兼容格式）
- 支持通过 `.env.local` 配置 `GLM_API_KEY`、`GLM_MODEL`、`GLM_BASE_URL`
- 默认模型 `glm-4-flash`（免费额度大），可切换 `glm-5`（效果最好）
- 移除 `@google/genai` 依赖，改用原生 `fetch` 调用，零外部 AI SDK 依赖

## [1.1.0] - 2026-04-20

### 安全加固
- **server.js**: API Key 不再暴露到前端，所有 AI 调用通过后端代理
- **server.js**: 添加 `sanitizeInput()` 防御 prompt 注入（去除代码围栏、限制 5000 字符）
- **server.js**: 所有端点添加语言枚举校验和难度级别验证

### 架构优化
- **firebase.ts**: Firebase 未配置时不再崩溃，自动降级为演示模式（`firebaseEnabled` 标志）
- **server.js**: 无 GLM API Key 时优雅降级，返回内置句子和提示信息
- **App.tsx / AuthModal.tsx**: 兼容 Firebase 未配置场景，`auth` 为 `null` 时安全跳过

### 性能修复
- **HistoryCalendar.tsx**: `useMemo` 依赖项从 `selectedDate` 改为 `records`，避免不必要的全量重计算

### 类型安全
- 安装 `@types/react` + `@types/react-dom`
- 修复 `storage.ts`、`HistoryCalendar.tsx` 中的隐式 `any` 类型
- TypeScript strict 模式零错误通过

### 项目规范
- **README.md**: 重写为中文，包含功能介绍、技术栈、快速开始、项目结构、部署指南
- **.gitignore**: 扩展覆盖 IDE、OS、日志等文件
- **.env.example**: 更新为中文注释，标注各字段用途
- **package.json**: 名称改为 `langflow`，版本 `1.0.0`

## [1.0.0] - 2026-04-15

### 初始版本
- React 19 + TypeScript + Vite 6 + Tailwind CSS 4
- 每日翻译练习（中译英/中译日）
- AI 日记润色（语法纠错 + 高级表达）
- 生词本自动收集
- 历史日历查看
- 学习统计图表
- Google 登录（Firebase Auth）
- 深色模式（跟随系统）
