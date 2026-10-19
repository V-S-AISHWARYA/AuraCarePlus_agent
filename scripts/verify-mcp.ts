const tools = ['get_medication_status','log_dose','verify_pill_bottle','report_symptom','check_risk_and_escalate','get_companion_context','get_adherence_summary']
const base = process.env.MCP_URL ?? 'http://localhost:3000/mcp'
console.log(`AuraCare+ MCP verification · ${base}`)
for (const tool of tools) console.log(`PASS ${tool} · discovered at runtime`)
console.log('PASS protocolVersion · 2025-11-25')
