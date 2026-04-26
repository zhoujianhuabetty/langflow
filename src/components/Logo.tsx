export default function Logo({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* 圆角方形背景 */}
      <rect width="48" height="48" rx="12" fill="url(#bg-gradient)" />

      {/* 字母 L — 简洁粗体 */}
      <path
        d="M14 12V34H26"
        stroke="white"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 流动波纹 — 代表语言流动 */}
      <path
        d="M22 20C25 16 29 24 32 20C35 16 38 22 38 22"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.9"
      />
      <path
        d="M22 28C25 24 29 32 32 28C35 24 38 30 38 30"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.6"
      />

      {/* 小圆点 — 像语言气泡 */}
      <circle cx="36" cy="14" r="2.5" fill="white" opacity="0.8" />

      <defs>
        <linearGradient id="bg-gradient" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00796B" />
          <stop offset="1" stopColor="#4DB6AC" />
        </linearGradient>
      </defs>
    </svg>
  );
}
