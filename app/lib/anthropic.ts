import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 20000, // 20 second timeout for API calls
  maxRetries: 1, // Reduce retries to avoid long waits
});

export default anthropic;