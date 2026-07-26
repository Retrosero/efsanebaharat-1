import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Edit, Trash2, Save, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { ImageUpload } from '../../components/ImageUpload'

export default function Kategoriler() {
  const [kategoriler, setKategoriler] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    kategori_adi: '',
    aciklama: '',
    ust_kategori_id: null as string | null,
    sira_no: 0,
    aktif_durum: true,
    gorsel_url: ''
  })

  useEffect(() => {
    loadKategoriler()
  }, [])

  async function loadKategoriler() {
    setLoading(true)
    const { data } = await supabase
      .from('kategoriler')
      .select('*')
      .order('sira_no', { ascending: true })

    if (data) setKategoriler(data)
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    try {
      if (editingId) {
        const { error } = await supabase
          .from('kategoriler')
          .update(formData)
          .eq('id', editingId)

        if (error) throw error
        toast.success('Kategori başarıyla güncellendi!')
      } else {
        const { error } = await supabase
          .from('kategoriler')
          .insert(formData)

        if (error) throw error
        toast.success('Kategori başarıyla eklendi!')
      }

      resetForm()
      await loadKategoriler()
    } catch (error: any) {
      console.error('Kategori kayıt hatası:', error)
      toast.error('Hata: ' + (error.message || 'Bilinmeyen hata'))
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Bu kategoriyi silmek istediğinizden emin misiniz?')) return

    try {
      const { error } = await supabase
        .from('kategoriler')
        .delete()
        .eq('id', id)

      if (error) throw error

      await loadKategoriler()
      toast.success('Kategori silindi!')
    } catch (error: any) {
      console.error('Kategori silme hatası:', error)
      toast.error('Hata: ' + (error.message || 'Bilinmeyen hata'))
    }
  }

  function handleEdit(kategori: any) {
    setEditingId(kategori.id)
    setFormData({
      kategori_adi: kategori.kategori_adi,
      aciklama: kategori.aciklama || '',
      ust_kategori_id: kategori.ust_kategori_id,
      sira_no: kategori.sira_no || 0,
      aktif_durum: kategori.aktif_durum,
      gorsel_url: kategori.gorsel_url || ''
    })
    setModalOpen(true)
  }

  function resetForm() {
    setEditingId(null)
    setFormData({
      kategori_adi: '',
      aciklama: '',
      ust_kategori_id: null,
      sira_no: 0,
      aktif_durum: true,
      gorsel_url: ''
    })
    setModalOpen(false)
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 sm:mb-6 lg:mb-8">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Kategori Yönetimi</h1>
        <button
          onClick={() => setModalOpen(true)}
          className="bg-orange-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg hover:bg-orange-700 transition flex items-center justify-center space-x-2 w-full sm:w-auto"
        >
          <Plus className="w-5 h-5" />
          <span>Yeni Kategori Ekle</span>
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kategori Adı</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Açıklama</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sıra No</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Durum</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {kategoriler.map((kategori) => (
                <tr key={kategori.id}>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{kategori.kategori_adi}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{kategori.aciklama || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{kategori.sira_no}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs ${kategori.aktif_durum ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {kategori.aktif_durum ? 'Aktif' : 'Pasif'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm space-x-2">
                    <button
                      onClick={() => handleEdit(kategori)}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <Edit className="w-4 h-4 inline" /> Düzenle
                    </button>
                    <button
                      onClick={() => handleDelete(kategori.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4 inline" /> Sil
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start sm:items-center justify-center p-0 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white sm:rounded-lg w-full max-w-lg min-h-screen sm:min-h-0 my-0 sm:my-8">
            <div className="p-4 sm:p-6 sm:max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingId ? 'Kategori Düzenle' : 'Yeni Kategori Ekle'}
                </h2>
                <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Kategori Adı</label>
                  <input
                    type="text"
                    value={formData.kategori_adi}
                    onChange={(e) => setFormData({ ...formData, kategori_adi: e.target.value })}
                    required
                    minLength={2}
                    maxLength={100}
                    pattern="^[\p{L}0-9\s\/\-]+$"
                    title="En az 2, en fazla 100 karakter. Sadece harf, rakam, boşluk ve tire kullanabilirsiniz."
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">En az 2, en fazla 100 karakter</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Açıklama</label>
                  <textarea
                    value={formData.aciklama}
                    onChange={(e) => setFormData({ ...formData, aciklama: e.target.value })}
                    rows={3}
                    maxLength={500}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Maksimum 500 karakter ({formData.aciklama.length}/500)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sıra No</label>
                  <input
                    type="number"
                    value={formData.sira_no}
                    onChange={(e) => setFormData({ ...formData, sira_no: parseInt(e.target.value) })}
                    min={0}
                    max={999}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">0-999 arası bir sayı girin</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Kategori Görseli</label>
                  <ImageUpload
                    maxFiles={1}
                    bucketName="kategori-gorselleri"
                    onUploadComplete={(urls) => setFormData({ ...formData, gorsel_url: urls[0] || '' })}
                    existingImages={formData.gorsel_url ? [formData.gorsel_url] : []}
                    maxSizeMB={8}
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.aktif_durum}
                    onChange={(e) => setFormData({ ...formData, aktif_durum: e.target.checked })}
                    className="w-4 h-4 text-orange-600 rounded"
                  />
                  <label className="ml-2 text-sm text-gray-700">Aktif</label>
                </div>

                <div className="flex space-x-4 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700 transition flex items-center justify-center space-x-2"
                  >
                    <Save className="w-5 h-5" />
                    <span>{editingId ? 'Güncelle' : 'Kaydet'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition"
                  >
                    İptal
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
