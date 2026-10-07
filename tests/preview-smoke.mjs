const base = process.env.PREVIEW_URL || 'http://127.0.0.1:8090';
const results = [];

function assert(condition, label) {
    if (!condition) throw new Error(label);
    results.push(label);
}

async function get(path, options = {}) {
    return fetch(base + path, { redirect: 'manual', ...options });
}

async function post(path, values, options = {}) {
    return get(path, {
        ...options,
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(options.headers || {}) },
        body: new URLSearchParams(values),
    });
}

let response = await get('/');
let body = await response.text();
assert(response.status === 200, 'Publikus kezdőoldal elérhető');
assert(body.includes('Ligetlak Vendégház') && !body.includes('Pitypang Vendégház'), 'A demó márkázás elkülönül az eredetitől');
assert(body.includes('Tölgy Kabin') && body.includes('Berek Kabin'), 'A két fiktív kabin megjelenik');
assert((body.match(/class="stay-card [^"]*" href=/g) || []).length === 2, 'Pontosan két foglalható kabin látható');
assert(body.includes('class="hero-admin-switch"') && body.includes('href="/admin/"'), 'A hero adminisztrációs váltógombot tartalmaz');
assert(body.includes('/assets/images/csitary-office-favicon-32.png') && body.includes('/assets/images/csitary-office-apple-touch-icon.png'), 'A Csitary Office logó a böngészőikon és az iPhone ikon');

response = await get('/?accommodation=1&choose=1');
body = await response.text();
assert(response.status === 200 && body.includes('id="booking-form"'), 'Szállásválasztás után megjelenik a foglalási űrlap');
assert(body.includes('Mikor pihennél nálunk?') && !body.includes('Két hónapos foglalási naptár'), 'A naptár rövid választási üzenetet kapott');
assert(body.includes('2026. 10.') && body.includes('2026. 11.'), 'A naptár az aktuális és következő hónapot mutatja');
assert(body.includes('Privát szauna és fürdődézsa') && !body.includes('data-sauna-extra'), 'A privát wellness felár nélkül az alapár része');
assert(body.includes('Már az aktuális hónapot látod') && body.includes('data-calendar-direction="next"'), 'Az aktuális hónapnál a visszalépés le van tiltva');
assert(body.includes('data-booking-date-picker') && body.includes('data-min-date="2026-10-07"') && body.includes('data-max-date="2028-10-07"'), 'A kezdőnap korlátozott naptárválasztóval két éven belül közvetlenül kiválasztható');
assert(body.indexOf('class="calendar-jump"') < body.indexOf('class="month-nav"') && !body.includes('data-booking-date-toggle') && !body.includes('▦'), 'A dátumugrás a hónapváltók fölött ikon nélkül jelenik meg');
assert(body.includes('/assets/app.css?v=forest-hungary-25'), 'A mobilos javítás új gyorsítótár verzióval töltődik be');

response = await get('/assets/app.css?v=forest-hungary-25');
const css = await response.text();
assert(response.status === 200 && css.includes('font-family: system-ui, -apple-system'), 'A teljes magyar karakterkészletű rendszerbetű aktív');
assert(css.includes('.booking-form input[type="date"]') && css.includes('inline-size: 100%'), 'A publikus dátummezők mobilon a kereten belül maradnak');
assert(css.includes('.admin-calendar-date-row > label') && css.includes('overflow: hidden'), 'Az admin dátumugrás vezérlői mobilon nem fedik egymást');

response = await get('/?accommodation=1&month=2020-01');
body = await response.text();
assert(response.status === 200 && !body.includes('id="booking-form"') && body.includes('Válassz szállást a foglalás megkezdéséhez'), 'A naptár csak kifejezett szállásválasztás után jelenik meg');

response = await get('/?accommodation=1&choose=1&month=2020-01');
body = await response.text();
assert(response.status === 200 && body.includes('data-start-month="2026-10"'), 'Múltbeli hónap nem nyitható meg');

response = await get('/?accommodation=1&choose=1&month=2035-01');
body = await response.text();
assert(body.includes('data-start-month="2028-10"') && body.includes('Elérted a kétéves foglalási időszak végét'), 'A naptár legfeljebb két évre előre nyitható meg');

const baseQuote = {
    accommodation_id: '1', checkin_date: '2026-10-12', checkout_date: '2026-10-14', guests: '2', include_included_amenity: '1', coupon_code: '',
};
response = await post('/quote', baseQuote);
let json = await response.json();
assert(response.status === 200 && json.ok && json.quote.nights === 2, 'Érvényes két éjszakás árkalkuláció működik');
assert(json.quote.extras.some((extra) => extra.amount === 'az alapár része'), 'A wellness külön díj nélkül jelenik meg az összegzésben');

response = await post('/quote', { ...baseQuote, checkout_date: '2026-10-13' });
assert(response.status === 422, 'A két éjszakás minimumkövetelmény érvényesül');

response = await post('/quote', { ...baseQuote, coupon_code: 'PROBA10' });
json = await response.json();
assert(response.status === 200 && json.quote.coupon_discount !== '0 Ft', 'Érvényes kupon csökkenti az árat');

response = await post('/quote', { ...baseQuote, coupon_code: 'HIBAS' });
assert(response.status === 422, 'Érvénytelen kupon hibát ad');

response = await post('/quote', { ...baseQuote, guests: '99' });
assert(response.status === 422, 'Kapacitáson felüli vendégszám tiltott');

response = await post('/quote', { ...baseQuote, checkin_date: '2026-10-14', checkout_date: '2026-10-12' });
assert(response.status === 422, 'Fordított dátumtartomány tiltott');

response = await post('/quote', { ...baseQuote, checkin_date: '2026-09-01', checkout_date: '2026-09-03' });
assert(response.status === 422, 'Múltbeli érkezés tiltott');

response = await post('/quote', { ...baseQuote, checkin_date: '2028-10-08', checkout_date: '2028-10-10' });
assert(response.status === 422, 'Két éven túli érkezés tiltott');

response = await post('/quote', { ...baseQuote, checkin_date: '2026-10-17', checkout_date: '2026-10-19' });
assert(response.status === 422, 'Meglévő foglalással azonos szállás nem ütközhet');

response = await post('/quote', { ...baseQuote, accommodation_id: '4', checkin_date: '2026-10-17', checkout_date: '2026-10-19' });
assert(response.status === 200, 'Független szállásegység ugyanarra az időre foglalható');

response = await post('/quote', { ...baseQuote, accommodation_id: '4', checkin_date: '2026-10-26', checkout_date: '2026-10-28' });
assert(response.status === 422, 'Adminisztrációsan lezárt időszak nem foglalható');

response = await post('/quote', { ...baseQuote, checkin_date: '2026-12-30', checkout_date: '2027-01-01' });
assert(response.status === 422, 'A szilveszteri három éjszakás minimumkövetelmény érvényesül');

response = await post('/quote', { ...baseQuote, checkin_date: '2026-12-30', checkout_date: '2027-01-02' });
assert(response.status === 200, 'Érvényes szilveszteri tartózkodás árazható');

response = await post('/booking', { ...baseQuote, accommodation_id: '4', checkin_date: '2026-11-10', checkout_date: '2026-11-12', guest_name: 'Teszt Elek', guest_email: 'teszt.elek@example.com', guest_phone: '+36 30 000 0004' });
assert(response.status === 422, 'Adatvédelmi elfogadás nélkül nem küldhető foglalás');

response = await post('/booking', { ...baseQuote, accommodation_id: '4', checkin_date: '2026-11-10', checkout_date: '2026-11-12', guest_name: '', guest_email: 'hibas-cim', guest_phone: '12', privacy_accepted: '1' });
assert(response.status === 422, 'Hiányos vagy hibás vendégadatokkal nem küldhető foglalás');

response = await post('/booking', { ...baseQuote, accommodation_id: '4', checkin_date: '2026-11-10', checkout_date: '2026-11-12', guest_name: 'Teszt Elek', guest_email: 'teszt.elek@example.com', guest_phone: '+36 30 000 0004', privacy_accepted: '1' });
assert(response.status === 303 && response.headers.get('location')?.includes('created=LL-DEMO-0003'), 'Érvényes foglalási igény rögzíthető');

response = await post('/quote', { ...baseQuote, accommodation_id: '4', checkin_date: '2026-11-10', checkout_date: '2026-11-12' });
assert(response.status === 422, 'Az új foglalás azonnal blokkolja az időszakot');

response = await get('/admin/');
assert(response.status === 200, 'A demo admin felület jelszó nélkül megnyitható');

response = await get('/admin/login');
assert(response.status === 303 && response.headers.get('location') === '/admin/', 'A régi belépési cím közvetlenül az admin felületre visz');

response = await get('/admin/?page=bookings');
body = await response.text();
assert(response.status === 200 && body.includes('LL-DEMO-0003') && body.includes('Teszt Elek'), 'Az új foglalás megjelenik az admin listában');
assert(body.includes('class="button secondary admin-public-switch"') && body.includes('Foglalási oldal'), 'Az adminisztrációs felületről közvetlenül elérhető a foglalási oldal');
assert(body.includes('data-booking-modal'), 'A foglalási adatlap felugró panelként nyitható meg');
assert(body.includes('data-booking-modal-url'), 'Az áttekintés foglalási sorai teljes felületükön megnyithatók');

response = await get('/admin/?page=bookings&action=edit&id=1');
body = await response.text();
assert(body.includes('name="source"') && body.includes('Weboldal') && body.includes('Telefon') && body.includes('Email') && body.includes('Egyéb'), 'A foglalás forrása a kért négy értékből választható');
assert(body.includes('data-booking-remaining readonly') && body.includes('data-payment-account') && !body.includes('class="coupon-used"'), 'A hátralévő összeg automatikus, a bankszámla bővíthető, a nem használt kupon rejtve marad');

response = await get('/admin/?page=bookings&action=edit&id=2');
body = await response.text();
assert(body.includes('class="coupon-used"') && body.includes('PROBA10'), 'A felhasznált kupon megjelenik a foglalási adatlapon');

response = await post('/admin/manage', { action: 'settings_save', public_min_nights: '2', accommodation_color_1: '#123456', accommodation_color_4: '#654321', status_color_pending: '#d4aa4a', status_color_confirmed: '#234567', status_color_paid: '#397c9e', status_color_rejected: '#a68e80', status_color_cancelled: '#8d7a70', status_color_blocked: '#718078' });
assert(response.status === 303, 'A kabin és állapotszínek menthetők');
response = await get('/admin/?page=calendar');
body = await response.text();
assert(body.includes('--event-color:#234567;--unit-color:#123456') && body.includes('admin-calendar-legend'), 'A mentett színek és a színmagyarázat megjelennek a naptárban');

response = await get('/admin/?page=coupons&action=new');
body = await response.text();
assert(body.includes('step="5"') && body.includes('data-coupon-unlimited') && !body.includes('Minimum összeg'), 'A kupon százaléka ötösével állítható, korlátlan lehet, és nincs minimumösszeg');

response = await get('/admin/?page=bookings');
body = await response.text();
assert(body.includes('admin-filterbar-final-row') && body.includes('Érkezés ettől') && body.includes('Távozás eddig') && !body.includes('Érkezés/távozás'), 'A foglalási szűrő dátumai külön mezőkben, közös igazított sorban jelennek meg');

response = await get('/admin/?page=accommodations&action=edit&id=1');
body = await response.text();
assert(!body.includes('Wellness az árban') && !body.includes('Mi a zárolási kulcs?'), 'A kabin űrlapból eltűnt a wellness értesítő és a zárolási kulcs leírása');

response = await get('/admin/?page=extras&action=edit&id=2');
body = await response.text();
assert(!body.includes('Árazási mód'), 'Az extra technikai árazási módja rejtve marad');

response = await get('/admin/?page=periods&action=edit&id=1');
body = await response.text();
assert(body.includes('period_price_TOLGY') && body.includes('period_price_BEREK') && !body.includes('Prioritás') && !body.includes('Típus'), 'Az árazási időszak kabinonkénti árakat kér technikai mezők helyett');

response = await post('/admin/manage', { action: 'period_save', id: '1', name: 'Szilveszteri időszak', starts_on: '2026-12-30', ends_on: '2027-01-04', period_price_TOLGY: '150000', period_price_BEREK: '90000', recurring: '1', active: '1' });
assert(response.status === 303, 'Az időszaki kabinárak menthetők');
response = await post('/quote', { ...baseQuote, checkin_date: '2026-12-30', checkout_date: '2027-01-02' });
json = await response.json();
assert(response.status === 200 && json.quote.room_subtotal === '450 000 Ft', 'A mentett időszaki ár bekerül a foglalási kalkulációba');

response = await post('/admin/manage', { action: 'coupon_save', code: 'LEJART10', value: '10', valid_from: '2025-01-01', valid_to: '2025-12-31', usage_limit: '', unlimited: '1', active: '1' });
assert(response.status === 303, 'Adminból új kupon létrehozható');

response = await post('/quote', { ...baseQuote, coupon_code: 'LEJART10' });
assert(response.status === 422, 'Lejárt kupon nem használható fel');

console.log(`OK: ${results.length} ellenőrzés sikeres`);
for (const result of results) console.log(`- ${result}`);
