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
                  className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-slate-200"
                  aria-hidden="true"
                />
              ) : null}
              <div className="relative flex space-x-3">
                <div>
                  <span className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center ring-8 ring-white">
                    <div className="h-2.5 w-2.5 rounded-full bg-slate-400" />
                  </span>
                </div>
                <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                  <div>
                    <p className="text-sm text-slate-600">
                      {event.action}{" "}
                      {event.newStatus && (
                        <span className="ml-2">
                          <StatusBadge status={event.newStatus} />
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="whitespace-nowrap text-right text-sm text-slate-500">
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
