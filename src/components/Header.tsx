import { Link, NavLink, useNavigate } from 'react-router-dom'
import { ChevronDown, Menu, Search, ShoppingCart, Sparkles, User, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useSepet } from '../contexts/SepetContext'
import { supabase } from '../lib/supabase'
import { getImageUrl } from '../utils/imageUtils'
import { getMatchingCategoryIds } from '../utils/categorySearch'

const navLinks = [
  { to: '/', label: 'Ana Sayfa' },
  { to: '/urunler', label: 'Ürünler' },
  { to: '/en-cok-satan', label: 'En Çok Satanlar' },
  { to: '/kampanyalar', label: 'Kampanyalar' },
  { to: '/bize-ulasin', label: 'İletişim' },
]

export default function Header() {
  const { user, isAdmin, musteriData, signOut } = useAuth()
  const { sepetItems, toplamAdet } = useSepet()
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [showCategoryMenu, setShowCategoryMenu] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [kategoriler, setKategoriler] = useState<any[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    loadKategoriler()
  }, [])

  async function loadKategoriler() {
    const { data } = await supabase
      .from('kategoriler')
      .select('id, kategori_adi')
      .eq('aktif_durum', true)
      .is('ust_kategori_id', null)
      .order('sira_no')

    if (data) setKategoriler(data)
  }

  async function performSearch(query: string) {
    const searchTerm = query.trim()
    if (searchTerm.length < 2) {
      setSearchResults([])
      return
    }

    setSearchLoading(true)
    try {
      const { data: allCategories } = await supabase
        .from('kategoriler')
        .select('id, kategori_adi, ust_kategori_id')
        .eq('aktif_durum', true)

      const matchingCategoryIds = getMatchingCategoryIds(allCategories || [], searchTerm)
      const categoryNameById = new Map((allCategories || []).map((category) => [category.id, category.kategori_adi]))

      const nameSearch = supabase
        .from('urunler')
        .select('id, urun_adi, ana_gorsel_url, kategori_id')
        .eq('aktif_durum', true)
        .ilike('urun_adi', `%${searchTerm}%`)
        .limit(8)

      const categorySearch = matchingCategoryIds.length > 0
        ? supabase
          .from('urunler')
          .select('id, urun_adi, ana_gorsel_url, kategori_id')
          .eq('aktif_durum', true)
          .in('kategori_id', matchingCategoryIds)
          .order('urun_adi')
          .limit(8)
        : Promise.resolve({ data: [] })

      const [{ data: nameMatches }, { data: categoryMatches }] = await Promise.all([nameSearch, categorySearch])

      const mergedProducts = new Map<string, any>()
      for (const product of [...(nameMatches || []), ...(categoryMatches || [])]) {
        if (!mergedProducts.has(product.id)) {
          mergedProducts.set(product.id, product)
        }
      }

      const urunler = [...mergedProducts.values()].slice(0, 6)
      if (urunler.length === 0) {
        setSearchResults([])
        return
      }

      const results = await Promise.all(
        urunler.map(async (urun) => {
          const { data: stok } = await supabase
            .from('urun_stoklari')
            .select('fiyat, birim_turu')
            .eq('urun_id', urun.id)
            .eq('aktif_durum', true)
            .order('fiyat', { ascending: true })
            .limit(1)
            .maybeSingle()

          return { ...urun, ilkStok: stok, kategoriAdi: categoryNameById.get(urun.kategori_id) }
        }),
      )

      setSearchResults(results)
    } catch (error) {
      console.error('Arama hatası:', error)
      setSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    const query = searchQuery.trim()
    if (!query) return

    navigate(`/urunler?q=${encodeURIComponent(query)}`)
    setSearchQuery('')
    setSearchResults([])
    setSearchOpen(false)
    setMenuOpen(false)
  }

  function handleSearchChange(value: string) {
    setSearchQuery(value)
    performSearch(value)
  }

  function closeMenus() {
    setMenuOpen(false)
    setSearchOpen(false)
    setShowCategoryMenu(false)
    setShowUserMenu(false)
    setSearchResults([])
  }

  const cartCount = toplamAdet || sepetItems.length

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/95 backdrop-blur">
      <div className="shop-container">
        <div className="flex h-16 items-center justify-between gap-3">
          <Link to="/" className="flex min-w-0 items-center gap-3" onClick={closeMenus}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-800 text-white shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-lg font-bold tracking-tight text-zinc-950 sm:text-xl">Efsane Baharat</div>
              <div className="hidden text-xs font-medium text-zinc-500 sm:block">Premium baharat ve gıda</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    isActive ? 'bg-emerald-50 text-emerald-900' : 'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowCategoryMenu((value) => !value)}
                className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-950"
              >
                Kategoriler
                <ChevronDown className="h-4 w-4" />
              </button>
              {showCategoryMenu && (
                <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xl">
                  <Link to="/urunler" onClick={closeMenus} className="block px-4 py-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50">
                    Tüm ürünler
                  </Link>
                  <div className="max-h-80 overflow-y-auto border-t border-zinc-100 py-1">
                    {kategoriler.map((kategori) => (
                      <Link
                        key={kategori.id}
                        to={`/urunler?kategori=${kategori.id}`}
                        onClick={closeMenus}
                        className="block px-4 py-2 text-sm text-zinc-700 hover:bg-emerald-50 hover:text-emerald-900"
                      >
                        {kategori.kategori_adi}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {user && musteriData?.musteri_tipi === 'bayi' && (
              <NavLink to="/bayi-panel" className="rounded-lg px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100">
                Bayi Paneli
              </NavLink>
            )}
            {isAdmin && (
              <NavLink to="/admin" className="rounded-lg px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50">
                Admin
              </NavLink>
            )}
          </nav>

          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen((value) => !value)}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-700 transition hover:bg-zinc-100"
              aria-label="Arama"
            >
              <Search className="h-5 w-5" />
            </button>

            <Link
              to="/sepet"
              onClick={closeMenus}
              className="relative flex h-10 w-10 items-center justify-center rounded-lg text-zinc-700 transition hover:bg-zinc-100"
              aria-label="Sepet"
            >
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-600 px-1 text-[11px] font-bold text-white">
                  {cartCount}
                </span>
              )}
            </Link>

            {user ? (
              <div className="relative hidden sm:block">
                <button
                  type="button"
                  onClick={() => setShowUserMenu((value) => !value)}
                  className="flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
                >
                  <User className="h-5 w-5" />
                  Hesabım
                </button>
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xl">
                    <Link to="/hesabim" onClick={closeMenus} className="block px-4 py-3 text-sm text-zinc-700 hover:bg-zinc-50">
                      Profilim
                    </Link>
                    <Link to="/sorularim" onClick={closeMenus} className="block px-4 py-3 text-sm text-zinc-700 hover:bg-zinc-50">
                      Sorularım
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        closeMenus()
                        signOut()
                      }}
                      className="block w-full px-4 py-3 text-left text-sm text-zinc-700 hover:bg-zinc-50"
                    >
                      Çıkış Yap
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/giris" onClick={closeMenus} className="hidden rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 sm:inline-flex">
                Giriş Yap
              </Link>
            )}

            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-700 transition hover:bg-zinc-100 lg:hidden"
              aria-label="Menu"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {searchOpen && (
          <div className="border-t border-zinc-100 py-4">
            <form onSubmit={handleSearchSubmit} className="relative mx-auto max-w-3xl">
              <Search className="absolute left-4 top-3.5 h-5 w-5 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Baharat, kategori veya ürün ara..."
                className="shop-input pl-12 pr-24"
                autoFocus
              />
              <button type="submit" className="absolute right-1.5 top-1.5 min-h-0 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white">
                Ara
              </button>

              {(searchResults.length > 0 || searchLoading || searchQuery.trim().length >= 2) && (
                <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xl">
                  {searchLoading ? (
                    <div className="px-4 py-5 text-center text-sm text-zinc-500">Aranıyor...</div>
                  ) : searchResults.length > 0 ? (
                    <div className="divide-y divide-zinc-100">
                      {searchResults.map((urun) => (
                        <button
                          key={urun.id}
                          type="button"
                          onClick={() => {
                            navigate(`/urun/${urun.id}`)
                            closeMenus()
                          }}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-zinc-50"
                        >
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-zinc-100">
                            {urun.ana_gorsel_url ? (
                              <img src={getImageUrl(urun.ana_gorsel_url)} alt={urun.urun_adi} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-emerald-800 text-white">{urun.urun_adi.charAt(0)}</div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-zinc-900">{urun.urun_adi}</div>
                            {urun.kategoriAdi && <div className="truncate text-xs text-zinc-500">{urun.kategoriAdi}</div>}
                            {urun.ilkStok && <div className="text-sm font-bold text-amber-700">{Number(urun.ilkStok.fiyat).toFixed(2)} TL</div>}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-5 text-center text-sm text-zinc-500">Ürün bulunamadı</div>
                  )}
                </div>
              )}
            </form>
          </div>
        )}

        {menuOpen && (
          <div className="border-t border-zinc-100 py-4 lg:hidden">
            <div className="grid gap-1">
              {navLinks.map((link) => (
                <Link key={link.to} to={link.to} onClick={closeMenus} className="rounded-lg px-3 py-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-100">
                  {link.label}
                </Link>
              ))}
              <div className="rounded-lg bg-zinc-50 p-3">
                <div className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-500">Kategoriler</div>
                <div className="grid gap-1">
                  {kategoriler.slice(0, 8).map((kategori) => (
                    <Link key={kategori.id} to={`/urunler?kategori=${kategori.id}`} onClick={closeMenus} className="rounded-md px-2 py-2 text-sm text-zinc-700 hover:bg-white">
                      {kategori.kategori_adi}
                    </Link>
                  ))}
                </div>
              </div>
              {user ? (
                <>
                  <Link to="/hesabim" onClick={closeMenus} className="rounded-lg px-3 py-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-100">
                    Hesabım
                  </Link>
                  <button type="button" onClick={() => { closeMenus(); signOut() }} className="rounded-lg px-3 py-3 text-left text-sm font-semibold text-zinc-800 hover:bg-zinc-100">
                    Çıkış Yap
                  </button>
                </>
              ) : (
                <Link to="/giris" onClick={closeMenus} className="shop-btn-primary mt-2">
                  Giriş Yap
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
