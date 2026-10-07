import { AuditEvent } from "@/types/audit";
import { StatusBadge } from "./StatusBadge";

export function AuditTimeline({ events }: { events: AuditEvent[] }) {
  return (
    <div className="flow-root">
      <ul role="list" className="-mb-8">
        {events.map((event, eventIdx) => (
          <li key={event.id}>
            <div className="relative pb-8">
              {eventIdx !== events.length - 1 ? (
                <span
                  className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-panel-border/50"
                  aria-hidden="true"
                />
              ) : null}
              <div className="relative flex space-x-4">
                <div>
                  {event.actorType === "SYSTEM" ? (
                    <span className="h-8 w-8 rounded-full bg-surface-elevated flex items-center justify-center ring-4 ring-canvas border border-border-default shadow-sm">
                      <div className="h-2.5 w-2.5 rounded-full bg-text-muted" />
                    </span>
                  ) : (
                    <span className="h-8 w-8 rounded-full bg-neutral-900/20 flex items-center justify-center ring-4 ring-canvas border border-neutral-900/40 shadow-sm">
                      <svg className="w-4 h-4 text-neutral-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </span>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1">
                  <div className="flex flex-col">
                    <p className="text-sm text-text-primary font-bold">
                      {event.actorType === "SYSTEM" ? "System Core" : event.actorId || "User"}
                    </p>
                    <div className="text-sm font-medium text-text-secondary mt-1 flex flex-wrap items-center gap-2">
                      {event.action}
                      {event.newStatus && (
                        <StatusBadge status={event.newStatus} />
                      )}
                    </div>
                    {event.note && (
                      <div className="mt-3 text-sm italic text-text-primary bg-black/30 border border-border-default/50 p-4 rounded-xl  relative">
                        <div className="absolute top-2 left-2 text-text-muted opacity-30 text-2xl leading-none">&ldquo;</div>
                        <span className="relative z-10 pl-3 block">{event.note}</span>
                      </div>
                    )}
                  </div>
                  <div className="whitespace-nowrap text-right text-xs font-bold text-text-muted">
                    <time dateTime={event.timestamp}>
                      {new Date(event.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
