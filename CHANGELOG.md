# LangFlow 更新日志

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
