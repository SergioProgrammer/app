// src/app/api/n8n/create/route.ts
import { NextResponse } from 'next/server'

type N8nNode = {
  id: string
  name: string
  type: string
  typeVersion: number
  position: [number, number]
  parameters?: Record<string, unknown>
  credentials?: Record<string, unknown>
  [key: string]: unknown
}

export async function POST(req: Request) {
  try {
    const { userId, automationId, gmailAddress, prompt, subject } = await req.json()

    console.log("➡️ Recibida petición para crear workflow", {
      userId,
      automationId,
      gmailAddress,
      subject,
      promptPreview: prompt?.slice(0, 80) + '...',
    })

    // Cargar el template base desde /src/workflows
    const template = (await import(`@/workflows/${automationId}.json`)) as {
      nodes: N8nNode[]
      connections?: Record<string, unknown>
      settings?: Record<string, unknown>
      [key: string]: unknown
    }

    // Clonar nodos y personalizar
    const nodes = (template.nodes ?? []).map((node: N8nNode) => {
      let updatedNode = { ...node }

      // Gmail Trigger y Send a message → credenciales fijas de n8n (para demo manual)
      if (node.name === 'Gmail Trigger' || node.name === 'Send a message') {
        updatedNode = {
          ...updatedNode,
          credentials: {
            gmailOAuth2: {
              id: "ggPKEdpztOgjSPdI", // id de tu credencial base
              name: "Gmail account", // nombre en n8n
            },
          },
        }
      }

      // Message a model → usar prompt + subject
      if (node.name === 'Message a model') {
        updatedNode = {
          ...updatedNode,
          parameters: {
            ...(node.parameters ?? {}),
            messages: {
              values: [
                {
                  role: 'system',
                  content: `Eres un asistente que responde emails. 
                  Usa este prompt como guía: "${prompt}". 
                  El asunto del email es: "${subject}". 
                  Responde de forma clara y profesional.`,
                },
                {
                  role: 'user',
                  content: "={{ $('Gmail Trigger').item.json.body }}", // el cuerpo real del email
                },
              ],
            },
          },
        }
      }

      return updatedNode
    })

    // Construcción final del workflow
    const workflow = {
      name: `${automationId} - ${gmailAddress}`,
      nodes,
      connections: template.connections ?? {},
      settings: template.settings ?? { executionOrder: 'v1' },
    }

    // Log del workflow
    console.log("🛠 Workflow a enviar a n8n:", JSON.stringify(workflow, null, 2))

    // Llamada a la API de n8n
    const res = await fetch(`${process.env.N8N_URL}/api/v1/workflows`, {
      method: 'POST',
      headers: {
        'X-N8N-API-KEY': process.env.N8N_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(workflow),
    })

    const text = await res.text()
    console.log("📩 Respuesta n8n:", text)

    if (!res.ok) {
      throw new Error(text)
    }

    const wf = JSON.parse(text)
    return NextResponse.json({ success: true, workflowId: wf.id })
  } catch (err) {
    console.error("❌ Error creando workflow en n8n:", err)
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    )
  }
}
