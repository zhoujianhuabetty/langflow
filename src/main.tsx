import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// 数据迁移：lingoflow_* → langflow_*（合并旧数据，不丢失历史记录）
(() => {
  const keys = Object.keys(localStorage);
  for (const key of keys) {
    if (!key.startsWith("lingoflow_")) continue;
    const newKey = key.replace("lingoflow_", "langflow_");
    const oldVal = localStorage.getItem(key);
    if (!oldVal) continue;

    const newVal = localStorage.getItem(newKey);
    if (!newVal) {
      // 新 key 不存在，直接复制
      localStorage.setItem(newKey, oldVal);
    } else {
      // 新 key 已存在，尝试合并数组类型数据（翻译记录、日记记录、词汇等）
      try {
        const oldData = JSON.parse(oldVal);
        const newData = JSON.parse(newVal);
        if (Array.isArray(oldData) && Array.isArray(newData)) {
          // 按 id 去重合并，旧数据在后（新数据优先）
          const existingIds = new Set(newData.map((item: any) => item.id).filter(Boolean));
          const merged = [...newData, ...oldData.filter((item: any) => item.id && !existingIds.has(item.id))];
          localStorage.setItem(newKey, JSON.stringify(merged));
        }
      } catch {
        // 非 JSON 或非数组，跳过不覆盖
      }
    }
    // 迁移完成后删除旧 key，避免重复合并
    localStorage.removeItem(key);
  }
})();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
