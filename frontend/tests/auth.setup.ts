import { test as setup } from "@playwright/test"
import { execSync } from "node:child_process"
import * as fs from "node:fs"
import * as path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const authFile = "playwright/.auth/user.json"

setup("authenticate", async () => {
  const backendDir = path.join(__dirname, "../../backend")
  const outputJson = execSync("uv run python scripts/generate_test_auth.py", {
    cwd: backendDir,
    encoding: "utf-8",
  })

  const authFilePath = path.join(__dirname, "../", authFile)
  fs.mkdirSync(path.dirname(authFilePath), { recursive: true })
  fs.writeFileSync(authFilePath, outputJson.trim(), "utf-8")
})
