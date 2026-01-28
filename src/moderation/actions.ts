import {
  ButtonInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  TextChannel,
} from 'discord.js';
import {
  logModerationAction,
  deleteStoredMessage,
} from '../database/models.js';

export async function handleButtonInteraction(
  interaction: ButtonInteraction
): Promise<void> {
  const customId = interaction.customId;

  if (!customId.startsWith('mod_')) return;

  // Check if user has moderator permissions
  if (
    !interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)
  ) {
    await interaction.reply({
      content: 'You do not have permission to use moderation actions.',
      ephemeral: true,
    });
    return;
  }

  const parts = customId.split('_');
  if (parts.length < 4) return;

  const action = parts[1]; // approve, spam, or kick
  const messageId = parts[2];
  const userId = parts[3];
  const channelId = parts[4]; // Optional channel ID for faster lookup

  await interaction.deferUpdate();

  try {
    switch (action) {
      case 'approve':
        await handleApprove(interaction, messageId, userId);
        break;
      case 'spam':
        await handleSpamWarn(interaction, messageId, userId, channelId);
        break;
      case 'kick':
        await handleSpamKick(interaction, messageId, userId, channelId);
        break;
      default:
        console.error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('Error handling moderation action:', error);
    await interaction.followUp({
      content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      flags: ['Ephemeral'],
    });
  }
}

async function handleApprove(
  interaction: ButtonInteraction,
  messageId: string,
  userId: string
): Promise<void> {
  // Log the moderation decision
  logModerationAction({
    messageId,
    userId,
    action: 'approved',
    moderatorId: interaction.user.id,
  });

  // Update the embed to show it's been approved
  const originalEmbed = interaction.message.embeds[0];
  const updatedEmbed = EmbedBuilder.from(originalEmbed)
    .setColor(0x00ff00)
    .setTitle('✅ Approved')
    .addFields({
      name: 'Action Taken',
      value: `Approved by <@${interaction.user.id}>`,
    });

  await interaction.editReply({
    embeds: [updatedEmbed],
    components: [], // Remove buttons
  });
}

async function handleSpamWarn(
  interaction: ButtonInteraction,
  messageId: string,
  userId: string,
  channelId?: string
): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;

  // Check if bot has necessary permissions
  if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageMessages)) {
    await interaction.followUp({
      content: 'Bot lacks "Manage Messages" permission to delete spam.',
      ephemeral: true,
    });
    return;
  }

  // Find and delete the original message
  const originalMessage = await findOriginalMessage(guild, messageId, channelId);
  const channelName = originalMessage
    ? `#${(originalMessage.channel as TextChannel).name}`
    : 'the server';

  // DM the user
  try {
    const user = await interaction.client.users.fetch(userId);
    await user.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xff8800)
          .setTitle('Message Removed')
          .setDescription(
            `Your message in ${channelName} on **${guild.name}** was removed as it appears to be spam or unwanted self-promotion.\n\nPlease review the server rules before posting again. If you believe this was a mistake, please contact a server moderator.`
          )
          .setTimestamp(),
      ],
    });
  } catch (error) {
    console.log(`Could not DM user ${userId}:`, error);
  }

  // Delete the original message
  if (originalMessage) {
    try {
      await originalMessage.delete();
    } catch (error) {
      console.log(`Could not delete message ${messageId}:`, error);
    }
  }

  // Delete from our database
  deleteStoredMessage(messageId);

  // Log the moderation decision
  logModerationAction({
    messageId,
    userId,
    action: 'spam',
    moderatorId: interaction.user.id,
  });

  // Update the embed
  const originalEmbed = interaction.message.embeds[0];
  const updatedEmbed = EmbedBuilder.from(originalEmbed)
    .setColor(0xff8800)
    .setTitle('⚠️ Marked as Spam')
    .addFields({
      name: 'Action Taken',
      value: `Warned and message deleted by <@${interaction.user.id}>`,
    });

  await interaction.editReply({
    embeds: [updatedEmbed],
    components: [],
  });
}

async function handleSpamKick(
  interaction: ButtonInteraction,
  messageId: string,
  userId: string,
  channelId?: string
): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;

  // Check if bot has necessary permissions
  const botPermissions = guild.members.me?.permissions;
  if (!botPermissions?.has(PermissionFlagsBits.ManageMessages)) {
    await interaction.followUp({
      content: 'Bot lacks "Manage Messages" permission to delete spam.',
      ephemeral: true,
    });
    return;
  }
  if (!botPermissions?.has(PermissionFlagsBits.KickMembers)) {
    await interaction.followUp({
      content: 'Bot lacks "Kick Members" permission to kick users.',
      ephemeral: true,
    });
    return;
  }

  // Find the original message
  const originalMessage = await findOriginalMessage(guild, messageId, channelId);
  const channelName = originalMessage
    ? `#${(originalMessage.channel as TextChannel).name}`
    : 'the server';

  // DM the user before kicking
  try {
    const user = await interaction.client.users.fetch(userId);
    await user.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('Removed from Server')
          .setDescription(
            `You have been removed from **${guild.name}** due to spam or unwanted self-promotion in ${channelName}.\n\nYour message violated our server rules against spam. If you believe this was a mistake, you may contact a server administrator.`
          )
          .setTimestamp(),
      ],
    });
  } catch (error) {
    console.log(`Could not DM user ${userId}:`, error);
  }

  // Delete the original message
  if (originalMessage) {
    try {
      await originalMessage.delete();
    } catch (error) {
      console.log(`Could not delete message ${messageId}:`, error);
    }
  }

  // Kick the user
  try {
    const member = await guild.members.fetch(userId);
    await member.kick('Spam/self-promotion');
  } catch (error) {
    console.log(`Could not kick user ${userId}:`, error);
  }

  // Delete from our database
  deleteStoredMessage(messageId);

  // Log the moderation decision
  logModerationAction({
    messageId,
    userId,
    action: 'spam_kick',
    moderatorId: interaction.user.id,
  });

  // Update the embed
  const originalEmbed = interaction.message.embeds[0];
  const updatedEmbed = EmbedBuilder.from(originalEmbed)
    .setColor(0xff0000)
    .setTitle('🚫 Kicked for Spam')
    .addFields({
      name: 'Action Taken',
      value: `User kicked and message deleted by <@${interaction.user.id}>`,
    });

  await interaction.editReply({
    embeds: [updatedEmbed],
    components: [],
  });
}

async function findOriginalMessage(
  guild: import('discord.js').Guild,
  messageId: string,
  channelId?: string
): Promise<import('discord.js').Message | null> {
  // If channel ID provided, try that first (fast path)
  if (channelId) {
    try {
      const channel = guild.channels.cache.get(channelId) as TextChannel;
      if (channel?.isTextBased()) {
        const message = await channel.messages.fetch(messageId);
        if (message) return message;
      }
    } catch {
      // Fall through to full search
    }
  }

  // Search through text channels to find the message (slow path)
  for (const channel of guild.channels.cache.values()) {
    if (!channel.isTextBased()) continue;

    try {
      const message = await (channel as TextChannel).messages.fetch(messageId);
      if (message) return message;
    } catch {
      // Message not in this channel, continue searching
    }
  }

  return null;
}
