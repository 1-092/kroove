import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE_NAME = "kroove_session";

export function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const pathname = request.nextUrl.pathname;

  if (!token) {
    if (pathname.startsWith("/api/admin")) {
      return NextResponse.json({ message: "unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/home/:path*",
    "/change_password/:path*",
    "/admin/:path*",
    "/api/admin/:path*",
  ],
};
