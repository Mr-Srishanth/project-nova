import type { AutomationSchedule, ScheduleRecurrence } from "@/types/execution";

export function computeNextRunTimestamp(
  recurrence: ScheduleRecurrence,
  fromTimestamp: number = Date.now()
): string | undefined {
  if (recurrence === "none") return undefined;

  const date = new Date(fromTimestamp);
  switch (recurrence) {
    case "hourly":
      date.setHours(date.getHours() + 1);
      break;
    case "daily":
      date.setDate(date.getDate() + 1);
      break;
    case "weekly":
      date.setDate(date.getDate() + 7);
      break;
  }

  return date.toISOString();
}

export function isScheduleDue(schedule: AutomationSchedule, nowTimestamp: number = Date.now()): boolean {
  if (!schedule.enabled || !schedule.nextRunAt) return false;
  const nextTime = new Date(schedule.nextRunAt).getTime();
  return nowTimestamp >= nextTime;
}
