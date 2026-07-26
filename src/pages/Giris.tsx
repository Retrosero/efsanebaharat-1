import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { LogIn, ShieldCheck, Store, User } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

type GirisTipi = 'musteri' | 'bayi'

export default function Giris() {
  const [girisTipi, setGirisTipi] = useState<GirisTipi>('musteri')
  const [bayiiKodu, setBayiiKodu] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { signIn, signOut } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const normalizedEmail = email.trim().toLowerCase()

      if (girisTipi === 'bayi') {
        const normalizedBayiiKodu = bayiiKodu.trim().toUpperCase()
        if (!normalizedBayiiKodu) throw new Error('Bayii kodu giriniz')

        const result = await signIn(normalizedEmail, password)
        if (result.error) throw result.error

        const userId = result.data.user?.id
        if (!userId) throw new Error('Oturum başlatılamadı')

        const { data: bayiData, error: bayiError } = await supabase
          .from('bayiler')
          .select('*')
          .eq('kullanici_id', userId)
          .eq('bayii_kodu', normalizedBayiiKodu)
          .eq('email', normalizedEmail)
          .maybeSingle()

        if (bayiError) throw new Error('Bayi bilgileri kontrol edilemedi')
        if (!bayiData) {
          await signOut()
          throw new Error('Bayii kodu veya email hatalı. Lütfen bilgilerinizi kontrol edin.')
        }
        if (!bayiData.aktif) {
          await signOut()
          throw new Error('Bayi hesabı pasif durumda. Lütfen yönetici ile iletişime geçin.')
        }

        toast.success(`Hoş geldiniz, ${bayiData.bayi_adi}`)
        navigate('/bayi-dashboard')
      } else {
        const { error } = await signIn(normalizedEmail, password)
        if (error) throw error

        navigate(searchParams.get('redirect') || '/')
      }
    } catch (err: any) {
      console.error('Giriş hatası:', err)
      if (err.message?.includes('Email not confirmed')) {
        setError('E-posta adresiniz henüz onaylanmamış. Lütfen e-postanızdaki doğrulama linkini kontrol edin.')
        toast.error('E-posta onayı gerekli')
      } else {
        setError(err.message || 'Giriş yapılırken bir hata oluştu')
        toast.error(err.message || 'Giriş başarısız')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="shop-container py-8 sm:py-12">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg lg:grid-cols-[0.95fr_1.05fr]">
        <section className="relative hidden min-h-[520px] overflow-hidden bg-zinc-950 p-8 text-white lg:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_25%,rgba(251,146,60,0.28),transparent_28rem),linear-gradient(135deg,#064e3b,#18181b_58%,#7c2d12)]" />
          <div className="relative flex h-full flex-col justify-between">
            <div>
              <div className="shop-eyebrow border-white/20 bg-white/10 text-orange-100">
                <ShieldCheck className="h-4 w-4" />
                Güvenli hesap erişimi
              </div>
              <h1 className="mt-5 text-4xl font-bold leading-tight">Efsane Baharat hesabınızla hızlı sipariş verin.</h1>
              <p className="mt-4 text-sm leading-7 text-zinc-200">
                Müşteri ve bayi hesapları Supabase Auth ile doğrulanır; sepetiniz ve fiyatlarınız hesabınıza göre hazırlanır.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-white/10 p-4 font-bold">Bayi fiyatları</div>
              <div className="rounded-lg bg-white/10 p-4 font-bold">Sipariş takibi</div>
            </div>
          </div>
        </section>

        <section className="p-5 sm:p-8">
          <div className="mb-7 text-center sm:text-left">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-lg bg-emerald-800 text-white sm:mx-0">
              <LogIn className="h-6 w-6" />
            </div>
            <h2 className="text-3xl font-bold text-zinc-950">Giriş yap</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-500">Hesabınıza girin ve alışverişe kaldığınız yerden devam edin.</p>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-2 rounded-lg bg-zinc-100 p-1">
            <button
              type="button"
              onClick={() => setGirisTipi('musteri')}
              className={`flex min-h-[42px] items-center justify-center gap-2 rounded-md text-sm font-bold transition ${girisTipi === 'musteri' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-600'}`}
            >
              <User className="h-4 w-4" />
              Müşteri
            </button>
            <button
              type="button"
              onClick={() => setGirisTipi('bayi')}
              className={`flex min-h-[42px] items-center justify-center gap-2 rounded-md text-sm font-bold transition ${girisTipi === 'bayi' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-600'}`}
            >
              <Store className="h-4 w-4" />
              Bayi
            </button>
          </div>

          {error && <div className="mb-5 rounded-lg border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            {girisTipi === 'bayi' && (
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-zinc-700">Bayii kodu *</span>
                <input
                  type="text"
                  value={bayiiKodu}
                  onChange={(e) => setBayiiKodu(e.target.value.toUpperCase())}
                  required
                  className="shop-input font-mono"
                  placeholder="BAY123456"
                  minLength={5}
                />
              </label>
            )}

            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-zinc-700">E-posta</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="shop-input" placeholder="ornek@email.com" />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-zinc-700">Şifre</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="shop-input" placeholder="********" />
            </label>

            <button type="submit" disabled={loading} className="shop-btn-primary w-full">
              {loading ? (
                <>
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Giriş yapılıyor...
                </>
              ) : (
                <>
                  {girisTipi === 'bayi' ? <Store className="h-5 w-5" /> : <User className="h-5 w-5" />}
                  {girisTipi === 'bayi' ? 'Bayi olarak giriş yap' : 'Giriş yap'}
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-zinc-600">
            {girisTipi === 'musteri' ? (
              <p>
                Hesabınız yok mu? <Link to="/kayit" className="font-bold text-orange-700 hover:text-orange-800">Kayıt ol</Link>
              </p>
            ) : (
              <p>Bayi hesabı için yönetici tarafından oluşturulan bilgilerle giriş yapın.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
