import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { BookOpen, GraduationCap, History, Sparkles, Languages, Volume2, Check, ChevronRight, ChevronDown, ChevronLeft } from "lucide-react";
import { storage } from "../lib/storage";

const MASTERED_KEY = "langflow_mastered_vocab";
const PAGE_SIZE_MOBILE = 6;
const PAGE_SIZE_DESKTOP = 9;

function getMastered(): Set<string> {
  const data = localStorage.getItem(MASTERED_KEY);
  return data ? new Set(JSON.parse(data)) : new Set();
}

function saveMastered(set: Set<string>) {
  localStorage.setItem(MASTERED_KEY, JSON.stringify([...set]));
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

export default function VocabularyList({ language }: { language: "English" | "Japanese" }) {
  const [extractedVocab, setExtractedVocab] = useState<any[]>([]);
  const [mastered, setMastered] = useState<Set<string>>(getMastered);
  const [masteredCollapsed, setMasteredCollapsed] = useState(true);
  const [unmasteredCollapsed, setUnmasteredCollapsed] = useState(false);
  const [page, setPage] = useState(0);
  const isMobile = useIsMobile();

  useEffect(() => {
    setExtractedVocab(storage.getExtractedVocab());
  }, []);

  // 语言切换时重置页码
  useEffect(() => { setPage(0); }, [language]);

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

  // 分页
  const pageSize = isMobile ? PAGE_SIZE_MOBILE : PAGE_SIZE_DESKTOP;
  const totalPages = Math.max(1, Math.ceil(unmastered.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pagedUnmastered = unmastered.slice(safePage * pageSize, (safePage + 1) * pageSize);

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

      {/* 主内容区 */}
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
        <div className="flex flex-col md:flex-row gap-6">
          {/* 已掌握词汇折叠列表 */}
          {masteredList.length > 0 && (
            <div className="w-full md:w-48 md:shrink-0">
              <div className="glass-card p-4 md:sticky md:top-40">
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

          {/* 待学词汇卡片 */}
          <div className="flex-1 min-w-0">
            <div className="glass-card p-4 md:p-0 md:bg-transparent md:shadow-none md:border-0">
              {/* 待学折叠按钮 */}
              <button
                onClick={() => setUnmasteredCollapsed(!unmasteredCollapsed)}
                className="flex items-center gap-2 w-full text-gray-600 hover:opacity-80 transition-opacity mb-4 md:mb-4"
              >
                {unmasteredCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                <span className="text-xs font-bold uppercase tracking-wider">待学词汇 ({unmastered.length})</span>
              </button>

              <AnimatePresence>
                {!unmasteredCollapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    {unmastered.length === 0 ? (
                      <div className="p-8 flex flex-col items-center justify-center text-center gap-4">
                        <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center text-green-500">
                          <Check size={32} />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-700">全部掌握！</h3>
                          <p className="text-sm text-gray-400 mt-1">当前{language === "English" ? "英语" : "日语"}词汇已全部标记为已掌握。</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
                          <AnimatePresence mode="popLayout">
                            {pagedUnmastered.map((v, i) => (
                              <motion.div
                                key={v.word}
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ delay: i * 0.03 }}
                                className="glass-card p-3 md:p-6 flex flex-col justify-between group hover:shadow-brand-accent/10 transition-all border-white/40"
                              >
                                <div className="space-y-2 md:space-y-4">
                                  <div className="flex justify-between items-start">
                                    <div className="space-y-0.5 md:space-y-1 min-w-0">
                                      <div className="flex items-center gap-1 md:gap-2">
                                        <h3 className="text-base md:text-2xl font-bold text-brand-accent group-hover:scale-105 transition-transform origin-left truncate">
                                          {v.word}
                                        </h3>
                                        <button
                                          onClick={() => {
                                            if (!('speechSynthesis' in window)) return;
                                            const utterance = new SpeechSynthesisUtterance(v.word);
                                            utterance.lang = language === "English" ? "en-US" : "ja-JP";
                                            window.speechSynthesis.speak(utterance);
                                          }}
                                          className="p-1 text-gray-300 hover:text-brand-accent transition-colors shrink-0"
                                        >
                                          <Volume2 size={14} className="md:w-4 md:h-4" />
                                        </button>
                                      </div>
                                      {v.phonetic && (
                                        <span className="text-xs md:text-sm font-mono text-gray-400 block truncate">
                                          {v.phonetic}
                                        </span>
                                      )}
                                    </div>
                                    <span className="hidden md:flex text-[10px] px-2 py-0.5 bg-gray-100 text-gray-400 rounded-full items-center gap-1 font-bold uppercase shrink-0">
                                      {v.source === "翻译练习" ? <Languages size={10} /> : <Sparkles size={10} />}
                                      {v.source}
                                    </span>
                                  </div>

                                  <div className="space-y-1 md:space-y-2 md:pt-2">
                                    <div className="flex flex-col gap-0.5 md:gap-1">
                                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">释义</span>
                                      <div className="flex items-center gap-1.5 md:gap-2">
                                        <div className="w-0.5 md:w-1 h-3 md:h-4 bg-brand-accent/30 rounded-full" />
                                        <p className="text-sm md:text-lg font-bold text-gray-800">{v.meaning}</p>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-3 md:mt-6 pt-2 md:pt-4 border-t border-gray-50 flex justify-between items-center">
                                  <span className="text-[10px] text-gray-300 font-medium">{v.date}</span>
                                  <button
                                    onClick={() => toggleMastered(v.word)}
                                    className="flex items-center gap-1 px-2 py-0.5 md:px-2.5 md:py-1 rounded-lg text-[10px] md:text-[11px] font-bold text-gray-400 hover:text-green-600 hover:bg-green-50 border border-transparent hover:border-green-200 transition-all"
                                    title="标记为已掌握"
                                  >
                                    <Check size={12} />
                                    <span>已掌握</span>
                                  </button>
                                </div>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                        </div>

                        {/* 翻页 */}
                        {totalPages > 1 && (
                          <div className="flex items-center justify-center gap-3 mt-6">
                            <button
                              onClick={() => setPage(p => Math.max(0, p - 1))}
                              disabled={safePage === 0}
                              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                              <ChevronLeft size={18} />
                            </button>
                            <span className="text-sm text-gray-500 font-medium">
                              {safePage + 1} / {totalPages}
                            </span>
                            <button
                              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                              disabled={safePage >= totalPages - 1}
                              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                              <ChevronRight size={18} />
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
