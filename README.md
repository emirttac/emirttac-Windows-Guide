# Windows 11 Kurulum Medyası Servisleme: Microsoft Yerel Araçlarıyla Teknik Referans

> **Kapsam:** Üçüncü taraf araç kullanmadan, yalnızca Microsoft araçlarıyla (DISM, Dism PowerShell modülü, `reg.exe`, `oscdimg`, Windows Setup) resmi Windows 11 kurulum medyasının incelenmesi, çevrimdışı olarak servislenmesi ve yeniden paketlenmesi için kavramsal bir referanstır.
>
> **Hedef:** Windows 11, sürüm 26H2 (yapı 26300) ve destekli önceki sürümler
> **Son doğrulama:** 22 Kasım 2026
>
> Bu belge Microsoft tarafından onaylanmış bir kılavuz değildir. Microsoft Learn belgeleriyle karşılaştırılarak hazırlanmıştır. Windows, Microsoft Corporation'ın ticari markasıdır.

---

## 1. Kapsam ve Sınırlar

Bu belge aşağıdakileri kapsar:

- Kurulum medyasının yapısı ve WIM/indeks mimarisi
- Çevrimdışı imaj servisleme (bağlama, değiştirme, kaydetme veya atma)
- Önyüklenebilir ISO üretimi ve UDF / ISO 9660 kararları
- Windows Setup betikleri ve yanıt dosyası mekanizmaları
- Doğrulama, günlükler ve sorun giderme

Kapsam dışıdır:

- Sistem gereksinimi denetimlerinin atlatılması
- Windows etkinleştirme (activation) mekanizmalarının değiştirilmesi
- Secure Boot, BitLocker, Windows Defender ve bellek bütünlüğü gibi güvenlik özelliklerinin devre dışı bırakılması
- Microsoft Edge ve WebView2 Runtime'ın kaldırılması (bkz. 10.4)
- Üçüncü taraf imaj düzenleme araçları

---

## 2. Referans Medya ve Doğrulama Durumu

| Özellik | Değer | Doğrulama kaynağı |
|---|---|---|
| Dosya adı | `Windows11_Client_x64_tr-tr_26300_9457.iso` | Dosya adı |
| Sürüm ve yapı | Windows 11 26H2, 10.0.26300.9457 | `install.wim` meta verisi, Microsoft sürüm tablosu |
| Yayın (yapı) | 2026-09-29, GA kanalı temel yapısı | Microsoft Windows 11 sürüm bilgileri |
| Dil ve mimari | tr-TR, x64 | `install.wim` meta verisi |
| `sources\install.wim` | 7.795.812.908 bayt (7,26 GiB) | Dosya boyutu |
| `sources\boot.wim` | 613.041.691 bayt (yaklaşık 585 MiB) | Dosya boyutu |
| BIOS önyükleme | `boot\etfsboot.com` | Dosya varlığı |
| UEFI önyükleme | `efi\microsoft\boot\efisys.bin`, `efisys_noprompt.bin` | Dosya varlığı |

**Güncellik notu:** Bu yapı (26300.9457), 26H2 için yayımlanan en güncel kümülatif yapının (26300.10075, 2026-11-19) gerisindedir. Kurulum sonrasında Windows Update ile veya çevrimdışı servisleme ile güncellenmelidir.

**Doğrulama kapsamı:** Bu belgedeki gözlemler; WIM XML meta verisinin ayrıştırılmasından, dosya varlığı ve boyut kontrollerinden ve winget paket meta verisinden alınmıştır. DISM bağlama, kaydetme ve ISO üretimi yönetici yetkisi gerektirdiğinden çalıştırılmamıştır. İlgili bölümler Microsoft Learn belgeleriyle eşleştirilmiştir.

---

## 3. Ön Koşullar ve Araçlar

### 3.1 Çalışma ortamı

- **Yetki:** Bağlama, kaydetme, `reg load` ve ISO üretimi için yükseltilmiş (yönetici) komut istemi zorunludur. Yükseltilmemiş oturumda DISM `Error: 740` ile çalışmayı reddeder (bu ortamda doğrulandı).
- **Bağlama dizini:** Boş olmalıdır ve Belgelerim gibi korumalı klasörlerde oluşturulmamalıdır (Microsoft önerisi).
- **Disk alanı:** Çalışma sürücüsünde WIM boyutunun birkaç katı kadar boş alan bulunmalıdır. Alan yetersizliğinde işlem yarıda kalırsa WIM dosyası bozulabilir.
- **Yol uzunluğu:** Derin dizin yapıları için uzun yol desteği (`LongPathsEnabled`) etkinleştirilmelidir.
- **Güvenlik yazılımı:** Gerçek zamanlı tarama bağlama ve kaydetme işlemlerini yavaşlatabilir veya kesebilir. Kurumsal ortamda istisna tanımları güvenlik ekibiyle koordine edilmelidir.
- **Salt okunur öznitelik:** Medyadan kopyalanan dosyalar salt okunur olabilir. İşlemden önce öznitelikleri kontrol edin.

### 3.2 Araç seti

| Araç | Kaynak | Görevi |
|---|---|---|
| `dism.exe` | Windows (ADK Dağıtım Araçları ile güncellenebilir) | WIM sorgulama, bağlama ve ayırma, paket, özellik ve sürücü servisleme, dışa aktarma, bölme |
| Dism PowerShell modülü | Windows | `Get-AppxProvisionedPackage`, `Remove-AppxProvisionedPackage` |
| `reg.exe` | Windows | Çevrimdışı kayıt defteri kovanlarını (hive) yükleme ve boşaltma |
| `oscdimg.exe` | Windows ADK, Dağıtım Araçları | Önyüklenebilir ISO üretimi |
| Windows Setup | Medya (`setup.exe`, `sources\boot.wim`) | Kurulum, betik ve yanıt dosyası işleme |
| Hyper-V | Windows Pro ve üzeri | Generation 2 sanal makinede doğrulama |
| Olay Görüntüleyici, `wevtutil`, `tracerpt` | Windows | `setup.etl` olay izlerinin çözümlenmesi |

**Not:** `oscdimg` için winget paketi `Microsoft.OSCDIMG` (sürüm 2.56, yayıncı: Microsoft) mevcuttur ve taşınabilir (portable) bir dağıtımdır. Üretim ortamlarında oscdimg sürümünün, kullanılan ADK sürümüyle eşleştirilmesi önerilir.

### 3.3 ADK sürüm politikası

| Hedef sürüm | ADK sürümü | Not |
|---|---|---|
| Windows 11 26H2, 25H2, 24H2 | **10.1.26100.9457 (Eylül 2026)** ve en güncel ADK servicing yaması | Bu medya için doğru sürüm ailesi |
| Windows 11 26H1 | 10.1.28000.3481 (Ekim 2026) | Yalnızca 26H1 medyası için |

Kurallar:

- Mümkünse çalışılan Windows sürümüyle eşleşen ADK kullanılmalıdır. Karma ortamlarda en yeni işletim sistemine uygun ADK tercih edilir. Yeni Dağıtım Araçları eski Windows sürümlerinde de çalışabilir.
- WSIM bileşeni için **CVE-2026-25166** kapsamında güncel ADK ve servicing yaması uygulanmalıdır.
- Üçüncü taraf KitBuilder bileşenindeki güvenlik açığı nedeniyle ADK 10.1.26100.2454 (Aralık 2024) ve sonrası sürümlere geçilmelidir.
- Windows 11 için 32-bit Windows PE desteklenmez.

---

## 4. Kurulum Medyasının Yapısı

| Yol | Görevi |
|---|---|
| `setup.exe`, `sources\setupplatform.exe` vb. | Kurulum başlatıcıları |
| `bootmgr`, `bootmgr.efi`, `bootmgfw.efi` | Windows Önyükleme Yöneticisi (BIOS ve UEFI). İmzalı dosyalardır; değiştirilmemelidir, aksi halde Secure Boot doğrulaması başarısız olur. |
| `boot\etfsboot.com` | BIOS El Torito önyükleme sektörü (platform `0x00`) |
| `efi\microsoft\boot\efisys.bin` | UEFI El Torito önyükleme imajı (platform `0xEF`) |
| `efi\microsoft\boot\efisys_noprompt.bin` | Adından anlaşıldığı üzere "tuşa basın" istemi olmayan UEFI varyantı |
| `efi\microsoft\boot\cdboot.efi`, `cdboot_noprompt.efi` | CD/DVD için UEFI önyükleyiciler |
| `boot\bcd`, `efi\microsoft\boot\bcd`, `boot\boot.sdi` | Önyükleme yapılandırma verisi (BCD) ve RAM disk imajı |
| `sources\boot.wim` | WinPE tabanlı kurulum ortamı |
| `sources\install.wim` | Windows imajı (6 indeks) |
| `sources\sxs\` | Özellik-üzerine-talep (Features on Demand) kaynakları: .NET Framework 3.5 (NetFx3) ve Internet Explorer isteğe bağlı paketleri |
| `support\logging\`, `sources\etwproviders\` | Kurulum ETW sağlayıcılarının yüklenmesi için betikler |

---

## 5. Sürüm İndeksleri ve WIM Mimarisi

### 5.1 WIM biçimi

- **Tek örnek depolama (single-instancing):** Aynı içerik WIM içinde yalnızca bir kez saklanır. Yeni bir indeks eklendiğinde yalnızca yeni dosyalar yazılır (`/Append-Image`).
- **Çoklu indeks:** Bir WIM dosyası birden çok imaj içerebilir. Her indeksin kendi `NAME`, `EDITIONID`, `BUILD`, `ARCH` ve `LANGUAGES` meta verisi vardır.
- **Sıkıştırma:** `/Compress` seçenekleri `fast` (varsayılan), `max`, `none` ve `recovery`'dir. `recovery` yalnızca `.esd` hedef dosyasıyla kullanılır.
- **Dışa aktarma:** `/Export-Image`, değiştirilmiş imajlarda birikmiş kullanılmayan kaynak dosyaları temizler ve imajı yeniden yazar.
- **ESD:** `install.esd` içeren medyalarda imaj, `/Export-Image` ile WIM biçimine dönüştürülerek servislenebilir.

### 5.2 Bu medyadaki indeksler

| Index | NAME | EDITIONID | Yapı | Açılmış boyut (yaklaşık) |
|---|---|---|---|---|
| 1 | Windows 11 Home | Core | 10.0.26300 | 23,7 GiB |
| 2 | Windows 11 Home Single Language | CoreSingleLanguage | 10.0.26300 | 23,7 GiB |
| 3 | Windows 11 Education | Education | 10.0.26300 | 24,7 GiB |
| 4 | Windows 11 Pro | Professional | 10.0.26300 | 24,7 GiB |
| 5 | Windows 11 Pro Education | ProfessionalEducation | 10.0.26300 | 24,7 GiB |
| 6 | Windows 11 Pro for Workstations | ProfessionalWorkstation | 10.0.26300 | 24,7 GiB |

> **Uyarı:** Bu eşleme yalnızca bu medyaya (26300.9457, tr-TR, x64) aittir. İndeks numaraları sürümler arasında sabit değildir. Bir medyada 1 numaralı indeks Home iken başka bir medyada farklı bir sürüm olabilir. Eşleme her zaman şu komutun çıktısıyla doğrulanmalıdır:
>
> ```
> dism /Get-ImageInfo /ImageFile:<KAYNAK>\sources\install.wim
> ```

Sürüm lisansı ve etkinleştirme, seçilen indekse göre değişebilir. Her indeksin lisans koşulları Microsoft'un ilgili belgelerinden doğrulanmalıdır.

### 5.3 Sürüm yükseltme davranışı

Mount edilmiş imajda yapılan değişiklikler, imajdaki hedef sürümlerin tümüne uygulanır ve üst sürüme geçişte korunur (Microsoft belgesi).

---

## 6. Çevrimdışı İmaj Servisleme

### 6.1 Yaşam döngüsü

1. **Seçim:** `dism /Get-ImageInfo` ile indeks doğrulanır.
2. **Bağlama:** `/Mount-Image /Index:<n> /MountDir:<boş dizin>`. İnceleme için `/ReadOnly`, ilk bağlama süresini azaltmak için `/Optimize` kullanılabilir. `/Optimize` ilk dizin erişimini yavaşlatabilir.
3. **Değişiklik:** Dosya, paket, özellik, sürücü, kayıt defteri ve kullanıcı varsayılanları.
4. **Doğrulama:** `/Get-MountedImageInfo`, `/Get-Features /Format:Table`, `/Get-ProvisionedAppxPackages`.
5. **Kalıcılaştırma:** `/Commit-Image` (imaj bağlı kalır) veya `/Unmount-Image /Commit`.
6. **Atma:** `/Unmount-Image /Discard` tüm değişiklikleri siler. Yalnızca bilinçli geri dönüş için kullanılmalıdır.
7. **Optimizasyon (isteğe bağlı):** `/Cleanup-Image /StartComponentCleanup /ResetBase`, ardından `/Export-Image`. `/ResetBase`, önceki bileşenlerin kaldırılmasını kalıcı olarak engeller.
8. **Paketleme:** Değiştirilmiş `install.wim`, ISO veya USB kök dizinine yerleştirilir.

### 6.2 Servisleme alanları

| Alan | Yöntem | Etki | Not |
|---|---|---|---|
| Hazır (provisioned) uygulamalar | `Get-` ve `Remove-AppxProvisionedPackage` (Dism modülü); `/Get-ProvisionedAppxPackages`, `/Remove-ProvisionedAppxPackage` | Yeni kullanıcı profilleri | Mevcut kullanıcıların uygulamalarını etkilemez (bkz. 10) |
| Paketler (.cab, .msu) | `/Add-Package`, `/Remove-Package` | Sistem bileşenleri ve güncellemeler | Sıra ve bağımlılık önemlidir. Yanlış sürüm uyumsuzluk yaratır. |
| Özellikler | `/Enable-Feature /FeatureName:<ad> /All /LimitAccess /Source:<medya>\sources\sxs` | İsteğe bağlı Windows özellikleri | `/LimitAccess`, Windows Update ve WSUS erişimini engeller |
| Sürücüler | `/Add-Driver /Driver:<yol> /Recurse` | Donanım sürücüleri | Sürücü imzası ve mimari uyumu gerekir |
| Dil paketleri | Ayrı çevrimdışı dil paketi akışı | Görüntüleme ve yazım dilleri | Hedef sürüm ve mimariyle eşleşmelidir |
| Varsayılan kullanıcı profili | `reg load` ve `reg unload` ile `Users\Default\NTUSER.DAT` | Yeni kullanıcılar | Mevcut profiller etkilenmez |
| Makine kayıt defteri | İmajın `Windows\System32\config` kovanları, `reg load` ile | Politikalar ve sistem ayarları | Riskli. Belgelenmiş ayar yolları tercih edilmelidir. |
| Dosya ve varlıklar | Bağlama dizinine doğrudan kopyalama | Duvar kağıdı, görseller | Windows Kaynak Koruma (WRP) ve güncellemeler dosyaları geri alabilir |
| Kurulum betikleri | `Windows\Setup\Scripts\` | Kurulum sonrası eylemler | Bkz. 8 |

### 6.3 Risk değerlendirmesi

| Risk | Etki | Azaltma |
|---|---|---|
| Yanlış indeks seçimi | Beklenmeyen sürüm kurulur | `/Get-ImageInfo` ile doğrulama |
| Yanlış `/Discard` | Tüm değişiklikler kaybolur | Komutu gözden geçirin. Önemli aşamalarda imaj kopyası alın. |
| Ayrılmamış bağlantı | Sonraki işlemler başarısız olur | `/Get-MountedImageInfo`, `/Remount-Image` |
| Yetersiz disk alanı | WIM dosyası bozulabilir | Yeterli boş alan. Bozulma halinde imaj yeniden üretilmelidir. |
| Açık kayıt defteri kovanı | `reg unload` başarısız olur | Regedit kapatılır, ardından kovan boşaltılır |
| Önyükleme dosyalarının değiştirilmesi | Secure Boot ve önyükleme hatası | Önyükleme dosyalarına dokunulmaz |
| Uyumsuz ADK veya DISM | Hatalı servisleme | Sürüm eşleştirme (bkz. 3.3) |
| Lisans ihlali | Hukuki risk | Bkz. 13 |

### 6.4 Kurtarma komutları

- `dism /Get-MountedImageInfo`: Bağlı imajları ve durumlarını listeler.
- `dism /Remount-Image /MountDir:<dizin>`: Erişilemez hale gelen bağlı imajı yeniden bağlar.
- `dism /Cleanup-Mountpoints`: Bozulmuş bağlama kaynaklarını temizler. Bağlı imajları ayırmaz ve yeniden bağlanabilir imajları silmez.

---

## 7. Önyükleme ve ISO Üretimi

### 7.1 Önyükleme modeli

- **BIOS:** El Torito girdisi, platform kimliği `0x00`, dosya `boot\etfsboot.com`.
- **UEFI:** El Torito girdisi, platform kimliği `0xEF`, dosya `efi\microsoft\boot\efisys.bin`.
- **Çoklu önyükleme:** Tek komutta iki girdi tanımlanır (`-bootdata:2`). Her girdi `p` (platform), `e` (disket emülasyonunu kapatır) ve `b` (önyükleme sektörü dosyası) ile belirtilir.

### 7.2 oscdimg parametre referansı

| Parametre | Açıklama |
|---|---|
| `-m` | Varsayılan imaj boyut sınırını yok sayar. `-maxsize` ile birlikte kullanılamaz. |
| `-o` | Yinelenen dosyaları MD5 ile karşılaştırır ve her birini yalnızca bir kez kodlar. `-oc` bayt bayt karşılaştırma yapar ve daha yavaştır. |
| `-u1` | Hem UDF hem ISO 9660 (8.3 adları) yazar. Hedef sistemin uyumluluğuna göre seçilir ve her iki görünümün de test edilmesi önerilir. |
| `-u2` | Yalnızca UDF yazar. UDF okuyamayan sistemler yalnızca bilgilendirme dosyası görür. |
| `-udfver102` | UDF 1.02 sürümünü belirtir. |
| `-l<etiket>` | Birim etiketi. Boşluk içermemelidir. |
| `-h` | Gizli dosya ve dizinleri dahil eder. |
| `-g` | Zaman damgalarını UTC olarak kodlar. |

Sözdizimi şablonu (yer tutucularla):

```
oscdimg -m -o -u2 -udfver102 -bootdata:2#p0,e,b"<KAYNAK>\boot\etfsboot.com"#pEF,e,b"<KAYNAK>\efi\microsoft\boot\efisys.bin" "<KAYNAK>" "<HEDEF>.iso"
```

### 7.3 Dosya sistemi kararı

- `install.wim` (7,26 GiB) klasik ISO 9660 dosya sistemindeki 4 GiB'lik dosya sınırını aşar. Bu nedenle `install.wim` içeren medyada **UDF zorunludur** (`-u1` veya `-u2`).
- USB medya oluşturulurken FAT32'nin 4 GiB dosya sınırı nedeniyle iki yol vardır:
  - **NTFS:** Veri bölümü NTFS olarak biçimlendirilir. UEFI önyüklemesi için FAT32 önyükleme bölümü gerekir (çift bölümlü düzen).
  - **Bölme:** `dism /Split-Image` ile `install.wim`, `.swm` parçalarına ayrılır. Parça boyutu FAT32 sınırının altında seçilmelidir (ör. 4000 MB). Setup, bölünmüş medyadan `setup.exe /InstallFrom:install.swm` ile çalışabilir.

### 7.4 ISO doğrulama

- Üretilen ISO'nun SHA-256 özetini kaydedin: `Get-FileHash -Algorithm SHA256 <ISO>`.
- Sanal makinede BIOS ve UEFI önyüklemesini ayrı ayrı test edin.
- Medya içindeki `install.wim` için `dism /Get-ImageInfo` çıktısını arşivleyin.

---

## 8. Kurulum Sırasında ve Sonrasında Otomasyon

### 8.1 Yanıt dosyası (unattend.xml)

- Windows Setup, yapılandırma geçişlerini (configuration passes) sırayla işler. Başlıca geçişler: `windowsPE`, `offlineServicing`, `generalize`, `specialize`, `auditSystem`, `auditUser` ve `oobeSystem`.
- `offlineServicing` geçişi, DISM ile çevrimdışı imaja uygulanabilir: `dism /Image:<dizin> /Apply-Unattend:<dosya>`. Bağımlılığı olan paket işlemlerinde doğru sıra bu yolla güvenle yönetilir.
- Oturum açmadan sonra çalışacak komutlar `FirstLogonCommands` ile tanımlanır. Bu komutlar bir sonraki açılışta tetiklenir. Audit modunda tetiklenmemesi için `Microsoft-Windows-Deployment\Reseal\Mode = Audit` ayarı kullanılır.
- Microsoft, uzun betiklerin kullanıcının masaüstüne ulaşmasını geciktirebileceği konusunda uyarır. Betikler kısa tutulmalıdır.

### 8.2 SetupComplete.cmd

- **Konum:** `%WINDIR%\Setup\Scripts\SetupComplete.cmd`
- **Yetki:** Yerel Sistem (LocalSystem)
- **Zamanlama:** Microsoft belgesi iki farklı zamanlama tanımlar. "Order of operations" bölümünde kurulum sonrasında ve oturum açma ekranından önce; giriş bölümünde ise masaüstü görüntülendikten hemen sonra çalıştığı belirtilir. Betik her iki durumda da doğru sonuç üretecek şekilde yazılmalıdır (idempotent).
- **Çıkış kodu:** Setup, betiğin çıkış kodunu denetlemez.
- **Yeniden başlatma:** Betik içinde `shutdown -r` gibi yeniden başlatma komutları kullanılmamalıdır. Kurulum durumu bozulur ve betik devam ettirilemez.
- **Etki alanı:** Etki alanına katılan makinelerde, betik tamamlanana kadar etki alanı grup ilkeleri uygulanmaz.
- **Ürün anahtarı türü:** Belgeye göre OEM ürün anahtarlarıyla yapılan kurulumlarda bu özellik, Enterprise ve Server sürümleri dışında devre dışı kalabilir.
- **Günlük:** `C:\Windows\Panther\UnattendGC\setupact.log`

### 8.3 ErrorHandler.cmd

- **Konum:** `%WINDIR%\Setup\Scripts\ErrorHandler.cmd`
- Kurulum ciddi bir hatayla durduğunda çalışır. Yerel Sistem yetkisiyle senkron olarak yürütülür ve birden çok kez çağrılabilir. Bu nedenle idempotent yazılmalıdır.
- Medya dışından `Setup /m:<klasör>` seçeneğiyle de sağlanabilir.

### 8.4 Sürüme özgü davranışlar

- **Windows 11 Home:** İlk kurulumda internet bağlantısı ve Microsoft Hesabı gerektirir (resmi gereksinimler belgesi). Kurulum otomasyonu planlanırken bu davranış dikkate alınmalıdır.
- **OOBE ve hesap politikaları:** Sürüme göre değişebilir. OOBE davranışını atlatmaya yönelik yöntemler bu belgenin kapsamı dışındadır.

---

## 9. Kullanıcı Varsayılanları ve Kayıt Defteri

### 9.1 Varsayılan kullanıcı profili

- **Konum:** `C:\Users\Default\NTUSER.DAT`. Çevrimdışı imajda `<bağlama dizini>\Users\Default\NTUSER.DAT`.
- **Durum:** Varsayılan kullanıcı kovanı Kayıt Defteri'nde varsayılan olarak yüklü değildir. Düzenlemek için `reg load` ile yüklenmeli, işlem bitince `reg unload` ile boşaltılmalıdır.
- **Kapsam:** Yalnızca yeni oluşturulan kullanıcı profillerini etkiler.
- **Microsoft yöntemi:** Belgelenmiş yaklaşım, referans makinede profili hazırlayıp `CopyProfile` ile varsayılan profile kopyalamaktır.
- **Varsayılan uygulamalar:** Windows, kullanıcının ilk oturumunda varsayılan uygulama ilişkilendirmelerini `oemdefaultassociations.xml` dosyasından yükleyebilir (Microsoft belgesi).

### 9.2 Referans kayıt defteri anahtarları

Bu tablo başvuru amaçlıdır. Her değer hedef sürümde sanal makinede doğrulanmalıdır.

| Ayar | Anahtar | Değer ve anlamı |
|---|---|---|
| Masaüstü simgesi: Bu Bilgisayar | `HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\HideDesktopIcons\NewStartPanel` → `{20D04FE0-3AEA-1069-A2D8-08002B30309D}` | `0` = görünür |
| Masaüstü simgesi: Geri Dönüşüm Kutusu | Aynı anahtar → `{645FF040-5081-101B-9F08-00AA002F954E}` | `0` = görünür |
| Koyu mod: uygulamalar | `HKCU\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize` → `AppsUseLightTheme` | `0` = koyu |
| Koyu mod: sistem | `HKCU\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize` → `SystemUsesLightTheme` | `0` = koyu |
| Görev çubuğu: Widgets | `HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced` → `TaskbarDa` | `0` = gizli |
| Görev çubuğu: Sohbet | `HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced` → `TaskbarMn` | `0` = gizli |
| Duvar kağıdı | `HKCU\Control Panel\Desktop` → `Wallpaper`, `WallpaperStyle`, `TileWallpaper` | Stil: `0` ortala, `2` uzat, `6` sığdır, `10` doldur, `22` yay |
| Widgets politikası | `HKLM\SOFTWARE\Policies\Microsoft\Dsh` → `AllowNewsAndInterests` | `0` = kapalı |

Politika anahtarları ve varsayılan davranışlar sürümler arasında değişebilir. Başvuru kaynağı olarak Microsoft'un Policy CSP ve ADMX belgeleri kullanılmalıdır.

### 9.3 Yükleme ve boşaltma kuralları

- Yükleme: `reg load HKLM\<geçici-ad> "<bağlama dizini>\Users\Default\NTUSER.DAT"`
- Boşaltma: `reg unload HKLM\<geçici-ad>`
- Kovan açık kaldığında boşaltma başarısız olur. Kayıt defteri düzenleyicisi pencereleri kapatılmalıdır.
- Geçici ad benzersiz olmalı ve mevcut bir kovanla çakışmamalıdır.

---

## 10. Hazır (Provisioned) Uygulamalar

### 10.1 Kavram

- Hazır uygulamalar, Windows imajına eklenmiş AppX/MSIX paketleridir. Yeni kullanıcı hesapları oluşturulduğunda bu paketler kullanıcıya otomatik olarak yüklenir.
- Hazır paket kaldırma yalnızca yeni kullanıcılar için etkilidir. Mevcut kullanıcılardaki paketler kaldırılmaz. Kullanıcı bazlı kaldırma için `Remove-AppxPackage` kullanılır.

### 10.2 Komut modeli

```powershell
# Çevrimdışı imajdaki hazır paketleri listele
Get-AppxProvisionedPackage -Path <BAĞLAMA_DİZİNİ> | Select-Object DisplayName, PackageName

# Tam paket adıyla kaldır
Remove-AppxProvisionedPackage -Path <BAĞLAMA_DİZİNİ> -PackageName <TAM_PAKET_ADI>
```

Ek parametreler: `-LogPath` (varsayılan `%WINDIR%\Logs\Dism\dism.log`) ve `-ScratchDirectory` (yerel bir dizin olmalıdır).

### 10.3 Operasyonel ilkeler

- Silmeden önce listeleme yapın ve her paketin sistem bağımlılığını değerlendirin.
- Joker karakterli eşleşmeler (`*Ad*`) beklenmeyen paketleri de kapsayabilir. Tam `PackageName` değeriyle çalışın.
- Paket adları sürüme ve dile göre değişebilir. Değerler her hedef imajda yeniden alınmalıdır.
- Sistem bileşeni niteliğindeki paketler (kabuk, Store altyapısı vb.) kaldırıldığında beklenmeyen davranışlar görülebilir. Her değişiklik sanal makinede test edilmelidir.

### 10.4 Microsoft Edge ve WebView2 Runtime

- Microsoft, Microsoft Edge'i Windows'un temel bileşeni olarak tanımlar ve kaldırılamayacağını belirtir.
- WebView2 Runtime, Teams ve Office gibi birçok uygulama tarafından kullanılır.
- Kurulum sırasında Edge veya WebView2 dosyalarının ya da hizmetlerinin silinmesi, kurulum sonrasında kararsızlığa ve uygulama hatalarına yol açabilir. Bu nedenle bu belge Edge veya WebView2 kaldırma yöntemi içermez.

---

## 11. Doğrulama

### 11.1 Test ortamı (Hyper-V)

- **Sürüm:** Windows Pro veya üzeri (istemci Hyper-V).
- **Sanal makine:** Generation 2. Secure Boot, Generation 2 sanal makinelerde varsayılan olarak etkindir.
- **vTPM:** Windows 11 TPM 2.0 gerektirir. Generation 2 sanal makineye vTPM eklenerek BitLocker ve TPM tabanlı özellikler sınanabilir.
- **Donanım referansı (Microsoft resmi gereksinimleri):** 64-bit, en az 2 çekirdekli 1 GHz+ işlemci; 4 GB+ RAM; 64 GB+ depolama; DirectX 12 ve WDDM 2.0 sürücü; UEFI Secure Boot destekli firmware; TPM 2.0; 720p (9") ekran.

### 11.2 Kontrol listesi

- [ ] ISO SHA-256 özeti kaydedildi
- [ ] `install.wim` indeksleri `dism /Get-ImageInfo` ile doğrulandı
- [ ] BIOS ve UEFI önyüklemesi ayrı ayrı test edildi
- [ ] Kurulan sürüm ve indeks eşleşiyor: `DISM /Online /Get-CurrentEdition`
- [ ] `C:\Windows\Panther\UnattendGC\setupact.log` içinde betik eylemleri kayıtlı
- [ ] Yeni yerel kullanıcıda varsayılan profil ayarları kontrol edildi
- [ ] Hazır paket durumu `Get-AppxPackage -AllUsers` ile doğrulandı
- [ ] Secure Boot durumu: `Confirm-SecureBootUEFI`
- [ ] Cihaz şifreleme durumu: `manage-bde -status`
- [ ] Windows Update durumu ve yapı numarası kontrol edildi

---

## 12. Sürüm Yaşam Döngüsü ve Güncellemeler

### 12.1 Windows 11 sürüm durumu

Kaynak: Microsoft Learn, Windows 11 sürüm bilgileri (2026-11-19 güncellemesi).

| Sürüm (yapı) | Yayın (GA) | Home, Pro, Pro Education, Pro for Workstations destek sonu | Enterprise, Education destek sonu | Güncel yapı |
|---|---|---|---|---|
| 26H2 (26300) | 2026-09-29 | 2028-10-10 | 2029-10-09 | 26300.10075 |
| 26H1 (28000) | 2026-02-10 | 2028-03-14 | 2029-03-13 | 28000.3620 |
| 25H2 (26200) | 2025-09-30 | 2027-10-12 | 2028-10-10 | 26200.10075 |
| 24H2 (26100) | 2024-10-01 | Destek sona erdi | 2027-10-12 | 26100.9974 |
| 23H2 (22631) | 2023-10-31 | Destek sona erdi | Destek sona erdi | 22631.7714 |

Ek notlar:

- Özellik güncellemeleri Home, Pro, Pro for Workstations ve Pro Education için 24 ay, Enterprise ve Education için 36 ay destek sağlar.
- 26H1 yalnızca 2026'da piyasaya çıkan yeni cihazlar içindir. 24H2 veya 25H2 cihazlarda yerinde yükseltme olarak sunulmaz. IoT Enterprise bu sürümde desteklenmez.
- Enterprise LTSC 2024 (24H2 temelli) için destek sonu 2029-10-09'dur. IoT Enterprise LTSC 2024 için genişletilmiş destek sonu 2034-10-10'dur.

### 12.2 26H2 dağıtım modeli

26H2, 24H2 ve 25H2 ile aynı bakım dalını (servicing branch) paylaşır. 24H2 ve 25H2 cihazlarda geçiş, etkinleştirme paketi (enablement package, eKB) ile yapılır. ISO medyası ise temiz kurulum ve yeniden imaj oluşturma için kullanılır (Windows Insider Blog, Release Preview duyurusu).

### 12.3 Çevrimdışı güncelleme

- Güncelleme paketleri `/Add-Package` ile eklenir. Paketin sürümü, mimarisi ve hedef imaj sürümü eşleşmelidir.
- Servisleme sonrasında bileşen deposu temizlenebilir: `/Cleanup-Image /StartComponentCleanup`. `/ResetBase` eklenirse önceki bileşen sürümlerine geri dönüş kalıcı olarak kapanır.
- Güncelleme sonrası yapı numarası, sürüm bilgileri sayfasındaki güncel yapıyla karşılaştırılmalıdır.

---

## 13. Güvenlik, Lisans ve Dağıtım Sınırları

- **Kaynak:** Yalnızca Microsoft'un resmi kaynaklarından alınmış medya kullanılmalıdır. SHA-256 özeti resmi yayınla karşılaştırılmalıdır.
- **Lisans:** Windows, Microsoft Yazılım Lisans Koşulları'na tabidir. Değiştirilmiş medyanın çoğaltılması, dağıtılması ve etkinleştirilmesi bu koşullarla sınırlanabilir. Hukuki değerlendirme gereklidir.
- **Bu depo:** Bu belgeyi içeren depoda Windows ISO içeriği (`install.wim`, `sources\`, `boot\`, `efi\` vb.) bulunmamalıdır. GitHub dosya başına 100 MiB sınırı uygular. Microsoft ikili dosyalarının yeniden yayımlanması lisans ihlali oluşturabilir.
- **Güvenlik özellikleri:** Secure Boot, cihaz şifreleme veya BitLocker, Windows Defender ve bellek bütünlüğü devre dışı bırakılmamalıdır.
- **Güvenlik güncellemeleri:** ADK ve servicing yamaları güncel tutulmalıdır (bkz. 3.3).
- **Kurumsal alternatif:** Yönetilen cihazlarda imaj düzenleme yerine Windows Autopilot ve Microsoft Intune gibi yönetim çözümleri tercih edilmelidir.

---

## 14. Günlükler ve Sorun Giderme

### 14.1 Günlük konumları

| Konum | İçerik |
|---|---|
| `X:\Windows\Panther\` | Diske erişim öncesi kurulum günlükleri (WinPE) |
| `%WINDIR%\Panther\` | Disk yapılandırmasından sonraki kurulum eylemleri, `setuperr.log` |
| `%WINDIR%\Panther\UnattendGC\setupact.log` | SetupComplete ve yanıt dosyası eylemleri |
| `%WINDIR%\Panther\setup.etl` | Kurulum performans olayları (Olay Görüntüleyici veya `wevtutil qe /lf` ile) |
| `%WINDIR%\Logs\Dism\dism.log` | DISM varsayılan günlüğü |
| `%WINDIR%\Inf\setupapi*.log` | PnP sürücü kurulum günlükleri |
| `%WINDIR%\Minidump.dmp`, `%WINDIR%\Memory.dmp` | Çekirdek hata dökümleri |

### 14.2 Sorun-çözüm matrisi

| Belirti | Olası neden | İlk kontrol |
|---|---|---|
| `Error: 740` | Yükseltilmiş yetki yok | Yönetici komut istemi |
| Bağlama başarısız | Hedef dizin boş değil veya korumalı bir klasörde | Boş ve korumalı olmayan dizin |
| Ayırma başarısız | Dizinde açık dosya veya Gezgin penceresi | Pencereleri kapatın, `/Get-MountedImageInfo` çalıştırın |
| Bağlı imaj erişilemez | Beklenmeyen kesinti | `/Remount-Image` |
| ISO üretiminde dosya boyutu hatası | ISO 9660 4 GiB sınırı | UDF kullanın (`-u1` veya `-u2`) |
| USB'ye `install.wim` kopyalanamıyor | FAT32 4 GiB sınırı | NTFS düzeni veya `/Split-Image` |
| SetupComplete çalışmadı | Dosya adı `.cmd.txt`, yanlış konum, OEM anahtarı kısıtı | Dosya uzantısı ve `setupact.log` |
| Varsayılan profil ayarları görünmüyor | Mevcut kullanıcı profili (yalnızca yeni profiller etkilenir) | Yeni yerel kullanıcıyla test |
| Hazır uygulama hâlâ görünüyor | Mevcut kullanıcı kurulumu veya farklı paket adı | `Get-AppxPackage -AllUsers` |
| Duvar kağıdı değişmedi | Sürüme özgü dosya yolu | Medyadaki `Windows\Web` altındaki gerçek dosya adları |
| Önyükleme yapılmıyor | Yanlış platform girdisi, Secure Boot veya UDF uyumsuzluğu | `-bootdata` platform kodları ve sanal makinede Secure Boot durumu |

**Duvar kağıdı notu:** Windows 11 varsayılan Bloom duvar kağıtlarının `Windows\Web\4K\Wallpaper\Windows` altında bulunduğu üçüncü taraf kaynaklarda belgelenmektedir. Eğitim materyallerindeki `Wallpaper\Windows\img0.jpg` yolu Windows 10 dönemine ait olabilir. Hedef medyada dosya adları doğrulanmalıdır.

---

## 15. Sözlük

| Terim | Açıklama |
|---|---|
| ADK | Windows Assessment and Deployment Kit. DISM ve oscdimg gibi dağıtım araçlarını içerir. |
| Commit / Discard | Bağlı imajdaki değişiklikleri kaydetme veya atma |
| eKB | Enablement package. Mevcut bakım dalına etkinleştirme paketi. |
| El Torito | CD/DVD önyükleme standardı |
| Features on Demand (FoD) | İsteğe bağlı Windows özellikleri ve yetenekleri |
| Hive (kovan) | Kayıt defteri dosyası (ör. `NTUSER.DAT`) |
| Index | WIM içindeki imaj numarası |
| ISO 9660 / UDF / Joliet | Optik medya dosya sistemleri |
| LCU | Latest Cumulative Update. En güncel kümülatif güncelleme. |
| Mount / Unmount | WIM içeriğini klasöre bağlama veya ayırma |
| OOBE | Out-of-Box Experience. İlk kurulum deneyimi. |
| Provisioned package | Yeni kullanıcılar için imaja eklenmiş AppX/MSIX paketi |
| `sources\sxs` | Yan yana (side-by-side) bileşen deposu |
| TPM 2.0 / vTPM | Donanım veya sanal güvenilir platform modülü |
| UEFI / Secure Boot | Firmware standardı ve imzalı önyükleme doğrulaması |
| WIM / ESD / SWM | Windows imaj biçimleri: sıkıştırılmış imaj ve bölünmüş WIM |
| WinPE | Windows Preinstallation Environment |
| WRP | Windows Resource Protection. Korumalı sistem dosyaları. |

---

## 16. Kaynaklar

- Windows 11 indirme: https://www.microsoft.com/software-download/windows11
- Windows 11 sürüm bilgileri: https://learn.microsoft.com/en-us/windows/release-health/windows11-release-information
- Windows 11 gereksinimleri: https://learn.microsoft.com/en-us/windows/whats-new/windows-11-requirements
- Windows 11 26H2 Release Preview duyurusu: https://blogs.windows.com/windows-insider/2026/08/27/releasing-windows-11-version-26h2-to-the-release-preview-channel/
- Windows ADK kurulumu: https://learn.microsoft.com/en-us/windows-hardware/get-started/adk-install
- DISM image management komutları: https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/dism-image-management-command-line-options-s14
- İmajı bağlama ve değiştirme: https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/mount-and-modify-a-windows-image-using-dism
- Çevrimdışı paket ekleme ve kaldırma: https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/add-or-remove-packages-offline-using-dism
- .NET Framework 3.5 (DISM ile çevrimdışı kurulum): https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/deploy-net-framework-35-by-using-deployment-image-servicing-and-management--dism?view=windows-11
- Oscdimg komut satırı seçenekleri: https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/oscdimg-command-line-options
- Kuruluma özel betik ekleme (SetupComplete, ErrorHandler): https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/add-a-custom-script-to-windows-setup
- Windows Setup günlük dosyaları: https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/windows-setup-log-files-and-event-logs
- WIM dosyasını bölme: https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/split-a-windows-image--wim--file-to-span-across-multiple-dvds?view=windows-11
- Varsayılan kullanıcı profili (CopyProfile): https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/customize-the-default-user-profile-by-using-copyprofile?view=windows-11
- Remove-AppxProvisionedPackage: https://learn.microsoft.com/en-us/powershell/module/dism/remove-appxprovisionedpackage
- Hyper-V Generation 2 güvenlik özellikleri: https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/generation-2-virtual-machine-security-features

---

*Belge sürümü: 2.0 · Son gözden geçirme: 22 Kasım 2026*
