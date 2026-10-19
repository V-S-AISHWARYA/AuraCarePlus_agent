import { generateText } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import { NextResponse } from 'next/server'
import { isUnsafeIntent, unsafeRefusal } from '@/server/tools'

export const runtime = 'nodejs'
export async function POST(request: Request) {
  const { text } = await request.json() as { text?: string }
  if (!text?.trim()) return NextResponse.json({ answer: 'I am listening. Please tell me what you need.' })
  if (isUnsafeIntent(text)) return NextResponse.json({ answer: `${unsafeRefusal} I will not change or recommend medication doses.` })
  try {
    const result = await generateText({
      model: gateway('google/gemini-2.5-flash'),
      system: 'You are AuraCare, a warm voice companion for Eleanor, a senior. Give short, calm, plain-language replies. You may remind her of scheduled medications, encourage contacting her caregiver, and offer general wellness support. Never diagnose, change doses, or provide emergency medical advice. If she mentions a fall, chest pain, severe breathing trouble, or feeling unsafe, tell her to call emergency services and her caregiver now.',
      prompt: text,
      maxOutputTokens: 120,
    })
    return NextResponse.json({ answer: result.text })
  } catch {
    return NextResponse.json({ answer: 'I heard you. I am having trouble reaching my helper right now, but Priya can help you.' })
  }
}
