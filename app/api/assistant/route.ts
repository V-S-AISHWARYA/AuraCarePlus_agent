import { generateText } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import { NextResponse } from 'next/server'
import { isUnsafeIntent, unsafeRefusal } from '@/server/tools'

export const runtime = 'nodejs'
export async function POST(request: Request) {
  const { text } = await request.json() as { text?: string }
  if (!text?.trim()) return NextResponse.json({ answer: 'I am listening. Please tell me what you need.' })
  if (isUnsafeIntent(text)) return NextResponse.json({ answer: `${unsafeRefusal} I will not change or recommend medication doses.` })
  const lower = text.toLowerCase()
  const localReplies = [
    { test: /how are you|are you there|hello|hi/, answer: 'I am right here with you, Eleanor. You are not alone. How are you feeling today?' },
    { test: /thank/, answer: 'You are very welcome. I am happy to help you.' },
    { test: /medication|medicine|pill|take now/, answer: 'I can check your medication reminders. Please look at the Today’s care list, and I will remind you when it is time.' },
    { test: /lonely|sad|worried|scared/, answer: 'I am here with you. Take a slow breath with me. I can call Priya if you would like.' },
    { test: /weather|outside/, answer: 'It is a good time to stay comfortable and hydrated. Priya can help you check the weather.' },
  ]
  const localReply = localReplies.find((item) => item.test.test(lower))
  if (localReply) return NextResponse.json({ answer: localReply.answer, source: 'aura' })
  try {
    const result = await generateText({
      model: gateway('google/gemini-2.5-flash'),
      system: 'You are AuraCare, a warm voice companion for Eleanor, a senior. Give short, calm, plain-language replies. You may remind her of scheduled medications, encourage contacting her caregiver, and offer general wellness support. Never diagnose, change doses, or provide emergency medical advice. If she mentions a fall, chest pain, severe breathing trouble, or feeling unsafe, tell her to call emergency services and her caregiver now.',
      prompt: text,
      maxOutputTokens: 120,
    })
    return NextResponse.json({ answer: result.text || 'I heard you, Eleanor. I am here with you.', source: 'aura' })
  } catch {
    return NextResponse.json({ answer: 'I heard you, Eleanor. I am here with you. Priya can help if you need anything important.', source: 'fallback' })
  }
}
