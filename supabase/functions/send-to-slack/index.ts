const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { channelId, ...slackPayload } = body

    const webhookKey = channelId && channelId !== 'default'
      ? `SLACK_WEBHOOK_URL_${String(channelId).toUpperCase()}`
      : 'SLACK_WEBHOOK_URL'

    const webhookUrl = Deno.env.get(webhookKey) ?? Deno.env.get('SLACK_WEBHOOK_URL')

    if (!webhookUrl) {
      return new Response(JSON.stringify({ error: `${webhookKey} não configurado` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const slackResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackPayload),
    })

    if (!slackResponse.ok) {
      const text = await slackResponse.text()
      return new Response(JSON.stringify({ error: `Slack retornou ${slackResponse.status}: ${text}` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
