import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";

// Handles links from Supabase emails (sign-up confirmation, password reset).
// Supports both the PKCE `code` flow and `token_hash` links.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const rawNext = url.searchParams.get("next") ?? "/app";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/app";
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const supabase = await supabaseServer();

  let error: string | null = url.searchParams.get("error_description");
  if (!error && code) {
    const r = await supabase.auth.exchangeCodeForSession(code);
    error = r.error?.message ?? null;
  } else if (!error && tokenHash && type) {
    const r = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    error = r.error?.message ?? null;
  } else if (!error) {
    error = "This link is missing its verification code.";
  }

  if (error) {
    const dest = new URL(next === "/reset-password" ? "/forgot-password" : "/login", url.origin);
    dest.searchParams.set("error", "That link is invalid or has expired. Please try again.");
    return NextResponse.redirect(dest);
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
