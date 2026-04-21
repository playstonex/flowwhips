import type { AgentConfig, ParsedEvent } from '@flowwhips/shared';
import type { BaseAgentAdapter } from './adapter.js';
import { query } from '@anthropic-ai/claude-agent-sdk';

export class ClaudeSdkAdapter implements BaseAgentAdapter {
  readonly name = 'Claude Code (SDK)';
  readonly agentType = 'claude-code-sdk' as const;

  private controller: AbortController | null = null;

  detect(): boolean {
    try {
      return true;
    } catch {
      return false;
    }
  }

  async startSession(
    config: AgentConfig,
    onEvent: (event: ParsedEvent) => void,
  ): Promise<{ write: (input: string) => void; stop: () => Promise<void> }> {
    this.controller = new AbortController();

    const messageQueue: string[] = [];
    let resolvePrompt: ((value: string) => void) | null = null;

    async function* promptGen() {
      while (true) {
        if (messageQueue.length > 0) {
          const msg = messageQueue.shift()!;
          yield { role: 'user' as const, content: msg };
        }
        await new Promise<void>((resolve) => {
          resolvePrompt = resolve;
        });
      }
    }

    const write = (input: string) => {
      messageQueue.push(input);
      if (resolvePrompt) {
        resolvePrompt();
        resolvePrompt = null;
      }
    };

    const stop = async () => {
      this.controller?.abort();
    };

    const stream = query({
      prompt: promptGen(),
      options: {
        model: 'claude-sonnet-7-20251119',
        maxTurns: 50,
        effort: 'medium',
      },
    });

    (async () => {
      try {
        for await (const message of stream) {
          const msg = message as {
            type: string;
            subtype?: string;
            message?: { content?: Array<{ type: string; [key: string]: unknown }> };
          };

          if (msg.type === 'system') {
            if (msg.subtype === 'init') {
              onEvent({
                type: 'status_change',
                status: 'running',
                timestamp: Date.now(),
              });
            }
          } else if (msg.type === 'assistant') {
            const content = msg.message?.content ?? [];
            for (const block of content) {
              if (block.type === 'tool_use') {
                onEvent({
                  type: 'tool_use',
                  tool: (block.name as string) ?? 'unknown',
                  input: block.input as Record<string, unknown>,
                  timestamp: Date.now(),
                });
              } else if (block.type === 'text') {
                onEvent({
                  type: 'raw_output',
                  content: (block.text as string) ?? '',
                  timestamp: Date.now(),
                });
              }
            }
          } else if (msg.type === 'result') {
            if (msg.subtype === 'success') {
              onEvent({
                type: 'status_change',
                status: 'stopped',
                timestamp: Date.now(),
              });
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          onEvent({
            type: 'error',
            message: (err as Error).message,
            timestamp: Date.now(),
          });
        }
      }
    })();

    return { write, stop };
  }

  buildSpawnConfig(): never {
    throw new Error('SDK mode does not use spawn config');
  }

  parseOutput(): ParsedEvent[] {
    return [];
  }
}

export const claudeSdkAdapter = new ClaudeSdkAdapter();