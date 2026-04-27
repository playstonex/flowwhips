# Baton vs Lunel vs Paseo: 项目对比分析

> Date: 2025-04-25
> Source: extends/lunel/ 和 extends/paseo/ 对比分析

---

## 定位与核心目标

| 维度 | **Baton**（当前项目） | **Lunel** | **Paseo** |
|---|---|---|---|
| **定位** | AI Agent 编排平台 — 生成、观察、控制编码 Agent | 手机端 IDE + 远程开发平台 — 在手机上写代码 | AI Agent 统一管理界面 — 一个入口管理所有 Agent |
| **核心用户场景** | 通过 Web/Mobile/CLI 远程编排多个 AI 编码 Agent | 通过手机远程操作你的电脑进行编码（非 AI 编排） | 通过手机/桌面/Web 管理 Claude Code、Codex、OpenCode |
| **AI Agent 是什么** | ✅ 核心 — 支持 Claude Code、Codex、OpenCode，有 parser 解析 Agent 输出 | ❌ 不是核心 — 是远程 IDE，虽然标注 "AI-powered" 但本质是文件编辑器+终端 | ✅ 核心 — 与 Baton 几乎完全相同的 Agent 支持列表 |
| **许可证** | Apache-2.0 | MIT | AGPL-3.0 |

### 关键结论

- **Lunel 是远程 IDE，不是 Agent 编排器**：核心是在手机上操作电脑进行编码（文件编辑、终端、Git），"AI-powered" 只是辅助特性
- **Baton 和 Paseo 是同类竞品**：核心都是管理多个 AI Agent（Claude Code / Codex / OpenCode）

---

## 架构差异

| 维度 | **Baton** | **Lunel** | **Paseo** |
|---|---|---|---|
| **整体架构** | Daemon(HTTP/WS) + Relay + Gateway + Web App + Mobile + CLI | CLI + Manager + Proxy + Mobile App + Rust PTY | Server(Daemon) + Relay + Desktop(Electron) + Mobile App + CLI + Website |
| **Daemon 端口** | 3210 (HTTP) / 3211 (WS) | — (CLI 直连) | 6767 |
| **Relay 端口** | 3230 | Manager/Proxy (gateway.lunel.dev) | 内置 Relay |
| **Gateway** | 独立服务 (3220)，JWT + 6位配对码 | 集成在 Manager 中 | 无独立 Gateway，Daemon 内置认证 |
| **桌面端** | ❌ 无（Web App 代替） | ❌ 无 | ✅ Electron 桌面应用 |
| **PTY 实现** | Rust PTY 二进制 (`baton-pty`) | Rust PTY 基于 wezterm fork，**带 24fps cell-grid 渲染** | 未明确提及 Rust PTY |
| **Agent 状态机** | ✅ 完整 FSM：`starting → initializing → running → idle/thinking/executing/waiting_input/error → stopped` | ❌ 无 Agent 状态机（不是 Agent 管理器） | ✅ 有 Agent 生命周期管理 |

---

## 技术栈差异

| 维度 | **Baton** | **Lunel** | **Paseo** |
|---|---|---|---|
| **包管理** | pnpm workspaces + Turborepo | npm（非 monorepo，独立 package-lock.json） | npm workspaces |
| **运行时** | Bun（daemon/gateway/relay）+ Node（app/shared） | Node.js（CLI）+ Bun（manager/proxy） | Node.js + tsx |
| **Web 框架** | React 19 + Vite 6 + Tailwind CSS v4 | ❌ 无 Web 端 | React（Expo Web） |
| **Mobile 框架** | Expo 55 + React Native 0.83 + expo-router | Expo React Native | Expo + React Native 0.81 |
| **状态管理** | Zustand 5 | 未明确 | 未明确 |
| **终端渲染** | xterm.js (WebGL) | 自定义终端（wezterm cell-grid 渲染引擎） | 未明确 |
| **格式化** | Prettier | — | Biome |
| **认证** | JWT (jose) + 6位配对码 + NaCl E2E 加密 | Session codes + QR code pairing | QR code + E2E 加密 |
| **数据库** | SQLite (Drizzle ORM) | — | — |
| **SDK 集成** | `@anthropic-ai/claude-agent-sdk`（可选 SDK 模式） | — | `@anthropic-ai/claude-agent-sdk` |

---

## 包结构对比

| **Baton** (pnpm monorepo) | **Lunel** (独立目录) | **Paseo** (npm monorepo) |
|---|---|---|
| `packages/shared` — 类型、协议、加密 | `app/` — Expo 移动端 | `packages/server` — Daemon |
| `packages/daemon` — Agent 管理、PTY、parser | `cli/` — Node.js CLI | `packages/app` — Expo 客户端 |
| `packages/gateway` — JWT 认证 | `manager/` — WS 中���管理 | `packages/cli` — CLI |
| `packages/relay` — E2E 加密中继 | `proxy/` — 代理服务器 | `packages/desktop` — Electron |
| `packages/app` — React Web UI | `pty/` — Rust PTY (wezterm) | `packages/relay` — 远程连接 |
| `packages/cli` — baton 命令行 | — | `packages/website` — 官网 |
| `packages/mobile` — Expo 移动端 | — | `packages/highlight` — 语法高亮 |
| — | — | `packages/expo-two-way-audio` — 语音 |

---

## 关键差异总结

### 1. Lunel 是远程 IDE，不是 Agent 编排器

Lunel 的核心是在手机上操作电脑进行编码（文件编辑、终端、Git），"AI-powered" 只是辅助特性。Baton 和 Paseo 的核心是管理多个 AI Agent。

### 2. Baton vs Paseo：最相似的竞品

两者功能几乎完全重叠：Agent 编排、终端查看、Pipeline、CLI、Relay 远程连接、移动端

| 特性 | **Paseo** 有 | **Baton** 有 |
|---|---|---|
| Electron 桌面端 | ✅ | ❌ |
| 语音控制 | ✅ (OpenAI Realtime API) | ❌ |
| 官网 | ✅ (paseo.sh) | ❌ |
| Orchestration Skills | ✅ (/paseo-handoff, /paseo-loop) | ❌ |
| 独立 Gateway 服务 | ❌ (内置 Daemon) | ✅ (JWT + SQLite + 6位配对码) |
| Pipeline 编排器 | ❌ | ✅ (sequential chains) |
| 文件监控 | ❌ | ✅ (chokidar watcher) |
| MCP server/client | ❌ | ✅ |
| Git worktree 隔离 | ❌ | ✅ |
| 完整 Agent 状态机 | ❌ | ✅ (discriminated union + VALID_TRANSITIONS) |

### 3. Baton 的独特优势

- 更精细的 Agent 状态管理（discriminated union + 状态机验证）
- 完整的 E2E 加密协议（NaCl box，shared key derivation）
- Pipeline 编排（链式 Agent 执行，自动推进）
- 结构化事件解析（parser 将 Agent 终端输出转为 `ParsedEvent[]`）
- 独立 Gateway 服务（JWT + SQLite + 6位配对码）
- 技术栈：Bun 运行时 + pnpm + Prettier

### 4. 技术偏好差异

| **Baton** | **Paseo** |
|---|---|
| Bun 运行时 | Node.js + tsx |
| pnpm | npm |
| Prettier | Biome |

---

## extends/ 目录说明

> ⚠️ 根据 AGENTS.md：`extends/` 包含参考项目（paseo、lunel、open-Codex）仅用于分析目的 — 不参与构建。

```bash
# extends/ 结构
extends/
├── lunel/    # 参考：远程 IDE + 手机端开发
├── paseo/   # 参考：Agent 编排竞品
└── open-Codex/  # 参考：OpenCode Agent
```

这些项目仅用于代码分析，不属于 Baton 构建的一部分。