import type { Plugin } from "@opencode-ai/plugin"
import { parse } from "editorconfig"
import fs from "fs"
import path from "path"

type LineEnding = "lf" | "crlf"

function toLF(text: string): string {
  return text.replaceAll("\r\n", "\n")
}

function toCRLF(text: string): string {
  return toLF(text).replaceAll("\n", "\r\n")
}

function convert(text: string, ending: LineEnding): string {
  if (ending === "crlf") return toCRLF(text)
  return toLF(text)
}

const BINARY = new Set([
  ".exe", ".dll", ".bin", ".so", ".dylib", ".o", ".a", ".lib",
  ".zip", ".tar", ".gz", ".bz2", ".7z", ".rar", ".xz",
  ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".ico",
  ".tif", ".tiff", ".avif", ".heic", ".svg",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".woff", ".woff2", ".ttf", ".otf", ".eot",
  ".mp3", ".mp4", ".wav", ".avi", ".mov", ".mkv", ".webm",
  ".flac", ".ogg", ".aac",
  ".sqlite", ".db", ".wasm",
])

function binary(file: string): boolean {
  return BINARY.has(path.extname(file).toLowerCase())
}

const SERVICE = "line-endings"

const plugin: Plugin = async (ctx) => {
  const cache = new Map()
  const log = (level: "debug" | "info" | "warn" | "error", message: string, extra?: Record<string, unknown>) =>
    ctx.client.app.log({ body: { service: SERVICE, level, message, extra } })

  async function resolve(file: string): Promise<LineEnding> {
    const env = process.env.OPENCODE_LINE_ENDINGS?.toLowerCase()
    if (env === "lf" || env === "crlf") return env

    try {
      const config = await parse(file, { cache })
      if (config.end_of_line === "lf") return "lf"
      if (config.end_of_line === "crlf") return "crlf"
    } catch {}

    return "crlf"
  }

  function abs(file: string): string {
    return path.isAbsolute(file) ? file : path.resolve(ctx.directory, file)
  }

  const env = process.env.OPENCODE_LINE_ENDINGS?.toLowerCase()
  const source = (env === "lf" || env === "crlf") ? "env" : "editorconfig/default"
  await log("info", `plugin loaded (source: ${source}, env: ${env ?? "unset"}, default: crlf)`)

  return {
    "tool.execute.before": async (input, output) => {
      if (input.tool === "write") {
        if (!output.args.filePath || typeof output.args.content !== "string") return
        const file = abs(output.args.filePath)
        if (binary(file)) return
        const ending = await resolve(file)
        output.args.content = convert(output.args.content, ending)
        await log("debug", `write -> ${ending}`, { file: output.args.filePath })
      }

      if (input.tool === "edit") {
        if (!output.args.filePath || typeof output.args.newString !== "string") return
        const file = abs(output.args.filePath)
        if (binary(file)) return
        const ending = await resolve(file)
        output.args.newString = convert(output.args.newString, ending)
        await log("debug", `edit -> ${ending}`, { file: output.args.filePath })
      }

      if (input.tool === "multiedit") {
        if (!output.args.filePath || !Array.isArray(output.args.edits)) return
        const file = abs(output.args.filePath)
        if (binary(file)) return
        const ending = await resolve(file)
        for (const edit of output.args.edits) {
          if (typeof edit.newString === "string") {
            edit.newString = convert(edit.newString, ending)
          }
        }
        await log("debug", `multiedit -> ${ending}`, { file: output.args.filePath, count: output.args.edits.length })
      }
    },

    event: async ({ event }) => {
      if (event.type !== "file.edited") return
      const file = event.properties.file
      if (!file || binary(file)) return

      try {
        const ending = await resolve(file)
        const content = await fs.promises.readFile(file, "utf-8")
        const converted = convert(content, ending)
        if (content !== converted) {
          await fs.promises.writeFile(file, converted, "utf-8")
          await log("debug", `normalized full file -> ${ending}`, { file })
        }
      } catch {}
    },
  }
}

export default plugin
