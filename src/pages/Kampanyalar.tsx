import { useCallback, useEffect, useState } from 'react'
import { Calendar, PackageSearch, Percent, Tag } from 'lucide-react'
import UrunKart from '../components/UrunKart'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { fetchInBatches } from '../utils/supabaseBatch'

interface Kampanya {
  id: string
  kod: string
  ad: string
  aciklama: string
  indirim_tipi: 'yuzde' | 'tutar'
  indirim_degeri: number
  baslangic_tarihi: string
  bitis_tarihi: string
  aktif: boolean
  kapsam: 'tum_urunler' | 'kategori' | 'marka' | 'secili_urunler'
  kategori_id?: string
  marka_id?: string
}

interface KampanyaWithProducts extends Kampanya {
  urunler: any[]
}

export default function Kampanyalar() {
  const { musteriData } = useAuth()
  const [kampanyalar, setKampanyalar] = useState<KampanyaWithProducts[]>([])
  const [loading, setLoading] = useState(true)

  const loadKampanyalarWithProducts = useCallback(async () => {
    try {
      setLoading(true)

      const now = new Date().toISOString()
      const { data: kampanyalarData, error: kampanyalarError } = await supabase
        .from('kampanyalar')
        .select('*')
        .eq('aktif', true)
        .lte('baslangic_tarihi', now)
        .gte('bitis_tarihi', now)
        .neq('kapsam', 'tum_urunler')
        .order('olusturma_tarihi', { ascending: false })

      if (kampanyalarError) throw kampanyalarError
      if (!kampanyalarData || kampanyalarData.length === 0) {
        setKampanyalar([])
        return
      }

      const kampanyalarWithProducts: KampanyaWithProducts[] = []

      for (const kampanya of kampanyalarData) {
        let urunler: any[] = []

        if (kampanya.kapsam === 'kategori' && kampanya.kategori_id) {
          const { data } = await supabase
            .from('urunler')
            .select('*')
            .eq('aktif_durum', true)
            .eq('kategori_id', kampanya.kategori_id)
            .limit(12)
          if (data) urunler = data
        } else if (kampanya.kapsam === 'marka' && kampanya.marka_id) {
          const { data } = await supabase
            .from('urunler')
            .select('*')
            .eq('aktif_durum', true)
            .eq('marka_id', kampanya.marka_id)
            .limit(12)
          if (data) urunler = data
        } else if (kampanya.kapsam === 'secili_urunler') {
          const { data: urunIds } = await supabase
            .from('kampanya_urunler')
            .select('urun_id')
            .eq('kampanya_id', kampanya.id)

          const ids = urunIds?.map(u => u.urun_id) || []
          if (ids.length > 0) {
            const { data } = await supabase
              .from('urunler')
              .select('*')
              .eq('aktif_durum', true)
              .in('id', ids)
              .limit(12)
            if (data) urunler = data
          }
        }

        if (urunler.length === 0) continue

        const urunIds = urunler.map(u => u.id)
        const kategoriIds = [...new Set(urunler.map(u => u.kategori_id).filter(Boolean))]
        const markaIds = [...new Set(urunler.map(u => u.marka_id).filter(Boolean))]

        const [{ data: gorseller }, { data: stoklar }, { data: kategoriler }, { data: markalar }] = await Promise.all([
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

        const musteriTipi = musteriData?.musteri_tipi || 'musteri'
        const urunlerWithData = urunler.map(urun => {
          const urunStoklari = stoklar?.filter(s => s.urun_id === urun.id) || []
          const filtreliStoklar = urunStoklari.filter(s =>
            !s.stok_grubu || s.stok_grubu === 'hepsi' || s.stok_grubu === musteriTipi
          )

          return {
            ...urun,
            urun_gorselleri: gorseller?.filter(g => g.urun_id === urun.id) || [],
            urun_stoklari: filtreliStoklar,
            kategoriler: kategoriler?.find(k => k.id === urun.kategori_id),
            markalar: markalar?.find(m => m.id === urun.marka_id)
          }
        })

        kampanyalarWithProducts.push({ ...kampanya, urunler: urunlerWithData })
      }

      setKampanyalar(kampanyalarWithProducts)
    } catch (error) {
      console.error('Kampanyalar yüklenirken hata:', error)
      setKampanyalar([])
    } finally {
      setLoading(false)
    }
  }, [musteriData?.musteri_tipi])

  useEffect(() => {
    loadKampanyalarWithProducts()
  }, [loadKampanyalarWithProducts])

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <div className="shop-container py-6 sm:py-8">
      <div className="mb-6 rounded-lg bg-zinc-950 p-5 text-white shadow-lg sm:p-7">
        <div className="shop-eyebrow border-white/20 bg-white/10 text-orange-100">
          <Tag className="h-4 w-4" />
          Fırsatlar
        </div>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Kampanyalı ürünler</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300">
          Aktif indirimler ve avantajlı ürün rafları burada listelenir.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((item) => (
            <div key={item} className="h-72 animate-pulse rounded-lg bg-white shadow-sm" />
          ))}
        </div>
      ) : kampanyalar.length === 0 ? (
        <div className="flex min-h-[320px] flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center">
          <PackageSearch className="h-12 w-12 text-zinc-300" />
          <h2 className="mt-3 text-xl font-bold text-zinc-950">Aktif kampanya yok</h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500">Yeni kampanyalar eklendiğinde burada görünür.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {kampanyalar.map((kampanya) => (
            <section key={kampanya.id} className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-100 bg-orange-50 p-4 sm:p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="inline-flex min-h-[30px] items-center gap-1 rounded-full bg-red-600 px-3 text-xs font-bold text-white">
                        <Percent className="h-4 w-4" />
                        {kampanya.indirim_tipi === 'yuzde' ? `%${kampanya.indirim_degeri} indirim` : `${kampanya.indirim_degeri} TL indirim`}
                      </span>
                      {kampanya.kod && (
                        <span className="rounded-full border border-orange-200 bg-white px-3 py-1 text-xs font-bold text-orange-700">
                          {kampanya.kod}
                        </span>
                      )}
                    </div>
                    <h2 className="break-words text-2xl font-bold text-zinc-950">{kampanya.ad}</h2>
                    {kampanya.aciklama && <p className="mt-1 text-sm leading-6 text-zinc-600">{kampanya.aciklama}</p>}
                  </div>
                  <div className="flex min-w-0 items-center gap-2 rounded-lg border border-orange-100 bg-white px-3 py-2 text-xs font-bold text-zinc-600">
                    <Calendar className="h-4 w-4 shrink-0 text-orange-700" />
                    <span className="break-words">{formatDate(kampanya.baslangic_tarihi)} - {formatDate(kampanya.bitis_tarihi)}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 sm:gap-4 sm:p-5 lg:grid-cols-4">
                {kampanya.urunler.map((urun) => (
                  <UrunKart
                    key={urun.id}
                    urun={urun}
                    kampanya={{
                      indirim_tipi: kampanya.indirim_tipi,
                      indirim_degeri: kampanya.indirim_degeri
                    }}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
