import { NextRequest } from "next/server"

const LOCAL_PRINT_AGENT_URL =
  process.env.LOCAL_PRINT_AGENT_URL ||
  process.env.NEXT_PUBLIC_LOCAL_PRINT_AGENT_URL ||
  "http://127.0.0.1:7310"

const LOCAL_PRINT_AGENT_TOKEN =
  process.env.LOCAL_PRINT_AGENT_TOKEN ||
  process.env.NEXT_PUBLIC_LOCAL_PRINT_AGENT_TOKEN ||
  ""

function buildTargetUrl(pathParts: string[], search: string): string {
  const base = LOCAL_PRINT_AGENT_URL.replace(/\/$/, "")
  const path = pathParts.join("/")
  return `${base}/${path}${search || ""}`
}

async function proxyToAgent(request: NextRequest, pathParts: string[]): Promise<Response> {
  const targetUrl = buildTargetUrl(pathParts, request.nextUrl.search)

  const headers = new Headers(request.headers)
  headers.delete("host")
  headers.delete("connection")
  headers.delete("content-length")
  if (LOCAL_PRINT_AGENT_TOKEN) {
    headers.set("X-Primepos-Token", LOCAL_PRINT_AGENT_TOKEN)
  }

  const method = request.method.toUpperCase()
  const hasBody = method !== "GET" && method !== "HEAD"
  const bodyBuffer = hasBody ? await request.arrayBuffer() : undefined
  const body = bodyBuffer && bodyBuffer.byteLength > 0 ? bodyBuffer : undefined

  let response: Response
  try {
    response = await fetch(targetUrl, {
      method,
      headers,
      body,
    })
  } catch (error: any) {
    const reason = error?.cause?.code || error?.code || "FETCH_FAILED"
    return new Response(
      JSON.stringify({
        detail: "Local Print Agent is unreachable",
        target: targetUrl,
        reason,
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }
    )
  }

  const responseHeaders = new Headers(response.headers)
  responseHeaders.delete("content-encoding")
  responseHeaders.delete("content-length")

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  })
}

export async function GET(request: NextRequest, context: { params: { path: string[] } }) {
  const { path } = context.params
  return proxyToAgent(request, path || [])
}

export async function POST(request: NextRequest, context: { params: { path: string[] } }) {
  const { path } = context.params
  return proxyToAgent(request, path || [])
}

export async function PUT(request: NextRequest, context: { params: { path: string[] } }) {
  const { path } = context.params
  return proxyToAgent(request, path || [])
}

export async function PATCH(request: NextRequest, context: { params: { path: string[] } }) {
  const { path } = context.params
  return proxyToAgent(request, path || [])
}

export async function DELETE(request: NextRequest, context: { params: { path: string[] } }) {
  const { path } = context.params
  return proxyToAgent(request, path || [])
}

export async function OPTIONS() {
  return new Response(null, { status: 204 })
}
