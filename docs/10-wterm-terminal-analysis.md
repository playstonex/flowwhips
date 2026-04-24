# wterm 终端方案评估分析

> 日期：2026-04-20
> 状态：评估完成，决定保持当前方案不变

---

## 一、评估背景

Baton 当前终端实现：

| 平台     | 实现                          | 文件                                              |
| -------- | ----------------------------- | ------------------------------------------------- |
| Web      | xterm.js (Canvas/WebGL)       | `packages/app/src/screens/Terminal.tsx`           |
| iOS      | xterm.js in WebView           | `packages/mobile/src/components/XtermWebView.tsx` |
| Android  | xterm.js in WebView           | `packages/mobile/src/components/XtermWebView.tsx` |
| 数据协议 | 二进制多路复用 ch1 (Terminal) | `packages/shared/src/protocol/channels.ts`        |

评估目标：是否可以用 [wterm](https://github.com/vercel-labs/wterm) (Vercel Labs) 统一三端终端实现。

---

## 二、wterm 技术概览

### 架构

```
┌─────────────────────────────────────────────────────────┐
│                    @wterm/react                         │
│              (React Component + useTerminal)            │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                      @wterm/dom                         │
│         (WTerm class - orchestrates everything)         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │  Renderer   │  │ InputHandler│  │  DebugAdapter   │ │
│  │ (DOM-based) │  │  (keyboard) │  │   (optional)    │ │
│  └─────────────┘  └─────────────┘  └─────────────────┘ │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                     @wterm/core                         │
│  ┌─────────────────┐      ┌─────────────────────────┐  │
│  │   WasmBridge    │      │ WebSocketTransport      │  │
│  │ (Zig → WASM)    │      │ (PTY communication)     │  │
│  └─────────────────┘      └─────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
              │
              ▼
        ┌───────────┐
        │ wterm.wasm│
        │  ~12 KB   │
        └───────────┘
```

### 渲染方式

**DOM-based**（非 Canvas/WebGL），通过 dirty-row tracking + `requestAnimationFrame` 高效更新：

```typescript
// renderer.ts 核心渲染
function appendRun(parent: HTMLElement, text: string, style: string): void {
  const span = document.createElement('span');
  if (style) span.style.cssText = style;
  span.textContent = text;
  parent.appendChild(span);
}
```

### API 表面

```typescript
// React 组件
interface TerminalProps {
  cols?: number;
  rows?: number;
  wasmUrl?: string;
  theme?: string; // 'solarized-dark' | 'monokai' | 'light'
  autoResize?: boolean;
  cursorBlink?: boolean;
  onData?: (data: string) => void; // 用户输入 → PTY
  onTitle?: (title: string) => void;
  onResize?: (cols: number, rows: number) => void;
  onReady?: (wt: WTerm) => void;
}

interface TerminalHandle {
  write(data: string | Uint8Array): void; // PTY → 终端
  resize(cols: number, rows: number): void;
  focus(): void;
}

// 内置 WebSocket Transport
const transport = new WebSocketTransport({
  url: 'wss://pty-server.com/shell',
  reconnect: true,
  maxReconnectDelay: 30000,
  onData: (data) => term.write(data),
});
```

### 关键指标

| 维度       | wterm           | xterm.js            |
| ---------- | --------------- | ------------------- |
| 总 JS 体积 | **~13KB**       | ~400KB+ (含 addons) |
| WASM       | ~12KB (Zig)     | 无                  |
| 渲染       | DOM (dirty-row) | Canvas / WebGL      |
| 文本选择   | 原生 DOM ✅     | 需额外配置          |
| 无障碍     | DOM 天然支持 ✅ | 有限                |
| WebSocket  | 内置 transport  | 需手动实现          |
| 二进制数据 | 支持 ✅         | 支持                |
| 许可证     | Apache 2.0      | MIT                 |

---

## 三、跨平台可行性分析

### 3.1 Web — ✅ 完全可行

wterm 是 web-first 设计，React 组件 API 清晰，可直接替换 `@xterm/xterm`。

### 3.2 React Native — ❌ 不可行

**根本原因**：wterm 依赖 Web DOM API，React Native 环境不存在。

```typescript
// wterm 核心依赖的 Web API：
document.createElement('span'); // ❌ RN 无 DOM
element.style.cssText = style; // ❌ RN 无 CSS
parent.appendChild(span); // ❌ RN 无 DOM tree
WebAssembly.instantiate(); // ⚠️ RN WASM 支持仍为实验性
```

在 React Native 中使用 wterm 的唯一方式是 WebView 嵌入，与当前 xterm.js + WebView 方案本质相同，无架构改进。

### 3.3 移动端原生终端路径（参考）

若未来需要真正原生终端（非 WebView），需要 Native Module：

| 平台    | 方案                                                             | RN 集成                |
| ------- | ---------------------------------------------------------------- | ---------------------- |
| iOS     | [SwiftTerm](https://github.com/migueldeicaza/SwiftTerm)          | Native Module + UIView |
| Android | [termux/terminal-emulator](https://github.com/termux/termux-app) | Native Module + View   |

代价：

- 两端各写原生桥接 (Swift/Kotlin)
- Expo 需要 custom dev client
- 持续维护原生代码

---

## 四、风险评估

| 风险        | 严重度 | 说明                                                   |
| ----------- | ------ | ------------------------------------------------------ |
| 项目成熟度  | 中     | Vercel Labs 实验项目，非核心产品，长期维护不确定       |
| ANSI 兼容性 | 中     | DOM 渲染对复杂 TUI 应用的兼容性不如 xterm.js Canvas    |
| 生态/插件   | 低     | xterm.js 有 webgl/image/search 等丰富 addons，wterm 无 |
| 社区规模    | 中     | wterm 相对小众，遇到问题可参考的资源少                 |
| WASM 加载   | 低     | ~12KB 很小，但需要额外 WASM 加载机制                   |

---

## 五、决策结论

**保持当前方案不变。**

### 理由

1. **移动端无实质改进** — Baton 的移动端是 Expo (React Native)，wterm 无法脱离 WebView 使用，替换后架构完全相同
2. **xterm.js 生态成熟** — 大量 addons、广泛的 ANSI 兼容性、社区资源丰富，对于 Agent 输出流式文本足够
3. **风险收益不对等** — wterm 体量优势在 WebView 场景下意义有限（WebView 本身已几十 MB），换来的是生态缺失和兼容性风险
4. **Baton 场景特性** — Agent 输出以结构化文本流为主（ParsedEvent），不是交互式 TUI，终端渲染不是瓶颈
5. **当前方案可用** — 二进制多路复用 ch1 + xterm.js 数据管道已完善

### 未来触发条件

以下情况发生时，可重新评估迁移到 wterm：

- wterm 发布 React Native 原生组件（目前无计划）
- wterm 社区成熟，addons 生态跟上 xterm.js
- Web 端 bundle size 成为明确性能瓶颈
- 需要终端内原生文本选择/无障碍的强需求

---

## 六、参考链接

- wterm 仓库：https://github.com/vercel-labs/wterm
- wterm 许可证：Apache 2.0
- SwiftTerm (iOS 原生)：https://github.com/migueldeicaza/SwiftTerm
- Termux terminal-emulator (Android)：https://github.com/termux/termux-app
