# opencode-line-endings

An [OpenCode](https://opencode.ai) plugin that enforces consistent line endings (LF or CRLF) on all file edits, independent of the platform OpenCode runs on.

The primary use case is running OpenCode inside WSL while editing Windows files — the platform reports Linux (LF), but the files need CRLF line endings.

## Installation

OpenCode loads plugin **files** directly from the plugins directory (not subdirectories). The `editorconfig` dependency must be declared in a `package.json` in the config directory.

### Project-level

1. Copy `index.ts` into your project's plugins directory:

```sh
cp index.ts <project>/.opencode/plugins/line-endings.ts
```

2. Add the `editorconfig` dependency to `.opencode/package.json` (create it if it doesn't exist):

```json
{
  "dependencies": {
    "editorconfig": "^3.0.2"
  }
}
```

OpenCode runs `bun install` at startup to install these dependencies automatically.

### Global

1. Copy `index.ts` to the global plugins directory:

```sh
cp index.ts ~/.config/opencode/plugins/line-endings.ts
```

2. Add the dependency to `~/.config/opencode/package.json`:

```json
{
  "dependencies": {
    "editorconfig": "^3.0.2"
  }
}
```

### Via opencode.json (npm)

If published to npm, add to your `opencode.json`:

```json
{
  "plugin": ["opencode-line-endings"]
}
```

## Configuration

Line ending style is determined in this order:

### 1. Environment variable (highest priority)

```sh
export OPENCODE_LINE_ENDINGS=crlf  # or lf
```

### 2. `.editorconfig`

The plugin reads [`.editorconfig`](https://editorconfig.org) files, walking up the directory tree as per the spec. The `end_of_line` property is used:

```ini
# .editorconfig
root = true

[*]
end_of_line = crlf
```

Per-pattern overrides work as expected:

```ini
[*.sh]
end_of_line = lf

[*.{cs,csproj,sln}]
end_of_line = crlf
```

### 3. Default

If neither the environment variable nor `.editorconfig` specifies a line ending style, the plugin defaults to **CRLF**.

## How it works

The plugin hooks into OpenCode's tool execution pipeline at two points:

- **Before tool execution** (`tool.execute.before`): Transforms content in `write`, `edit`, and `multiedit` tool arguments before they reach disk. This ensures diffs shown to the user reflect the correct line endings.

- **After file edits** (`file.edited` event): Re-reads the entire file and normalizes all line endings. This catches cases where partial edits produce mixed line endings (e.g., existing LF content with CRLF insertions from the edit tool).

Binary files are skipped automatically based on file extension.

## License

MIT
