import React, { useMemo } from "react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from "recharts";
import { TrendingUp, Award, Zap, Target } from "lucide-react";
import { storage } from "../lib/storage";
import { format, subDays, eachDayOfInterval, isSameDay } from "date-fns";

export default function Stats() {
  const translations = storage.getTranslations();
  const diaries = storage.getDiaries();

  const last7Days = useMemo(() => {
    const end = new Date();
    const start = subDays(end, 6);
    const interval = eachDayOfInterval({ start, end });

    return interval.map(date => {
      const dateStr = format(date, "yyyy-MM-dd");
      const count = translations.filter(t => t.date === dateStr).length + 
                    diaries.filter(d => d.date === dateStr).length;
      return {
        name: format(date, "MM/dd"),
        count
      };
    });
  }, [translations, diaries]);

  const langStats = useMemo(() => {
    const en = translations.filter(t => t.language === "English").length + 
               diaries.filter(d => d.language === "English").length;
    const jp = translations.filter(t => t.language === "Japanese").length + 
               diaries.filter(d => d.language === "Japanese").length;
    return [
      { name: "English", value: en, color: "#4DB6AC" },
      { name: "Japanese", value: jp, color: "#2D5A27" }
    ];
  }, [translations, diaries]);

  const totalPractice = translations.length + diaries.length;

  return (
    <div className="space-y-8">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard 
          icon={<Zap className="text-yellow-500" />} 
          label="总练习次数" 
          value={totalPractice} 
          sub="累计完成"
        />
        <StatCard 
          icon={<Target className="text-red-500" />} 
          label="今日目标" 
          value={translations.filter(t => t.date === format(new Date(), "yyyy-MM-dd")).length} 
          sub="/ 10 句"
        />
        <StatCard 
          icon={<TrendingUp className="text-green-500" />} 
          label="连续打卡" 
          value={totalPractice > 0 ? 1 : 0} 
          sub="天"
        />
        <StatCard 
          icon={<Award className="text-purple-500" />} 
          label="掌握词汇" 
          value={translations.length * 2} 
          sub="个"
        />
      </div>

      <div className="grid md:grid-cols-[1fr_300px] gap-8">
        {/* Activity Chart */}
        <div className="glass-card p-8">
          <h3 className="text-lg font-bold text-gray-800 mb-8">近 7 日活跃度</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={last7Days}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#999', fontSize: 12 }}
                />
                <YAxis hide />
                <Tooltip 
                  cursor={{ fill: 'rgba(77, 182, 172, 0.1)' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {last7Days.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 6 ? "#2D5A27" : "#4DB6AC"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Language Distribution */}
        <div className="glass-card p-8 flex flex-col items-center">
          <h3 className="text-lg font-bold text-gray-800 mb-8 w-full">语言分布</h3>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={langStats}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {langStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col gap-2 mt-4 w-full">
            {langStats.map((s) => (
              <div key={s.name} className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-gray-600">{s.name}</span>
                </div>
                <span className="font-bold text-gray-800">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode, label: string, value: number, sub: string }) {
  return (
    <div className="glass-card p-6 flex flex-col gap-2">
      <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm border border-gray-50">
        {icon}
      </div>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-2">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-black text-gray-800">{value}</span>
        <span className="text-xs text-gray-400 font-medium">{sub}</span>
      </div>
    </div>
  );
}
