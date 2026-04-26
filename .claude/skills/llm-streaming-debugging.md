# Skill: LLM 流式调用排障与稳定性保障

## 适用场景

通过后端代理调用大模型 API（特别是流式 SSE 方式），前端出现"一直转圈不出结果"、"偶尔能用偶尔不行"、"结果不完整"等问题时，按以下清单逐项排查。

---

## 排查清单（按优先级）

### 1. 确认模型返回格式是否匹配解析逻辑

**症状**：后端日志无报错，但前端收不到有效内容。

**根因**：不同模型的流式 chunk 格式不同，尤其是推理模型（reasoning model）。

| 模型类型 | 流式 delta 字段 | 说明 |
|---------|----------------|------|
| 普通模型 (GPT, GLM-4-flash) | `choices[0].delta.content` | 直接输出答案 |
| 推理模型 (GLM-5, o1, DeepSeek-R1) | 先 `delta.reasoning_content`，后 `delta.content` | 思考过程在前，答案在后 |

**修复**：
```js
const choice = parsed.choices?.[0]?.delta || {};
// 只取 content（实际答案），跳过 reasoning_content（思考过程）
const delta = choice.content || "";
```

**教训**：切换模型后必须用 `curl --stream` 检查实际返回格式，不能假设所有模型格式一致。

---

### 2. 检查代理层是否缓冲了 SSE

**症状**：curl 直连后端正常，但通过 Vite/Nginx 代理后数据堆积，要么全部数据最后一次性到达，要么超时。

**根因**：代理服务器默认缓冲响应体，SSE 需要逐条透传。

**Vite 修复**：
```ts
// vite.config.ts
proxy: {
  '/api': {
    target: 'http://localhost:3001',
    changeOrigin: true,
    configure: (proxy) => {
      proxy.on('proxyRes', (proxyRes) => {
        if ((proxyRes.headers['content-type'] || '').includes('text/event-stream')) {
          proxyRes.headers['cache-control'] = 'no-cache';
          proxyRes.headers['x-accel-buffering'] = 'no';
        }
      });
    },
  },
}
```

**Nginx 修复**：
```nginx
location /api/ {
    proxy_buffering off;
    proxy_cache off;
    proxy_set_header X-Accel-Buffering no;
}
```

---

### 3. 处理 SSE 跨 chunk 行断裂

**症状**：偶发的 JSON.parse 错误或数据丢失，重试后又正常。

**根因**：TCP 不保证按行切割，一行 `data: {"delta":"..."}` 可能被拆到两个 chunk。

**修复**：用 buffer 拼接不完整行：
```js
let buffer = "";
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const parts = buffer.split("\n");
  buffer = parts.pop() || ""; // 最后一个可能不完整，留到下次
  for (const line of parts) {
    if (!line.startsWith("data: ")) continue;
    // 解析完整行...
  }
}
```

---

### 4. 必须有超时与降级机制

**症状**：推理模型思考时间长（30-90s），或网络抖动导致前端永远转圈。

**前端**：AbortController 超时
```js
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 60000);
try {
  const res = await fetch(url, { signal: controller.signal, ... });
} finally {
  clearTimeout(timeout);
}
```

**后端**：流式空结果降级非流式
```js
if (!fullText) {
  console.warn("Stream empty, falling back to non-stream");
  const fallback = await callGLM(prompt); // 非流式兜底
  res.write(`data: ${JSON.stringify({ done: true, text: fallback.text })}\n\n`);
}
```

---

### 5. 端口冲突导致请求挂起

**症状**：页面完全打不开，或请求发出后无任何响应。

**排查**：
```bash
netstat -ano | grep ":3001"   # 看是否多个进程监听
```

**修复**：启动前清理残留进程，或在 server.js 中加端口占用检测。

---

## 调试 SOP（标准操作流程）

当 AI 调用不出结果时，按此顺序操作：

```
1. curl 直连后端 API（绕过前端和代理）
   ✅ 有结果 → 问题在代理层或前端（查第 2、3 点）
   ❌ 无结果 → 继续第 2 步

2. curl 直连大模型 API（绕过后端）
   ✅ 有结果 → 问题在后端解析逻辑（查第 1 点）
   ❌ 无结果 → API Key / 网络 / 模型服务问题

3. 对比流式 vs 非流式
   流式无结果但非流式有 → 流式解析逻辑有 bug（查第 1、3 点）
   都无结果 → 模型服务或网络问题

4. 检查端口和进程状态（查第 5 点）
```

---

## 关键经验

- **切换模型 = 必须重新验证返回格式**，`curl` 测流式输出是最快的方式
- **SSE 必须在每一层关闭缓冲**：后端 response header + 代理层配置
- **流式解析必须有 buffer**，不能假设每个 chunk 都是完整行
- **永远有降级方案**：流式失败 → 非流式兜底 → 返回错误提示
- **推理模型比普通模型慢 3-10 倍**，超时阈值要相应放大
