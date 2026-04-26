import { useState, useEffect, useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isToday } from "date-fns";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, ChevronRight, Languages, Sparkles, Clock, History as HistoryIcon, Calendar as CalendarIcon, BookOpen, Target, TrendingUp } from "lucide-react";
import { storage, TranslationRecord, DiaryRecord } from "../lib/storage";

export default function HistoryCalendar({ language }: { language: "English" | "Japanese" }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [records, setRecords] = useState<{ translations: TranslationRecord[], diaries: DiaryRecord[] }>({ translations: [], diaries: [] });

  useEffect(() => {
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const all = storage.getRecordsByDate(dateStr);
    setRecords({
      translations: all.translations.filter(r => r.language === language),
      diaries: all.diaries.filter(r => r.language === language),
    });
  }, [selectedDate, language]);

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const allTranslations = useMemo(() => storage.getTranslations().filter(r => r.language === language), [records, language]);
  const allDiaries = useMemo(() => storage.getDiaries().filter(r => r.language === language), [records, language]);

  const hasActivity = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return allTranslations.some(r => r.date === dateStr) || allDiaries.some(r => r.date === dateStr);
  };

  // Calculate stats for the selected date
  const stats = {
    translationCount: records.translations.length,
    diaryCount: records.diaries.length,
    vocabCount: storage.getExtractedVocab().filter((v: { date: string; language?: string }) => v.date === format(selectedDate, "yyyy-MM-dd") && (v.language || "English") === language).length
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 min-h-[600px]">
      {/* Left Column: Calendar & Quick Stats */}
      <div className="lg:w-[320px] space-y-6 flex-shrink-0">
        <div className="glass-card p-5 shadow-sm border-white/40">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <CalendarIcon size={18} className="text-brand-accent" />
              {format(currentMonth, "yyyy年 MMMM")}
            </h3>
            <div className="flex gap-1">
              <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"><ChevronLeft size={18} /></button>
              <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"><ChevronRight size={18} /></button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {["日", "一", "二", "三", "四", "五", "六"].map(d => (
              <span key={d} className="text-[10px] font-bold text-gray-400 uppercase py-1">{d}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const isSelected = isSameDay(day, selectedDate);
              const active = hasActivity(day);
              const today = isToday(day);
              
              return (
                <button
                  key={day.toString()}
                  onClick={() => setSelectedDate(day)}
                  className={`aspect-square flex flex-col items-center justify-center rounded-xl text-sm transition-all relative group
                    ${isSelected ? "bg-brand-accent text-white shadow-md scale-105 z-10" : "hover:bg-brand-accent/10 text-gray-600"}
                    ${today && !isSelected ? "ring-2 ring-brand-accent/30" : ""}
                  `}
                >
                  <span className={today && !isSelected ? "font-bold text-brand-accent" : ""}>
                    {format(day, "d")}
                  </span>
                  {active && !isSelected && (
                    <div className="absolute bottom-1.5 w-1 h-1 bg-brand-accent rounded-full group-hover:scale-150 transition-transform" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Daily Summary Card */}
        <div className="glass-card p-5 bg-gradient-to-br from-white/80 to-brand-accent/5 border-white/40">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <TrendingUp size={14} />
            当日学习概览
          </h4>
          <div className="grid grid-cols-1 gap-3">
            <button 
              onClick={() => document.getElementById("translations-section")?.scrollIntoView({ behavior: "smooth" })}
              disabled={stats.translationCount === 0}
              className="flex items-center justify-between p-3 bg-white/50 rounded-xl border border-white/60 hover:border-brand-accent/30 hover:shadow-sm transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-brand-accent/10 flex items-center justify-center text-brand-accent group-hover:bg-brand-accent group-hover:text-white transition-colors">
                  <Languages size={16} />
                </div>
                <span className="text-sm text-gray-600">翻译练习</span>
              </div>
              <span className="font-bold text-gray-800">{stats.translationCount}</span>
            </button>
            
            <button 
              onClick={() => document.getElementById("diaries-section")?.scrollIntoView({ behavior: "smooth" })}
              disabled={stats.diaryCount === 0}
              className="flex items-center justify-between p-3 bg-white/50 rounded-xl border border-white/60 hover:border-brand-secondary/30 hover:shadow-sm transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-brand-secondary/10 flex items-center justify-center text-brand-secondary group-hover:bg-brand-secondary group-hover:text-white transition-colors">
                  <Sparkles size={16} />
                </div>
                <span className="text-sm text-gray-600">AI 日记</span>
              </div>
              <span className="font-bold text-gray-800">{stats.diaryCount}</span>
            </button>

            <div className="flex items-center justify-between p-3 bg-white/50 rounded-xl border border-white/60">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
                  <Target size={16} />
                </div>
                <span className="text-sm text-gray-600">新增词汇</span>
              </div>
              <span className="font-bold text-gray-800">{stats.vocabCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Detailed Records */}
      <div className="flex-1 min-w-0 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-gray-800">
            <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-brand-accent border border-white/50">
              <Clock size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold">{format(selectedDate, "yyyy年MM月dd日")}</h2>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-widest">Study Records</p>
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {records.translations.length === 0 && records.diaries.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card p-16 flex flex-col items-center justify-center text-center gap-4 border-dashed border-2 border-gray-200 bg-transparent"
            >
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-gray-200">
                <HistoryIcon size={40} strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-400">暂无学习记录</h3>
                <p className="text-sm text-gray-300 max-w-[200px] mx-auto">这一天还没有开启学习之旅，快去练习吧！</p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 gap-6"
            >
              {/* Translations Section */}
              {records.translations.length > 0 && (
                <div id="translations-section" className="space-y-4 scroll-mt-24">
                  <h3 className="text-sm font-bold text-gray-400 flex items-center gap-2 px-1">
                    <Languages size={14} className="text-brand-accent" />
                    翻译练习回顾
                  </h3>
                  <div className="grid grid-cols-1 gap-4">
                    {records.translations.map((t) => (
                      <div key={t.id} className="glass-card p-5 space-y-4 border-l-4 border-l-brand-accent hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-brand-accent/10 text-brand-accent rounded-full uppercase tracking-wider">
                            {t.language}
                          </span>
                        </div>
                        <div className="space-y-3">
                          <div className="p-3 bg-gray-50/50 rounded-xl border border-gray-100">
                            <p className="text-lg font-medium text-gray-800 leading-relaxed">{t.chinese}</p>
                          </div>
                          <div className="grid sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold text-gray-400 uppercase px-1">你的翻译</p>
                              <div className="p-3 bg-white/50 rounded-xl border border-gray-100 text-sm text-gray-600 italic">
                                "{t.userTranslation}"
                              </div>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold text-brand-accent uppercase px-1">AI 参考</p>
                              <div className="p-3 bg-brand-accent/5 rounded-xl border border-brand-accent/10 text-sm text-gray-800 font-medium">
                                {t.reference}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Diaries Section */}
              {records.diaries.length > 0 && (
                <div id="diaries-section" className="space-y-4 scroll-mt-24">
                  <h3 className="text-sm font-bold text-gray-400 flex items-center gap-2 px-1">
                    <Sparkles size={14} className="text-brand-secondary" />
                    AI 日记润色回顾
                  </h3>
                  <div className="grid grid-cols-1 gap-4">
                    {records.diaries.map((d) => (
                      <div key={d.id} className="glass-card p-5 space-y-4 border-l-4 border-l-brand-secondary hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-brand-secondary/10 text-brand-secondary rounded-full uppercase tracking-wider">
                            {d.language}
                          </span>
                        </div>
                        <div className="space-y-4">
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-gray-400 uppercase px-1">原始日记</p>
                            <div className="p-4 bg-gray-50/50 rounded-xl border border-gray-100 text-sm text-gray-600 leading-relaxed italic">
                              {d.content}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-brand-secondary uppercase px-1">AI 润色版</p>
                            <div className="p-4 bg-brand-secondary/5 rounded-xl border border-brand-secondary/10 text-sm text-gray-800 leading-relaxed font-medium">
                              {d.polished}
                            </div>
                          </div>
                          
                          {d.errorSummary && (
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold text-red-400 uppercase px-1">错误总结</p>
                              <p className="text-xs text-red-600/70 bg-red-50/30 p-3 rounded-xl border border-red-100/30">{d.errorSummary}</p>
                            </div>
                          )}

                          {d.patterns && d.patterns.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-[10px] font-bold text-gray-400 uppercase px-1">核心句型</p>
                              <div className="grid gap-2">
                                {d.patterns.map((p, i) => (
                                  <div key={i} className="p-3 bg-white/50 rounded-xl border border-gray-100 text-xs">
                                    <code className="text-brand-secondary font-bold block mb-1">{p.pattern}</code>
                                    <span className="text-gray-500">{p.meaning}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
