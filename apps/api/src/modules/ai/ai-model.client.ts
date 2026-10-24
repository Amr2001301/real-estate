/**
 * The AI assistant's model (Claude, through the Anthropic API). Configured by
 * ANTHROPIC_API_KEY; AI_MODEL and AI_EFFORT override the model and how much
 * it thinks. Without a key it is off and the assistant answers 503.
 */
import Anthropic from '@anthropic-ai/sdk';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnv } from '../../config/env.validation';

export const DEFAULT_AI_MODEL = 'claude-opus-5-5';
const MAX_TOKENS = 4000;
const TIMEOUT_MS = 90_000;

export interface AiTurnRequest {
  system: string;
  tools: Anthropic.Beta.BetaTool[];
  messages: Anthropic.Beta.BetaMessageParam[];
}

@Injectable()
export class AiModelClient {
  private readonly client: Anthropic | null;
  private readonly model: string;
  private readonly effort: NonNullable<AppEnv['AI_EFFORT']>;

  constructor(config: ConfigService<AppEnv>) {
    const key = config.get<string>('ANTHROPIC_API_KEY');
    this.client = key ? new Anthropic({ apiKey: key, timeout: TIMEOUT_MS, maxRetries: 2 }) : null;
    this.model = config.get<string>('AI_MODEL') || DEFAULT_AI_MODEL;
    this.effort = config.get<AppEnv['AI_EFFORT']>('AI_EFFORT') ?? 'medium';
  }

  get enabled(): boolean {
    return !!this.client;
  }

  /** One model turn. Server-side fallbacks keep it answering when the model is overloaded. */
  turn(req: AiTurnRequest): Promise<Anthropic.Beta.BetaMessage> {
    if (!this.client) throw new Error('AI model is not configured');
    return this.client.beta.messages.create({
      model: this.model,
      max_tokens: MAX_TOKENS,
      system: req.system,
      tools: req.tools,
      messages: req.messages,
      thinking: { type: 'adaptive' },
      output_config: { effort: this.effort },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
  }
}
