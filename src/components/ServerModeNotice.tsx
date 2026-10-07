export function ServerModeNotice({ feature }: { feature: string }) {
  return (
    <div className="card p-10 text-center">
      <h2 className="text-xl font-bold text-text-primary">{feature} is available in Server mode</h2>
      <p className="mt-3 text-sm text-text-secondary">Set APP_MODE=SERVER and NEXT_PUBLIC_APP_MODE=SERVER, then configure authentication and the server repository.</p>
    </div>
  );
}
