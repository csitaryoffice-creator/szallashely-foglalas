# Ligetlak Vendégház foglalási rendszer

Ez egy fiktív adatokkal működő fejlesztői és bemutató példány. A publikus foglalási oldal és a jelszó nélküli demo admin felület ugyanabban az alkalmazásban található.

## Vercel telepítés

A tároló közvetlenül Vercelre kapcsolható. A Vercel a `vercel.json` beállításai alapján a `api/index.mjs` belépési pontot használja, a képeket, stílusokat és böngészőoldali kódot pedig a `public` mappából szolgálja ki.

Helyi indítás:

```bash
npm start
```

Helyi ellenőrzés:

```bash
npm test
```

A demo adatai memóriában élnek, ezért egy Vercel újraindítás után visszaállnak az alapállapotra. Tartós éles foglalásokhoz később külső adatbázist kell kapcsolni.

PHP 8.1+ és MySQL/MariaDB alapú, shared hostingon is futtatható első verzió. Nincs szükség folyamatos Node.js szerverre vagy külön háttérfolyamatra.

## Technikai terv

- `public/index.php`: publikus foglalási felület és szerveroldali árlekérés.
- `public/admin/index.php`: session alapú admin felület, login, első admin létrehozás, CRUD képernyők.
- `public/assets/images`: a publikus szálláskártyák képei.
- `app/Core`: PDO kapcsolat, auth, CSRF, flash üzenetek, logolás, validációs kivétel.
- `app/Repositories`: adatbázis-hozzáférés szállásokhoz, foglalásokhoz, árakhoz, extrákhoz, kuponokhoz, időszakokhoz.
- `app/Services`: foglalhatóság, árkalkuláció, kupon, e-mail és foglalás mentése.
- `database/schema.sql`: adatbázis séma.
- `database/seed.sql`: induló üzleti adatok.
- `tests/run.php`: service szintű üzleti szabály tesztek.

Az A/B/A+B függőséget az `accommodation_locks` tábla kezeli. Az A Apartman a `unit_a`, a B Apartman a `unit_b`, az A+B pedig mindkét kulcsot foglalja. Így ugyanaz a backend ütközéslogika működik foglalásoknál és lezárt időszakoknál is.

Az 1.1.2-es kiadás tartalmazza a változó kiemelt időszakok hétvégi árazását, a pótágyas végösszegszámítást, a napokra bontott szaunát, a teljesen kezelhető apartmanadatlapokat, a reszponzív adminnaptárat és archívumot, valamint a foglalási felület végleges vizuális és tartalmi módosításait. A publikus naptár foglaltságot csak színekkel jelez, a foglalási feltételek magazinszerű információs részben jelennek meg, a Bakancslista blokk pedig a vendégház élményoldalára vezet.

Az 1.3-as javítás teljes szerkesztést biztosít az apartmanokhoz, extrákhoz, apartmanárakhoz, árazási időszakokhoz és kuponokhoz. Tartalmazza az apartmanképek biztonságos feltöltését/cseréjét, a mobilbarát Apartman árak felületet, a kéthónapos foglalási naptárt, a múltbeli dátumok tiltását, a teljes körű admin foglaláskeresést, valamint az oldalváltás nélküli foglalási visszajelzést. Az admin Áttekintésén az Összes, Aktív és Függőben foglalások valódi helyben váltó fülekként működnek. A demó levelezési címei a fenntartott `.example` tartományt használják.

Az 1.4-es kiadás az Apartman árak menüben vendégszámonként külön szerkeszthető hétköznapi és hétvégi árakat vezet be. Péntek és szombat hétvégi, vasárnap–csütörtök hétköznapi árral számol. Az apartman-adatlapon már nincs külön ármező, így az árak kizárólag egyetlen adminfelületen kezelhetők. A publikus foglalási felület legfrissebb naptár-, visszajelzés-, tartalmi és mobilos javításai, valamint a szauna napi díjazásának helyes megjelenítése is része a kiadásnak.

Az 1.4.1-es javításban az aktív és az archív foglalások is végleg törölhetők. Az admin a visszaigazolás előtt foglalásonként kiválasztja az utalási bankszámlát; ugyanaz a kedvezményezett és számlaszám kerül a visszaigazoló, majd a későbbi fizetési emlékeztető e-mailbe.

Az 1.4.2-es javítás külön szilveszteri házdíjat alkalmaz minden december 30. és január 4. közé eső éjszakára. Ebben az időszakban minimum 3 éjszaka foglalható, nincs pótágyazás, és a teljes apartman díja nem függ a vendégek számától. A naptár hónapváltáskor is megőrzi a már kiválasztott érkezési napot és a távozás kiválasztási állapotát.

## Rendszerkövetelmények

- PHP 8.1 vagy újabb
- MySQL 5.7+/MariaDB 10.4+ ajánlott
- PDO MySQL extension
- Apache `.htaccess` támogatás ajánlott

## Telepítés

1. Hozz létre egy MySQL/MariaDB adatbázist `utf8mb4` karakterkészlettel.
2. Importáld a `database/schema.sql` fájlt.
3. Importáld a `database/seed.sql` fájlt.
4. Másold a `config/config.sample.php` fájlt `config/config.php` néven.
5. Írd át benne a DSN-t, adatbázis felhasználót és jelszót.
6. Éles HTTPS tárhelyen a session `secure` értéke maradhat `auto`; lokális HTTP-n automatikusan kikapcsol.
7. Állítsd a subdomain document rootját a `public` mappára.
8. Nyisd meg az `/admin/` címet, és jelentkezz be a megadott admin felhasználónévvel és jelszóval. A jelszó csak erős hash formájában kerül az adatbázisba, a rendszer pedig védi a belépést próbálkozás-limittel és biztonságos emlékeztető tokennel.

Ha a tárhely nem engedi a `public` mappát document rootként beállítani, a kiszolgáló konfigurációját úgy kell módosítani, hogy csak a `public` tartalma legyen weben elérhető. Az `app`, `config`, `database` és `storage` mappák ne legyenek közvetlenül publikusak.

## Adatbázis felépítés

- `admin_users`: admin felhasználók, felhasználónév, jelszó hash, szerepkör.
- `admin_remember_tokens`, `admin_login_attempts`: biztonságos eszközmegjegyzés és belépési próbálkozások limitálása.
- `accommodations`: foglalható egységek és tartalmazott wellness levonásai.
- `accommodation_locks`: A/B/A+B backend foglalási függőségek.
- `rate_plans`, `prices`: alap és későbbi speciális ártervek, vendégszám szerinti árak.
- `pricing_periods`: kiemelt időszakok, nyári szezon, későbbi szilveszteri/speciális időszakok.
- `extras`, `accommodation_extras`: extra szolgáltatások, ár, aktív állapot, szálláshoz rendelés.
- `bookings`, `booking_extras`: foglalások és a foglaláskori extra snapshotok.
- `blocked_periods`, `blocked_period_accommodations`: admin által lezárt időszakok.
- `coupons`, `coupon_usages`: kuponok, limit és felhasználás.
- `settings`: szerkeszthető rendszerbeállítások, például online minimum éjszakák és hétköznapi kedvezmény.

Az admin foglalási adatlapján a teljes összeg, az előleg, a hátralévő összeg és a kaució külön szerkeszthető. A publikus foglalások ezeket üresen kapják meg; a kalkulált ár csak tájékoztató. Visszaigazolás csak mind a négy fizetési adat kitöltése és az utalási bankszámla kiválasztása után lehetséges. A kiválasztott bankszámla a foglaláshoz rögzül, és a visszaigazoló, valamint a fizetési emlékeztető levélben is megjelenik. Elutasítás vagy lemondás esetén indoklás kötelező, és az elutasító e-mail automatikusan kiküldésre kerül.

Új publikus foglalási igénynél a rendszer azonnal küld egy beérkezési értesítést a vendégnek és a szállásadónak. A szállásadó e-mail-címét a `config/config.php` fájl `mail.owner_email` értékében kell megadni; a mintakonfigurációban ez megegyezik a feladó címével.

### E-mail kézbesíthetőség

- A `MAIL_FROM_ADDRESS` és a `MAIL_ENVELOPE_FROM` ugyanahhoz a hitelesített saját domainhez tartozzon, mint az SMTP-fiók.
- A domain DNS-ében legyen helyesen beállítva SPF, DKIM és DMARC. Ezeket a tárhely levelezési felületén kell ellenőrizni; az alkalmazás nem tud DNS-rekordot létrehozni.
- A rendszer szabványos `Message-ID`, `Date`, `Reply-To`, MIME- és automatikusüzenet-fejléceket küld, valamint az SMTP-adatfolyamot szabványos CRLF sortöréssel zárja.

## Fizetési emlékeztető

A `cron/send_payment_reminders.php` feladat a 7 nap múlva érkező, még nem teljesen fizetett, visszaigazolt vagy módosított foglalásokhoz küld fizetési emlékeztetőt. A rendszer foglalásonként egyszer küldi ki az e-mailt, és mindig az adott foglaláshoz kiválasztott bankszámlaadatokat használja.

cPanelben napi egyszeri Cron Jobként add meg a tárhelyed PHP elérési útjával és a projekt teljes elérési útjával, például:

```bash
/usr/local/bin/php /home/FELHASZNALO/booking/cron/send_payment_reminders.php
```

## Tesztelés

Ha a PHP elérhető a gépen:

```bash
php tests/run.php
```

A tesztek ellenőrzik a dátumütközést, A/B/A+B függőséget, publikus minimum 1 éjszakát, admin 1 éjszakás rögzítést, a hétköznapi és hétvégi árazást, a konkrét kiemelt időszak hétvégi árát, a pótágyas felárakat, wellness levonást, a kiválasztott szaunanapok árazását és kuponvalidációt.

Lokális kipróbáláshoz PHP beépített szerverrel:

```bash
php -S localhost:8000 -t public
```

Ezután:

- Publikus oldal: `http://localhost:8000/`
- Admin: `http://localhost:8000/admin/`

PHP nélküli vizuális-funkcionális preview a fejlesztői gépen:

```bash
node preview/functional-server.mjs
```

Ez a preview mintaadatokkal mutatja a képes szállásválasztót, naptárállapotokat, élő kalkulációt, foglalásbeküldést, admin belépést, kupon létrehozást és lezárt időszak felvételét.

## Következő fejlesztési kör

- Google Calendar API kétirányú vagy egyirányú integráció.
- Szerkeszthető e-mail sablonok.
- Részletes jogosultsági rendszer több admin szerepkörrel.
- Publikus foglalási naptár vizuális elérhetőséggel.
- Admin audit log és részletes foglalás-történet.
- Reggeli pontos üzleti és mennyiségi szabályainak rögzítése, ha ismertté válik.
