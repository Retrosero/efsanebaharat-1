import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, Eye, ShoppingCart, Sparkles } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useSepet } from '../contexts/SepetContext'
import { kademeliIskontoUygula } from '../utils/iskonto'
import { getImageUrl } from '../utils/imageUtils'

interface UrunKartProps {
  urun: any
  kampanya?: {
    indirim_tipi: 'yuzde' | 'tutar'
    indirim_degeri: number
  } | null
}

export default function UrunKart({ urun, kampanya }: UrunKartProps) {
  const { user, grupIskontoOrani, ozelIskontoOrani } = useAuth()
  const { sepeteEkle } = useSepet()
  const navigate = useNavigate()

  const [secilenStok, setSecilenStok] = useState<any>(null)
  const [eklendi, setEklendi] = useState(false)
  const [imgError, setImgError] = useState(false)

  useEffect(() => {
    if (urun.urun_stoklari && urun.urun_stoklari.length > 0) {
      setSecilenStok(urun.urun_stoklari[0])
    } else {
      setSecilenStok(null)
    }
    setImgError(false)
  }, [urun])

  const ilkGorsel = getImageUrl(urun.urun_gorselleri?.[0]?.gorsel_url)

  const fiyatBilgisi = useMemo(() => {
    if (!secilenStok) {
      return { satisFiyati: 0, eskiFiyat: 0, indirimVar: false, indirimOrani: 0 }
    }

    const hamFiyat = Number(secilenStok.fiyat || 0)
    const iskontoInfo = user
      ? kademeliIskontoUygula(hamFiyat, grupIskontoOrani, ozelIskontoOrani)
      : null

    if (kampanya) {
      const satisFiyati = kampanya.indirim_tipi === 'yuzde'
        ? hamFiyat * (1 - kampanya.indirim_degeri / 100)
        : Math.max(0, hamFiyat - kampanya.indirim_degeri)

      return {
        satisFiyati,
        eskiFiyat: hamFiyat,
        indirimVar: true,
        indirimOrani: kampanya.indirim_tipi === 'yuzde'
          ? kampanya.indirim_degeri
          : Math.round(((hamFiyat - satisFiyati) / Math.max(hamFiyat, 1)) * 100)
      }
    }

    if (iskontoInfo?.varMi) {
      return {
        satisFiyati: iskontoInfo.yeniFiyat,
        eskiFiyat: iskontoInfo.eskiFiyat,
        indirimVar: true,
        indirimOrani: iskontoInfo.oran
      }
    }

    return { satisFiyati: hamFiyat, eskiFiyat: hamFiyat, indirimVar: false, indirimOrani: 0 }
  }, [grupIskontoOrani, kampanya, ozelIskontoOrani, secilenStok, user])

  const handleSepeteEkle = () => {
    if (!user) {
      navigate('/giris')
      return
    }

    if (!secilenStok) return

    sepeteEkle({
      urun_id: urun.id,
      urun_adi: urun.urun_adi,
      birim_turu: secilenStok.birim_turu,
      birim_adedi: secilenStok.birim_adedi,
      birim_adedi_turu: secilenStok.birim_adedi_turu || secilenStok.birim_turu,
      birim_fiyat: fiyatBilgisi.satisFiyati,
      miktar: secilenStok.min_siparis_miktari || 1,
      gorsel_url: ilkGorsel,
      min_siparis_miktari: secilenStok.min_siparis_miktari
    })

    setEklendi(true)
    window.setTimeout(() => setEklendi(false), 2000)
  }

  return (
    <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-lg">
      <Link to={`/urun/${urun.id}`} className="relative block bg-zinc-100">
        <div className="aspect-[4/5] w-full overflow-hidden">
          {ilkGorsel && !imgError ? (
            <img
              src={ilkGorsel}
              alt={urun.urun_adi}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              loading="lazy"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_50%_35%,#fed7aa,#fafaf9_55%,#e7e5e4)] p-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-950 text-3xl font-bold text-white shadow-lg">
                {urun.urun_adi?.charAt(0) || 'E'}
              </div>
            </div>
          )}
        </div>

        {fiyatBilgisi.indirimVar && (
          <span className="absolute left-2 top-2 rounded-full bg-red-600 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
            %{Math.max(0, Math.round(fiyatBilgisi.indirimOrani))} indirim
          </span>
        )}

        {urun.urun_stoklari?.length > 1 && (
          <span className="absolute bottom-2 left-2 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-zinc-700 shadow-sm">
            {urun.urun_stoklari.length} sorti
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-3 sm:p-4">
        <div className="min-w-0 flex-1">
          <Link to={`/urun/${urun.id}`} className="block min-w-0">
            <h3 className="line-clamp-2 min-h-[2.75rem] text-sm font-bold leading-snug text-zinc-950 transition group-hover:text-orange-700 sm:text-base">
              {urun.urun_adi}
            </h3>
          </Link>
          <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs font-medium text-zinc-500">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-orange-500" />
            <span className="truncate">{urun.markalar?.marka_adi || urun.kategoriler?.kategori_adi || 'Efsane Baharat'}</span>
          </div>
        </div>

        {urun.urun_stoklari && urun.urun_stoklari.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {urun.urun_stoklari.map((stok: any) => (
              <button
                key={stok.id}
                type="button"
                onClick={() => setSecilenStok(stok)}
                className={`min-h-[36px] shrink-0 rounded-full border px-3 text-xs font-bold transition ${secilenStok?.id === stok.id
                  ? 'border-orange-600 bg-orange-600 text-white shadow-sm'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:border-orange-300'
                  }`}
              >
                {stok.birim_adedi || 1} {(stok.birim_adedi_turu || stok.birim_turu || '').toUpperCase()}
              </button>
            ))}
          </div>
        )}

        <div className="flex min-h-[44px] items-end justify-between gap-2">
          <div className="min-w-0">
            {secilenStok ? (
              <>
                <div className="text-lg font-bold leading-none text-zinc-950">
                  {fiyatBilgisi.satisFiyati.toFixed(2)} TL
                </div>
                {fiyatBilgisi.indirimVar && (
                  <div className="mt-1 text-xs font-semibold text-zinc-400 line-through">
                    {fiyatBilgisi.eskiFiyat.toFixed(2)} TL
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm font-semibold text-zinc-500">Stok seçiniz</div>
            )}
          </div>
        </div>

        {user ? (
          <button
            type="button"
            onClick={handleSepeteEkle}
            disabled={!secilenStok}
            className={`flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 ${eklendi
              ? 'bg-emerald-600 text-white'
              : 'bg-zinc-950 text-white hover:bg-orange-700'
              }`}
          >
            {eklendi ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
            <span>{eklendi ? 'Eklendi' : 'Sepete ekle'}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => navigate(`/urun/${urun.id}`)}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-bold text-zinc-800 transition hover:border-orange-300 hover:bg-orange-50"
          >
            <Eye className="h-4 w-4" />
            <span>Ürünü incele</span>
          </button>
        )}
      </div>
    </article>
  )
}
