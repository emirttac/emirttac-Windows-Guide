# Windows Customization Guide

Microsoft araçlarıyla resmi Windows 11 kurulum medyasını inceleme, çevrimdışı imajı servisleme ve özelleştirilmiş medyayı doğrulama rehberi.

> **Kapsam:** Buradaki “özelleştirme/modlama”, kurulum medyası ve Windows imajı üzerindeki belgelenmiş değişiklikleri ifade eder. Çalışan Windows masaüstünü kişiselleştirme, üçüncü taraf imaj düzenleme araçları, güvenlik gereksinimlerini atlatma ve etkinleştirme değişiklikleri kapsam dışıdır. Bu belge Microsoft tarafından onaylanmamıştır.

## Rehbere git

- [Türkçe web rehberi](https://emirttac.github.io/emirttac-Windows-Guide/)
- [English web guide](https://emirttac.github.io/emirttac-Windows-Guide/en/index.html)
- [GitHub deposu](https://github.com/emirttac/emirttac-Windows-Guide)

Web rehberindeki arama, seçili dilin tüm bölümlerinde çalışır; üstteki arama düğmesi veya Ctrl+K (macOS'ta Command+K) ile açılabilir. Arama, sayfaları HTTP üzerinden yükler; yerel denemelerde dosyayı doğrudan açmak yerine bir yerel web sunucusu kullanın.

## İçerik

1. Kapsam ve referans medya
2. Ön koşullar, araçlar ve kurulum medyasının yapısı
3. WIM indeksleri ve çevrimdışı servisleme
4. Önyükleme, ISO üretimi ve kurulum otomasyonu
5. Kayıt defteri ve hazır uygulamalar
6. Doğrulama, destek yaşam döngüsü, lisans ve güvenlik
7. Sorun giderme, sözlük ve Microsoft kaynakları
8. Adım adım uygulama akışı ([Tutorial](https://emirttac.github.io/emirttac-Windows-Guide/tutorial.html))

Rehber, Windows 11 imajlarıyla çalışan teknik kullanıcıları hedefleyen bir referanstır; her komutun hedef sürümde yedek alınmış bir imaj ve sanal makine üzerinde doğrulanması gerekir. Komut örneklerinde kullanılan yol ve indeks yer tutucularını kendi medyanıza göre değiştirin. DISM/ISO oluşturma adımlarının tümü bu belgede fiilen çalıştırılmış değildir; doğrulama kapsamı ilgili bölümlerde belirtilir.

## Teknoloji ve güncellik

Rehber; DISM, DISM PowerShell modülü, `reg.exe`, `oscdimg` ve Windows Setup belgelerine dayanır. Hedef sürüm, ADK ve güncelleme bilgileri zamanla değişebileceğinden Microsoft'un [Windows 11 sürüm bilgilerini](https://learn.microsoft.com/en-us/windows/release-health/windows11-release-information) ve [ADK kurulum belgesini](https://learn.microsoft.com/en-us/windows-hardware/get-started/adk-install) kontrol edin.

Windows, Microsoft Corporation'ın ticari markasıdır.
