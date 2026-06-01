import { z } from 'zod';

export const SessionStatus = z.enum(['active', 'completed', 'failed', 'abandoned']);

export const CreateSessionSchema = z.object({
  id: z.string().optional(),
  source: z.string(),
  model: z.string().optional(),
  started_at: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const EndSessionSchema = z.object({
  status: SessionStatus.exclude(['active']).default('completed'),
  ended_at: z.string().optional(),
});

export const EventType = z.enum([
  'session_start',
  'session_end',
  'tool_call',
  'token_usage',
  'error',
  'custom',
]);

export const IngestEventSchema = z.object({
  session_id: z.string(),
  type: EventType,
  timestamp: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

export const IngestBatchSchema = z.object({
  events: z.array(IngestEventSchema).min(1).max(1000),
});

export const ToolCallSchema = z.object({
  session_id: z.string(),
  tool_name: z.string(),
  success: z.boolean().default(true),
  duration_ms: z.number().int().optional(),
  timestamp: z.string().optional(),
  args: z.record(z.string(), z.unknown()).optional(),
  error: z.string().optional(),
});

export const TokenUsageSchema = z.object({
  session_id: z.string(),
  model: z.string(),
  input_tokens: z.number().int().default(0),
  output_tokens: z.number().int().default(0),
  cache_read: z.number().int().default(0),
  cache_write: z.number().int().default(0),
  timestamp: z.string().optional(),
});

export const ErrorSchema = z.object({
  session_id: z.string().optional(),
  type: z.string(),
  message: z.string(),
  stack: z.string().optional(),
  timestamp: z.string().optional(),
});
