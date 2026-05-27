import { Check, Eye, Hand } from "lucide-react";

import { cn } from "@/lib/cn";
import type { PaymentEventType } from "@/types/db";

export interface TimelineEvent {
  id: string;
  occurredAt: string; // ISO
  memberName: string;
  eventType: PaymentEventType;
  detail?: string; // optional extra ("paid RM 18.50 via DuitNow")
}

interface ActivityTimelineProps {
  events: TimelineEvent[];
  emptyLabel?: string;
}

const EVENT_META: Record<
  PaymentEventType,
  { Icon: typeof Eye; verb: string; tone: string }
> = {
  viewed: { Icon: Eye, verb: "viewed the bill", tone: "text-foreground-faint" },
  claimed: { Icon: Hand, verb: "claimed", tone: "text-foreground-soft" },
  paid: { Icon: Check, verb: "paid", tone: "text-ringgit" },
};

export function ActivityTimeline({ events, emptyLabel }: ActivityTimelineProps) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-foreground-soft">
        {emptyLabel ?? "No activity yet."}
      </p>
    );
  }
  return (
    <ol className="space-y-1.5">
      {events.map((e) => {
        const meta = EVENT_META[e.eventType];
        const Icon = meta.Icon;
        return (
          <li
            key={e.id}
            className="flex items-start gap-2 border-l-2 border-border pl-3 font-mono text-xs"
          >
            <Icon size={12} aria-hidden className={cn("mt-0.5 shrink-0", meta.tone)} />
            <div className="min-w-0 flex-1">
              <div className="text-foreground">
                <span className="font-medium">{e.memberName}</span>{" "}
                <span className={meta.tone}>{meta.verb}</span>
                {e.detail ? (
                  <span className="text-foreground-soft"> · {e.detail}</span>
                ) : null}
              </div>
              <time
                dateTime={e.occurredAt}
                className="text-[10px] text-foreground-faint"
              >
                {relativeTime(e.occurredAt)}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * "5m ago", "2h ago", "3d ago", or a long-form date for events >7 days old.
 * Pure JS — no date-fns. Locale defaults to en-MY for the long form.
 */
function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diffMs = Date.now() - t;
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
