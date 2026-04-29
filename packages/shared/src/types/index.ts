import type { AgentConfig, SpawnConfig } from './agent.js';

// Agent types
export type AgentType = 'claude-code' | 'claude-code-sdk' | 'codex' | 'codex-sdk' | 'opencode' | 'custom';

export type AgentStatus =
  | 'starting'
  | 'running'
  | 'idle'
  | 'thinking'
  | 'executing'
  | 'waiting_input'
  | 'error'
  | 'stopped';

export interface AgentProcess {
  id: string;
  type: AgentType;
  projectPath: string;
  status: AgentStatus;
  pid?: number;
  startedAt: string;
  stoppedAt?: string;
}

export type { AgentConfig, SpawnConfig } from './agent.js';

// Parsed events — core differentiation: structured understanding of Agent output
export type ParsedEvent =
  | StatusChangeEvent
  | ToolUseEvent
  | FileChangeEvent
  | CommandExecEvent
  | ThinkingEvent
  | ErrorEvent
  | RawOutputEvent
  | ChatMessageEvent
  | WaitingApprovalEvent
  | PlanEvent
  | TokenUsageEvent
  | UserInputPromptEvent
  | DiffEvent
  | SubagentEvent;

export interface StatusChangeEvent {
  type: 'status_change';
  status: AgentStatus;
  timestamp: number;
}

export interface ToolUseEvent {
  type: 'tool_use';
  tool: string;
  args: Record<string, unknown>;
  timestamp: number;
  itemId?: string;
}

export interface FileChangeEvent {
  type: 'file_change';
  path: string;
  changeType: 'create' | 'modify' | 'delete';
  diff?: string;
  timestamp: number;
  itemId?: string;
}

export interface CommandExecEvent {
  type: 'command_exec';
  command: string;
  exitCode?: number;
  output?: string;
  isStreaming?: boolean;
  timestamp: number;
  itemId?: string;
}

export interface ThinkingEvent {
  type: 'thinking';
  content: string;
  timestamp: number;
  itemId?: string;
}

export interface ErrorEvent {
  type: 'error';
  message: string;
  timestamp: number;
}

export interface RawOutputEvent {
  type: 'raw_output';
  content: string;
  timestamp: number;
  itemId?: string;
}

export type ChatRole = 'user' | 'assistant';

export interface ChatMessageEvent {
  type: 'chat_message';
  role: ChatRole;
  content: string;
  timestamp: number;
}

export interface WaitingApprovalEvent {
  type: 'waiting_approval';
  timestamp: number;
}

export interface PlanEvent {
  type: 'plan';
  explanation?: string;
  steps?: Array<{ step: string; status: 'pending' | 'in_progress' | 'completed' }>;
  presentation: 'progress' | 'resultStreaming' | 'resultReady' | 'resultCompleted';
  timestamp: number;
  itemId?: string;
}

export interface TokenUsageEvent {
  type: 'token_usage';
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  timestamp: number;
}

export interface UserInputPromptEvent {
  type: 'user_input_prompt';
  questions: Array<{
    id: string;
    header: string;
    question: string;
    options?: Array<{ label: string; description: string }>;
  }>;
  timestamp: number;
}

export interface DiffEvent {
  type: 'diff';
  diff: string;
  path?: string;
  timestamp: number;
  itemId?: string;
}

export interface SubagentEvent {
  type: 'subagent';
  action: 'started' | 'completed' | 'message';
  name?: string;
  model?: string;
  content?: string;
  status?: string;
  timestamp: number;
  itemId?: string;
}

export type ReasoningEffort = 'low' | 'medium' | 'high';
export type AccessMode = 'on-request' | 'full-access';
export type ServiceTier = 'default' | 'fast';

// Agent Adapter interface
export interface AgentAdapter {
  readonly name: string;
  readonly agentType: AgentType;
  detect(projectPath: string): boolean;
  buildSpawnConfig(config: AgentConfig): SpawnConfig;
  parseOutput(raw: string): ParsedEvent[];
}

export interface SdkAgentAdapter extends AgentAdapter {
  isSdkAvailable(): boolean;
  startSession(
    config: AgentConfig,
    onEvent: (event: ParsedEvent) => void,
  ): Promise<{ write: (input: string) => void; stop: () => Promise<void> }>;
  approve?(reason?: string): Promise<void>;
  reject?(reason?: string): Promise<void>;
}

export type AdapterMode = 'pty' | 'sdk' | 'auto';

// Host types
export type HostStatus = 'online' | 'offline' | 'error';

export interface Host {
  id: string;
  name: string;
  hostname?: string;
  os?: string;
  status: HostStatus;
  lastSeen: string;
  createdAt: string;
}

// Session types
export type SessionStatus = 'active' | 'detached' | 'ended';

export interface Session {
  id: string;
  hostId: string;
  agentType: AgentType;
  projectPath: string;
  status: SessionStatus;
  startedAt: string;
  stoppedAt?: string;
}

export * from './system.js';
export * from './agent.js';
export * from './provider.js';
