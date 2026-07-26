import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Building2, Info, UserPlus } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function Kayit() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    ad: '',
    soyad: '',
    telefon: '',
    adres: '',
    musteri_tipi: 'musteri',
    vergi_dairesi: '',
    vergi_no: '',
    bayi_unvani: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { signUp } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const result = await signUp(formData.email, formData.password, formData)

      if (result.error) {
        if (
          result.error.message.includes('already registered') ||
          result.error.message.includes('User already registered') ||
          result.error.message.includes('already been registered')
        ) {
          throw new Error('Bu e-posta adresi zaten kayıtlı. Lütfen giriş yapın veya farklı bir e-posta kullanın.')
        }
        throw result.error
      }

      if (result.data?.user) {
        if (!result.data.user.identities || result.data.user.identities.length === 0) {
          throw new Error('Bu e-posta adresi zaten kayıtlı. Lütfen giriş yapın veya farklı bir e-posta kullanın.')
        }

        alert('Kayıt başarılı. Hesabınız oluşturuldu ve e-posta adresinize doğrulama linki gönderildi.')
        navigate('/giris')
      } else {
        throw new Error('Kayıt işlemi tamamlanamadı. Lütfen tekrar deneyin.')
      }
    } catch (err: any) {
      console.error('Kayıt hatası:', err)
      setError(err.message || 'Kayıt olurken bir hata oluştu. Lütfen tekrar deneyin.')
    } finally {
      setLoading(false)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  return (
    <div className="shop-container py-8 sm:py-12">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg">
        <div className="bg-zinc-950 p-5 text-white sm:p-8">
          <div className="shop-eyebrow border-white/20 bg-white/10 text-orange-100">
            <UserPlus className="h-4 w-4" />
            Yeni hesap
          </div>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Kayıt ol</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300">
            Müşteri hesabı ile hızlı sipariş verebilir, bayi başvurusu için gerekli bilgileri tek formda iletebilirsiniz.
          </p>
        </div>

        <div className="p-5 sm:p-8">
          <div className="mb-6 flex gap-3 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
            <Info className="mt-0.5 h-5 w-5 shrink-0" />
            <p>Kayıt sonrasında e-posta adresinize doğrulama linki gönderilir. Gerekli durumlarda yönetici hesabınızı kontrol edebilir.</p>
          </div>

          {error && <div className="mb-6 rounded-lg border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Ad" name="ad" value={formData.ad} onChange={handleChange} required />
              <Field label="Soyad" name="soyad" value={formData.soyad} onChange={handleChange} required />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="E-posta" name="email" type="email" value={formData.email} onChange={handleChange} required />
              <Field label="Şifre" name="password" type="password" value={formData.password} onChange={handleChange} required minLength={6} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Telefon" name="telefon" type="tel" value={formData.telefon} onChange={handleChange} />
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-zinc-700">Müşteri tipi</span>
                <select name="musteri_tipi" value={formData.musteri_tipi} onChange={handleChange} className="shop-input">
                  <option value="musteri">Bireysel Müşteri</option>
                  <option value="bayi">Bayi</option>
                </select>
              </label>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-zinc-700">
                Adres {formData.musteri_tipi === 'bayi' && <span className="text-red-500">*</span>}
              </span>
              <textarea
                name="adres"
                value={formData.adres}
                onChange={handleChange}
                rows={4}
                required={formData.musteri_tipi === 'bayi'}
                className="shop-input resize-y"
              />
            </label>

            {formData.musteri_tipi === 'bayi' && (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                <div className="mb-4 flex items-center gap-2 border-b border-zinc-200 pb-3 text-sm font-bold text-zinc-950">
                  <Building2 className="h-4 w-4 text-orange-700" />
                  Bayi bilgileri
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <Field label="Bayi unvanı" name="bayi_unvani" value={formData.bayi_unvani} onChange={handleChange} required={formData.musteri_tipi === 'bayi'} />
                  </div>
                  <Field label="Vergi dairesi" name="vergi_dairesi" value={formData.vergi_dairesi} onChange={handleChange} required={formData.musteri_tipi === 'bayi'} />
                  <Field label="Vergi numarası" name="vergi_no" value={formData.vergi_no} onChange={handleChange} required={formData.musteri_tipi === 'bayi'} />
                </div>
              </div>
            )}

            <button type="submit" disabled={loading} className="shop-btn-primary w-full">
              {loading ? (
                <>
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Kayıt yapılıyor...
                </>
              ) : (
                <>
                  <UserPlus className="h-5 w-5" />
                  Kayıt ol
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-zinc-600">
            Zaten hesabınız var mı? <Link to="/giris" className="font-bold text-orange-700 hover:text-orange-800">Giriş yap</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

interface FieldProps {
  label: string
  name: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  type?: string
  required?: boolean
  minLength?: number
}

function Field({ label, name, value, onChange, type = 'text', required, minLength }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-zinc-700">{label}</span>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        minLength={minLength}
        className="shop-input"
      />
    </label>
  )
}
