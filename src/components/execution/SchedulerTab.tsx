import React, { useState } from "react";
import {
  Play,
  Power,
  ShieldAlert,
} from "lucide-react";
import type { AutomationSchedule, ScheduleRecurrence } from "@/types/execution";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface SchedulerTabProps {
  schedules: AutomationSchedule[];
  onToggleSchedule: (scheduleId: string, enabled: boolean) => Promise<void>;
  onTriggerNow: (schedule: AutomationSchedule) => Promise<void>;
  onCreateSchedule: (
    title: string,
    recurrence: ScheduleRecurrence
  ) => Promise<void>;
  isTriggering?: boolean;
}

export const SchedulerTab: React.FC<SchedulerTabProps> = ({
  schedules,
  onToggleSchedule,
  onTriggerNow,
  onCreateSchedule,
  isTriggering = false,
}) => {
  const [newTitle, setNewTitle] = useState("");
  const [newRecurrence, setNewRecurrence] = useState<ScheduleRecurrence>("daily");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await onCreateSchedule(newTitle.trim(), newRecurrence);
    setNewTitle("");
  };

  return (
    <div className="space-y-6">
      {/* Explicit Session Scheduler Limitation Notice */}
      <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-tactile shadow-hard-sm space-y-1">
        <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Active-Session Scheduler Policy Disclosure</span>
        </div>
        <p className="text-xs text-amber-800 leading-relaxed">
          ProjectNova AI runs securely inside your client browser and local developer environment.
          Enabled schedules past their next run time <strong>auto-run every 30 seconds while this Execution Center page is open</strong>
          (use "Trigger Now" to run immediately). No hidden background daemons or untrusted third-party background services run when the browser tab is closed.
        </p>
      </div>

      {/* Grid: Left schedule list, Right create form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-3">
          <h4 className="font-bold text-sm text-foreground">Active Automation Schedules ({schedules.length})</h4>

          {schedules.length === 0 ? (
            <Card className="p-8 text-center bg-surface border-2 border-border shadow-hard-sm text-foreground-muted text-xs">
              No recurring automation schedules created yet. Create one below to maintain your project pipeline automatically.
            </Card>
          ) : (
            schedules.map((sch) => (
              <Card
                key={sch.id}
                className="p-4 bg-surface border-2 border-border shadow-hard-sm space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded border ${
                          sch.enabled
                            ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                            : "bg-surface-subtle text-foreground-muted border-border"
                        }`}
                      >
                        {sch.enabled ? "ACTIVE" : "PAUSED"}
                      </span>
                      <span className="text-xs font-mono font-bold text-foreground">
                        [{sch.recurrence.toUpperCase()}]
                      </span>
                      <span className="text-xs text-foreground-muted">TZ: {sch.timezone}</span>
                    </div>

                    <h5 className="font-bold text-sm text-foreground">{sch.title}</h5>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant={sch.enabled ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => onToggleSchedule(sch.id, !sch.enabled)}
                      icon={<Power className="w-3.5 h-3.5" />}
                    >
                      {sch.enabled ? "Pause" : "Enable"}
                    </Button>

                    <Button
                      size="sm"
                      disabled={isTriggering}
                      onClick={() => onTriggerNow(sch)}
                      icon={<Play className="w-3.5 h-3.5" />}
                    >
                      Trigger Now
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-2 border-t border-border/10 font-mono text-foreground-muted">
                  <div>
                    Next run: {sch.nextRunAt ? new Date(sch.nextRunAt).toLocaleString() : "Not scheduled"}
                  </div>
                  <div>
                    Last run: {sch.lastRunAt ? new Date(sch.lastRunAt).toLocaleString() : "Never"}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Right Form: Create Schedule */}
        <div className="lg:col-span-4 space-y-3">
          <Card className="p-4 bg-surface border-2 border-border shadow-hard-sm space-y-3">
            <h4 className="font-bold text-sm text-foreground">Create Automation Schedule</h4>
            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="block text-foreground-muted font-mono mb-1">Schedule Name</label>
                <input
                  type="text"
                  placeholder="e.g. Daily Health & Drift Check"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-foreground font-mono"
                />
              </div>

              <div>
                <label className="block text-foreground-muted font-mono mb-1">Recurrence Frequency</label>
                <select
                  value={newRecurrence}
                  onChange={(e) => setNewRecurrence(e.target.value as ScheduleRecurrence)}
                  className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-foreground font-mono"
                >
                  <option value="hourly">Hourly (Active Session)</option>
                  <option value="daily">Daily (Active Session)</option>
                  <option value="weekly">Weekly (Active Session)</option>
                  <option value="none">One-time / Manual</option>
                </select>
              </div>

              <div className="pt-1">
                <Button type="submit" size="sm" className="w-full">
                  Register Schedule
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
};
