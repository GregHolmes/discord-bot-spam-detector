import type { Message } from 'discord.js';

export interface HeuristicResult {
  score: number;
  reasons: string[];
}

// Keywords commonly found in job spam / self-promotion
const SPAM_KEYWORDS = [
  // Job/work related
  'remote work',
  'work from home',
  'daily pay',
  'flexible hours',
  'hiring',
  'freelancer',
  'freelancers needed',
  'job opportunity',
  'work opportunities',
  'overtime',
  'morning shift',
  'typing job',
  'copy and paste',

  // Self-promotion phrases
  "i'm a developer",
  "i'm an engineer",
  'my services',
  'years of experience',
  'i can help you',
  "let's talk",
  "let's connect",
  'dm me',
  'reach out',
  'contact me',
  'book a call',
  'jump on a call',

  // Tech buzzwords in promotional context
  'ai automation',
  'ai agent',
  'custom ai',
  'llm integration',
  'production-ready solutions',
  'ai-powered',

  // Common spam patterns
  'looking for projects',
  'looking for opportunities',
  'available for hire',
  'open for work',
  "if you're looking",
  'i specialize in',
  'my expertise',
  'key projects',
];

// High-weight phrases that are strong indicators
const HIGH_WEIGHT_PHRASES = [
  'daily pay',
  'freelancers needed',
  'dm me for',
  'book a call',
  'available for hire',
  'looking for clients',
];

// Patterns that indicate promotional content
const PROMO_PATTERNS = [
  /\d+\s*\+?\s*years?\s*(of\s*)?(experience|exp)/i,
  /(?:morning|evening|night)\s*shift/i,
  /(?:am|pm)\s*to\s*(?:am|pm)/i,
  /\$\d+(?:\/hr|\/hour|\/day|k)?/i,
  /(?:senior|junior|lead)\s+(?:developer|engineer|designer)/i,
];

// Contact info patterns
const CONTACT_PATTERNS = [
  /[\w.+-]+@[\w-]+\.[\w.-]+/, // Email
  /(?:discord|telegram|whatsapp)\s*[:#]?\s*[\w@#]+/i, // Messaging handles
];

export function analyzeHeuristics(message: Message): HeuristicResult {
  const content = message.content.toLowerCase();
  const reasons: string[] = [];
  let score = 0;

  // Check for spam keywords
  for (const keyword of SPAM_KEYWORDS) {
    if (content.includes(keyword.toLowerCase())) {
      score += 1;
      reasons.push(`Contains keyword: "${keyword}"`);
    }
  }

  // Check high-weight phrases (additional points)
  for (const phrase of HIGH_WEIGHT_PHRASES) {
    if (content.includes(phrase.toLowerCase())) {
      score += 2;
      reasons.push(`Contains high-weight phrase: "${phrase}"`);
    }
  }

  // Check promotional patterns
  for (const pattern of PROMO_PATTERNS) {
    if (pattern.test(content)) {
      score += 2;
      reasons.push(`Matches promotional pattern: ${pattern.source}`);
    }
  }

  // Check for contact info
  for (const pattern of CONTACT_PATTERNS) {
    if (pattern.test(content)) {
      score += 1;
      reasons.push('Contains contact information');
    }
  }

  // Check message length (long promotional messages)
  if (message.content.length > 500) {
    score += 1;
    reasons.push('Long message (>500 chars)');
  }

  if (message.content.length > 1000) {
    score += 1;
    reasons.push('Very long message (>1000 chars)');
  }

  // Check for excessive emojis (common in promotional content)
  const emojiCount = (message.content.match(/\p{Emoji}/gu) || []).length;
  if (emojiCount > 5) {
    score += 1;
    reasons.push(`Excessive emojis (${emojiCount})`);
  }

  // Check for bullet points / list formatting (common in self-promotion)
  const bulletCount = (message.content.match(/^[\s]*[-•*]\s/gm) || []).length;
  if (bulletCount > 3) {
    score += 1;
    reasons.push(`List formatting (${bulletCount} bullets)`);
  }

  // Check for tech stack lists
  const techStackMatch = content.match(
    /(?:react|node|python|javascript|typescript|aws|docker|kubernetes|openai|claude|gpt)/gi
  );
  if (techStackMatch && techStackMatch.length > 4) {
    score += 2;
    reasons.push(`Tech stack listing (${techStackMatch.length} technologies)`);
  }

  return { score, reasons };
}
