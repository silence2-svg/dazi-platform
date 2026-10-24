export function fmtDateTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fmtTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 用于 <input type="datetime-local"> */
export function toLocalInput(d: Date | string | null | undefined) {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

/** 相对时间：刚刚 / 3 分钟前 / 昨天 14:30 */
export function fmtRelative(d: Date | string) {
  const date = d instanceof Date ? d : new Date(d);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins} 分钟前`;

  const hours = Math.floor(mins / 60);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  if (isToday) return `${hours} 小时前`;
  if (hours < 48) return `昨天 ${fmtTime(date)}`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  return fmtDate(date);
}

/** 活动开始倒计时文案 */
export function countdownText(eventStart: Date | string) {
  const date = eventStart instanceof Date ? eventStart : new Date(eventStart);
  const diff = date.getTime() - Date.now();
  if (diff <= 0) return "已开始";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} 分钟后`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时后`;
  return `${Math.floor(hours / 24)} 天后`;
}

export function formatSlot(d: Date | string) {
  return `${fmtDate(d)} ${fmtTime(d)}`;
}

/** 把 DateTime 转成时间戳秒（用于 cron 判断） */
export function atHour(base: Date, hour: number, dayOffset = 0) {
  const d = new Date(base);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d;
}
