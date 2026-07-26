import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Package, TrendingUp, ShoppingCart } from 'lucide-react'
import { fetchInBatches } from '../utils/supabaseBatch'

export default function BayiPanel() {
  const { user, musteriData, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    toplamSiparis: 0,
    toplamHarcama: 0,
    bekleyenSiparis: 0
  })
  const [populerUrunler, setPopulerUrunler] = useState<any[]>([])

  useEffect(() => {
    if (!authLoading && (!user || musteriData?.musteri_tipi !== 'bayi')) {
      navigate('/giris')
    } else if (user && musteriData) {
      loadBayiData()
    }
  }, [user, authLoading, musteriData])

  async function loadBayiData() {
    if (!musteriData) return

    // Bayi istatistikleri
    const { data: siparisler } = await supabase
      .from('siparisler')
      .select('*')
      .eq('musteri_id', musteriData.id)

    if (siparisler) {
      setStats({
        toplamSiparis: siparisler.length,
        toplamHarcama: siparisler.reduce((sum, s) => sum + (s.toplam_tutar || 0), 0),
        bekleyenSiparis: siparisler.filter(s => s.siparis_durumu === 'Yeni' || s.siparis_durumu === 'Hazırlanıyor').length
      })
    }

    // Popüler ürünler (bayi fiyatları ile)
    const { data: urunler } = await supabase
      .from('urunler')
      .select('*')
      .eq('aktif_durum', true)
      .limit(6)

    if (urunler && urunler.length > 0) {
      const urunIds = urunler.map(u => u.id)
      const { data: stoklar } = await fetchInBatches(urunIds, ids =>
        supabase
          .from('urun_stoklari')
          .select('*')
          .in('urun_id', ids)
          .eq('aktif_durum', true)
      )

      const urunlerWithStok = urunler.map(u => ({
        ...u,
        stoklar: stoklar?.filter(s => s.urun_id === u.id) || []
      }))

      setPopulerUrunler(urunlerWithStok)
    }
  }

  if (authLoading) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <div className="inline-block w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!musteriData || musteriData.musteri_tipi !== 'bayi') {
    return null
  }

  // Bayi indirimi hesapla
  const bayiIndirim = musteriData.fiyat_gruplari?.indirim_orani || 0

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Bayi Paneli</h1>
      <p className="text-gray-600 mb-8">
        Hoş geldiniz {musteriData.ad} {musteriData.soyad} - 
        <span className="text-orange-600 font-semibold ml-2">
          %{bayiIndirim} İndirim
        </span>
      </p>

      {/* İstatistikler */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Toplam Sipariş</p>
              <p className="text-2xl font-bold text-gray-900">{stats.toplamSiparis}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Toplam Harcama</p>
              <p className="text-2xl font-bold text-gray-900">{stats.toplamHarcama.toFixed(2)} ₺</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Bekleyen Sipariş</p>
              <p className="text-2xl font-bold text-gray-900">{stats.bekleyenSiparis}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Popüler Ürünler - Bayi Fiyatları */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Önerilen Ürünler (Bayi Fiyatları)</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {populerUrunler.map((urun) => {
            const ilkStok = urun.stoklar?.[0]
            const normalFiyat = ilkStok?.fiyat || 0
            const bayiFiyat = normalFiyat * (1 - bayiIndirim / 100)

            return (
              <div key={urun.id} className="border rounded-lg p-4 hover:shadow-md transition">
                <h3 className="font-semibold text-gray-900 mb-2">{urun.urun_adi}</h3>
                {ilkStok && (
                  <div>
                    <p className="text-sm text-gray-500 line-through">{normalFiyat.toFixed(2)} ₺</p>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-orange-600">
                        {bayiFiyat.toFixed(2)} ₺
                      </span>
                      <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                        %{bayiIndirim} İND
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{ilkStok.birim_turu}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Bilgilendirme */}
      <div className="mt-6 bg-orange-50 border border-orange-200 rounded-lg p-6">
        <h3 className="font-semibold text-orange-900 mb-2">Bayi Avantajları</h3>
        <ul className="text-sm text-orange-800 space-y-1">
          <li>• Tüm ürünlerde %{bayiIndirim} özel indirim</li>
          <li>• Toplu sipariş imkanı</li>
          <li>• Öncelikli kargo</li>
          <li>• Özel kampanyalardan haberdar olma</li>
        </ul>
      </div>
    </div>
  )
}
