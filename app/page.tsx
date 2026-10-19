'use client'

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { Bell, Camera, CameraOff, HeartPulse, Loader2, Mic, MicOff, Phone, Pill, Play, Send, Sparkles, Volume2 } from 'lucide-react'

type Medication = { id: number; name: string; dose: string; instructions: string; time: string; status: string }
type Conversation = { id: number; speaker: 'you' | 'aura'; text: string }

const fallbackReply = (input: string) => {
  const text = input.toLowerCase()
  if (/hello|hi|good morning|good evening/.test(text)) return 'Hello, I am Aura. It is lovely to hear your voice. How are you feeling today?'
  if (/medicine|medication|pill|tablet/.test(text)) return 'I can help with your medicine reminders. Please only take medicine according to your care plan.'
  if (/lonely|sad|upset|not well|pain/.test(text)) return 'I am here with you. Please take a slow breath, and I can call Priya if you would like support.'
  if (/call|help|caretaker|priya/.test(text)) return 'I will call Priya now and let her know you need support.'
  if (/camera/.test(text)) return 'I can turn the camera on for a check-in, or turn it off whenever you say camera off.'
  return `I heard you say, “${input}”. Thank you for telling me. Would you like a reminder, a camera check-in, or a call to Priya?`
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
  const [mcpOpen, setMcpOpen] = useState(false)
  const [mcpLoading, setMcpLoading] = useState(false)
  const [mcpTools, setMcpTools] = useState<{ name?: string; description?: string }[]>([])
  const [alarm, setAlarm] = useState<Medication | null>(null)
  const [form, setForm] = useState({ name: '', dose: '', time: '', instructions: '' })
  const videoRef = useRef<HTMLVideoElement>(null)
  const recognitionRef = useRef<any>(null)
  const listeningRef = useRef(false)

  const speak = useCallback((text: string) => {
    setConversation((items) => [...items, { id: Date.now() + Math.random(), speaker: 'aura', text }].slice(-14))
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text))
    }
  }, [])

  const stopCamera = useCallback(() => {
    const stream = videoRef.current?.srcObject as MediaStream | null
    stream?.getTracks().forEach((track) => track.stop())
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraOpen(false)
    speak('The camera is now off. I am still here with you.')
  }, [speak])

  const openCamera = useCallback(async () => {
    if (cameraOpen) { stopCamera(); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      setCameraOpen(true)
      if (videoRef.current) videoRef.current.srcObject = stream
      speak('The camera is on. I can see you for your check-in.')
    } catch {
      speak('Camera permission is needed for a live check-in. You can allow it in your browser settings.')
    }
  }, [cameraOpen, speak, stopCamera])

  const callPriya = useCallback(() => {
    setCalling(true)
    speak('Calling Priya now. Please stay comfortable while I connect you.')
    window.setTimeout(() => setCalling(false), 4000)
  }, [speak])

  const askAura = useCallback(async (raw: string) => {
    const question = raw.trim()
    if (!question || loading) return
    setInput('')
    setConversation((items) => [...items, { id: Date.now() + Math.random(), speaker: 'you', text: question }].slice(-14))
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
    if (!Recognition) { speak('Voice input is not available in this browser. You can type below instead.'); return }
    if (listeningRef.current) {
      recognitionRef.current?.stop()
      listeningRef.current = false
      setListening(false)
      setWakeWordReady(false)
      return
    }
    const recognition = new Recognition()
    recognition.lang = 'en-US'
    recognition.continuous = wakeMode
    recognition.interimResults = false
    recognition.onstart = () => { listeningRef.current = true; setListening(true); if (wakeMode) setWakeWordReady(true) }
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results).slice(-1)[0]?.[0]?.transcript?.trim() || ''
      const lower = transcript.toLowerCase()
      const command = wakeMode ? transcript.slice(lower.lastIndexOf('aura') + 4).trim() : transcript
      const normalized = command.toLowerCase()
      if (wakeMode && !lower.includes('aura')) return
      if (/camera/.test(normalized) && /(?:off|stop|close|switch off|turn off)/.test(normalized)) { stopCamera(); return }
      if (/camera/.test(normalized) && /(?:on|open|start|switch on|turn on)/.test(normalized)) { openCamera(); return }
      if (/call|caretaker|priya/.test(normalized)) { callPriya(); return }
      if (command) askAura(command)
      else speak('Yes, I am listening. What would you like help with?')
    }
    recognition.onerror = (event: any) => { listeningRef.current = false; setListening(false); setWakeWordReady(false); if (event?.error !== 'aborted') speak('I am ready. Please say Aura, then tell me what you need.') }
    recognition.onend = () => {
      listeningRef.current = false
      setListening(false)
      if (wakeMode) window.setTimeout(() => { try { recognition.start() } catch {} }, 250)
    }
    recognitionRef.current = recognition
    try { recognition.start() } catch { setListening(false); setWakeWordReady(false) }
  }, [askAura, callPriya, openCamera, speak, stopCamera])

  useEffect(() => {
    const timer = window.setTimeout(() => startListening(true), 700)
    return () => { window.clearTimeout(timer); recognitionRef.current?.stop(); if (cameraOpen) stopCamera() }
  }, [startListening, cameraOpen, stopCamera])

  useEffect(() => {
    fetch('/api/medications').then((response) => response.json()).then((data) => setMedications(data.medications || [])).catch(() => {})
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = new Date().toTimeString().slice(0, 5)
      const due = medications.find((item) => item.status !== 'taken' && item.time === now)
      if (due) { setAlarm(due); speak(`It is time for ${due.name}. Please check your medication instructions.`) }
    }, 30000)
    return () => window.clearInterval(timer)
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

  const demo = (kind: 'voice' | 'camera' | 'reminder') => {
    if (kind === 'voice') { speak('This is the voice demo. Say Aura, then ask me anything.'); startListening() }
    if (kind === 'camera') openCamera()
    if (kind === 'reminder') { const medication = medications[0] || { id: 0, name: 'your medicine', dose: 'as prescribed', instructions: 'Follow your care plan', time: 'now', status: 'due' }; setAlarm(medication); speak(`Reminder demo: it is time to take ${medication.name}.`) }
  }

  const showMcpTools = async () => {
    setMcpOpen(true)
    if (mcpTools.length > 0) return
    setMcpLoading(true)
    try {
      const response = await fetch('/api/mcp')
      const data = await response.json()
      setMcpTools(data.tools || [])
    } finally {
      setMcpLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 text-slate-900">
      <header className="border-b bg-white/85 backdrop-blur"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4"><div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-cyan-500 text-white shadow-lg"><HeartPulse /></div><div><div className="text-xl font-extrabold">AuraCare<span className="text-orange-500">+</span></div><div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">A kinder day, together</div></div></div><div className="flex items-center gap-2"><div className="flex rounded-full border bg-white p-1 shadow-sm"><button onClick={() => setTab('home')} className={`rounded-full px-4 py-2 text-sm font-bold ${tab === 'home' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>My care</button><button onClick={() => setTab('demo')} className={`rounded-full px-4 py-2 text-sm font-bold ${tab === 'demo' ? 'bg-orange-500 text-white' : 'text-slate-500'}`}><Play className="mr-1 inline size-4" />Demo</button></div><button onClick={showMcpTools} className="flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-700 shadow-sm hover:bg-indigo-100" aria-expanded={mcpOpen}><Sparkles className="size-4" />MCP tools</button></div></div></header>
      {mcpOpen && <section className="mx-auto max-w-6xl px-5 pt-5"><div className="rounded-3xl border border-indigo-100 bg-white p-5 shadow-lg"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-lg font-extrabold text-indigo-950"><Sparkles className="size-5 text-indigo-600" /> MCP server connection</div><p className="mt-1 text-sm text-slate-500">AuraCare can discover tools through the configured Model Context Protocol server.</p></div><button onClick={() => setMcpOpen(false)} className="rounded-xl px-3 py-1 text-sm font-bold text-slate-500 hover:bg-slate-100">Close</button></div>{mcpLoading ? <p className="mt-4 text-sm font-semibold text-indigo-600">Discovering available tools…</p> : mcpTools.length ? <div className="mt-4 flex flex-wrap gap-2">{mcpTools.map((tool) => <span key={tool.name} className="rounded-full bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-700">{tool.name}</span>)}</div> : <p className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">The MCP button is working, but no tools were returned yet. Check that the MCP server is running.</p>}</div></section>}
      {tab === 'demo' ? <section className="mx-auto max-w-5xl px-5 py-12"><div className="rounded-[2rem] bg-white p-8 shadow-xl"><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700"><Sparkles className="size-4" /> Competition demo</div><h1 className="text-4xl font-extrabold text-indigo-950">See AuraCare in action.</h1><p className="mt-3 text-lg text-slate-500">Every demo is interactive and speaks back.</p><div className="mt-8 grid gap-4 md:grid-cols-3"><button onClick={() => demo('voice')} className="rounded-3xl bg-indigo-600 p-6 text-left text-white shadow-lg"><Mic className="mb-8" /><div className="text-xl font-bold">Voice companion</div><div className="mt-2 text-sm text-indigo-100">Tap, speak, and hear Aura reply.</div></button><button onClick={() => demo('camera')} className="rounded-3xl bg-cyan-600 p-6 text-left text-white shadow-lg"><Camera className="mb-8" /><div className="text-xl font-bold">Camera check-in</div><div className="mt-2 text-sm text-cyan-100">Turn the camera on or off.</div></button><button onClick={() => demo('reminder')} className="rounded-3xl bg-orange-500 p-6 text-left text-white shadow-lg"><Bell className="mb-8" /><div className="text-xl font-bold">Reminder sound</div><div className="mt-2 text-sm text-orange-100">Hear a medication reminder.</div></button></div>{cameraOpen && <div className="mt-8 overflow-hidden rounded-3xl bg-slate-950 p-3"><video ref={videoRef} autoPlay playsInline className="aspect-video w-full rounded-2xl object-cover" /><button onClick={stopCamera} className="mt-3 flex items-center gap-2 rounded-xl bg-white px-4 py-2 font-bold text-slate-900"><CameraOff className="size-4" /> Switch camera off</button></div>}<div className="mt-8 rounded-2xl bg-indigo-50 p-5 text-indigo-950"><div className="flex items-center gap-2 font-bold"><Volume2 className="size-5" /> Try saying: “Aura, how are you?” or “Aura, turn the camera off.”</div></div></div></section> : <section className="mx-auto grid max-w-6xl gap-6 px-5 py-8 lg:grid-cols-[1.1fr_.9fr]"><div className="rounded-[2rem] bg-white p-7 shadow-xl"><div className="flex items-center justify-between"><div><p className="font-bold text-indigo-600">Good morning, Priya</p><h1 className="mt-1 text-4xl font-extrabold text-indigo-950">How can Aura help?</h1></div><button onClick={() => startListening()} aria-label={listening ? 'Stop listening' : 'Start listening'} className={`flex size-16 items-center justify-center rounded-full text-white shadow-lg transition ${listening ? 'animate-pulse bg-rose-500' : 'bg-indigo-600 hover:bg-indigo-700'}`}>{listening ? <MicOff /> : <Mic />}</button></div><div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">{wakeWordReady ? 'Aura is listening. Say “Aura” followed by a question.' : 'Tap the microphone to talk with Aura.'}</div><div className="mt-5 flex min-h-64 flex-col gap-3 overflow-auto rounded-3xl bg-gradient-to-br from-indigo-50 to-cyan-50 p-5">{conversation.length === 0 && <div className="m-auto text-center text-slate-500"><Volume2 className="mx-auto mb-3 size-9 text-indigo-400" /><p className="font-semibold">Your conversation will appear here.</p></div>}{conversation.map((message) => <div key={message.id} className={`max-w-[85%] rounded-2xl px-4 py-3 ${message.speaker === 'you' ? 'self-end bg-indigo-600 text-white' : 'bg-white text-slate-700 shadow-sm'}`}><span className="mr-2 text-xs font-bold opacity-60">{message.speaker === 'you' ? 'You' : 'Aura'}</span>{message.text}</div>)}{loading && <Loader2 className="animate-spin text-indigo-500" />}</div><form onSubmit={(event) => { event.preventDefault(); askAura(input) }} className="mt-4 flex gap-2"><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Type to talk with Aura..." className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-500" /><button className="rounded-2xl bg-indigo-600 px-4 text-white" aria-label="Send message"><Send /></button></form><div className="mt-4 grid gap-3 sm:grid-cols-2"><button onClick={openCamera} className="flex items-center justify-center gap-2 rounded-2xl bg-cyan-100 px-4 py-3 font-bold text-cyan-800">{cameraOpen ? <CameraOff /> : <Camera />} {cameraOpen ? 'Camera off' : 'Camera check-in'}</button><button onClick={callPriya} className="flex items-center justify-center gap-2 rounded-2xl bg-orange-100 px-4 py-3 font-bold text-orange-800"><Phone /> Call Priya</button></div>{cameraOpen && <div className="mt-4 overflow-hidden rounded-3xl bg-slate-950 p-3"><video ref={videoRef} autoPlay playsInline className="aspect-video w-full rounded-2xl" /><button onClick={stopCamera} className="mt-3 rounded-xl bg-white px-4 py-2 font-bold">Switch camera off</button></div>}</div><aside className="flex flex-col gap-6"><div className="rounded-[2rem] bg-white p-6 shadow-xl"><div className="flex items-center justify-between"><h2 className="text-xl font-extrabold text-indigo-950">Medication reminders</h2><Pill className="text-orange-500" /></div>{medications.length === 0 ? <p className="mt-4 text-slate-500">No medications yet. Add one below.</p> : <div className="mt-4 flex flex-col gap-3">{medications.map((medication) => <div key={medication.id} className="rounded-2xl bg-orange-50 p-4"><div className="flex items-center justify-between font-bold"><span>{medication.name}</span><span>{medication.time}</span></div><div className="mt-1 text-sm text-slate-600">{medication.dose} · {medication.instructions}</div></div>)}</div>}<form onSubmit={addMedication} className="mt-5 grid gap-2"><input required placeholder="Medication name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="rounded-xl border px-3 py-2" /><input required placeholder="Dose" value={form.dose} onChange={(event) => setForm({ ...form, dose: event.target.value })} className="rounded-xl border px-3 py-2" /><input required type="time" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} className="rounded-xl border px-3 py-2" /><input placeholder="Instructions" value={form.instructions} onChange={(event) => setForm({ ...form, instructions: event.target.value })} className="rounded-xl border px-3 py-2" /><button className="rounded-xl bg-orange-500 px-4 py-3 font-bold text-white">Add medication</button></form></div><div className="rounded-[2rem] bg-indigo-950 p-6 text-white shadow-xl"><div className="flex items-center gap-3"><div className="flex size-12 items-center justify-center rounded-2xl bg-white/15"><Phone /></div><div><div className="font-bold">Caretaker support</div><div className="text-sm text-indigo-200">Priya is your emergency contact</div></div></div><button onClick={callPriya} className="mt-5 w-full rounded-xl bg-white px-4 py-3 font-bold text-indigo-950">Call caretaker</button></div></aside></section>}
      {alarm && <div className="fixed bottom-5 left-1/2 z-10 w-[min(92vw,440px)] -translate-x-1/2 rounded-3xl bg-orange-500 p-5 text-white shadow-2xl"><div className="flex items-start justify-between"><div><div className="flex items-center gap-2 font-bold"><Bell className="animate-bounce" /> Medication reminder</div><div className="mt-2 text-2xl font-extrabold">{alarm.name}</div><div>{alarm.dose} · {alarm.instructions}</div></div><button onClick={() => setAlarm(null)} className="rounded-xl bg-white/20 px-3 py-2 font-bold">Done</button></div></div>}
      {calling && <div className="fixed right-5 top-20 z-10 flex items-center gap-3 rounded-2xl bg-emerald-500 px-5 py-4 font-bold text-white shadow-xl"><Phone className="animate-pulse" /> Calling Priya...</div>}
    </main>
  )
}
