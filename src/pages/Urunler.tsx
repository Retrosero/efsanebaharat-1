import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PackageSearch, Search, SlidersHorizontal, X } from 'lucide-react'
import UrunKart from '../components/UrunKart'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import {
  buildProductSearchPostgrestFilter,
  getMatchingBrandIds,
  getMatchingCategoryIds,
  scoreProductRelevance,
} from '../utils/categorySearch'
import { fetchInBatches } from '../utils/supabaseBatch'

export default function Urunler() {
  const { musteriData } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [urunler, setUrunler] = useState<any[]>([])
  const [kategoriler, setKategoriler] = useState<any[]>([])
  const [markalar, setMarkalar] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [aramaText, setAramaText] = useState('')
  const [secilenKategori, setSecilenKategori] = useState(searchParams.get('kategori') || '')
  const [secilenMarka, setSecilenMarka] = useState(searchParams.get('marka') || '')
  const [secilenKampanya, setSecilenKampanya] = useState(searchParams.get('kampanya') || '')
  const [activeCampaign, setActiveCampaign] = useState<any>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)

  useEffect(() => {
    loadKategoriler()
    loadMarkalar()
  }, [])

  useEffect(() => {
    const kategoriParam = searchParams.get('kategori')
    const markaParam = searchParams.get('marka')
    const kampanyaParam = searchParams.get('kampanya')
    const qParam = searchParams.get('q')

    setSecilenKategori(kategoriParam || '')
    setSecilenMarka(markaParam || '')
    setSecilenKampanya(kampanyaParam || '')
    if (qParam !== null) setAramaText(qParam)
  }, [searchParams])

  async function loadKategoriler() {
    const { data } = await supabase
      .from('kategoriler')
      .select('*')
      .eq('aktif_durum', true)
      .order('kategori_adi')

    if (data) setKategoriler(data)
  }

  async function loadMarkalar() {
    const { data } = await supabase
      .from('markalar')
      .select('*')
      .eq('aktif_durum', true)
      .order('marka_adi')

    if (data) setMarkalar(data)
  }

  const loadUrunler = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('urunler')
      .select('*')
      .eq('aktif_durum', true)

    const searchTerm = aramaText.trim()
    const matchingCategoryIds = searchTerm ? getMatchingCategoryIds(kategoriler, searchTerm) : []
    const matchingBrandIds = searchTerm ? getMatchingBrandIds(markalar, searchTerm) : []

    if (secilenKategori) query = query.eq('kategori_id', secilenKategori)
    if (secilenMarka) query = query.eq('marka_id', secilenMarka)

    if (searchTerm) {
      const orFilter = buildProductSearchPostgrestFilter(searchTerm, matchingCategoryIds, matchingBrandIds)
      if (orFilter) {
        query = query.or(orFilter)
      }
    }

    if (secilenKampanya) {
      const { data: camp } = await supabase
        .from('kampanyalar')
        .select('*')
        .eq('id', secilenKampanya)
        .single()

      if (camp) {
        setActiveCampaign(camp)

        if (camp.kapsam === 'secili_urunler') {
          const { data: pids } = await supabase
            .from('kampanya_urunler')
            .select('urun_id')
            .eq('kampanya_id', secilenKampanya)

          const ids = pids?.map(p => p.urun_id) || []
          query = ids.length > 0
            ? query.in('id', ids)
            : query.eq('id', '00000000-0000-0000-0000-000000000000')
        } else if (camp.kapsam === 'kategori' && camp.kategori_id) {
          query = query.eq('kategori_id', camp.kategori_id)
        } else if (camp.kapsam === 'marka' && camp.marka_id) {
          query = query.eq('marka_id', camp.marka_id)
        }
      }
    } else {
      setActiveCampaign(null)
    }

    let { data } = await query.order('urun_adi')

    if (!data || data.length === 0) {
      setUrunler([])
      setLoading(false)
      return
    }

    if (searchTerm) {
      data = [...data].sort((a, b) => scoreProductRelevance(b, searchTerm) - scoreProductRelevance(a, searchTerm))
    }

    const urunIds = data.map(u => u.id)
    const kategoriIds = [...new Set(data.map(u => u.kategori_id).filter(Boolean))]
    const markaIds = [...new Set(data.map(u => u.marka_id).filter(Boolean))]

    const [
      { data: gorseller, error: gorsellerError },
      { data: stoklar, error: stoklarError },
      { data: kategorilerData },
      { data: markalarData }
    ] = await Promise.all([
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

    if (gorsellerError) console.error('Ürün görselleri yükleme hatası:', gorsellerError)
    if (stoklarError) console.error('Ürün stokları yükleme hatası:', stoklarError)

    const musteriTipi = musteriData?.musteri_tipi || 'musteri'

    const urunlerWithData = data.map(urun => {
      const urunStoklari = stoklar?.filter(s => s.urun_id === urun.id) || []
      const filtreliStoklar = urunStoklari.filter(s =>
        !s.stok_grubu || s.stok_grubu === 'hepsi' || s.stok_grubu === musteriTipi
      )

      return {
        ...urun,
        urun_gorselleri: gorseller?.filter(g => g.urun_id === urun.id) || [],
        urun_stoklari: filtreliStoklar,
        kategoriler: kategorilerData?.find(k => k.id === urun.kategori_id),
        markalar: markalarData?.find(m => m.id === urun.marka_id)
      }
    })

    setUrunler(urunlerWithData)
    setLoading(false)
  }, [aramaText, kategoriler, markalar, musteriData?.musteri_tipi, secilenKampanya, secilenKategori, secilenMarka])

  useEffect(() => {
    loadUrunler()
  }, [loadUrunler])

  const clearFilters = () => {
    setSecilenKategori('')
    setSecilenMarka('')
    setAramaText('')
    setSecilenKampanya('')
  }

  return (
    <div className="shop-container py-6 sm:py-8">
      <div className="mb-6 rounded-lg bg-zinc-950 p-5 text-white shadow-lg sm:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="shop-eyebrow border-white/20 bg-white/10 text-orange-100">
              <PackageSearch className="h-4 w-4" />
              Ürün kataloğu
            </div>
            <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Ürünler</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300 sm:text-base">
              Baharat, kahve ve gurme ürünleri kategori, marka ve kampanya filtresiyle hızlı bulun.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen((value) => !value)}
            className="shop-btn-secondary border-white/20 bg-white/10 text-white hover:bg-white hover:text-zinc-950 lg:hidden"
          >
            {filtersOpen ? <X className="h-4 w-4" /> : <SlidersHorizontal className="h-4 w-4" />}
            Filtreler
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className={`${filtersOpen ? 'block' : 'hidden'} lg:block`}>
          <div className="sticky top-24 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-zinc-950">
                <SlidersHorizontal className="h-5 w-5 text-orange-600" />
                Filtreler
              </div>
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs font-bold text-orange-700 hover:text-orange-800"
              >
                Temizle
              </button>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-zinc-700">Ürün ara</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    value={aramaText}
                    onChange={(e) => setAramaText(e.target.value)}
                    placeholder="Ürün veya kategori adı..."
                    className="shop-input pl-9"
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-zinc-700">Kategori</span>
                <select value={secilenKategori} onChange={(e) => setSecilenKategori(e.target.value)} className="shop-input">
                  <option value="">Tüm kategoriler</option>
                  {kategoriler.map((kat) => (
                    <option key={kat.id} value={kat.id}>
                      {kat.kategori_adi}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-zinc-700">Marka</span>
                <select value={secilenMarka} onChange={(e) => setSecilenMarka(e.target.value)} className="shop-input">
                  <option value="">Tüm markalar</option>
                  {markalar.map((marka) => (
                    <option key={marka.id} value={marka.id}>
                      {marka.marka_adi}
                    </option>
                  ))}
                </select>
              </label>

              {activeCampaign && (
                <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-orange-700">Aktif kampanya</p>
                  <p className="mt-1 break-words text-sm font-bold text-zinc-900">{activeCampaign.ad || activeCampaign.kampanya_adi}</p>
                </div>
              )}
            </div>
          </div>
        </aside>

        <section className="min-w-0">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-bold text-zinc-600">
              {loading ? 'Ürünler yükleniyor' : `${urunler.length} ürün bulundu`}
            </p>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((item) => (
                <div key={item} className="h-72 animate-pulse rounded-lg bg-white shadow-sm" />
              ))}
            </div>
          ) : urunler.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center">
              <PackageSearch className="h-12 w-12 text-zinc-300" />
              <h2 className="mt-3 text-xl font-bold text-zinc-950">Ürün bulunamadı</h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500">
                Arama veya filtreleri değiştirerek tekrar deneyebilirsiniz.
              </p>
              <button type="button" onClick={clearFilters} className="shop-btn-primary mt-5">
                Filtreleri temizle
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {urunler.map((urun) => (
                <UrunKart key={urun.id} urun={urun} kampanya={activeCampaign} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
