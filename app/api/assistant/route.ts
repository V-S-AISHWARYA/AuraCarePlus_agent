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
    { test: /how are you|are you there|hello|hi/, answer: 'I am right here with you, Elenor. You are not alone. How are you feeling today?' },
    { test: /what should i take|which medicine|my medicine|my medication|what medication/, answer: 'Please do not take an extra dose or change a dose on my advice. Open the Medication reminders card to see your scheduled medicines, and follow the label or your care team’s instructions. I can call Esther if you are unsure.' },
    { test: /did i take|taken my|have i taken/, answer: 'I can help you check the Medication reminders card. If you are not sure whether you took a dose, do not take another one until Esther or your care team confirms it.' },
    { test: /emergency|fall|fell|chest pain|cannot breathe|can't breathe|unsafe/, answer: 'This may be an emergency. Please call your local emergency number now, and I will help contact Esther. Do not stay alone.' },
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
    const question = text.trim()
    const fallbackReplies = [
      `I heard you, Elenor. You asked about “${question}”. I do not want to guess, so tell me a little more and I will help you step by step.`,
      `Thank you for telling me, Elenor. I am right here with you. Would you like information, a medication reminder, a camera check-in, or for me to contact Esther?`,
      `I am listening carefully. I understood “${question}”. Let us work it out together, and I can bring Esther in if you need another person.`,
    ]
    const fallback = fallbackReplies[Math.floor(Date.now() / 60000) % fallbackReplies.length]
    const result = await Promise.race([
      generateText({
        model: gateway('google/gemini-2.5-flash'),
        system: 'You are AuraCare, a warm, conversational voice companion for Elenor, a senior. Respond specifically to the user, never repeat a generic answer, and ask one gentle follow-up when useful. Give short, calm, plain-language replies. You may explain scheduled medication reminders, encourage contacting caregiver Esther, and offer general wellness support. Never diagnose, change doses, or provide emergency medical advice. If she mentions a fall, chest pain, severe breathing trouble, or feeling unsafe, tell her to call emergency services and Esther now.',
        prompt: question,
        maxOutputTokens: 120,
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 4500)),
    ])
    return NextResponse.json({ answer: result?.text || fallback, source: result?.text ? 'aura' : 'fallback' })
  } catch {
    const question = text.trim()
    const fallbackReplies = [
      `I heard you, Elenor. You asked about “${question}”. I do not want to guess, so tell me a little more and I will help you step by step.`,
      `Thank you for telling me, Elenor. I am right here with you. Would you like information, a medication reminder, a camera check-in, or for me to contact Esther?`,
      `I am listening carefully. I understood “${question}”. Let us work it out together, and I can bring Esther in if you need another person.`,
    ]
    const fallback = fallbackReplies[Math.floor(Date.now() / 60000) % fallbackReplies.length]
    return NextResponse.json({ answer: fallback, source: 'fallback' })
  }
}
