import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Message,
  TextChannel,
} from 'discord.js';
import { config } from '../config.js';
import type { DetectionResult } from '../detection/index.js';

export async function sendToModQueue(
  message: Message,
  detection: DetectionResult
): Promise<void> {
  // Try to get from cache first, then fetch if not available
  let modChannel = message.client.channels.cache.get(
    config.modChannelId
  ) as TextChannel | undefined;

  if (!modChannel) {
    try {
      modChannel = (await message.client.channels.fetch(
        config.modChannelId
      )) as TextChannel;
    } catch (error) {
      console.error(
        `Failed to fetch moderation channel ${config.modChannelId}:`,
        error
      );
      return;
    }
  }

  const embed = buildModEmbed(message, detection);
  const buttons = buildActionButtons(
    message.id,
    message.author.id,
    message.channel.id
  );

  await modChannel.send({
    embeds: [embed],
    components: [buttons],
  });
}

function buildModEmbed(
  message: Message,
  detection: DetectionResult
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(getConfidenceColor(detection.confidence))
    .setTitle('Potential Spam Detected')
    .setAuthor({
      name: message.author.tag,
      iconURL: message.author.displayAvatarURL(),
    })
    .addFields(
      {
        name: 'Channel',
        value: `<#${message.channel.id}>`,
        inline: true,
      },
      {
        name: 'Confidence',
        value: `${Math.round(detection.confidence * 100)}%`,
        inline: true,
      },
      {
        name: 'Heuristic Score',
        value: `${detection.heuristics.score}`,
        inline: true,
      }
    )
    .setTimestamp(message.createdAt)
    .setFooter({ text: `Message ID: ${message.id}` });

  // Add message content (truncated if needed)
  const content =
    message.content.length > 1000
      ? message.content.slice(0, 1000) + '...'
      : message.content;
  embed.setDescription(`**Message:**\n${content}`);

  // Add detection reasons
  if (detection.reasons.length > 0) {
    const reasonsText = detection.reasons
      .slice(0, 10)
      .map((r) => `• ${r}`)
      .join('\n');
    embed.addFields({
      name: 'Detection Reasons',
      value: reasonsText.slice(0, 1024),
    });
  }

  // Add AI analysis if available
  if (detection.aiAnalysis) {
    embed.addFields({
      name: 'AI Analysis',
      value: `**${detection.aiAnalysis.classification}** (${Math.round(detection.aiAnalysis.confidence * 100)}%)\n${detection.aiAnalysis.reasoning}`,
    });

    if (!detection.aiAnalysis.channelRelevant) {
      embed.addFields({
        name: 'Channel Relevance',
        value: 'Message appears off-topic for this channel',
      });
    }
  }

  // Add similar messages if found
  if (detection.similarMessages.length > 0) {
    const similarText = detection.similarMessages
      .slice(0, 3)
      .map((m) => {
        const date = new Date(m.createdAt).toLocaleDateString();
        const preview =
          m.content.length > 100
            ? m.content.slice(0, 100) + '...'
            : m.content;
        return `• ${date} in <#${m.channelId}>: "${preview}"`;
      })
      .join('\n');

    embed.addFields({
      name: `Similar Messages (${detection.similarMessages.length} found)`,
      value: similarText.slice(0, 1024),
    });
  }

  // Add user info
  const member = message.member;
  if (member) {
    const joinedAt = member.joinedAt
      ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>`
      : 'Unknown';
    embed.addFields({
      name: 'User Info',
      value: `Joined: ${joinedAt}`,
      inline: true,
    });
  }

  // Add link to original message
  embed.addFields({
    name: 'Jump to Message',
    value: `[Click here](${message.url})`,
    inline: true,
  });

  return embed;
}

function buildActionButtons(
  messageId: string,
  userId: string,
  channelId: string
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`mod_approve_${messageId}_${userId}_${channelId}`)
      .setLabel('Approve')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅'),
    new ButtonBuilder()
      .setCustomId(`mod_spam_${messageId}_${userId}_${channelId}`)
      .setLabel('Spam (Warn)')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('⚠️'),
    new ButtonBuilder()
      .setCustomId(`mod_kick_${messageId}_${userId}_${channelId}`)
      .setLabel('Spam (Kick)')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🚫')
  );
}

function getConfidenceColor(confidence: number): number {
  if (confidence >= 0.8) return 0xff0000; // Red - high confidence spam
  if (confidence >= 0.6) return 0xff8800; // Orange
  if (confidence >= 0.4) return 0xffff00; // Yellow
  return 0x00ff00; // Green - low confidence
}
