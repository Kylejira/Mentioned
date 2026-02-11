"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { ArrowRight, Check, X, TrendingUp, Target, Users } from "lucide-react"
import { VisibilityGraph } from "@/components/VisibilityGraph"
import { PlatformBreakdown } from "@/components/PlatformBreakdown"
import { RotatingDashboardPreview } from "@/components/RotatingDashboardPreview"

// Dynamic import for 3D floating bubbles (client-side only)
const FloatingBubbles = dynamic(() => import("@/components/FloatingBubbles"), {
  ssr: false,
})

// Stats for social proof
const STATS = [
  { value: "500+", label: "products scanned" },
  { value: "2 min", label: "average scan time" },
  { value: "20+", label: "AI queries tested" },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-white to-slate-50">
      {/* Sticky Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
          <Image
            src="/logo.png"
            alt="Mentioned"
              width={32}
              height={32}
              className="rounded-lg sm:rounded-xl sm:w-9 sm:h-9"
            />
            <span className="font-semibold text-gray-900 text-base sm:text-lg">Mentioned</span>
          </div>
          <Link href="/check">
            <Button 
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 text-sm rounded-lg shadow-sm"
            >
              Get started
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 sm:pt-24">
        {/* Floating AI platform logos (subtle background) */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-[10%] opacity-[0.04] animate-float">
            <svg className="size-24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
            </svg>
          </div>
          <div className="absolute top-32 right-[15%] opacity-[0.03] animate-float-delayed">
            <svg className="size-20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
            </svg>
          </div>
        </div>

        {/* Gradient orbs for depth */}
        <div className="absolute top-0 left-1/4 w-[800px] h-[800px] bg-gradient-radial from-blue-50 via-white/50 to-transparent rounded-full blur-3xl pointer-events-none opacity-80" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-gradient-radial from-slate-100 via-slate-50/30 to-transparent rounded-full blur-3xl pointer-events-none opacity-60" />
        <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/[0.02] rounded-full blur-3xl pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 lg:py-20 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 sm:gap-16 lg:gap-24 items-center">
            {/* Left side - Text content - shows FIRST on mobile */}
            <div className="text-center lg:text-left lg:pr-8">
              {/* Headline */}
              <h1 className="text-gray-900 text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-4 sm:mb-6">
            Do AI tools recommend
            <br />
                <span className="text-blue-600">your product</span>?
          </h1>
              
              {/* Subheadline */}
              <p className="text-gray-700 text-lg sm:text-xl md:text-2xl font-normal mb-4 sm:mb-6 max-w-md mx-auto lg:mx-0">
                Find out in 2 minutes. See if ChatGPT and Claude recommend you — or ignore you completely.
              </p>
              
              {/* Tagline */}
              <p className="text-gray-500 text-sm sm:text-base font-normal mb-8 sm:mb-10">
                The world&apos;s simplest AI visibility checker.
              </p>
              
              {/* CTA Button */}
              <div>
                <Link href="/check">
                  <Button 
                    size="lg"
                    className="group w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 sm:px-8 py-5 sm:py-6 text-base sm:text-lg rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Check your AI visibility
                    <ArrowRight className="ml-2 size-4 sm:size-5 group-hover:translate-x-0.5 transition-transform" />
                  </Button>
                </Link>
              </div>
            </div>
            
            {/* Right side - Dashboard Preview */}
            <div className="relative">
              <RotatingDashboardPreview />
            </div>
          </div>
        </div>
      </section>
      
      {/* Social Proof Stats Bar */}
      <section className="py-4 sm:py-6 border-y border-gray-100 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-center gap-4 sm:gap-8 md:gap-16">
            {STATS.map((stat, index) => (
              <div key={index} className="flex flex-col sm:flex-row items-center gap-0.5 sm:gap-2 text-center">
                <span className="text-lg sm:text-2xl font-bold text-gray-900">{stat.value}</span>
                <span className="text-xs sm:text-sm text-gray-500">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why This Matters Section */}
      <section className="py-12 sm:py-16 lg:py-20 bg-white">
        <div className="max-w-[600px] mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-gray-900 text-xl sm:text-2xl md:text-3xl font-bold tracking-tight mb-4 sm:mb-6">
            The way people find products has changed
          </h2>
          
          <div className="space-y-3 sm:space-y-4 text-gray-600 text-sm sm:text-base md:text-lg leading-relaxed">
            <p>
              Your customers don&apos;t scroll through Google anymore.
              <br className="hidden sm:block" />
              They ask ChatGPT. They ask Claude. And they trust the answer.
            </p>
            
            <p className="text-blue-600 font-semibold text-base sm:text-lg md:text-xl">
              If you&apos;re not mentioned — you&apos;re invisible.
            </p>
            
            <p className="text-gray-500 text-sm sm:text-base">
              And invisible means losing customers every single day without knowing it.
            </p>
          </div>
        </div>
      </section>

      {/* Results Preview Section */}
      <section className="py-12 sm:py-16 lg:py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-gray-900 text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-center mb-2 sm:mb-4">
            See what you&apos;ll discover
          </h2>
          <p className="text-gray-600 text-sm sm:text-base text-center mb-8 sm:mb-12">
            Which one are you?
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {/* High visibility example */}
            <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-green-100 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-200">
              <div className="flex justify-between items-start mb-3 sm:mb-4">
                <span className="text-xs sm:text-sm font-medium text-green-600 bg-green-50 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full">
                  Excellent
                </span>
                <span className="text-2xl sm:text-3xl font-bold text-green-600">87<span className="text-sm sm:text-lg text-gray-400">/100</span></span>
              </div>
              <p className="font-semibold text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">You&apos;re dominating AI recommendations</p>
              <div className="space-y-2 mb-3 sm:mb-4">
                <div className="flex items-center gap-2">
                  <div className="size-4 sm:size-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <Check className="size-2.5 sm:size-3 text-green-600" />
                  </div>
                  <span className="text-gray-700 text-xs sm:text-sm">ChatGPT: Mentioned in top 3</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="size-4 sm:size-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <Check className="size-2.5 sm:size-3 text-green-600" />
                  </div>
                  <span className="text-gray-700 text-xs sm:text-sm">Claude: Mentioned in top 3</span>
                </div>
              </div>
              <div className="pt-2 sm:pt-3 border-t border-gray-100">
                <p className="text-[10px] sm:text-xs text-gray-500">
                  Outranking: Calendly, Acuity, SavvyCal
                </p>
              </div>
            </div>
            
            {/* Low visibility example */}
            <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-red-100 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-200">
              <div className="flex justify-between items-start mb-3 sm:mb-4">
                <span className="text-xs sm:text-sm font-medium text-red-600 bg-red-50 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full">
                  Not Visible
                </span>
                <span className="text-2xl sm:text-3xl font-bold text-red-600">0<span className="text-sm sm:text-lg text-gray-400">/100</span></span>
              </div>
              <p className="font-semibold text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">AI doesn&apos;t know you exist</p>
              <div className="space-y-2 mb-3 sm:mb-4">
                <div className="flex items-center gap-2">
                  <div className="size-4 sm:size-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <X className="size-2.5 sm:size-3 text-red-600" />
                  </div>
                  <span className="text-gray-700 text-xs sm:text-sm">ChatGPT: Not mentioned</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="size-4 sm:size-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <X className="size-2.5 sm:size-3 text-red-600" />
                  </div>
                  <span className="text-gray-700 text-xs sm:text-sm">Claude: Not mentioned</span>
                </div>
              </div>
              <div className="pt-2 sm:pt-3 border-t border-gray-100">
                <p className="text-[10px] sm:text-xs text-gray-500">
                  Competitors beating you: Calendly, SavvyCal, Acuity
                </p>
              </div>
            </div>
          </div>
          
          <div className="text-center mt-8 sm:mt-10">
            <Link href="/check">
              <Button 
                size="lg"
                className="group w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 sm:px-8 py-4 sm:py-5 text-sm sm:text-base rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-200 hover:scale-[1.02]"
              >
                Find out in 2 minutes
                <ArrowRight className="ml-2 size-4 group-hover:translate-x-0.5 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* What You'll Find Out Section */}
      <section className="py-12 sm:py-16 lg:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2 className="text-gray-900 text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-center mb-8 sm:mb-12">
            What you&apos;ll discover
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {/* Card 1 */}
            <FeatureCard
              icon={<Target className="size-6" />}
              title="Your visibility score"
              description="Find out if ChatGPT and Claude mention you — or ignore you completely."
            />
            
            {/* Card 2 */}
            <FeatureCard
              icon={<Users className="size-6" />}
              title="Who's beating you"
              description="See exactly which competitors AI recommends instead of you."
            />
            
            {/* Card 3 */}
            <FeatureCard
              icon={<TrendingUp className="size-6" />}
              title="How to fix it"
              description="Get specific actions to start getting mentioned by AI."
            />
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-12 sm:py-16 lg:py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-gray-900 text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-center mb-8 sm:mb-12">
            How it works
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 md:gap-4 relative">
            {/* Connecting line (desktop only) */}
            <div className="hidden md:block absolute top-8 left-[20%] right-[20%] h-[2px] bg-gradient-to-r from-slate-200 via-blue-200 to-slate-200" />
            
            {/* Step 1 */}
            <StepCard
              number="1"
              title="Enter your product"
              description="Drop in your URL. We'll figure out the rest."
            />
            
            {/* Step 2 */}
            <StepCard
              number="2"
              title="We ask AI the questions your customers ask"
              description="Real queries to ChatGPT and Claude — not generic tests."
            />
            
            {/* Step 3 */}
            <StepCard
              number="3"
              title="See your results in under 2 minutes"
              description="Know if you're mentioned, who's beating you, and how to fix it."
            />
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-14 sm:py-20 lg:py-24 bg-gradient-to-b from-slate-50 via-blue-50/30 to-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-gray-900 text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-3 sm:mb-4">
            Ready to see where you stand?
          </h2>
          
          <p className="text-gray-600 text-sm sm:text-base md:text-lg mb-6 sm:mb-8">
            Find out if AI is helping or hurting your business.
          </p>
          
          <Link href="/check">
            <Button 
              size="lg"
              className="group w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 sm:px-10 py-5 sm:py-6 text-base sm:text-lg rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              Check your AI visibility
              <ArrowRight className="ml-2 size-4 sm:size-5 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 sm:py-8 border-t border-gray-100 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2">
              <Image
                src="/logo.png"
                alt="Mentioned"
                width={20}
                height={20}
                className="rounded sm:w-6 sm:h-6"
              />
              <span className="text-xs sm:text-sm font-medium text-gray-700">Mentioned</span>
            </div>
            <span className="hidden sm:block text-gray-200">·</span>
            <p className="text-xs sm:text-sm text-gray-500 text-center sm:text-left">
              Check if AI tools recommend your product.
            </p>
          </div>
          
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap justify-center">
            <Link
              href="/privacy-policy"
              className="text-xs sm:text-sm text-gray-500 hover:text-blue-600 transition-colors"
            >
              Privacy Policy
            </Link>
            <span className="text-gray-200">·</span>
            <Link
              href="/terms"
              className="text-xs sm:text-sm text-gray-500 hover:text-blue-600 transition-colors"
            >
              Terms
            </Link>
            <span className="text-gray-200">·</span>
            <span className="text-xs sm:text-sm text-gray-400">Built by Kyle Jira</span>
            <div className="flex items-center gap-3">
              <a 
                href="https://x.com/kylej08" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-blue-600 transition-colors p-1"
                aria-label="Twitter/X"
              >
                <svg className="size-4 sm:size-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a 
                href="https://www.linkedin.com/in/kyle-jira-703a81225" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-blue-600 transition-colors p-1"
                aria-label="LinkedIn"
              >
                <svg className="size-4 sm:size-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="group bg-white border border-gray-100 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
      <div className="size-10 sm:size-12 rounded-lg sm:rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 mb-3 sm:mb-4 group-hover:scale-110 transition-transform duration-200">
        <div className="scale-90 sm:scale-100">{icon}</div>
      </div>
      <h3 className="text-gray-900 font-semibold text-base sm:text-lg mb-1.5 sm:mb-2">{title}</h3>
      <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">{description}</p>
    </div>
  )
}

function StepCard({
  number,
  title,
  description,
}: {
  number: string
  title: string
  description: string
}) {
  return (
    <div className="text-center relative z-10 group">
      <div className="size-12 sm:size-16 rounded-full bg-blue-600 text-white text-xl sm:text-2xl font-bold flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-lg shadow-blue-500/25 group-hover:scale-110 transition-transform duration-200">
        {number}
      </div>
      <h3 className="text-gray-900 font-semibold text-sm sm:text-base mb-1.5 sm:mb-2">{title}</h3>
      <p className="text-gray-600 text-xs sm:text-sm leading-relaxed max-w-[200px] sm:max-w-[220px] mx-auto">{description}</p>
    </div>
  )
}

