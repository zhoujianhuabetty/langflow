import { format } from "date-fns";

function generateId(): string {
  try {
    return generateId();
  } catch {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
}

export interface TranslationRecord {
  id: string;
  chinese: string;
  userTranslation: string;
  reference: string;
  feedback: string;
  date: string;
  language: string;
}

export interface DiaryRecord {
  id: string;
  content: string;
  polished: string;
  errorSummary?: string;
  patterns?: { pattern: string; meaning: string }[];
  date: string;
  language: string;
}

const STORAGE_KEYS = {
  TRANSLATIONS: "langflow_translations",
  DIARIES: "langflow_diaries",
  VOCAB: "langflow_vocab",
  DAILY_SENTENCES: "langflow_daily_sentences",
};

export const storage = {
  getDailySentences: (language: string, difficulty: string): any[] | null => {
    const data = localStorage.getItem(STORAGE_KEYS.DAILY_SENTENCES);
    if (!data) return null;
    const allDaily = JSON.parse(data);
    const today = format(new Date(), "yyyy-MM-dd");
    
    // If the stored date is not today, clear the whole cache
    if (allDaily.date !== today) {
      localStorage.removeItem(STORAGE_KEYS.DAILY_SENTENCES);
      return null;
    }
    
    // Return the specific combination if it exists
    const key = `${language}_${difficulty}`;
    return allDaily.data?.[key] || null;
  },

  saveDailySentences: (sentences: any[], language: string, difficulty: string) => {
    const today = format(new Date(), "yyyy-MM-dd");
    const existingData = localStorage.getItem(STORAGE_KEYS.DAILY_SENTENCES);
    let allDaily = existingData ? JSON.parse(existingData) : { date: today, data: {} };
    
    // If date changed, reset
    if (allDaily.date !== today) {
      allDaily = { date: today, data: {} };
    }
    
    const key = `${language}_${difficulty}`;
    if (!allDaily.data) allDaily.data = {};
    allDaily.data[key] = sentences;
    
    localStorage.setItem(STORAGE_KEYS.DAILY_SENTENCES, JSON.stringify(allDaily));
  },

  saveTranslation: (record: Omit<TranslationRecord, "id" | "date">) => {
    const records = storage.getTranslations();
    const newRecord = {
      ...record,
      id: generateId(),
      date: format(new Date(), "yyyy-MM-dd"),
    };
    localStorage.setItem(STORAGE_KEYS.TRANSLATIONS, JSON.stringify([newRecord, ...records]));
    // 自动同步到服务器
    storage.syncToServer();
    return newRecord;
  },

  getTranslations: (): TranslationRecord[] => {
    const data = localStorage.getItem(STORAGE_KEYS.TRANSLATIONS);
    return data ? JSON.parse(data) : [];
  },

  saveDiary: (record: Omit<DiaryRecord, "id" | "date">) => {
    const records = storage.getDiaries();
    const newRecord = {
      ...record,
      id: generateId(),
      date: format(new Date(), "yyyy-MM-dd"),
    };
    localStorage.setItem(STORAGE_KEYS.DIARIES, JSON.stringify([newRecord, ...records]));
    // 自动同步到服务器
    storage.syncToServer();
    return newRecord;
  },

  getDiaries: (): DiaryRecord[] => {
    const data = localStorage.getItem(STORAGE_KEYS.DIARIES);
    return data ? JSON.parse(data) : [];
  },

  getRecordsByDate: (date: string) => {
    const translations = storage.getTranslations().filter(r => r.date === date);
    const diaries = storage.getDiaries().filter(r => r.date === date);
    return { translations, diaries };
  },

  saveVocab: (vocab: any[]) => {
    localStorage.setItem(STORAGE_KEYS.VOCAB, JSON.stringify(vocab));
  },

  getVocab: () => {
    const data = localStorage.getItem(STORAGE_KEYS.VOCAB);
    return data ? JSON.parse(data) : [];
  },

  saveExtractedVocab: (word: string, meaning: string, source: string, phonetic?: string, language?: string) => {
    const existing = storage.getExtractedVocab();
    if (existing.some((v: { word: string }) => v.word.toLowerCase() === word.toLowerCase())) return;

    const newVocab = {
      word,
      meaning,
      source,
      phonetic,
      language: language || "English",
      date: format(new Date(), "yyyy-MM-dd")
    };
    localStorage.setItem("langflow_extracted_vocab", JSON.stringify([newVocab, ...existing]));
  },

  getExtractedVocab: () => {
    const data = localStorage.getItem("langflow_extracted_vocab");
    return data ? JSON.parse(data) : [];
  },

  // ==================== 云端备份 ====================

  // 同步本地数据到服务器（需要登录）
  syncToServer: async () => {
    const token = localStorage.getItem("langflow_token");
    if (!token) return; // 未登录不同步

    const payload = {
      translations: storage.getTranslations(),
      diaries: storage.getDiaries(),
      vocab: storage.getVocab(),
      extractedVocab: storage.getExtractedVocab(),
    };

    // 没数据不同步
    if (payload.translations.length === 0 && payload.diaries.length === 0 && payload.extractedVocab.length === 0) return;

    try {
      await fetch("/api/data/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
    } catch {
      // 静默失败，不影响用户操作
    }
  },

  // 从服务器恢复数据到本地（登录时调用）
  restoreFromServer: async (): Promise<boolean> => {
    const token = localStorage.getItem("langflow_token");
    if (!token) return false;

    try {
      const res = await fetch("/api/data/restore", {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (!res.ok) return false;
      const data = await res.json();

      let restored = false;

      // 合并翻译记录
      if (data.translations?.length > 0) {
        const local = storage.getTranslations();
        const localIds = new Set(local.map((r: TranslationRecord) => r.id));
        const newItems = data.translations.filter((r: TranslationRecord) => !localIds.has(r.id));
        if (newItems.length > 0) {
          const merged = [...local, ...newItems].sort((a: TranslationRecord, b: TranslationRecord) => b.date.localeCompare(a.date));
          localStorage.setItem(STORAGE_KEYS.TRANSLATIONS, JSON.stringify(merged));
          restored = true;
        }
      }

      // 合并日记记录
      if (data.diaries?.length > 0) {
        const local = storage.getDiaries();
        const localIds = new Set(local.map((r: DiaryRecord) => r.id));
        const newItems = data.diaries.filter((r: DiaryRecord) => !localIds.has(r.id));
        if (newItems.length > 0) {
          const merged = [...local, ...newItems].sort((a: DiaryRecord, b: DiaryRecord) => b.date.localeCompare(a.date));
          localStorage.setItem(STORAGE_KEYS.DIARIES, JSON.stringify(merged));
          restored = true;
        }
      }

      // 合并提取的词汇
      if (data.extractedVocab?.length > 0) {
        const local = storage.getExtractedVocab();
        const localWords = new Set(local.map((v: any) => v.word?.toLowerCase()));
        const newItems = data.extractedVocab.filter((v: any) => !localWords.has(v.word?.toLowerCase()));
        if (newItems.length > 0) {
          localStorage.setItem("langflow_extracted_vocab", JSON.stringify([...local, ...newItems]));
          restored = true;
        }
      }

      return restored;
    } catch {
      return false;
    }
  },
};
