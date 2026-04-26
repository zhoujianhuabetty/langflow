import express from "express";
import { config } from "dotenv";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { createHash, randomUUID } from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

config({ path: ".env.local" });

const app = express();
app.use(express.json());

// ==================== Auth 配置 ====================
const JWT_SECRET = process.env.JWT_SECRET || "langflow_default_jwt_secret_2024";
const JWT_EXPIRES = "7d";
const DATA_DIR = "./data";
const USERS_FILE = `${DATA_DIR}/users.json`;

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

function loadUsers() {
  if (!existsSync(USERS_FILE)) return [];
  return JSON.parse(readFileSync(USERS_FILE, "utf-8"));
}

function saveUsers(users) {
  writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
}

function generateToken(user) {
  return jwt.sign(
    { uid: user.uid, email: user.email, displayName: user.displayName },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "未登录" });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "登录已过期，请重新登录" });
  }
}

// 注册
app.post("/api/auth/register", async (req, res) => {
  const { email, password, displayName } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "邮箱和密码不能为空" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "密码至少 6 位" });
  }

  const users = loadUsers();
  if (users.find((u) => u.email === email)) {
    return res.status(409).json({ error: "该邮箱已注册" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = {
    uid: randomUUID(),
    email,
    displayName: displayName || email.split("@")[0],
    password: hashedPassword,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  saveUsers(users);

  const token = generateToken(user);
  res.json({
    token,
    user: { uid: user.uid, email: user.email, displayName: user.displayName },
  });
});

// 登录
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "邮箱和密码不能为空" });
  }

  const users = loadUsers();
  const user = users.find((u) => u.email === email);
  if (!user) {
    return res.status(401).json({ error: "邮箱或密码错误" });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: "邮箱或密码错误" });
  }

  const token = generateToken(user);
  res.json({
    token,
    user: { uid: user.uid, email: user.email, displayName: user.displayName },
  });
});

// 获取当前用户信息
app.get("/api/auth/me", authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// ==================== 数据备份与恢复 ====================
const BACKUP_DIR = `${DATA_DIR}/backups`;
if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true });

function getUserBackupPath(uid) {
  return `${BACKUP_DIR}/${uid}.json`;
}

// 上传备份（登录用户自动同步）
app.post("/api/data/sync", authMiddleware, (req, res) => {
  const { translations, diaries, vocab, extractedVocab } = req.body;
  const backupPath = getUserBackupPath(req.user.uid);

  // 读取已有备份，合并数据（按 id 去重）
  let existing = { translations: [], diaries: [], vocab: [], extractedVocab: [] };
  if (existsSync(backupPath)) {
    try { existing = JSON.parse(readFileSync(backupPath, "utf-8")); } catch {}
  }

  function mergeById(serverArr, clientArr) {
    const map = new Map();
    for (const item of (serverArr || [])) { if (item.id) map.set(item.id, item); }
    for (const item of (clientArr || [])) { if (item.id) map.set(item.id, item); } // 客户端覆盖服务端
    return Array.from(map.values());
  }

  const merged = {
    translations: mergeById(existing.translations, translations),
    diaries: mergeById(existing.diaries, diaries),
    vocab: Array.isArray(vocab) ? vocab : (existing.vocab || []),
    extractedVocab: mergeById(existing.extractedVocab, extractedVocab),
    lastSync: new Date().toISOString(),
  };

  writeFileSync(backupPath, JSON.stringify(merged, null, 2), "utf-8");
  res.json({ ok: true, counts: {
    translations: merged.translations.length,
    diaries: merged.diaries.length,
    extractedVocab: merged.extractedVocab.length,
  }});
});

// 下载备份（登录时恢复数据）
app.get("/api/data/restore", authMiddleware, (req, res) => {
  const backupPath = getUserBackupPath(req.user.uid);
  if (!existsSync(backupPath)) {
    return res.json({ translations: [], diaries: [], vocab: [], extractedVocab: [] });
  }
  try {
    const data = JSON.parse(readFileSync(backupPath, "utf-8"));
    res.json(data);
  } catch {
    res.json({ translations: [], diaries: [], vocab: [], extractedVocab: [] });
  }
});

// GLM (智谱AI) 配置
const GLM_API_KEY = process.env.GLM_API_KEY;
const GLM_BASE_URL = process.env.GLM_BASE_URL || "https://open.bigmodel.cn/api/paas/v4";
const GLM_MODEL = process.env.GLM_MODEL || "glm-4-flash";
const GLM_FAST_MODEL = "glm-4-flash"; // 用于简单任务（句子生成）
const AI_ENABLED = !!GLM_API_KEY;

if (AI_ENABLED) {
  console.log(`GLM AI enabled (main: ${GLM_MODEL}, fast: ${GLM_FAST_MODEL})`);
} else {
  console.warn("GLM_API_KEY not set — running in fallback mode (AI features disabled, built-in data only)");
}

function sanitizeInput(text) {
  if (typeof text !== "string") return "";
  return text
    .replace(/```/g, "")
    .replace(/\r\n/g, "\n")
    .slice(0, 5000);
}

async function callGLM(prompt, { model = GLM_MODEL, maxRetries = 3 } = {}) {
  if (!AI_ENABLED) throw new Error("AI not configured");

  let lastError = null;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`${GLM_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GLM_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: "You are a helpful assistant. Always respond with valid JSON only, no markdown fences." },
            { role: "user", content: prompt }
          ],
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`GLM API ${response.status}: ${errBody}`);
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || "";
      return { text };
    } catch (error) {
      lastError = error;
      const msg = error?.message || "";
      const isRetryable =
        msg.includes("429") ||
        msg.includes("500") ||
        msg.includes("503") ||
        msg.includes("ECONNRESET");

      if (isRetryable && i < maxRetries - 1) {
        const delay = Math.pow(2, i + 1) * 1000 + Math.random() * 1000;
        console.warn(`Retrying in ${Math.round(delay)}ms (attempt ${i + 1})`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

function cleanJson(text) {
  return text.replace(/```json\n?|```/g, "").trim();
}

const FALLBACK_SENTENCES = [
  { id: "f1", chinese: "我觉得远程办公的效率其实比在公司还高，你怎么看？", category: "工作", difficulty: "medium" },
  { id: "f2", chinese: "这家店的招牌菜味道不错，不过分量有点小，性价比一般。", category: "餐饮", difficulty: "medium" },
  { id: "f3", chinese: "最近压力挺大的，我打算周末去爬山放松一下。", category: "生活", difficulty: "medium" },
  { id: "f4", chinese: "你有没有推荐的播客？我通勤的时候想听点有意思的内容。", category: "兴趣", difficulty: "medium" },
  { id: "f5", chinese: "我个人认为学一门新语言最有效的方式就是多跟母语者交流。", category: "观点", difficulty: "medium" },
  { id: "f6", chinese: "不好意思，我可能要迟到十分钟左右，路上有点堵车。", category: "社交", difficulty: "medium" },
  { id: "f7", chinese: "听说下个月机票会便宜不少，你要不要一起计划个短途旅行？", category: "旅行", difficulty: "medium" },
  { id: "f8", chinese: "虽然AI发展得很快，但我觉得创造力和同理心是机器很难替代的。", category: "科技", difficulty: "medium" },
  { id: "f9", chinese: "坚持早睡早起之后，我发现白天的专注力确实提升了不少。", category: "健康", difficulty: "medium" },
  { id: "f10", chinese: "这部电影的剧情虽然老套，但演员的表演真的很打动人。", category: "娱乐", difficulty: "medium" },
];

// Generate daily sentences
app.post("/api/sentences", async (req, res) => {
  const { language, level } = req.body;

  if (!["English", "Japanese"].includes(language)) {
    return res.status(400).json({ error: "Invalid language" });
  }
  if (!["medium", "hard"].includes(level || "medium")) {
    return res.status(400).json({ error: "Invalid level" });
  }

  if (!AI_ENABLED) {
    return res.json(FALLBACK_SENTENCES);
  }

  const prompt = `生成10个中文句子，用于翻译练习（翻译成${language}）。难度: ${level || "medium"}。

要求:
- 句子要实用，是日常口语中真正会用到的表达，帮助用户积累口语句子，能在生活中表达意思和观点。
- 话题多样化：社交聊天、工作沟通、旅行出行、餐厅点餐、观点表达、情感表达、新闻时事、兴趣爱好、健康生活等，不要局限于某几个话题。
- 不要太简单（如"你好"、"谢谢"这类），要有一定信息量和表达难度，但也不要过于书面化。
- 10个句子之间不能重复或意思雷同，每个句子的话题和表达方式要尽量不同。
- 每次生成要有随机性，不要每次都是类似的套路句。

格式: JSON array，每项包含 id(string)、chinese(string)、category(string 话题分类)、difficulty(string)。
Return ONLY the JSON array, no other text.`;

  try {
    const response = await callGLM(prompt, { model: GLM_FAST_MODEL });
    const text = response.text;
    if (!text) throw new Error("Empty AI response");

    const data = JSON.parse(cleanJson(text));
    if (Array.isArray(data) && data.length > 0) {
      return res.json(data);
    }
    throw new Error("Invalid data format");
  } catch (error) {
    console.error("Sentence generation failed:", error.message);
    res.json(FALLBACK_SENTENCES);
  }
});

// Translation feedback
app.post("/api/feedback", async (req, res) => {
  const { chinese, userTranslation, targetLanguage } = req.body;

  if (!chinese || !userTranslation || !["English", "Japanese"].includes(targetLanguage)) {
    return res.status(400).json({ error: "Invalid parameters" });
  }

  if (!AI_ENABLED) {
    return res.json({
      reference: "(AI 未配置，无法生成参考翻译。请在 .env.local 中设置 GLM_API_KEY)",
      feedback: "当前处于离线模式，AI 评分功能不可用。请配置 API Key 后重试。",
      vocabulary: [],
    });
  }

  const safeChinese = sanitizeInput(chinese);
  const safeTranslation = sanitizeInput(userTranslation);

  const prompt = `你是一位资深${targetLanguage === "English" ? "英语" : "日语"}专家，同时也是${targetLanguage}母语者，拥有多年语言教学和翻译经验。请以专业且严谨的角度评价学生的翻译。

原文（中文）: "${safeChinese}"
学生的${targetLanguage}翻译: "${safeTranslation}"

请提供:
1. reference: 你的参考翻译（用${targetLanguage}写）。优先给出口语化、日常对话中最自然的表达方式，不要书面化或过于正式。只有当原文本身是正式语境时，才使用正式表达。
2. feedback: 用中文写的简短点评（评价语法、用词、表达是否地道）。提到具体${targetLanguage}单词时直接用原文，不需要翻译成中文。优先从口语场景点评，指出怎样说更地道、更自然；最后也给出该句在正式场合下的表达方式供用户参考。
3. vocabulary: 从你的参考翻译中挑选 2-3 个六级/雅思/托福级别的高阶实用词汇（必须是参考翻译中实际出现的词，不要选 like、make、good、very 等基础词）。如果参考翻译本身比较简单，没有高阶词汇，就返回空数组，不要硬凑。每个词汇包含: word（原词）、meaning（中文释义）、phonetic（国际音标，如 /ɪɡˈzæmpəl/）。

Return ONLY valid JSON: {"reference": "string", "feedback": "string（中文点评）", "vocabulary": [{"word": "string", "meaning": "中文释义", "phonetic": "/音标/"}]}`;

  try {
    const response = await callGLM(prompt);
    const result = JSON.parse(cleanJson(response.text || "{}"));
    res.json(result);
  } catch (error) {
    console.error("Feedback error:", error.message);
    res.status(500).json({ error: "AI service unavailable" });
  }
});

// Diary polishing
app.post("/api/polish", async (req, res) => {
  const { content, targetLanguage } = req.body;

  if (!content || !["English", "Japanese"].includes(targetLanguage)) {
    return res.status(400).json({ error: "Invalid parameters" });
  }

  if (!AI_ENABLED) {
    return res.json({
      polished: "(AI 未配置，无法润色。请在 .env.local 中设置 GLM_API_KEY)",
      corrections: "当前处于离线模式。",
      errorSummary: "AI 功能不可用。",
      patterns: [],
      vocabulary: [],
    });
  }

  const safeContent = sanitizeInput(content);

  const prompt = `你是一位资深${targetLanguage === "English" ? "英语" : "日语"}专家，同时也是${targetLanguage}母语者，拥有多年语言教学和写作指导经验。请以专业且严谨的角度润色学生的${targetLanguage}日记。

学生的日记: "${safeContent}"

请提供:
1. polished: 润色后的自然、地道版本（用${targetLanguage}写）。润色要保持原文的语气和风格，简单的内容就用流畅自然的表达，不要刻意堆砌高级词汇；在合适的地方适当提升用词档次即可。
2. corrections: 用中文说明语法修正内容。
3. errorSummary: 用中文总结学生的常见错误。
4. patterns: 从润色版本中提取 2-3 个实用句型，pattern 用${targetLanguage}写，meaning 用中文解释。
5. vocabulary: 从润色版本中挑选 3-5 个六级/雅思/托福级别的高阶实用词汇（必须是润色版本中实际出现的词，不要选 like、make、good、very 等基础词）。如果润色版本本身比较简单，没有高阶词汇，就返回空数组，不要硬凑。每个词汇包含: word（原词）、meaning（中文释义）、phonetic（国际音标，如 /ɪɡˈzæmpəl/）。

Return ONLY valid JSON: {"polished": "string", "corrections": "string（中文）", "errorSummary": "string（中文）", "patterns": [{"pattern": "string", "meaning": "中文释义"}], "vocabulary": [{"word": "string", "meaning": "中文释义", "phonetic": "/音标/"}]}`;

  try {
    const response = await callGLM(prompt);
    const result = JSON.parse(cleanJson(response.text || "{}"));
    res.json(result);
  } catch (error) {
    console.error("Polish error:", error.message);
    res.status(500).json({ error: "AI service unavailable" });
  }
});

// ==================== Streaming endpoints ====================
// 通用流式调用：实时推送 AI 生成的文本到前端
async function streamGLM(prompt, res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const response = await fetch(`${GLM_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: GLM_MODEL,
        messages: [
          { role: "system", content: "You are a helpful assistant. Always respond with valid JSON only, no markdown fences." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      res.write(`data: ${JSON.stringify({ error: `API error ${response.status}` })}\n\n`);
      res.end();
      return;
    }

    let fullText = "";
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n");
      buffer = parts.pop() || "";

      for (const line of parts) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data);
          const choice = parsed.choices?.[0]?.delta || {};
          // GLM-5 推理模型：实际内容在 content，reasoning_content 是思考过程（跳过）
          const delta = choice.content || "";
          if (delta) {
            fullText += delta;
            res.write(`data: ${JSON.stringify({ delta, text: fullText })}\n\n`);
          }
        } catch {}
      }
    }

    // 发送完成信号，附带完整文本
    if (fullText) {
      res.write(`data: ${JSON.stringify({ done: true, text: fullText })}\n\n`);
      res.end();
    } else {
      // 流式没拿到内容（如推理模型异常），降级为非流式
      console.warn("Stream returned empty, falling back to non-stream");
      try {
        const fallback = await callGLM(prompt);
        res.write(`data: ${JSON.stringify({ done: true, text: fallback.text })}\n\n`);
      } catch (fbErr) {
        res.write(`data: ${JSON.stringify({ error: "AI 返回为空，请重试" })}\n\n`);
      }
      res.end();
    }
  } catch (error) {
    console.error("Stream error:", error.message);
    res.write(`data: ${JSON.stringify({ error: "AI service unavailable" })}\n\n`);
    res.end();
  }
}

// 流式翻译反馈
app.post("/api/feedback/stream", (req, res) => {
  const { chinese, userTranslation, targetLanguage } = req.body;
  if (!chinese || !userTranslation || !["English", "Japanese"].includes(targetLanguage)) {
    return res.status(400).json({ error: "Invalid parameters" });
  }
  if (!AI_ENABLED) {
    return res.json({
      reference: "(AI 未配置)",
      feedback: "请配置 GLM_API_KEY",
      vocabulary: [],
    });
  }

  const safeChinese = sanitizeInput(chinese);
  const safeTranslation = sanitizeInput(userTranslation);

  const prompt = `你是一位资深${targetLanguage === "English" ? "英语" : "日语"}专家，同时也是${targetLanguage}母语者，拥有多年语言教学和翻译经验。请以专业且严谨的角度评价学生的翻译。

原文（中文）: "${safeChinese}"
学生的${targetLanguage}翻译: "${safeTranslation}"

请提供:
1. reference: 你的参考翻译（用${targetLanguage}写）。优先给出口语化、日常对话中最自然的表达方式，不要书面化或过于正式。只有当原文本身是正式语境时，才使用正式表达。
2. feedback: 用中文写的简短点评（评价语法、用词、表达是否地道）。提到具体${targetLanguage}单词时直接用原文，不需要翻译成中文。优先从口语场景点评，指出怎样说更地道、更自然；最后也给出该句在正式场合下的表达方式供用户参考。
3. vocabulary: 从你的参考翻译中挑选 2-3 个六级/雅思/托福级别的高阶实用词汇（必须是参考翻译中实际出现的词，不要选 like、make、good、very 等基础词）。如果参考翻译本身比较简单，没有高阶词汇，就返回空数组，不要硬凑。每个词汇包含: word（原词）、meaning（中文释义）、phonetic（国际音标，如 /ɪɡˈzæmpəl/）。

Return ONLY valid JSON: {"reference": "string", "feedback": "string（中文点评）", "vocabulary": [{"word": "string", "meaning": "中文释义", "phonetic": "/音标/"}]}`;

  streamGLM(prompt, res);
});

// 流式日记润色
app.post("/api/polish/stream", (req, res) => {
  const { content, targetLanguage } = req.body;
  if (!content || !["English", "Japanese"].includes(targetLanguage)) {
    return res.status(400).json({ error: "Invalid parameters" });
  }
  if (!AI_ENABLED) {
    return res.json({
      polished: "(AI 未配置)",
      corrections: "请配置 GLM_API_KEY",
      errorSummary: "",
      patterns: [],
      vocabulary: [],
    });
  }

  const safeContent = sanitizeInput(content);

  const prompt = `你是一位资深${targetLanguage === "English" ? "英语" : "日语"}专家，同时也是${targetLanguage}母语者，拥有多年语言教学和写作指导经验。请以专业且严谨的角度润色学生的${targetLanguage}日记。

学生的日记: "${safeContent}"

请提供:
1. polished: 润色后的自然、地道版本（用${targetLanguage}写）。润色要保持原文的语气和风格，简单的内容就用流畅自然的表达，不要刻意堆砌高级词汇；在合适的地方适当提升用词档次即可。
2. corrections: 用中文说明语法修正内容。
3. errorSummary: 用中文总结学生的常见错误。
4. patterns: 从润色版本中提取 2-3 个实用句型，pattern 用${targetLanguage}写，meaning 用中文解释。
5. vocabulary: 从润色版本中挑选 3-5 个六级/雅思/托福级别的高阶实用词汇（必须是润色版本中实际出现的词，不要选 like、make、good、very 等基础词）。如果润色版本本身比较简单，没有高阶词汇，就返回空数组，不要硬凑。每个词汇包含: word（原词）、meaning（中文释义）、phonetic（国际音标，如 /ɪɡˈzæmpəl/）。

Return ONLY valid JSON: {"polished": "string", "corrections": "string（中文）", "errorSummary": "string（中文）", "patterns": [{"pattern": "string", "meaning": "中文释义"}], "vocabulary": [{"word": "string", "meaning": "中文释义", "phonetic": "/音标/"}]}`;

  streamGLM(prompt, res);
});

// ==================== 快速接口（GLM-4-flash，用于双轨策略的初版） ====================

// 快速翻译反馈（GLM-4-flash）
app.post("/api/feedback/fast", async (req, res) => {
  const { chinese, userTranslation, targetLanguage } = req.body;
  if (!chinese || !userTranslation || !["English", "Japanese"].includes(targetLanguage)) {
    return res.status(400).json({ error: "Invalid parameters" });
  }
  if (!AI_ENABLED) {
    return res.json({ reference: "(AI 未配置)", feedback: "请配置 GLM_API_KEY", vocabulary: [] });
  }

  const safeChinese = sanitizeInput(chinese);
  const safeTranslation = sanitizeInput(userTranslation);

  const prompt = `你是一位资深${targetLanguage === "English" ? "英语" : "日语"}专家，同时也是${targetLanguage}母语者，拥有多年语言教学和翻译经验。请以专业且严谨的角度评价学生的翻译。

原文（中文）: "${safeChinese}"
学生的${targetLanguage}翻译: "${safeTranslation}"

请提供:
1. reference: 你的参考翻译（用${targetLanguage}写）。优先给出口语化、日常对话中最自然的表达方式，不要书面化或过于正式。只有当原文本身是正式语境时，才使用正式表达。
2. feedback: 用中文写的简短点评（评价语法、用词、表达是否地道）。提到具体${targetLanguage}单词时直接用原文，不需要翻译成中文。优先从口语场景点评，指出怎样说更地道、更自然；最后也给出该句在正式场合下的表达方式供用户参考。
3. vocabulary: 从你的参考翻译中挑选 2-3 个六级/雅思/托福级别的高阶实用词汇（必须是参考翻译中实际出现的词，不要选 like、make、good、very 等基础词）。如果参考翻译本身比较简单，没有高阶词汇，就返回空数组，不要硬凑。每个词汇包含: word（原词）、meaning（中文释义）、phonetic（国际音标，如 /ɪɡˈzæmpəl/）。

Return ONLY valid JSON: {"reference": "string", "feedback": "string（中文点评）", "vocabulary": [{"word": "string", "meaning": "中文释义", "phonetic": "/音标/"}]}`;

  try {
    const response = await callGLM(prompt, { model: GLM_FAST_MODEL });
    const parsed = JSON.parse(cleanJson(response.text || "{}"));
    res.json(parsed);
  } catch (err) {
    console.error("Fast feedback error:", err.message);
    res.status(500).json({ error: "Fast feedback failed" });
  }
});

// 快速日记润色（GLM-4-flash）
app.post("/api/polish/fast", async (req, res) => {
  const { content, targetLanguage } = req.body;
  if (!content || !["English", "Japanese"].includes(targetLanguage)) {
    return res.status(400).json({ error: "Invalid parameters" });
  }
  if (!AI_ENABLED) {
    return res.json({ polished: "(AI 未配置)", corrections: "请配置 GLM_API_KEY", errorSummary: "", patterns: [], vocabulary: [] });
  }

  const safeContent = sanitizeInput(content);

  const prompt = `你是一位资深${targetLanguage === "English" ? "英语" : "日语"}专家，同时也是${targetLanguage}母语者，拥有多年语言教学和写作指导经验。请以专业且严谨的角度润色学生的${targetLanguage}日记。

学生的日记: "${safeContent}"

请提供:
1. polished: 润色后的自然、地道版本（用${targetLanguage}写）。润色要保持原文的语气和风格，简单的内容就用流畅自然的表达，不要刻意堆砌高级词汇；在合适的地方适当提升用词档次即可。
2. corrections: 用中文说明语法修正内容。
3. errorSummary: 用中文总结学生的常见错误。
4. patterns: 从润色版本中提取 2-3 个实用句型，pattern 用${targetLanguage}写，meaning 用中文解释。
5. vocabulary: 从润色版本中挑选 3-5 个六级/雅思/托福级别的高阶实用词汇（必须是润色版本中实际出现的词，不要选 like、make、good、very 等基础词）。如果润色版本本身比较简单，没有高阶词汇，就返回空数组，不要硬凑。每个词汇包含: word（原词）、meaning（中文释义）、phonetic（国际音标，如 /ɪɡˈzæmpəl/）。

Return ONLY valid JSON: {"polished": "string", "corrections": "string（中文）", "errorSummary": "string（中文）", "patterns": [{"pattern": "string", "meaning": "中文释义"}], "vocabulary": [{"word": "string", "meaning": "中文释义", "phonetic": "/音标/"}]}`;

  try {
    const response = await callGLM(prompt, { model: GLM_FAST_MODEL });
    const parsed = JSON.parse(cleanJson(response.text || "{}"));
    res.json(parsed);
  } catch (err) {
    console.error("Fast polish error:", err.message);
    res.status(500).json({ error: "Fast polish failed" });
  }
});

// 预生成参考翻译（用户选句子时就开始跑，利用用户打字时间）
app.post("/api/pregenerate", async (req, res) => {
  const { chinese, targetLanguage } = req.body;
  if (!chinese || !["English", "Japanese"].includes(targetLanguage)) {
    return res.status(400).json({ error: "Invalid parameters" });
  }
  if (!AI_ENABLED) {
    return res.json({ reference: null });
  }

  const safeChinese = sanitizeInput(chinese);

  const prompt = `你是一位资深${targetLanguage === "English" ? "英语" : "日语"}专家，同时也是${targetLanguage}母语者。请翻译以下中文句子为地道的${targetLanguage}。

中文: "${safeChinese}"

翻译要自然地道，符合原文的语气和难度。简单句子就用日常自然的表达，复杂或正式的句子再适当使用高阶表达。

Return ONLY valid JSON: {"reference": "你的翻译"}`;

  try {
    const response = await callGLM(prompt, { model: GLM_FAST_MODEL });
    const parsed = JSON.parse(cleanJson(response.text || "{}"));
    res.json(parsed);
  } catch (err) {
    console.error("Pregenerate error:", err.message);
    res.json({ reference: null });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`LangFlow API server running on http://localhost:${PORT}`);
  if (!AI_ENABLED) {
    console.log("Tip: Set GLM_API_KEY in .env.local to enable AI features");
  }
});
