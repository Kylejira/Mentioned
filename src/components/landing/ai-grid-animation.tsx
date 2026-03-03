"use client"

import { useState, useEffect, useRef } from "react"

interface Dot {
  id: number
  x: number
  y: number
  isModel: boolean
  label?: string
  mentioned: boolean
}

const DOTS: Dot[] = [
  // AI model dots
  { id: 0,  x: 24, y: 18, isModel: true,  label: "ChatGPT",    mentioned: true  },
  { id: 1,  x: 76, y: 22, isModel: true,  label: "Claude",     mentioned: true  },
  { id: 2,  x: 18, y: 76, isModel: true,  label: "Gemini",     mentioned: true  },
  { id: 3,  x: 82, y: 72, isModel: true,  label: "Perplexity", mentioned: true  },
  { id: 4,  x: 8,  y: 47, isModel: true,                       mentioned: true  },
  { id: 5,  x: 92, y: 46, isModel: true,                       mentioned: false },
  // Inner ring (~16 units from center)
  { id: 6,  x: 50, y: 34, isModel: false, mentioned: true  },
  { id: 7,  x: 63, y: 42, isModel: false, mentioned: true  },
  { id: 8,  x: 63, y: 58, isModel: false, mentioned: true  },
  { id: 9,  x: 50, y: 66, isModel: false, mentioned: false },
  { id: 10, x: 37, y: 58, isModel: false, mentioned: true  },
  { id: 11, x: 37, y: 42, isModel: false, mentioned: false },
  // Middle ring (~25-28 units from center)
  { id: 12, x: 50, y: 23, isModel: false, mentioned: true  },
  { id: 13, x: 68, y: 27, isModel: false, mentioned: true  },
  { id: 14, x: 76, y: 42, isModel: false, mentioned: true  },
  { id: 15, x: 74, y: 60, isModel: false, mentioned: false },
  { id: 16, x: 62, y: 74, isModel: false, mentioned: true  },
  { id: 17, x: 50, y: 78, isModel: false, mentioned: true  },
  { id: 18, x: 38, y: 74, isModel: false, mentioned: false },
  { id: 19, x: 26, y: 60, isModel: false, mentioned: true  },
  { id: 20, x: 24, y: 42, isModel: false, mentioned: true  },
  { id: 21, x: 32, y: 27, isModel: false, mentioned: false },
  // Outer ring (~38-44 units from center)
  { id: 22, x: 50, y: 8,  isModel: false, mentioned: true  },
  { id: 23, x: 70, y: 11, isModel: false, mentioned: true  },
  { id: 24, x: 88, y: 30, isModel: false, mentioned: true  },
  { id: 25, x: 90, y: 56, isModel: false, mentioned: false },
  { id: 26, x: 85, y: 82, isModel: false, mentioned: true  },
  { id: 27, x: 65, y: 90, isModel: false, mentioned: true  },
  { id: 28, x: 40, y: 90, isModel: false, mentioned: true  },
  { id: 29, x: 15, y: 82, isModel: false, mentioned: false },
  { id: 30, x: 6,  y: 62, isModel: false, mentioned: true  },
  { id: 31, x: 10, y: 32, isModel: false, mentioned: true  },
  { id: 32, x: 28, y: 8,  isModel: false, mentioned: false },
  { id: 33, x: 60, y: 88, isModel: false, mentioned: true  },
]

// Pre-compute constellation connections between nearby dots
const EDGES: [number, number][] = []
for (let i = 0; i < DOTS.length; i++) {
  for (let j = i + 1; j < DOTS.length; j++) {
    const dx = DOTS[i].x - DOTS[j].x
    const dy = DOTS[i].y - DOTS[j].y
    if (Math.sqrt(dx * dx + dy * dy) < 20) EDGES.push([i, j])
  }
}

const MODEL_IDS = [0, 1, 2, 3, 4, 5]
const QUERY_IDS = DOTS.filter(d => !d.isModel).map(d => d.id)
const TARGET = 87
const CYCLE_MS = 9000

function getModelColor(id: number): string {
  if (id === 2) return "#F59E0B" // amber for Gemini
  if (id === 5) return "#6B7280" // gray for unlabeled
  return "#10B981"
}

export function AIGridAnimation() {
  const [activeModels, setActiveModels] = useState<Set<number>>(new Set())
  const [activeQueries, setActiveQueries] = useState<Set<number>>(new Set())
  const [showScore, setShowScore] = useState(false)
  const [score, setScore] = useState(0)
  const [rippleKey, setRippleKey] = useState(0)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const rafRef = useRef(0)

  useEffect(() => {
    function cleanup() {
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
      cancelAnimationFrame(rafRef.current)
    }

    function schedule(fn: () => void, ms: number) {
      timersRef.current.push(setTimeout(fn, ms))
    }

    function runCycle() {
      cleanup()
      setActiveModels(new Set())
      setActiveQueries(new Set())
      setShowScore(false)
      setScore(0)

      // Phase 2: Ripple sonar ping
      schedule(() => setRippleKey(k => k + 1), 500)

      // Phase 3: AI models activate (staggered)
      MODEL_IDS.forEach((id, i) => {
        schedule(() => setActiveModels(prev => new Set([...prev, id])), 1500 + i * 300)
      })

      // Phase 4: Query nodes fire (staggered)
      QUERY_IDS.forEach((id, i) => {
        schedule(() => setActiveQueries(prev => new Set([...prev, id])), 3000 + i * 50)
      })

      // Phase 5: Score counter materializes
      schedule(() => {
        setShowScore(true)
        let startTime = 0
        function tick(now: number) {
          if (!startTime) startTime = now
          const progress = Math.min((now - startTime) / 1500, 1)
          const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
          setScore(Math.round(eased * TARGET))
          if (progress < 1) rafRef.current = requestAnimationFrame(tick)
        }
        rafRef.current = requestAnimationFrame(tick)
      }, 5000)

      // Phase 7: Reset and loop
      schedule(runCycle, CYCLE_MS)
    }

    runCycle()
    return cleanup
  }, [])

  const isActive = (id: number) => activeModels.has(id) || activeQueries.has(id)

  return (
    <div className="relative w-full max-w-[480px] aspect-square mx-auto">
      {/* Background glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-green-500/5 rounded-3xl" />

      {/* Main dark card */}
      <div className="relative w-full h-full rounded-3xl bg-gray-900/80 backdrop-blur-xl border border-gray-800/50 overflow-hidden shadow-2xl">
        {/* Grid texture */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        {/* SVG connection lines */}
        <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 1 }}>
          {EDGES.map(([a, b]) => (
            <line
              key={`${a}-${b}`}
              x1={`${DOTS[a].x}%`}
              y1={`${DOTS[a].y}%`}
              x2={`${DOTS[b].x}%`}
              y2={`${DOTS[b].y}%`}
              stroke={
                isActive(a) && isActive(b)
                  ? "rgba(96,165,250,0.25)"
                  : "rgba(148,163,184,0.06)"
              }
              strokeWidth={1}
              style={{ transition: "stroke 700ms" }}
            />
          ))}
          {MODEL_IDS.map(id => (
            <line
              key={`c${id}`}
              x1={`${DOTS[id].x}%`}
              y1={`${DOTS[id].y}%`}
              x2="50%"
              y2="50%"
              stroke={
                activeModels.has(id)
                  ? "rgba(96,165,250,0.18)"
                  : "rgba(148,163,184,0.03)"
              }
              strokeWidth={1}
              style={{ transition: "stroke 700ms" }}
            />
          ))}
        </svg>

        {/* Ripple wave */}
        {rippleKey > 0 && (
          <div
            key={rippleKey}
            className="absolute rounded-full border border-blue-400/30 pointer-events-none"
            style={{
              left: "50%",
              top: "50%",
              width: "85%",
              height: "85%",
              zIndex: 2,
              willChange: "transform",
              animation: "aig-ripple 1.2s ease-out forwards",
            }}
          />
        )}

        {/* Dots */}
        {DOTS.map(dot => {
          const active = isActive(dot.id)

          if (dot.isModel) {
            const color = getModelColor(dot.id)
            const glows = color !== "#6B7280"
            return (
              <div
                key={dot.id}
                style={{
                  position: "absolute",
                  left: `${dot.x}%`,
                  top: `${dot.y}%`,
                  transform: `translate(-50%,-50%) scale(${active ? 1.3 : 1})`,
                  transition: "all 500ms",
                  willChange: "transform",
                  zIndex: 3,
                }}
              >
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    border: `1px solid ${active ? color + "80" : "rgba(107,114,128,0.2)"}`,
                    backgroundColor: active ? color : "rgba(107,114,128,0.3)",
                    boxShadow: active && glows ? `0 0 12px ${color}80` : "none",
                    transition: "all 500ms",
                  }}
                />
                {dot.label && (
                  <span
                    style={{
                      position: "absolute",
                      top: "50%",
                      transform: "translateY(-50%)",
                      fontSize: 9,
                      fontWeight: 500,
                      letterSpacing: "0.05em",
                      color: "rgba(156,163,175,0.8)",
                      whiteSpace: "nowrap",
                      opacity: active ? 1 : 0,
                      transition: "opacity 500ms",
                      ...(dot.x < 50
                        ? { right: "100%", paddingRight: 8 }
                        : { left: "100%", paddingLeft: 8 }),
                    }}
                  >
                    {dot.label}
                  </span>
                )}
              </div>
            )
          }

          return (
            <div
              key={dot.id}
              style={{
                position: "absolute",
                left: `${dot.x}%`,
                top: `${dot.y}%`,
                width: 8,
                height: 8,
                borderRadius: "50%",
                transform: "translate(-50%,-50%)",
                backgroundColor: active
                  ? dot.mentioned
                    ? "#10B981"
                    : "rgba(107,114,128,0.4)"
                  : "rgba(107,114,128,0.25)",
                boxShadow:
                  active && dot.mentioned
                    ? "0 0 6px rgba(16,185,129,0.4)"
                    : "none",
                transition: "all 600ms",
                zIndex: 3,
              }}
            />
          )
        })}

        {/* Center score circle */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center"
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            border: showScore
              ? "2px solid rgba(59,130,246,0.7)"
              : "1px solid rgba(55,65,81,0.5)",
            backgroundColor: showScore
              ? "rgba(31,41,55,0.8)"
              : "transparent",
            boxShadow: showScore
              ? "0 0 30px rgba(59,130,246,0.15)"
              : "none",
            backdropFilter: showScore ? "blur(8px)" : "none",
            transition: "all 800ms",
            zIndex: 4,
          }}
        >
          {showScore && (
            <>
              <div className="flex items-baseline">
                <span className="text-[30px] font-extrabold text-white leading-none">
                  {score}
                </span>
                <span className="text-sm text-gray-400 ml-0.5">/100</span>
              </div>
              <span
                className="text-[10px] font-medium px-2 py-0.5 rounded-full mt-1"
                style={{
                  backgroundColor: "rgba(16,185,129,0.2)",
                  color: "#34D399",
                  opacity: score >= TARGET ? 1 : 0,
                  transition: "opacity 500ms",
                }}
              >
                Excellent
              </span>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes aig-ripple {
          0% { transform: translate(-50%,-50%) scale(0); opacity: 0.5; }
          100% { transform: translate(-50%,-50%) scale(1); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
