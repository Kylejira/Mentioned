import type { Metadata } from "next"
import { readFileSync } from "fs"
import { join } from "path"
import Link from "next/link"
import Image from "next/image"
import ReactMarkdown from "react-markdown"
import { Button } from "@/components/ui/button"
import { BackToTop } from "@/components/BackToTop"

const SECTION_IDS: Record<number, string> = {
  1: "introduction-and-acceptance",
  2: "eligibility",
  3: "description-of-service",
  4: "account-registration-and-security",
  5: "subscriptions-payments-and-credits",
  6: "acceptable-use-policy",
  7: "intellectual-property",
  8: "artificial-intelligence-disclaimer",
  9: "third-party-services-and-links",
  10: "disclaimer-of-warranties",
  11: "limitation-of-liability",
  12: "indemnification",
  13: "dispute-resolution",
  14: "term-and-termination",
  15: "general-provisions",
  16: "changes-to-these-terms",
  17: "contact-us",
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\d+\.\s*/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export const metadata: Metadata = {
  title: "Terms and Conditions | Mentioned.pro",
  description:
    "Terms and Conditions for Mentioned.pro - Governing your use of our AI visibility checking service.",
  robots: { index: true, follow: true },
  alternates: {
    canonical: "https://mentioned.pro/terms",
  },
}

function getTermsContent(): string {
  try {
    const path = join(process.cwd(), "terms-and-conditions.md")
    return readFileSync(path, "utf-8")
  } catch {
    return ""
  }
}

export default function TermsPage() {
  const content = getTermsContent()

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-white to-slate-50">
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 sm:gap-3">
            <Image
              src="/logo.png"
              alt="Mentioned"
              width={32}
              height={32}
              className="rounded-lg sm:rounded-xl sm:w-9 sm:h-9"
            />
            <span className="font-semibold text-gray-900 text-base sm:text-lg">
              Mentioned
            </span>
          </Link>
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

      <main className="pt-20 sm:pt-24 pb-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <article
            className="terms-content max-w-none"
            style={{ fontSize: "1rem", lineHeight: 1.7 }}
          >
            <ReactMarkdown
              components={{
                h1: ({ children }) => (
                  <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-2 mt-0">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => {
                  const text =
                    typeof children === "string"
                      ? children
                      : Array.isArray(children)
                        ? String((children as React.ReactNode[])[0])
                        : ""
                  const match = text.match(/^(\d+)\.\s*(.+)$/)
                  const id =
                    match && SECTION_IDS[Number(match[1])]
                      ? SECTION_IDS[Number(match[1])]
                      : slugify(text)
                  return (
                    <h2
                      id={id}
                      className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-tight mt-12 mb-4 scroll-mt-24"
                    >
                      {children}
                    </h2>
                  )
                },
                h3: ({ children }) => {
                  const text =
                    typeof children === "string"
                      ? children
                      : Array.isArray(children)
                        ? String((children as React.ReactNode[])[0] ?? "")
                        : ""
                  return (
                    <h3
                      id={slugify(text)}
                      className="text-lg font-medium text-gray-900 mt-8 mb-3 scroll-mt-24"
                    >
                      {children}
                    </h3>
                  )
                },
                p: ({ children }) => (
                  <p className="text-gray-700 mb-4 leading-[1.7]">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="mb-4 list-disc pl-6 space-y-1 [&_ul]:pl-8 [&_ul]:border-l-2 [&_ul]:border-gray-100 [&_ul]:ml-2 [&_ul]:mt-1">
                    {children}
                  </ul>
                ),
                li: ({ children }) => (
                  <li className="text-gray-700 leading-[1.7]">{children}</li>
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold text-gray-900">
                    {children}
                  </strong>
                ),
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target={href?.startsWith("http") ? "_blank" : undefined}
                    rel={
                      href?.startsWith("http")
                        ? "noopener noreferrer"
                        : undefined
                    }
                    className="text-blue-600 hover:text-blue-700 underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded"
                  >
                    {children}
                  </a>
                ),
                hr: () => <hr className="my-8 border-gray-200" />,
              }}
            >
              {content}
            </ReactMarkdown>
          </article>
        </div>
      </main>

      <footer className="py-6 sm:py-8 border-t border-gray-100 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/logo.png"
                alt="Mentioned"
                width={20}
                height={20}
                className="rounded sm:w-6 sm:h-6"
              />
              <span className="text-xs sm:text-sm font-medium text-gray-700">
                Mentioned
              </span>
            </Link>
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
            <span className="text-xs sm:text-sm text-gray-400">
              Built by Kyle Jira
            </span>
            <div className="flex items-center gap-3">
              <a
                href="https://x.com/kylej08"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-blue-600 transition-colors p-1"
                aria-label="Twitter/X"
              >
                <svg
                  className="size-4 sm:size-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
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
                <svg
                  className="size-4 sm:size-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>

      <BackToTop />
    </div>
  )
}
