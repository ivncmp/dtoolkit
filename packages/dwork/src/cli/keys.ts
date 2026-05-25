import * as p from '@clack/prompts';
import pc from 'picocolors';

interface KeysOptions {
  url?: string;
  token?: string;
  userId?: string;
  userName?: string;
  permissions?: string;
  keyId?: string;
}

async function apiCall(
  url: string,
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${url}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

export async function keys(action: string, opts: KeysOptions) {
  const url = opts.url || process.env.DWORK_URL;
  const token = opts.token || process.env.DWORK_TOKEN;

  if (!url || !token) {
    p.log.error(`${pc.red('Missing --url and --token (or DWORK_URL / DWORK_TOKEN env vars)')}`);
    process.exit(1);
  }

  if (action === 'create') {
    const userId = opts.userId;
    const userName = opts.userName;
    if (!userId || !userName) {
      p.log.error(`${pc.red('--user-id and --user-name are required for create')}`);
      process.exit(1);
    }

    const { ok, data } = await apiCall(url, token, 'POST', '/keys', {
      userId,
      userName,
      permissions: opts.permissions || 'read+write',
    });

    if (!ok) {
      p.log.error(`${pc.red('Failed to create key:')} ${JSON.stringify(data)}`);
      process.exit(1);
    }

    const key = data as { id: string; token: string; userId: string; permissions: string };
    p.log.success(`${pc.green('Key created')}`);
    p.note(
      [
        `ID:          ${pc.dim(key.id)}`,
        `User:        ${pc.green(userName)} (${userId})`,
        `Permissions: ${pc.green(key.permissions)}`,
        `Token:       ${pc.green(key.token)}`,
        ``,
        `${pc.dim('Save this token — it will not be shown again.')}`,
      ].join('\n'),
      'API Key',
    );
  } else if (action === 'list') {
    const { ok, data } = await apiCall(url, token, 'GET', '/keys');

    if (!ok) {
      p.log.error(`${pc.red('Failed to list keys:')} ${JSON.stringify(data)}`);
      process.exit(1);
    }

    const keyList = data as Array<{
      id: string;
      tokenPreview: string;
      userId: string;
      userName: string;
      permissions: string;
      status: string;
      lastUsed: string | null;
    }>;

    if (keyList.length === 0) {
      p.log.info('No API keys found.');
      return;
    }

    p.log.info(`${pc.bold(`${keyList.length} key(s)`)}\n`);
    for (const k of keyList) {
      const status = k.status === 'active' ? pc.green('active') : pc.red('revoked');
      const lastUsed = k.lastUsed ? pc.dim(k.lastUsed) : pc.dim('never');
      console.log(
        `  ${pc.dim(k.id)}  ${k.userName} (${k.userId})  ${k.permissions}  ${status}  last: ${lastUsed}  ${pc.dim(k.tokenPreview)}`,
      );
    }
  } else if (action === 'revoke') {
    const keyId = opts.keyId;
    if (!keyId) {
      p.log.error(`${pc.red('--key-id is required for revoke')}`);
      process.exit(1);
    }

    const { ok, data } = await apiCall(url, token, 'DELETE', `/keys/${keyId}`);

    if (!ok) {
      p.log.error(`${pc.red('Failed to revoke key:')} ${JSON.stringify(data)}`);
      process.exit(1);
    }

    p.log.success(`${pc.green('Key revoked:')} ${keyId}`);
  } else {
    p.log.error(`${pc.red(`Unknown action: ${action}. Use create, list, or revoke.`)}`);
    process.exit(1);
  }
}
