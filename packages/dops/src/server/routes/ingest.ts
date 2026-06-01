import type { FastifyInstance } from 'fastify';

import {
  CreateSessionSchema,
  EndSessionSchema,
  ErrorSchema,
  IngestBatchSchema,
  IngestEventSchema,
  TokenUsageSchema,
  ToolCallSchema,
} from '../../core/models.js';
import * as ingest from '../../service/ingest.js';

export async function ingestRoutes(app: FastifyInstance) {
  app.post('/sessions', async (request, reply) => {
    const input = CreateSessionSchema.parse(request.body);
    const id = ingest.createSession(app.db, input);
    return reply.code(201).send({ id });
  });

  app.patch('/sessions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const input = EndSessionSchema.parse(request.body);
    ingest.endSession(app.db, id, input);
    return reply.code(200).send({ updated: true, id });
  });

  app.post('/events', async (request, reply) => {
    const input = IngestEventSchema.parse(request.body);
    const id = ingest.insertEvent(app.db, input);
    return reply.code(201).send({ id });
  });

  app.post('/events/batch', async (request, reply) => {
    const { events } = IngestBatchSchema.parse(request.body);
    const count = ingest.insertEventBatch(app.db, events);
    return reply.code(201).send({ ingested: count });
  });

  app.post('/tool-calls', async (request, reply) => {
    const input = ToolCallSchema.parse(request.body);
    const id = ingest.insertToolCall(app.db, input);
    return reply.code(201).send({ id });
  });

  app.post('/token-usage', async (request, reply) => {
    const input = TokenUsageSchema.parse(request.body);
    const id = ingest.insertTokenUsage(app.db, input);
    return reply.code(201).send({ id });
  });

  app.post('/errors', async (request, reply) => {
    const input = ErrorSchema.parse(request.body);
    const id = ingest.insertError(app.db, input);
    return reply.code(201).send({ id });
  });
}
