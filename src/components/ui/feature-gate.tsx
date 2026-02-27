'use client'

interface FeatureGateProps {
  allowed: boolean
  featureName: string
  requiredPlan: string
  children: React.ReactNode
}

export function FeatureGate({ allowed, featureName, requiredPlan, children }: FeatureGateProps) {
  if (allowed) return <>{children}</>

  return (
    <div className="relative">
      <div className="blur-sm pointer-events-none select-none" aria-hidden="true">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-[1px] rounded-xl">
        <div className="text-center p-6">
          <div className="text-2xl mb-2">🔒</div>
          <p className="font-semibold text-gray-900 text-sm">{featureName}</p>
          <p className="text-xs text-gray-500 mt-1">Available on {requiredPlan} plan</p>
          <a
            href="/pricing"
            className="mt-3 inline-block px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition"
          >
            Upgrade
          </a>
        </div>
      </div>
    </div>
  )
}
