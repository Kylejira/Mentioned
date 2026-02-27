import { Queue } from "bullmq"
import { getRedisConnection } from "./connection"

export interface ScanJobData {
  scanId: string
  userId: string | null
  brandName: string
  brandUrl: string
  brandId?: string
  category?: string
  coreProblem?: string
  targetBuyer?: string
  differentiators?: string
  competitors?: string[]
  buyerQuestions?: string[]
  planTier: "free" | "pro"
}

export interface ScanJobResult {
  success: boolean
  score?: number
  error?: string
}

let scanQueue: Queue<ScanJobData, ScanJobResult> | null = null

export function getScanQueue(): Queue<ScanJobData, ScanJobResult> {
  if (!scanQueue) {
    scanQueue = new Queue<ScanJobData, ScanJobResult>("scan", {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { age: 86400, count: 200 },
        removeOnFail: { age: 604800, count: 500 },
      },
    })
  }
  return scanQueue
}
