import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { SepetProvider } from './contexts/SepetContext'
import { ThemeProvider } from './contexts/ThemeContext'
import Layout from './components/Layout'
import AnaSayfa from './pages/AnaSayfa'
import Urunler from './pages/Urunler'
import UrunDetay from './pages/UrunDetay'
import Sepet from './pages/Sepet'
import Giris from './pages/Giris'
import Kayit from './pages/Kayit'
import Hesabim from './pages/Hesabim'
import OdemeBasarili from './pages/OdemeBasarili'
import OdemeBasarisiz from './pages/OdemeBasarisiz'
import EnCokSatan from './pages/EnCokSatan'
import Kampanyalar from './pages/Kampanyalar'
import BizeUlasin from './pages/BizeUlasin'
import Sorularim from './pages/Sorularim'
import AdminLayout from './components/admin/AdminLayout'
import AdminDashboard from './pages/admin/Dashboard'
import AdminUrunler from './pages/admin/UrunlerYonetim'
import AdminStokAzalan from './pages/admin/StokAzalan'
import BayiPanel from './pages/BayiPanel'
import BayiDashboard from './pages/BayiDashboard'
import AdminKategoriler from './pages/admin/Kategoriler'
import AdminMarkalar from './pages/admin/Markalar'
import AdminSiparisler from './pages/admin/Siparisler'
import AdminKargo from './pages/admin/Kargo'
import AdminBayiler from './pages/admin/Bayiler'
import AdminBayiSatislari from './pages/admin/BayiSatislari'
import AdminMusteriler from './pages/admin/Musteriler'
import AdminKampanyalar from './pages/admin/KampanyalarYonetim'
import AdminSorular from './pages/admin/Sorular'
import AdminCanliDestek from './pages/admin/CanliDestek'
import AdminIskontoGruplari from './pages/admin/IskontoGruplari'
import AdminAyarlar from './pages/admin/Ayarlar'
import AdminXMLYonetim from './pages/admin/XMLYonetim'
import './App.css'

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <SepetProvider>
          <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
              {/* Public routes */}
              <Route element={<Layout />}>
                <Route path="/" element={<AnaSayfa />} />
                <Route path="/urunler" element={<Urunler />} />
                <Route path="/urun/:id" element={<UrunDetay />} />
                <Route path="/sepet" element={<Sepet />} />
                <Route path="/giris" element={<Giris />} />
                <Route path="/kayit" element={<Kayit />} />
                <Route path="/hesabim" element={<Hesabim />} />
                <Route path="/bayi-panel" element={<BayiPanel />} />
                <Route path="/bayi-dashboard" element={<BayiDashboard />} />
                <Route path="/odeme-basarili" element={<OdemeBasarili />} />
                <Route path="/odeme-basarisiz" element={<OdemeBasarisiz />} />
                <Route path="/en-cok-satan" element={<EnCokSatan />} />
                <Route path="/kampanyalar" element={<Kampanyalar />} />
                <Route path="/bize-ulasin" element={<BizeUlasin />} />
                <Route path="/sorularim" element={<Sorularim />} />
              </Route>

              {/* Admin routes */}
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="urunler" element={<AdminUrunler />} />
                <Route path="kategoriler" element={<AdminKategoriler />} />
                <Route path="markalar" element={<AdminMarkalar />} />
                <Route path="siparisler" element={<AdminSiparisler />} />
                <Route path="kargo" element={<AdminKargo />} />
                <Route path="bayiler" element={<AdminBayiler />} />
                <Route path="bayi-satislari" element={<AdminBayiSatislari />} />
                <Route path="musteriler" element={<AdminMusteriler />} />
                <Route path="kampanyalar" element={<AdminKampanyalar />} />
                <Route path="sorular" element={<AdminSorular />} />
                <Route path="canli-destek" element={<AdminCanliDestek />} />
                <Route path="iskonto" element={<AdminIskontoGruplari />} />
                <Route path="stok-azalan" element={<AdminStokAzalan />} />
                <Route path="ayarlar" element={<AdminAyarlar />} />
                <Route path="xml-yonetim" element={<AdminXMLYonetim />} />
              </Route>
            </Routes>
          </Router>
        </SepetProvider>
      </ThemeProvider>
    </AuthProvider>
  )
}

export default App
