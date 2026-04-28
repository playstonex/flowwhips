import type { AgentConfig, ParsedEvent, SdkAgentAdapter } from '@baton/shared';
import { execSync } from 'node:child_process';
import { spawn } from 'node:child_process';

// ── JSON-RPC types for codex app-server ────────────────────────────

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

type JsonRpcMessage = JsonRpcResponse | JsonRpcNotification;

function isResponse(msg: JsonRpcMessage): msg is JsonRpcResponse {
  return 'id' in msg && typeof msg.id === 'number' && ('result' in msg || 'error' in msg);
}

function isRequest(msg: JsonRpcMessage): msg is JsonRpcRequest {
  return 'id' in msg && typeof msg.id === 'number' && 'method' in msg && !('result' in msg) && !('error' in msg);
}

// ── Codex SDK Adapter ──────────────────────────────────────────────

export class CodexSdkAdapter implements SdkAgentAdapter {
  readonly name = 'Codex (SDK)';
  readonly agentType = 'codex-sdk' as const;

  private process: ReturnType<typeof spawn> | null = null;
  private rpcId = 0;
  private threadId: string | null = null;
  private turnId: string | null = null;
  private pendingResolves = new Map<number, { resolve: (value: unknown) => void; reject: (err: Error) => void }>();
  private pendingServerRequests = new Map<number, { method: string; threadId: string }>();
  private buffer = '';
  private onEvent: ((event: ParsedEvent) => void) | null = null;
  private agentTextBuffer = '';
  private pendingApprovalEventId: string | null = null;
  selectedModel: string | null = null;

  isSdkAvailable(): boolean {
    return true;
  }

  detect(): boolean {
    try {
      execSync('which codex', { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  async startSession(
    config: AgentConfig,
    onEvent: (event: ParsedEvent) => void,
  ): Promise<{ write: (input: string) => void; stop: () => Promise<void> }> {
    this.onEvent = onEvent;
    this.rpcId = 0;
    this.threadId = null;
    this.turnId = null;
    this.buffer = '';
    this.agentTextBuffer = '';
    this.pendingResolves.clear();

    const projectPath = config.projectPath ?? process.cwd();
    const env = { ...process.env as Record<string, string>, ...(config.env ?? {}) };

    console.log(`[baton] codex-sdk: spawning codex app-server (cwd=${projectPath})`);

    this.process = spawn('codex', ['app-server'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: projectPath,
      env,
    });

    this.process.stdout!.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString('utf-8');
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop()!; // keep incomplete line

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const msg = JSON.parse(trimmed) as JsonRpcMessage;
          this.handleMessage(msg);
        } catch {
          // not JSON — ignore raw output
        }
      }
    });

    this.process.stderr!.on('data', (chunk: Buffer) => {
      console.error(`[baton] codex-sdk stderr: ${chunk.toString('utf-8').trim()}`);
    });

    this.process.on('exit', (code) => {
      console.log(`[baton] codex-sdk: process exited with code ${code}`);
      if (this.onEvent) {
        this.onEvent({ type: 'status_change', status: 'stopped', timestamp: Date.now() });
      }
    });

    this.process.on('error', (err) => {
      console.error(`[baton] codex-sdk: process error:`, err);
      if (this.onEvent) {
        this.onEvent({ type: 'error', message: err.message, timestamp: Date.now() });
      }
    });

    // Send initialize handshake (required by codex app-server before any other request)
    const initResult = await this.sendRequest('initialize', {
      clientInfo: { name: 'baton', title: 'Baton', version: '0.1.0' },
      capabilities: { experimentalApi: true },
    });
    console.log(`[baton] codex-sdk: initialized, response=`, JSON.stringify(initResult));

    const write = (input: string) => {
      this.handleWrite(input);
    };

    const stop = async () => {
      console.log('[baton] codex-sdk: stop() called');
      if (this.turnId && this.threadId) {
        try {
          await this.sendRequest('turn/interrupt', {
            threadId: this.threadId,
            turnId: this.turnId,
          });
        } catch {
          // ignore — best effort
        }
      }
      this.process?.kill('SIGTERM');
    };

    return { write, stop };
  }

  async approve(reason?: string): Promise<void> {
    // Prefer responding to pending server request (JSON-RPC request/response)
    if (this.pendingServerRequests.size > 0) {
      const [reqId] = this.pendingServerRequests.entries().next().value ?? [];
      if (reqId != null) {
        this.pendingServerRequests.delete(reqId);
        this.sendResponse(reqId, { decision: 'accept', reason: reason ?? 'Approved via Baton' });
        this.pendingApprovalEventId = null;
        return;
      }
    }
    // Fallback: call thread/approveGuardianDeniedAction
    if (!this.threadId || !this.pendingApprovalEventId) return;
    try {
      await this.sendRequest('thread/approveGuardianDeniedAction', {
        threadId: this.threadId,
        event: this.pendingApprovalEventId,
        reason: reason ?? 'Approved via Baton',
        remember: true,
      });
      this.pendingApprovalEventId = null;
    } catch (err) {
      console.error('[baton] codex-sdk: approve error:', err);
    }
  }

  async reject(reason?: string): Promise<void> {
    // Prefer responding to pending server request
    if (this.pendingServerRequests.size > 0) {
      const [reqId] = this.pendingServerRequests.entries().next().value ?? [];
      if (reqId != null) {
        this.pendingServerRequests.delete(reqId);
        this.sendResponse(reqId, { decision: 'reject', reason: reason ?? 'Rejected via Baton' });
        this.pendingApprovalEventId = null;
        return;
      }
    }
    // Fallback: call thread/approveGuardianDeniedAction
    if (!this.threadId || !this.pendingApprovalEventId) return;
    try {
      await this.sendRequest('thread/approveGuardianDeniedAction', {
        threadId: this.threadId,
        event: this.pendingApprovalEventId,
        reason: reason ?? 'Rejected via Baton',
        approve: false,
      });
      this.pendingApprovalEventId = null;
    } catch (err) {
      console.error('[baton] codex-sdk: reject error:', err);
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const result = await this.sendRequest('model/list', {}) as Record<string, unknown>;
      const items = (result?.data ?? result?.models) as Array<Record<string, unknown>> ?? [];
      return items.map((m) => (m.id ?? m.name ?? '') as string).filter(Boolean);
    } catch (err) {
      console.error('[baton] codex-sdk: listModels error:', err);
      return [];
    }
  }

  // ── Write logic: turn/start or turn/steer ────────────────────────

  private handleWrite(input: string): void {
    if (!this.onEvent) return;

    console.log(`[baton] codex-sdk: write() called, input="${input.slice(0, 60)}" threadId=${this.threadId} turnId=${this.turnId}`);

    // Emit user message event so the UI shows what the user sent
    this.onEvent({ type: 'chat_message', role: 'user', content: input, timestamp: Date.now() });

    if (!this.threadId) {
      this.startThreadAndTurn(input);
    } else if (this.turnId) {
      this.steerTurn(input);
    } else {
      this.startTurn(input);
    }
  }

  private async startThreadAndTurn(userInput: string): Promise<void> {
    try {
      const threadResult = await this.sendRequest('thread/start', {
        experimentalRawEvents: false,
        persistExtendedHistory: false,
      }) as Record<string, unknown>;
      // Response: { thread: { id: "...", ... }, model: "...", ... }
      const thread = threadResult?.thread as Record<string, unknown> | undefined;
      this.threadId = (thread?.id ?? threadResult?.threadId) as string | null;
      console.log(`[baton] codex-sdk: thread started, threadId=${this.threadId}`);

      if (!this.threadId) {
        this.onEvent?.({ type: 'error', message: 'Failed to create thread', timestamp: Date.now() });
        return;
      }

      await this.startTurn(userInput);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[baton] codex-sdk: startThreadAndTurn error:`, msg);
      this.onEvent?.({ type: 'error', message: msg, timestamp: Date.now() });
    }
  }

  private async startTurn(userInput: string): Promise<void> {
    if (!this.threadId) return;

    try {
      const turnParams: Record<string, unknown> = {
        threadId: this.threadId,
        input: [{ type: 'text', text: userInput, text_elements: [] }],
      };
      if (this.selectedModel) {
        turnParams.model = this.selectedModel;
      } else {
        // Default fallback — gpt-5.5 (Codex default) isn't available on ChatGPT
        turnParams.model = 'gpt-5.4';
      }

      const result = await this.sendRequest('turn/start', turnParams) as Record<string, unknown>;

      // Response: { turn: { id: "...", status: "..." } }
      const turn = result?.turn as Record<string, unknown> | undefined;
      this.turnId = (turn?.id ?? result?.turnId) as string | null;
      console.log(`[baton] codex-sdk: turn started, turnId=${this.turnId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[baton] codex-sdk: startTurn error:`, msg);
      this.onEvent?.({ type: 'error', message: msg, timestamp: Date.now() });
    }
  }

  private async steerTurn(userInput: string): Promise<void> {
    if (!this.threadId || !this.turnId) return;

    try {
      const result = await this.sendRequest('turn/steer', {
        threadId: this.threadId,
        expectedTurnId: this.turnId,
        input: [{ type: 'text', text: userInput, text_elements: [] }],
      }) as Record<string, unknown>;

      // turn/steer may return a new turnId
      const newTurnId = (result?.turnId ?? result?.turn_id ?? result?.id) as string | null;
      if (newTurnId) this.turnId = newTurnId;
      console.log(`[baton] codex-sdk: steer sent, turnId=${this.turnId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[baton] codex-sdk: steerTurn error:`, msg);
      this.onEvent?.({ type: 'error', message: msg, timestamp: Date.now() });
    }
  }

  // ── JSON-RPC transport ───────────────────────────────────────────

  private sendRequest(method: string, params: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = ++this.rpcId;
      const req: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };
      const payload = JSON.stringify(req) + '\n';

      if (!this.process?.stdin?.writable) {
        reject(new Error('codex process stdin not writable'));
        return;
      }

      this.pendingResolves.set(id, { resolve, reject });
      this.process.stdin.write(payload);

      // Timeout after 60s
      setTimeout(() => {
        if (this.pendingResolves.delete(id)) {
          reject(new Error(`JSON-RPC request timed out: ${method} (id=${id})`));
        }
      }, 60_000);
    });
  }

  private sendResponse(id: number, result: Record<string, unknown>): void {
    const payload = JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n';
    this.process?.stdin?.write(payload);
  }

  // Handle JSON-RPC requests FROM Codex (approval requests, user input requests, etc.)
  private handleServerRequest(req: JsonRpcRequest): void {
    console.log(`[baton] codex-sdk: server request method=${req.method} id=${req.id}`);
    const method = req.method;
    const params = (req.params ?? {}) as Record<string, unknown>;
    const threadId = params.threadId as string ?? '';

    if (method === 'item/fileChange/requestApproval'
        || method === 'item/commandExecution/requestApproval'
        || method === 'item/tool/requestUserInput'
        || method.includes('requestApproval')) {
      // Store the pending request — the user will decide via UI
      this.pendingServerRequests.set(req.id, { method, threadId });
      this.pendingApprovalEventId = params.event as string ?? null;
      this.onEvent?.({ type: 'waiting_approval', timestamp: Date.now() });
      return;
    }

    // Unknown server request — acknowledge with null result to avoid timeout
    this.sendResponse(req.id, {});
  }

  // ── Handle incoming JSON-RPC messages ────────────────────────────

  private handleMessage(msg: JsonRpcMessage): void {
    // Handle responses (to our outgoing requests)
    if (isResponse(msg)) {
      const pending = this.pendingResolves.get(msg.id);
      if (pending) {
        this.pendingResolves.delete(msg.id);
        if (msg.error) {
          pending.reject(new Error(msg.error.message));
        } else {
          pending.resolve(msg.result);
        }
      }
      return;
    }

    // Handle server requests (Codex asking us to do something, like approval)
    if (isRequest(msg)) {
      this.handleServerRequest(msg as JsonRpcRequest);
      return;
    }

    // Handle notifications (server-pushed events)
    const method = (msg as JsonRpcNotification).method ?? '';
    const params = ((msg as JsonRpcNotification).params ?? {}) as Record<string, unknown>;

    if (method !== 'item/agentMessage/delta') {
      console.log(`[baton] codex-sdk: notification method=${method} params=${JSON.stringify(params).slice(0, 200)}`);
    }

    switch (method) {
      case 'thread/status/changed': {
        const params2 = (msg as JsonRpcNotification).params as Record<string, unknown>;
        const status = params2.status as Record<string, unknown> | undefined;
        const activeFlags = status?.activeFlags as string[] | undefined;
        if (activeFlags?.includes('waitingOnApproval')) {
          this.onEvent?.({ type: 'waiting_approval', timestamp: Date.now() });
          break;
        }
        const statusType = (status?.type ?? params2.type) as string | undefined;
        if (statusType === 'active') {
          this.onEvent?.({ type: 'status_change', status: 'running', timestamp: Date.now() });
        }
        break;
      }
      case 'turn/started':
        this.handleTurnStarted(params);
        break;
      case 'turn/completed':
        this.handleTurnCompleted(params);
        break;
      case 'turn/failed':
        this.handleTurnFailed(params);
        break;
      case 'item/agentMessage/delta':
        this.handleAgentMessageDelta(params);
        break;
      case 'item/toolCall/outputDelta':
        this.handleToolCallDelta(params);
        break;
      case 'item/reasoning/summaryTextDelta':
      case 'item/reasoning/textDelta':
        this.handleReasoningDelta(params);
        break;
      case 'item/commandExecution/outputDelta':
      case 'command/exec/outputDelta':
        this.handleCommandDelta(params);
        break;
      case 'item/fileChange/outputDelta':
        this.handleFileChangeDelta(params);
        break;
      case 'item/started': {
        const item = params.item as Record<string, unknown> | undefined;
        if (item?.type === 'fileChange') {
          this.pendingApprovalEventId = item.id as string | null;
          console.log(`[baton] codex-sdk: tracking fileChange for approval, eventId=${this.pendingApprovalEventId}`);
        }
        break;
      }
      case 'error': {
        const message = (params.message ?? 'Unknown error') as string;
        this.onEvent?.({ type: 'error', message, timestamp: Date.now() });
        break;
      }
      default:
        break;
    }
  }

  // ── Notification handlers ────────────────────────────────────────

  private handleTurnStarted(params: Record<string, unknown>): void {
    const turn = params.turn as Record<string, unknown> | undefined;
    const turnId = (turn?.id ?? params.turnId) as string | undefined;
    if (turnId) this.turnId = turnId;
    this.flushAgentText();
    this.onEvent?.({ type: 'status_change', status: 'running', timestamp: Date.now() });
    console.log(`[baton] codex-sdk: turn/started, turnId=${turnId}`);
  }

  private handleTurnCompleted(params: Record<string, unknown>): void {
    this.flushAgentText();
    this.pendingServerRequests.clear();
    this.pendingApprovalEventId = null;
    const turn = params.turn as Record<string, unknown> | undefined;
    const turnId = (turn?.id ?? params.turnId) as string | undefined;
    if (turnId && this.turnId === turnId) this.turnId = null;
    this.onEvent?.({ type: 'status_change', status: 'idle', timestamp: Date.now() });
    console.log(`[baton] codex-sdk: turn/completed`);
  }

  private handleTurnFailed(params: Record<string, unknown>): void {
    this.flushAgentText();
    this.pendingServerRequests.clear();
    this.pendingApprovalEventId = null;
    const turn = params.turn as Record<string, unknown> | undefined;
    const error = turn?.error as Record<string, unknown> | undefined;
    const message = (error?.message ?? params.error ?? params.message ?? 'Turn failed') as string;
    this.onEvent?.({ type: 'error', message, timestamp: Date.now() });
    this.turnId = null;
    console.error(`[baton] codex-sdk: turn/failed: ${message}`);
  }

  private handleAgentMessageDelta(params: Record<string, unknown>): void {
    // Accumulate text deltas and flush on turn boundary
    const delta = (params.delta ?? params.text ?? params.content ?? '') as string;
    if (delta) this.agentTextBuffer += delta;
    // Also emit incremental raw_output for live streaming
    if (delta) {
      this.onEvent?.({ type: 'raw_output', content: delta, timestamp: Date.now() });
    }
  }

  private handleToolCallDelta(params: Record<string, unknown>): void {
    const toolName = (params.name ?? params.tool ?? params.toolName ?? 'unknown') as string;
    const output = (params.delta ?? params.output ?? '') as string;
    if (toolName && toolName !== 'unknown') {
      this.onEvent?.({
        type: 'tool_use',
        tool: toolName,
        args: { output },
        timestamp: Date.now(),
      });
    }
  }

  private handleReasoningDelta(params: Record<string, unknown>): void {
    const delta = (params.delta ?? params.text ?? params.summary ?? '') as string;
    if (delta) {
      this.onEvent?.({ type: 'thinking', content: delta, timestamp: Date.now() });
    }
  }

  private handleCommandDelta(params: Record<string, unknown>): void {
    const output = (params.delta ?? params.output ?? '') as string;
    if (output) {
      this.onEvent?.({ type: 'raw_output', content: output, timestamp: Date.now() });
    }
  }

  private handleFileChangeDelta(params: Record<string, unknown>): void {
    const path = (params.path ?? params.filePath ?? '') as string;
    const raw = (params.changeType ?? params.type ?? 'modify') as string;
    const changeType = raw === 'create' ? 'create' : raw === 'delete' ? 'delete' : 'modify';
    if (path) {
      this.onEvent?.({ type: 'file_change', path, changeType, timestamp: Date.now() });
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────

  /** Flush accumulated assistant text as a chat_message event */
  private flushAgentText(): void {
    if (this.agentTextBuffer.trim() && this.onEvent) {
      this.onEvent({
        type: 'chat_message',
        role: 'assistant',
        content: this.agentTextBuffer.trimEnd(),
        timestamp: Date.now(),
      });
      this.agentTextBuffer = '';
    }
  }

  buildSpawnConfig(): never {
    throw new Error('SDK mode does not use spawn config');
  }

  parseOutput(): ParsedEvent[] {
    return [];
  }
}

export const codexSdkAdapter = new CodexSdkAdapter();
