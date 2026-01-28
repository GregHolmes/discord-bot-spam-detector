# Discord Spam Moderation Bot

A Discord bot that monitors channels for spam and self-promotion, using a hybrid detection system combining heuristics and AI analysis.

## Features

- **Heuristic Detection** - Pattern matching for common spam indicators (job postings, self-promotion, contact info)
- **AI-Powered Analysis** - Claude API integration for borderline cases and channel relevance checking
- **History Tracking** - SQLite database tracks messages to detect repeat offenders posting similar content
- **Moderation Queue** - Flagged messages sent to a mod channel with detailed context and action buttons
- **One-Click Actions** - Approve, warn (delete + DM), or kick (delete + DM + remove from server)

## Setup

### 1. Create a Discord Bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to the "Bot" section and create a bot
4. Enable these Privileged Gateway Intents:
   - **Message Content Intent**
   - **Server Members Intent**
5. Copy the bot token

### 2. Invite the Bot

Generate an invite URL with these permissions:
- Read Messages/View Channels
- Send Messages
- Manage Messages (to delete spam)
- Kick Members
- Read Message History

Required OAuth2 scopes: `bot`, `applications.commands`

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
MOD_CHANNEL_ID=channel_id_for_mod_queue
ANTHROPIC_API_KEY=your_claude_api_key

# Optional thresholds
HEURISTIC_THRESHOLD=5
AI_THRESHOLD=0.7
SIMILARITY_THRESHOLD=0.7
HISTORY_DAYS=7
```

### 4. Run the Bot

```bash
# Install dependencies
npm install

# Development (with hot reload)
npm run dev

# Production
npm run build
npm start
```

## How It Works

### Detection Pipeline

1. **Message Received** → Skip bots and moderators
2. **Save to Database** → Store for history tracking
3. **Heuristic Analysis** → Check for spam keywords and patterns
4. **History Check** → Find similar messages from same user (past 7 days)
5. **AI Analysis** → For borderline cases, ask Claude to classify
6. **Decision** → If spam detected, send to mod queue

### Spam Indicators

The heuristic system checks for:
- Job-related keywords ("remote work", "daily pay", "freelancers needed")
- Self-promotion phrases ("I can help", "DM me", "years of experience")
- Contact information (emails, messaging handles)
- Tech stack lists (common in promotional intros)
- Formatting patterns (excessive bullets, emojis, long messages)

### Moderation Queue

Flagged messages appear in your mod channel with:
- Original message content
- Author info and join date
- Detection reasons and confidence score
- AI analysis (if performed)
- Similar past messages (if found)
- Link to original message

### Action Buttons

| Button | Action |
|--------|--------|
| ✅ Approve | Mark as legitimate, no action taken |
| ⚠️ Spam (Warn) | Delete message, DM user with warning |
| 🚫 Spam (Kick) | Delete message, DM user, kick from server |

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `HEURISTIC_THRESHOLD` | 5 | Score needed to flag as spam |
| `AI_THRESHOLD` | 0.7 | AI confidence needed to confirm spam |
| `SIMILARITY_THRESHOLD` | 0.7 | Text similarity to consider a repeat |
| `HISTORY_DAYS` | 7 | Days to look back for similar messages |

## Project Structure

```
src/
├── index.ts           # Entry point, event handlers
├── config.ts          # Environment configuration
├── database/
│   ├── index.ts       # SQLite setup
│   └── models.ts      # Message & log queries
├── detection/
│   ├── index.ts       # Detection pipeline
│   ├── heuristics.ts  # Pattern matching
│   └── ai-analysis.ts # Claude integration
├── moderation/
│   ├── queue.ts       # Mod channel embeds
│   └── actions.ts     # Button handlers
└── utils/
    └── similarity.ts  # Text comparison
```

## License

MIT
