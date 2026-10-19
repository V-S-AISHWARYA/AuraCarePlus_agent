'use client'

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { Bell, Camera, Check, HeartPulse, Loader2, Mic, MicOff, Phone, Pill, Play, Send, ShieldCheck, Sparkles, Volume2, X } from 'lucide-react'

type Medication = { id: number; name: string; dose: string; instructions: string; time: string; status: string; taken_at?: string | null }
type Action = { id: number; type: string; detail: string; created_at: string }
const CARETAKER_PHONE = '+15550123456'

export default function Page() {
  const [medications, setMedications] = useState<Medication[]>([])
  const [actions, setActions] = useState<Action[]>([])
  const [listening, setListening] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [calling, setCalling] = useState(false)
  const [message, setMessage] = useState('Hello Eleanor. I am here with you.')
  const [transcript, setTranscript] = useState('')
  const [loading, setLoading] = useState(false)
  const [alarm, setAlarm] = useState<Medication | null>(null)
  const [tab, setTab] = useState<'home' | 'demo'>('home')
  const [demoStep, setDemoStep] = useState('')
  const [form, setForm] = useState({ name: '', dose: '', time: '', instructions: '' })
  const videoRef = useRef<HTMLVideoElement>(null)
  const recognitionRef = useRef<any>(null)
  const listeningRef = useRef(false)
  const alarmedRef = useRef(new Set<number>())

  const remember = useCallback(async (type: string, detail: string) => {
    fetch('/api/caretaker', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type, detail }) }).catch(() => {})
    setActions((items) => [{ id: Date.now(), type, detail, created_at: new Date().toISOString() }, ...items].slice(0, 30))
  }, [])

  const speak = useCallback((text: string) => {
    setMessage(text)
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 0.9
      utterance.pitch = 1.04
      window.speechSynthesis.speak(utterance)
    }
  }, [])

  const callPriya = useCallback(() => {
    setCalling(true)
    speak('Calling Priya now.')
    remember('caretaker_call', 'AuraCare started a call to Priya')
    window.setTimeout(() => setCalling(false), 10000)
  }, [remember, speak])

  const openCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      setCameraOpen(true)
      window.setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream }, 0)
      speak('Camera is on. I can see you, Eleanor.')
      remember('camera', 'Camera opened')
    } catch { speak('I could not open the camera. Please check camera permission.') }
  }, [remember, speak])

  const askAssistant = useCallback(async (text: string) => {
    const clean = text.trim()
    if (!clean) return
    setTranscript(clean)
    const lower = clean.toLowerCase()
    if (/\b(camera|video)\b/.test(lower)) return openCamera()
    if (/\b(call|phone|contact|priya)\b/.test(lower)) return callPriya()
    setLoading(true)
    await remember('conversation', `Eleanor said: ${clean}`)
    try {
      const response = await fetch('/api/assistant', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: clean }) })
      const data = await response.json()
      const answer = data.answer || 'I heard you. I am here with you.'
      speak(answer)
      await remember('assistant_response', answer)
      if (/fall|chest pain|can't breathe|cannot breathe|unsafe|emergency|hurt/i.test(lower)) callPriya()
    } catch { speak('I heard you. I am still here with you. Please try asking again.') }
    finally { setLoading(false) }
  }, [callPriya, openCamera, remember, speak])

  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) { speak('Voice listening is not supported here. Please use the message box.'); return }
    recognitionRef.current?.stop()
    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1]
      const text = result[0].transcript.trim()
      if (!text) return
      setTranscript(text)
      if (result.isFinal) {
        const command = text.replace(/^\s*aura[,.]?\s*/i, '').trim() || 'Hello Aura'
        askAssistant(command)
      }
    }
    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        listeningRef.current = false
        setListening(false)
        speak('Microphone access is blocked. Allow microphone access, then press the microphone again.')
      }
    }
    recognition.onend = () => {
      if (listeningRef.current) { try { recognition.start() } catch {} }
    }
    recognitionRef.current = recognition
    listeningRef.current = true
    setListening(true)
    try { recognition.start(); speak('I am listening. Tell me what you need.') } catch { speak('Please press the microphone once more to begin.') }
  }, [askAssistant, speak])

  const stopListening = useCallback(() => {
    listeningRef.current = false
    recognitionRef.current?.stop()
    setListening(false)
    speak('I stopped listening. Press the microphone whenever you need me.')
  }, [speak])

  useEffect(() => {
    Promise.all([fetch('/api/medications').then((r) => r.json()), fetch('/api/caretaker').then((r) => r.json())])
      .then(([m, memory]) => { setMedications(m.medications ?? []); setActions(memory.actions ?? []) }).catch(() => {})
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {})
    return () => { listeningRef.current = false; recognitionRef.current?.stop(); if (videoRef.current?.srcObject) (videoRef.current.srcObject as MediaStream).getTracks().forEach((track) => track.stop()) }
  }, [])

  useEffect(() => {
    const check = () => {
      const due = medications.find((item) => item.status === 'due' && !alarmedRef.current.has(item.id))
      if (!due) return
      alarmedRef.current.add(due.id)
      setAlarm(due)
      speak(`Medication reminder. It is time for ${due.name}, ${due.dose}. ${due.instructions}.`)
      remember('medication_reminder', `${due.name} reminder sounded`)
      if ('Notification' in window && Notification.permission === 'granted') new Notification(`Medication reminder: ${due.name}`, { body: `${due.dose} — ${due.instructions}` })
    }
    check()
    const timer = window.setInterval(check, 5000)
    return () => window.clearInterval(timer)
  }, [medications, remember, speak])

  async function markTaken(id: number) {
    const response = await fetch('/api/medications', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) })
    const data = await response.json()
    if (!data.medication) return
    setMedications((items) => items.map((item) => item.id === id ? data.medication : item))
    setAlarm(null)
    await remember('medication_taken', `${data.medication.name} marked taken`)
    speak(`Good job. ${data.medication.name} is recorded as taken. I told Priya.`)
  }

  async function addMedication(event: FormEvent) {
    event.preventDefault()
    const response = await fetch('/api/medications', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) })
    const data = await response.json()
    if (data.medication) { setMedications((items) => [...items, data.medication]); setForm({ name: '', dose: '', time: '', instructions: '' }); speak(`I added ${data.medication.name} to your medication reminders.`); remember('medication_added', `${data.medication.name} at ${data.medication.time}`) }
  }

  async function sendText(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const input = event.currentTarget.elements.namedItem('message') as HTMLInputElement; const text = input.value; input.value = ''; await askAssistant(text) }
  function closeCamera() { if (videoRef.current?.srcObject) (videoRef.current.srcObject as MediaStream).getTracks().forEach((track) => track.stop()); setCameraOpen(false); remember('camera', 'Camera closed') }
  function runDemo(step: string) { setDemoStep(step); if (step === 'voice') startListening(); else if (step === 'camera') openCamera(); else { const medication = medications[0]; setAlarm(medication ?? { id: 0, name: 'your medicine', dose: 'as prescribed', instructions: 'Please take it now', time: '', status: 'due' }); speak(`Demo reminder. It is time to take your medicine.`) } }

  return <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#ffe8d8,transparent_35%),radial-gradient(circle_at_bottom_right,#dceeff,transparent_38%),#f8fbff] text-slate-900">
    <header className="border-b border-white/80 bg-white/80 backdrop-blur-xl"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4"><div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-cyan-500 text-white shadow-lg"><HeartPulse /></div><div><div className="text-xl font-extrabold tracking-tight">AuraCare<span className="text-orange-500">+</span></div><div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">A kinder day, together</div></div></div><div className="flex rounded-full border border-slate-200 bg-white p-1 shadow-sm"><button onClick={() => setTab('home')} className={`rounded-full px-4 py-2 text-sm font-bold ${tab === 'home' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>My care</button><button onClick={() => setTab('demo')} className={`rounded-full px-4 py-2 text-sm font-bold ${tab === 'demo' ? 'bg-orange-500 text-white' : 'text-slate-500'}`}><Play className="mr-1 inline size-4" />Demo</button></div></div></header>
    {tab === 'demo' ? <section className="mx-auto max-w-5xl px-5 py-10"><div className="rounded-[2rem] bg-white p-7 shadow-xl lg:p-10"><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700"><Sparkles className="size-4" /> Competition demo mode</div><h1 className="text-4xl font-extrabold tracking-tight text-indigo-950">See AuraCare in action.</h1><p className="mt-3 text-lg text-slate-500">One tap shows how Aura listens, sees, reminds and keeps Priya informed.</p><div className="mt-9 grid gap-4 md:grid-cols-3"><button onClick={() => runDemo('voice')} className="rounded-3xl bg-indigo-600 p-6 text-left text-white shadow-lg"><Mic className="mb-8 size-8" /><div className="text-xl font-bold">Voice companion</div><div className="mt-2 text-sm text-indigo-100">Speak and hear a warm response.</div></button><button onClick={() => runDemo('camera')} className="rounded-3xl bg-cyan-600 p-6 text-left text-white shadow-lg"><Camera className="mb-8 size-8" /><div className="text-xl font-bold">Camera check-in</div><div className="mt-2 text-sm text-cyan-100">Turn on a live check-in.</div></button><button onClick={() => runDemo('reminder')} className="rounded-3xl bg-orange-500 p-6 text-left text-white shadow-lg"><Bell className="mb-8 size-8" /><div className="text-xl font-bold">Reminder with sound</div><div className="mt-2 text-sm text-orange-100">Hear and complete a reminder.</div></button></div>{demoStep && <div className="mt-8 rounded-2xl bg-indigo-50 p-5 font-semibold text-indigo-900">Demo active: {demoStep === 'voice' ? 'Aura is listening. Speak now.' : demoStep === 'camera' ? 'Camera check-in is opening.' : 'The reminder sound is playing.'}</div>}</div></section> : <section className="mx-auto grid max-w-6xl gap-6 px-5 py-8 lg:grid-cols-[1.15fr_.85fr]"><div className="rounded-[2rem] bg-white p-7 shadow-xl"><div className="mb-6 flex items-start justify-between"><div><div className="text-sm font-bold text-orange-500">Good morning, Eleanor</div><h1 className="mt-1 text-4xl font-extrabold tracking-tight text-indigo-950">I’m here with you.</h1><p className="mt-2 text-slate-500">Talk naturally. I’ll listen, respond, and keep Priya informed.</p></div><div className={`rounded-full px-3 py-2 text-xs font-bold ${listening ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{listening ? 'Listening now' : 'Ready to listen'}</div></div><div className="rounded-3xl bg-gradient-to-br from-indigo-950 via-indigo-800 to-cyan-700 p-6 text-white shadow-lg"><div className="flex items-center gap-2 text-cyan-200"><Volume2 className="size-5" /> Aura says</div><p className="mt-4 text-2xl font-bold leading-snug">{message}</p>{transcript && <p className="mt-5 border-t border-white/20 pt-4 text-sm text-indigo-100">I heard: “{transcript}”</p>}</div><div className="mt-6 flex flex-col items-center gap-4"><button onClick={listening ? stopListening : startListening} aria-label={listening ? 'Stop microphone' : 'Start microphone'} className={`flex size-28 items-center justify-center rounded-full text-white shadow-2xl transition hover:scale-105 ${listening ? 'bg-orange-500 shadow-orange-200' : 'bg-indigo-600 shadow-indigo-200'}`}>{listening ? <MicOff className="size-12" /> : <Mic className="size-12" />}</button><div className="text-center"><div className="text-lg font-extrabold text-indigo-950">{listening ? 'Listening… speak now' : 'Tap the microphone to talk'}</div><div className="text-sm text-slate-500">No wake word required</div></div></div><form onSubmit={sendText} className="mt-6 flex gap-2"><input name="message" aria-label="Message Aura" placeholder="Type a message to Aura…" className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-500" /><button disabled={loading} className="rounded-2xl bg-indigo-600 px-5 text-white">{loading ? <Loader2 className="animate-spin" /> : <Send />}</button></form></div><div className="flex flex-col gap-6"><div className="rounded-[2rem] bg-white p-6 shadow-xl"><div className="flex items-center justify-between"><h2 className="text-xl font-extrabold text-indigo-950">Today’s care</h2><Pill className="text-orange-500" /></div><div className="mt-4 flex flex-col gap-3">{medications.map((item) => <div key={item.id} className="flex items-center justify-between rounded-2xl bg-orange-50 p-4"><div><div className="font-bold text-indigo-950">{item.name}</div><div className="text-sm text-slate-500">{item.time} · {item.dose}</div></div>{item.status === 'taken' ? <Check className="text-green-600" /> : <button onClick={() => { setAlarm(item); speak(`It is time for ${item.name}, ${item.dose}.`) }} className="rounded-xl bg-orange-500 px-3 py-2 text-xs font-bold text-white">Remind me</button>}</div>)}</div><form onSubmit={addMedication} className="mt-5 grid gap-2"><input required placeholder="Medication name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-xl border border-slate-200 px-3 py-2" /><div className="grid grid-cols-2 gap-2"><input required placeholder="Dose" value={form.dose} onChange={(e) => setForm({ ...form, dose: e.target.value })} className="rounded-xl border border-slate-200 px-3 py-2" /><input required type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="rounded-xl border border-slate-200 px-3 py-2" /></div><input required placeholder="Instructions" value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} className="rounded-xl border border-slate-200 px-3 py-2" /><button className="rounded-xl bg-indigo-600 py-3 font-bold text-white">Add medication</button></form></div><div className="grid grid-cols-2 gap-4"><button onClick={openCamera} className="rounded-3xl bg-cyan-600 p-5 text-left text-white shadow-lg"><Camera className="mb-6 size-7" /><div className="font-extrabold">Camera check-in</div><div className="mt-1 text-xs text-cyan-100">Let Priya see you</div></button><button onClick={callPriya} className="rounded-3xl bg-indigo-950 p-5 text-left text-white shadow-lg"><Phone className="mb-6 size-7" /><div className="font-extrabold">Call Priya</div><div className="mt-1 text-xs text-indigo-200">Send a caretaker alert</div></button></div><div className="rounded-[2rem] bg-white p-6 shadow-xl"><h2 className="font-extrabold text-indigo-950">Recent memory</h2><div className="mt-3 flex flex-col gap-2">{actions.slice(0, 5).map((item) => <div key={item.id} className="text-sm text-slate-500"><span className="font-bold text-indigo-700">{item.type.replaceAll('_', ' ')}</span> · {item.detail}</div>)}</div></div></div></section>}
    {cameraOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-indigo-950/70 p-5"><div className="w-full max-w-2xl rounded-[2rem] bg-white p-5"><div className="mb-4 flex items-center justify-between"><div><div className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-600">Live check-in</div><h2 className="text-2xl font-extrabold text-indigo-950">Camera is on</h2></div><button onClick={closeCamera} aria-label="Close camera" className="rounded-full bg-slate-100 p-2"><X /></button></div><video ref={videoRef} autoPlay playsInline muted className="aspect-video w-full rounded-2xl bg-slate-950 object-cover" /><div className="mt-4 flex items-center gap-2 rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-700"><ShieldCheck className="size-5" /> Priya can see that your check-in is active.</div></div></div>}
    {calling && <div className="fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-4 rounded-2xl bg-indigo-950 px-5 py-4 text-white shadow-2xl"><div className="flex size-11 items-center justify-center rounded-full bg-green-500"><Phone /></div><div><div className="font-bold">Calling Priya</div><div className="text-xs text-indigo-200">{CARETAKER_PHONE} · AuraCare alert sent</div></div><Loader2 className="animate-spin text-cyan-300" /></div>}
    {alarm && <div className="fixed inset-0 z-40 flex items-center justify-center bg-indigo-950/60 p-5"><div className="w-full max-w-md rounded-[2rem] bg-white p-7 text-center shadow-2xl"><div className="mx-auto flex size-16 items-center justify-center rounded-full bg-orange-100 text-orange-500"><Bell className="size-8" /></div><div className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-orange-500">Medication reminder</div><h2 className="mt-2 text-3xl font-extrabold text-indigo-950">Time for {alarm.name}</h2><p className="mt-2 text-slate-500">{alarm.dose} · {alarm.instructions}</p><button onClick={() => alarm.id ? markTaken(alarm.id) : setAlarm(null)} className="mt-6 w-full rounded-2xl bg-orange-500 py-4 font-extrabold text-white">I took it</button></div></div>}
  </main>
}
