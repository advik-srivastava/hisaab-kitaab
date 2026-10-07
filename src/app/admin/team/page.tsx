"use client";

import { useEffect, useState } from "react";
import { ServerModeNotice } from "@/components/ServerModeNotice";
import type { UserRecord } from "@/server/platform/types";

export default function TeamPage() {
  const serverMode = process.env.NEXT_PUBLIC_APP_MODE === "SERVER";
  const [users, setUsers] = useState<UserRecord[]>();
  useEffect(() => {
    if (!serverMode) return;
    void fetch("/api/users", { cache: "no-store" }).then((response) => response.json()).then((body: { items: UserRecord[] }) => setUsers(body.items)).catch(() => setUsers([]));
  }, [serverMode]);
  if (!serverMode) return <ServerModeNotice feature="Team Management" />;
  return (
    <div className="space-y-8"><div><h1 className="text-3xl font-extrabold">Team</h1><p className="mt-2 text-text-secondary">Organization users and Finance roles.</p></div>
      <div className="card overflow-hidden"><table className="min-w-full"><thead><tr><th className="table-header">Name</th><th className="table-header">Email</th><th className="table-header">Role</th><th className="table-header">Status</th></tr></thead><tbody>{users?.map((user) => <tr key={user.id}><td className="table-cell font-bold">{user.displayName}</td><td className="table-cell">{user.email}</td><td className="table-cell">{user.role.replaceAll("_", " ")}</td><td className="table-cell">{user.active ? "Active" : "Inactive"}</td></tr>)}</tbody></table></div>
    </div>
  );
}
