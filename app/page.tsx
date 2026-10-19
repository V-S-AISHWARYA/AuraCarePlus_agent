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
      utterance.rate = 0.88
      utterance.pitch = 1.02
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
      if (videoRef.current) videoRef.current.srcObject = stream
      setCameraOpen(true)
      speak('Camera is on. I can see you, Eleanor.')
      remember('camera', 'Camera opened')
    } catch {
      speak('I could not open the camera. Please check camera permission.')
    }
  }, [remember, speak])

  const askAssistant = useCallback(async (text: string) => {
    const clean = text.trim()
    if (!clean) return
    setTranscript(clean)
    const lower = clean.toLowerCase()
    if (/\b(camera|video)\b/.test(lower)) return openCamera()
    if (/\b(call|phone|contact)\b/.test(lower)) return callPriya()
    setLoading(true)
    await remember('conversation', `Eleanor said: ${clean}`)
    try {
      const response = await fetch('/api/assistant', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: clean }) })
      const data = await response.json()
      const answer = data.answer || 'I am here with you. You are safe.'
      speak(answer)
      await remember('assistant_response', answer)
      if (/fall|chest pain|can't breathe|cannot breathe|unsafe|emergency|hurt/i.test(lower)) callPriya()
    } catch {
      speak('I am still here with you. Please try asking me again.')
    } finally { setLoading(false) }
  }, [callPriya, openCamera, remember, speak])

  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) { speak('Voice listening is not supported in this browser. You can use the message box below.'); return }
    if (recognitionRef.current) recognitionRef.current.stop()
    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1]
      const text = result[0].transcript.trim()
      if (text) setTranscript(text)
      if (result.isFinal && /\baura\b/i.test(text)) askAssistant(text.replace(/\baura\b/i, '').trim() || 'Hello')
    }
    recognition.onerror = (event: any) => { if (event.error === 'not-allowed') { listeningRef.current = false; setListening(false); speak('Please allow microphone access in your browser, then press the microphone again.') } }
    recognition.onend = () => { if (listeningRef.current) { try { recognition.start() } catch {} } }
    recognitionRef.current = recognition
    listeningRef.current = true
    setListening(true)
    try { recognition.start(); speak('I am listening. Say Aura, then tell me what you need.') } catch { speak('Please press the microphone once more to begin.') }
  }, [askAssistant, speak])

  const stopListening = useCallback(() => { listeningRef.current = false; recognitionRef.current?.stop(); setListening(false); speak('I stopped listening. Press the microphone whenever you need me.') }, [speak])

  useEffect(() => {
    Promise.all([fetch('/api/medications').then((r) => r.json()), fetch('/api/caretaker').then((r) => r.json())]).then(([m, memory]) => { setMedications(m.medications ?? []); setActions(memory.actions ?? []) }).catch(() => {})
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {})
    return () => { listeningRef.current = false; recognitionRef.current?.stop(); if (videoRef.current?.srcObject) (videoRef.current.srcObject as MediaStream).getTracks().forEach((track) => track.stop()) }
  }, [])

  useEffect(() => {
    const check = () => {
      const due = medications.find((medication) => medication.status === 'due' && !alarmedRef.current.has(medication.id))
      if (!due) return
      alarmedRef.current.add(due.id); setAlarm(due)
      speak(`Medication reminder. It is time for ${due.name}, ${due.dose}. ${due.instructions}.`)
      remember('medication_reminder', `${due.name} reminder sounded`)
      if ('Notification' in window && Notification.permission === 'granted') new Notification(`Medication reminder: ${due.name}`, { body: `${due.dose} — ${due.instructions}` })
    }
    check(); const timer = window.setInterval(check, 5000); return () => window.clearInterval(timer)
  }, [medications, remember, speak])

  async function markTaken(id: number) { const data = await (await fetch('/api/medications', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) })).json(); if (!data.medication) return; setMedications((items) => items.map((item) => item.id === id ? data.medication : item)); setAlarm(null); await remember('medication_taken', `${data.medication.name} marked taken`); speak(`Good job. ${data.medication.name} is recorded as taken. I told Priya.`) }
  async function addMedication(event: FormEvent) { event.preventDefault(); const data = await (await fetch('/api/medications', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) })).json(); if (data.medication) { setMedications((items) => [...items, data.medication]); setForm({ name: '', dose: '', time: '', instructions: '' }); speak(`I added ${data.medication.name} to your medication reminders.`); remember('medication_added', `${data.medication.name} at ${data.medication.time}`) } }
  async function sendText(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const input = event.currentTarget.elements.namedItem('message') as HTMLInputElement; const text = input.value; input.value = ''; await askAssistant(text) }
  function closeCamera() { if (videoRef.current?.srcObject) (videoRef.current.srcObject as MediaStream).getTracks().forEach((track) => track.stop()); setCameraOpen(false); remember('camera', 'Camera closed') }
  function runDemo(step: string) { setDemoStep(step); if (step === 'voice') { startListening(); return } if (step === 'camera') { openCamera(); return } if (step === 'reminder') { const medication = medications[0]; if (medication) { setAlarm(medication); speak(`Demo reminder. It is time for ${medication.name}, ${medication.dose}.`) } else speak('Demo reminder. It is time to take your medicine.') } }

  return <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#ffe8d8,transparent_35%),radial-gradient(circle_at_bottom_right,#dceeff,transparent_38%),#f8fbff] text-slate-900">
    <header className="border-b border-white/80 bg-white/75 backdrop-blur-xl"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4"><div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-cyan-500 text-white shadow-lg shadow-indigo-200"><HeartPulse /></div><div><div className="text-xl font-extrabold tracking-tight">AuraCare<span className="text-orange-500">+</span></div><div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">A kinder day, together</div></div></div><div className="flex rounded-full border border-slate-200 bg-white p-1 shadow-sm"><button onClick={() => setTab('home')} className={`rounded-full px-4 py-2 text-sm font-bold ${tab === 'home' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>My care</button><button onClick={() => setTab('demo')} className={`rounded-full px-4 py-2 text-sm font-bold ${tab === 'demo' ? 'bg-orange-500 text-white' : 'text-slate-500'}`}><Play className="mr-1 inline size-4" />Demo</button></div></div></header>
    {tab === 'demo' ? <section className="mx-auto max-w-5xl px-5 py-10"><div className="rounded-[2rem] bg-white p-7 shadow-xl shadow-indigo-100/60 lg:p-10"><div className="max-w-2xl"><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700"><Sparkles className="size-4" /> Competition demo mode</div><h1 className="text-4xl font-extrabold tracking-tight text-indigo-950">See AuraCare in action.</h1><p className="mt-3 text-lg text-slate-500">One tap shows how Aura listens, sees, reminds and keeps Priya informed.</p></div><div className="mt-9 grid gap-4 md:grid-cols-3"><button onClick={() => runDemo('voice')} className="rounded-3xl bg-indigo-600 p-6 text-left text-white shadow-lg shadow-indigo-200 transition hover:-translate-y-1"><Mic className="mb-8 size-8" /><div className="text-xl font-bold">Voice companion</div><div className="mt-2 text-sm text-indigo-100">Wake Aura with your voice and hear a warm response.</div></button><button onClick={() => runDemo('camera')} className="rounded-3xl bg-cyan-600 p-6 text-left text-white shadow-lg shadow-cyan-200 transition hover:-translate-y-1"><Camera className="mb-8 size-8" /><div className="text-xl font-bold">Camera check-in</div><div className="mt-2 text-sm text-cyan-100">Turn on a live camera check-in for the caretaker.</div></button><button onClick={() => runDemo('reminder')} className="rounded-3xl bg-orange-500 p-6 text-left text-white shadow-lg shadow-orange-200 transition hover:-translate-y-1"><Bell className="mb-8 size-8" /><div className="text-xl font-bold">Reminder with sound</div><div className="mt-2 text-sm text-orange-100">Hear a medication reminder and mark it complete.</div></button></div>{demoStep && <div className="mt-8 rounded-2xl bg-indigo-50 p-5 font-semibold text-indigo-900">Demo active: {demoStep === 'voice' ? 'Aura is listening for the wake word.' : demoStep === 'camera' ? 'Camera check-in is opening.' : 'The reminder sound is playing.'}</div>}</div></section> : <div className="mx-auto grid max-w-6xl gap-6 px-5 py-8 lg:grid-cols-[1.15fr_.85fr]"><section className="rounded-[2rem] border border-white bg-white/90 p-6 shadow-xl shadow-indigo-100/60 lg:p-10"><div className="flex items-center justify-between"><div><div className="text-sm font-extrabold uppercase tracking-[0.2em] text-indigo-500">Senior companion</div><h1 className="mt-2 text-3xl font-extrabold tracking-tight text-indigo-950">Good morning, Eleanor.</h1></div><div className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold ${listening ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}><span className={`size-2 rounded-full ${listening ? 'animate-pulse bg-green-500' : 'bg-slate-400'}`} />{listening ? 'Listening' : 'Ready'}</div></div><p className="mt-2 text-slate-500">Press the microphone, say “Aura,” and then tell me what you need.</p><div className="my-8 rounded-[1.7rem] bg-gradient-to-br from-indigo-50 via-white to-orange-50 p-7"><div className="flex gap-4"><div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white text-orange-500 shadow-sm"><Volume2 /></div><p className="text-2xl font-bold leading-relaxed text-indigo-950">{loading ? 'Let me think for a moment…' : message}</p></div>{transcript && <p className="mt-5 rounded-xl bg-white/70 px-4 py-3 text-sm text-slate-500">Heard: “{transcript}”</p>}</div><div className="flex flex-col items-center gap-4"><button onClick={() => listening ? stopListening() : startListening()} className={`group flex size-24 items-center justify-center rounded-full text-white shadow-xl transition hover:scale-105 focus:outline-none focus:ring-4 focus:ring-indigo-200 ${listening ? 'bg-gradient-to-br from-orange-500 to-rose-500' : 'bg-gradient-to-br from-indigo-600 to-cyan-500'}`} aria-label={listening ? 'Stop microphone' : 'Start microphone'}><span className="absolute size-32 rounded-full border-2 border-indigo-200/70" />{listening ? <MicOff className="relative size-9" /> : <Mic className="relative size-9" />}</button><div className="flex items-center gap-2 text-sm font-bold text-slate-500"><Mic className="size-4 text-indigo-600" />{listening ? 'Microphone is on' : 'Tap to speak with Aura'}</div></div><form onSubmit={sendText} className="mt-8 flex gap-2"><input name="message" aria-label="Type a message to Aura" placeholder="Or type a message…" className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none ring-indigo-200 focus:ring-4" /><button className="flex size-12 items-center justify-center rounded-2xl bg-indigo-600 text-white" aria-label="Send message"><Send /></button></form></section><aside className="flex flex-col gap-6"><section className="rounded-[2rem] bg-indigo-950 p-6 text-white shadow-xl shadow-indigo-200"><div className="flex items-center justify-between"><div><div className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-300">Today&apos;s care</div><h2 className="mt-2 text-2xl font-extrabold">Medication reminders</h2></div><Pill className="size-8 text-orange-300" /></div><div className="mt-5 flex flex-col gap-3">{medications.length ? medications.map((medication) => <div key={medication.id} className="flex items-center justify-between rounded-2xl bg-white/10 p-4"><div><div className="font-bold">{medication.name}</div><div className="text-sm text-indigo-200">{medication.time} · {medication.dose}</div></div>{medication.status === 'taken' ? <Check className="text-green-300" /> : <button onClick={() => markTaken(medication.id)} className="rounded-xl bg-orange-400 px-3 py-2 text-xs font-extrabold text-indigo-950">Taken</button>}</div>) : <div className="rounded-2xl bg-white/10 p-4 text-sm text-indigo-200">No medicines added yet.</div>}</div></section><section className="rounded-[2rem] border border-white bg-white/90 p-6 shadow-lg"><h2 className="text-xl font-extrabold text-indigo-950">Add a medication</h2><form onSubmit={addMedication} className="mt-4 grid gap-3"><input required placeholder="Medicine name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" /><div className="grid grid-cols-2 gap-3"><input required placeholder="Dose" value={form.dose} onChange={(e) => setForm({ ...form, dose: e.target.value })} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" /><input required type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" /></div><input required placeholder="Instructions" value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" /><button className="rounded-xl bg-orange-500 py-3 font-bold text-white">Add reminder</button></form></section></aside></div>}
    {cameraOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-indigo-950/70 p-5 backdrop-blur-sm"><div className="w-full max-w-2xl rounded-[2rem] bg-white p-5 shadow-2xl"><div className="mb-4 flex items-center justify-between"><div><div className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-600">Live check-in</div><h2 className="text-2xl font-extrabold text-indigo-950">Camera is on</h2></div><button onClick={closeCamera} className="rounded-full bg-slate-100 p-2" aria-label="Close camera"><X /></button></div><video ref={videoRef} autoPlay playsInline muted className="aspect-video w-full rounded-2xl bg-slate-950 object-cover" /><div className="mt-4 flex items-center gap-2 rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-700"><ShieldCheck className="size-5" /> Priya can see that your check-in is active.</div></div></div>}
    {calling && <div className="fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-4 rounded-2xl bg-indigo-950 px-5 py-4 text-white shadow-2xl"><div className="flex size-11 items-center justify-center rounded-full bg-green-500"><Phone /></div><div><div className="font-bold">Calling Priya</div><div className="text-xs text-indigo-200">{CARETAKER_PHONE} · AuraCare alert sent</div></div><Loader2 className="animate-spin text-cyan-300" /></div>}
    {alarm && <div className="fixed inset-0 z-40 flex items-center justify-center bg-indigo-950/60 p-5 backdrop-blur-sm"><div className="w-full max-w-md rounded-[2rem] bg-white p-7 text-center shadow-2xl"><div className="mx-auto flex size-16 items-center justify-center rounded-full bg-orange-100 text-orange-500"><Bell className="size-8" /></div><div className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-orange-500">Medication reminder</div><h2 className="mt-2 text-3xl font-extrabold text-indigo-950">Time for {alarm.name}</h2><p className="mt-2 text-slate-500">{alarm.dose} · {alarm.instructions}</p><button onClick={() => markTaken(alarm.id)} className="mt-6 w-full rounded-2xl bg-orange-500 py-4 font-extrabold text-white">I took it</button></div></div>}
  </main>
}
