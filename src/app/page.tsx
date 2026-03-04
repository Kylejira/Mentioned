"use client"

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ArrowRight, Check, X, TrendingUp, Target, Users } from "lucide-react"
import { HeroScanAnimation } from "@/components/landing/hero-scan-animation"

const CREDIBILITY_STATS = [
  { value: "500+", label: "SaaS & ecommerce products analyzed" },
  { value: "2,000+", label: "real buyer-style AI queries processed" },
  { value: "37%", label: "average AI visibility lift after optimization" },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24 lg:py-[120px] relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-12 lg:gap-20 items-center">
            {/* Left side - Text content */}
            <div className="text-center md:text-left md:pr-4">
              <h1 className="text-gray-900 text-3xl sm:text-4xl md:text-5xl lg:text-[3.5rem] font-extrabold tracking-tight leading-[1.08] mb-6 sm:mb-8">
                Is AI Recommending Your Product — Or{" "}
                <span className="text-blue-600">Your Competitors</span>?
              </h1>

              <p className="text-gray-600 text-lg sm:text-xl font-normal leading-relaxed mb-8 sm:mb-10 max-w-2xl mx-auto md:mx-0">
                When customers ask AI what to use in your category, it gives one answer — not ten blue links. If your product isn&apos;t mentioned in that answer, you&apos;re invisible.
                <br className="hidden sm:block" />
                <span className="mt-2 inline-block">See exactly how AI ranks you — and what to fix to increase recommendations.</span>
              </p>

              <div>
                <Link href="/check">
                  <Button
                    size="lg"
                    className="group w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 sm:px-10 h-14 text-base sm:text-lg rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
                  >
                    Check If AI Recommends My Product
                    <ArrowRight className="ml-2 size-5 group-hover:translate-x-0.5 transition-transform" />
                  </Button>
                </Link>
                <p className="text-gray-500 text-sm mt-4 font-medium">
                  Free scan · No credit card required · Results in 2 minutes
                </p>
              </div>
            </div>

            {/* Right side - Scan Animation */}
            <div className="hidden md:flex items-center justify-center min-h-[380px]">
              <HeroScanAnimation />
            </div>
          </div>
        </div>
      </section>
      
      {/* Social Proof & Credibility Strip */}
      <section className="py-12 sm:py-14">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <p className="text-center text-sm text-gray-500 font-medium tracking-wide uppercase mb-8">
            Trusted by founders optimizing their AI visibility
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
            {CREDIBILITY_STATS.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl sm:text-4xl font-extrabold text-gray-900">{stat.value}</div>
                <div className="text-sm text-gray-600 mt-1 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-5 text-center">
            Data based on internal beta scans and optimization tests.
          </p>
        </div>
      </section>

      {/* What You'll See Section */}
      <section className="py-20 sm:py-24 lg:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14 sm:mb-16">
            <h2 className="text-gray-900 text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-5 sm:mb-6">
              What You&apos;ll See — And What Our AI Analyzes
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
            <div className="border border-gray-200 rounded-2xl p-6 sm:p-8 text-center">
              <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                <Users className="size-6 text-red-500" />
              </div>
              <h3 className="font-semibold text-gray-900 text-base sm:text-lg mb-2">AI Visibility Score</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                A clear score showing how often your product appears in AI-generated recommendations when buyers ask for solutions in your category.
              </p>
            </div>

            <div className="border border-gray-200 rounded-2xl p-6 sm:p-8 text-center">
              <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
                <Target className="size-6 text-amber-500" />
              </div>
              <h3 className="font-semibold text-gray-900 text-base sm:text-lg mb-2">Competitive AI Analysis</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                We simulate real buyer-style prompts across major AI models, analyze which competitors are mentioned, and identify patterns in how they are positioned in AI responses.
              </p>
            </div>

            <div className="border border-gray-200 rounded-2xl p-6 sm:p-8 text-center">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="size-6 text-blue-500" />
              </div>
              <h3 className="font-semibold text-gray-900 text-base sm:text-lg mb-2">Why They&apos;re Winning — And How You Can</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                See what signals, messaging, and positioning AI models favor — and get specific recommendations to improve your inclusion in AI-generated answers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How Mentioned Works */}
      <section className="py-20 sm:py-24 lg:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="text-gray-900 text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-center mb-14 sm:mb-16">
            How Mentioned Works
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-12">
            <div className="text-center">
              <div className="w-11 h-11 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center mx-auto mb-5">
                1
              </div>
              <h3 className="font-semibold text-gray-900 text-base sm:text-lg mb-2">Enter Your Product</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Add your website and category.
              </p>
            </div>

            <div className="text-center">
              <div className="w-11 h-11 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center mx-auto mb-5">
                2
              </div>
              <h3 className="font-semibold text-gray-900 text-base sm:text-lg mb-2">We Query AI Models</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                We simulate real buyer queries across leading AI models.
              </p>
            </div>

            <div className="text-center">
              <div className="w-11 h-11 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center mx-auto mb-5">
                3
              </div>
              <h3 className="font-semibold text-gray-900 text-base sm:text-lg mb-2">Get Your Visibility Score</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                See mention rate, ranking position, competitors, and action plan.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* AI Visibility vs SEO Section */}
      <section className="py-[120px]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 sm:mb-14">
            <h2 className="text-gray-900 text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-5 sm:mb-6">
              AI Visibility Is Not SEO
            </h2>
            <p className="text-gray-700 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
              AI models don&apos;t rank websites. They generate answers. If your product isn&apos;t included in those answers, traditional SEO won&apos;t save you.
            </p>
          </div>

          <div className="max-w-3xl mx-auto border border-gray-200 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-2">
              <div className="px-5 sm:px-6 py-4 bg-gray-50 border-b border-r border-gray-200">
                <span className="text-sm font-bold text-gray-500">Traditional SEO Tools</span>
              </div>
              <div className="px-5 sm:px-6 py-4 bg-gray-50 border-b border-gray-200">
                <span className="text-sm font-bold text-blue-600">Mentioned</span>
              </div>

              <div className="px-5 sm:px-6 py-[14px] border-b border-r border-gray-200">
                <span className="text-sm text-gray-600">Optimize for search engine rankings</span>
              </div>
              <div className="px-5 sm:px-6 py-[14px] border-b border-gray-200">
                <span className="text-sm text-gray-900 font-medium">Optimize for AI-generated recommendations</span>
              </div>

              <div className="px-5 sm:px-6 py-[14px] border-b border-r border-gray-200">
                <span className="text-sm text-gray-600">Track keywords and traffic</span>
              </div>
              <div className="px-5 sm:px-6 py-[14px] border-b border-gray-200">
                <span className="text-sm text-gray-900 font-medium">Simulate real buyer AI prompts</span>
              </div>

              <div className="px-5 sm:px-6 py-[14px] border-b border-r border-gray-200">
                <span className="text-sm text-gray-600">Improve click-through rate</span>
              </div>
              <div className="px-5 sm:px-6 py-[14px] border-b border-gray-200">
                <span className="text-sm text-gray-900 font-medium">Improve inclusion in AI answers</span>
              </div>

              <div className="px-5 sm:px-6 py-[14px] border-b border-r border-gray-200">
                <span className="text-sm text-gray-600">Measure website visits</span>
              </div>
              <div className="px-5 sm:px-6 py-[14px] border-b border-gray-200">
                <span className="text-sm text-gray-900 font-medium">Measure AI mention frequency</span>
              </div>

              <div className="px-5 sm:px-6 py-[14px] border-r border-gray-200">
                <span className="text-sm text-gray-600">Focus on Google algorithms</span>
              </div>
              <div className="px-5 sm:px-6 py-[14px]">
                <span className="text-sm text-gray-900 font-medium">Analyze ChatGPT, Claude, Gemini, Perplexity</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Results Preview Section */}
      <section className="py-20 sm:py-24 lg:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="text-gray-900 text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-center mb-10 sm:mb-14">
            Two types of products. Which are you?
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-8 max-w-4xl mx-auto">
            {/* High visibility example */}
            <div className="bg-white rounded-xl sm:rounded-2xl p-5 sm:p-7 border border-gray-200 border-l-4 border-l-green-400 shadow-sm">
              <div className="flex justify-between items-start mb-3 sm:mb-4">
                <span className="text-xs sm:text-sm font-medium text-green-600 bg-green-50 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full">
                  Excellent
                </span>
                <span className="text-2xl sm:text-3xl font-bold text-green-600">87<span className="text-sm sm:text-lg text-gray-500">/100</span></span>
              </div>
              <p className="font-semibold text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">Dominating AI recommendations</p>
              <div className="space-y-2 mb-3 sm:mb-4">
                <div className="flex items-center gap-2">
                  <div className="size-4 sm:size-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <Check className="size-2.5 sm:size-3 text-green-600" />
                  </div>
                  <span className="text-gray-800 text-xs sm:text-sm">ChatGPT: Mentioned in top 3</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="size-4 sm:size-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <Check className="size-2.5 sm:size-3 text-green-600" />
                  </div>
                  <span className="text-gray-800 text-xs sm:text-sm">Claude: Mentioned in top 3</span>
                </div>
              </div>
              <p className="text-xs text-gray-600 font-medium mt-3">
                Outranking: Calendly, Acuity, SavvyCal
              </p>
            </div>
            
            {/* Low visibility example */}
            <div className="bg-white rounded-xl sm:rounded-2xl p-5 sm:p-7 border border-gray-200 border-l-4 border-l-red-400 shadow-sm">
              <div className="flex justify-between items-start mb-3 sm:mb-4">
                <span className="text-xs sm:text-sm font-medium text-red-600 bg-red-50 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full">
                  Not Visible
                </span>
                <span className="text-2xl sm:text-3xl font-bold text-red-600">0<span className="text-sm sm:text-lg text-gray-500">/100</span></span>
              </div>
              <p className="font-semibold text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">Invisible to AI</p>
              <div className="space-y-2 mb-3 sm:mb-4">
                <div className="flex items-center gap-2">
                  <div className="size-4 sm:size-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <X className="size-2.5 sm:size-3 text-red-600" />
                  </div>
                  <span className="text-gray-800 text-xs sm:text-sm">ChatGPT: Not mentioned</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="size-4 sm:size-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <X className="size-2.5 sm:size-3 text-red-600" />
                  </div>
                  <span className="text-gray-800 text-xs sm:text-sm">Claude: Not mentioned</span>
                </div>
              </div>
              <p className="text-xs text-gray-600 font-medium mt-3">
                Competitors beating you: Calendly, SavvyCal, Acuity
              </p>
            </div>
          </div>
          
          <div className="text-center mt-10 sm:mt-14">
            <Link href="/check">
              <Button 
                size="lg"
                className="group w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold px-10 sm:px-12 h-14 text-base sm:text-lg rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-200 hover:-translate-y-0.5"
              >
                Find out in 2 minutes
                <ArrowRight className="ml-2 size-5 group-hover:translate-x-0.5 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-24 sm:py-28 lg:py-32">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-gray-900 text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-5 sm:mb-6">
            Don&apos;t Let AI Decide Your Future Without You.
          </h2>

          <p className="text-gray-700 text-base sm:text-lg leading-relaxed mb-10 sm:mb-12">
            If customers are asking AI what to use in your category — you need to know what it&apos;s saying.
          </p>

          <Link href="/check">
            <Button
              size="lg"
              className="group w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold px-12 sm:px-14 h-16 text-lg sm:text-xl rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
            >
              Run My Free AI Visibility Scan
              <ArrowRight className="ml-2.5 size-5 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </Link>

          <p className="text-sm text-gray-500 mt-5">
            Takes 2 minutes · No credit card required
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 sm:py-8 border-t border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
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
            <span className="text-xs sm:text-sm text-gray-500">Built by Kyle Jira</span>
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
