import IORedis from "ioredis"

let connection: IORedis | null = null

export function getRedisConnection(): IORedis {
  if (!connection) {
    const url = process.env.REDIS_URL
    if (!url) {
      throw new Error("REDIS_URL environment variable is not set")
    }
    connection = new IORedis(url, { maxRetriesPerRequest: null })
  }
  return connection
}
