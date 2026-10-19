'use client'

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { Bell, Camera, HeartPulse, Loader2, Mic, MicOff, Phone, Pill, Play, Send, Sparkles, Volume2 } from 'lucide-react'

type Medication = { id: number; name: string; dose: string; instructions: string; time: string; status: string }
type Conversation = { id: number; speaker: 'you' | 'aura'; text: string }

const fallbackReply = (input: string) => {
  const text = input.toLowerCase()
  if (text.includes('hello') || text.includes('hi') || text.includes('aura')) return 'Hello! I am here with you. How are you feeling today?'
  if (text.includes('medicine') || text.includes('medication') || text.includes('pill')) return 'I can help with your medicines. Please check the reminder card and take only what your care plan says.'
  if (text.includes('call') || text.includes('help')) return 'I can call Priya for you. I will let your caretaker know that you need support.'
  if (text.includes('camera')) return 'I can open the camera for a check-in. Tap the camera button whenever you are ready.'
  return `I heard you say, “${input}”. Thank you for telling me. Would you like me to call Priya or help with a reminder?`
}

export default function Page() {
  const [medications, setMedications] = useState<Medication[]>([])
  const [conversation, setConversation] = useState<Conversation[]>([])
  const [input, setInput] = useState('')
  const [listening, setListening] = useState(false)
  const [wakeWordReady, setWakeWordReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [calling, setCalling] = useState(false)
  const [tab, setTab] = useState<'home' | 'demo'>('home')
  const [alarm, setAlarm] = useState<Medication | null>(null)
  const [form, setForm] = useState({ name: '', dose: '', time: '', instructions: '' })
  const videoRef = useRef<HTMLVideoElement>(null)
  const recognitionRef = useRef<any>(null)
  const listeningRef = useRef(false)

  const speak = useCallback((text: string) => {
    setConversation((items) => [...items, { id: Date.now() + Math.random(), speaker: 'aura', text }].slice(-12))
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text))
    }
  }, [])

  const askAura = useCallback(async (raw: string) => {
    const question = raw.trim()
    if (!question || loading) return
    setInput('')
    setConversation((items) => [...items, { id: Date.now() + Math.random(), speaker: 'you', text: question }].slice(-12))
    setLoading(true)
    try {
      const response = await fetch('/api/assistant', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: question }) })
      const data = await response.json().catch(() => ({}))
      speak(response.ok && data.answer ? data.answer : fallbackReply(question))
    } catch {
      speak(fallbackReply(question))
    } finally {
      setLoading(false)
    }
  }, [loading, speak])

  const startListening = useCallback((wakeMode = false) => {
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!Recognition) { speak('Voice input is not available in this browser. You can type your question below.'); return }
    if (listeningRef.current) { recognitionRef.current?.stop(); listeningRef.current = false; setListening(false); setWakeWordReady(false); return }
    const recognition = new Recognition()
    recognition.lang = 'en-US'
    recognition.continuous = wakeMode
    recognition.interimResults = false
    recognition.onstart = () => { listeningRef.current = true; setListening(true); if (wakeMode) setWakeWordReady(true) }
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results).slice(-1)[0]?.[0]?.transcript?.trim() || ''
      if (!wakeMode) { askAura(transcript); return }
      const lower = transcript.toLowerCase()
      const wakeIndex = lower.lastIndexOf('aura')
      if (wakeIndex < 0) return
      const command = transcript.slice(wakeIndex + 4).trim()
      if (command) askAura(command)
      else speak('Yes, I am listening. What would you like help with?')
    }
    recognition.onerror = (event: any) => {
      listeningRef.current = false
      setListening(false)
      setWakeWordReady(false)
      if (event?.error !== 'aborted') speak('I am ready. Please say Aura, then tell me what you need.')
    }
    recognition.onend = () => {
      listeningRef.current = false
      setListening(false)
      if (wakeMode) window.setTimeout(() => {
        try { recognition.start() } catch { /* browser may already be restarting */ }
      }, 250)
    }
    recognitionRef.current = recognition
    try { recognition.start() } catch { setListening(false); setWakeWordReady(false) }
  }, [askAura, speak])

  useEffect(() => {
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!Recognition) return
    const timer = window.setTimeout(() => startListening(true), 700)
    return () => { window.clearTimeout(timer); recognitionRef.current?.stop() }
  }, [startListening])

  const openCamera = useCallback(async () => {
    setCameraOpen(true)
    try { const stream = await navigator.mediaDevices.getUserMedia({ video: true }); if (videoRef.current) videoRef.current.srcObject = stream } catch { speak('Camera permission is needed for a live check-in.') }
  }, [speak])

  const callPriya = useCallback(() => { setCalling(true); speak('Calling Priya now.'); setTimeout(() => setCalling(false), 3500) }, [speak])

  useEffect(() => {
    fetch('/api/medications').then((r) => r.json()).then((data) => setMedications(data.medications || [])).catch(() => {})
  }, [])

  useEffect(() => {
    const timer = setInterval(() => { const due = medications.find((item) => item.status !== 'taken' && item.time === new Date().toTimeString().slice(0, 5)); if (due) { setAlarm(due); speak(`It is time for ${due.name}. Please check your medication instructions.`) } }, 30000)
    return () => clearInterval(timer)
  }, [medications, speak])

  const addMedication = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.name || !form.dose || !form.time) return
    const response = await fetch('/api/medications', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) })
    const data = await response.json()
    setMedications((items) => [...items, data.medication])
    setForm({ name: '', dose: '', time: '', instructions: '' })
    speak(`I added ${data.medication.name} to your reminders.`)
  }

  const demo = (kind: string) => { if (kind === 'voice') startListening(); if (kind === 'camera') openCamera(); if (kind === 'reminder') { speak('Reminder sound: it is time to take your medicine.'); setAlarm(medications[0] || { id: 0, name: 'your medicine', dose: 'as prescribed', instructions: 'Follow your care plan', time: 'now', status: 'due' }) } }

  return <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 text-slate-900"><header className="border-b bg-white/80 backdrop-blur"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4"><div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-cyan-500 text-white shadow-lg"><HeartPulse /></div><div><div className="text-xl font-extrabold">AuraCare<span className="text-orange-500">+</span></div><div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">A kinder day, together</div></div></div><div className="flex rounded-full border bg-white p-1 shadow-sm"><button onClick={() => setTab('home')} className={`rounded-full px-4 py-2 text-sm font-bold ${tab === 'home' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>My care</button><button onClick={() => setTab('demo')} className={`rounded-full px-4 py-2 text-sm font-bold ${tab === 'demo' ? 'bg-orange-500 text-white' : 'text-slate-500'}`}><Play className="mr-1 inline size-4" />Demo</button></div></div></header>{tab === 'demo' ? <section className="mx-auto max-w-5xl px-5 py-12"><div className="rounded-[2rem] bg-white p-8 shadow-xl"><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700"><Sparkles className="size-4" /> Competition demo</div><h1 className="text-4xl font-extrabold text-indigo-950">See AuraCare in action.</h1><p className="mt-3 text-lg text-slate-500">Try every care moment with one tap.</p><div className="mt-8 grid gap-4 md:grid-cols-3"><button onClick={() => demo('voice')} className="rounded-3xl bg-indigo-600 p-6 text-left text-white shadow-lg"><Mic className="mb-8" /><div className="text-xl font-bold">Voice companion</div><div className="mt-2 text-sm text-indigo-100">Speak and hear Aura reply.</div></button><button onClick={() => demo('camera')} className="rounded-3xl bg-cyan-600 p-6 text-left text-white shadow-lg"><Camera className="mb-8" /><div className="text-xl font-bold">Camera check-in</div><div className="mt-2 text-sm text-cyan-100">Open a live check-in.</div></button><button onClick={() => demo('reminder')} className="rounded-3xl bg-orange-500 p-6 text-left text-white shadow-lg"><Bell className="mb-8" /><div className="text-xl font-bold">Reminder with sound</div><div className="mt-2 text-sm text-orange-100">Hear a medication reminder.</div></button></div></div></section> : <section className="mx-auto grid max-w-6xl gap-6 px-5 py-8 lg:grid-cols-[1.15fr_.85fr]"><div className="rounded-[2rem] bg-white p-7 shadow-xl"><div className="flex items-center justify-between"><div><div className="text-sm font-bold uppercase tracking-[0.18em] text-indigo-500">Your companion</div><h1 className="mt-2 text-3xl font-extrabold text-indigo-950">Good morning, Eleanor</h1></div><button onClick={startListening} aria-label={listening ? 'Stop listening' : 'Start microphone'} className={`flex size-16 items-center justify-center rounded-full text-white shadow-lg transition ${listening ? 'animate-pulse bg-orange-500' : 'bg-indigo-600 hover:bg-indigo-700'}`}>{listening ? <MicOff /> : <Mic />}</button></div><div className="mt-5 rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-cyan-50 p-5" aria-live="polite"><div className="flex items-center gap-2 font-bold text-indigo-950"><Volume2 className="text-cyan-600" /> {loading ? 'Aura is thinking...' : 'Aura is ready to reply'}</div><div className="mt-4 flex max-h-52 flex-col gap-2 overflow-y-auto">{conversation.length === 0 ? <p className="rounded-2xl bg-white/70 p-3 text-sm text-slate-500">Tap the microphone or type a question below.</p> : conversation.slice(-6).map((item) => <div key={item.id} className={`rounded-2xl p-3 text-sm ${item.speaker === 'aura' ? 'bg-indigo-600 text-white' : 'ml-8 bg-white text-slate-700'}`}><b>{item.speaker === 'aura' ? 'Aura: ' : 'You: '}</b>{item.text}</div>)}</div></div><form onSubmit={(event) => { event.preventDefault(); askAura(input) }} className="mt-4 flex gap-2"><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask Aura anything..." className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-500" /><button disabled={loading || !input.trim()} className="rounded-2xl bg-indigo-600 px-4 text-white disabled:opacity-50"><Send /></button></form><div className="mt-5 grid gap-3 sm:grid-cols-3"><button onClick={startListening} className="rounded-2xl bg-indigo-50 p-4 text-left font-bold text-indigo-700"><Mic className="mb-2" />Talk to Aura</button><button onClick={openCamera} className="rounded-2xl bg-cyan-50 p-4 text-left font-bold text-cyan-700"><Camera className="mb-2" />Camera</button><button onClick={callPriya} className="rounded-2xl bg-orange-50 p-4 text-left font-bold text-orange-700"><Phone className="mb-2" />Call Priya</button></div>{cameraOpen && <div className="mt-5 overflow-hidden rounded-3xl bg-slate-950"><video ref={videoRef} autoPlay muted playsInline className="aspect-video w-full object-cover" /></div>}</div><aside className="flex flex-col gap-6"><div className="rounded-[2rem] bg-white p-6 shadow-xl"><div className="flex items-center justify-between"><h2 className="text-xl font-extrabold text-indigo-950">Medication reminders</h2><Pill className="text-orange-500" /></div><div className="mt-4 flex flex-col gap-3">{medications.length === 0 ? <p className="text-sm text-slate-500">No reminders yet. Add one below.</p> : medications.map((medication) => <div key={medication.id} className="rounded-2xl bg-orange-50 p-4"><div className="flex justify-between font-bold"><span>{medication.name}</span><span>{medication.time}</span></div><div className="mt-1 text-sm text-slate-600">{medication.dose} · {medication.instructions}</div></div>)}</div><form onSubmit={addMedication} className="mt-5 grid gap-2"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Medicine name" className="rounded-xl border px-3 py-2" /><input value={form.dose} onChange={(e) => setForm({ ...form, dose: e.target.value })} placeholder="Dose" className="rounded-xl border px-3 py-2" /><input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="rounded-xl border px-3 py-2" /><button className="rounded-xl bg-orange-500 py-2 font-bold text-white">Add reminder</button></form></div><div className="rounded-[2rem] bg-indigo-950 p-6 text-white shadow-xl"><h2 className="text-xl font-extrabold">Caretaker connection</h2><p className="mt-2 text-indigo-200">Priya is notified when Aura detects a concern or you ask for help.</p><button onClick={callPriya} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3 font-bold text-indigo-950"><Phone />{calling ? 'Calling Priya...' : 'Call Priya now'}</button></div></aside></section>}{alarm && <div className="fixed inset-x-4 bottom-4 z-10 mx-auto max-w-md rounded-3xl border-4 border-orange-300 bg-white p-5 shadow-2xl"><div className="flex items-start justify-between"><div><div className="font-bold uppercase tracking-wider text-orange-500">Medication reminder</div><div className="mt-1 text-xl font-extrabold text-indigo-950">Time for {alarm.name}</div><p className="mt-1 text-sm text-slate-600">{alarm.dose} · {alarm.instructions}</p></div><button onClick={() => setAlarm(null)} className="rounded-full bg-orange-100 px-3 py-1 font-bold text-orange-700">Done</button></div></div>}</main>
}
