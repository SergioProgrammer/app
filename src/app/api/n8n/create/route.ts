import { NextResponse } from 'next/server'

type N8nNode = {
  name: string
  parameters?: Record<string, unknown>
  credentials?: Record<string, unknown>
  [key: string]: unknown
}

export async function POST(req: Request) {
  try {
    const { userId, automationId, gmailAddress, prompt } = await req.json()

    // Cargamos el workflow base desde /src/workflows
    const template = (await import(`@/workflows/${automationId}.json`)) as {
      nodes: N8nNode[]
      [key: string]: unknown
    }

    // Clonamos y adaptamos nodos
    const workflow = {
      ...template,
      name: `${automationId} - ${gmailAddress}`,
      active: true,
      nodes: template.nodes.map((node: N8nNode) => {
        // Ajustar nodo Supabase
        if (node.name === 'Get many rows') {
          return {
            ...node,
            parameters: {
              ...(node.parameters ?? {}),
              filters: {
                user_id: userId,
                automation_id: automationId,
              },
            },
          }
        }

        // Ajustar credenciales de Gmail
        if (node.name === 'Gmail Trigger' || node.name === 'Send Email') {
          return {
            ...node,
            credentials: {
              gmailOAuth2: {
                id: gmailAddress,
                name: gmailAddress,
              },
            },
          }
        }

        // Inyectar el prompt del usuario en el nodo de OpenAI
        if (node.name === 'Message a model') {
          return {
            ...node,
            parameters: {
              ...(node.parameters ?? {}),
              prompt, // 🔥 aquí se mete el prompt dinámico
            },
          }
        }

        return node
      }),
    }

    // Llamada a la API de n8n
    const res = await fetch(`${process.env.N8N_URL}/api/v1/workflows`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.N8N_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(workflow),
    })

    if (!res.ok) {
      throw new Error(await res.text())
    }

    const wf = await res.json()
    return NextResponse.json({ success: true, workflowId: wf.id })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    )
  }
}
