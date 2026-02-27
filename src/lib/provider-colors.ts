export interface ProviderMeta {
  label: string
  model: string
  color: string
  bgColor: string
  lightBg: string
  hex: string
}

const PROVIDERS: Record<string, ProviderMeta> = {
  openai: {
    label: "ChatGPT",
    model: "GPT-4o",
    color: "text-[#10a37f]",
    bgColor: "bg-[#10a37f]",
    lightBg: "bg-[#10a37f]/10",
    hex: "#10a37f",
  },
  claude: {
    label: "Claude",
    model: "Claude 3 Haiku",
    color: "text-[#cc785c]",
    bgColor: "bg-[#cc785c]",
    lightBg: "bg-[#cc785c]/10",
    hex: "#cc785c",
  },
  gemini: {
    label: "Gemini",
    model: "Gemini 2.5 Flash",
    color: "text-[#4285F4]",
    bgColor: "bg-[#4285F4]",
    lightBg: "bg-[#4285F4]/10",
    hex: "#4285F4",
  },
}

const FALLBACK: ProviderMeta = {
  label: "Unknown",
  model: "Unknown",
  color: "text-foreground",
  bgColor: "bg-muted-foreground",
  lightBg: "bg-muted",
  hex: "#888888",
}

export function getProviderMeta(provider: string): ProviderMeta {
  return PROVIDERS[provider] ?? { ...FALLBACK, label: provider, model: provider }
}

export function getProviderLabel(provider: string): string {
  return PROVIDERS[provider]?.label ?? provider
}
