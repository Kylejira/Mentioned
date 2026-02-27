export interface AIProvider {
  name: string
  generateResponse(prompt: string): Promise<string>
}

export interface ProviderResponse {
  provider: string
  content: string
  raw?: unknown
}
