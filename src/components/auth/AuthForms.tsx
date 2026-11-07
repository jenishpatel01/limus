"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { MailCheck } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { Button, Field, Input, Notice } from "@/components/ui";

function safeNext(raw: string | null, fallback: string) {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : fallback;
}

function authMessage(msg: string) {
  if (/invalid login credentials/i.test(msg)) return "Email or password is incorrect.";
  if (/email not confirmed/i.test(msg)) return "Please confirm your email first. Check your inbox for the link.";
  if (/rate limit/i.test(msg)) return "Too many attempts. Please wait a minute and try again.";
  if (/already registered/i.test(msg)) return "An account with this email already exists. Try signing in.";
  if (/password should be/i.test(msg) || /weak password/i.test(msg)) return "Choose a stronger password (at least 8 characters).";
  return msg;
}

function Heading({ title, sub }: { title: string; sub: React.ReactNode }) {
  return (
    <div className="mb-7">
      <h1 className="text-[28px] font-medium leading-tight tracking-[-0.04em]">{title}</h1>
      <p className="mt-2 text-[14px] text-muted">{sub}</p>
    </div>
  );
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(params.get("error"));
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setError(authMessage(error.message));
      setLoading(false);
      return;
    }
    router.replace(safeNext(params.get("next"), "/app"));
    router.refresh();
  }

  async function resend() {
    const { error } = await supabase().auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: `${location.origin}/auth/callback?next=/onboarding` } });
    if (error) setError(authMessage(error.message)); else setResent(true);
  }

  return (
    <>
      <Heading title="Welcome back" sub={<>New to Limus? <Link href="/register" className="text-primary-text hover:underline">Create an account</Link></>} />
      <form onSubmit={submit} className="stagger flex flex-col gap-4" noValidate>
        {params.get("reset") === "1" && <Notice>Your password was updated. Sign in with your new password.</Notice>}
        {error && (
          <Notice tone="loss">
            {error}
            {/confirm your email/.test(error) && email && !resent && (
              <button type="button" onClick={resend} className="ml-1 font-medium text-primary-text underline-offset-2 hover:underline">Resend link</button>
            )}
            {resent && <span className="ml-1">Confirmation email sent.</span>}
          </Notice>
        )}
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </Field>
        <Field label={<span className="flex w-full justify-between">Password <Link href="/forgot-password" className="font-normal text-primary-text hover:underline">Forgot password?</Link></span>} htmlFor="password">
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button type="submit" variant="primary" size="lg" loading={loading} disabled={!email || !password} className="mt-2 w-full">Sign in</Button>
      </form>
    </>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const pwError = password && password.length < 8 ? "Use at least 8 characters." : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pwError) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase().auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: name.trim() }, emailRedirectTo: `${location.origin}/auth/callback?next=/onboarding` },
    });
    setLoading(false);
    if (error) return setError(authMessage(error.message));
    if (data.user && data.user.identities && data.user.identities.length === 0) return setError("An account with this email already exists. Try signing in.");
    if (data.session) {
      router.replace("/onboarding");
      router.refresh();
    } else setSent(true);
  }

  if (sent) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary-text"><MailCheck className="size-5" /></div>
        <h1 className="text-[26px] font-medium tracking-[-0.04em]">Check your email</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">We sent a confirmation link to <span className="text-ink">{email}</span>. Open it to activate your account and set up Limus.</p>
        <Link href="/login" className="mt-6 inline-block text-[14px] text-primary-text hover:underline">Back to sign in</Link>
      </div>
    );
  }

  return (
    <>
      <Heading title="Create your account" sub={<>Already have one? <Link href="/login" className="text-primary-text hover:underline">Sign in</Link></>} />
      <form onSubmit={submit} className="stagger flex flex-col gap-4" noValidate>
        {error && <Notice tone="loss">{error}</Notice>}
        <Field label="Name" htmlFor="name" optional>
          <Input id="name" autoComplete="name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Alex Morgan" />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </Field>
        <Field label="Password" htmlFor="password" error={pwError} hint="At least 8 characters.">
          <Input id="password" type="password" autoComplete="new-password" required value={password} aria-invalid={Boolean(pwError)} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button type="submit" variant="primary" size="lg" loading={loading} disabled={!email || password.length < 8} className="mt-2 w-full">Create account</Button>
        <p className="text-center text-[12px] leading-relaxed text-faint">Limus is a journal and analytics tool. It doesn&apos;t place trades or give investment advice.</p>
      </form>
    </>
  );
}

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/auth/callback?next=/reset-password` });
    setLoading(false);
    if (error) setError(authMessage(error.message)); else setSent(true);
  }

  return (
    <>
      <Heading title="Reset your password" sub="We'll email you a link to choose a new password." />
      {sent ? (
        <Notice>If an account exists for <strong className="font-medium text-ink">{email}</strong>, a reset link is on its way. The link expires in one hour.</Notice>
      ) : (
        <form onSubmit={submit} className="stagger flex flex-col gap-4" noValidate>
          {error && <Notice tone="loss">{error}</Notice>}
          <Field label="Email" htmlFor="email">
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Button type="submit" variant="primary" size="lg" loading={loading} disabled={!email} className="w-full">Send reset link</Button>
        </form>
      )}
      <Link href="/login" className="mt-6 inline-block text-[14px] text-primary-text hover:underline">Back to sign in</Link>
    </>
  );
}

export function ResetForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    supabase().auth.getUser().then(({ data }) => setHasSession(Boolean(data.user)));
  }, []);

  const mismatch = confirm && confirm !== password ? "Passwords don't match." : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8 || mismatch) return;
    setLoading(true);
    setError(null);
    const { error } = await supabase().auth.updateUser({ password });
    if (error) { setLoading(false); return setError(authMessage(error.message)); }
    await supabase().auth.signOut();
    router.replace("/login?reset=1");
  }

  if (hasSession === false) {
    return (
      <>
        <Heading title="Link expired" sub="This password reset link is invalid or has expired." />
        <Link href="/forgot-password" className="text-[14px] text-primary-text hover:underline">Request a new link</Link>
      </>
    );
  }

  return (
    <>
      <Heading title="Choose a new password" sub="Use at least 8 characters." />
      <form onSubmit={submit} className="stagger flex flex-col gap-4" noValidate>
        {error && <Notice tone="loss">{error}</Notice>}
        <Field label="New password" htmlFor="password">
          <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Confirm password" htmlFor="confirm" error={mismatch}>
          <Input id="confirm" type="password" autoComplete="new-password" value={confirm} aria-invalid={Boolean(mismatch)} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <Button type="submit" variant="primary" size="lg" loading={loading} disabled={password.length < 8 || !!mismatch || !confirm || hasSession === null} className="w-full">Update password</Button>
      </form>
    </>
  );
}
