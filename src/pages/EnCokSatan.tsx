import { useCallback, useEffect, useState } from 'react'
import { PackageSearch, Star, TrendingUp } from 'lucide-react'
import UrunKart from '../components/UrunKart'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { fetchInBatches } from '../utils/supabaseBatch'

export default function EnCokSatan() {
  const { musteriData } = useAuth()
  const [urunler, setUrunler] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [siralama, setSiralama] = useState<'otomatik' | 'manuel'>('otomatik')

  const fetchProductDetails = useCallback(async (
    urunIds: string[],
    satisSayilari?: { [key: string]: number }
  ) => {
    const { data: urunlerData, error: urunlerError } = await supabase
      .from('urunler')
      .select('*')
      .in('id', urunIds)
      .eq('aktif_durum', true)

    if (urunlerError) throw urunlerError
    if (!urunlerData || urunlerData.length === 0) {
      setUrunler([])
      return
    }

    const ids = urunlerData.map(u => u.id)
    const kategoriIds = [...new Set(urunlerData.map(u => u.kategori_id).filter(Boolean))]
    const markaIds = [...new Set(urunlerData.map(u => u.marka_id).filter(Boolean))]

    const [{ data: kategoriler }, { data: markalar }, { data: stoklar }, { data: gorseller }] = await Promise.all([
      fetchInBatches(kategoriIds, batchIds =>
        supabase.from('kategoriler').select('id, kategori_adi').in('id', batchIds)
      ),
      fetchInBatches(markaIds, batchIds =>
        supabase.from('markalar').select('id, marka_adi').in('id', batchIds)
      ),
      fetchInBatches(ids, batchIds =>
        supabase.from('urun_stoklari').select('*').in('urun_id', batchIds).eq('aktif_durum', true)
      ),
      fetchInBatches(ids, batchIds =>
        supabase.from('urun_gorselleri').select('*').in('urun_id', batchIds).order('sira_no')
      )
    ])

    const musteriTipi = musteriData?.musteri_tipi || 'musteri'
    const list = urunlerData.map(urun => {
      const urunStoklari = stoklar?.filter(s => s.urun_id === urun.id) || []
      const filtreliStoklar = urunStoklari.filter(s =>
        !s.stok_grubu || s.stok_grubu === 'hepsi' || s.stok_grubu === musteriTipi
      )

      return {
        ...urun,
        satis_sayisi: satisSayilari?.[urun.id] || 0,
        urun_stoklari: filtreliStoklar,
        urun_gorselleri: gorseller?.filter(g => g.urun_id === urun.id) || [],
        kategoriler: kategoriler?.find(k => k.id === urun.kategori_id),
        markalar: markalar?.find(m => m.id === urun.marka_id)
      }
    })

    if (satisSayilari) {
      list.sort((a, b) => (b.satis_sayisi || 0) - (a.satis_sayisi || 0))
    }

    setUrunler(list)
  }, [musteriData?.musteri_tipi])

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true)

      if (siralama === 'manuel') {
        const { data: onerilen, error: onerilenError } = await supabase
          .from('onerilen_urunler')
          .select('urun_id, goruntuleme_sirasi')
          .eq('manuel_secim', true)
          .order('goruntuleme_sirasi', { ascending: true })

        if (onerilenError) throw onerilenError
        if (onerilen && onerilen.length > 0) {
          await fetchProductDetails(onerilen.map(o => o.urun_id))
        } else {
          setUrunler([])
        }
      } else {
        const { data: satislar, error: satisError } = await supabase
          .from('siparis_urunleri')
          .select('urun_id, miktar')

        if (satisError) throw satisError

        const satisSayilari: { [key: string]: number } = {}
        satislar?.forEach(satis => {
          satisSayilari[satis.urun_id] = (satisSayilari[satis.urun_id] || 0) + Number(satis.miktar || 0)
        })

        const enCokSatanIds = Object.entries(satisSayilari)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 12)
          .map(entry => entry[0])

        if (enCokSatanIds.length > 0) {
          await fetchProductDetails(enCokSatanIds, satisSayilari)
        } else {
          const { data: aktifUrunler } = await supabase
            .from('urunler')
            .select('id')
            .eq('aktif_durum', true)
            .limit(12)

          if (aktifUrunler && aktifUrunler.length > 0) {
            await fetchProductDetails(aktifUrunler.map(u => u.id))
          } else {
            setUrunler([])
          }
        }
      }
    } catch (error) {
      console.error('Ürünler yüklenirken hata:', error)
      setUrunler([])
    } finally {
      setLoading(false)
    }
  }, [fetchProductDetails, siralama])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  return (
    <div className="shop-container py-6 sm:py-8">
      <div className="mb-6 rounded-lg bg-zinc-950 p-5 text-white shadow-lg sm:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="shop-eyebrow border-white/20 bg-white/10 text-orange-100">
              <TrendingUp className="h-4 w-4" />
              Populer raf
            </div>
            <h1 className="mt-3 text-3xl font-bold sm:text-4xl">En çok satanlar</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300">
              {siralama === 'otomatik' ? 'Satış verilerine göre öne çıkan ürünler.' : 'Panelden özel seçilmiş ürünler.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-1 rounded-lg bg-white/10 p-1">
            <button
              type="button"
              onClick={() => setSiralama('otomatik')}
              className={`min-h-[40px] rounded-md px-4 text-sm font-bold transition ${siralama === 'otomatik' ? 'bg-white text-zinc-950' : 'text-white'}`}
            >
              Otomatik
            </button>
            <button
              type="button"
              onClick={() => setSiralama('manuel')}
              className={`flex min-h-[40px] items-center justify-center gap-2 rounded-md px-4 text-sm font-bold transition ${siralama === 'manuel' ? 'bg-white text-zinc-950' : 'text-white'}`}
            >
              <Star className="h-4 w-4" />
              Önerilen
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((item) => (
            <div key={item} className="h-72 animate-pulse rounded-lg bg-white shadow-sm" />
          ))}
        </div>
      ) : urunler.length === 0 ? (
        <div className="flex min-h-[320px] flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center">
          <PackageSearch className="h-12 w-12 text-zinc-300" />
          <h2 className="mt-3 text-xl font-bold text-zinc-950">Henüz ürün yok</h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500">Bu raf için gösterilecek ürün bulunamadı.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {urunler.map((urun) => (
            <UrunKart key={urun.id} urun={urun} />
          ))}
        </div>
      )}
    </div>
  )
}
