'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import {
  ShieldAlert,
  Sparkles,
  Lock,
  Database,
  Brain,
  Layers,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';

export default function SSOLandingView() {
  const searchParams = useSearchParams();
  const errorParam = searchParams ? searchParams.get('error') : null;
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleGoogleSignIn = () => {
    setIsSigningIn(true);
    signIn('google', { callbackUrl: '/' });
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#FFF5F8] via-[#FAF7F9] to-[#FCEEF5] flex flex-col justify-between relative overflow-hidden">
      {/* Ambient background glow elements */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-gradient-to-br from-[#FFB8CA]/30 to-[#FF7AB3]/10 rounded-full blur-3xl pointer-events-none -translate-y-1/2" />
      <div className="absolute bottom-0 right-10 w-[600px] h-[600px] bg-gradient-to-tr from-[#F1DDE9]/60 to-[#FFB8CA]/20 rounded-full blur-3xl pointer-events-none translate-y-1/3" />

      {/* Main Split Hero Section */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-6 py-8 sm:py-14 flex-1 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          
          {/* Left Column: Brand Story & Big Transparent Archer Hero (Zero white box container!) */}
          <div className="lg:col-span-7 relative flex flex-col justify-center text-left pt-6 sm:pt-10 pb-6">
            
            {/* Big Archer Girl Illustration (100% Transparent, blends into background) */}
            <div className="absolute -top-12 sm:-top-16 -left-4 sm:left-0 w-[420px] h-[420px] sm:w-[520px] sm:h-[520px] lg:w-[580px] lg:h-[580px] pointer-events-none select-none z-0 opacity-80 sm:opacity-90">
              <Image
                src="/job-hunt-facvicon.png"
                alt="Job Hunt Archer"
                fill
                priority
                className="object-contain object-left-top"
              />
            </div>

            {/* Foreground Content */}
            <div className="relative z-10 space-y-6 sm:space-y-7 max-w-xl">
              {/* Space reservation so the top of archer's bow and star shine through */}
              <div className="pt-24 sm:pt-32 lg:pt-36">
                {/* Sparkle Pill */}
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 border border-[#F1DDE9] text-[#9D3C5E] text-xs font-bold shadow-2xs backdrop-blur-sm">
                  <Sparkles className="w-3.5 h-3.5 text-[#FF7AB3]" />
                  <span>Aim High with Precision • Career Opportunity Platform</span>
                </div>
              </div>

              {/* Headline and Narrative */}
              <div className="space-y-3">
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#4A3E44] tracking-tight leading-tight">
                  Track Applications.<br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF7AB3] to-[#9D3C5E]">
                    Supercharge with AI.
                  </span>
                </h2>
                <p className="text-sm sm:text-base text-[#736A6D] leading-relaxed">
                  A private, high-precision career command center featuring two-way live Notion synchronization, Luna 5.6 & Antigravity AI ATS resume scanning, and smart lead discovery.
                </p>
              </div>

              {/* Feature Highlights Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1 w-full text-left">
                <div className="p-3.5 rounded-2xl bg-white/75 border border-[#F1DDE9] shadow-2xs backdrop-blur-sm flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#FFF0F6] border border-[#F1DDE9] flex items-center justify-center shrink-0 text-[#9D3C5E]">
                    <Database className="w-4 h-4 text-[#FF7AB3]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#4A3E44]">2-Way Notion Live Sync</h4>
                    <p className="text-[11px] text-[#736A6D] mt-0.5 leading-snug">
                      Real-time sync with database stages, service categories, and notes.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/75 border border-[#F1DDE9] shadow-2xs backdrop-blur-sm flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#FFF0F6] border border-[#F1DDE9] flex items-center justify-center shrink-0 text-[#9D3C5E]">
                    <Brain className="w-4 h-4 text-[#FF7AB3]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#4A3E44]">Luna 5.6 & Antigravity ATS</h4>
                    <p className="text-[11px] text-[#736A6D] mt-0.5 leading-snug">
                      Score resumes, detect missing keywords, and rewrite XYZ bullets.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/75 border border-[#F1DDE9] shadow-2xs backdrop-blur-sm flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#FFF0F6] border border-[#F1DDE9] flex items-center justify-center shrink-0 text-[#9D3C5E]">
                    <Layers className="w-4 h-4 text-[#FF7AB3]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#4A3E44]">Categorized Pipeline & Leads</h4>
                    <p className="text-[11px] text-[#736A6D] mt-0.5 leading-snug">
                      Dedicated Leads Hub with promote-to-applied pipeline workflows.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/75 border border-[#F1DDE9] shadow-2xs backdrop-blur-sm flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#FFF0F6] border border-[#F1DDE9] flex items-center justify-center shrink-0 text-[#9D3C5E]">
                    <Lock className="w-4 h-4 text-[#FF7AB3]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#4A3E44]">Strict Google SSO</h4>
                    <p className="text-[11px] text-[#736A6D] mt-0.5 leading-snug">
                      Invite-only authentication ensures only whitelisted accounts enter.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1 text-xs text-[#736A6D]">
                <span className="flex items-center gap-1.5 text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Private Workspace Active</span>
                </span>
                <span>Admin: <strong className="text-[#4A3E44]">jizellecasia@gmail.com</strong></span>
              </div>
            </div>
          </div>

          {/* Right Column: Google SSO Sign-in Card */}
          <div className="lg:col-span-5 flex justify-center lg:justify-end">
            <div className="w-full max-w-md bg-white/95 backdrop-blur-xl rounded-3xl border border-[#F1DDE9] shadow-[0_20px_60px_rgba(241,221,233,0.8)] p-8 sm:p-10 relative text-center animate-in fade-in zoom-in-95 duration-200">
              
              {/* Brand Title Header (Moved here per user request) */}
              <div className="mb-6 space-y-1">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#4A3E44] tracking-tight">
                  Job Hunt & Leads
                </h1>
                <p className="text-xs font-semibold text-[#9D3C5E]">
                  Career Pipeline & AI Suite
                </p>
                <div className="pt-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#FFF0F6] border border-[#F1DDE9] text-[#9D3C5E]">
                    <Lock className="w-3 h-3 text-[#FF7AB3]" />
                    <span>Google SSO • Invite Only</span>
                  </span>
                </div>
              </div>

              {/* Title & Prompt */}
              <div className="mb-5 text-left bg-[#FAF7F9] p-3.5 rounded-2xl border border-[#F1DDE9]/70">
                <h3 className="text-xs font-bold text-[#4A3E44]">
                  Sign in to Continue
                </h3>
                <p className="text-[11px] text-[#736A6D] mt-0.5 leading-relaxed">
                  Authenticate with your Google account to access your job applications and AI tools.
                </p>
              </div>

              {/* Access Denied Alert */}
              {errorParam === 'AccessDenied' ? (
                <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-left text-xs text-rose-800 space-y-1.5 animate-in fade-in">
                  <div className="flex items-center gap-2 font-bold text-rose-700">
                    <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>Access Denied (Not Whitelisted)</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-rose-600">
                    This workspace is strictly invite-only. Your Google account has not been authorized by the administrator.
                  </p>
                  <div className="pt-1 text-[10px] text-rose-700/80">
                    Contact <strong className="font-semibold text-rose-800">jizellecasia@gmail.com</strong> to request an invite.
                  </div>
                </div>
              ) : errorParam ? (
                <div className="mb-6 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-left text-xs text-rose-700 flex items-center gap-2 animate-in fade-in">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>Authentication error: {errorParam}. Please try again.</span>
                </div>
              ) : null}

              {/* Action: Google SSO Button */}
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isSigningIn}
                  className="w-full flex items-center justify-center gap-3.5 px-6 py-4 rounded-2xl border border-[#F1DDE9] bg-white hover:bg-[#FFF0F6] hover:border-[#FF7AB3] text-[#4A3E44] font-bold text-sm transition-all duration-200 shadow-2xs hover:shadow-md hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 cursor-pointer group"
                >
                  {/* Google Multicolor 'G' */}
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
                    {isSigningIn ? 'Redirecting to Google...' : 'Continue with Google'}
                  </span>
                  <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-[#FF7AB3] group-hover:translate-x-0.5 transition" />
                </button>

                {/* Whitelist Security Card */}
                <div className="p-3.5 bg-[#FAF7F9] rounded-2xl border border-[#F1DDE9]/70 text-left">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#4A3E44] mb-1">
                    <Lock className="w-3.5 h-3.5 text-[#FF7AB3]" />
                    <span>Protected Workspace • Whitelist Only</span>
                  </div>
                  <p className="text-[11px] text-[#736A6D] leading-relaxed">
                    Single Sign-On with Google validates your permission against the database invite whitelist.
                  </p>
                </div>
              </div>

              {/* Footnote */}
              <div className="mt-6 pt-5 border-t border-[#F1DDE9]/70 text-[11px] text-[#736A6D]/80">
                Job Hunt & Leads • Precision Opportunity Tracking
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
