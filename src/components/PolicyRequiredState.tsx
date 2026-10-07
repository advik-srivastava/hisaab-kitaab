import Link from "next/link";

export function PolicyRequiredState({ compact = false }: { compact?: boolean }) {
  return (
    <section className={`card mx-auto text-center ${compact ? "p-6" : "max-w-3xl p-8 md:p-12"}`} aria-labelledby="policy-required-title">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-500">
        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-3-3v6m7.5 4.5A9 9 0 114.5 4.5a9 9 0 0115 15z" /></svg>
      </div>
      <p className="mt-5 text-xs font-bold uppercase tracking-widest text-amber-500">Company policy required</p>
      <h2 id="policy-required-title" className="mt-2 text-2xl font-heading font-bold text-text-primary">Set up your company finance policy</h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-text-secondary">hisaab-kitaab needs your organization&apos;s finance policy before it can evaluate invoices. Upload or configure a policy to begin.</p>
      {!compact && <ol className="mx-auto mt-7 grid max-w-2xl gap-3 text-left sm:grid-cols-3">
        <li className="rounded-xl border border-amber-200 bg-amber-50 p-4"><span className="text-xs font-bold text-amber-500">1 · REQUIRED NOW</span><p className="mt-2 text-sm font-semibold">Set up company policy</p></li>
        <li className="rounded-xl border border-border-default bg-surface-elevated p-4"><span className="text-xs font-bold text-text-muted">2 · LOCKED</span><p className="mt-2 text-sm font-semibold">Upload invoice batch</p></li>
        <li className="rounded-xl border border-border-default bg-surface-elevated p-4"><span className="text-xs font-bold text-text-muted">3 · AFTER ANALYSIS</span><p className="mt-2 text-sm font-semibold">Review exceptions</p></li>
      </ol>}
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link href="/admin/policies" className="btn-primary">Upload Company Policy</Link>
        <a href="/templates/hisaab-kitaab-company-policy-sample.json" download className="btn-secondary">Download Sample Policy</a>
      </div>
    </section>
  );
}
