# OpenAI Setup Guide

1. Create an OpenAI API key.
2. Add `OPENAI_API_KEY` to Vercel and local `.env.local`.
3. Set `OPENAI_MODEL`, defaulting to `gpt-4.1-mini`.
4. The campaign copilot endpoint is:
   `POST /api/ai/campaign`

The endpoint validates input with Zod, rate limits requests in-process, and falls back to deterministic generation when no API key is present.
