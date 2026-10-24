import { TIME_RULES } from "./constants";

export type FieldErrors = Record<string, string>;

/**
 * 发帖校验（PRD 第二节第4条 + 第四节第2条）
 * 规则：
 *  - 报名截止时间 ≤ 活动开始时间
 *  - 活动结束时间 ≥ 活动开始时间
 *  - 从可见时间到活动结束 ≤ 15 天
 *  - 人数上限 ≥ 2
 */
export function validatePostInput(
  input: {
    type?: string;
    title?: string;
    description?: string;
    location?: string;
    visibleAt?: Date | string | null;
    signupDeadline?: Date | string | null;
    eventStart?: Date | string | null;
    eventEnd?: Date | string | null;
    maxParticipants?: number;
  },
  now: Date = new Date()
): FieldErrors {
  const errors: FieldErrors = {};

  if (!input.type) errors.type = "请选择类型";
  if (!input.title || !input.title.trim()) errors.title = "请填写标题";
  else if (input.title.trim().length > TIME_RULES.titleMaxLen)
    errors.title = `标题不超过 ${TIME_RULES.titleMaxLen} 字`;
  if (!input.location || !input.location.trim()) errors.location = "请选择地点";
  if (input.description && input.description.length > TIME_RULES.descMaxLen)
    errors.description = `说明不超过 ${TIME_RULES.descMaxLen} 字`;

  const visibleAt = toDate(input.visibleAt);
  const signupDeadline = toDate(input.signupDeadline);
  const eventStart = toDate(input.eventStart);
  const eventEnd = toDate(input.eventEnd);

  if (!visibleAt) errors.visibleAt = "请设置可见时间";
  if (!signupDeadline) errors.signupDeadline = "请设置报名截止时间";
  if (!eventStart) errors.eventStart = "请设置活动开始时间";
  if (!eventEnd) errors.eventEnd = "请设置活动结束时间";

  const max = input.maxParticipants ?? 0;
  if (!Number.isFinite(max) || max < TIME_RULES.minParticipants)
    errors.maxParticipants = `人数上限至少 ${TIME_RULES.minParticipants} 人`;
  else if (max > TIME_RULES.maxParticipantsLimit)
    errors.maxParticipants = `人数上限不超过 ${TIME_RULES.maxParticipantsLimit} 人`;

  if (visibleAt && eventStart && eventStart < visibleAt)
    errors.eventStart = "活动开始时间不能早于可见时间";

  if (signupDeadline && eventStart && signupDeadline > eventStart)
    errors.signupDeadline = "报名截止时间必须早于或等于活动开始时间";

  if (eventStart && eventEnd && eventEnd < eventStart)
    errors.eventEnd = "活动结束时间不能早于开始时间";

  if (signupDeadline && now && signupDeadline <= now && visibleAt && visibleAt <= now)
    errors.signupDeadline = "报名截止时间已过，请调整";

  // 可见时间 → 活动结束 ≤ 15 天
  if (visibleAt && eventEnd) {
    const span = eventEnd.getTime() - visibleAt.getTime();
    if (span > TIME_RULES.maxVisibleSpanDays * 24 * 60 * 60 * 1000)
      errors.eventEnd = `从发布到活动结束最长 ${TIME_RULES.maxVisibleSpanDays} 天`;
    if (span <= 0) errors.eventEnd = "活动结束时间必须晚于可见时间";
  }

  return errors;
}

export function toDate(v: Date | string | undefined | null): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function hasErrors(e: FieldErrors) {
  return Object.keys(e).length > 0;
}
