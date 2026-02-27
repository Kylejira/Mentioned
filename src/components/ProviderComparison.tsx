'use client'

interface ProviderComparisonProps {
  data: unknown | null
}

export function ProviderComparison({ data }: ProviderComparisonProps) {
  if (!data) {
    return (
      <div className="bg-background border border-border rounded-2xl p-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-2">Provider Comparison</h3>
        <p className="text-xs text-muted-foreground">No provider comparison data available yet. Run a scan to generate.</p>
      </div>
    )
  }

  return (
    <div className="bg-background border border-border rounded-2xl p-6">
      <h3 className="text-sm font-medium text-muted-foreground mb-3">Provider Comparison</h3>
      <pre className="text-xs text-foreground bg-muted rounded-lg p-4 overflow-x-auto whitespace-pre-wrap max-h-96 overflow-y-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  )
}
