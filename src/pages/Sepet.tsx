import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { CreditCard, LockKeyhole, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import KampanyaUygula from '../components/KampanyaUygula'
import { useAuth } from '../contexts/AuthContext'
import { useSepet } from '../contexts/SepetContext'
import { supabase } from '../lib/supabase'
import { akilliBirimGoster } from '../utils/birimDonusturucu'

const formatPrice = (value: number) => `${Math.max(0, value).toFixed(2)} TL`

export default function Sepet() {
  const { sepetItems, sepettenCikar, miktarGuncelle, toplamTutar, sepetiTemizle } = useSepet()
  const { user, musteriData } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [showPaymentIframe, setShowPaymentIframe] = useState(false)
  const [paymentToken, setPaymentToken] = useState('')
  const [uygulananKampanya, setUygulananKampanya] = useState<any>(null)
  const [kampanyaIndirimi, setKampanyaIndirimi] = useState(0)

  const kdvOrani = 0.20
  const araToplamTutar = toplamTutar / (1 + kdvOrani)
  const kdvTutari = toplamTutar - araToplamTutar
  const indirimliToplam = Math.max(0, toplamTutar - kampanyaIndirimi)

  async function handleOdemeYap() {
    if (!user || !musteriData) {
      toast.error('Ödeme yapmak için giriş yapmalısınız')
      navigate('/giris?redirect=/sepet')
      return
    }

    if (sepetItems.length === 0) {
      toast.error('Sepetiniz boş')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('paytr-payment', {
        body: {
          kampanyaKodu: uygulananKampanya?.kod || null,
        },
      })

      if (error) throw error

      const token = data?.token
      if (!token) {
        throw new Error(data?.error?.message || 'Ödeme tokeni alınamadı')
      }

      setPaymentToken(token)
      setShowPaymentIframe(true)
    } catch (error: any) {
      console.error('Ödeme başlatma hatası:', error)
      toast.error(error.message || 'Ödeme başlatılamadı')
    } finally {
      setLoading(false)
    }
  }

  if (showPaymentIframe && paymentToken) {
    return (
      <div className="shop-container py-6 sm:py-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-zinc-950">Güvenli ödeme</h1>
                <p className="mt-1 text-sm text-zinc-600">PayTR ödeme ekranı aşağıda açıldı.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPaymentIframe(false)
                  setPaymentToken('')
                }}
                className="shop-btn-secondary"
              >
                Ödemeyi iptal et
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
            <iframe
              src={`https://www.paytr.com/odeme/guvenli/${paymentToken}`}
              id="paytriframe"
              title="PayTR Ödeme"
              frameBorder="0"
              scrolling="no"
              className="h-[720px] w-full sm:h-[800px]"
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="shop-container py-6 sm:py-8">
      <div className="mb-6 rounded-lg bg-zinc-950 p-5 text-white shadow-lg sm:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="shop-eyebrow border-white/20 bg-white/10 text-orange-100">
              <ShoppingBag className="h-4 w-4" />
              Sepet
            </div>
            <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Sepetim</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-300 sm:text-base">
              Seçili sortileri kontrol edin, kampanyayı uygulayın ve ödemeye geçin.
            </p>
          </div>
          {sepetItems.length > 0 && (
            <button type="button" onClick={sepetiTemizle} className="shop-btn-secondary border-white/20 bg-white/10 text-white hover:bg-white hover:text-zinc-950">
              <Trash2 className="h-4 w-4" />
              Sepeti temizle
            </button>
          )}
        </div>
      </div>

      {sepetItems.length === 0 ? (
        <div className="flex min-h-[360px] flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center shadow-sm">
          <ShoppingBag className="h-16 w-16 text-zinc-300" />
          <h2 className="mt-4 text-2xl font-bold text-zinc-950">Sepetiniz boş</h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500">
            Ürünleri inceleyip size uygun sortiyi seçtiğinizde sepet burada hazır olacak.
          </p>
          <Link to="/urunler" className="shop-btn-primary mt-6">
            Alışverişe başla
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="min-w-0 space-y-3">
            {sepetItems.map((item) => {
              const minMiktar = item.min_siparis_miktari || 1
              const itemKey = `${item.urun_id}-${item.birim_turu}-${item.birim_adedi || 'na'}`

              return (
                <article key={itemKey} className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm sm:p-4">
                  <div className="grid gap-3 sm:grid-cols-[96px_minmax(0,1fr)]">
                    <div className="h-24 w-24 overflow-hidden rounded-lg bg-zinc-100">
                      {item.gorsel_url ? (
                        <img src={item.gorsel_url} alt={item.urun_adi} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-orange-100 text-2xl font-bold text-orange-700">
                          {item.urun_adi.charAt(0)}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <h2 className="break-words text-base font-bold text-zinc-950 sm:text-lg">{item.urun_adi}</h2>
                          <p className="mt-1 text-sm font-semibold text-zinc-500">
                            {akilliBirimGoster(item.birim_adedi || 1, item.birim_adedi_turu || item.birim_turu)}
                          </p>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="text-sm font-semibold text-zinc-500">Birim</p>
                          <p className="font-bold text-orange-700">{formatPrice(item.birim_fiyat)}</p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => miktarGuncelle(item.urun_id, item.birim_turu, Math.max(minMiktar, item.miktar - 1), item.birim_adedi)}
                            disabled={item.miktar <= minMiktar}
                            className="grid h-10 w-10 place-items-center rounded-lg border border-zinc-200 bg-white text-zinc-800 disabled:opacity-40"
                            aria-label="Miktarı azalt"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <input
                            type="number"
                            min={minMiktar}
                            value={item.miktar}
                            onChange={(e) => {
                              const val = Number(e.target.value)
                              if (!Number.isNaN(val) && val >= minMiktar) {
                                miktarGuncelle(item.urun_id, item.birim_turu, val, item.birim_adedi)
                              }
                            }}
                            onFocus={(e) => e.target.select()}
                            className="shop-input w-20 text-center font-bold"
                          />
                          <button
                            type="button"
                            onClick={() => miktarGuncelle(item.urun_id, item.birim_turu, item.miktar + 1, item.birim_adedi)}
                            className="grid h-10 w-10 place-items-center rounded-lg border border-zinc-200 bg-white text-zinc-800"
                            aria-label="Miktarı artır"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="flex items-center justify-between gap-4 sm:justify-end">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-400">Toplam</p>
                            <p className="text-lg font-bold text-zinc-950">{formatPrice(item.birim_fiyat * item.miktar)}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => sepettenCikar(item.urun_id, item.birim_turu, item.birim_adedi)}
                            className="grid h-10 w-10 place-items-center rounded-lg border border-red-100 bg-red-50 text-red-600 transition hover:bg-red-100"
                            aria-label="Sepetten çıkar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </section>

          <aside className="min-w-0">
            <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm lg:sticky lg:top-24">
              <div className="mb-5 flex items-center gap-2">
                <LockKeyhole className="h-5 w-5 text-orange-700" />
                <h2 className="text-xl font-bold text-zinc-950">Sipariş özeti</h2>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between gap-3 text-zinc-600">
                  <span>Ara toplam</span>
                  <span className="font-bold text-zinc-900">{formatPrice(araToplamTutar)}</span>
                </div>
                <div className="flex justify-between gap-3 text-zinc-600">
                  <span>KDV (%{(kdvOrani * 100).toFixed(0)})</span>
                  <span className="font-bold text-zinc-900">{formatPrice(kdvTutari)}</span>
                </div>
                {kampanyaIndirimi > 0 && (
                  <div className="flex justify-between gap-3 font-bold text-emerald-700">
                    <span>Kampanya indirimi</span>
                    <span>-{formatPrice(kampanyaIndirimi)}</span>
                  </div>
                )}
                <div className="border-t border-zinc-100 pt-4">
                  <div className="flex items-end justify-between gap-3">
                    <span className="text-base font-bold text-zinc-950">Toplam</span>
                    <span className="text-2xl font-bold text-zinc-950">{formatPrice(indirimliToplam)}</span>
                  </div>
                </div>
              </div>

              <div className="my-5">
                <KampanyaUygula
                  sepetTutari={toplamTutar}
                  onKampanyaUygula={(kampanya, indirim) => {
                    setUygulananKampanya(kampanya)
                    setKampanyaIndirimi(indirim)
                  }}
                />
              </div>

              {user ? (
                <button
                  type="button"
                  onClick={handleOdemeYap}
                  disabled={loading}
                  className="shop-btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Isleniyor...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-5 w-5" />
                      Ödemeye geç
                    </>
                  )}
                </button>
              ) : (
                <Link to="/giris?redirect=/sepet" className="shop-btn-primary w-full">
                  Giriş yapın
                </Link>
              )}

              <p className="mt-3 text-center text-xs leading-5 text-zinc-500">
                Ödeme PayTR üzerinden güvenli sayfada tamamlanır.
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
