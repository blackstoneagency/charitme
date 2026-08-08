import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const projectRef = process.env.SUPABASE_PROJECT_REF ?? '';
const supabaseUrl = `https://${projectRef}.supabase.co`;
const root = process.cwd();

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function redactArgs(args) {
  const secretFlags = new Set(['--db-url', '--password']);
  return args.map((arg, index) => {
    if (index > 0 && secretFlags.has(args[index - 1])) return '[REDACTED]';
    if (/^postgres(?:ql)?:\/\//i.test(arg)) return '[REDACTED]';
    return arg;
  });
}

function run(command, args, options = {}) {
  console.log(`> ${command} ${redactArgs(args).join(' ')}`);
  execFileSync(command, args, {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
    ...options,
  });
}

function output(command, args) {
  return execFileSync(command, args, {
    cwd: root,
    env: process.env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}

function localBin(name) {
  return process.platform === 'win32'
    ? join(root, 'node_modules', '.bin', `${name}.cmd`)
    : join(root, 'node_modules', '.bin', name);
}

function readVercelProjectId() {
  const vercelProject = join(root, '.vercel', 'project.json');
  if (!existsSync(vercelProject)) return null;
  return JSON.parse(readFileSync(vercelProject, 'utf8')).projectId ?? null;
}

function configuredDatabaseUrl() {
  return process.env.SUPABASE_DB_URL ?? null;
}

function parseApiKeys(jsonText) {
  const keys = JSON.parse(jsonText);
  const list = Array.isArray(keys) ? keys : keys.api_keys ?? keys.keys ?? [];
  const findKey = (...needles) => {
    const match = list.find((item) => {
      const text = `${item.name ?? ''} ${item.type ?? ''} ${item.key_type ?? ''}`.toLowerCase();
      return needles.some((needle) => text.includes(needle));
    });
    return match?.api_key ?? match?.key ?? match?.value ?? null;
  };

  return {
    anon: findKey('anon', 'publishable'),
    serviceRole: findKey('service_role', 'service role', 'secret'),
  };
}

async function upsertVercelEnv(projectIdOrName, token, env) {
  const teamId = process.env.VERCEL_TEAM_ID;
  const slug = process.env.VERCEL_TEAM_SLUG;
  const params = new URLSearchParams({ upsert: 'true' });
  if (teamId) params.set('teamId', teamId);
  if (slug) params.set('slug', slug);

  const url = `https://api.vercel.com/v10/projects/${encodeURIComponent(projectIdOrName)}/env?${params}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(env),
  });

  if (!response.ok) {
    throw new Error(`Vercel env upsert failed (${response.status}): ${await response.text()}`);
  }
}

async function patchVercelProject(projectIdOrName, token) {
  const teamId = process.env.VERCEL_TEAM_ID;
  const slug = process.env.VERCEL_TEAM_SLUG;
  const params = new URLSearchParams();
  if (teamId) params.set('teamId', teamId);
  if (slug) params.set('slug', slug);

  const url = `https://api.vercel.com/v9/projects/${encodeURIComponent(projectIdOrName)}${params.size ? `?${params}` : ''}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      framework: 'nextjs',
      buildCommand: 'npm run build',
      devCommand: 'npm run dev',
      installCommand: 'npm install',
    }),
  });

  if (!response.ok) {
    throw new Error(`Vercel project settings update failed (${response.status}): ${await response.text()}`);
  }
}

async function main() {
  requireEnv('SUPABASE_PROJECT_REF');
  const deployEnvironment = requireEnv('DEPLOY_ENVIRONMENT');
  const productionProjectRef = requireEnv('SUPABASE_PRODUCTION_PROJECT_REF');

  if (!['staging', 'production'].includes(deployEnvironment)) {
    throw new Error('DEPLOY_ENVIRONMENT must be staging or production.');
  }
  if (deployEnvironment === 'staging' && projectRef === productionProjectRef) {
    throw new Error('Staging provisioning cannot target the production Supabase project.');
  }
  if (deployEnvironment === 'production') {
    if (projectRef !== productionProjectRef) {
      throw new Error('Production provisioning must target SUPABASE_PRODUCTION_PROJECT_REF.');
    }
    if (process.env.ALLOW_PRODUCTION_DATABASE_PUSH !== 'true') {
      throw new Error('ALLOW_PRODUCTION_DATABASE_PUSH=true is required for production.');
    }
    const verifiedCommit = requireEnv('STAGING_VERIFIED_COMMIT');
    const currentCommit = output('git', ['rev-parse', 'HEAD']).trim();
    if (verifiedCommit !== currentCommit) {
      throw new Error('Production requires this exact commit to pass staging verification.');
    }
  }

  requireEnv('SUPABASE_ACCESS_TOKEN');
  if (!process.env.SUPABASE_DB_URL && !process.env.SUPABASE_DB_PASSWORD) {
    throw new Error('SUPABASE_DB_PASSWORD or SUPABASE_DB_URL is required for non-interactive database provisioning.');
  }

  const supabase = localBin('supabase');
  const vercelToken = process.env.VERCEL_TOKEN;
  const vercelProject = process.env.VERCEL_PROJECT_ID
    ?? readVercelProjectId()
    ?? process.env.VERCEL_PROJECT_NAME
    ?? 'charitme';

  const dbUrl = configuredDatabaseUrl();
  if (dbUrl) {
    run(supabase, ['db', 'push', '--db-url', dbUrl, '--include-all', '--yes']);
  } else {
    const linkArgs = ['link', '--project-ref', projectRef, '--yes'];
    if (process.env.SUPABASE_DB_PASSWORD) linkArgs.push('--password', process.env.SUPABASE_DB_PASSWORD);
    run(supabase, linkArgs);

    const pushArgs = ['db', 'push', '--linked', '--include-all', '--yes'];
    if (process.env.SUPABASE_DB_PASSWORD) pushArgs.push('--password', process.env.SUPABASE_DB_PASSWORD);
    run(supabase, pushArgs);
  }

  if (!vercelToken) {
    console.log('Skipped Vercel settings because VERCEL_TOKEN is not set.');
    return;
  }

  const keys = parseApiKeys(output(supabase, ['projects', 'api-keys', '--project-ref', projectRef, '--output', 'json']));
  if (!keys.anon || !keys.serviceRole) {
    throw new Error('Could not read Supabase anon and service_role keys from the Supabase CLI output.');
  }

  const targets = deployEnvironment === 'production'
    ? ['production']
    : ['preview', 'development'];
  const env = [
    { key: 'NEXT_PUBLIC_SUPABASE_URL', value: supabaseUrl, type: 'plain', target: targets },
    { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', value: keys.anon, type: 'encrypted', target: targets },
    { key: 'SUPABASE_SERVICE_ROLE_KEY', value: keys.serviceRole, type: 'encrypted', target: targets },
  ];

  const dbConnection = configuredDatabaseUrl();
  if (dbConnection) {
    env.push({ key: 'DATABASE_URL', value: dbConnection, type: 'encrypted', target: targets });
  }

  const appUrl = process.env.VERCEL_APP_URL ?? process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    env.push(
      { key: 'APP_URL', value: appUrl, type: 'plain', target: targets },
      { key: 'NEXT_PUBLIC_APP_URL', value: appUrl, type: 'plain', target: targets },
    );
  }

  await patchVercelProject(vercelProject, vercelToken);
  await upsertVercelEnv(vercelProject, vercelToken, env);
  console.log(`Provisioned Supabase ${projectRef} and Vercel project ${vercelProject}.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
