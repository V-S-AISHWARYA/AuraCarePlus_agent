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
    { test: /how are you|are you there|hello|hi/, answer: 'I am right here with you, Esther. You are not alone. How are you feeling today?' },
    { test: /thank/, answer: 'You are very welcome. I am happy to help you.' },
    { test: /medication|medicine|pill|take now|reminder/, answer: 'I can check your medication reminders. Please look at the medication card, and I will remind you when it is time.' },
    { test: /camera|video|see me/, answer: 'I can turn the camera on for a check-in. Say “Aura, turn the camera on” or use the camera button.' },
    { test: /call|caretaker|caregiver|esther/, answer: 'I can contact Esther for you. Say “Aura, call Esther” and I will start the caregiver call.' },
    { test: /what time|time is it|clock/, answer: `It is ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}. Would you like a medication reminder?` },
    { test: /lonely|sad|worried|scared/, answer: 'I am here with you. Take a slow breath with me. I can call Esther if you would like.' },
    { test: /weather|outside/, answer: 'Please stay comfortable and hydrated. Esther can help check the local weather with you.' },
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
    const fallback = `I heard your question about “${text.trim()}”. I am still here with you, Esther. I can help with medication reminders, camera check-ins, or calling Esther. Could you say that another way?`
    return NextResponse.json({ answer: fallback, source: 'fallback' })
  }
}
