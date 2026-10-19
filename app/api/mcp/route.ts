import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const response = await fetch(new URL('/mcp', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(process.env.MCP_AUTH_TOKEN ? { authorization: `Bearer ${process.env.MCP_AUTH_TOKEN}` } : {}),
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
      cache: 'no-store',
    })

    const data = await response.json()
    const tools = Array.isArray(data?.result?.tools) ? data.result.tools : []
    return NextResponse.json({
      connected: response.ok,
      endpoint: '/mcp',
      protocol: 'Model Context Protocol 2025-11-25',
      transport: 'JSON-RPC over HTTP',
      requestedMethod: 'tools/list',
      authConfigured: Boolean(process.env.MCP_AUTH_TOKEN),
      tools: tools.map((tool: { name?: string; description?: string }) => ({ name: tool.name, description: tool.description })),
    })
  } catch {
    return NextResponse.json({ connected: false, endpoint: '/mcp', protocol: 'Model Context Protocol 2025-11-25', transport: 'JSON-RPC over HTTP', requestedMethod: 'tools/list', authConfigured: Boolean(process.env.MCP_AUTH_TOKEN), tools: [], error: 'The configured MCP endpoint could not be reached.' }, { status: 200 })
  }
}
