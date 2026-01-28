import Anthropic from '@anthropic-ai/sdk';
import type { Message, TextChannel } from 'discord.js';
import { config } from '../config.js';

const anthropic = new Anthropic({
  apiKey: config.anthropic.apiKey,
});

export interface AIAnalysisResult {
  classification: 'spam' | 'likely_spam' | 'uncertain' | 'legitimate';
  confidence: number;
  reasoning: string;
  channelRelevant: boolean;
}

export async function analyzeWithAI(
  message: Message,
  heuristicReasons: string[]
): Promise<AIAnalysisResult> {
  const channelName = (message.channel as TextChannel).name || 'unknown';
  const channelTopic =
    (message.channel as TextChannel).topic || 'No topic set';

  const prompt = `You are a Discord moderation assistant. Analyze this message for spam/self-promotion.

Channel: #${channelName}
Channel Topic: ${channelTopic}
Author: ${message.author.username}
Message:
"""
${message.content}
"""

Heuristic flags already detected:
${heuristicReasons.map((r) => `- ${r}`).join('\n')}

Analyze this message and determine:
1. Is this spam or unwanted self-promotion?
2. Is this message relevant to the channel's stated purpose?

Common spam patterns in Discord servers:
- Job postings in non-job channels
- Self-promotional introductions listing services/skills for hire
- Copy-paste promotional content posted across multiple channels
- "DM me" or "let's talk" calls to action for services

Respond with JSON only:
{
  "classification": "spam" | "likely_spam" | "uncertain" | "legitimate",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation",
  "channelRelevant": true/false
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const text =
      response.content[0].type === 'text' ? response.content[0].text : '';

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Failed to parse AI response:', text);
      return {
        classification: 'uncertain',
        confidence: 0.5,
        reasoning: 'Failed to parse AI response',
        channelRelevant: true,
      };
    }

    const result = JSON.parse(jsonMatch[0]) as AIAnalysisResult;
    return result;
  } catch (error) {
    console.error('AI analysis error:', error);
    return {
      classification: 'uncertain',
      confidence: 0.5,
      reasoning: 'AI analysis failed',
      channelRelevant: true,
    };
  }
}
