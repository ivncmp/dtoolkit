import type { FastifyReply, FastifyRequest } from 'fastify';

export function requireWrite(request: FastifyRequest, reply: FastifyReply): boolean {
  const perms = request.dworkUser?.permissions;
  if (perms === 'read') {
    reply.code(403).send({ error: 'Write access required' });
    return false;
  }
  return true;
}
