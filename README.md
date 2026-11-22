# Windows Customization Guide by emirttac   
Bu belge, üçüncü taraf araç kullanmadan, yalnızca Microsoft'un kendi araçlarıyla resmi bir Windows 11 ISO'sunun içeriğinin nasıl incelendiğini ve düzenlendiğini anlatır. Adım adım bir kurulum kılavuzu değildir; kullanılan araçların, dosyaların ve kavramların ne olduğunu açıklar.
## Uyarılar
- Yalnızca Microsoft'un resmi kaynaklarından indirilen ISO ile çalışın.
- Her zaman orijinal ISO'nun ve klasörünün bir kopyası üzerinde çalışın.
- Yanlış yapılan değişiklikler sistemin açılmamasına veya beklenmeyen davranışlara yol açabilir.
- Düzenlenmiş imajların dağıtımı ve Windows etkinleştirme (activation) durumu Microsoft lisans koşullarına tabidir. Bunları kontrol edin.
- Bu belgede geçen sürüm numaraları, index değerleri ve paket adları her ISO için geçerli değildir. Kendi ISO'nuzda doğrulayın.
## Kullanılan Microsoft Araçları
| Araç | Ne işe yarar | Nereden gelir |
|---|---|---|
| **DISM** (`dism.exe`) | WIM imajının bilgisini okur, imajı bağlar (mount), değişiklikleri kaydeder veya atar (unmount). | Windows ile gelir |
| **DISM PowerShell modülü** (`Get-AppxProvisionedPackage`, `Remove-AppxProvisionedPackage`) | İmajdaki hazır (provisioned) uygulamaları listeler ve kaldırır. | Windows ile gelir |
| **Reg** (`reg.exe`) | Çevrimdışı kayıt defteri (registry) dosyalarını yükler, düzenler ve boşaltır. | Windows ile gelir |
| **oscdimg** (`oscdimg.exe`) | Klasör içeriğinden önyüklenebilir ISO dosyası oluşturur. | Windows ADK Dağıtım Araçları. `winget` üzerinden `Microsoft.OSCDIMG` kimliğiyle de kurulabilir. |
| **SetupComplete.cmd** | Windows kurulumu tamamlandıktan sonra çalışan bir betiktir. | Windows Kurulum mekanizması |
## ISO Dosyasının İçeriği
ISO, salt okunur bir disk imajıdır. Önemli bileşenleri şunlardır:
- **`sources\install.wim`** (bazı ISO'larda `install.esd`): Windows dosyalarının asıl sıkıştırılmış imajıdır. Birden fazla Windows sürümü içerebilir.
- **`boot\etfsboot.com`**: BIOS (eski) önyükleme için kullanılan önyükleyici dosyadır.
- **`efi\microsoft\boot\efisys.bin`**: UEFI önyüklemesi için kullanılan dosyadır.
- **`setup.exe`, `bootmgr`, `sources\`**: Kurulum programı ve yardımcı dosyalar.
> `install.esd` dosyası doğrudan bağlanamaz. Önce DISM ile WIM formatına dönüştürülmesi gerekir.
## Temel Kavramlar
### WIM ve Index
Bir WIM dosyası birden fazla imaj barındırabilir. Her imaj bir **index** numarasıyla anılır ve genellikle farklı bir Windows sürümüne karşılık gelir.
- Index numaraları ISO'ya özeldir. Index 1'in her ISO'da Home sürümü olduğunu varsaymayın.
- Doğru index'i `dism /Get-WimInfo` çıktısındaki `Index`, `Name` ve `EditionId` alanlarına bakarak belirleyin.
- Sürüm adı ile index numarası arasında sabit bir eşleme yoktur.
### Mount (Bağlama) ve Commit/Discard
- **Mount:** WIM içeriğini bir klasöre bağlar. Bu klasördeki dosyalar düzenlenebilir.
- **Unmount /Commit:** Yapılan değişiklikleri WIM dosyasına kaydeder.
- **Unmount /Discard:** Yapılan değişiklikleri kaydetmeden atar. Yanlışlıkla bu seçeneği kullanmak tüm değişiklikleri siler.
- Bağlı imajın klasörünü kullanan Dosya Gezgini pencereleri ve komut satırları kapatılmadan unmount başarısız olabilir.
### Hazır (Provisioned) Uygulamalar
Hazır uygulamalar, Windows kurulumu sırasında yeni kullanıcılar için yüklenen Store paketleridir. Bunlar `Get-AppxProvisionedPackage` ile listelenir.
- Hazır uygulamalar, kullanıcı profilinde kurulu uygulamalarla aynı şey değildir.
- Paket adları Windows sürümüne göre değişebilir. Kaldırmadan önce listeleyin.
- Bazı paketler sistem bileşenlerine bağlıdır. Bunları kaldırmak beklenmeyen davranışlara yol açabilir.
### Default User Profili ve NTUSER.DAT
- `C:\Users\Default` klasörü, yeni oluşturulan kullanıcı profillerinin şablonudur.
- Kullanıcı ayarları (masaüstü simgeleri, tema, görev çubuğu) `NTUSER.DAT` dosyasında tutulur.
- Çevrimdışı imajdaki `NTUSER.DAT` `reg load` ile yüklenip düzenlenebilir. İşlem bitince `reg unload` ile boşaltılmalıdır. Açık kalan bir yük boşaltmayı engeller.
### Kayıt Defteri (Registry) Yapısı
- `HKLM` (HKEY_LOCAL_MACHINE): Makine geneli ayarlar.
- `HKU` (HKEY_USERS): Kullanıcı profillerinin ayarları.
- `...\Policies\...` anahtarları: Yönetim politikalarını tutar. Bu anahtarlardaki değerler Windows güncellemeleriyle değişebilir ve her Windows sürümünde aynı etkiyi göstermeyebilir.
### SetupComplete.cmd
- `C:\Windows\Setup\Scripts\SetupComplete.cmd` dosyası, kurulum tamamlandıktan sonra çalışır.
- Dosya uzantısı gizli olabilir. `SetupComplete.cmd.txt` gibi bir dosya çalışmaz.
- Sistem bileşenlerini silmek, diğer uygulamaların bağımlılıklarını bozabilir.
### Önyükleme ve oscdimg
- oscdimg ile ISO oluşturulurken BIOS ve UEFI için önyükleme dosyaları ayrı ayrı belirtilir.
- Kaynak klasör yolu ve önyükleme dosyası yolları, komutun çalıştığı yerle uyumlu olmalıdır.
- Komut parametrelerinin ayrıntıları için `oscdimg /?` çıktısına veya Microsoft belgelerine bakın.
## Yaygın Hatalar
- Unmount sırasında `/Discard` yerine `/Commit` (veya tersi) kullanmak.
- Yanlış index'i bağlamak.
- Bağlı imaj açıkken Dosya Gezgini penceresi bırakmak.
- `reg unload` öncesinde kayıt defteri düzenleyicisini (regedit) açık bırakmak.
- Dosya uzantılarını gizli tutup `.cmd.txt` oluşturmak.
- Yönetici yetkisi olmadan DISM veya `reg load` çalıştırmak.
- İzinleri geniş tutmak (ör. `Everyone` için tam denetim). Sahiplik ve izin değişikliklerinde kendi kullanıcınızı veya `Administrators` grubunu kullanın.
## Ek Kaynaklar
- Windows 11 ISO indirme: https://www.microsoft.com/software-download/windows11
- DISM komut satırı belgeleri: Microsoft Learn (Windows donanım üretim belgeleri, DISM bölümü)
- Windows ADK ve oscdimg belgeleri: Microsoft Learn (Windows ADK bölümü)
