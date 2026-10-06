'use client';

import React, { useState, Suspense } from 'react';
import Image from 'next/image';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldAlert,
  ArrowRight,
  LogOut,
  Sparkles,
  Lock,
} from 'lucide-react';

function LoginForm() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get('error');
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleGoogleSignIn = () => {
    setIsSigningIn(true);
    signIn('google', { callbackUrl: '/' });
  };

  return (
    <div className="w-full max-w-md bg-white rounded-3xl border border-[#F1DDE9] shadow-[0_16px_50px_rgba(241,221,233,0.7)] p-8 sm:p-10 relative z-10 text-center animate-in fade-in zoom-in-95 duration-200">
      {/* Brand Logo Container */}
      <div className="relative mx-auto mb-5 w-28 h-28">
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-[#FFB8CA]/50 to-[#FF7AB3]/40 blur-md -z-10 transform scale-105" />
        <div className="w-full h-full rounded-3xl bg-white border border-[#F1DDE9] p-1.5 shadow-xs flex items-center justify-center overflow-hidden">
          <Image
            src="/job-hunt-whitebg.jpg"
            alt="Job Hunt & Leads Logo"
            width={112}
            height={112}
            priority
            className="w-full h-full object-contain rounded-2xl"
          />
        </div>
      </div>

      {/* Title & Tagline */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF0F6] border border-[#F1DDE9] text-[#9D3C5E] text-[11px] font-bold uppercase tracking-wider mb-2.5">
          <Sparkles className="w-3 h-3 text-[#FF7AB3]" />
          <span>Job Hunt & Pipeline</span>
        </div>
        <h1 className="text-2xl font-extrabold text-[#4A3E44] tracking-tight">
          Welcome to Job Hunt
        </h1>
        <p className="text-xs text-[#736A6D] mt-1 leading-relaxed">
          Aim high with precision. Track every lead, optimize ATS match scores, and conquer your career search.
        </p>
      </div>

      {/* Error Alert (e.g. Uninvited Google Account) */}
      {errorParam === 'AccessDenied' ? (
        <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-left text-xs text-rose-800 space-y-1.5 animate-in fade-in">
          <div className="flex items-center gap-2 font-bold text-rose-700">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
            <span>Access Denied (Invite-Only)</span>
          </div>
          <p className="text-[11px] leading-relaxed text-rose-600">
            This workspace is strictly invite-only. Your Google account hasn&apos;t been added to the whitelist yet.
          </p>
          <div className="pt-1 text-[10px] text-rose-700/80">
            Please ask the administrator (<span className="font-semibold">jizellecasia@gmail.com</span>) to invite your email.
          </div>
        </div>
      ) : errorParam ? (
        <div className="mb-6 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-left text-xs text-rose-700 flex items-center gap-2 animate-in fade-in">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>Authentication error: {errorParam}. Please try again.</span>
        </div>
      ) : null}

      {/* Authenticated State vs Sign-In State */}
      {status === 'authenticated' && session?.user ? (
        <div className="space-y-4">
          <div className="p-3.5 rounded-2xl bg-[#FAF7F9] border border-[#F1DDE9] text-left flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white border border-[#F1DDE9] flex items-center justify-center text-sm shadow-2xs shrink-0 overflow-hidden">
              {session.user.image ? (
                <img src={session.user.image} alt={session.user.name || 'User'} className="w-full h-full object-cover" />
              ) : (
                '🌸'
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[#4A3E44] truncate">{session.user.name || 'Member'}</p>
              <p className="text-[11px] text-[#736A6D] truncate">{session.user.email}</p>
            </div>
          </div>

          <Link
            href="/"
            className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-[#FF7AB3] hover:bg-[#F06292] text-white font-semibold text-xs shadow-xs transition cursor-pointer"
          >
            <span>Enter Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-xs text-[#736A6D] hover:text-rose-600 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign out / Switch Google account</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Google SSO Button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={isSigningIn || status === 'loading'}
            className="w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-2xl border border-[#F1DDE9] bg-white hover:bg-[#FFF0F6] hover:border-[#FF7AB3] text-[#4A3E44] font-semibold text-xs transition-all duration-200 shadow-2xs hover:shadow-xs disabled:opacity-50 cursor-pointer group"
          >
            {/* Google SVG G */}
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span className="group-hover:text-[#9D3C5E] transition">
              {isSigningIn ? 'Opening Google Sign-In...' : 'Sign in with Google'}
            </span>
          </button>

          {/* Whitelist Security Notice */}
          <div className="p-3 bg-[#FAF7F9] rounded-2xl border border-[#F1DDE9]/60 text-left">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#4A3E44] mb-1">
              <Lock className="w-3.5 h-3.5 text-[#FF7AB3]" />
              <span>Strict Google SSO Invite-Only</span>
            </div>
            <p className="text-[11px] text-[#736A6D] leading-normal">
              Only Google accounts pre-authorized by Admin (<span className="text-[#9D3C5E] font-medium">jizellecasia@gmail.com</span>) can access this system.
            </p>
          </div>
        </div>
      )}

      {/* Guest/Preview link */}
      <div className="mt-6 pt-5 border-t border-[#F1DDE9]/70 text-center">
        <Link
          href="/"
          className="text-xs text-[#736A6D] hover:text-[#9D3C5E] transition font-medium inline-flex items-center gap-1"
        >
          <span>Continue to workspace view</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#FFF5F8] via-[#FAF7F9] to-[#F7EEF4] flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Background ambient glowing soft circles */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#FFB8CA]/25 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-[#FF7AB3]/15 blur-3xl pointer-events-none" />

      <Suspense
        fallback={
          <div className="w-full max-w-md bg-white rounded-3xl border border-[#F1DDE9] p-10 text-center text-xs text-[#736A6D]">
            Loading login...
          </div>
        }
      >
        <LoginForm />
      </Suspense>

      <footer className="mt-8 text-center text-xs text-[#736A6D]/80">
        Job Hunt & Leads • Protected Workspace
      </footer>
    </main>
  );
}
