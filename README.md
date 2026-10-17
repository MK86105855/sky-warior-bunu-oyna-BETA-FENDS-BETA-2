# SKY WARRIOR ONLINE

Farklı evlerdeki arkadaşlarla oynamak için Node.js + WebSocket sunuculu sürüm.

## İnternetten yayınlama (kolay yol)
1. Bu klasörü GitHub'a yükleyin.
2. Render'da **New + Web Service** seçin ve GitHub deposunu bağlayın.
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Deploy bitince size `https://....onrender.com` şeklinde bir oyun adresi verilir.
6. Herkes aynı adresi açar. Oyunda **TAKIM KUR** ile kod oluşturun; arkadaşlar **TAKIM KODU YAZ** ile aynı kodu girer.

Sunucu WebSocket'i aynı adres üzerinden otomatik kullanır; ayrıca IP yazmanız gerekmez.

## Bilgisayarda test
```powershell
npm.cmd install
npm.cmd start
```
Sonra `http://localhost:3000` açın.

## Mavi yeniden doğma noktası
- Bir oyuncu ölünce öldüğü yerde **MAVİ** bir daire çıkar (herkes görür).
- Yaşayan bir arkadaş uçağıyla dairenin içinde **5 saniye** kalırsa ölen oyuncu canlanır. Daireden çıkarsa sayaç sıfırlanır.
- Takımdaki **herkes** ölürse (tek oynuyorsan sen ölünce) oyun biter.

## Oyun bitince
Takımdaki herkes ölürse herkeste oyun bitti ekranı açılır. **MENÜYE DÖN (TAKIMDA KAL)** odayı ve takım kodunu korur. Sağ üstteki duraklat düğmesinden istediğin zaman maçtan çıkıp menüye dönebilirsin.

## Mobil öğrenme
Menüde **🟢 KOLAY** düğmesine basılı tut (ya da **❓ MOBİL ÖĞRENME** düğmesine bas): hareket, can doldurma ve bomba denemeli anlatılır.
Klavye/mobil seçimi artık herkesin kendi cihazında kalır (kurucunun seçimi arkadaşlara dayatılmaz).

## Yeni eklenenler
- Maçtan önce oyuncu adı girilir ve isimler uçakların üzerinde görünür.
- Arkadaşın uçağına dokununca can, bomba, dalga ve atış bilgileri açılır.
- Kurtarma sonrası oyuncu yeniden oyuna döner; tüm aktif takım oyuncuları ölünce oyun bitti ekranı açılır.
- Sağ üstte duraklat/çık düğmesi vardır; menüye dönmek takım kodunu silmez.
