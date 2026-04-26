import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Send, CheckCircle2, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { generateDailySentences, getTranslationFeedbackStream, getTranslationFeedbackFast, pregenerateReference } from "../lib/gemini";
import { storage } from "../lib/storage";
import BouncingSentences from "./BouncingSentences";

interface Sentence {
  id: string;
  chinese: string;
  category: string;
  difficulty: string;
}

export default function TranslationPractice({ language }: { language: "English" | "Japanese" }) {
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [selectedSentence, setSelectedSentence] = useState<Sentence | null>(() => {
    const saved = localStorage.getItem(`langflow_selected_sentence_${language}`);
    return saved ? JSON.parse(saved) : null;
  });
  const [userInput, setUserInput] = useState(() => localStorage.getItem(`langflow_user_input_${language}`) || "");
  const [feedback, setFeedback] = useState<any>(() => {
    const saved = localStorage.getItem(`langflow_feedback_${language}`);
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [difficulty, setDifficulty] = useState<"medium" | "hard">("medium");

  const [translatedIds, setTranslatedIds] = useState<Set<string>>(new Set());
  const [upgrading, setUpgrading] = useState(false);
  const pregenCache = useState<Record<string, string>>({})[0]; // 预生成缓存 {chinese -> reference}

  useEffect(() => {
    localStorage.setItem(`langflow_user_input_${language}`, userInput);
  }, [userInput, language]);

  useEffect(() => {
    if (selectedSentence) {
      localStorage.setItem(`langflow_selected_sentence_${language}`, JSON.stringify(selectedSentence));
    } else {
      localStorage.removeItem(`langflow_selected_sentence_${language}`);
    }
  }, [selectedSentence, language]);

  useEffect(() => {
    if (feedback) {
      localStorage.setItem(`langflow_feedback_${language}`, JSON.stringify(feedback));
    } else {
      localStorage.removeItem(`langflow_feedback_${language}`);
    }
  }, [feedback, language]);

  useEffect(() => {
    loadSentences();
  }, [language, difficulty]);

  const loadSentences = async () => {
    setGenerating(true);
    try {
      // Try to get from cache first
      const cached = storage.getDailySentences(language, difficulty);
      
      if (cached && cached.length > 0) {
        // Filter out already translated sentences for today
        const today = format(new Date(), "yyyy-MM-dd");
        const translatedToday = storage.getTranslations()
          .filter(r => r.date === today && r.language === language)
          .map(r => r.chinese);

        const remaining = cached.filter(s => !translatedToday.includes(s.chinese));
        setSentences(remaining);
        
        // Update selection if needed
        if (selectedSentence && !remaining.find(s => s.id === selectedSentence.id)) {
          setSelectedSentence(null);
          setFeedback(null);
          setUserInput("");
        }
        setGenerating(false);
        return;
      }

      // If not in cache, we need to reset and generate
      setSelectedSentence(null);
      setFeedback(null);
      setUserInput("");
      setTranslatedIds(new Set());
      
      const daily = await generateDailySentences(language, difficulty);
      setSentences(daily);
      storage.saveDailySentences(daily, language, difficulty);
    } catch (error) {
      console.error("Failed to load sentences:", error);
    } finally {
      setGenerating(false);
    }
  };

  const handleRefresh = async () => {
    setGenerating(true);
    const timeoutId = setTimeout(() => {
      if (generating) {
        console.warn("Refresh timed out, using fallbacks");
        setGenerating(false);
      }
    }, 15000); // 15s safety timeout

    try {
      setSelectedSentence(null);
      setFeedback(null);
      setUserInput("");
      setTranslatedIds(new Set());
      
      const daily = await generateDailySentences(language, difficulty);
      setSentences(daily);
      storage.saveDailySentences(daily, language, difficulty);
    } catch (error) {
      console.error("Failed to refresh sentences:", error);
    } finally {
      clearTimeout(timeoutId);
      setGenerating(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedSentence || !userInput.trim()) return;
    setLoading(true);
    setFeedback(null);
    setStreamingText("");
    setUpgrading(false);

    // 双轨并行：GLM-4-flash 快速出初版 + GLM-5 出精修版
    let qualityDone = false;
    let savedRecordId: string | null = null;
    const sentenceChinese = selectedSentence.chinese;
    const sentenceId = selectedSentence.id;

    const fastPromise = getTranslationFeedbackFast(sentenceChinese, userInput, language)
      .then(result => {
        if (result && !result.error && !qualityDone) {
          setFeedback(result);
          setLoading(false);
          setUpgrading(true);
          // fast 返回后立即保存，防止用户刷新页面导致记录丢失
          const record = storage.saveTranslation({
            chinese: sentenceChinese, userTranslation: userInput,
            reference: result.reference, feedback: result.feedback, language
          });
          savedRecordId = record.id;
          if (result.vocabulary) {
            result.vocabulary.forEach((v: any) => {
              storage.saveExtractedVocab(v.word, v.meaning, "翻译练习", v.phonetic, language);
            });
          }
          setTranslatedIds(prev => new Set(prev).add(sentenceId));
        }
        return result;
      });

    const qualityPromise = getTranslationFeedbackStream(sentenceChinese, userInput, language, (data) => {
      if (data.text) setStreamingText(data.text);
    }).then(result => {
      qualityDone = true;
      if (result) {
        setFeedback(result);
        setStreamingText("");
        setUpgrading(false);
        if (savedRecordId) {
          // fast 已保存过，用 GLM-5 高质量结果覆盖更新
          const records = storage.getTranslations();
          const idx = records.findIndex(r => r.id === savedRecordId);
          if (idx !== -1) {
            records[idx].reference = result.reference;
            records[idx].feedback = result.feedback;
            localStorage.setItem("langflow_translations", JSON.stringify(records));
            storage.syncToServer();
          }
        } else {
          // fast 未成功，直接新建记录
          storage.saveTranslation({
            chinese: sentenceChinese, userTranslation: userInput,
            reference: result.reference, feedback: result.feedback, language
          });
          setTranslatedIds(prev => new Set(prev).add(sentenceId));
        }
        if (result.vocabulary) {
          result.vocabulary.forEach((v: any) => {
            storage.saveExtractedVocab(v.word, v.meaning, "翻译练习", v.phonetic);
          });
        }
      }
      return result;
    });

    // 等两个都完成
    await Promise.allSettled([fastPromise, qualityPromise]);
    setLoading(false);
    setUpgrading(false);
  };

  const handleSelect = (s: Sentence) => {
    // When selecting a new sentence, remove any previously translated ones from the list
    if (translatedIds.size > 0) {
      setSentences(prev => prev.filter(curr => !translatedIds.has(curr.id)));
      setTranslatedIds(new Set());
    }

    setSelectedSentence(s);
    setUserInput("");
    setFeedback(null);

    // 预生成：用户选句子时，后台用 GLM-5 提前生成参考翻译
    if (!pregenCache[s.chinese]) {
      pregenerateReference(s.chinese, language).then(result => {
        if (result?.reference) {
          pregenCache[s.chinese] = result.reference;
        }
      });
    }
  };

  return (
    <div className="flex flex-col h-full gap-8">
      {/* Difficulty and Refresh Controls */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2 bg-white/50 p-1 rounded-xl border border-white/30 backdrop-blur-sm">
          <button 
            onClick={() => setDifficulty("medium")}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${difficulty === "medium" ? "bg-brand-accent text-white shadow-md" : "text-gray-600 hover:bg-white/50"}`}
          >
            中等难度
          </button>
          <button 
            onClick={() => setDifficulty("hard")}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${difficulty === "hard" ? "bg-brand-accent text-white shadow-md" : "text-gray-600 hover:bg-white/50"}`}
          >
            较难挑战
          </button>
        </div>
        
        <button 
          onClick={handleRefresh}
          disabled={generating}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-brand-accent hover:bg-brand-accent/5 rounded-xl transition-all disabled:opacity-50"
        >
          <RefreshCw size={16} className={generating ? "animate-spin" : ""} />
          换一批
        </button>
      </div>

      {/* Floating Sentences Area */}
      <div className="relative h-[500px] overflow-hidden glass-card p-4">
        {generating ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-brand-accent">
            <RefreshCw className="animate-spin" size={24} />
            <span className="text-sm font-medium">AI 正在为您生成今日练习...</span>
          </div>
        ) : sentences.length > 0 ? (
          <BouncingSentences 
            sentences={sentences} 
            onSelect={handleSelect} 
            selectedId={selectedSentence?.id} 
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-center">
            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center shadow-inner">
              <CheckCircle2 size={40} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-800">恭喜！</h3>
              <p className="text-gray-500 mt-1">您已完成今日所有的翻译练习</p>
            </div>
            <button 
              onClick={handleRefresh}
              className="mt-2 px-6 py-2 bg-brand-accent text-white rounded-xl font-medium hover:scale-105 transition-all shadow-lg"
            >
              再来 10 条
            </button>
          </div>
        )}
      </div>

      {/* Input Area */}
      <AnimatePresence mode="wait">
        {selectedSentence && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass-card p-8 flex flex-col gap-6"
          >
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-bold text-brand-accent uppercase tracking-wider">当前练习</span>
                <h2 className="text-2xl font-bold text-gray-800 mt-1">{selectedSentence.chinese}</h2>
              </div>
              <button 
                onClick={() => setSelectedSentence(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                取消
              </button>
            </div>

            <div className="relative">
              <textarea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder={`请输入您的${language === "English" ? "英语" : "日语"}翻译...`}
                className="w-full h-32 p-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-brand-secondary focus:border-transparent outline-none resize-none bg-white/50"
              />
              <button
                disabled={loading || !userInput.trim()}
                onClick={handleSubmit}
                className="absolute bottom-4 right-4 bg-brand-accent text-white p-3 rounded-xl shadow-lg hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all"
              >
                {loading ? <RefreshCw className="animate-spin" size={20} /> : <Send size={20} />}
              </button>
            </div>

            {/* 加载中 */}
            {loading && (
              <div className="mt-4 p-6 bg-brand-accent/5 rounded-2xl border border-brand-accent/10 flex items-center gap-3">
                <RefreshCw className="animate-spin text-brand-accent" size={18} />
                <span className="text-sm text-gray-500">AI 专家正在分析你的翻译...</span>
              </div>
            )}

            {feedback && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-4 p-6 bg-brand-accent/5 rounded-2xl border border-brand-accent/10"
              >
                <div className="flex items-center gap-2 mb-4 text-brand-accent">
                  <CheckCircle2 size={20} />
                  <h3 className="font-bold">AI 反馈与参考</h3>
                  {upgrading && (
                    <span className="ml-auto flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
                      <RefreshCw className="animate-spin" size={12} />
                      正在升级为高质量分析...
                    </span>
                  )}
                </div>
                
                <div className="space-y-4">
                  <div>
                    <span className="text-xs font-bold text-gray-400 uppercase">参考翻译</span>
                    <p className="text-lg font-medium text-gray-800">{feedback.reference}</p>
                  </div>
                  
                  <div>
                    <span className="text-xs font-bold text-gray-400 uppercase">点评</span>
                    <p className="text-sm text-gray-600 leading-relaxed">{feedback.feedback}</p>
                  </div>

                  {feedback.vocabulary && feedback.vocabulary.length > 0 && (
                    <div>
                      <span className="text-xs font-bold text-gray-400 uppercase">重点词汇</span>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {feedback.vocabulary.map((v: any, i: number) => (
                          <div key={i} className="px-3 py-1 bg-white rounded-lg border border-gray-100 shadow-sm text-xs">
                            <span className="font-bold text-brand-accent">{v.word}</span>
                            <span className="mx-1 text-gray-300">|</span>
                            <span className="text-gray-500">{v.meaning}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {!selectedSentence && !generating && (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-4">
          <div className="w-16 h-16 bg-white/50 rounded-full flex items-center justify-center border border-white/30">
            <ChevronUp size={32} />
          </div>
          <p className="font-medium">点击上方的句子开始练习</p>
        </div>
      )}
    </div>
  );
}
