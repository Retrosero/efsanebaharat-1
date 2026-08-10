# XML otomatik ürün güncellemesi

Bu kurulum, `https://efsanebaharat.appsgo.cloud/urunler.xml` kaynağını her 30 dakikada bir arka planda içe aktarır. Yönetim panelinin veya ziyaretçinin tarayıcısının açık kalması gerekmez.

1. Supabase SQL Editor'da önce `add_xml_import_sources.sql`, ardından `supabase/migrations/20260810_xml_auto_sync.sql` dosyasını açın.
2. İkinci dosyadaki iki `vault.create_secret` satırındaki yer tutucuları Supabase **Project URL** ve **service_role** anahtarınızla değiştirin. Service-role anahtarını site koduna veya Vite ortam değişkenine eklemeyin.
3. Edge Function'ı yayınlayın:

```bash
supabase functions deploy xml-auto-sync
```

4. Yönetim paneli > Bayi XML Yönetimi bölümünde kaynak adresinin `https://efsanebaharat.appsgo.cloud/urunler.xml`, izinli hostun `efsanebaharat.appsgo.cloud`, sürenin de `30` olduğunu doğrulayıp kaydedin.

İlk aktarımı isterseniz aynı ekrandaki **İçe Aktar** düğmesiyle hemen başlatabilirsiniz. Sonraki aktarımlar otomatik gerçekleşir.
