import Image from "next/image";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-[#FBFBFB] text-zinc-900 selection:bg-[#C5BAFF] selection:text-white overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative pt-40 pb-20 lg:pt-52 lg:pb-32 px-6 overflow-hidden">
        {/* Background Blobs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none">
          <div className="absolute top-20 left-10 w-96 h-96 bg-[#E8F9FF] rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
          <div className="absolute top-20 right-10 w-96 h-96 bg-[#C4D9FF] rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#C5BAFF] rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000"></div>
        </div>

        <div className="relative z-10 mx-auto flex max-w-7xl flex-col items-center gap-12 lg:flex-row lg:text-left">
          <div className="flex-1 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-[#E8F9FF] shadow-sm mb-8 animate-fade-in-up">
              <span className="w-2 h-2 rounded-full bg-[#C5BAFF]"></span>
              <span className="text-sm font-medium text-zinc-600">
                The new era of posting is here
              </span>
            </div>

            <h1 className="text-6xl lg:text-8xl font-black tracking-tighter mb-8 leading-[1.1]">
              One place to <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-linear-to-r from-[#C5BAFF] via-[#C4D9FF] to-[#C5BAFF] animate-gradient bg-300%">
                shitpost everywhere
              </span>
            </h1>

            <p className="text-xl lg:text-2xl text-zinc-500 max-w-2xl mb-12 leading-relaxed">
              Manage your chaos. Schedule, analyze, and dominate every social
              platform from a single, beautiful dashboard.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <Link
                href="/sign-up"
                className="w-full sm:w-auto px-8 py-4 bg-[#C5BAFF] hover:bg-[#b4a5ff] text-white text-lg font-bold rounded-2xl transition-all shadow-xl shadow-[#C5BAFF]/30 hover:shadow-[#C5BAFF]/50 hover:-translate-y-1"
              >
                Start Shitposting Free
              </Link>
              <Link
                href="#demo"
                className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-zinc-50 text-zinc-900 border border-zinc-200 text-lg font-bold rounded-2xl transition-all hover:-translate-y-1"
              >
                View Demo
              </Link>
            </div>
          </div>

          <div className="flex-1">
            <div className="relative mx-auto max-w-lg rounded-3xl border border-[#E8F9FF] bg-white p-4 shadow-2xl shadow-[#C4D9FF]/20">
              <Image
                src="/hero_main_sm.png"
                alt="shitpost.art dashboard preview"
                width={800}
                height={600}
                priority
                className="rounded-2xl border border-[#E8F9FF]/50 object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Functionality Section */}
      <section className="py-32 px-6 bg-white relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl lg:text-5xl font-black tracking-tight mb-6">
              Everything you need to <br />
              <span className="text-[#C5BAFF]">go viral</span>
            </h2>
            <p className="text-lg text-zinc-500 max-w-2xl mx-auto">
              Powerful tools wrapped in a design so clean you will actually want
              to use them.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: "Multi-Account Control",
                desc: "Connect unlimited accounts. Switch between personas instantly without logging out.",
                color: "bg-[#E8F9FF]",
                accent: "bg-[#C4D9FF]",
              },
              {
                title: "Smart Scheduling",
                desc: "Queue your brilliance. Auto-post at peak times when your audience is awake.",
                color: "bg-[#FBFBFB]",
                accent: "bg-[#C5BAFF]",
              },
              {
                title: "Unified Analytics",
                desc: "Track your growth across all platforms in one view. Numbers go up, dopamine hits.",
                color: "bg-[#E8F9FF]",
                accent: "bg-[#C4D9FF]",
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="group relative p-8 rounded-3xl bg-[#FBFBFB] border border-zinc-100 hover:border-[#C4D9FF] transition-all duration-300 hover:shadow-xl hover:shadow-[#C4D9FF]/10"
              >
                <div
                  className={`w-14 h-14 ${feature.color} rounded-2xl mb-6 flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}
                >
                  <div
                    className={`w-6 h-6 ${feature.accent} rounded-full`}
                  ></div>
                </div>
                <h3 className="text-2xl font-bold mb-4">{feature.title}</h3>
                <p className="text-zinc-500 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* System Structure Section */}
      <section className="py-32 px-6 bg-[#FBFBFB] overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <div>
              <h2 className="text-4xl lg:text-5xl font-black tracking-tight mb-8">
                How it works
              </h2>
              <div className="space-y-8">
                {[
                  {
                    step: "01",
                    title: "Create",
                    text: "Draft your masterpiece in our rich editor.",
                  },
                  {
                    step: "02",
                    title: "Distribute",
                    text: "Select platforms and customize for each audience.",
                  },
                  {
                    step: "03",
                    title: "Dominate",
                    text: "Watch the engagement roll in from everywhere.",
                  },
                ].map((item, i) => (
                  <div key={i} className="flex gap-6">
                    <span className="text-2xl font-black text-[#C4D9FF]">
                      {item.step}
                    </span>
                    <div>
                      <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                      <p className="text-zinc-500">{item.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Visual Flow Diagram */}
            <div className="relative">
              <div className="absolute inset-0 bg-linear-to-r from-[#C5BAFF]/20 to-[#C4D9FF]/20 blur-3xl rounded-full"></div>
              <div className="relative bg-white p-10 rounded-3xl border border-[#E8F9FF] shadow-xl">
                <div className="flex flex-col items-center gap-8">
                  {/* User Node */}
                  <div className="w-20 h-20 bg-[#C5BAFF] rounded-2xl flex items-center justify-center shadow-lg shadow-[#C5BAFF]/30 z-10">
                    <span className="text-3xl">😎</span>
                  </div>

                  {/* Connection Lines */}
                  <div className="h-16 w-0.5 bg-linear-to-b from-[#C5BAFF] to-[#C4D9FF]"></div>

                  {/* Platform Node */}
                  <div className="w-64 p-4 bg-white border-2 border-[#C4D9FF] rounded-2xl text-center shadow-sm z-10">
                    <span className="font-bold text-zinc-900">
                      shitpost.art Core
                    </span>
                  </div>

                  {/* Branching Lines */}
                  <div className="relative w-full h-12">
                    <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-[#C4D9FF] -translate-x-1/2"></div>
                    <div className="absolute top-1/2 left-10 right-10 h-0.5 bg-[#C4D9FF]"></div>
                    <div className="absolute top-1/2 left-10 h-full w-0.5 bg-[#C4D9FF]"></div>
                    <div className="absolute top-1/2 right-10 h-full w-0.5 bg-[#C4D9FF]"></div>
                  </div>

                  {/* Destination Nodes */}
                  <div className="grid grid-cols-3 gap-4 w-full pt-4">
                    {["𝕏", "📸", "💼"].map((icon, i) => (
                      <div
                        key={i}
                        className="h-16 bg-[#FBFBFB] border border-[#E8F9FF] rounded-xl flex items-center justify-center text-2xl shadow-sm hover:-translate-y-1 transition-transform"
                      >
                        {icon}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-[#E8F9FF] py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#C5BAFF] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <span className="font-bold text-zinc-900">shitpost.art</span>
          </div>
          <div className="text-sm text-zinc-500">
            © {new Date().getFullYear()} shitpost.art. All rights reserved.
          </div>
          <div className="flex gap-6">
            <Link
              href="#"
              className="text-zinc-400 hover:text-[#C5BAFF] transition-colors"
            >
              Twitter
            </Link>
            <Link
              href="#"
              className="text-zinc-400 hover:text-[#C5BAFF] transition-colors"
            >
              GitHub
            </Link>
            <Link
              href="#"
              className="text-zinc-400 hover:text-[#C5BAFF] transition-colors"
            >
              Discord
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
