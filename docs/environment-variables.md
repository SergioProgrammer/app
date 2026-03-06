# Environment Variables

Create a `.env.local` file with all required variables.

## Supabase Core

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Server-side only, NEVER expose in client code
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... # Client-side safe
```

## Storage Buckets

```bash
SUPABASE_ETIQUETAS_BUCKET=etiquetas_final
SUPABASE_ALBARANES_BUCKET=albaranes_finales
SUPABASE_ALBARANES_FOLDER=ruta/dentro/del/bucket
NEXT_PUBLIC_SUPABASE_ETIQUETAS_BUCKET=etiquetas_final
```

## AI Services

```bash
GOOGLE_VISION_CREDENTIALS_JSON={"type":"service_account",...}
# OR base64 encoded:
GOOGLE_VISION_CREDENTIALS_B64=base64_encoded_json

OPENAI_API_KEY=sk-...
OPENAI_VISION_MODEL=gpt-4o-mini  # Default model for order parsing
```

## N8N Automation

```bash
N8N_URL=https://your-n8n-instance.com
N8N_API_KEY=...
```

## Optional

```bash
LABEL_TEMPLATE_PATH=/custom/path/to/template.pdf
LABEL_FONT_PATH=/custom/path/to/font.ttf
```
