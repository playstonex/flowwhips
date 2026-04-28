import type { AgentConfig, ParsedEvent, SdkAgentAdapter } from '@baton/shared';
import { execSync } from 'node:child_process';

type SdkMessage = {
  type: string;
  subtype?: string;
  message?: { content?: Array<{ type: string; [key: string]: unknown }> };
  result?: string;
};

export class ClaudeSdkAdapter implements SdkAgentAdapter {
  readonly name = 'Claude Code (SDK)';
  readonly agentType = 'claude-code-sdk' as const;

  private controller: AbortController | null = null;
  private sdkAvailable: boolean | null = null;

  isSdkAvailable(): boolean {
    if (this.sdkAvailable !== null) return this.sdkAvailable;
    try {
      require.resolve('@anthropic-ai/claude-agent-sdk');
      this.sdkAvailable = true;
    } catch {
      this.sdkAvailable = false;
    }
    return this.sdkAvailable;
  }

  detect(): boolean {
    try {
      execSync('which claude', { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  async startSession(
    _config: AgentConfig,
    onEvent: (event: ParsedEvent) => void,
  ): Promise<{ write: (input: string) => void; stop: () => Promise<void> }> {
    console.log('[baton] SDK: importing @anthropic-ai/claude-agent-sdk...');
    const mod: Record<string, unknown> = await import('@anthropic-ai/claude-agent-sdk');
    const queryMod = mod.query ?? mod.default;
    console.log('[baton] SDK: imported, query fn:', typeof queryMod);
    this.controller = new AbortController();

    const messageQueue: string[] = [];
    let resolvePrompt: ((value: void) => void) | null = null;

    async function* promptGen() {
      while (true) {
        if (messageQueue.length > 0) {
          const msg = messageQueue.shift()!;
          console.log('[baton] SDK: generator yielding:', msg.slice(0, 60));
          yield { role: 'user' as const, content: msg };
        }
        console.log('[baton] SDK: generator waiting for input...');
        await new Promise<void>((resolve) => {
          resolvePrompt = resolve;
        });
        console.log('[baton] SDK: generator resumed');
      }
    }

    const write = (input: string) => {
      console.log('[baton] SDK: write() called, input:', input.slice(0, 60));
      messageQueue.push(input);
      if (resolvePrompt) {
        resolvePrompt();
        resolvePrompt = null;
      }
    };

    const stop = async () => {
      console.log('[baton] SDK: stop() called');
      this.controller?.abort();
    };

    console.log('[baton] SDK: calling query()...');
    const queryFn = queryMod as (args: Record<string, unknown>) => AsyncIterable<unknown>;
    const asyncIterable = queryFn({
      prompt: promptGen(),
      options: {
        model: 'claude-sonnet-7-20251119',
        maxTurns: 50,
        effort: 'medium',
      },
    });
    console.log('[baton] SDK: query() returned:', typeof asyncIterable, asyncIterable ? 'truthy' : 'falsy');

    (async () => {
      try {
        let msgCount = 0;
        for await (const raw of asyncIterable) {
          msgCount++;
          const msg = raw as SdkMessage;
          console.log(`[baton] SDK: stream msg #${msgCount} type="${msg.type}" subtype="${msg.subtype ?? ''}"`);

          if (msg.type === 'system') {
            if (msg.subtype === 'init') {
              console.log('[baton] SDK: session initialized');
              onEvent({ type: 'status_change', status: 'running', timestamp: Date.now() });
            }
          } else if (msg.type === 'assistant') {
            console.log('[baton] SDK: assistant message received');
            this.processAssistantMessage(msg, onEvent);
          } else if (msg.type === 'result') {
            console.log('[baton] SDK: result msg, subtype:', msg.subtype);
            if (msg.subtype === 'success') {
              onEvent({ type: 'status_change', status: 'stopped', timestamp: Date.now() });
            }
          } else {
            console.log('[baton] SDK: unhandled message type:', msg.type);
          }
        }
        console.log(`[baton] SDK: stream ended after ${msgCount} messages`);
      } catch (err) {
        const error = err as Error;
        console.error('[baton] SDK: stream error:', error.name, error.message);
        if (error.name !== 'AbortError') {
          onEvent({ type: 'error', message: error.message, timestamp: Date.now() });
        }
      }
    })();

    return { write, stop };
  }

  private processAssistantMessage(msg: SdkMessage, onEvent: (event: ParsedEvent) => void): void {
    const content = msg.message?.content ?? [];
    for (const block of content) {
      if (block.type === 'tool_use') {
        onEvent({
          type: 'tool_use',
          tool: (block.name as string) ?? 'unknown',
          args: (block.input as Record<string, unknown>) ?? {},
          timestamp: Date.now(),
        });
      } else if (block.type === 'text') {
        const text = (block.text as string) ?? '';
        onEvent({
          type: 'chat_message',
          role: 'assistant',
          content: text,
          timestamp: Date.now(),
        });
        onEvent({
          type: 'raw_output',
          content: text,
          timestamp: Date.now(),
        });
      } else if (block.type === 'thinking') {
        onEvent({
          type: 'thinking',
          content: (block.thinking as string) ?? '',
          timestamp: Date.now(),
        });
      }
    }
  }

  buildSpawnConfig(): never {
    throw new Error('SDK mode does not use spawn config');
  }

  parseOutput(): ParsedEvent[] {
    return [];
  }
}

export const claudeSdkAdapter = new ClaudeSdkAdapter();