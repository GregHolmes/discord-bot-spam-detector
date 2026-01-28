import 'dotenv/config';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] ?? defaultValue;
}

export const config = {
  discord: {
    token: requireEnv('DISCORD_TOKEN'),
    clientId: requireEnv('DISCORD_CLIENT_ID'),
  },
  modChannelId: requireEnv('MOD_CHANNEL_ID'),
  anthropic: {
    apiKey: requireEnv('ANTHROPIC_API_KEY'),
  },
  thresholds: {
    heuristic: parseInt(optionalEnv('HEURISTIC_THRESHOLD', '5'), 10),
    ai: parseFloat(optionalEnv('AI_THRESHOLD', '0.7')),
    similarity: parseFloat(optionalEnv('SIMILARITY_THRESHOLD', '0.7')),
  },
  historyDays: parseInt(optionalEnv('HISTORY_DAYS', '7'), 10),
};
