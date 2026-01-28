import type { Message } from 'discord.js';
import { config } from '../config.js';
import { getUserRecentMessages, type StoredMessage } from '../database/models.js';
import { analyzeHeuristics, type HeuristicResult } from './heuristics.js';
import { analyzeWithAI, type AIAnalysisResult } from './ai-analysis.js';
import { combinedSimilarity } from '../utils/similarity.js';

export interface DetectionResult {
  isSpam: boolean;
  confidence: number;
  reasons: string[];
  heuristics: HeuristicResult;
  aiAnalysis?: AIAnalysisResult;
  similarMessages: StoredMessage[];
}

export async function detectSpam(message: Message): Promise<DetectionResult> {
  const reasons: string[] = [];

  // Stage 1: Heuristic analysis
  const heuristics = analyzeHeuristics(message);

  // Check for similar past messages
  const similarMessages = findSimilarMessages(message);
  if (similarMessages.length > 0) {
    reasons.push(
      `Found ${similarMessages.length} similar message(s) in the past ${config.historyDays} days`
    );
  }

  // Determine if we need AI analysis
  const needsAI =
    heuristics.score >= config.thresholds.heuristic / 2 &&
    heuristics.score < config.thresholds.heuristic * 2;

  let aiAnalysis: AIAnalysisResult | undefined;

  // If heuristic score is high enough, it's likely spam
  if (heuristics.score >= config.thresholds.heuristic * 2) {
    return {
      isSpam: true,
      confidence: Math.min(heuristics.score / 15, 1),
      reasons: [...heuristics.reasons, ...reasons],
      heuristics,
      similarMessages,
    };
  }

  // Stage 2: AI analysis for borderline cases
  if (needsAI || similarMessages.length > 0) {
    aiAnalysis = await analyzeWithAI(message, heuristics.reasons);

    if (!aiAnalysis.channelRelevant) {
      reasons.push('Message not relevant to channel topic');
    }

    if (
      aiAnalysis.classification === 'spam' ||
      aiAnalysis.classification === 'likely_spam'
    ) {
      reasons.push(`AI: ${aiAnalysis.reasoning}`);
    }
  }

  // Calculate final decision
  const isSpam = calculateFinalDecision(
    heuristics,
    aiAnalysis,
    similarMessages.length
  );

  const confidence = calculateConfidence(
    heuristics,
    aiAnalysis,
    similarMessages.length
  );

  return {
    isSpam,
    confidence,
    reasons: [...heuristics.reasons, ...reasons],
    heuristics,
    aiAnalysis,
    similarMessages,
  };
}

function findSimilarMessages(message: Message): StoredMessage[] {
  if (!message.guild) return [];

  const recentMessages = getUserRecentMessages(
    message.author.id,
    message.guild.id
  );

  // Filter to messages that are similar but not the same message
  return recentMessages.filter((stored) => {
    if (stored.id === message.id) return false;

    const similarity = combinedSimilarity(stored.content, message.content);
    return similarity >= config.thresholds.similarity;
  });
}

function calculateFinalDecision(
  heuristics: HeuristicResult,
  aiAnalysis: AIAnalysisResult | undefined,
  similarCount: number
): boolean {
  // High heuristic score = spam
  if (heuristics.score >= config.thresholds.heuristic) {
    return true;
  }

  // AI says spam with high confidence
  if (
    aiAnalysis &&
    (aiAnalysis.classification === 'spam' ||
      aiAnalysis.classification === 'likely_spam') &&
    aiAnalysis.confidence >= config.thresholds.ai
  ) {
    return true;
  }

  // Multiple similar messages = likely spam
  if (similarCount >= 2) {
    return true;
  }

  // Medium heuristic + similar message + AI suggests spam
  if (
    heuristics.score >= config.thresholds.heuristic / 2 &&
    similarCount >= 1 &&
    aiAnalysis?.classification !== 'legitimate'
  ) {
    return true;
  }

  // Not relevant to channel + promotional content
  if (
    aiAnalysis &&
    !aiAnalysis.channelRelevant &&
    heuristics.score >= config.thresholds.heuristic / 2
  ) {
    return true;
  }

  return false;
}

function calculateConfidence(
  heuristics: HeuristicResult,
  aiAnalysis: AIAnalysisResult | undefined,
  similarCount: number
): number {
  let confidence = 0;

  // Heuristic contribution (up to 0.4)
  confidence += Math.min(heuristics.score / 12, 0.4);

  // AI contribution (up to 0.4)
  if (aiAnalysis) {
    if (
      aiAnalysis.classification === 'spam' ||
      aiAnalysis.classification === 'likely_spam'
    ) {
      confidence += aiAnalysis.confidence * 0.4;
    }
  }

  // Similar messages contribution (up to 0.2)
  confidence += Math.min(similarCount * 0.1, 0.2);

  return Math.min(confidence, 1);
}
