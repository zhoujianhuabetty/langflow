const API_BASE = "/api";

export async function generateDailySentences(language: "English" | "Japanese", level: "medium" | "hard" = "medium") {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("AI Request Timeout")), 30000)
  );

  try {
    const apiCall = fetch(`${API_BASE}/sentences`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language, level }),
    }).then(async (res) => {
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      return res.json();
    });

    const data: any = await Promise.race([apiCall, timeoutPromise]);

    if (Array.isArray(data) && data.length > 0) {
      return data;
    }
    throw new Error("Invalid data format");
  } catch (error) {
    console.error("Sentence generation failed:", error);
    return [];
  }
}

// 非流式（保留兼容）
export async function getTranslationFeedback(chinese: string, userTranslation: string, targetLanguage: "English" | "Japanese") {
  try {
    const res = await fetch(`${API_BASE}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chinese, userTranslation, targetLanguage }),
    });
    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error("Error getting feedback:", error);
    return null;
  }
}

export async function polishDiary(content: string, targetLanguage: "English" | "Japanese") {
  try {
    const res = await fetch(`${API_BASE}/polish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, targetLanguage }),
    });
    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error("Error polishing diary:", error);
    return null;
  }
}

// ==================== 快速调用（GLM-4-flash，双轨初版） ====================

export async function getTranslationFeedbackFast(chinese: string, userTranslation: string, targetLanguage: "English" | "Japanese") {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000); // 8s 超时
  try {
    const res = await fetch(`${API_BASE}/feedback/fast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chinese, userTranslation, targetLanguage }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error("Fast feedback error:", error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function polishDiaryFast(content: string, targetLanguage: "English" | "Japanese") {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000); // 8s 超时
  try {
    const res = await fetch(`${API_BASE}/polish/fast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, targetLanguage }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error("Fast polish error:", error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// 预生成的 AbortController，切换句子时取消上一个请求
let pregenerateController: AbortController | null = null;

export async function pregenerateReference(chinese: string, targetLanguage: "English" | "Japanese") {
  // 取消上一个预生成请求
  if (pregenerateController) pregenerateController.abort();
  pregenerateController = new AbortController();
  const timeout = setTimeout(() => pregenerateController?.abort(), 10000); // 10s 超时

  try {
    const res = await fetch(`${API_BASE}/pregenerate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chinese, targetLanguage }),
      signal: pregenerateController.signal,
    });
    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    return await res.json();
  } catch (error) {
    if ((error as Error).name !== "AbortError") {
      console.error("Pregenerate error:", error);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ==================== 流式调用 ====================

function cleanJson(text: string): string {
  return text.replace(/```json\n?|```/g, "").trim();
}

type StreamCallback = (data: { delta?: string; text?: string; done?: boolean; error?: string }) => void;

async function fetchStream(url: string, body: Record<string, any>, onData: StreamCallback): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000); // 60s 总超时

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Server error: ${res.status}`);
    }

    // 非流式响应（fallback 模式直接返回 JSON）
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return await res.json();
    }

    // 流式 SSE 响应
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    let buffer = ""; // 处理跨 chunk 的不完整行

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n");
      buffer = parts.pop() || ""; // 保留最后一个可能不完整的行

      const lines = parts.filter((l) => l.startsWith("data: "));

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line.slice(6));
          if (parsed.error) {
            onData({ error: parsed.error });
            return null;
          }
          if (parsed.done) {
            fullText = parsed.text || fullText;
            onData({ done: true, text: fullText });
          } else if (parsed.delta) {
            fullText = parsed.text || fullText;
            onData({ delta: parsed.delta, text: fullText });
          }
        } catch {}
      }
    }

    // 解析完整 JSON
    try {
      return JSON.parse(cleanJson(fullText));
    } catch {
      return null;
    }
  } finally {
    clearTimeout(timeout);
  }
}

export async function getTranslationFeedbackStream(
  chinese: string,
  userTranslation: string,
  targetLanguage: "English" | "Japanese",
  onData: StreamCallback
) {
  try {
    return await fetchStream(
      `${API_BASE}/feedback/stream`,
      { chinese, userTranslation, targetLanguage },
      onData
    );
  } catch (error) {
    console.error("Stream feedback error:", error);
    return null;
  }
}

export async function polishDiaryStream(
  content: string,
  targetLanguage: "English" | "Japanese",
  onData: StreamCallback
) {
  try {
    return await fetchStream(
      `${API_BASE}/polish/stream`,
      { content, targetLanguage },
      onData
    );
  } catch (error) {
    console.error("Stream polish error:", error);
    return null;
  }
}
