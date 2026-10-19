import { z } from 'zod'

export const unsafeRefusal = "I can't help with that. Let me ask your care team."
export const schemas = {
  get_medication_status: z.object({ date: z.string().optional() }),
  log_dose: z.object({ medicine: z.string().min(1), status: z.enum(['taken','snoozed','skipped']), timestamp: z.string().optional() }),
  verify_pill_bottle: z.object({ imageBase64: z.string().min(8) }),
  report_symptom: z.object({ symptom: z.enum(['dizziness','confusion','fall','fine']), timestamp: z.string().optional() }),
  check_risk_and_escalate: z.object({ reason: z.string().optional() }),
  get_companion_context: z.object({}),
  get_adherence_summary: z.object({ days: z.number().int().min(1).max(30).default(7) }),
}
export const toolNames = Object.keys(schemas)
export function normalize(value: string) { return value.toLowerCase().replace(/[^a-z0-9]/g, '') }
export function prescriptionMatches(scan: { drug_name: string; dose: string; instructions: string }, prescription: { drug_name: string; dose: string; instructions: string }) {
  return normalize(scan.drug_name) === normalize(prescription.drug_name) && normalize(scan.dose) === normalize(prescription.dose) && normalize(scan.instructions) === normalize(prescription.instructions)
}
export function isUnsafeIntent(prompt: string) { return /double my dose|can i skip|do i have a heart problem|what should i take for|change my dose|diagnose me|is this a heart attack|should i stop|take extra|more medicine/i.test(prompt) }
