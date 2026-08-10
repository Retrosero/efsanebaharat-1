// Aktif XML kaynaklarını arka planda içe aktaran Supabase Edge Function.
// Bu fonksiyon pg_cron tarafından çağrılır; tarayıcının açık kalmasına gerek yoktur.

type ImportSource = {
  id: string
  url: string
  update_interval_minutes: number
  last_imported_at: string | null
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })

const isDue = (source: ImportSource, now: number) => {
  if (!source.last_imported_at) return true
  const lastImport = new Date(source.last_imported_at).getTime()
  return !Number.isFinite(lastImport) || now - lastImport >= source.update_interval_minutes * 60_000
}

Deno.serve(async (request) => {
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')

  if (!serviceRoleKey || !supabaseUrl) {
    return json({ error: 'Sunucu Supabase ayarları eksik.' }, 500)
  }

  // Cron isteği yalnızca service-role anahtarıyla kabul edilir.
  if (request.headers.get('authorization') !== `Bearer ${serviceRoleKey}`) {
    return json({ error: 'Yetkisiz istek.' }, 401)
  }

  const headers = {
    Authorization: `Bearer ${serviceRoleKey}`,
    apikey: serviceRoleKey,
    'Content-Type': 'application/json',
  }

  try {
    const sourceResponse = await fetch(
      `${supabaseUrl}/rest/v1/xml_import_sources?is_active=eq.true&select=id,url,update_interval_minutes,last_imported_at`,
      { headers },
    )
    if (!sourceResponse.ok) throw new Error(`Kaynaklar okunamadı (${sourceResponse.status}).`)

    const allSources = (await sourceResponse.json()) as ImportSource[]
    const now = Date.now()
    const dueSources = allSources.filter((source) => isDue(source, now))
    const results: Array<Record<string, unknown>> = []

    for (const source of dueSources) {
      let offset = 0
      let totalInXml: number | null = null
      let parsed = 0

      // İçe aktarıcı büyük XML'leri parça parça işler. Güvenlik için üst sınır konur.
      for (let batch = 0; batch < 100 && (totalInXml === null || offset < totalInXml); batch += 1) {
        const importResponse = await fetch(`${supabaseUrl}/functions/v1/xml-product-import`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ xmlUrl: source.url, dryRun: false, limit: 500, offset }),
        })
        const result = await importResponse.json().catch(() => ({})) as Record<string, unknown>
        if (!importResponse.ok) throw new Error(`İçe aktarma başarısız: ${String(result.error || importResponse.status)}`)

        const batchParsed = Number(result.parsed || 0)
        totalInXml = Number(result.totalInXml || 0)
        parsed += batchParsed
        if (batchParsed === 0) break
        offset += batchParsed
      }

      const updateResponse = await fetch(
        `${supabaseUrl}/rest/v1/xml_import_sources?id=eq.${encodeURIComponent(source.id)}`,
        { method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify({ last_imported_at: new Date().toISOString() }) },
      )
      if (!updateResponse.ok) throw new Error(`Son güncelleme zamanı kaydedilemedi (${updateResponse.status}).`)

      results.push({ sourceId: source.id, sourceUrl: source.url, parsed, totalInXml })
    }

    return json({ processed: results.length, skipped: allSources.length - dueSources.length, results })
  } catch (error) {
    console.error('XML otomatik güncelleme hatası:', error)
    return json({ error: error instanceof Error ? error.message : 'Bilinmeyen hata.' }, 500)
  }
})
