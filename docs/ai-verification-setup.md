# AI Verification — Secrets & Environments

This document explains how to configure OpenAI-based roundel detection and station name extraction for the app.

## Environment Variables

Set these environment variables in your Supabase project's Edge Function Secrets:

### Required for Production
- `OPENAI_API_KEY` - Your OpenAI API key with vision model access
- `AI_VERIFICATION_ENABLED` - Set to `"true"` to enable AI verification

### Optional Configuration
- `OPENAI_MODEL` - OpenAI model to use (default: `gpt-4o`)
- `OPENAI_API_BASE` - Custom API base URL (default: `https://api.openai.com/v1`)
- `AI_SIMULATION_MODE` - Set to `"true"` for development simulation

## Feature Flags

### AI_VERIFICATION_ENABLED
- `"true"` - AI verification is active
- `"false"` or unset - All photos saved as pending, no AI calls made

### AI_SIMULATION_MODE (Development Only)
- `"true"` - Returns mock verification results, no OpenAI API calls
- `"false"` or unset - Uses real OpenAI API

## Graceful Fallbacks

The app handles these scenarios gracefully:

1. **Missing API Key**: Photos saved as pending with setup notice
2. **API Unavailable**: Network errors result in pending status with retry guidance
3. **Rate Limits**: API errors result in pending status
4. **Verification Disabled**: All photos saved as pending

## Security Notes

- API keys are server-side only (never exposed to client)
- Error details are not logged to prevent key exposure
- Photos stored with appropriate access controls
- No direct browser-to-OpenAI requests

## Environment Setup

### Development
```bash
AI_VERIFICATION_ENABLED=true
AI_SIMULATION_MODE=true
```

### Staging
```bash
OPENAI_API_KEY=sk-your-staging-key
AI_VERIFICATION_ENABLED=true
AI_SIMULATION_MODE=false
```

### Production
```bash
OPENAI_API_KEY=sk-your-production-key
OPENAI_MODEL=gpt-4o
AI_VERIFICATION_ENABLED=true
```

## Validation Checklist

- [ ] No API key present in client bundle
- [ ] No direct browser requests to OpenAI
- [ ] Missing key scenario works (pending status)
- [ ] Simulation mode works (mock results)
- [ ] Network errors handled gracefully
- [ ] Production environment configured

## Billing & Quotas

- Monitor OpenAI usage at https://platform.openai.com/usage
- Set appropriate rate limits and budgets
- Consider implementing usage tracking for cost control