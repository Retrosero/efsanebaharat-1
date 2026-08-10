import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { ImageUpload } from '../../components/ImageUpload'
import { getImageUrl } from '../../utils/imageUtils'
import { 
  Plus, 
  Edit, 
  Trash2, 
  Calendar, 
  Image as ImageIcon,
  Star,
  Package,
  TrendingUp
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Kampanya {
  id: string
  baslik: string
  aciklama: string
  baslangic_tarihi: string
  bitis_tarihi: string
  aktif: boolean
  banner_gorseli: string | null
  kampanya_tipi: 'indirim' | 'paket' | 'ozel'
  olusturma_tarihi: string
  iskonto_yuzdesi?: number
  hedef_grup?: 'musteri' | 'bayi' | 'hepsi'
  kullanim_tipi?: 'tekli' | 'coklu'
  min_sepet_tutari?: number
  max_kullanim_sayisi?: number | null
  kampanya_kodu?: string | null
  aktif_durum?: boolean
  kullanim_sayisi?: number
}

interface Banner {
  id: string
  kampanya_id: string
  gorsel_url: string
  baslik: string | null
  aciklama: string | null
  link_url: string | null
  goruntuleme_sirasi: number
  aktif: boolean
}

interface OnerilenUrun {
  id: string
  urun_id: string
  manuel_secim: boolean
  goruntuleme_sirasi: number
  urun_adi?: string
}

interface Urun {
  id: string
  urun_adi: string
  aktif: boolean
}

export default function AdminKampanyalar() {
  const [activeTab, setActiveTab] = useState<'kampanyalar' | 'bannerlar' | 'onerilen'>('kampanyalar')
  
  // Kampanyalar state
  const [kampanyalar, setKampanyalar] = useState<Kampanya[]>([])
  const [showKampanyaModal, setShowKampanyaModal] = useState(false)
  const [editingKampanya, setEditingKampanya] = useState<Kampanya | null>(null)
  
  // Bannerlar state
  const [bannerlar, setBannerlar] = useState<Banner[]>([])
  const [showBannerModal, setShowBannerModal] = useState(false)
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null)
  
  // Önerilen ürünler state
  const [onerilenUrunler, setOnerilenUrunler] = useState<OnerilenUrun[]>([])
  const [tumUrunler, setTumUrunler] = useState<Urun[]>([])
  const [showOnerilenModal, setShowOnerilenModal] = useState(false)
  const [searchUrun, setSearchUrun] = useState('')
  
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [activeTab])

  async function loadData() {
    setLoading(true)
    try {
      if (activeTab === 'kampanyalar') {
        await loadKampanyalar()
      } else if (activeTab === 'bannerlar') {
        await loadBannerlar()
      } else if (activeTab === 'onerilen') {
        await loadOnerilenUrunler()
      }
    } catch (error) {
      console.error('Veri yükleme hatası:', error)
      toast.error('Veriler yüklenirken hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  async function loadKampanyalar() {
    const { data, error } = await supabase
      .from('kampanyalar')
      .select('*')
      .order('olusturma_tarihi', { ascending: false })

    if (error) throw error

    // Kullanım sayılarını al
    if (data && data.length > 0) {
      const kampanyaIds = data.map(k => k.id)
      const { data: kullanimlar } = await supabase
        .from('kampanya_kullanimlari')
        .select('kampanya_id')
        .in('kampanya_id', kampanyaIds)

      const kampanyalarWithCount = data.map(k => ({
        ...k,
        kullanim_sayisi: kullanimlar?.filter(ku => ku.kampanya_id === k.id).length || 0
      }))

      setKampanyalar(kampanyalarWithCount)
    } else {
      setKampanyalar([])
    }
  }

  async function loadBannerlar() {
    const { data, error } = await supabase
      .from('kampanya_banner')
      .select('*')
      .order('goruntuleme_sirasi', { ascending: true })

    if (error) throw error
    setBannerlar(data || [])

    // Kampanyaları da yükle (select için)
    await loadKampanyalar()
  }

  async function loadOnerilenUrunler() {
    const { data, error } = await supabase
      .from('onerilen_urunler')
      .select('*')
      .eq('manuel_secim', true)
      .order('goruntuleme_sirasi', { ascending: true })

    if (error) throw error

    // Ürün isimlerini al
    if (data && data.length > 0) {
      const urunIds = data.map(o => o.urun_id)
      const { data: urunler } = await supabase
        .from('urunler')
        .select('id, urun_adi')
        .in('id', urunIds)

      const onerilenWithNames = data.map(o => ({
        ...o,
        urun_adi: urunler?.find(u => u.id === o.urun_id)?.urun_adi
      }))
      setOnerilenUrunler(onerilenWithNames)
    } else {
      setOnerilenUrunler([])
    }

    // Tüm ürünleri yükle (eklemek için)
    const { data: allUrunler } = await supabase
      .from('urunler')
      .select('id, urun_adi, aktif')
      .eq('aktif', true)
      .order('urun_adi', { ascending: true })

    setTumUrunler(allUrunler || [])
  }

  // Kampanya CRUD
  async function saveKampanya(formData: any) {
    try {
      if (editingKampanya) {
        const { error } = await supabase
          .from('kampanyalar')
          .update({
            ...formData,
            guncelleme_tarihi: new Date().toISOString()
          })
          .eq('id', editingKampanya.id)

        if (error) throw error
        toast.success('Kampanya güncellendi')
      } else {
        const { error } = await supabase
          .from('kampanyalar')
          .insert([formData])

        if (error) throw error
        toast.success('Kampanya oluşturuldu')
      }

      setShowKampanyaModal(false)
      setEditingKampanya(null)
      loadKampanyalar()
    } catch (error: any) {
      toast.error(error.message || 'İşlem başarısız')
    }
  }

  async function deleteKampanya(id: string) {
    if (!confirm('Bu kampanyayı silmek istediğinize emin misiniz?')) return

    try {
      const { error } = await supabase
        .from('kampanyalar')
        .delete()
        .eq('id', id)

      if (error) throw error
      toast.success('Kampanya silindi')
      loadKampanyalar()
    } catch (error: any) {
      toast.error(error.message || 'Silme işlemi başarısız')
    }
  }

  // Banner CRUD
  async function saveBanner(formData: any) {
    try {
      if (editingBanner) {
        const { error } = await supabase
          .from('kampanya_banner')
          .update(formData)
          .eq('id', editingBanner.id)

        if (error) throw error
        toast.success('Banner güncellendi')
      } else {
        const { error } = await supabase
          .from('kampanya_banner')
          .insert([formData])

        if (error) throw error
        toast.success('Banner oluşturuldu')
      }

      setShowBannerModal(false)
      setEditingBanner(null)
      loadBannerlar()
    } catch (error: any) {
      toast.error(error.message || 'İşlem başarısız')
    }
  }

  async function deleteBanner(id: string) {
    if (!confirm('Bu banneri silmek istediğinize emin misiniz?')) return

    try {
      const { error } = await supabase
        .from('kampanya_banner')
        .delete()
        .eq('id', id)

      if (error) throw error
      toast.success('Banner silindi')
      loadBannerlar()
    } catch (error: any) {
      toast.error(error.message || 'Silme işlemi başarısız')
    }
  }

  // Önerilen Ürün CRUD
  async function addOnerilenUrun(urunId: string, sira: number) {
    try {
      const { error } = await supabase
        .from('onerilen_urunler')
        .insert([{
          urun_id: urunId,
          manuel_secim: true,
          goruntuleme_sirasi: sira
        }])

      if (error) throw error
      toast.success('Ürün eklendi')
      setShowOnerilenModal(false)
      loadOnerilenUrunler()
    } catch (error: any) {
      toast.error(error.message || 'Ekleme başarısız')
    }
  }

  async function deleteOnerilenUrun(id: string) {
    if (!confirm('Bu ürünü önerilen listesinden çıkarmak istediğinize emin misiniz?')) return

    try {
      const { error } = await supabase
        .from('onerilen_urunler')
        .delete()
        .eq('id', id)

      if (error) throw error
      toast.success('Ürün kaldırıldı')
      loadOnerilenUrunler()
    } catch (error: any) {
      toast.error(error.message || 'Silme işlemi başarısız')
    }
  }

  async function updateOnerilenSira(id: string, yeniSira: number) {
    try {
      const { error } = await supabase
        .from('onerilen_urunler')
        .update({ goruntuleme_sirasi: yeniSira })
        .eq('id', id)

      if (error) throw error
      toast.success('Sıralama güncellendi')
      loadOnerilenUrunler()
    } catch (error: any) {
      toast.error(error.message || 'Güncelleme başarısız')
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('tr-TR')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Kampanya Yönetimi</h1>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 mb-6 border-b">
        <button
          onClick={() => setActiveTab('kampanyalar')}
          className={`px-6 py-3 font-medium transition ${
            activeTab === 'kampanyalar'
              ? 'border-b-2 border-orange-600 text-orange-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5" />
            <span>Kampanyalar</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('bannerlar')}
          className={`px-6 py-3 font-medium transition ${
            activeTab === 'bannerlar'
              ? 'border-b-2 border-orange-600 text-orange-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center space-x-2">
            <ImageIcon className="w-5 h-5" />
            <span>Bannerlar</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('onerilen')}
          className={`px-6 py-3 font-medium transition ${
            activeTab === 'onerilen'
              ? 'border-b-2 border-orange-600 text-orange-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center space-x-2">
            <Star className="w-5 h-5" />
            <span>Önerilen Ürünler</span>
          </div>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600">Yükleniyor...</div>
        </div>
      ) : (
        <>
          {/* Kampanyalar Tab */}
          {activeTab === 'kampanyalar' && (
            <KampanyalarTab
              kampanyalar={kampanyalar}
              onAdd={() => {
                setEditingKampanya(null)
                setShowKampanyaModal(true)
              }}
              onEdit={(kampanya) => {
                setEditingKampanya(kampanya)
                setShowKampanyaModal(true)
              }}
              onDelete={deleteKampanya}
              formatDate={formatDate}
            />
          )}

          {/* Bannerlar Tab */}
          {activeTab === 'bannerlar' && (
            <BannerlarTab
              bannerlar={bannerlar}
              kampanyalar={kampanyalar}
              onAdd={() => {
                setEditingBanner(null)
                setShowBannerModal(true)
              }}
              onEdit={(banner) => {
                setEditingBanner(banner)
                setShowBannerModal(true)
              }}
              onDelete={deleteBanner}
            />
          )}

          {/* Önerilen Ürünler Tab */}
          {activeTab === 'onerilen' && (
            <OnerilenUrunlerTab
              onerilenUrunler={onerilenUrunler}
              searchUrun={searchUrun}
              setSearchUrun={setSearchUrun}
              onAdd={() => setShowOnerilenModal(true)}
              onDelete={deleteOnerilenUrun}
              onUpdateSira={updateOnerilenSira}
            />
          )}
        </>
      )}

      {/* Modals */}
      {showKampanyaModal && (
        <KampanyaModal
          kampanya={editingKampanya}
          onSave={saveKampanya}
          onClose={() => {
            setShowKampanyaModal(false)
            setEditingKampanya(null)
          }}
        />
      )}

      {showBannerModal && (
        <BannerModal
          banner={editingBanner}
          kampanyalar={kampanyalar}
          onSave={saveBanner}
          onClose={() => {
            setShowBannerModal(false)
            setEditingBanner(null)
          }}
        />
      )}

      {showOnerilenModal && (
        <OnerilenUrunModal
          tumUrunler={tumUrunler}
          mevcutUrunler={onerilenUrunler}
          onAdd={addOnerilenUrun}
          onClose={() => setShowOnerilenModal(false)}
        />
      )}
    </div>
  )
}

// Tab Components
function KampanyalarTab({ kampanyalar, onAdd, onEdit, onDelete, formatDate }: any) {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-gray-600">{kampanyalar.length} kampanya</p>
        <button
          onClick={onAdd}
          className="flex items-center space-x-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition"
        >
          <Plus className="w-5 h-5" />
          <span>Yeni Kampanya</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {kampanyalar.map((kampanya: Kampanya) => (
          <div key={kampanya.id} className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-semibold text-gray-900">{kampanya.baslik}</h3>
              <div className="flex space-x-2">
                <button
                  onClick={() => onEdit(kampanya)}
                  className="text-blue-600 hover:text-blue-700"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDelete(kampanya.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {kampanya.aciklama && (
              <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                {kampanya.aciklama}
              </p>
            )}

            <div className="flex items-center space-x-2 text-sm text-gray-500 mb-2">
              <Calendar className="w-4 h-4" />
              <span>{formatDate(kampanya.baslangic_tarihi)} - {formatDate(kampanya.bitis_tarihi)}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                kampanya.aktif ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {kampanya.aktif ? 'Aktif' : 'Pasif'}
              </span>
              <span className="text-xs text-gray-500">{kampanya.kampanya_tipi}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function BannerlarTab({ bannerlar, kampanyalar, onAdd, onEdit, onDelete }: any) {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-gray-600">{bannerlar.length} banner</p>
        <button
          onClick={onAdd}
          className="flex items-center space-x-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition"
        >
          <Plus className="w-5 h-5" />
          <span>Yeni Banner</span>
        </button>
      </div>

      <div className="space-y-4">
        {bannerlar.map((banner: Banner) => {
          const kampanya = kampanyalar.find((k: Kampanya) => k.id === banner.kampanya_id)
          
          return (
            <div key={banner.id} className="bg-white rounded-lg shadow-sm p-4 flex items-start space-x-4">
              {banner.gorsel_url && (
                <img
                  src={getImageUrl(banner.gorsel_url)}
                  alt={banner.baslik || 'Banner'}
                  className="w-32 h-20 object-cover rounded"
                />
              )}
              
              <div className="flex-1">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{banner.baslik || 'Banner'}</h3>
                    {kampanya && (
                      <p className="text-sm text-gray-600">Kampanya: {kampanya.baslik}</p>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => onEdit(banner)}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(banner.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {banner.aciklama && (
                  <p className="text-sm text-gray-600 mb-2">{banner.aciklama}</p>
                )}

                <div className="flex items-center space-x-4 text-sm">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    banner.aktif ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {banner.aktif ? 'Aktif' : 'Pasif'}
                  </span>
                  <span className="text-gray-500">Sıra: {banner.goruntuleme_sirasi}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function OnerilenUrunlerTab({ onerilenUrunler, searchUrun, setSearchUrun, onAdd, onDelete, onUpdateSira }: any) {
  const filteredUrunler = onerilenUrunler.filter((urun: OnerilenUrun) =>
    urun.urun_adi?.toLowerCase().includes(searchUrun.toLowerCase())
  )

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="flex-1 max-w-md">
          <input
            type="text"
            value={searchUrun}
            onChange={(e) => setSearchUrun(e.target.value)}
            placeholder="Ürün ara..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={onAdd}
          className="flex items-center space-x-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition"
        >
          <Plus className="w-5 h-5" />
          <span>Ürün Ekle</span>
        </button>
      </div>

      {filteredUrunler.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">
          {searchUrun ? 'Arama sonucu bulunamadı' : 'Henüz öne çıkan ürün eklenmemiş. Başlamak için "Ürün Ekle" butonuna tıklayın.'}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sıra</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ürün Adı</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredUrunler.map((onerilen: OnerilenUrun, index: number) => (
                <tr key={onerilen.id}>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-900 font-medium">{onerilen.goruntuleme_sirasi}</span>
                      <input
                        type="number"
                        value={onerilen.goruntuleme_sirasi}
                        onChange={(e) => onUpdateSira(onerilen.id, parseInt(e.target.value))}
                        className="w-16 px-2 py-1 border rounded text-sm"
                        min="1"
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{onerilen.urun_adi}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => onDelete(onerilen.id)}
                      className="text-red-600 hover:text-red-700"
                      title="Kaldır"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 text-sm text-gray-600">
        <p>Toplam {filteredUrunler.length} öne çıkan ürün</p>
        <p className="mt-1">Ana sayfada ilk 4 ürün gösterilir.</p>
      </div>
    </div>
  )
}

// Modal Components
function KampanyaModal({ kampanya, onSave, onClose }: any) {
  const [formData, setFormData] = useState({
    baslik: kampanya?.baslik || '',
    aciklama: kampanya?.aciklama || '',
    baslangic_tarihi: kampanya?.baslangic_tarihi?.split('T')[0] || '',
    bitis_tarihi: kampanya?.bitis_tarihi?.split('T')[0] || '',
    aktif: kampanya?.aktif ?? true,
    banner_gorseli: kampanya?.banner_gorseli || '',
    kampanya_tipi: kampanya?.kampanya_tipi || 'indirim'
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-4">
            {kampanya ? 'Kampanya Düzenle' : 'Yeni Kampanya'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kampanya Başlığı
              </label>
              <input
                type="text"
                value={formData.baslik}
                onChange={(e) => setFormData({ ...formData, baslik: e.target.value })}
                className="w-full border rounded-lg px-4 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Açıklama
              </label>
              <textarea
                value={formData.aciklama}
                onChange={(e) => setFormData({ ...formData, aciklama: e.target.value })}
                className="w-full border rounded-lg px-4 py-2"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Başlangıç Tarihi
                </label>
                <input
                  type="date"
                  value={formData.baslangic_tarihi}
                  onChange={(e) => setFormData({ ...formData, baslangic_tarihi: e.target.value })}
                  className="w-full border rounded-lg px-4 py-2"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bitiş Tarihi
                </label>
                <input
                  type="date"
                  value={formData.bitis_tarihi}
                  onChange={(e) => setFormData({ ...formData, bitis_tarihi: e.target.value })}
                  className="w-full border rounded-lg px-4 py-2"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kampanya Tipi
              </label>
              <select
                value={formData.kampanya_tipi}
                onChange={(e) => setFormData({ ...formData, kampanya_tipi: e.target.value as any })}
                className="w-full border rounded-lg px-4 py-2"
              >
                <option value="indirim">İndirim</option>
                <option value="paket">Paket Kampanya</option>
                <option value="ozel">Özel Fırsat</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Banner Görseli
              </label>
              <ImageUpload
                maxFiles={1}
                bucketName="kampanya-banners"
                onUploadComplete={(urls) => setFormData({ ...formData, banner_gorseli: urls[0] || '' })}
                existingImages={formData.banner_gorseli ? [formData.banner_gorseli] : []}
                maxSizeMB={8}
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="aktif"
                checked={formData.aktif}
                onChange={(e) => setFormData({ ...formData, aktif: e.target.checked })}
                className="mr-2"
              />
              <label htmlFor="aktif" className="text-sm font-medium text-gray-700">
                Kampanya Aktif
              </label>
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="submit"
                className="flex-1 bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700 transition"
              >
                Kaydet
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition"
              >
                İptal
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

function BannerModal({ banner, kampanyalar, onSave, onClose }: any) {
  const [formData, setFormData] = useState({
    kampanya_id: banner?.kampanya_id || '',
    gorsel_url: banner?.gorsel_url || '',
    baslik: banner?.baslik || '',
    aciklama: banner?.aciklama || '',
    link_url: banner?.link_url || '',
    goruntuleme_sirasi: banner?.goruntuleme_sirasi || 0,
    aktif: banner?.aktif ?? true
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-4">
            {banner ? 'Banner Düzenle' : 'Yeni Banner'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kampanya
              </label>
              <select
                value={formData.kampanya_id}
                onChange={(e) => setFormData({ ...formData, kampanya_id: e.target.value })}
                className="w-full border rounded-lg px-4 py-2"
                required
              >
                <option value="">Kampanya Seçin</option>
                {kampanyalar.map((k: Kampanya) => (
                  <option key={k.id} value={k.id}>{k.baslik}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Görsel
              </label>
              <ImageUpload
                maxFiles={1}
                bucketName="banner-gorselleri"
                onUploadComplete={(urls) => setFormData({ ...formData, gorsel_url: urls[0] || '' })}
                existingImages={formData.gorsel_url ? [formData.gorsel_url] : []}
                maxSizeMB={8}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Başlık
              </label>
              <input
                type="text"
                value={formData.baslik}
                onChange={(e) => setFormData({ ...formData, baslik: e.target.value })}
                className="w-full border rounded-lg px-4 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Açıklama
              </label>
              <textarea
                value={formData.aciklama}
                onChange={(e) => setFormData({ ...formData, aciklama: e.target.value })}
                className="w-full border rounded-lg px-4 py-2"
                rows={2}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Link URL (opsiyonel)
              </label>
              <input
                type="text"
                value={formData.link_url}
                onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                className="w-full border rounded-lg px-4 py-2"
                placeholder="/kampanyalar veya /urun/..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Görüntüleme Sırası
              </label>
              <input
                type="number"
                value={formData.goruntuleme_sirasi}
                onChange={(e) => setFormData({ ...formData, goruntuleme_sirasi: parseInt(e.target.value) })}
                className="w-full border rounded-lg px-4 py-2"
                min="0"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="banner-aktif"
                checked={formData.aktif}
                onChange={(e) => setFormData({ ...formData, aktif: e.target.checked })}
                className="mr-2"
              />
              <label htmlFor="banner-aktif" className="text-sm font-medium text-gray-700">
                Banner Aktif
              </label>
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="submit"
                className="flex-1 bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700 transition"
              >
                Kaydet
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition"
              >
                İptal
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

function OnerilenUrunModal({ tumUrunler, mevcutUrunler, onAdd, onClose }: any) {
  const [selectedUrunId, setSelectedUrunId] = useState('')
  const [sira, setSira] = useState(mevcutUrunler.length + 1)

  // Daha önce eklenmemiş ürünleri filtrele
  const availableUrunler = tumUrunler.filter(
    (u: Urun) => !mevcutUrunler.find((m: OnerilenUrun) => m.urun_id === u.id)
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (selectedUrunId) {
      onAdd(selectedUrunId, sira)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-4">Önerilen Ürün Ekle</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ürün Seçin
              </label>
              <select
                value={selectedUrunId}
                onChange={(e) => setSelectedUrunId(e.target.value)}
                className="w-full border rounded-lg px-4 py-2"
                required
              >
                <option value="">Ürün Seçin</option>
                {availableUrunler.map((urun: Urun) => (
                  <option key={urun.id} value={urun.id}>{urun.urun_adi}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Görüntüleme Sırası
              </label>
              <input
                type="number"
                value={sira}
                onChange={(e) => setSira(parseInt(e.target.value))}
                className="w-full border rounded-lg px-4 py-2"
                min="1"
                required
              />
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="submit"
                className="flex-1 bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700 transition"
              >
                Ekle
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition"
              >
                İptal
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
