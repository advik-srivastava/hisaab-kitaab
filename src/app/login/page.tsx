"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

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
    <div className="min-h-screen flex bg-surface-primary overflow-hidden">
      {/* Left branding panel */}
      <div className="hidden lg:flex flex-1 flex-col justify-between bg-surface-secondary border-r border-border-default p-12 lg:p-20 relative">
        <div className="relative z-10">
          <Image 
            src="/brand/hisaab-kitaab-logo.png" 
            alt="hisaabकिताब" 
            width={220} 
            height={60} 
            className="mb-8"
            priority
          />
          <h1 className="text-4xl xl:text-5xl font-extrabold tracking-tight mt-16 leading-tight max-w-xl">
            Review exceptions. <br/>
            <span className="text-text-muted">Not every invoice.</span>
          </h1>
          <p className="mt-8 text-lg font-medium text-text-secondary max-w-lg leading-relaxed">
            The intelligent AP review platform for modern finance teams. Automate compliance, detect duplicates, and isolate risks with deterministic precision.
          </p>
        </div>
        
        <div className="relative z-10 mt-auto pt-16">
          <div className="flex gap-4">
            <div className="p-4 rounded-xl border border-border-default bg-surface-primary/50 backdrop-blur-md">
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Architecture</p>
              <p className="font-semibold text-sm">Local-first privacy</p>
            </div>
            <div className="p-4 rounded-xl border border-border-default bg-surface-primary/50 backdrop-blur-md">
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Analysis</p>
              <p className="font-semibold text-sm">Deterministic rules</p>
            </div>
          </div>
          <p className="mt-8 text-xs font-semibold text-text-muted">© {new Date().getFullYear()} hisaabकिताब. All rights reserved.</p>
        </div>

        {/* Abstract background graphics for premium feel */}
        <div className="absolute top-0 right-0 w-3/4 h-3/4 bg-neutral-900/5 blur-[120px] rounded-bl-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-neutral-900/10 blur-[100px] rounded-tr-full pointer-events-none" />
      </div>

      {/* Right login panel */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 lg:p-12 relative animate-in fade-in slide-in-from-right-8 duration-700">
        <div className="w-full max-w-md">
          {/* Mobile logo (hidden on desktop) */}
          <div className="lg:hidden mb-12 flex justify-center">
            <Image 
              src="/brand/hisaab-kitaab-logo.png" 
              alt="hisaabकिताब" 
              width={180} 
              height={50} 
              priority
            />
          </div>

          <form onSubmit={submit} className="card p-10 space-y-8 shadow-sm">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight">Sign In</h2>
              <p className="mt-2 text-[15px] font-medium text-text-secondary">Access your organization&apos;s finance workspace.</p>
            </div>
            
            <div className="space-y-5">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-text-muted mb-2">Email address</label>
                <input 
                  className="w-full rounded-lg bg-surface-primary border border-border-default px-4 py-3 text-sm focus-visible:ring-1 focus-visible:ring-neutral-900 transition-shadow" 
                  type="email" 
                  autoComplete="username" 
                  placeholder="admin@hisaabkitaab.com"
                  value={email} 
                  onChange={(event) => setEmail(event.target.value)} 
                  required 
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-text-muted">Password</label>
                  <a href="#" className="text-[11px] font-bold text-neutral-900 hover:underline">Forgot?</a>
                </div>
                <input 
                  className="w-full rounded-lg bg-surface-primary border border-border-default px-4 py-3 text-sm focus-visible:ring-1 focus-visible:ring-neutral-900 transition-shadow" 
                  type="password" 
                  autoComplete="current-password" 
                  placeholder="••••••••"
                  value={password} 
                  onChange={(event) => setPassword(event.target.value)} 
                  required 
                />
              </div>
            </div>

            {error && (
              <div role="alert" className="p-4 rounded-lg bg-red-50 border border-red-100 flex items-start gap-3 animate-in slide-in-from-top-2">
                <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-sm font-semibold text-red-600">{error}</p>
              </div>
            )}

            <button 
              className="w-full bg-neutral-900 hover:bg-neutral-800 text-white font-bold h-12 rounded-lg text-[15px] transition-colors flex items-center justify-center gap-2" 
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Authenticating...
                </>
              ) : "Sign in to Workspace"}
            </button>
            
            <p className="text-[11px] text-text-muted text-center font-medium px-4 leading-relaxed">
              Demo credentials must be supplied through server environment configuration. No production identity is hard-coded.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
