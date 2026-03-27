import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    anthropicKeyStart: process.env.ANTHROPIC_API_KEY?.substring(0, 10) || 'MISSING',
    hasClaudeKey: !!process.env.CLAUDE_API_KEY,
    claudeKeyStart: process.env.CLAUDE_API_KEY?.substring(0, 10) || 'MISSING',
    hasGoogleKey: !!process.env.GOOGLE_MAPS_API_KEY,
    allEnvKeys: Object.keys(process.env).filter(k => k.includes('ANTHRO') || k.includes('CLAUDE') || k.includes('GOOGLE')).sort(),
  });
}
