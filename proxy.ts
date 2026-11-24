import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Next 16 renamed Middleware to Proxy; same mechanics, still backed by
// Clerk's middleware helper underneath. Clerk only proves *who* someone
// is here — whether they're a member of the company, and what role, is
// our own data (memberships table), checked in lib/auth.ts where a DB
// call is natural (Server Components), not in edge middleware.
const isPublicRoute = createRouteMatcher([
  "/",
  "/login(.*)",
  "/signup(.*)",
  "/accept-invite(.*)",
  "/track(.*)",
  "/t/(.*)",
  "/d/(.*)",
  "/i/(.*)",
  "/api/ping",
  "/api/logo",
  "/api/driver(.*)",
  "/api/track(.*)",
]);

export const proxy = clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request)) return;
  await auth.protect();
});

export const config = {
  // Skip Next internals and static files (logo, icons) so they stay public.
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|webmanifest)).*)",
  ],
};
