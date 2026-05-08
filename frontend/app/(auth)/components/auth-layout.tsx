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
