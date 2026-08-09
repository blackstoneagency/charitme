#!/usr/bin/env node

const repository = required('GITHUB_REPOSITORY');
const releaseSha = required('GITHUB_SHA');
const githubToken = required('GITHUB_TOKEN');
const productionUrl = new URL(required('PRODUCTION_URL'));
const timeoutMs = Number.parseInt(process.env.DEPLOYMENT_TIMEOUT_MS ?? '900000', 10);
const pollMs = Number.parseInt(process.env.DEPLOYMENT_POLL_MS ?? '10000', 10);

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function github(path) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${githubToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`GitHub deployment API returned ${response.status}.`);
  return response.json();
}

async function successfulProductionDeployment() {
  const deployments = await github(
    `/repos/${repository}/deployments?sha=${encodeURIComponent(releaseSha)}&environment=Production&per_page=100`,
  );
  if (!Array.isArray(deployments)) throw new Error('GitHub deployment response was invalid.');

  for (const deployment of deployments) {
    if (!deployment || typeof deployment !== 'object' || deployment.sha !== releaseSha) continue;
    const statuses = await github(`/repos/${repository}/deployments/${deployment.id}/statuses?per_page=100`);
    if (!Array.isArray(statuses)) continue;
    const latest = statuses[0];
    if (latest?.state === 'failure' || latest?.state === 'error') {
      throw new Error('Vercel reported a failed production deployment for this release commit.');
    }
    if (latest?.state === 'success') return latest.environment_url ?? latest.target_url ?? null;
  }
  return null;
}

async function liveDomainServesRelease() {
  const healthUrl = new URL('/api/health', productionUrl);
  const response = await fetch(healthUrl, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' },
    redirect: 'follow',
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) return false;
  return response.headers.get('x-charitme-release') === releaseSha;
}

async function run() {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || !Number.isFinite(pollMs) || pollMs < 1) {
    throw new Error('Deployment polling intervals must be positive integers.');
  }

  const deadline = Date.now() + timeoutMs;
  let deploymentUrl = null;
  while (Date.now() < deadline) {
    deploymentUrl = await successfulProductionDeployment();
    if (deploymentUrl) break;
    await sleep(pollMs);
  }
  if (!deploymentUrl) throw new Error('Timed out waiting for the exact release commit to deploy through Vercel.');

  while (Date.now() < deadline) {
    if (await liveDomainServesRelease()) {
      process.stdout.write(`PASS production release ${releaseSha.slice(0, 8)} is live at ${productionUrl.origin}\n`);
      return;
    }
    await sleep(pollMs);
  }
  throw new Error('The production domain did not advance to the exact release commit before timeout.');
}

run().catch((error) => {
  process.stderr.write(`Production release verification failed: ${error instanceof Error ? error.message : 'unknown error'}\n`);
  process.exit(1);
});
