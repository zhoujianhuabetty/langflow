import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Mail, Lock, User, LogIn, UserPlus, AlertCircle } from "lucide-react";
import { register, login, type AuthUser } from "../lib/auth";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: AuthUser) => void;
  initialMode?: "login" | "register";
}

export default function AuthModal({ isOpen, onClose, onSuccess, initialMode = "login" }: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const switchMode = (newMode: "login" | "register") => {
    setMode(newMode);
    setError("");
  };

  React.useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError("");
    }
  }, [isOpen, initialMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "register") {
        const result = await register(email, password, displayName);
        onSuccess(result.user);
      } else {
        const result = await login(email, password);
        onSuccess(result.user);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || "操作失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 transition-colors z-20 bg-white/80 backdrop-blur-sm rounded-full"
          >
            <X size={20} />
          </button>

          <div className="overflow-y-auto p-6 sm:p-8 custom-scrollbar">
            <div className="flex bg-gray-100 p-1.5 rounded-2xl mb-6 sm:mb-10 relative">
              <motion.div
                layoutId="activeTab"
                className="absolute inset-1 w-[calc(50%-4px)] bg-white rounded-xl shadow-sm"
                initial={false}
                animate={{ x: mode === "login" ? 0 : "100%" }}
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
              <button
                onClick={() => switchMode("login")}
                className={`flex-1 py-2.5 sm:py-3 rounded-xl text-sm font-bold transition-all relative z-10 ${
                  mode === "login" ? "text-brand-accent" : "text-gray-400 hover:text-gray-600"
                }`}
              >
                登录账号
              </button>
              <button
                onClick={() => switchMode("register")}
                className={`flex-1 py-2.5 sm:py-3 rounded-xl text-sm font-bold transition-all relative z-10 ${
                  mode === "register" ? "text-brand-accent" : "text-gray-400 hover:text-gray-600"
                }`}
              >
                新用户注册
              </button>
            </div>

            <div className="mb-6 sm:mb-8">
              <h2 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">
                {mode === "login" ? "欢迎回来" : "创建账号"}
              </h2>
              <p className="text-gray-500 mt-2 sm:mt-3 text-base sm:text-lg">
                {mode === "login"
                  ? "继续您的语言学习之旅"
                  : "开启 AI 驱动的沉浸式学习体验"}
              </p>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 sm:mb-8 p-4 sm:p-5 bg-red-50 border border-red-100 rounded-3xl flex items-start gap-4 text-red-600 shadow-sm"
              >
                <AlertCircle size={22} className="shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">操作受阻</p>
                  <p className="text-sm opacity-90 leading-relaxed">{error}</p>
                </div>
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
              <AnimatePresence mode="wait">
                {mode === "register" && (
                  <motion.div
                    key="name-field"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="relative"
                  >
                    <User className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="text"
                      required
                      placeholder="您的昵称"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full pl-14 pr-5 py-3 sm:py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-brand-accent/20 outline-none transition-all text-base sm:text-lg"
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="relative">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="email"
                  required
                  placeholder="电子邮箱"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-14 pr-5 py-3 sm:py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-brand-accent/20 outline-none transition-all text-base sm:text-lg"
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="密码（至少 6 位）"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-14 pr-5 py-3 sm:py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-brand-accent/20 outline-none transition-all text-base sm:text-lg"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-accent text-white py-3 sm:py-4 rounded-2xl font-black text-base sm:text-lg shadow-xl shadow-brand-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {mode === "login" ? <LogIn size={22} /> : <UserPlus size={22} />}
                {loading ? "处理中..." : (mode === "login" ? "登录 LangFlow" : "立即加入")}
              </button>
            </form>

            <p className="text-center mt-8 sm:mt-10 text-gray-500 font-medium text-sm sm:text-base">
              {mode === "login" ? "还没有账号？" : "已经有账号了？"}
              <button
                onClick={() => switchMode(mode === "login" ? "register" : "login")}
                className="ml-2 text-brand-accent font-black hover:underline underline-offset-4"
              >
                {mode === "login" ? "立即注册" : "返回登录"}
              </button>
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
