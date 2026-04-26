import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, RefreshCw, CheckCircle2, Copy, Trash2 } from "lucide-react";
import { polishDiaryStream, polishDiaryFast } from "../lib/gemini";
import { storage } from "../lib/storage";

export default function DiaryPolishing({ language }: { language: "English" | "Japanese" }) {
  const [content, setContent] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [upgrading, setUpgrading] = useState(false);

  const handlePolish = async () => {
    if (!content.trim()) return;
    setLoading(true);
    setResult(null);
    setStreamingText("");
    setUpgrading(false);

    // 双轨并行：GLM-4-flash 快速出初版 + GLM-5 出精修版
    let qualityDone = false;
    let savedFastResult: any = null;

    const fastPromise = polishDiaryFast(content, language)
      .then(result => {
        savedFastResult = result;
        if (result && !result.error && !qualityDone) {
          setResult(result);
          setLoading(false);
          setUpgrading(true);
        }
        return result;
      });

    const qualityPromise = polishDiaryStream(content, language, (data) => {
      if (data.text) setStreamingText(data.text);
    }).then(result => {
      qualityDone = true;
      if (result) {
        setResult(result);
        setStreamingText("");
        setUpgrading(false);
        storage.saveDiary({
          content, polished: result.polished,
          errorSummary: result.errorSummary, patterns: result.patterns, language
        });
        if (result.vocabulary) {
          result.vocabulary.forEach((v: any) => {
            storage.saveExtractedVocab(v.word, v.meaning, "AI 日记", v.phonetic, language);
          });
        }
      }
      return result;
    });

    // 等两个都完成
    await Promise.allSettled([fastPromise, qualityPromise]);

    // 如果 GLM-5 没出结果但 fast 出了，用 fast 存储
    if (!qualityDone || !(await qualityPromise)) {
      if (savedFastResult && !savedFastResult.error) {
        setResult(savedFastResult);
        storage.saveDiary({
          content, polished: savedFastResult.polished,
          errorSummary: savedFastResult.errorSummary, patterns: savedFastResult.patterns, language
        });
        if (savedFastResult.vocabulary) {
          savedFastResult.vocabulary.forEach((v: any) => {
            storage.saveExtractedVocab(v.word, v.meaning, "AI 日记", v.phonetic, language);
          });
        }
      }
    }
    setLoading(false);
    setUpgrading(false);
  };

  const handleClear = () => {
    setContent("");
    setResult(null);
  };

  return (
    <div className="flex flex-col gap-8 h-full">
      <div className="glass-card p-8 flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">AI 润色日记</h2>
            <p className="text-sm text-gray-500 mt-1">用{language === "English" ? "英语" : "日语"}记录你的生活，让 AI 帮你提升表达。</p>
          </div>
          <button 
            onClick={handleClear}
            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
          >
            <Trash2 size={20} />
          </button>
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="在这里写下你的日记..."
          className="w-full h-48 p-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-brand-secondary focus:border-transparent outline-none resize-none bg-white/50"
        />

        <button
          disabled={loading || !content.trim()}
          onClick={handlePolish}
          className="w-full bg-brand-accent text-white py-4 rounded-xl font-bold shadow-lg hover:shadow-brand-accent/20 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:scale-100"
        >
          {loading ? (
            <>
              <RefreshCw className="animate-spin" size={20} />
              <span>AI 正在润色中...</span>
            </>
          ) : (
            <>
              <Sparkles size={20} />
              <span>开始润色</span>
            </>
          )}
        </button>
      </div>

      {/* 加载中 */}
      {loading && (
        <div className="glass-card p-8 flex items-center gap-3">
          <RefreshCw className="animate-spin text-brand-accent" size={18} />
          <span className="text-sm text-gray-500">AI 专家正在润色你的日记...</span>
        </div>
      )}

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-8 space-y-8"
          >
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-brand-accent">
                  <CheckCircle2 size={20} />
                  <h3 className="font-bold">润色后的内容</h3>
                </div>
                <div className="flex items-center gap-2">
                  {upgrading && (
                    <span className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
                      <RefreshCw className="animate-spin" size={12} />
                      正在升级为高质量润色...
                    </span>
                  )}
                  <button
                    onClick={() => navigator.clipboard.writeText(result.polished)}
                    className="text-gray-400 hover:text-brand-accent transition-colors"
                  >
                    <Copy size={18} />
                  </button>
                </div>
              </div>
              <p className="text-lg text-gray-800 leading-relaxed bg-brand-accent/5 p-6 rounded-2xl border border-brand-accent/10">
                {result.polished}
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <span className="text-xs font-bold text-gray-400 uppercase">修改说明</span>
                <p className="text-sm text-gray-600 leading-relaxed">{result.corrections}</p>
              </div>
              <div className="space-y-2">
                <span className="text-xs font-bold text-gray-400 uppercase">错误总结</span>
                <p className="text-sm text-red-600/80 leading-relaxed bg-red-50/50 p-3 rounded-xl border border-red-100/50">{result.errorSummary}</p>
              </div>
            </div>

            {result.patterns && result.patterns.length > 0 && (
              <div className="space-y-3">
                <span className="text-xs font-bold text-gray-400 uppercase">核心句型提取</span>
                <div className="grid gap-3">
                  {result.patterns.map((p: any, i: number) => (
                    <div key={i} className="p-4 bg-brand-secondary/5 rounded-xl border border-brand-secondary/10 flex flex-col gap-1">
                      <code className="text-brand-secondary font-bold">{p.pattern}</code>
                      <span className="text-xs text-gray-500">{p.meaning}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.vocabulary && result.vocabulary.length > 0 && (
              <div className="pt-6 border-t border-gray-100">
                <span className="text-xs font-bold text-gray-400 uppercase">重点词汇 (CET-6/雅思/托福)</span>
                <div className="flex flex-wrap gap-2 mt-3">
                  {result.vocabulary.map((v: any, i: number) => (
                    <div key={i} className="px-3 py-1.5 bg-white rounded-xl border border-gray-100 shadow-sm text-xs flex items-center gap-2">
                      <span className="font-bold text-brand-accent">{v.word}</span>
                      <span className="w-px h-3 bg-gray-200" />
                      <span className="text-gray-600">{v.meaning}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
