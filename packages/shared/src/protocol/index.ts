import type {
  ParsedEvent,
  AgentStatus,
  AgentType,
  SessionStatus,
  HostStatus,
  AdapterMode,
} from '../types/index.js';

// WebSocket message types: Client → Daemon
export type ClientMessage =
  | TerminalInputMessage
  | ChatInputMessage
  | SteerInputMessage
  | CancelTurnMessage
  | ApproveInputMessage
  | RejectInputMessage
  | ModelListRequestMessage
  | ModelSelectMessage
  | ControlMessage;

export interface TerminalInputMessage {
  type: 'terminal_input';
  sessionId: string;
  data: string;
}

/** Conversational message — routed to SDK messageQueue (preferred) or PTY stdin. */
export interface ChatInputMessage {
  type: 'chat_input';
  sessionId: string;
  content: string;
  model?: string;
}

/** Mid-turn steering — injects a follow-up while the agent is still running (SDK only). */
export interface SteerInputMessage {
  type: 'steer_input';
  sessionId: string;
  content: string;
}

/** Cancel the current in-progress turn. */
export interface CancelTurnMessage {
  type: 'cancel_turn';
  sessionId: string;
}

export interface ApproveInputMessage {
  type: 'approve_input';
  sessionId: string;
  reason?: string;
}

export interface RejectInputMessage {
  type: 'reject_input';
  sessionId: string;
  reason?: string;
}

export interface ModelListRequestMessage {
  type: 'model_list_request';
  sessionId: string;
}

export interface ModelSelectMessage {
  type: 'model_select';
  sessionId: string;
  model: string;
}

export type ControlAction =
  | 'start_agent'
  | 'stop_agent'
  | 'list_agents'
  | 'attach_session'
  | 'detach_session'
  | 'resize';

export interface ControlMessage {
  type: 'control';
  action: ControlAction;
  sessionId?: string;
  payload?: Record<string, unknown>;
}

// WebSocket message types: Daemon → Client
export type DaemonMessage =
  | TerminalOutputMessage
  | ParsedEventMessage
  | StatusUpdateMessage
  | AgentListMessage
  | ModelListMessage
  | ErrorMessage;

export interface TerminalOutputMessage {
  type: 'terminal_output';
  sessionId: string;
  data: string;
}

export interface ParsedEventMessage {
  type: 'parsed_event';
  sessionId: string;
  event: ParsedEvent;
}

export interface StatusUpdateMessage {
  type: 'status_update';
  sessionId: string;
  status: AgentStatus | SessionStatus;
}

export interface AgentListMessage {
  type: 'agent_list';
  agents: { id: string; type: string; status: AgentStatus; projectPath: string }[];
}

export interface ModelListMessage {
  type: 'model_list';
  sessionId: string;
  models: string[];
  selected?: string;
}

export interface ErrorMessage {
  type: 'error';
  message: string;
  code?: string;
}

// Relay protocol (Phase 2)
export interface RelayRegisterMessage {
  type: 'register';
  role: 'host' | 'client';
  hostId?: string;
  token: string;
}

export interface RelayBindMessage {
  type: 'bind';
  hostId: string;
}

// REST API types
export interface StartAgentRequest {
  agentType: AgentType;
  projectPath: string;
  args?: string[];
  env?: Record<string, string>;
  mode?: AdapterMode;
}

export interface StartAgentResponse {
  sessionId: string;
  agentType: AgentType;
  status: AgentStatus;
}

export interface HostInfoResponse {
  id: string;
  name: string;
  hostname?: string;
  os?: string;
  status: HostStatus;
  agents: { id: string; type: string; status: AgentStatus; projectPath: string }[];
}

export * from './channels.js';
export * from './handshake.js';
