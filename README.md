# Mentioned — AI Visibility Checker

Check if AI tools like ChatGPT and Claude recommend your product when users search for tools in your category.

## Features

- **AI Visibility Scanning** — Query ChatGPT and Claude with real user prompts
- **Competitor Analysis** — Compare your visibility against competitors
- **Actionable Insights** — Get specific recommendations to improve your AI visibility
- **Draft Generation** — AI-generated content drafts for comparison pages, FAQs, and more

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the project root with the following variables:

```env
# Supabase Configuration (for authentication and data storage)
# Get these from: https://supabase.com/dashboard
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# OpenAI API Key (for ChatGPT queries)
# Get this from: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-your-openai-key

# Anthropic API Key (for Claude queries)
# Get this from: https://console.anthropic.com/
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
```

**Note:** The app can run without API keys for development — it will show mock data. To run real scans, you need at least one AI provider key.

### 3. Set Up Supabase (Optional)

If you want authentication and data persistence:

1. Create a new project at [supabase.com](https://supabase.com)
2. Run the SQL schema from `supabase-schema.sql` in the SQL editor
3. Add your Supabase credentials to `.env.local`

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/scan/           # Scan API endpoint
│   ├── check/              # Onboarding wizard
│   ├── dashboard/          # Main results dashboard
│   ├── login/              # Authentication pages
│   └── ...
├── components/             # React components
│   ├── layout/             # Layout components
│   └── ui/                 # UI primitives
└── lib/
    ├── scan/               # AI scanning logic
    │   ├── analyze-response.ts
    │   ├── detect-signals.ts
    │   ├── generate-actions.ts
    │   ├── generate-queries.ts
    │   ├── query-chatgpt.ts
    │   ├── query-claude.ts
    │   └── run-scan.ts
    ├── auth.tsx            # Authentication context
    ├── mock-data.ts        # Sample data for development
    └── supabase.ts         # Supabase client
```

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Styling:** Tailwind CSS + shadcn/ui
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
- **AI APIs:** OpenAI (GPT-4o-mini), Anthropic (Claude Sonnet)

## API Cost Estimation

Each scan makes approximately:
- 5 queries to ChatGPT (GPT-4o-mini)
- 5 queries to Claude (Claude Sonnet)
- 5-10 analysis calls (GPT-4o-mini)

Estimated cost per scan: ~$0.05-0.10

## License

Private — All rights reserved.
