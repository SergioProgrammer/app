// src/lib/n8n.ts

type N8nNode = {
  name: string
  parameters?: Record<string, unknown>
  credentials?: Record<string, unknown>
  [key: string]: unknown
}

export async function createWorkflowFromTemplate({
  name,
  userId,
  automationId,
  gmailAddress,
  prompt,
}: {
  name: string
  userId: string
  automationId: string
  gmailAddress: string
  prompt: string
}) {
  const template = (await import(`@/workflows/${automationId}.json`)) as {
    nodes: N8nNode[]
    [key: string]: unknown
  }

  const workflow = {
    ...template,
    name: `${name} - ${automationId}`,
    active: true,
    nodes: template.nodes.map((node: N8nNode) => {
      // Ajustar nodo Supabase
      if (node.name === 'Get many rows') {
        return {
          ...node,
          parameters: {
            ...(node.parameters ?? {}),
            filters: {
              key: 'user_id',
              operation: 'equals',
              value: userId,
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

      // Inyectar prompt en el nodo de OpenAI
      if (node.name === 'Message a model') {
        return {
          ...node,
          parameters: {
            ...(node.parameters ?? {}),
            prompt, 
          },
        }
      }

      return node
    }),
  }

  const res = await fetch(`${process.env.N8N_URL}/api/v1/workflows`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.N8N_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(workflow),
  })

  if (!res.ok) {
    throw new Error(`Error creando workflow en n8n: ${await res.text()}`)
  }

  return res.json()
}
