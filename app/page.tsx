'use client'

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { Bell, Camera, CameraOff, HeartPulse, Mic, MicOff, Phone, Send, Volume2, Play, Wrench, Activity, X, CheckCircle2 } from 'lucide-react'

type Message = { id: number; from: 'you' | 'aura'; text: string }
type Medication = { id: number; name: string; dose: string; instructions: string; time: string; status: string }

const localReply = (text: string) => {
  const value = text.toLowerCase().trim()
  if (/hello|hi|good morning|good afternoon|are you there/.test(value)) return 'Hello, Elenor. I am Aura, and I am right here with you. How are you feeling today?'
  if (/what is your name|who are you/.test(value)) return 'I am Aura, your friendly voice companion. I can help with reminders, camera check-ins, and contacting your caregiver.'
  if (/how are you|how do you feel/.test(value)) return 'I am doing well and ready to help. How are you feeling right now?'
  if (/what time|time is it|clock/.test(value)) return `It is ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}. Would you like me to remind you about anything?`
  if (/medicine|medication|pill|tablet|reminder/.test(value)) return 'I can help with your medication reminders. Please follow the instructions from your care team, and check the reminder card on the right.'
  if (/camera|see me|video/.test(value)) return 'I can turn the camera on for a check-in. Say “Aura, turn the camera on” or use the camera button.'
  if (/call|caretaker|caregiver|esther/.test(value)) return 'I can contact Esther for you. Say “Aura, call Esther” and I will start the caregiver call.'
  if (/sad|lonely|worried|scared|pain|not well|afraid/.test(value)) return 'I am here with you, Elenor. Take one slow breath with me. Would you like me to call you caregiver?'
  if (/thank/.test(value)) return 'You are very welcome. I am happy to help.'
  if (/weather|outside|hot|cold/.test(value)) return 'Please stay comfortable and hydrated. Esther can help check the local weather with you.'
  if (/goodbye|bye|stop listening/.test(value)) return 'Okay, Elenor. I will be here whenever you need me. Say Aura when you are ready.'
  return `I heard your question: “${text}”. I do not have that information yet, but I am listening. You can ask about your wellbeing, medications, the camera, or calling Esther.`
}

export default function Page() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [listening, setListening] = useState(false)
  const [cameraOn, setCameraOn] = useState(false)
  const [calling, setCalling] = useState(false)
  const [loading, setLoading] = useState(false)
  const [medications, setMedications] = useState<Medication[]>([])
  const [alarm, setAlarm] = useState<Medication | null>(null)
  const [form, setForm] = useState({ name: '', dose: '', time: '', instructions: '' })
  const recognitionRef = useRef<any>(null)
  const listeningRef = useRef(false)
  const cameraRef = useRef<HTMLVideoElement>(null)
  const restartRef = useRef<number | null>(null)
  const speechTimerRef = useRef<number | null>(null)
  const transcriptRef = useRef('')
  const armedRef = useRef(false)
  const autoStartRef = useRef(false)
  const [demoOpen, setDemoOpen] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [activity, setActivity] = useState<string[]>(['AuraCare ready for a conversation'])

  const logActivity = useCallback((event: string) => {
    setActivity((items) => [`${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${event}`, ...items].slice(0, 6))
  }, [])

  const speak = useCallback((text: string) => {
    setMessages((items) => [...items, { id: Date.now() + Math.random(), from: 'aura' as const, text }].slice(-12))
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 0.9
      utterance.pitch = 1
      window.speechSynthesis.speak(utterance)
    }
  }, [])

  const askAura = useCallback(async (text: string) => {
    const question = text.trim()
    if (!question || loading) return
    setInput('')
    setMessages((items) => [...items, { id: Date.now() + Math.random(), from: 'you' as const, text: question }].slice(-12))
    setLoading(true)
    try {
      const response = await fetch('/api/assistant', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: question }) })
      const data = await response.json().catch(() => ({}))
      const fallback = localReply(question)
      const serverAnswer = typeof data.answer === 'string' ? data.answer : ''
      const answer = response.ok && serverAnswer && !serverAnswer.startsWith('I heard your question about') ? serverAnswer : fallback
      speak(answer)
    } catch {
      speak(localReply(question))
    } finally {
      setLoading(false)
    }
  }, [loading, speak])

  const stopCamera = useCallback(() => {
    const stream = cameraRef.current?.srcObject as MediaStream | null
    stream?.getTracks().forEach((track) => track.stop())
    if (cameraRef.current) cameraRef.current.srcObject = null
    setCameraOn(false)
    speak('The camera is now off. I am still here with you.')
  }, [speak])

  const toggleCamera = useCallback(async () => {
    if (cameraOn) { stopCamera(); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      setCameraOn(true)
      if (cameraRef.current) cameraRef.current.srcObject = stream
      speak('The camera is on for your check-in.')
    } catch {
      speak('I could not access the camera. Please allow camera access in your browser.')
    }
  }, [cameraOn, speak, stopCamera])

  const callEsther = useCallback(() => {
    setCalling(true)
    speak('Calling Esther now. Please stay comfortable while I connect you.')
    window.setTimeout(() => setCalling(false), 5000)
  }, [speak])

  const startListening = useCallback(async () => {
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!Recognition) { speak('Voice input is not supported in this browser. You can type your question below.'); return }
    if (listeningRef.current) {
      listeningRef.current = false
      recognitionRef.current?.stop()
      setListening(false)
      setInput('')
      transcriptRef.current = ''
      return
    }

    try {
      const permissionStream = await navigator.mediaDevices?.getUserMedia({ audio: true })
      permissionStream?.getTracks().forEach((track) => track.stop())
    } catch {
      logActivity('Microphone permission is needed before Aura can listen')
      speak('Please allow microphone access in your browser so I can hear you.')
      return
    }

    const submitSpeech = (spokenText: string) => {
      const normalized = spokenText.trim()
      if (!normalized) return
      const lower = normalized.toLowerCase()
      const auraIndex = lower.lastIndexOf('aura')
      const command = auraIndex >= 0 ? normalized.slice(auraIndex + 4).trim() : normalized
      // Keep the microphone session alive after the wake word. The senior can
      // say “Aura”, pause, and then continue naturally without touching the UI.
      if (auraIndex >= 0 && !command) {
        transcriptRef.current = ''
        setInput('')
        if (speechTimerRef.current) window.clearTimeout(speechTimerRef.current)
        if (!listeningRef.current) {
          listeningRef.current = true
          setListening(true)
          try { recognitionRef.current?.start() } catch { /* already listening */ }
        }
        logActivity('Wake word heard — Aura is ready for your question')
        speak('Yes, Elenor. I am listening.')
        return
      }
      if (speechTimerRef.current) window.clearTimeout(speechTimerRef.current)
      transcriptRef.current = ''
      setInput('')
      if (!command) { speak('Yes, I am listening. Please tell me what you need.'); return }
      if (/camera/.test(command.toLowerCase()) && /turn off|switch off|close|stop/.test(command.toLowerCase())) { stopCamera(); return }
      if (/camera/.test(command.toLowerCase()) && /turn on|switch on|open|start/.test(command.toLowerCase())) { toggleCamera(); return }
      if (/call|caretaker|caregiver/.test(command.toLowerCase())) { callEsther(); return }
      // Keep recognition alive while Aura processes the sentence, so every
      // spoken turn is transcribed into the field and sent automatically.
      askAura(command)
    }

    transcriptRef.current = ''
    if (speechTimerRef.current) window.clearTimeout(speechTimerRef.current)
    const recognition = new Recognition()
    recognition.lang = 'en-US'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1
    recognition.onstart = () => { listeningRef.current = true; setListening(true); logActivity('Microphone is listening — speak naturally') }
    recognition.onresult = (event: any) => {
      let finalText = transcriptRef.current
      let interimText = ''
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const phrase = event.results[index]?.[0]?.transcript || ''
        if (event.results[index].isFinal) finalText += `${phrase} `
        else interimText += `${phrase} `
      }
      transcriptRef.current = finalText
      const visibleText = `${finalText}${interimText}`.trim()
      if (visibleText) setInput(visibleText)
      if (visibleText) {
        transcriptRef.current = visibleText
        if (speechTimerRef.current) window.clearTimeout(speechTimerRef.current)
        // Web Speech can report the last words as interim text only. Submit the
        // complete visible transcript after a short pause instead of dropping it.
        speechTimerRef.current = window.setTimeout(() => submitSpeech(transcriptRef.current), 700)
      }
    }
    recognition.onerror = (event: any) => {
      if (event?.error === 'not-allowed' || event?.error === 'service-not-allowed') {
        listeningRef.current = false
        setListening(false)
        logActivity('Microphone permission was blocked')
        speak('Microphone access is blocked. Please allow microphone access and try again.')
      } else if (event?.error !== 'aborted' && listeningRef.current) {
        logActivity(`Voice input issue: ${event.error || 'please try again'}`)
      }
    }
    recognition.onend = () => {
      if (!listeningRef.current) return
      const capturedText = transcriptRef.current.trim()
      if (capturedText) {
        logActivity('Speech captured — sending your question to Aura')
        submitSpeech(capturedText)
      }
      // Chrome and Safari can end a recognition session after a pause even
      // with continuous=true. Restart it without changing the listening state.
      if (restartRef.current) window.clearTimeout(restartRef.current)
      restartRef.current = window.setTimeout(() => {
        if (!listeningRef.current) return
        try { recognition.start() } catch { /* browser may still be closing the prior session */ }
      }, 450)
    }
    recognitionRef.current = recognition
    try { recognition.start() } catch { speak('Please press the microphone button again to start listening.') }
  }, [askAura, callEsther, logActivity, speak, stopCamera, toggleCamera])

  useEffect(() => {
    fetch('/api/medications').then((response) => response.json()).then((data) => setMedications(data.medications || [])).catch(() => {})
    const autoStart = window.setTimeout(() => {
      if (autoStartRef.current || listeningRef.current) return
      autoStartRef.current = true
      startListening()
    }, 700)
    return () => { window.clearTimeout(autoStart); recognitionRef.current?.stop(); if (restartRef.current) window.clearTimeout(restartRef.current) }
  }, [startListening])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = new Date().toTimeString().slice(0, 5)
      const due = medications.find((item) => item.status !== 'taken' && item.time === now)
      if (due) { setAlarm(due); speak(`Medication reminder. It is time for ${due.name}.`) }
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

  return <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 text-slate-900">
    <header className="border-b bg-white/90 px-5 py-4 shadow-sm"><div className="mx-auto flex max-w-5xl items-center gap-3"><div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-cyan-500 text-white shadow-lg"><HeartPulse /></div><div><div className="text-2xl font-black">AuraCare<span className="text-orange-500">+</span></div><div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Your kind voice companion</div></div></div></header>
    <div className="mx-auto grid max-w-5xl gap-6 px-5 py-8 lg:grid-cols-[1.35fr_0.65fr]">
      <section className="rounded-[2rem] bg-white p-6 shadow-xl"><div className="flex items-center justify-between"><div><p className="text-sm font-bold text-indigo-600">Always here for you</p><h1 className="text-3xl font-black text-indigo-950">Talk with Aura</h1></div><div className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold ${listening ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}><span className={`size-2 rounded-full ${listening ? 'animate-pulse bg-emerald-500' : 'bg-slate-400'}`} />{listening ? 'Listening' : 'Ready'}</div></div>
        <div className="mt-5 flex min-h-56 flex-col gap-3 rounded-3xl bg-gradient-to-br from-indigo-50 to-cyan-50 p-4">{messages.length === 0 && <div className="m-auto text-center text-slate-500"><Volume2 className="mx-auto mb-3 size-10 text-indigo-500" /><p className="font-bold">Say “Aura” to wake me up</p><p className="mt-1 text-sm">Then ask your question. I will answer out loud.</p></div>}{messages.map((message) => <div key={message.id} className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm ${message.from === 'you' ? 'self-end bg-indigo-600 text-white' : 'bg-white text-slate-700 shadow-sm'}`}><span className="mb-1 block text-[10px] font-black uppercase opacity-60">{message.from === 'you' ? 'You' : 'Aura'}</span>{message.text}</div>)}{loading && <div className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-indigo-600">Aura is thinking…</div>}</div>
        <div className="mt-5 flex flex-col items-center gap-3"><button onClick={startListening} aria-label={listening ? 'Stop listening' : 'Start listening'} className={`flex size-24 items-center justify-center rounded-full text-white shadow-xl transition hover:scale-105 ${listening ? 'bg-rose-500' : 'bg-gradient-to-br from-indigo-600 to-cyan-500'}`}>{listening ? <MicOff className="size-10" /> : <Mic className="size-10" />}</button><p className="text-center text-sm font-bold text-slate-500">{listening ? 'Wake word active — say “Aura”, then speak' : 'Tap once to enable hands-free “Aura” wake mode'}</p></div>
        <form onSubmit={(event) => { event.preventDefault(); askAura(input) }} className="mt-5 flex gap-2"><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Type to talk with Aura..." className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-500" /><button className="rounded-2xl bg-indigo-600 px-4 text-white" aria-label="Send message"><Send /></button></form>
        <div className="mt-3 grid gap-3 sm:grid-cols-2"><button onClick={() => setDemoOpen(true)} className="flex items-center justify-center gap-2 rounded-2xl border-2 border-indigo-200 bg-indigo-50 px-4 py-3 font-bold text-indigo-700"><Play /> Interactive demo</button><button onClick={() => setToolsOpen(true)} className="flex items-center justify-center gap-2 rounded-2xl border-2 border-cyan-200 bg-cyan-50 px-4 py-3 font-bold text-cyan-700"><Wrench /> Frameworks &amp; MCP</button></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><button onClick={toggleCamera} className="flex items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-4 py-3 font-bold text-white">{cameraOn ? <CameraOff /> : <Camera />} {cameraOn ? 'Turn camera off' : 'Camera check-in'}</button><button onClick={callEsther} className="flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 font-bold text-white"><Phone /> Call Esther</button></div>{cameraOn && <div className="mt-4 overflow-hidden rounded-2xl bg-slate-950 p-2"><video ref={cameraRef} autoPlay playsInline className="aspect-video w-full rounded-xl object-cover" /></div>}
      </section>
      <aside className="flex flex-col gap-6"><section className="rounded-[2rem] bg-white p-5 shadow-xl"><div className="flex items-center gap-2 text-lg font-black text-indigo-950"><Bell className="text-orange-500" /> Medication reminders</div><div className="mt-4 grid gap-3">{medications.map((medication) => <div key={medication.id} className="rounded-2xl bg-orange-50 p-3"><div className="font-bold">{medication.name}</div><div className="text-sm text-slate-600">{medication.dose} · {medication.time}</div></div>)}</div><form onSubmit={addMedication} className="mt-5 grid gap-2"><input required placeholder="Medication name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="rounded-xl border px-3 py-2" /><input required placeholder="Dose" value={form.dose} onChange={(event) => setForm({ ...form, dose: event.target.value })} className="rounded-xl border px-3 py-2" /><input required type="time" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} className="rounded-xl border px-3 py-2" /><button className="rounded-xl bg-orange-500 px-3 py-2 font-bold text-white">Add reminder</button></form></section><section className="rounded-[2rem] bg-indigo-950 p-5 text-white shadow-xl"><div className="font-black">Voice commands</div><ul className="mt-3 grid gap-2 text-sm text-indigo-100"><li>“Aura, how are you?”</li><li>“Aura, turn the camera off.”</li><li>“Aura, call Esther.”</li></ul></section></aside>
    </div>
    {demoOpen && <div className="fixed inset-0 z-30 flex items-center justify-center bg-indigo-950/40 p-5 backdrop-blur-sm"><section className="w-full max-w-2xl rounded-[2rem] bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><div className="text-sm font-black uppercase tracking-[0.2em] text-orange-500">Hackathon demo mode</div><h2 className="mt-1 text-3xl font-black text-indigo-950">See AuraCare in action</h2><p className="mt-2 text-sm text-slate-500">Try every capability without needing a real medication or call.</p></div><button onClick={() => setDemoOpen(false)} aria-label="Close demo" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><X /></button></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><button onClick={() => { speak('Demo voice response: Hello, I am Aura. I am listening and ready to help.'); logActivity('Demo: voice response played') }} className="rounded-2xl bg-indigo-600 p-4 text-left font-bold text-white"><Mic className="mb-2" />Voice response</button><button onClick={() => { toggleCamera(); logActivity('Demo: camera check-in triggered') }} className="rounded-2xl bg-cyan-600 p-4 text-left font-bold text-white"><Camera className="mb-2" />Camera check-in</button><button onClick={() => { setAlarm(medications[0] || { id: 0, name: 'demo medication', dose: '1 tablet', instructions: 'Demo reminder', time: 'now', status: 'due' }); speak('Demo reminder. It is time to take your medication.'); logActivity('Demo: audible reminder triggered') }} className="rounded-2xl bg-orange-500 p-4 text-left font-bold text-white"><Bell className="mb-2" />Sound reminder</button></div><div className="mt-5 rounded-2xl bg-slate-50 p-4"><div className="flex items-center gap-2 font-bold text-slate-900"><Activity className="text-emerald-600" />Live event stream</div><div className="mt-3 grid gap-2 text-sm text-slate-600">{activity.map((event, index) => <div key={`${event}-${index}`} className="flex items-center gap-2"><CheckCircle2 className="size-4 text-emerald-500" />{event}</div>)}</div></div></section></div>}
    {toolsOpen && <div className="fixed inset-0 z-30 flex items-center justify-center bg-indigo-950/40 p-5 backdrop-blur-sm"><section className="w-full max-w-2xl rounded-[2rem] bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><div className="text-sm font-black uppercase tracking-[0.2em] text-cyan-600">Technology stack</div><h2 className="mt-1 text-3xl font-black text-indigo-950">Frameworks &amp; tools</h2></div><button onClick={() => setToolsOpen(false)} aria-label="Close tools" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><X /></button></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{[['Next.js 16', 'App Router and API routes'], ['React 19', 'Interactive senior companion UI'], ['TypeScript', 'Typed application logic'], ['Tailwind CSS', 'Responsive accessible design'], ['Web Speech API', 'Wake word, recognition, spoken replies'], ['MediaDevices API', 'Live camera check-in'], ['MCP', 'Tool discovery and context exchange'], ['AI SDK + AI Gateway', 'Safe conversational responses'], ['SQLite', 'Medication and action memory'], ['Amazon-ready architecture', 'Caregiver escalation and audit trail']].map(([name, detail]) => <div key={name} className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><div className="font-black text-indigo-950">{name}</div><div className="mt-1 text-sm text-slate-600">{detail}</div></div>)}</div></section></div>}
    {alarm && <div className="fixed bottom-5 left-1/2 z-20 w-[min(92vw,430px)] -translate-x-1/2 rounded-3xl bg-orange-500 p-5 text-white shadow-2xl"><div className="flex items-start justify-between gap-3"><div><div className="font-black">Medication reminder</div><div className="mt-1 text-2xl font-black">{alarm.name}</div><div>{alarm.dose} · {alarm.instructions}</div></div><button onClick={() => setAlarm(null)} className="rounded-xl bg-white/20 px-3 py-2 font-bold">Done</button></div></div>}
    {calling && <div className="fixed right-5 top-5 z-20 rounded-2xl bg-emerald-500 px-5 py-4 font-bold text-white shadow-xl">Calling Esther…</div>}
  </main>
}
