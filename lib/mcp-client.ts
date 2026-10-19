export type McpToolCall = { name: string; input: unknown; output: unknown; durationMs: number }
export const MCP_CONFIG = { serverUrl: '/mcp', protocolVersion: '2025-11-25' }
export async function discoverMcpTools() { const response = await fetch(MCP_CONFIG.serverUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }) }); return response.json() }
