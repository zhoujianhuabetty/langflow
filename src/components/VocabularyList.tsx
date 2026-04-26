import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { BookOpen, GraduationCap, History, Sparkles, Languages, Volume2, Check, ChevronRight, ChevronDown } from "lucide-react";
import { storage } from "../lib/storage";

const MASTERED_KEY = "langflow_mastered_vocab";

function getMastered(): Set<string> {
  const data = localStorage.getItem(MASTERED_KEY);
  return data ? new Set(JSON.parse(data)) : new Set();
}

function saveMastered(set: Set<string>) {
  localStorage.setItem(MASTERED_KEY, JSON.stringify([...set]));
}

export default function VocabularyList({ language }: { language: "English" | "Japanese" }) {
  const [extractedVocab, setExtractedVocab] = useState<any[]>([]);
  const [mastered, setMastered] = useState<Set<string>>(getMastered);

  const [masteredCollapsed, setMasteredCollapsed] = useState(true);

  useEffect(() => {
    setExtractedVocab(storage.getExtractedVocab());
  }, []);

  const toggleMastered = (word: string) => {
    setMastered(prev => {
      const next = new Set(prev);
      if (next.has(word)) {
        next.delete(word);
      } else {
        next.add(word);
      }
      saveMastered(next);
      return next;
    });
  };

  // 按语言筛选（旧数据没有 language 字段默认归为 English）
  const filtered = extractedVocab.filter(v => (v.language || "English") === language);
  const unmastered = filtered.filter(v => !mastered.has(v.word));
  const masteredList = filtered.filter(v => mastered.has(v.word));

  return (
    <div className="space-y-8 pb-24">
      {/* 标题栏 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/80 rounded-2xl flex items-center justify-center text-brand-accent shadow-sm border border-white/30">
            <GraduationCap size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">词汇积累</h2>
            <p className="text-sm text-gray-500">在练习中自动收集的高阶词汇</p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 bg-brand-accent/5 rounded-xl border border-brand-accent/10">
          <History size={16} className="text-brand-accent" />
          <span className="text-sm font-bold text-brand-accent">
            {unmastered.length} 待学 / {masteredList.length} 已掌握
          </span>
        </div>
      </div>

      {/* 主内容区：左栏已掌握 + 右栏待学 */}
      {filtered.length === 0 ? (
        <div className="glass-card p-12 flex flex-col items-center justify-center text-center gap-4">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300">
            <BookOpen size={32} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-700">暂无{language === "English" ? "英语" : "日语"}词汇</h3>
            <p className="text-sm text-gray-400 mt-1">在翻译练习或 AI 日记中完成练习，重点词汇会自动同步到这里。</p>
          </div>
        </div>
      ) : (
        <div className="flex gap-6">
          {/* 左栏：已掌握词汇折叠列表 */}
          {masteredList.length > 0 && (
            <div className="w-48 shrink-0">
              <div className="glass-card p-4 sticky top-40">
                <button
                  onClick={() => setMasteredCollapsed(!masteredCollapsed)}
                  className="flex items-center gap-2 w-full text-brand-accent hover:opacity-80 transition-opacity"
                >
                  {masteredCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                  <span className="text-xs font-bold uppercase tracking-wider">已掌握 ({masteredList.length})</span>
                </button>
                <AnimatePresence>
                  {!masteredCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-1 max-h-[60vh] overflow-y-auto mt-3">
                        {masteredList.map(v => (
                          <button
                            key={v.word}
                            onClick={() => toggleMastered(v.word)}
                            className="w-full text-left px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:bg-brand-accent/5 hover:text-brand-accent transition-all flex items-center gap-2 group"
                            title="点击移回待学列表"
                          >
                            <ChevronRight size={12} className="text-gray-300 group-hover:text-brand-accent shrink-0" />
                            <span className="truncate">{v.word}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* 右栏：待学词汇卡片 */}
          <div className="flex-1 min-w-0">
            {unmastered.length === 0 ? (
              <div className="glass-card p-12 flex flex-col items-center justify-center text-center gap-4">
                <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center text-green-500">
                  <Check size={32} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-700">全部掌握！</h3>
                  <p className="text-sm text-gray-400 mt-1">当前{language === "English" ? "英语" : "日语"}词汇已全部标记为已掌握。</p>
                </div>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence mode="popLayout">
                  {unmastered.map((v, i) => (
                    <motion.div
                      key={v.word}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ delay: i * 0.03 }}
                      className="glass-card p-6 flex flex-col justify-between group hover:shadow-brand-accent/10 transition-all border-white/40"
                    >
                      <div className="space-y-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h3 className="text-2xl font-bold text-brand-accent group-hover:scale-105 transition-transform origin-left">
                                {v.word}
                              </h3>
                              <button
                                onClick={() => {
                                  if (!('speechSynthesis' in window)) return;
                                  const utterance = new SpeechSynthesisUtterance(v.word);
                                  utterance.lang = language === "English" ? "en-US" : "ja-JP";
                                  window.speechSynthesis.speak(utterance);
                                }}
                                className="p-1 text-gray-300 hover:text-brand-accent transition-colors"
                              >
                                <Volume2 size={16} />
                              </button>
                            </div>
                            {v.phonetic && (
                              <span className="text-sm font-mono text-gray-400">
                                {v.phonetic}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-400 rounded-full flex items-center gap-1 font-bold uppercase">
                            {v.source === "翻译练习" ? <Languages size={10} /> : <Sparkles size={10} />}
                            {v.source}
                          </span>
                        </div>

                        <div className="space-y-2 pt-2">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">释义</span>
                            <div className="flex items-center gap-2">
                              <div className="w-1 h-4 bg-brand-accent/30 rounded-full" />
                              <p className="text-lg font-bold text-gray-800">{v.meaning}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 pt-4 border-t border-gray-50 flex justify-between items-center">
                        <span className="text-[10px] text-gray-300 font-medium">{v.date}</span>
                        <button
                          onClick={() => toggleMastered(v.word)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-gray-400 hover:text-green-600 hover:bg-green-50 border border-transparent hover:border-green-200 transition-all"
                          title="标记为已掌握"
                        >
                          <Check size={13} />
                          <span>已掌握</span>
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
