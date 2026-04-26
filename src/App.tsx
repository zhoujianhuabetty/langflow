/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import {
  Languages,
  BookOpen,
  BarChart3,
  Sparkles,
  History as HistoryIcon,
  LogIn,
  LogOut,
  User as UserIcon
} from "lucide-react";
import TranslationPractice from "./components/TranslationPractice";
import DiaryPolishing from "./components/DiaryPolishing";
import HistoryCalendar from "./components/HistoryCalendar";
import VocabularyList from "./components/VocabularyList";
import Stats from "./components/Stats";
import AuthModal from "./components/AuthModal";
import Logo from "./components/Logo";
import { checkAuth, logout as authLogout, type AuthUser } from "./lib/auth";
import { storage } from "./lib/storage";

type Tab = "practice" | "diary" | "history" | "vocab" | "stats";

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("practice");
  const [language, setLanguage] = useState<"English" | "Japanese">("English");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");

  useEffect(() => {
    checkAuth().then(async (u) => {
      setUser(u);
      setAuthLoading(false);
      // 登录状态下，启动时从服务器恢复数据 + 上传本地数据
      if (u) {
        await storage.restoreFromServer();
        storage.syncToServer();
      }
    });
  }, []);

  const handleOpenAuth = (mode: "login" | "register") => {
    setAuthMode(mode);
    setIsAuthModalOpen(true);
  };

  // 登录/注册成功后恢复数据
  const handleAuthSuccess = async (u: AuthUser) => {
    setUser(u);
    const restored = await storage.restoreFromServer();
    storage.syncToServer();
    if (restored) {
      // 刷新页面让所有组件重新读取 localStorage
      window.location.reload();
    }
  };

  const handleLogout = () => {
    // 退出前同步一次
    storage.syncToServer();
    authLogout();
    setUser(null);
  };

  const tabs = [
    { id: "practice", label: "翻译练习", icon: Languages },
    { id: "diary", label: "AI 日记", icon: Sparkles },
    { id: "history", label: "历史记录", icon: HistoryIcon },
    { id: "vocab", label: "词汇积累", icon: BookOpen },
    { id: "stats", label: "学习统计", icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen flex flex-col max-w-[1440px] mx-auto px-4">
      {/* Header & Navigation */}
      <div className="sticky top-0 z-50 bg-[#f8fafc]/80 backdrop-blur-md pt-8 pb-4">
        <header className="flex flex-col md:flex-row justify-between items-center gap-6 mb-6">
          <div className="flex items-center gap-3">
            <Logo size={40} />
            <h1 className="text-2xl font-bold text-brand-accent tracking-tight">LangFlow</h1>
          </div>

          <div className="hidden md:flex bg-white/50 p-1 rounded-2xl border border-white/30 shadow-sm">
            <nav className="flex gap-1 items-center">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as Tab)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${isActive ? "bg-brand-accent text-white shadow-md" : "text-gray-500 hover:bg-white/50"}`}
                  >
                    <Icon size={18} />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex gap-2 bg-white/50 p-1 rounded-full border border-white/30 shadow-sm">
              <button
                onClick={() => setLanguage("English")}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${language === "English" ? "bg-brand-accent text-white shadow-md" : "text-gray-600 hover:bg-white/50"}`}
              >
                English
              </button>
              <button
                onClick={() => setLanguage("Japanese")}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${language === "Japanese" ? "bg-brand-accent text-white shadow-md" : "text-gray-600 hover:bg-white/50"}`}
              >
                日本語
              </button>
            </div>

            {authLoading ? (
              <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
            ) : user ? (
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-end hidden sm:flex">
                  <span className="text-xs font-bold text-gray-800">{user.displayName || "学习者"}</span>
                  <span className="text-[10px] text-gray-400">{user.email}</span>
                </div>
                <div className="w-8 h-8 rounded-full bg-brand-accent/10 flex items-center justify-center text-brand-accent border border-brand-accent/20">
                  <UserIcon size={16} />
                </div>
                <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-red-500 transition-colors" title="退出登录">
                  <LogOut size={20} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenAuth("login")}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-brand-accent hover:bg-brand-accent/5 rounded-xl transition-all"
                >
                  登录
                </button>
                <button
                  onClick={() => handleOpenAuth("register")}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-accent text-white rounded-xl text-sm font-bold shadow-sm hover:shadow-brand-accent/20 transition-all"
                >
                  注册
                </button>
              </div>
            )}
          </div>
        </header>
        <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent opacity-50" />
      </div>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
        initialMode={authMode}
      />

      {/* Main Content — 所有 tab 始终挂载，用 display 控制显隐，切换不丢状态 */}
      <main className="flex-1 relative pt-4 pb-24 md:pb-12">
        <div className="h-full" style={{ display: activeTab === "practice" ? "block" : "none" }}>
          <TranslationPractice language={language} />
        </div>
        <div className="h-full" style={{ display: activeTab === "diary" ? "block" : "none" }}>
          <DiaryPolishing language={language} />
        </div>
        <div className="h-full" style={{ display: activeTab === "history" ? "block" : "none" }}>
          <HistoryCalendar language={language} />
        </div>
        <div className="h-full" style={{ display: activeTab === "vocab" ? "block" : "none" }}>
          <VocabularyList language={language} />
        </div>
        <div className="h-full" style={{ display: activeTab === "stats" ? "block" : "none" }}>
          <Stats />
        </div>
      </main>

      {/* Mobile Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden bg-white/90 backdrop-blur-md border-t border-gray-200/50 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 transition-colors ${isActive ? "text-brand-accent" : "text-gray-400"}`}
            >
              <Icon size={20} />
              <span className="text-[10px] font-bold">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
