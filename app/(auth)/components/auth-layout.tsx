"use client";

import type { ReactNode } from "react";
import Link from "next/link";

const BACKGROUND_LINES = [
  { top: "8%", left: "15%", height: "150px" },
  { top: "20%", left: "60%", height: "220px" },
  { top: "58%", left: "12%", height: "190px" },
  { top: "70%", left: "70%", height: "160px" },
  { top: "35%", left: "82%", height: "140px" },
];

const SPOKE_ROTATIONS = [0, 120, 240];

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle: string;
  isSignIn: boolean;
}

export function AuthLayout({
  children,
  title,
  subtitle,
  isSignIn,
}: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-[#F5F7FF] flex items-center justify-center p-4 lg:p-8">
      <div className="w-full max-w-5xl bg-white rounded-4xl shadow-2xl shadow-[#C4D9FF]/20 border border-[#E8F9FF] overflow-hidden flex min-h-[640px] lg:min-h-[720px]">
        {/* Left Column - Form */}
        <div className="w-full lg:w-1/2 p-8 lg:p-12 flex flex-col relative z-10">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 w-fit mb-8">
            <div className="w-8 h-8 bg-linear-to-br from-[#C5BAFF] to-[#C4D9FF] rounded-lg flex items-center justify-center shadow-lg shadow-[#C5BAFF]/20">
              <span className="text-white font-black text-sm">S</span>
            </div>
            <span className="font-bold text-xl tracking-tight text-zinc-900">
              shitpost.art
            </span>
          </Link>

          <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-black text-zinc-900 mb-2">
                {title}
              </h1>
              <p className="text-zinc-500">{subtitle}</p>
            </div>

            {/* Toggle */}
            <div className="bg-[#FBFBFB] p-1.5 rounded-2xl flex mb-8 border border-[#E8F9FF]">
              {isSignIn ? (
                <>
                  <div className="flex-1 py-2.5 text-center text-sm font-bold text-zinc-900 bg-white shadow-sm rounded-xl border border-zinc-100 cursor-default">
                    Sign In
                  </div>
                  <Link
                    href="/sign-up"
                    className="flex-1 py-2.5 text-center text-sm font-bold text-zinc-500 hover:text-zinc-700 transition-colors rounded-xl"
                  >
                    Sign Up
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/sign-in"
                    className="flex-1 py-2.5 text-center text-sm font-bold text-zinc-500 hover:text-zinc-700 transition-colors rounded-xl"
                  >
                    Sign In
                  </Link>
                  <div className="flex-1 py-2.5 text-center text-sm font-bold text-zinc-900 bg-white shadow-sm rounded-xl border border-zinc-100 cursor-default">
                    Sign Up
                  </div>
                </>
              )}
            </div>

            {children}

            <div className="mt-8 relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-100"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-zinc-400 font-medium">
                  Or Continue With
                </span>
              </div>
            </div>

            <div className="mt-6 flex gap-4 justify-center">
              <button className="w-12 h-12 rounded-full border border-zinc-200 flex items-center justify-center hover:bg-zinc-50 transition-colors bg-white">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
              </button>
              <button className="w-12 h-12 rounded-full border border-zinc-200 flex items-center justify-center hover:bg-zinc-50 transition-colors text-black bg-white">
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </button>
              <button className="w-12 h-12 rounded-full border border-zinc-200 flex items-center justify-center hover:bg-zinc-50 transition-colors text-[#0077b5] bg-white">
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.226 0z" />
                </svg>
              </button>
            </div>

            <div className="text-center text-xs text-zinc-400 mt-8">
              <p>
                Join the millions of smart shitposters who trust us to manage
                their chaos.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column - Visuals */}
        <div className="hidden lg:flex w-1/2 relative bg-linear-to-br from-[#E7F1FF] via-[#C9E3FF] to-[#A6D3FF] items-center justify-center p-12 overflow-hidden">
          <div className="absolute inset-0 opacity-70">
            {BACKGROUND_LINES.map((line, index) => (
              <span
                key={`line-${index}`}
                className="absolute w-1 rounded-full bg-white/60"
                style={{
                  top: line.top,
                  left: line.left,
                  height: line.height,
                }}
              />
            ))}
          </div>

          <div className="relative z-10 flex flex-col items-center gap-6">
            <div className="relative w-72 h-72 rounded-[42px] bg-linear-to-br from-[#4E7DFF] via-[#3A61FF] to-[#14C3FF] shadow-[0_30px_70px_rgba(64,98,255,0.35)] flex items-center justify-center">
              <div className="absolute -top-10 -right-6 w-24 h-24 rounded-full border border-white/30 bg-white/10 blur-[1px]" />
              <div className="absolute -bottom-12 -left-10 w-32 h-32 rounded-full border border-white/20 bg-white/5" />
              <div className="relative w-52 h-52 rounded-[34px] bg-white/15 border border-white/30 flex items-center justify-center shadow-inner shadow-[#1D2A5C]/40">
                <div className="relative w-32 h-32 rounded-[28px] bg-linear-to-br from-[#9EE7FF] via-[#46C4FF] to-[#1C8BFF] border-[6px] border-white/70 flex items-center justify-center shadow-[0_12px_30px_rgba(28,139,255,0.35)]">
                  <div className="absolute inset-5 rounded-full border-4 border-white/60" />
                  <div className="relative w-12 h-12 rounded-full bg-white text-[#385CFF] flex items-center justify-center shadow-[0_6px_16px_rgba(0,0,0,0.15)]">
                    {SPOKE_ROTATIONS.map((rotation) => (
                      <span
                        key={rotation}
                        className="absolute w-1 h-6 bg-[#385CFF] rounded-full origin-center"
                        style={{ transform: `rotate(${rotation}deg)` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <p className="text-white/80 text-sm font-medium text-center max-w-xs">
              Vault-grade security and playful vibes to keep every scheduled
              shitpost safe until it is time to unleash it.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
