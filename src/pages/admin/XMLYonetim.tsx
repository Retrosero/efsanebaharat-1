import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { FileCode, RefreshCw, Download, Copy, Check, Key, Eye, EyeOff, Package, CheckCircle, XCircle, AlertTriangle, Activity, UploadCloud } from 'lucide-react'
import toast from 'react-hot-toast'
import { generateXMLContent, downloadXML, generateSecureToken, copyToClipboard, XMLProduct } from '../../utils/xmlGenerator'
import { fetchInBatches } from '../../utils/supabaseBatch'

interface SelectedProduct {
    id: string
    urun_adi: string
    birim_adedi: number
    birim_turu: string
    fiyat: number
    stok_miktari: number
    stok_birimi: string
    kategori_adi: string
    marka_adi: string
    gorsel_url: string | null
}

interface XMLHealthStatus {
    isHealthy: boolean
    lastCheck: Date | null
    errors: XMLError[]
    warnings: string[]
}

interface XMLError {
    id: string
    message: string
    timestamp: Date
    type: 'error' | 'warning'
}

interface XMLImportResult {
    dryRun?: boolean
    sourceUrl?: string
    totalInXml?: number
    parsed?: number
    createdProducts?: number
    updatedProducts?: number
    createdCategories?: number
    createdBrands?: number
    updatedStocks?: number
    insertedImages?: number
    skipped?: number
    sample?: Array<{
        productCode: string
        name: string
        mainCategory: string
        category: string
        price: number
        stock: number
        brand: string
    }>
}

interface XMLImportSource {
    id: string
    name: string
    url: string
    allowed_hosts: string[]
    update_interval_minutes: number
    is_active: boolean
    last_imported_at: string | null
}

export default function XMLYonetim() {
    const [loading, setLoading] = useState(true)
    const [generating, setGenerating] = useState(false)
    const [xmlSettings, setXmlSettings] = useState<any>(null)
    const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([])
    const [showToken, setShowToken] = useState(false)
    const [copied, setCopied] = useState(false)
    const [lastGeneratedXML, setLastGeneratedXML] = useState<string | null>(null)
    const [healthStatus, setHealthStatus] = useState<XMLHealthStatus>({
        isHealthy: true,
        lastCheck: null,
        errors: [],
        warnings: []
    })
    const [checking, setChecking] = useState(false)
    const [importUrl, setImportUrl] = useState('https://efsanebaharat.appsgo.cloud/urunler.xml')
    const [importAllowedHosts, setImportAllowedHosts] = useState('efsanebaharat.appsgo.cloud')
    const [importSourceName, setImportSourceName] = useState('Varsayılan kaynak')
    const [updateIntervalMinutes, setUpdateIntervalMinutes] = useState(30)
    const [importSources, setImportSources] = useState<XMLImportSource[]>([])
    const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
    const [importing, setImporting] = useState(false)
    const [importResult, setImportResult] = useState<XMLImportResult | null>(null)

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        setLoading(true)

        try {
            // XML ayarlarını çek
            const { data: settings } = await supabase
                .from('bayi_xml_settings')
                .select('*')
                .limit(1)
                .maybeSingle()

            setXmlSettings(settings)
            if (settings?.import_url) {
                setImportUrl(settings.import_url)
            }
            if (Array.isArray(settings?.import_allowed_hosts)) {
                setImportAllowedHosts(settings.import_allowed_hosts.join(', '))
            }

            const { data: sources, error: sourcesError } = await supabase
                .from('xml_import_sources')
                .select('*')
                .order('created_at', { ascending: true })

            // Migration henüz çalıştırılmadıysa mevcut tek kaynak ayarıyla çalışmaya devam et.
            if (!sourcesError && sources) {
                setImportSources(sources)
                const currentSource = sources.find(source => source.id === selectedSourceId) || sources.find(source => source.is_active) || sources[0]
                if (currentSource) {
                    setSelectedSourceId(currentSource.id)
                    setImportSourceName(currentSource.name)
                    setImportUrl(currentSource.url)
                    setImportAllowedHosts(currentSource.allowed_hosts?.join(', ') || '')
                    setUpdateIntervalMinutes(currentSource.update_interval_minutes || 30)
                }
            } else if (settings) {
                setUpdateIntervalMinutes(settings.update_interval_minutes || 30)
            }

            // XML'e seçili ürünleri çek
            const { data: stoklar } = await supabase
                .from('urun_stoklari')
                .select('id, urun_id, birim_adedi, birim_turu, fiyat, stok_miktari, stok_birimi')
                .eq('xml_export', true)
                .eq('aktif_durum', true)

            if (stoklar && stoklar.length > 0) {
                // Ürün detaylarını çek
                const urunIds = [...new Set(stoklar.map(s => s.urun_id))]

                const [{ data: urunler }, { data: kategoriler }, { data: markalar }, { data: gorseller }] = await Promise.all([
                    fetchInBatches(urunIds, ids =>
                        supabase.from('urunler').select('id, urun_adi, kategori_id, marka_id').in('id', ids)
                    ),
                    supabase.from('kategoriler').select('id, kategori_adi'),
                    supabase.from('markalar').select('id, marka_adi'),
                    fetchInBatches(urunIds, ids =>
                        supabase.from('urun_gorselleri').select('urun_id, gorsel_url, sira_no').in('urun_id', ids).order('sira_no', { ascending: true })
                    )
                ])

                const products: SelectedProduct[] = stoklar.map(stok => {
                    const urun = urunler?.find(u => u.id === stok.urun_id)
                    const kategori = kategoriler?.find(k => k.id === urun?.kategori_id)
                    const marka = markalar?.find(m => m.id === urun?.marka_id)
                    const gorsel = gorseller?.find(g => g.urun_id === stok.urun_id)

                    return {
                        id: stok.id,
                        urun_adi: urun?.urun_adi || 'Bilinmeyen Ürün',
                        birim_adedi: stok.birim_adedi,
                        birim_turu: stok.birim_turu,
                        fiyat: stok.fiyat,
                        stok_miktari: stok.stok_miktari,
                        stok_birimi: stok.stok_birimi,
                        kategori_adi: kategori?.kategori_adi || '',
                        marka_adi: marka?.marka_adi || '',
                        gorsel_url: gorsel?.gorsel_url || null
                    }
                })

                setSelectedProducts(products)
            } else {
                setSelectedProducts([])
            }
        } catch (error: any) {
            console.error('Veri yükleme hatası:', error)
            toast.error('Veriler yüklenirken hata oluştu')
            addError('Veri yükleme hatası: ' + (error.message || 'Bilinmeyen hata'), 'error')
        }

        setLoading(false)
    }

    function addError(message: string, type: 'error' | 'warning') {
        const newError: XMLError = {
            id: Date.now().toString(),
            message,
            timestamp: new Date(),
            type
        }
        setHealthStatus(prev => ({
            ...prev,
            isHealthy: type === 'warning' ? prev.isHealthy : false,
            errors: [newError, ...prev.errors].slice(0, 10) // Son 10 hata
        }))
    }

    function clearErrors() {
        setHealthStatus(prev => ({
            ...prev,
            isHealthy: true,
            errors: []
        }))
        toast.success('Hata geçmişi temizlendi')
    }

    async function runHealthCheck() {
        setChecking(true)
        const warnings: string[] = []
        let hasErrors = false

        try {
            // 1. Veritabanı bağlantısı kontrolü
            const { error: dbError } = await supabase.from('bayi_xml_settings').select('id').limit(1)
            if (dbError) {
                addError('Veritabanı bağlantı hatası: ' + dbError.message, 'error')
                hasErrors = true
            }

            // 2. Token kontrolü
            if (!xmlSettings?.xml_token) {
                warnings.push('Erişim token\'ı henüz oluşturulmamış')
            }

            // 3. Ürün kontrolü
            if (selectedProducts.length === 0) {
                warnings.push('XML\'e dahil edilecek ürün seçilmemiş')
            }

            // 4. Stok kontrolü - 0 stoklu ürünler
            const outOfStock = selectedProducts.filter(p => p.stok_miktari <= 0)
            if (outOfStock.length > 0) {
                warnings.push(`${outOfStock.length} üründe stok yok`)
            }

            // 5. Fiyat kontrolü - 0 fiyatlı ürünler
            const zeroPriceProducts = selectedProducts.filter(p => p.fiyat <= 0)
            if (zeroPriceProducts.length > 0) {
                warnings.push(`${zeroPriceProducts.length} üründe fiyat 0 veya eksik`)
            }

            // 6. Görsel kontrolü
            const noImageProducts = selectedProducts.filter(p => !p.gorsel_url)
            if (noImageProducts.length > 0) {
                warnings.push(`${noImageProducts.length} üründe görsel yok`)
            }

            setHealthStatus(prev => ({
                ...prev,
                isHealthy: !hasErrors,
                lastCheck: new Date(),
                warnings
            }))

            if (!hasErrors && warnings.length === 0) {
                toast.success('Sistem sağlık kontrolü başarılı!')
            } else if (!hasErrors) {
                toast.success(`Kontrol tamamlandı. ${warnings.length} uyarı var.`)
            }

        } catch (error: any) {
            console.error('Sağlık kontrolü hatası:', error)
            addError('Sağlık kontrolü yapılamadı: ' + (error.message || 'Bilinmeyen hata'), 'error')
        }

        setChecking(false)
    }

    async function handleGenerateXML() {
        if (selectedProducts.length === 0) {
            toast.error('XML\'e gönderilecek ürün seçilmemiş!')
            return
        }

        setGenerating(true)

        try {
            // XML ürün listesi oluştur
            const xmlProducts: XMLProduct[] = selectedProducts.map(p => ({
                id: p.id,
                name: `${p.urun_adi} ${p.birim_adedi} ${p.birim_turu.toUpperCase()}`,
                price: p.fiyat,
                stock: p.stok_miktari,
                unit: p.stok_birimi.toUpperCase(),
                unitAmount: p.birim_adedi,
                image: p.gorsel_url || '',
                category: p.kategori_adi,
                brand: p.marka_adi
            }))

            const xmlContent = generateXMLContent(xmlProducts)
            setLastGeneratedXML(xmlContent)

            // Son güncelleme zamanını kaydet
            if (xmlSettings) {
                await supabase
                    .from('bayi_xml_settings')
                    .update({ last_updated_at: new Date().toISOString() })
                    .eq('id', xmlSettings.id)

                setXmlSettings({ ...xmlSettings, last_updated_at: new Date().toISOString() })
            }

            toast.success(`XML başarıyla oluşturuldu! (${xmlProducts.length} ürün)`)
        } catch (error: any) {
            console.error('XML oluşturma hatası:', error)
            toast.error('XML oluşturulurken hata oluştu')
        }

        setGenerating(false)
    }

    function handleDownloadXML() {
        if (!lastGeneratedXML) {
            toast.error('Önce XML oluşturun!')
            return
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
        downloadXML(lastGeneratedXML, `bayi-urunler-${timestamp}.xml`)
        toast.success('XML dosyası indirildi!')
    }

    function getFeedUrl() {
        const baseUrl = import.meta.env.VITE_SUPABASE_URL || ''
        const token = encodeURIComponent(xmlSettings?.xml_token || '')
        return `${baseUrl.replace(/\/$/, '')}/functions/v1/bayi-xml-feed?token=${token}`
    }

    async function handleGenerateFeedXML() {
        if (selectedProducts.length === 0) {
            toast.error('XML\'e gÃ¶nderilecek sorti seÃ§ilmemiÅŸ!')
            return
        }

        if (!xmlSettings?.xml_token) {
            toast.error('Ã–nce XML eriÅŸim token\'Ä± oluÅŸturun')
            return
        }

        setGenerating(true)
        try {
            const response = await fetch(getFeedUrl())
            if (!response.ok) {
                throw new Error('XML feed oluÅŸturulamadÄ±')
            }

            const xmlContent = await response.text()
            setLastGeneratedXML(xmlContent)

            await supabase
                .from('bayi_xml_settings')
                .update({ last_updated_at: new Date().toISOString() })
                .eq('id', xmlSettings.id)

            setXmlSettings({ ...xmlSettings, last_updated_at: new Date().toISOString() })
            toast.success(`XML feed baÅŸarÄ±yla hazÄ±rlandÄ±! (${selectedProducts.length} sorti)`)
        } catch (error: any) {
            console.error('XML feed oluÅŸturma hatasÄ±:', error)
            toast.error(error.message || 'XML feed oluÅŸturulurken hata oluÅŸtu')
        } finally {
            setGenerating(false)
        }
    }

    function handleOpenFeedXML() {
        if (!xmlSettings?.xml_token) {
            toast.error('Ã–nce XML eriÅŸim token\'Ä± oluÅŸturun')
            return
        }

        window.open(getFeedUrl(), '_blank', 'noopener,noreferrer')
    }

    async function handleCopyFeedUrl() {
        if (!xmlSettings?.xml_token) {
            toast.error('Ã–nce XML eriÅŸim token\'Ä± oluÅŸturun')
            return
        }

        const success = await copyToClipboard(getFeedUrl())
        if (success) {
            toast.success('XML feed linki kopyalandÄ±')
        }
    }

    async function handleSaveImportSettings() {
        const hosts = importAllowedHosts
            .split(',')
            .map(host => host.trim().toLowerCase())
            .filter(Boolean)

        if (!importUrl.trim()) {
            toast.error('XML kaynaÄŸÄ± boÅŸ olamaz')
            return
        }

        if (hosts.length === 0) {
            toast.error('En az bir izinli host girin')
            return
        }

        const interval = Number(updateIntervalMinutes)
        if (!Number.isInteger(interval) || interval < 1 || interval > 10080) {
            toast.error('Güncelleme süresi 1 ile 10080 dakika arasında olmalı')
            return
        }

        try {
            const sourcePayload = {
                name: importSourceName.trim() || 'İsimsiz kaynak',
                url: importUrl.trim(),
                allowed_hosts: hosts,
                update_interval_minutes: interval,
                is_active: true,
                updated_at: new Date().toISOString()
            }

            const { data: savedSource, error: sourceError } = selectedSourceId
                ? await supabase.from('xml_import_sources').update(sourcePayload).eq('id', selectedSourceId).select().maybeSingle()
                : await supabase.from('xml_import_sources').insert(sourcePayload).select().maybeSingle()

            if (sourceError) throw sourceError
            if (savedSource) {
                setSelectedSourceId(savedSource.id)
                setImportSources(current => {
                    const index = current.findIndex(source => source.id === savedSource.id)
                    return index === -1 ? [...current, savedSource] : current.map(source => source.id === savedSource.id ? savedSource : source)
                })
            }

            if (xmlSettings?.id) {
                const { data, error } = await supabase
                    .from('bayi_xml_settings')
                    .update({
                        import_url: importUrl.trim(),
                        import_allowed_hosts: hosts,
                        update_interval_minutes: interval,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', xmlSettings.id)
                    .select()
                    .maybeSingle()

                if (error) throw error
                if (data) setXmlSettings(data)
            } else {
                const newToken = generateSecureToken()
                const { data, error } = await supabase
                    .from('bayi_xml_settings')
                    .insert({
                        xml_token: newToken,
                        import_url: importUrl.trim(),
                        import_allowed_hosts: hosts,
                        auto_update_enabled: false,
                        update_interval_minutes: interval
                    })
                    .select()
                    .maybeSingle()

                if (error) throw error
                if (data) setXmlSettings(data)
            }

            toast.success('XML kaynağı ve güncelleme ayarları kaydedildi')
        } catch (error: any) {
            console.error('XML ayarlarÄ± kaydedilemedi:', error)
            toast.error(error.message || 'XML ayarlarÄ± kaydedilemedi')
        }
    }

    function handleSelectSource(sourceId: string) {
        const source = importSources.find(item => item.id === sourceId)
        if (!source) return

        setSelectedSourceId(source.id)
        setImportSourceName(source.name)
        setImportUrl(source.url)
        setImportAllowedHosts(source.allowed_hosts?.join(', ') || '')
        setUpdateIntervalMinutes(source.update_interval_minutes || 15)
        setImportResult(null)
    }

    function handleNewSource() {
        setSelectedSourceId(null)
        setImportSourceName('')
        setImportUrl('')
        setImportAllowedHosts('')
        setUpdateIntervalMinutes(30)
        setImportResult(null)
    }

    async function handleGenerateNewToken() {
        if (!confirm('Yeni token oluşturulacak. Mevcut erişimler geçersiz olacak. Devam edilsin mi?')) {
            return
        }

        try {
            const newToken = generateSecureToken()

            if (xmlSettings) {
                await supabase
                    .from('bayi_xml_settings')
                    .update({ xml_token: newToken, updated_at: new Date().toISOString() })
                    .eq('id', xmlSettings.id)

                setXmlSettings({ ...xmlSettings, xml_token: newToken })
                toast.success('Yeni token oluşturuldu!')
            } else {
                // İlk token
                const { data } = await supabase
                    .from('bayi_xml_settings')
                    .insert({
                        xml_token: newToken,
                        auto_update_enabled: false,
                        update_interval_minutes: 30,
                        import_url: importUrl.trim(),
                        import_allowed_hosts: importAllowedHosts.split(',').map(host => host.trim().toLowerCase()).filter(Boolean)
                    })
                    .select()
                    .maybeSingle()

                if (data) {
                    setXmlSettings(data)
                    toast.success('Token oluşturuldu!')
                }
            }
        } catch (error: any) {
            console.error('Token oluşturma hatası:', error)
            toast.error('Token oluşturulurken hata oluştu')
        }
    }

    async function handleCopyToken() {
        if (!xmlSettings?.xml_token) return

        const success = await copyToClipboard(xmlSettings.xml_token)
        if (success) {
            setCopied(true)
            toast.success('Token kopyalandı!')
            setTimeout(() => setCopied(false), 2000)
        }
    }

    async function handleImportXML(dryRun = false) {
        setImporting(true)
        setImportResult(null)

        try {
            if (dryRun) {
                const { data, error } = await supabase.functions.invoke('xml-product-import', {
                    body: {
                        xmlUrl: importUrl,
                        dryRun: true,
                        limit: 5
                    }
                })

                if (error) throw error

                setImportResult(data)
                toast.success(`XML okundu: ${data?.totalInXml || data?.parsed || 0} ürün bulundu`)
            } else {
                // Büyük partiler, aynı XML dosyasının tekrar tekrar indirilmesini önemli ölçüde azaltır.
                const batchSize = 500
                let offset = 0
                let totalInXml: number | null = null
                const aggregate = {
                    sourceUrl: importUrl,
                    importedAt: new Date().toISOString(),
                    totalInXml: 0,
                    parsed: 0,
                    createdProducts: 0,
                    updatedProducts: 0,
                    createdCategories: 0,
                    createdBrands: 0,
                    updatedStocks: 0,
                    insertedImages: 0,
                    skipped: 0,
                }

                while (totalInXml === null || offset < totalInXml) {
                    const { data, error } = await supabase.functions.invoke('xml-product-import', {
                        body: {
                            xmlUrl: importUrl,
                            dryRun: false,
                            limit: batchSize,
                            offset
                        }
                    })

                    if (error) throw error
                    if (!data || data.parsed === 0) break

                    totalInXml = Number(data.totalInXml || 0)
                    aggregate.totalInXml = totalInXml
                    aggregate.parsed += Number(data.parsed || 0)
                    aggregate.createdProducts += Number(data.createdProducts || 0)
                    aggregate.updatedProducts += Number(data.updatedProducts || 0)
                    aggregate.createdCategories += Number(data.createdCategories || 0)
                    aggregate.createdBrands += Number(data.createdBrands || 0)
                    aggregate.updatedStocks += Number(data.updatedStocks || 0)
                    aggregate.insertedImages += Number(data.insertedImages || 0)
                    aggregate.skipped += Number(data.skipped || 0)

                    offset += Number(data.parsed || batchSize)
                    toast.success(`XML aktarılıyor: ${Math.min(offset, totalInXml)} / ${totalInXml}`)
                }

                setImportResult(aggregate)
                if (selectedSourceId) {
                    const importedAt = new Date().toISOString()
                    const { error: sourceError } = await supabase
                        .from('xml_import_sources')
                        .update({ last_imported_at: importedAt })
                        .eq('id', selectedSourceId)
                    if (sourceError) console.warn('Kaynak son güncelleme zamanı kaydedilemedi:', sourceError)
                    setImportSources(current => current.map(source => source.id === selectedSourceId ? { ...source, last_imported_at: importedAt } : source))
                }
                toast.success(`XML içe aktarıldı: ${aggregate.createdProducts} yeni, ${aggregate.updatedProducts} güncel ürün`)
                await loadData()
            }
        } catch (error: any) {
            console.error('XML içe aktarma hatası:', error)
            const message = error?.context?.error?.message || error?.message || 'XML içe aktarılırken hata oluştu'
            toast.error(message)
            addError('XML içe aktarma hatası: ' + message, 'error')
        }

        setImporting(false)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="max-w-6xl">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <FileCode className="w-8 h-8 text-orange-600" />
                    <h1 className="text-3xl font-bold text-gray-900">Bayi XML Yönetimi</h1>
                </div>
                <button
                    onClick={loadData}
                    className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 transition"
                >
                    <RefreshCw className="w-4 h-4" />
                    Yenile
                </button>
            </div>

            {/* XML İçe Aktarma */}
            <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 mb-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <UploadCloud className="w-5 h-5 text-orange-600" />
                            XML İçe Aktarma
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Ürünler, kategoriler, markalar, stoklar ve görseller panel XML yapısına göre güncellenir.
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                        <button
                            onClick={() => handleImportXML(true)}
                            disabled={importing}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
                        >
                            {importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                            Önizle
                        </button>
                        <button
                            onClick={() => handleImportXML(false)}
                            disabled={importing}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition disabled:opacity-50"
                        >
                            {importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                            İçe Aktar
                        </button>
                    </div>
                </div>

                <div className="mt-4">
                    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end">
                        <label className="block flex-1 text-sm font-medium text-gray-700">
                            Kayıtlı XML Kaynakları
                            <select
                                value={selectedSourceId || ''}
                                onChange={(e) => handleSelectSource(e.target.value)}
                                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                            >
                                <option value="">Yeni XML kaynağı</option>
                                {importSources.map(source => (
                                    <option key={source.id} value={source.id}>{source.name}</option>
                                ))}
                            </select>
                        </label>
                        <button
                            type="button"
                            onClick={handleNewSource}
                            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                        >
                            Yeni Kaynak Ekle
                        </button>
                    </div>

                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Kaynak Adı
                    </label>
                    <input
                        type="text"
                        value={importSourceName}
                        onChange={(e) => setImportSourceName(e.target.value)}
                        placeholder="Örn. Ana tedarikçi"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                    />
                </div>

                <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        XML Kaynağı
                    </label>
                    <input
                        type="url"
                        value={importUrl}
                        onChange={(e) => setImportUrl(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                    />
                </div>

                <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Izinli XML Hostlari
                    </label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                            type="text"
                            value={importAllowedHosts}
                            onChange={(e) => setImportAllowedHosts(e.target.value)}
                            placeholder="panel.efsanebaharat.com, tedarikci.example.com"
                            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                        />
                        <button
                            type="button"
                            onClick={handleSaveImportSettings}
                            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
                        >
                            Kaynağı Kaydet
                        </button>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                        Düzenli XML içe aktarması için kaynak domain burada izinli olmalıdır.
                    </p>
                </div>

                <div className="mt-4 max-w-xs">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        XML Güncelleme Süresi (dakika)
                    </label>
                    <input
                        type="number"
                        min="1"
                        max="10080"
                        step="1"
                        value={updateIntervalMinutes}
                        onChange={(e) => setUpdateIntervalMinutes(Number(e.target.value))}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                    />
                    <p className="mt-1 text-xs text-gray-500">Her kaynak için ayrı süre belirleyebilirsiniz.</p>
                </div>

                {importResult && (
                    <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                            <div>
                                <p className="text-xs text-gray-500">Okunan</p>
                                <p className="text-lg font-semibold text-gray-900">{importResult.parsed || 0}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Yeni Ürün</p>
                                <p className="text-lg font-semibold text-green-700">{importResult.createdProducts || 0}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Güncellenen</p>
                                <p className="text-lg font-semibold text-blue-700">{importResult.updatedProducts || 0}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Kategori</p>
                                <p className="text-lg font-semibold text-gray-900">{importResult.createdCategories || 0}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Marka</p>
                                <p className="text-lg font-semibold text-gray-900">{importResult.createdBrands || 0}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Görsel</p>
                                <p className="text-lg font-semibold text-gray-900">{importResult.insertedImages || 0}</p>
                            </div>
                        </div>

                        {importResult.sample && importResult.sample.length > 0 && (
                            <div className="mt-4 overflow-x-auto">
                                <table className="w-full min-w-[640px] text-sm">
                                    <thead>
                                        <tr className="text-left text-xs uppercase text-gray-500">
                                            <th className="py-2 pr-3">Kod</th>
                                            <th className="py-2 pr-3">Ürün</th>
                                            <th className="py-2 pr-3">Kategori</th>
                                            <th className="py-2 pr-3">Fiyat</th>
                                            <th className="py-2 pr-3">Stok</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {importResult.sample.map((item) => (
                                            <tr key={item.productCode}>
                                                <td className="py-2 pr-3 font-mono text-xs">{item.productCode}</td>
                                                <td className="py-2 pr-3">{item.name}</td>
                                                <td className="py-2 pr-3">{item.category || item.mainCategory}</td>
                                                <td className="py-2 pr-3">{item.price.toFixed(2)} ₺</td>
                                                <td className="py-2 pr-3">{item.stock}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Sistem Durum Kontrol Paneli */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-orange-600" />
                        Sistem Durum Paneli
                    </h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={runHealthCheck}
                            disabled={checking}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                        >
                            {checking ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                                <Activity className="w-4 h-4" />
                            )}
                            Kontrol Et
                        </button>
                    </div>
                </div>

                {/* Durum Kartları */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    {/* Ana Durum */}
                    <div className={`rounded-lg p-4 ${healthStatus.isHealthy ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                        <div className="flex items-center gap-2 mb-2">
                            {healthStatus.isHealthy ? (
                                <CheckCircle className="w-5 h-5 text-green-600" />
                            ) : (
                                <XCircle className="w-5 h-5 text-red-600" />
                            )}
                            <span className={`font-semibold ${healthStatus.isHealthy ? 'text-green-700' : 'text-red-700'}`}>
                                {healthStatus.isHealthy ? 'Çalışıyor' : 'Hata Var'}
                            </span>
                        </div>
                        <p className="text-sm text-gray-600">
                            {healthStatus.lastCheck
                                ? `Son kontrol: ${healthStatus.lastCheck.toLocaleTimeString('tr-TR')}`
                                : 'Henüz kontrol edilmedi'}
                        </p>
                    </div>

                    {/* Token Durumu */}
                    <div className={`rounded-lg p-4 ${xmlSettings?.xml_token ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                        <div className="flex items-center gap-2 mb-2">
                            {xmlSettings?.xml_token ? (
                                <CheckCircle className="w-5 h-5 text-green-600" />
                            ) : (
                                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                            )}
                            <span className={`font-semibold ${xmlSettings?.xml_token ? 'text-green-700' : 'text-yellow-700'}`}>
                                Token
                            </span>
                        </div>
                        <p className="text-sm text-gray-600">
                            {xmlSettings?.xml_token ? 'Aktif' : 'Oluşturulmamış'}
                        </p>
                    </div>

                    {/* Ürün Sayısı */}
                    <div className={`rounded-lg p-4 ${selectedProducts.length > 0 ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                        <div className="flex items-center gap-2 mb-2">
                            {selectedProducts.length > 0 ? (
                                <CheckCircle className="w-5 h-5 text-green-600" />
                            ) : (
                                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                            )}
                            <span className={`font-semibold ${selectedProducts.length > 0 ? 'text-green-700' : 'text-yellow-700'}`}>
                                Ürünler
                            </span>
                        </div>
                        <p className="text-sm text-gray-600">
                            {selectedProducts.length} ürün seçili
                        </p>
                    </div>

                    {/* Hata Sayısı */}
                    <div className={`rounded-lg p-4 ${healthStatus.errors.length === 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                        <div className="flex items-center gap-2 mb-2">
                            {healthStatus.errors.length === 0 ? (
                                <CheckCircle className="w-5 h-5 text-green-600" />
                            ) : (
                                <XCircle className="w-5 h-5 text-red-600" />
                            )}
                            <span className={`font-semibold ${healthStatus.errors.length === 0 ? 'text-green-700' : 'text-red-700'}`}>
                                Hatalar
                            </span>
                        </div>
                        <p className="text-sm text-gray-600">
                            {healthStatus.errors.length} hata kaydı
                        </p>
                    </div>
                </div>

                {/* Uyarılar */}
                {healthStatus.warnings.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                        <h3 className="font-semibold text-yellow-800 flex items-center gap-2 mb-2">
                            <AlertTriangle className="w-4 h-4" />
                            Uyarılar ({healthStatus.warnings.length})
                        </h3>
                        <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
                            {healthStatus.warnings.map((warning, index) => (
                                <li key={index}>{warning}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Hata Geçmişi */}
                {healthStatus.errors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold text-red-800 flex items-center gap-2">
                                <XCircle className="w-4 h-4" />
                                Hata Geçmişi ({healthStatus.errors.length})
                            </h3>
                            <button
                                onClick={clearErrors}
                                className="text-sm text-red-600 hover:text-red-800 transition"
                            >
                                Temizle
                            </button>
                        </div>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                            {healthStatus.errors.map((error) => (
                                <div key={error.id} className="bg-white rounded p-2 text-sm">
                                    <div className="flex items-center justify-between">
                                        <span className={error.type === 'error' ? 'text-red-700' : 'text-yellow-700'}>
                                            {error.message}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                            {error.timestamp.toLocaleTimeString('tr-TR')}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Token Yönetimi */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Key className="w-5 h-5 text-orange-600" />
                    Erişim Token'ı
                </h2>

                {xmlSettings?.xml_token ? (
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="flex-1 bg-gray-100 rounded-lg px-4 py-3 font-mono text-sm">
                                {showToken ? xmlSettings.xml_token : '••••••••••••••••••••••••••••••••'}
                            </div>
                            <button
                                onClick={() => setShowToken(!showToken)}
                                className="p-2 text-gray-500 hover:text-gray-700 transition"
                                title={showToken ? 'Gizle' : 'Göster'}
                            >
                                {showToken ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                            <button
                                onClick={handleCopyToken}
                                className="p-2 text-gray-500 hover:text-gray-700 transition"
                                title="Kopyala"
                            >
                                {copied ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
                            </button>
                        </div>

                        <div className="flex items-center gap-4">
                            <button
                                onClick={handleGenerateNewToken}
                                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition text-sm"
                            >
                                Yeni Token Oluştur
                            </button>
                            <p className="text-sm text-gray-500">
                                Bu token ile bayiler XML'e erişebilir
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-6">
                        <p className="text-gray-500 mb-4">Henüz erişim token'ı oluşturulmamış</p>
                        <button
                            onClick={handleGenerateNewToken}
                            className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition"
                        >
                            Token Oluştur
                        </button>
                    </div>
                )}
            </div>

            {/* XML Durumu */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Package className="w-5 h-5 text-orange-600" />
                    XML Durumu
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-orange-50 rounded-lg p-4">
                        <p className="text-sm text-orange-600 mb-1">Seçili Ürün Sayısı</p>
                        <p className="text-2xl font-bold text-orange-700">{selectedProducts.length}</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4">
                        <p className="text-sm text-blue-600 mb-1">Son Güncelleme</p>
                        <p className="text-sm font-medium text-blue-700">
                            {xmlSettings?.last_updated_at
                                ? new Date(xmlSettings.last_updated_at).toLocaleString('tr-TR')
                                : 'Henüz oluşturulmadı'}
                        </p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                        <p className="text-sm text-green-600 mb-1">XML Oluşturuldu</p>
                        <p className="text-sm font-medium text-green-700">
                            {lastGeneratedXML ? 'Evet - İndirmeye hazır' : 'Hayır'}
                        </p>
                    </div>
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={handleGenerateFeedXML}
                        disabled={generating || selectedProducts.length === 0}
                        className="flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {generating ? (
                            <RefreshCw className="w-5 h-5 animate-spin" />
                        ) : (
                            <FileCode className="w-5 h-5" />
                        )}
                        XML Oluştur
                    </button>

                    <button
                        onClick={handleOpenFeedXML}
                        disabled={!xmlSettings?.xml_token}
                        className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Download className="w-5 h-5" />
                        XML İndir
                    </button>
                </div>
            </div>

            {/* Seçili Ürünler Listesi */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b bg-gray-50">
                    <h2 className="text-lg font-semibold text-gray-900">
                        XML'e Dahil Edilecek Ürünler ({selectedProducts.length})
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Ürün Yönetimi sayfasından stok varyasyonlarındaki XML kutucuğunu işaretleyerek ürün ekleyebilirsiniz
                    </p>
                </div>

                {selectedProducts.length === 0 ? (
                    <div className="px-6 py-12 text-center text-gray-500">
                        <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>Henüz XML'e eklenmiş ürün yok</p>
                        <p className="text-sm mt-1">Ürün Yönetimi → Ürün Düzenle → Stok satırındaki XML kutucuğunu işaretleyin</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Görsel</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ürün</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Varyasyon</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fiyat</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stok</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kategori</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Marka</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {selectedProducts.map((product) => (
                                    <tr key={product.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3">
                                            {product.gorsel_url ? (
                                                <img
                                                    src={product.gorsel_url}
                                                    alt={product.urun_adi}
                                                    className="w-10 h-10 object-cover rounded"
                                                />
                                            ) : (
                                                <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center">
                                                    <Package className="w-5 h-5 text-gray-400" />
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{product.urun_adi}</td>
                                        <td className="px-4 py-3 text-sm text-gray-600">
                                            {product.birim_adedi} {product.birim_turu.toUpperCase()}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-600">{product.fiyat.toFixed(2)} ₺</td>
                                        <td className="px-4 py-3 text-sm text-gray-600">
                                            {product.stok_miktari} {product.stok_birimi.toUpperCase()}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-600">{product.kategori_adi}</td>
                                        <td className="px-4 py-3 text-sm text-gray-600">{product.marka_adi}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* XML Önizleme */}
            {lastGeneratedXML && (
                <div className="bg-white rounded-lg shadow-sm mt-6 overflow-hidden">
                    <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-gray-900">XML Önizleme</h2>
                        <button
                            onClick={() => setLastGeneratedXML(null)}
                            className="text-sm text-gray-500 hover:text-gray-700"
                        >
                            Kapat
                        </button>
                    </div>
                    <div className="p-4 bg-gray-900 overflow-x-auto">
                        <pre className="text-green-400 text-sm font-mono whitespace-pre-wrap">
                            {lastGeneratedXML}
                        </pre>
                    </div>
                </div>
            )}
        </div>
    )
}
