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
                  {event.actorType === "SYSTEM" ? (
                    <span className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center ring-8 ring-white border border-slate-200">
                      <div className="h-2 w-2 rounded-full bg-slate-400" />
                    </span>
                  ) : (
                    <span className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center ring-8 ring-white border border-blue-100">
                      <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </span>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                  <div className="flex flex-col">
                    <p className="text-sm text-slate-800 font-medium">
                      {event.actorType === "SYSTEM" ? "System" : event.actorId || "User"}
                    </p>
                    <p className="text-sm text-slate-600 mt-0.5">
                      {event.action}{" "}
                      {event.newStatus && (
                        <span className="ml-2">
                          <StatusBadge status={event.newStatus} />
                        </span>
                      )}
                    </p>
                    {event.note && (
                      <p className="text-sm italic text-slate-600 bg-white border border-slate-200 p-3 rounded-md shadow-sm">
                        &quot;{event.note}&quot;
                      </p>
                    )}
                  </div>
                  <div className="whitespace-nowrap text-right text-xs text-slate-400">
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
