import { NextResponse } from "next/server";

// Auth verification + role routing will be implemented in Story 1.4b
export function proxy() {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icons|images|sw.js).*)",
  ],
};
