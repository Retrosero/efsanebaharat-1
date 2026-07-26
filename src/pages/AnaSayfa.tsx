import { useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ShieldCheck, ShoppingBag, Sparkles, Truck } from 'lucide-react'
import CanliDestekWidget from '../components/CanliDestekWidget'
import UrunKart from '../components/UrunKart'
import { supabase } from '../lib/supabase'
import { getImageUrl } from '../utils/imageUtils'
import { fetchInBatches } from '../utils/supabaseBatch'

const pageSize = 4

export default function AnaSayfa() {
  const [banners, setBanners] = useState<any[]>([])
  const [oneCikanUrunler, setOneCikanUrunler] = useState<any[]>([])
  const [enCokSatanlar, setEnCokSatanlar] = useState<any[]>([])
  const [yeniEklenenler, setYeniEklenenler] = useState<any[]>([])
  const [markalar, setMarkalar] = useState<any[]>([])
  const [currentBanner, setCurrentBanner] = useState(0)
  const [bestsellerPage, setBestsellerPage] = useState(0)
  const [newProductsPage, setNewProductsPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    if (hasLoadedRef.current) return

    async function loadUrunlerByIds(urunIds: string[], setter: Dispatch<SetStateAction<any[]>>) {
      const { data: urunData } = await supabase
        .from('urunler')
        .select('*')
        .in('id', urunIds)
        .eq('aktif_durum', true)

      if (!urunData || urunData.length === 0) return

      const kategoriIds = [...new Set(urunData.map(u => u.kategori_id).filter(Boolean))]
      const markaIds = [...new Set(urunData.map(u => u.marka_id).filter(Boolean))]

      const [{ data: gorseller }, { data: stoklar }, { data: kategoriler }, { data: markalarData }] = await Promise.all([
        fetchInBatches(urunIds, ids =>
          supabase.from('urun_gorselleri').select('*').in('urun_id', ids).order('sira_no')
        ),
        fetchInBatches(urunIds, ids =>
          supabase.from('urun_stoklari').select('*').in('urun_id', ids).eq('aktif_durum', true)
        ),
        fetchInBatches(kategoriIds, ids =>
          supabase.from('kategoriler').select('id, kategori_adi').in('id', ids)
        ),
        fetchInBatches(markaIds, ids =>
          supabase.from('markalar').select('id, marka_adi').in('id', ids)
        )
      ])

      const urunlerWithData = urunData.map(urun => ({
        ...urun,
        urun_gorselleri: gorseller?.filter(g => g.urun_id === urun.id) || [],
        urun_stoklari: stoklar?.filter(s => s.urun_id === urun.id) || [],
        kategoriler: kategoriler?.find(k => k.id === urun.kategori_id),
        markalar: markalarData?.find(m => m.id === urun.marka_id)
      }))

      setter(urunlerWithData)
    }

    async function loadData() {
      try {
        setLoading(true)
        setError(null)

        const { data: bannerData, error: bannerError } = await supabase
          .from('bannerlar')
          .select('*')
          .eq('aktif_durum', true)
          .order('sira_no')

        if (bannerError) console.error('Banner yükleme hatası:', bannerError)
        if (bannerData) setBanners(bannerData)

        const { data: onerilenData } = await supabase
          .from('onerilen_urunler')
          .select('urun_id')
          .eq('manuel_secim', true)
          .order('goruntuleme_sirasi')
          .limit(4)

        if (onerilenData && onerilenData.length > 0) {
          await loadUrunlerByIds(onerilenData.map(o => o.urun_id), setOneCikanUrunler)
        } else {
          const { data: fallbackData } = await supabase
            .from('urunler')
            .select('id')
            .eq('aktif_durum', true)
            .limit(4)

          if (fallbackData && fallbackData.length > 0) {
            await loadUrunlerByIds(fallbackData.map(u => u.id), setOneCikanUrunler)
          }
        }

        const { data: bestsellerData } = await supabase
          .from('urunler')
          .select('id')
          .eq('aktif_durum', true)
          .order('created_at', { ascending: false })
          .limit(12)

        if (bestsellerData && bestsellerData.length > 0) {
          await loadUrunlerByIds(bestsellerData.map(u => u.id), setEnCokSatanlar)
        }

        const { data: yeniData } = await supabase
          .from('urunler')
          .select('id')
          .eq('aktif_durum', true)
          .order('created_at', { ascending: false })
          .limit(16)

        if (yeniData && yeniData.length > 0) {
          await loadUrunlerByIds(yeniData.map(u => u.id), setYeniEklenenler)
        }

        const { data: markaData } = await supabase
          .from('markalar')
          .select('id, marka_adi, logo_url')
          .eq('aktif_durum', true)
          .order('marka_adi')
          .limit(12)

        if (markaData) setMarkalar(markaData)
        hasLoadedRef.current = true
      } catch (err) {
        console.error('Veri yükleme hatası:', err)
        setError('Veriler yüklenirken bir hata oluştu.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const activeBanner = banners[currentBanner]
  const heroImage = getImageUrl(activeBanner?.resim_url || oneCikanUrunler[0]?.urun_gorselleri?.[0]?.gorsel_url)
  const heroTitle = activeBanner?.banner_baslik || 'Efsane Baharat'
  const heroText = activeBanner?.banner_aciklama || 'Seçili baharatlar, kahveler ve gurme ürünler tek ekranda, hızlı sipariş akışıyla.'
  const heroLink = activeBanner?.link_url || '/urunler'

  const nextBanner = () => setCurrentBanner((prev) => (prev + 1) % Math.max(banners.length, 1))
  const prevBanner = () => setCurrentBanner((prev) => (prev - 1 + Math.max(banners.length, 1)) % Math.max(banners.length, 1))

  if (loading) {
    return (
      <div className="shop-container py-16">
        <div className="grid gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-72 animate-pulse rounded-lg bg-white shadow-sm" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="shop-container flex min-h-[60vh] items-center justify-center py-16">
        <div className="max-w-md rounded-lg border border-red-100 bg-white p-6 text-center shadow-sm">
          <p className="mb-4 font-semibold text-red-600">{error}</p>
          <button type="button" onClick={() => window.location.reload()} className="shop-btn-primary">
            Tekrar dene
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-w-0">
      <section className="shop-container pt-5 sm:pt-8">
        <div className="relative overflow-hidden rounded-lg bg-zinc-950 text-white shadow-xl">
          {heroImage && (
            <img
              src={heroImage}
              alt={heroTitle}
              className="absolute inset-0 h-full w-full object-cover opacity-45"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/82 to-zinc-950/20" />

          <div className="relative grid min-h-[420px] items-end gap-6 p-5 sm:p-8 lg:min-h-[500px] lg:grid-cols-[1.08fr_0.92fr] lg:p-12">
            <div className="max-w-2xl pb-2">
              <div className="shop-eyebrow border-white/20 bg-white/10 text-orange-100">
                <Sparkles className="h-4 w-4" />
                Premium baharat ve gurme ürünler
              </div>
              <h1 className="mt-4 text-4xl font-bold leading-tight tracking-normal sm:text-5xl lg:text-6xl">
                {heroTitle}
              </h1>
              <p className="mt-4 max-w-xl text-base font-medium leading-7 text-zinc-200 sm:text-lg">
                {heroText}
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link to={heroLink} className="shop-btn-primary">
                  Alışverişe başla
                </Link>
                <Link to="/kampanyalar" className="shop-btn-secondary border-white/20 bg-white/10 text-white hover:bg-white hover:text-zinc-950">
                  Kampanyaları gör
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 rounded-lg bg-white/10 p-2 backdrop-blur lg:self-end">
              {['Taze stok', 'Güvenli teslimat', 'Bayi fiyatları'].map((item) => (
                <div key={item} className="rounded-md bg-white/10 p-3 text-center text-xs font-bold text-white">
                  {item}
                </div>
              ))}
            </div>
          </div>

          {banners.length > 1 && (
            <div className="absolute bottom-4 right-4 flex gap-2">
              <button type="button" onClick={prevBanner} className="grid h-11 w-11 place-items-center rounded-full bg-white/90 text-zinc-950 shadow-sm" aria-label="Önceki banner">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button type="button" onClick={nextBanner} className="grid h-11 w-11 place-items-center rounded-full bg-white/90 text-zinc-950 shadow-sm" aria-label="Sonraki banner">
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </section>

      {oneCikanUrunler.length > 0 && (
        <ProductRail title="Öne çıkan ürünler" subtitle="Hızlı seçim için önerilen raf" link="/urunler" products={oneCikanUrunler} />
      )}

      {enCokSatanlar.length > 0 && (
        <ProductRail
          title="En çok satanlar"
          subtitle="Siparişlerde en çok tercih edilenler"
          link="/en-cok-satan"
          products={enCokSatanlar.slice(bestsellerPage * pageSize, (bestsellerPage + 1) * pageSize)}
          total={enCokSatanlar.length}
          page={bestsellerPage}
          onPageChange={setBestsellerPage}
        />
      )}

      {yeniEklenenler.length > 0 && (
        <ProductRail
          title="Yeni eklenenler"
          subtitle="XML ve panel stoklarından güncel ürünler"
          link="/urunler"
          products={yeniEklenenler.slice(newProductsPage * pageSize, (newProductsPage + 1) * pageSize)}
          total={yeniEklenenler.length}
          page={newProductsPage}
          onPageChange={setNewProductsPage}
        />
      )}

      {markalar.length > 0 && (
        <section className="shop-container py-10">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-700">Markalar</p>
              <h2 className="mt-2 text-2xl font-bold text-zinc-950 sm:text-3xl">Güvenilen seçimler</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-600">
                Sık kullanılan marka raflarına logolar üzerinden hızlıca geçin.
              </p>
            </div>
            <Link to="/urunler" className="shop-btn-secondary min-h-[40px] px-4 py-2 text-sm">
              Tümü
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {markalar.map((marka) => {
              const logoUrl = getImageUrl(marka.logo_url)

              return (
                <Link
                  key={marka.id}
                  to={`/urunler?marka=${marka.id}`}
                  className="group flex min-h-[172px] min-w-0 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md"
                >
                  <div className="flex aspect-[4/3] w-full items-center justify-center bg-zinc-50 p-4">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt={`${marka.marka_adi} logosu`}
                        className="max-h-full max-w-full object-contain transition duration-200 group-hover:scale-[1.03]"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-orange-100 text-2xl font-bold text-orange-700">
                        {marka.marka_adi?.charAt(0) || 'M'}
                      </div>
                    )}
                  </div>
                  <div className="flex min-h-[56px] items-center justify-center border-t border-zinc-100 px-3 py-3 text-center">
                    <span className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-800 group-hover:text-orange-700">
                      {marka.marka_adi}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      <section className="shop-container pb-12 pt-4">
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { icon: Truck, title: 'Hızlı operasyon', text: 'Siparişler stok ve kargo akışı için hazırlanır.' },
            { icon: ShieldCheck, title: 'Güvenli alışveriş', text: 'Ödeme ve sipariş süreci server taraflı doğrulamaya hazır.' },
            { icon: ShoppingBag, title: 'Bayi uyumlu', text: 'Bayi fiyatları, XML stokları ve seçili sortiler desteklenir.' }
          ].map((item) => {
            const Icon = item.icon
            return (
              <div key={item.title} className="flex min-w-0 gap-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-orange-100 text-orange-700">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-zinc-950">{item.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-zinc-600">{item.text}</p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <CanliDestekWidget />
    </div>
  )
}

interface ProductRailProps {
  title: string
  subtitle: string
  link: string
  products: any[]
  total?: number
  page?: number
  onPageChange?: (page: number) => void
}

function ProductRail({ title, subtitle, link, products, total, page = 0, onPageChange }: ProductRailProps) {
  const pageCount = Math.ceil((total || products.length) / pageSize)

  return (
    <section className="shop-container py-8 sm:py-10">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-700">{subtitle}</p>
          <h2 className="mt-2 text-2xl font-bold text-zinc-950 sm:text-3xl">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          {onPageChange && pageCount > 1 && (
            <>
              <button
                type="button"
                onClick={() => onPageChange(Math.max(0, page - 1))}
                disabled={page === 0}
                className="grid h-10 w-10 place-items-center rounded-lg border border-zinc-200 bg-white text-zinc-800 disabled:opacity-40"
                aria-label="Önceki sayfa"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => onPageChange(Math.min(pageCount - 1, page + 1))}
                disabled={page >= pageCount - 1}
                className="grid h-10 w-10 place-items-center rounded-lg border border-zinc-200 bg-white text-zinc-800 disabled:opacity-40"
                aria-label="Sonraki sayfa"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
          <Link to={link} className="shop-btn-secondary min-h-[40px] px-4 py-2 text-sm">
            Tümünü gör
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {products.map((urun) => (
          <UrunKart key={urun.id} urun={urun} />
        ))}
      </div>
    </section>
  )
}
