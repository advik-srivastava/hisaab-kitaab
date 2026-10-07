"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(undefined);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Login failed.");
      const returnTo = new URLSearchParams(window.location.search).get("returnTo");
      router.replace(returnTo?.startsWith("/") ? returnTo : "/dashboard");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Login failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={submit} className="card w-full max-w-md p-8 space-y-6">
        <div><h1 className="text-3xl font-extrabold">Sign in</h1><p className="mt-2 text-text-secondary">Access your organization&apos;s Finance workspace.</p></div>
        <label className="block text-sm font-bold">Email<input className="mt-2 w-full rounded-xl bg-black/40 border border-panel-border px-4 py-3" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label className="block text-sm font-bold">Password<input className="mt-2 w-full rounded-xl bg-black/40 border border-panel-border px-4 py-3" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        {error && <p role="alert" className="text-sm text-status-danger-text">{error}</p>}
        <button className="btn-primary w-full" disabled={submitting}>{submitting ? "Signing in..." : "Sign in"}</button>
        <p className="text-xs text-text-muted">Demo credentials must be supplied through server environment configuration. No production identity is hard-coded.</p>
      </form>
    </div>
  );
}
