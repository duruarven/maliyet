# Giyim Maliyet Hesaplama — iOS ve TestFlight

- Uygulama adı: **Giyim Maliyet Hesaplama**
- Bundle ID: **com.duruarven.giyimmaliyethesaplama**
- Xcode hedefi/şeması: `Maliyet`
- En düşük sürüm: iOS/iPadOS 15.0

Swift/UIKit uygulaması, hesaplayıcıyı uygulamaya gömülü bir WKWebView içinde çalıştırır. İnternet, sunucu veya kullanıcı hesabı gerekmez. Hesap cihazın WKWebView localStorage alanında kalır; Safari'deki eski kayıtlar uygulamaya otomatik taşınmaz. Uygulama silinirse bu kayıt da silinebilir.

PDF ve CSV cihazda üretilir. **PDF olarak kaydet**, iOS belge dışa aktarma ekranını açar; kullanıcı Dosyalar/iCloud Drive hedefini seçer. **Müşteriyle paylaş**, PDF dosyasını iOS paylaşım ekranına verir; kullanıcı WhatsApp, Mail veya başka bir uygulama ve alıcı seçer. Uygulama kendiliğinden mesaj göndermez. Paylaşımın tamamlanması, dosyanın seçilen uygulamaya aktarılmasıdır; müşteriye teslim edildiğini göstermez. Geçici dosyalar ekran kapandıktan sonra temizlenir. Paylaşım iPad'de popover olarak da desteklenir.

## Mac üzerinde çalıştırma

Xcode, Node.js 20+ ve XcodeGen gerekir:

```sh
brew install xcodegen
npm ci
npm run ios:generate
open ios/Maliyet.xcodeproj
```

`Maliyet` şemasını ve bir iPhone simülatörünü seçip Run çalıştırın. Fiziksel cihaz için Xcode Signing bölümünden kendi Apple Developer takımınızı seçin. Gerekirse Bundle ID'yi hem `ios/project.yml` hem `codemagic.yaml` içinde değiştirin. Üretilen Xcode projesini değiştirmek yerine `ios/project.yml` dosyasını düzenleyip yeniden üretin. `npm run ios:generate`, web dosyalarını iOS paketine kopyalar; web kodundaki değişikliklerden sonra yeniden çalıştırılmalıdır.

## Codemagic'i bir kez bağlama

1. Apple Developer üyeliğiyle Certificates, Identifiers & Profiles bölümünde `com.duruarven.giyimmaliyethesaplama` App ID'sini oluşturun. App Store Connect'te bu Bundle ID ile **Giyim Maliyet Hesaplama** adlı iOS uygulaması açın (adın mağazada kullanılabilir olması gerekir). Uygulama Bilgileri bölümündeki sayısal **Apple ID** değerini not edin. Bu, e-posta veya Bundle ID değildir.
2. Codemagic'te GitHub deposunu ekleyin ve `codemagic.yaml` iş akışını seçin. Team integrations → App Store Connect bölümüne gerekli izinleri olan App Store Connect API anahtarını güvenli şekilde ekleyin. Entegrasyonun adı YAML'daki gibi **App Store Connect** olmalıdır. Issuer ID, Key ID ve `.p8` özel anahtarını yalnızca Codemagic'in güvenli arayüzünde kullanın; GitHub'a eklemeyin.
3. Codemagic Code signing identities bölümünde bu uygulama için geçerli bir **Apple Distribution** sertifikası (özel anahtarıyla) ve eşleşen **App Store** provisioning profile sağlayın. Codemagic'in Apple entegrasyonuyla profil indirme/sertifika oluşturma seçeneklerini veya mevcut imzalama dosyalarını güvenli yüklemeyi kullanabilirsiniz. `ios_signing` bunları makineye kurar, `xcode-project use-profiles` projeye uygular. Salt YAML eklemek Apple hesabında sertifika/profil oluşturmaz.
4. Codemagic'te **app_store** adlı environment variable group oluşturun. İçine `APP_STORE_APPLE_ID` değişkenini, 1. adımdaki sayısal Apple ID ile ekleyin ve bu uygulamaya erişim verin. Şifre, API anahtarı veya sertifika değerlerini bu depoya yazmayın.
5. **ios-testflight** iş akışını GitHub'daki güncel commit için başlatın. Aynı uygulama için iki yüklemeyi eşzamanlı çalıştırmayın: derleme numarası son TestFlight numarasına 1 eklenerek üretilir. Apple API hataları gizlenmez ve derlemeyi durdurur.

Akış birim ve tarayıcı testlerini çalıştırır; çevrimdışı web varlıklarını hazırlar; XcodeGen ile projeyi üretir; profilleri uygular; imzalı IPA oluşturur ve TestFlight'a gönderir. App Store incelemesine gönderim kapalıdır. İlk uygulama kaydı, Apple sözleşmeleri, imzalama varlıkları ve Codemagic entegrasyonu hesap sahibi tarafından tamamlanmalıdır. Build numarası bulunmayan yeni uygulamalarda CLI'nın 0 dönmesi beklenir; boş/hatalı API yanıtı yüklemeyi durdurur.

IPA, Codemagic build artifacts bölümünde bulunur. Apple işlemesi tamamlanınca App Store Connect → TestFlight'ta test grubuna ekleyin. Harici test kullanıcıları için beta incelemesi gerekebilir. Bu depodaki yapılandırma, bir derlemenin gerçekten çalıştırıldığı veya TestFlight'a kabul edildiği anlamına gelmez.

## Doğrulama

```sh
npm test
npm run test:browser
npm run ios:prepare
```

Tarayıcı testleri hesaplama, kalıcılık, CSV/PDF, Türkçe PDF metni (`pdftotext` varsa), masaüstü/mobil görünüm ve paylaşım davranışlarını kontrol eder. Ek iOS köprü testi gerçek PDF/CSV baytlarının Swift'e gidecek mesajda bulunduğunu, kaydet/paylaş ayrımını ve iptal/hata sonrası iyileşmeyi doğrular. Bu test Swift veya gerçek iOS paylaşım ekranını çalıştırmaz.

İmzalı build sonrasında iPhone/iPad'de: 200 TL/kg, 250 gram ve 5 TL gider girip 55 TL toplamı görün; PDF'yi Dosyalar'a kaydedip Türkçe metni açın; WhatsApp/Mail ile test alıcısına paylaşın; kaydet/paylaş ekranlarını iptal edip tekrar deneyin; uygulamayı kapatıp açarak kaydın korunduğunu ve uçak modunda çalıştığını doğrulayın. Sıfırlama onayını ve iPad paylaşım ekranını da kontrol edin.
