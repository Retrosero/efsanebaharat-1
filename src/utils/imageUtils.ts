
/**
 * Veritabanından gelen görsel URL'lerini temizler.
 * Özellikle localhost ile başlayan URL'leri göreceli yollara çevirir.
 */
export function getImageUrl(url: string | null | undefined): string {
    if (!url) return ''

    // Eğer URL http:// veya https:// ile başlıyorsa
    if (url.startsWith('http')) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321'

        if (url.startsWith('http://kong:8000')) {
            return url.replace('http://kong:8000', supabaseUrl)
        }

        if (url.startsWith('http://127.0.0.1/storage') || url.startsWith('http://localhost/storage')) {
            return url.replace(/^http:\/\/(127\.0\.0\.1|localhost)/, supabaseUrl)
        }

        if (url.startsWith('http://host.docker.internal:54321')) {
            return url.replace('http://host.docker.internal:54321', supabaseUrl)
        }

        // Localhost referanslarını temizle ve göreceli yol yap
        if (url.includes('localhost:5174') || url.includes('localhost:3000')) {
            return url.replace(/^https?:\/\/localhost:\d+/, '')
        }
    }

    return url
}
