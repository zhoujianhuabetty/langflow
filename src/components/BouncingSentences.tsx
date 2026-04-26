import React, { useState, useEffect } from "react";
import { motion } from "motion/react";

interface Sentence {
  id: string;
  chinese: string;
  category: string;
  difficulty: string;
}

interface BouncingSentencesProps {
  sentences: Sentence[];
  onSelect: (s: Sentence) => void;
  selectedId?: string;
}

export default function BouncingSentences({ sentences, onSelect, selectedId }: BouncingSentencesProps) {
  const [baseLaneCount, setBaseLaneCount] = useState(3);

  useEffect(() => {
    const updateLaneCount = () => {
      setBaseLaneCount(window.innerWidth < 768 ? 2 : 3);
    };
    updateLaneCount();
    window.addEventListener("resize", updateLaneCount);
    return () => window.removeEventListener("resize", updateLaneCount);
  }, []);

  const total = sentences.length;

  // 句子 ≤5 时用静态浮动布局，避免复制滚动导致视觉重复
  if (total <= 5) {
    return (
      <div className="relative w-full h-full overflow-hidden flex items-center justify-center">
        <div className="flex flex-wrap gap-6 justify-center items-center max-w-[80%]">
          {sentences.map((s, i) => (
            <motion.button
              key={s.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: [0, -16, 0] }}
              transition={{
                opacity: { duration: 0.3, delay: i * 0.1 },
                y: { duration: 3.5 + i * 0.8, repeat: Infinity, ease: "easeInOut", delay: i * 0.4 },
              }}
              onClick={() => onSelect(s)}
              className={`px-4 md:px-6 py-2 md:py-3 rounded-2xl text-sm md:text-lg font-medium shadow-lg transition-all relative group
                ${selectedId === s.id
                  ? "bg-brand-accent text-white scale-110 z-10 shadow-brand-accent/40 ring-4 ring-white/50"
                  : "bg-white/90 text-gray-700 hover:bg-white hover:scale-105 z-0 border border-white/50 backdrop-blur-sm"}`}
            >
              <span className={`absolute -top-2 -left-1 px-1.5 py-0.5 rounded-md text-[8px] md:text-[10px] font-bold uppercase tracking-tighter shadow-sm
                ${selectedId === s.id ? "bg-white text-brand-accent" : "bg-brand-accent text-white"}`}>
                {s.category}
              </span>
              <span className="block text-center leading-tight">
                {s.chinese}
              </span>
            </motion.button>
          ))}
        </div>
        <div className="absolute inset-0 pointer-events-none z-20">
          <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-brand-background via-brand-background/80 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-brand-background via-brand-background/80 to-transparent" />
        </div>
      </div>
    );
  }

  // 句子 ≥6 时用滚动布局，动态计算泳道数确保每条泳道至少 3 个句子
  const laneCount = Math.min(baseLaneCount, Math.max(1, Math.floor(total / 3)));

  const lanes: Sentence[][] = Array.from({ length: laneCount }, () => []);
  sentences.forEach((s, i) => {
    lanes[i % laneCount].push(s);
  });

  return (
    <div className={`relative w-full h-full overflow-hidden grid gap-4 py-0 bg-gradient-to-b from-transparent via-white/5 to-transparent ${laneCount === 1 ? 'grid-cols-1' : laneCount === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
      {lanes.map((lane, laneIndex) => (
        <div key={laneIndex} className="flex flex-col items-center h-full relative min-w-0">
          <motion.div
            animate={{
              y: ["0%", "-50%"],
            }}
            transition={{
              duration: 25 + laneIndex * 8,
              repeat: Infinity,
              ease: "linear",
            }}
            className="flex flex-col gap-24 md:gap-32 items-center py-10"
          >
            {[...lane, ...lane].map((s, i) => (
              <button
                key={`${s.id}-${i}`}
                onClick={() => onSelect(s)}
                className={`px-4 md:px-6 py-2 md:py-3 rounded-2xl text-sm md:text-lg font-medium shadow-lg transition-all relative group max-w-[90%] break-words
                  ${selectedId === s.id
                    ? "bg-brand-accent text-white scale-110 z-10 shadow-brand-accent/40 ring-4 ring-white/50"
                    : "bg-white/90 text-gray-700 hover:bg-white hover:scale-105 z-0 border border-white/50 backdrop-blur-sm"}`}
              >
                <span className={`absolute -top-2 -left-1 px-1.5 py-0.5 rounded-md text-[8px] md:text-[10px] font-bold uppercase tracking-tighter shadow-sm
                  ${selectedId === s.id ? "bg-white text-brand-accent" : "bg-brand-accent text-white"}`}>
                  {s.category}
                </span>
                <span className="block text-center leading-tight">
                  {s.chinese}
                </span>
              </button>
            ))}
          </motion.div>
        </div>
      ))}

      <div className="absolute inset-0 pointer-events-none z-20">
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-brand-background via-brand-background/80 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-brand-background via-brand-background/80 to-transparent" />
      </div>
    </div>
  );
}
