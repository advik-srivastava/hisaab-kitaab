import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "./server/auth";

export function proxy(request: NextRequest) {
  if (process.env.APP_MODE !== "SERVER") return NextResponse.next();
  if (!request.cookies.has(SESSION_COOKIE)) {
    const login = new URL("/login", request.url);
    login.searchParams.set("returnTo", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/upload/:path*", "/exceptions/:path*", "/my-queue/:path*", "/batches/:path*", "/reports/:path*", "/admin/:path*"],
};
