import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { MONEYFORWARD_IMPORT_PROMPT, normalizeMoneyforwardRows, parseOpenAIJsonPayload } from '@/lib/moneyforward-import'

const OPENAI_API_URL = 'https://api.openai.com/v1/responses'
const IS_PRODUCTION = process.env.NODE_ENV === 'production'

class ImportRouteError extends Error {
  code: string
  status: number

  constructor(code: string, message: string, status = 500) {
    super(message)
    this.code = code
    this.status = status
  }
}

function getMimeType(fileType: string) {
  if (fileType && fileType.startsWith('image/')) return fileType
  return 'image/png'
}

async function fileToDataUrl(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer())
  return `data:${getMimeType(file.type)};base64,${buffer.toString('base64')}`
}

function extractOutputText(payload: unknown) {
  if (
    typeof payload === 'object'
    && payload !== null
    && 'output_text' in payload
    && typeof payload.output_text === 'string'
    && payload.output_text.trim()
  ) {
    return payload.output_text
  }

  const outputs = (
    typeof payload === 'object'
    && payload !== null
    && 'output' in payload
    && Array.isArray(payload.output)
  ) ? payload.output : []
  for (const output of outputs) {
    const contents = (
      typeof output === 'object'
      && output !== null
      && 'content' in output
      && Array.isArray(output.content)
    ) ? output.content : []
    for (const content of contents) {
      if (
        typeof content === 'object'
        && content !== null
        && 'text' in content
        && typeof content.text === 'string'
        && content.text.trim()
      ) {
        return content.text
      }
    }
  }

  return ''
}

async function requestMoneyforwardRows(imageDataUrl: string, model: 'gpt-4.1-mini' | 'gpt-4.1') {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new ImportRouteError('missing_api_key', 'OPENAI_API_KEY is not configured', 500)
  }

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: MONEYFORWARD_IMPORT_PROMPT },
            { type: 'input_image', image_url: imageDataUrl },
          ],
        },
      ],
      max_output_tokens: 800,
      text: {
        format: {
          type: 'json_schema',
          name: 'moneyforward_category_amounts',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    category: { type: 'string' },
                    amount: { type: 'number' },
                  },
                  required: ['category', 'amount'],
                },
              },
            },
            required: ['items'],
          },
        },
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new ImportRouteError('openai_request_failed', `OpenAI request failed: ${response.status} ${errorText}`, 502)
  }

  const payload = await response.json()
  const text = extractOutputText(payload)
  if (!text) {
    throw new ImportRouteError('empty_model_output', 'OpenAI returned empty output', 502)
  }
  const rows = normalizeMoneyforwardRows(parseOpenAIJsonPayload(text))
  return rows
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'ログインが必要です', error_code: 'unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: '画像ファイルを選択してください', error_code: 'missing_file' }, { status: 400 })
  }

  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: '画像ファイルを選択してください', error_code: 'invalid_file_type' }, { status: 400 })
  }

  if (file.size < 30_000) {
    return NextResponse.json({ error: 'カテゴリ金額を認識できませんでした', error_code: 'image_too_small' }, { status: 400 })
  }

  try {
    const imageDataUrl = await fileToDataUrl(file)
    let rows = await requestMoneyforwardRows(imageDataUrl, 'gpt-4.1-mini')

    if (!rows.length) {
      rows = await requestMoneyforwardRows(imageDataUrl, 'gpt-4.1')
    }

    if (!rows.length) {
      return NextResponse.json({ error: 'カテゴリ金額を認識できませんでした', error_code: 'no_categories_detected' }, { status: 422 })
    }

    return NextResponse.json({ items: rows })
  } catch (error) {
    const routeError = error instanceof ImportRouteError
      ? error
      : new ImportRouteError('unknown_import_error', error instanceof Error ? error.message : 'Unknown import error', 500)

    console.error('Moneyforward import failed:', {
      code: routeError.code,
      message: routeError.message,
      stack: routeError.stack,
    })

    return NextResponse.json(
      {
        error: IS_PRODUCTION ? 'カテゴリ金額を認識できませんでした' : routeError.message,
        error_code: routeError.code,
      },
      { status: routeError.status }
    )
  }
}
