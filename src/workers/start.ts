import "tsconfig-paths/register"
import { startScanWorker } from "./scan-worker"

console.log("Starting Mentioned scan worker...")
startScanWorker()

process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down worker...")
  process.exit(0)
})

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down worker...")
  process.exit(0)
})
