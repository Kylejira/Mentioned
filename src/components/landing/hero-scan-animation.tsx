"use client"

import { useState, useEffect, useRef } from "react"

const QUERIES = [
  "Top scheduling software for teams?",
  "Best CRM for small businesses?",
  "Best payment platform for creators?",
]

const PROVIDERS = [
  { name: "ChatGPT", color: "#10A37F", delay: 0, duration: 2000, mentioned: true, position: 2 },
  { name: "Claude", color: "#D97757", delay: 300, duration: 2100, mentioned: false, position: null },
  { name: "Gemini", color: "#4285F4", delay: 600, duration: 2200, mentioned: true, position: 4 },
]

const TARGET_SCORE = 34

type Phase = "typing" | "scanning" | "score" | "hold" | "fade"

export function HeroScanAnimation() {
  const [phase, setPhase] = useState<Phase>("typing")
  const [typedText, setTypedText] = useState("")
  const [visibleRows, setVisibleRows] = useState<Set<number>>(new Set())
  const [doneRows, setDoneRows] = useState<Set<number>>(new Set())
  const [revealed, setRevealed] = useState<Set<number>>(new Set())
  const [showScore, setShowScore] = useState(false)
  const [score, setScore] = useState(0)
  const [barFilled, setBarFilled] = useState(false)

  const qIdx = useRef(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const typer = useRef<ReturnType<typeof setInterval> | null>(null)
  const raf = useRef(0)

  useEffect(() => {
    function cleanup() {
      timers.current.forEach(clearTimeout)
      timers.current = []
      if (typer.current) { clearInterval(typer.current); typer.current = null }
      cancelAnimationFrame(raf.current)
    }

    function at(fn: () => void, ms: number) {
      timers.current.push(setTimeout(fn, ms))
    }

    function runCycle() {
      cleanup()
      setPhase("typing")
      setTypedText("")
      setVisibleRows(new Set())
      setDoneRows(new Set())
      setRevealed(new Set())
      setShowScore(false)
      setScore(0)
      setBarFilled(false)

      const query = QUERIES[qIdx.current]
      let ci = 0
      typer.current = setInterval(() => {
        ci++
        if (ci <= query.length) {
          setTypedText(query.slice(0, ci))
        } else {
          if (typer.current) clearInterval(typer.current)
          typer.current = null
        }
      }, 40)

      // Providers appear staggered (2.2s+)
      at(() => setPhase("scanning"), 2200)
      PROVIDERS.forEach((p, i) => {
        at(() => setVisibleRows(s => new Set([...s, i])), 2200 + p.delay)
        at(() => setDoneRows(s => new Set([...s, i])), 2200 + p.delay + p.duration)
      })

      // Staggered result reveals
      at(() => setRevealed(s => new Set([...s, 0])), 5000)
      at(() => setRevealed(s => new Set([...s, 1])), 5400)
      at(() => setRevealed(s => new Set([...s, 2])), 5800)

      // Score section
      at(() => setShowScore(true), 6200)
      at(() => {
        setPhase("score")
        setBarFilled(true)
        let t0 = 0
        function tick(now: number) {
          if (!t0) t0 = now
          const p = Math.min((now - t0) / 1000, 1)
          const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p)
          setScore(Math.round(eased * TARGET_SCORE))
          if (p < 1) raf.current = requestAnimationFrame(tick)
        }
        raf.current = requestAnimationFrame(tick)
      }, 6500)

      at(() => setPhase("hold"), 8000)
      at(() => setPhase("fade"), 9500)
      at(() => {
        qIdx.current = (qIdx.current + 1) % QUERIES.length
        runCycle()
      }, 10300)
    }

    runCycle()
    return cleanup
  }, [])

  const hasProviders = visibleRows.size > 0
  const scoreVisible = showScore && phase !== "typing"

  return (
    <div className="w-full max-w-[440px] rounded-2xl bg-gray-950/90 backdrop-blur-xl border border-gray-800/60 shadow-2xl overflow-hidden relative">
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />

      <div
        className="relative p-6"
        style={{
          opacity: phase === "fade" ? 0 : 1,
          transition: "opacity 400ms ease-out",
          willChange: "opacity",
        }}
      >
        {/* Query bar */}
        <div style={{ opacity: phase === "typing" ? 1 : 0.5, transition: "opacity 500ms" }}>
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-gray-800/50 border border-gray-700/50">
            <span className="text-gray-500 text-xs mt-0.5">💬</span>
            <span className="text-sm text-gray-300 font-mono leading-relaxed">
              {typedText}
              <span
                style={{
                  animation: phase === "typing" ? "hero-blink 1s step-end infinite" : "none",
                  opacity: phase === "typing" ? 1 : 0,
                  transition: "opacity 200ms",
                }}
              >
                ▌
              </span>
            </span>
          </div>
        </div>

        {/* Provider rows — each row grows independently */}
        <div style={{ marginTop: hasProviders ? 12 : 0, transition: "margin-top 400ms ease-out" }}>
          {PROVIDERS.map((provider, i) => {
            const isVisible = visibleRows.has(i)
            const isDone = doneRows.has(i)
            const isRevealed = revealed.has(i)
            return (
              <div
                key={provider.name}
                style={{
                  maxHeight: isVisible ? 48 : 0,
                  overflow: "hidden",
                  transition: "max-height 400ms ease-out",
                }}
              >
                <div
                  className="flex items-center justify-between py-2 border-l-2 pl-2"
                  style={{
                    borderColor: isRevealed && provider.mentioned ? "#4ade80" : "transparent",
                    opacity: isVisible ? 1 : 0,
                    transform: isVisible ? "translateY(0)" : "translateY(12px)",
                    transition: "opacity 400ms ease-out, transform 400ms ease-out, border-color 300ms ease-out",
                  }}
                >
                  <div className="flex items-center gap-2.5 shrink-0">
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold text-white"
                      style={{ backgroundColor: provider.color }}
                    >
                      {provider.name[0]}
                    </div>
                    <span className="text-xs font-medium text-gray-400">
                      {provider.name}
                    </span>
                  </div>

                  <div className="relative h-5 w-36">
                    {/* Scanning state */}
                    <div
                      className="absolute inset-0 flex items-center justify-end gap-2"
                      style={{
                        opacity: isRevealed ? 0 : 1,
                        transition: "opacity 200ms ease-out",
                      }}
                    >
                      <div className="w-20 h-1 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-400/70 rounded-full"
                          style={{
                            width: isVisible ? "100%" : "0%",
                            transition: `width ${provider.duration}ms linear`,
                          }}
                        />
                      </div>
                      <span
                        className="text-[10px] w-14 text-right"
                        style={{ color: isDone ? "#60A5FA" : "#4B5563" }}
                      >
                        {isDone ? "✓" : "scanning..."}
                      </span>
                    </div>

                    {/* Result state */}
                    <div
                      className="absolute inset-0 flex items-center justify-end gap-1.5"
                      style={{
                        opacity: isRevealed ? 1 : 0,
                        transition: "opacity 300ms ease-out",
                        transitionDelay: isRevealed ? "100ms" : "0ms",
                      }}
                    >
                      {provider.mentioned ? (
                        <>
                          <div
                            className="w-2 h-2 rounded-full bg-green-400"
                            style={{ boxShadow: "0 0 6px rgba(74,222,128,0.4)" }}
                          />
                          <span className="text-xs text-green-400 font-medium">
                            Mentioned
                          </span>
                          <span className="text-xs text-green-400/70 font-mono">
                            #{provider.position}
                          </span>
                        </>
                      ) : (
                        <>
                          <div className="w-2 h-2 rounded-full bg-gray-600" />
                          <span className="text-xs text-gray-500">Not mentioned</span>
                          <span className="text-xs text-gray-600">—</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Score section */}
        <div
          style={{
            maxHeight: scoreVisible ? 200 : 0,
            overflow: "hidden",
            transition: "max-height 500ms ease-out",
          }}
        >
          <div
            style={{
              opacity: scoreVisible ? 1 : 0,
              transform: scoreVisible ? "translateY(0)" : "translateY(8px)",
              transition: "all 500ms ease-out",
              transitionDelay: scoreVisible ? "200ms" : "0ms",
            }}
          >
            <div className="border-t border-gray-700/30 mt-4 pt-4 pb-6">
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">
                Visibility Score
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-orange-400">
                  {score}
                </span>
                <span className="text-sm text-gray-600">/100</span>
              </div>
              <div className="mt-1.5">
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-semibold border"
                  style={{
                    backgroundColor: "rgba(249,115,22,0.15)",
                    color: "#fb923c",
                    borderColor: "rgba(249,115,22,0.2)",
                  }}
                >
                  Low
                </span>
              </div>
              <div className="mt-3 w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-400 rounded-full"
                  style={{
                    width: barFilled ? "34%" : "0%",
                    transition: "width 1000ms ease-out",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes hero-blink {
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
