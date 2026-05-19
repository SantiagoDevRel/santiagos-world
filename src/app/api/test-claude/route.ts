import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export async function GET() {
  const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY / CLAUDE_API_KEY not set in environment variables' },
      { status: 500 }
    );
  }

  try {
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 50,
      messages: [
        { role: 'user', content: 'Say hello in exactly 5 words' }
      ],
    });

    const textBlock = message.content.find((block) => block.type === 'text');
    const responseText = textBlock ? textBlock.text : 'No text response';

    return NextResponse.json({
      success: true,
      model: message.model,
      response: responseText,
      usage: message.usage,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
