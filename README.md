# Baton

Open-source remote AI Agent orchestration platform — spawn, observe, and control coding agents (Claude Code, Codex, OpenCode) from your browser or phone.

## Features

- **Multi-Agent Support** — Run Claude Code, Codex, and OpenCode agents simultaneously
- **Live Terminal** — Real-time xterm.js terminal with WebGL rendering
- **Event Parsing** — Structured events: tool use, file changes, thinking state, errors
- **Pipeline Orchestration** — Chain agents sequentially, auto-advance on completion
- **File Browser** — Browse project files and preview code in the browser
- **Remote Access** — Connect from anywhere via Relay + 6-digit pairing
- **Mobile App** — Full-featured Expo React Native app for iOS and Android
- **Dark Mode** — Web and mobile apps with dark theme support

## Architecture

```
┌──────────────┐     WebSocket      ┌──────────┐
│  Web / Phone │◄──────────────────►│  Relay   │
│  (React App) │                    │ (3230)   │
└──────────────┘                    └────┬─────┘
                                         │
                                    ┌────▼─────┐
                                    │ Gateway  │
                                    │ (3220)   │
                                    │ JWT auth │
                                    └────┬─────┘
                                         │
                                    ┌────▼─────┐
                                    │  Daemon  │
                                    │ (3210)   │
                                    │ agents   │
                                    │ parser   │
                                    └──────────┘
```

**Daemon** runs on your host machine, spawning agent CLIs via a Rust PTY bridge. It parses their terminal output into structured events and streams everything over WebSocket.

**Relay** is an optional WebSocket relay for remote access — connect your phone/browser to the daemon over the internet with E2E encryption.

**Gateway** handles JWT authentication and 6-digit device pairing codes, backed by SQLite.

**Web App** provides a dashboard with sidebar navigation, live terminal, file browser, pipeline builder, and settings — built with React 19, Tailwind CSS, and dark mode.

**Mobile App** is a dark-themed Expo React Native app with agent management, terminal view, file browser, and pipeline orchestration.

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 22+
- [pnpm](https://pnpm.io/) 10+
- [Bun](https://bun.sh/) (for daemon/gateway/relay runtime)
- [Rust toolchain](https://rustup.rs/) (for PTY binary)

### Install & Build

```bash
git clone https://github.com/playstonex/baton.git
cd baton
pnpm install
pnpm build
```

### Build the Rust PTY Binary

```bash
pnpm --filter @baton/daemon build:pty
```

### Start Development

```bash
# Terminal 1 — Daemon (HTTP 3210, WS 3211)
pnpm --filter @baton/daemon dev

# Terminal 2 — Web App (http://localhost:5173)
pnpm --filter @baton/app dev
```

Open **http://localhost:5173** — the web app auto-connects to the local daemon.

### Start Mobile App

```bash
cd packages/mobile
npx expo start
```

Scan the QR code with Expo Go on your iOS or Android device.

## Usage

### Web Dashboard

1. **Start an Agent** — Choose agent type (Claude Code / Codex / OpenCode), enter a project path, click Start
2. **Live Terminal** — Watch and interact with the agent in real-time via xterm.js
3. **File Browser** — Browse the project's file tree and preview code
4. **Pipelines** — Create multi-step pipelines that chain agents sequentially
5. **Settings** — Switch between Local (same network) and Remote (via Relay) connections
6. **Dark Mode** — Toggle with the moon/sun icon in the sidebar

### Remote Connection

To control your agents from a different network:

```bash
# Terminal 3 — Relay (3230)
pnpm --filter @baton/relay dev

# Terminal 4 — Gateway (3220)
pnpm --filter @baton/gateway dev
```

Then in the web or mobile app Settings, switch to **Remote**, enter the Relay URL, and use the 6-digit pairing code displayed in the gateway terminal.

### CLI

```bash
# Start an agent
baton start /path/to/project
baton start /path/to/project --agent codex

# List running agents
baton ls

# Attach to an agent's terminal
baton attach <session-id>

# Send input to an agent
baton send <session-id> "fix the bug"

# Stop an agent
baton stop <session-id>
```

### Pipeline API

```bash
curl -X POST http://localhost:3210/api/pipelines \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "review-and-fix",
    "steps": [
      {"id": "s1", "agentType": "claude-code", "projectPath": "/my-project"},
      {"id": "s2", "agentType": "codex", "projectPath": "/my-project"}
    ]
  }'
```

## Packages

| Package | Role | Runtime |
|---|---|---|
| `@baton/shared` | Types, WS protocol, crypto, utils | Any |
| `@baton/daemon` | Agent adapters, parser, transport, file watcher | Bun |
| `@baton/gateway` | JWT auth, 6-digit pairing, SQLite | Bun |
| `@baton/relay` | WebSocket relay, E2E NaCl encryption | Bun |
| `@baton/app` | React 19 web UI — dashboard, terminal, files, pipelines | Vite |
| `@baton/cli` | `baton` binary — `start/ls/attach/send/stop` | Bun |
| `@baton/mobile` | Expo React Native app | Expo |

## Ports

| Service | Port |
|---|---|
| Daemon HTTP | 3210 |
| Daemon WebSocket | 3211 |
| Gateway | 3220 |
| Relay | 3230 |
| Vite Dev Server | 5173 |

Free ports: `lsof -ti:3210,3211,3220,3230,5173 | xargs kill`

## Tech Stack

- **Runtime**: Node.js 22, Bun, TypeScript, ESM
- **Monorepo**: pnpm workspaces + Turborepo
- **Daemon**: Hono, Rust PTY bridge, chokidar
- **Web App**: React 19, Vite 6, Tailwind CSS v4, xterm.js (WebGL), Zustand 5
- **Mobile App**: Expo 55, React Native 0.83, expo-router
- **Auth**: JWT (jose), 6-digit pairing codes
- **Database**: SQLite (Drizzle ORM)
- **Crypto**: NaCl (xsalsa20-poly1305), AES-256-GCM

## Development

```bash
pnpm install          # Install all workspaces
pnpm build            # Build all packages (Turborepo)
pnpm typecheck        # TypeScript check across all packages
pnpm test             # Vitest (shared package tests)
pnpm lint             # ESLint
pnpm format           # Prettier
```

### Run Tests

```bash
pnpm test

# Single test file
pnpm vitest run packages/shared/src/__tests__/agent-state.test.ts
```

### Release

Push a `v*` tag to trigger the GitHub Actions release workflow, which produces standalone binaries for macOS-arm64 and linux-x64.

## License

Apache-2.0
