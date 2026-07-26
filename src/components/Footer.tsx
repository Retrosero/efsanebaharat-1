import { Link } from 'react-router-dom'
import { Mail, MapPin, Phone, ShieldCheck, Sparkles, Truck } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-emerald-900/20 bg-zinc-950 text-zinc-300">
      <div className="shop-container py-10 sm:py-12">
        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="min-w-0">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-700 text-white">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xl font-bold text-white">Efsane Baharat</div>
                <div className="text-xs font-medium text-zinc-500">Premium baharat ve gıda</div>
              </div>
            </div>
            <p className="max-w-md text-sm leading-6 text-zinc-400">
              Günlük mutfaktan profesyonel kullanıma kadar taze, seçili ve güvenilir baharat ürünleri.
            </p>
            <div className="mt-5 grid gap-3 text-sm">
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-amber-500" />
                <span>0850 123 45 67</span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-amber-500" />
                <span>info@efsanebaharat.com</span>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-amber-500" />
                <span>İstanbul, Türkiye</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-white">Alışveriş</h3>
            <ul className="grid gap-2 text-sm">
              <li><Link to="/urunler" className="hover:text-white">Tüm Ürünler</Link></li>
              <li><Link to="/en-cok-satan" className="hover:text-white">En Çok Satanlar</Link></li>
              <li><Link to="/kampanyalar" className="hover:text-white">Kampanyalar</Link></li>
              <li><Link to="/sepet" className="hover:text-white">Sepetim</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-white">Hesap</h3>
            <ul className="grid gap-2 text-sm">
              <li><Link to="/giris" className="hover:text-white">Giriş Yap</Link></li>
              <li><Link to="/kayit" className="hover:text-white">Kayıt Ol</Link></li>
              <li><Link to="/hesabim" className="hover:text-white">Hesabım</Link></li>
              <li><Link to="/sorularim" className="hover:text-white">Sorularım</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-white">Güvence</h3>
            <div className="grid gap-3 text-sm text-zinc-400">
              <div className="flex gap-3">
                <Truck className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <span>Hızlı kargo ve takip bildirimi</span>
              </div>
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <span>Güvenli ödeme altyapısı</span>
              </div>
              <Link to="/bize-ulasin" className="shop-btn-secondary mt-2 border-zinc-700 bg-zinc-900 text-zinc-100 hover:border-amber-500 hover:text-white">
                Bize Ulaşın
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-zinc-800 pt-6 text-center text-xs text-zinc-500">
          (c) 2026 EfsaneBaharat.com - Tüm hakları saklıdır.
        </div>
      </div>
    </footer>
  )
}
