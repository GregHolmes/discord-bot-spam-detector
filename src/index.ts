import {
  Client,
  Events,
  GatewayIntentBits,
  Message,
  PermissionFlagsBits,
} from 'discord.js';
import { config } from './config.js';
import { initDatabase, cleanOldMessages } from './database/index.js';
import { initModels, saveMessage } from './database/models.js';
import { detectSpam } from './detection/index.js';
import { sendToModQueue } from './moderation/queue.js';
import { handleButtonInteraction } from './moderation/actions.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Bot is ready! Logged in as ${readyClient.user.tag}`);
});

client.on(Events.MessageCreate, async (message: Message) => {
  // Skip bot messages
  if (message.author.bot) return;

  // Skip DMs
  if (!message.guild) return;

  // Skip messages from users with mod permissions
  const member = message.member;
  if (member?.permissions.has(PermissionFlagsBits.ModerateMembers)) return;

  try {
    // Save message to database for history tracking
    saveMessage({
      id: message.id,
      userId: message.author.id,
      channelId: message.channel.id,
      guildId: message.guild.id,
      content: message.content,
      createdAt: message.createdTimestamp,
    });

    // Run spam detection
    const result = await detectSpam(message);

    if (result.isSpam) {
      await sendToModQueue(message, result);
    }
  } catch (error) {
    console.error('Error processing message:', error);
    // Don't crash the bot on individual message errors
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  await handleButtonInteraction(interaction);
});

// Initialize database and prepared statements
initDatabase();
initModels();

// Schedule daily cleanup of old messages (runs every 24 hours)
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
setInterval(() => {
  cleanOldMessages(config.historyDays);
}, CLEANUP_INTERVAL);

// Run cleanup once on startup
cleanOldMessages(config.historyDays);

// Graceful shutdown handling
const shutdown = async () => {
  console.log('Shutting down gracefully...');
  try {
    await client.destroy();
    console.log('Discord client closed');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start bot
client.login(config.discord.token);
