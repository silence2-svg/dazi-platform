// ===== 全局常量与状态定义 =====

export const APP_NAME = "搭子";
export const CAMPUS = "大连理工大学盘锦校区";

// ---- 帖子类型 ----
export const POST_TYPES = [
  { key: "study", label: "自习", emoji: "📚", color: "#3385fc" },
  { key: "basketball", label: "篮球", emoji: "🏀", color: "#f97316" },
  { key: "tennis", label: "网球", emoji: "🎾", color: "#84cc16" },
  { key: "badminton", label: "羽毛球", emoji: "🏸", color: "#a855f7" },
  { key: "carpool", label: "拼车", emoji: "🚗", color: "#14b8a6" },
  { key: "tournament", label: "比赛", emoji: "🏆", color: "#eab308" },
  { key: "other", label: "其他", emoji: "✨", color: "#64748b" },
] as const;

export type PostType = (typeof POST_TYPES)[number]["key"];

export const POST_TYPE_MAP: Record<string, (typeof POST_TYPES)[number]> =
  Object.fromEntries(POST_TYPES.map((t) => [t.key, t]));

export function postTypeLabel(key: string) {
  return POST_TYPE_MAP[key]?.label ?? "其他";
}
export function postTypeEmoji(key: string) {
  return POST_TYPE_MAP[key]?.emoji ?? "✨";
}

// ---- 校区地点库 ----
export const CAMPUS_LOCATIONS = [
  "图书馆",
  "图书馆自习室",
  "逸夫图书馆",
  "体育场",
  "篮球场",
  "网球馆",
  "羽毛球场",
  "乒乓球馆",
  "游泳馆",
  "第一食堂",
  "第二食堂",
  "第三食堂",
  "清真食堂",
  "校门口",
  "行政楼",
  "实验楼",
  "宿舍区",
  "大学生活动中心",
  "其他",
];

// ---- 帖子状态 ----
export const POST_STATUS = {
  SCHEDULED: "scheduled", // 定时发布，尚未可见
  OPEN: "open", // 报名中
  FULL: "full", // 已满员，自动停止报名
  CLOSED: "closed", // 已关闭报名（截止/手动）
  EXPIRED: "expired", // 活动已结束，尚未归档
  ARCHIVED: "archived", // 已归档，大厅不显示
  DELETED: "deleted", // 物理删除前标记
} as const;

export const POST_STATUS_LABEL: Record<string, string> = {
  scheduled: "待发布",
  open: "报名中",
  full: "已满",
  closed: "已关闭",
  expired: "已结束",
  archived: "已归档",
  deleted: "已删除",
};

// 大厅可见的状态
export const HALL_VISIBLE_STATUS = [
  POST_STATUS.OPEN,
  POST_STATUS.FULL,
  POST_STATUS.CLOSED,
];

// ---- 报名状态 ----
export const APP_STATUS = {
  PENDING: "pending", // 待确认
  CONFIRMED: "confirmed", // 已确认
  WAITLISTED: "waitlisted", // 候补
  REJECTED: "rejected", // 已拒绝
  CANCELLED: "cancelled", // 已取消
} as const;

export const APP_STATUS_LABEL: Record<string, string> = {
  pending: "待确认",
  confirmed: "已确认",
  waitlisted: "候补中",
  rejected: "已拒绝",
  cancelled: "已取消",
};

// ---- 通知类型 ----
export const NOTIFY_TYPES = {
  NEW_APPLICATION: "new_application",
  APPLICATION_CONFIRMED: "application_confirmed",
  APPLICATION_REJECTED: "application_rejected",
  WAITLIST_PROMOTED: "waitlist_promoted",
  POST_FULL: "post_full",
  EVENT_REMIND: "event_remind",
  POST_CANCELLED: "post_cancelled",
  POST_CLOSED: "post_closed",
  SYSTEM: "system",
  REPORT_RESOLVED: "report_resolved",
} as const;

// ---- 举报对象 ----
export const REPORT_TARGETS = ["post", "application", "user"] as const;

// ---- 频率限制（PRD 第八节）----
export const RATE_LIMITS = {
  postPerDay: 5,
  applyPerDay: 20,
  commentPerDay: 50,
};

// ---- 时间规则（PRD 第二节第4条）----
export const TIME_RULES = {
  // 从帖子可见到活动结束，最长不超过 15 天
  maxVisibleSpanDays: 15,
  // 归档保留天数
  archiveRetentionDays: 30,
  // 活动前提醒
  remindBeforeDays: 1,
  remindBeforeHours: 1,
  // 单帖最大人数
  maxParticipantsLimit: 50,
  minParticipants: 2,
  titleMaxLen: 40,
  descMaxLen: 500,
};

export const ARCHIVE_RETENTION_MS = TIME_RULES.archiveRetentionDays * 24 * 60 * 60 * 1000;
