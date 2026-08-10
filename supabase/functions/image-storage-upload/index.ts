import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const allowedBuckets = new Set([
  'urun-gorselleri',
  'banner-gorselleri',
  'kampanya-banners',
  'banners',
  'site-assets',
])

const mimeExtensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function dataUrlToFile(imageData: string) {
  const match = imageData.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/)
  if (!match) throw new Error('Desteklenmeyen görsel biçimi')

  const bytes = Uint8Array.from(atob(match[2].replace(/\s/g, '')), (char) => char.charCodeAt(0))
  if (bytes.byteLength > 8 * 1024 * 1024) throw new Error('Görsel en fazla 8 MB olabilir')

  return { bytes, mimeType: match[1], extension: mimeExtensions[match[1]] }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ success: false, error: { message: 'Yalnızca POST desteklenir' } }, 405)

  try {
    const projectUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const authorization = request.headers.get('Authorization')

    if (!projectUrl || !anonKey || !serviceRoleKey) throw new Error('Supabase işlev ortamı yapılandırılmamış')
    if (!authorization?.startsWith('Bearer ')) return json({ success: false, error: { message: 'Oturum gerekli' } }, 401)

    const userClient = createClient(projectUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) return json({ success: false, error: { message: 'Geçersiz oturum' } }, 401)

    const adminClient = createClient(projectUrl, serviceRoleKey)
    const { data: admin, error: adminError } = await adminClient
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .eq('aktif', true)
      .maybeSingle()
    if (adminError) throw adminError
    if (!admin) return json({ success: false, error: { message: 'Bu işlem için yönetici yetkisi gerekli' } }, 403)

    const { imageData, imageUrl, bucketName, fileName } = await request.json()
    if (!allowedBuckets.has(bucketName)) return json({ success: false, error: { message: 'Geçersiz görsel alanı' } }, 400)

    let bytes: Uint8Array
    let mimeType: string
    let extension: string
    if (typeof imageData === 'string') {
      ({ bytes, mimeType, extension } = dataUrlToFile(imageData))
    } else if (typeof imageUrl === 'string' && /^https?:\/\//i.test(imageUrl)) {
      const imageResponse = await fetch(imageUrl)
      if (!imageResponse.ok) throw new Error('Görsel adresinden dosya indirilemedi')
      mimeType = imageResponse.headers.get('content-type')?.split(';')[0].toLowerCase() || ''
      extension = mimeExtensions[mimeType]
      if (!extension) throw new Error('URL yalnızca JPEG, PNG, WebP veya GIF görseli olmalıdır')
      bytes = new Uint8Array(await imageResponse.arrayBuffer())
      if (bytes.byteLength > 8 * 1024 * 1024) throw new Error('Görsel en fazla 8 MB olabilir')
    } else {
      return json({ success: false, error: { message: 'Bir görsel dosyası veya URL gerekli' } }, 400)
    }

    const { data: bucket } = await adminClient.storage.getBucket(bucketName)
    if (!bucket) {
      const { error } = await adminClient.storage.createBucket(bucketName, { public: true })
      if (error && !/already exists/i.test(error.message)) throw error
    }

    const safeBaseName = typeof fileName === 'string'
      ? fileName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80)
      : 'image'
    const path = `uploads/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}-${safeBaseName}.${extension}`
    const { error: uploadError } = await adminClient.storage.from(bucketName).upload(path, bytes, {
      contentType: mimeType,
      upsert: false,
    })
    if (uploadError) throw uploadError

    const { data: { publicUrl } } = adminClient.storage.from(bucketName).getPublicUrl(path)
    return json({ success: true, data: { publicUrl, path, bucketName } })
  } catch (error) {
    console.error('Image upload failed:', error)
    const message = error instanceof Error ? error.message : 'Görsel yüklenemedi'
    return json({ success: false, error: { message } }, 500)
  }
})
