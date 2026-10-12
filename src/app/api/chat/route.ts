import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { prompt, agentId, endpoint, model } = await req.json();

    if (!prompt || !endpoint || !model) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const startTime = Date.now();

    // Proxy request to local model (e.g., Ollama)
    const response = await fetch(`${endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Model server responded with ${response.status}`);
    }

    const data = await response.json();
    const responseTime = Date.now() - startTime;

    return NextResponse.json({
      content: data.response,
      responseTime,
      agentId,
    });
  } catch (error: any) {
    console.error('Proxy error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
