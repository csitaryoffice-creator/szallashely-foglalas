import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parse as parseQuery } from 'node:querystring';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const port = Number(process.env.PORT || 8090);
const demoBrand = 'Ligetlak Vendégház';
const demoEmail = 'hello@ligetlak.example';
const demoPhone = '+36 30 000 0000';
const adminUsername = 'demo';
const adminPasswordHash = 'pbkdf2_sha256$210000$ligetlak-demo-2026$QYMkOxJyiM0iQCThl0QMaHPWyEXskw9si-ydT9hoS6c';
const sessionCookie = 'ligetlak_preview_session';
const rememberCookie = 'ligetlak_preview_remember';
const sessions = new Map();
const rememberTokens = new Map();
const loginAttempts = [];
const bookingSequences = new Map();
const paymentAccounts = {
    gyula: { name: 'Ligetlak Demo Kft.', accountNumber: '00000000-00000000-00000000' },
    evelin: { name: 'Minta Szállásadó', accountNumber: '11111111-11111111-11111111' },
};
const newYearHousePrices = { TOLGY: 140000, BEREK: 80000 };
const newYearMaximumGuests = { TOLGY: 7, BEREK: 2 };

const state = {
    settings: {
        publicMinNights: 2,
        weekdayDiscountAmount: 5000,
        accommodationColors: { 1: '#2f6f55', 4: '#bd5d4d' },
        statusColors: {
            pending: '#d4aa4a',
            confirmed: '#6f9a7b',
            paid: '#397c9e',
            rejected: '#a68e80',
            cancelled: '#8d7a70',
            blocked: '#718078',
        },
    },
    accommodations: [
        { id: 1, code: 'TOLGY', name: 'Tölgy Kabin', minGuests: 2, maxGuests: 7, locks: ['unit_tolgy'], image: '/assets/images/demo/tolgy-kabin-v4.jpg', description: 'Tágas erdei ház családoknak és baráti társaságoknak, fedett terasszal és az árban foglalt privát wellnesszel.', sortOrder: 1, amenity: 'Privát szauna és fürdődézsa', amenityDiscount: 0 },
        { id: 4, code: 'BEREK', name: 'Berek Kabin', minGuests: 2, maxGuests: 2, locks: ['unit_berek'], image: '/assets/images/demo/berek-kabin-v3.jpg', description: 'Meghitt kétszemélyes kabin pároknak, saját terasszal és az árban foglalt privát wellnesszel.', sortOrder: 2, amenity: 'Privát szauna és fürdődézsa', amenityDiscount: 0 },
    ],
    prices: {
        TOLGY: { 2: { weekday: 50000, weekend: 55000 }, 3: { weekday: 65000, weekend: 70000 }, 4: { weekday: 75000, weekend: 80000 }, 5: { weekday: 95000, weekend: 100000 }, 6: { weekday: 105000, weekend: 110000 }, 7: { weekday: 120000, weekend: 125000 } },
        BEREK: { 2: { weekday: 50000, weekend: 55000 } },
    },
    extras: [
        { id: 2, code: 'BREAKFAST', name: 'Reggeli kosár', price: null, mode: 'custom', accommodationIds: [1, 4], active: true },
    ],
    periods: [
        { id: 1, name: 'Szilveszteri időszak', type: 'new_year', startsOn: '2026-12-30', endsOn: '2027-01-04', priority: 200, recurring: true, disablesDiscount: true, active: true, prices: { TOLGY: 140000, BEREK: 80000 } },
    ],
    bookingStatuses: [
        { code: 'new', label: 'Új' },
        { code: 'confirmed', label: 'Visszaigazolva' },
        { code: 'modified', label: 'Módosítva' },
        { code: 'rejected', label: 'Elutasítva' },
        { code: 'cancelled', label: 'Lemondva' },
        { code: 'completed', label: 'Teljesítve' },
    ],
    paymentStatuses: [
        { code: 'unpaid', label: 'Nincs fizetve' },
        { code: 'partial', label: 'Részben fizetve' },
        { code: 'paid', label: 'Teljesen fizetve' },
    ],
    coupons: [
        { id: 1, code: 'PROBA10', type: 'percent', value: 10, active: true, validFrom: '2026-10-01', validTo: '2027-12-31', usageLimit: 20, usageCount: 0, minAmount: null },
    ],
    bookings: [
        { id: 1, code: 'LL-DEMO-0001', source: 'public', guestName: 'Kovács Anna', guestEmail: 'anna.kovacs@example.com', guestPhone: '+36 30 000 0001', accommodationId: 1, checkin: '2026-10-16', checkout: '2026-10-19', guests: 4, includeAmenity: true, extraIds: [], extraDates: {}, couponCode: '', couponDiscount: 0, originalTotal: 235000, finalTotal: 235000, manualTotal: '235000', depositAmount: 117500, remainingAmount: 117500, securityDepositAmount: 30000, paymentAccount: 'evelin', rejectionReason: '', guestNotes: 'Érkezés várhatóan 17 óra körül.', adminNotes: 'Bemutató foglalás.', paymentStatus: 'partial', createdAt: '2026-10-02 10:15', updatedAt: '2026-10-03 09:40', statusCode: 'confirmed' },
        { id: 2, code: 'LL-DEMO-0002', source: 'public', guestName: 'Nagy Bence', guestEmail: 'bence.nagy@example.com', guestPhone: '+36 30 000 0002', accommodationId: 4, checkin: '2026-11-06', checkout: '2026-11-08', guests: 2, includeAmenity: true, extraIds: [], extraDates: {}, couponCode: 'PROBA10', couponDiscount: 12000, originalTotal: 120000, finalTotal: 108000, manualTotal: '', depositAmount: '', remainingAmount: '', securityDepositAmount: '', paymentAccount: '', rejectionReason: '', guestNotes: 'Évfordulós hétvége, csendes pihenéssel.', adminNotes: 'Visszahívás szükséges.', paymentStatus: 'unpaid', createdAt: '2026-10-04 15:40', updatedAt: '2026-10-04 15:40', statusCode: 'new' },
    ],
    blocked: [
        { id: 1, startsOn: '2026-10-26', endsOn: '2026-10-28', accommodationIds: [4], note: 'Tervezett karbantartás', active: true },
    ],
};

async function requestHandler(req, res) {
    try {
        const url = new URL(req.url || '/', `http://${req.headers.host}`);

        if (req.method === 'GET' && url.pathname.startsWith('/assets/')) {
            return sendAsset(res, url.pathname);
        }

        if (req.method === 'GET' && url.pathname === '/') {
            return sendHtml(res, publicPage(url.searchParams));
        }

        if (req.method === 'POST' && url.pathname === '/quote') {
            const body = await readForm(req);
            assertPublicBookingHorizon(body);
            return sendJson(res, { ok: true, quote: publicQuotePayload(quote(body)) });
        }

        if (req.method === 'POST' && url.pathname === '/booking') {
            const body = await readForm(req);
            if (!bool(body.privacy_accepted)) {
                throw new Error('Az adatvédelmi tájékoztató elfogadása kötelező.');
            }
            validatePublicGuest(body);
            assertPublicBookingHorizon(body);
            const result = quote(body);
            const booking = {
                id: state.bookings.length + 1,
                code: nextBookingCode('LL-DEMO'),
                source: 'public',
                guestName: text(body.guest_name),
                guestEmail: text(body.guest_email),
                guestPhone: text(body.guest_phone),
                accommodationId: Number(body.accommodation_id),
                checkin: text(body.checkin_date),
                checkout: text(body.checkout_date),
                guests: Number(body.guests),
                includeAmenity: bool(body.include_included_amenity),
                extraIds: array(body.extra_ids).map(Number),
                extraDates: result.extraDates,
                couponCode: result.coupon?.code || '',
                couponDiscount: result.couponDiscount,
                originalTotal: result.subtotal,
                finalTotal: result.total,
                manualTotal: '',
                depositAmount: '',
                remainingAmount: '',
                securityDepositAmount: '',
                paymentAccount: '',
                rejectionReason: '',
                guestNotes: text(body.guest_notes),
                adminNotes: '',
                paymentStatus: 'unpaid',
                createdAt: nowText(),
                updatedAt: nowText(),
                statusCode: 'new',
            };
            state.bookings.push(booking);
            const coupon = findCoupon(text(body.coupon_code));
            if (coupon) {
                coupon.usageCount += 1;
            }
            if (String(req.headers['x-requested-with'] || '').toLowerCase() === 'xmlhttprequest') {
                return sendJson(res, {
                    ok: true,
                    booking_code: booking.code,
                    message: 'Köszönjük! A foglalási igényed sikeresen megérkezett. Hamarosan e-mailben jelentkezünk a visszaigazolással.',
                });
            }
            return redirect(res, `/?accommodation=${booking.accommodationId}&month=${booking.checkin.slice(0, 7)}&created=${encodeURIComponent(booking.code)}#booking`);
        }

        if (url.pathname === '/admin/login' || url.pathname === '/admin/logout') {
            return redirect(res, '/admin/');
        }

        if (req.method === 'GET' && url.pathname === '/admin/') {
            return sendHtml(res, adminPage(url.searchParams));
        }

        if (req.method === 'POST' && url.pathname === '/admin/coupon') {
            const body = await readForm(req);
            const code = text(body.code).toUpperCase();
            const value = Number(body.discount_value);
            if (!code || !Number.isFinite(value) || value < 5 || value > 100 || value % 5 !== 0) {
                return redirect(res, '/admin/?error=' + encodeURIComponent('A kupon adatai hibásak.'));
            }
            if (findCoupon(code)) {
                return redirect(res, '/admin/?error=' + encodeURIComponent('Ez a kuponkód már létezik.'));
            }
            if (body.valid_from && body.valid_to && body.valid_from > body.valid_to) {
                return redirect(res, '/admin/?error=' + encodeURIComponent('A kupon zárónapja nem lehet korábbi a kezdőnapnál.'));
            }
            state.coupons.push({
                id: state.coupons.length + 1,
                code,
                type: 'percent',
                value,
                active: true,
                validFrom: text(body.valid_from),
                validTo: text(body.valid_to),
                usageLimit: bool(body.unlimited) || !body.usage_limit ? null : Math.max(1, Number(body.usage_limit)),
                usageCount: 0,
                minAmount: null,
            });
            return redirect(res, '/admin/?success=' + encodeURIComponent('Kupon létrehozva.'));
        }

        if (req.method === 'POST' && url.pathname === '/admin/block') {
            const body = await readForm(req);
            const accommodationIds = array(body.accommodation_ids).map(Number);
            if (!body.starts_on || !body.ends_on || accommodationIds.length === 0) {
                return redirect(res, '/admin/?error=' + encodeURIComponent('A lezáráshoz dátum és szállás szükséges.'));
            }
            state.blocked.push({
                id: state.blocked.length + 1,
                startsOn: text(body.starts_on),
                endsOn: text(body.ends_on),
                accommodationIds,
                note: text(body.note),
                active: true,
            });
            return redirect(res, '/admin/?success=' + encodeURIComponent('Lezárt időszak létrehozva.'));
        }

        if (req.method === 'POST' && url.pathname === '/admin/manage') {
            const body = await readForm(req);
            return handleAdminManagement(res, body);
        }

        if (req.method === 'POST' && url.pathname === '/admin/quick-status') {
            const body = await readForm(req);
            const booking = state.bookings.find(b => b.id === Number(body.id));
            const status = text(body.target_status);
            if (!booking || !['confirmed', 'rejected'].includes(status)) {
                return redirect(res, '/admin/?page=bookings&error=' + encodeURIComponent('A gyors művelet nem sikerült.'));
            }
            return redirect(res, '/admin/?page=bookings&action=edit&id=' + booking.id + '&error=' + encodeURIComponent(status === 'confirmed' ? 'A visszaigazoláshoz előbb add meg a teljes összeget, az előleget és az utalási bankszámlát.' : 'Az elutasításhoz előbb add meg az indoklást.'));
        }

        if (req.method === 'POST' && url.pathname === '/admin/booking') {
            const body = await readForm(req);
            const booking = state.bookings.find(b => b.id === Number(body.id));
            if (!booking) {
                return redirect(res, '/admin/?page=bookings&error=' + encodeURIComponent('A foglalás nem található.'));
            }
            const result = quote(body, booking.id);
            const requestedStatus = text(body.status);
            const manualTotal = text(body.manual_total);
            const depositAmount = text(body.deposit_amount);
            const securityDepositAmount = text(body.security_deposit_amount);
            let paymentAccount = text(body.payment_account);
            const rejectionReason = text(body.rejection_reason);
            if (paymentAccount === '__new__') {
                const accountName = text(body.new_account_name);
                const accountNumber = text(body.new_account_number);
                if (!accountName || !accountNumber) {
                    return redirect(res, '/admin/?page=bookings&action=edit&id=' + booking.id + '&error=' + encodeURIComponent('Az új bankszámlához név és számlaszám szükséges.'));
                }
                paymentAccount = `account_${Date.now()}`;
                paymentAccounts[paymentAccount] = { name: accountName, accountNumber };
            }
            if (paymentAccount && !paymentAccounts[paymentAccount]) {
                return redirect(res, '/admin/?page=bookings&action=edit&id=' + booking.id + '&error=' + encodeURIComponent('A kiválasztott bankszámla nem érvényes.'));
            }
            if (requestedStatus === 'confirmed' && ([manualTotal, depositAmount].some(value => value === '') || !paymentAccount)) {
                return redirect(res, '/admin/?page=bookings&action=edit&id=' + booking.id + '&error=' + encodeURIComponent('Visszaigazolás előtt a teljes összeget, az előleget és az utalási bankszámlát is meg kell adni.'));
            }
            if (['rejected', 'cancelled'].includes(requestedStatus) && !rejectionReason) {
                return redirect(res, '/admin/?page=bookings&action=edit&id=' + booking.id + '&error=' + encodeURIComponent('Elutasítás vagy lemondás esetén az indoklás kötelező.'));
            }
            booking.code = text(body.booking_code) || booking.code;
            booking.source = text(body.source) || booking.source;
            booking.guestName = text(body.guest_name);
            booking.guestEmail = text(body.guest_email);
            booking.guestPhone = text(body.guest_phone);
            booking.accommodationId = Number(body.accommodation_id);
            booking.checkin = text(body.checkin_date);
            booking.checkout = text(body.checkout_date);
            booking.guests = Number(body.guests);
            booking.includeAmenity = bool(body.include_included_amenity);
            booking.extraIds = array(body.extra_ids).map(Number);
            booking.extraDates = result.extraDates;
            booking.couponCode = result.coupon?.code || '';
            booking.couponDiscount = result.couponDiscount;
            booking.originalTotal = result.subtotal;
            booking.manualTotal = manualTotal;
            booking.finalTotal = booking.manualTotal !== '' ? Math.max(0, Number(booking.manualTotal) - result.couponDiscount) : result.total;
            booking.depositAmount = depositAmount;
            booking.remainingAmount = Math.max(0, booking.finalTotal - Math.max(0, Number(depositAmount) || 0));
            booking.securityDepositAmount = securityDepositAmount;
            booking.paymentAccount = paymentAccount;
            booking.rejectionReason = rejectionReason;
            booking.guestNotes = text(body.guest_notes);
            booking.adminNotes = text(body.admin_notes);
            booking.statusCode = requestedStatus;
            booking.paymentStatus = text(body.payment_status);
            booking.updatedAt = nowText();
            const returnPage = booking.checkout < todayIso() ? 'archive' : 'bookings';
            return redirect(res, `/admin/?page=${returnPage}&action=edit&id=${booking.id}&success=${encodeURIComponent('A foglalás frissült.')}`);
        }

        if (req.method === 'POST' && url.pathname === '/admin/booking-delete') {
            const body = await readForm(req);
            const index = state.bookings.findIndex(booking => booking.id === Number(body.id));
            if (index >= 0) state.bookings.splice(index, 1);
            const returnPage = ['bookings', 'archive'].includes(text(body.return_page)) ? text(body.return_page) : 'bookings';
            return redirect(res, `/admin/?page=${returnPage}&success=${encodeURIComponent('A foglalás törölve.')}`);
        }

        return sendHtml(res, layout('Nem található', '<main class="public-shell"><div class="alert alert-error">Az oldal nem található.</div></main>'), 404);
    } catch (error) {
        if (req.url === '/quote' || req.headers.accept?.includes('application/json') || String(req.headers['x-requested-with'] || '').toLowerCase() === 'xmlhttprequest') {
            return sendJson(res, { ok: false, errors: [error.message], contact_phone: demoPhone, contact_email: demoEmail }, 422);
        }
        return sendHtml(res, publicPage(new URLSearchParams({ error: error.message })), 422);
    }
}

export default requestHandler;

const host = process.env.HOST || '127.0.0.1';
const entryFile = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (entryFile === fileURLToPath(import.meta.url)) {
    http.createServer(requestHandler).listen(port, host, () => {
        console.log(`${demoBrand} functional preview: http://${host}:${port}/`);
    });
}

function adminLoginPage(params) {
    const error = params.get('error');
    const success = params.get('success');
    return layout(`${demoBrand} Admin belépés`, `
        <main class="login-shell">
            <form class="login-card" method="post" action="/admin/login">
                <p class="eyebrow">Ligetlak Admin · demo</p>
                <h1>Belépés</h1>
                <p class="field-help">Felhasználó: <strong>demo</strong> · Jelszó: <strong>demo1234</strong></p>
                ${success ? `<div class="alert alert-success">${esc(success)}</div>` : ''}
                ${error ? `<div class="alert alert-error">${esc(error)}</div>` : ''}
                <label><span>Felhasználónév</span><input type="text" name="username" required autofocus autocomplete="username"></label>
                <label><span>Jelszó</span><input type="password" name="password" required autocomplete="current-password"></label>
                <label class="check remember-row"><input type="checkbox" name="remember_device" value="1"><span>Emlékezzen rám ezen az eszközön</span></label>
                <button class="primary" type="submit">Belépés</button>
            </form>
        </main>
    `);
}

function handleAdminManagement(res, body) {
    const action = text(body.action);
    const id = Number(body.id);
    const success = message => redirect(res, `/admin/?page=${managementPage(action)}&success=${encodeURIComponent(message)}`);

    if (action === 'settings_save') {
        state.settings.publicMinNights = Math.max(1, Number(body.public_min_nights) || 1);
        for (const accommodation of state.accommodations) {
            state.settings.accommodationColors[accommodation.id] = validColor(body[`accommodation_color_${accommodation.id}`], state.settings.accommodationColors[accommodation.id] || '#2f6f55');
        }
        for (const key of Object.keys(state.settings.statusColors)) {
            state.settings.statusColors[key] = validColor(body[`status_color_${key}`], state.settings.statusColors[key]);
        }
        return success('A beállítások frissültek.');
    }
    if (action === 'prices_save') {
        for (const accommodation of state.accommodations) {
            state.prices[accommodation.code] ||= {};
            for (let guests = accommodation.minGuests; guests <= accommodation.maxGuests; guests += 1) {
                const weekday = body[`weekday_price_${accommodation.code}_${guests}`];
                const weekend = body[`weekend_price_${accommodation.code}_${guests}`];
                if (weekday !== undefined && weekday !== '' && weekend !== undefined && weekend !== '') {
                    state.prices[accommodation.code][guests] = {
                        weekday: Math.max(0, Number(weekday)),
                        weekend: Math.max(0, Number(weekend)),
                    };
                }
            }
        }
        return success('Az árak frissültek.');
    }
    if (action === 'booking_create') {
        const accommodationId = Number(body.accommodation_id);
        const guestName = text(body.guest_name);
        if (!guestName || !accommodation(accommodationId) || !body.checkin_date || !body.checkout_date) {
            return redirect(res, '/admin/?page=bookings&action=new&error=' + encodeURIComponent('A név, a szállás és a dátumok kötelezők.'));
        }
        const result = quote(body);
        state.bookings.push({
            id: nextId(state.bookings), code: nextBookingCode('LL-ADMIN'), source: 'other',
            guestName, guestEmail: text(body.guest_email), guestPhone: text(body.guest_phone), accommodationId,
            checkin: text(body.checkin_date), checkout: text(body.checkout_date), guests: Number(body.guests) || 1,
            includeAmenity: bool(body.include_included_amenity), extraIds: array(body.extra_ids).map(Number), extraDates: result.extraDates,
            couponCode: result.coupon?.code || '', couponDiscount: result.couponDiscount,
            originalTotal: result.subtotal, finalTotal: body.manual_total !== '' ? Math.max(0, Number(body.manual_total)) : result.total, manualTotal: text(body.manual_total),
            depositAmount: '', remainingAmount: '', securityDepositAmount: '', paymentAccount: '', rejectionReason: '',
            guestNotes: text(body.guest_notes), adminNotes: text(body.admin_notes), paymentStatus: 'unpaid',
            createdAt: nowText(), updatedAt: nowText(), statusCode: 'new',
        });
        return success('A foglalás létrejött.');
    }

    const deletes = {
        accommodation_delete: state.accommodations, extra_delete: state.extras, period_delete: state.periods,
        blocked_delete: state.blocked, coupon_delete: state.coupons,
    };
    if (deletes[action]) {
        const index = deletes[action].findIndex(item => item.id === id);
        if (index >= 0) deletes[action].splice(index, 1);
        return success('A bejegyzés törölve.');
    }

    if (action === 'accommodation_save') {
        const item = id ? state.accommodations.find(x => x.id === id) : null;
        const oldCode = item?.code || '';
        const target = item || { id: nextId(state.accommodations), code: '', locks: [], image: '/assets/images/demo/ligetlak-hero-v4.jpg', description: '', sortOrder: state.accommodations.length + 1 };
        const imageUpload = body.image_upload && typeof body.image_upload === 'object' ? body.image_upload : null;
        if (imageUpload?.data?.length) {
            if (!['image/jpeg', 'image/png', 'image/webp'].includes(imageUpload.mime) || imageUpload.data.length > 8 * 1024 * 1024) {
                return redirect(res, '/admin/?page=accommodations&action=' + (item ? `edit&id=${item.id}` : 'new') + '&error=' + encodeURIComponent('Csak legfeljebb 8 MB-os JPG, PNG vagy WebP kép tölthető fel.'));
            }
            target.image = `data:${imageUpload.mime};base64,${imageUpload.data.toString('base64')}`;
        }
        const generatedCode = target.code || `KABIN_${target.id}`;
        Object.assign(target, {
            code: generatedCode, name: text(body.name),
            minGuests: Math.max(1, Number(body.min_guests) || 1), maxGuests: Math.max(1, Number(body.max_guests) || 1),
            image: target.image, description: text(body.description), sortOrder: Number(body.sort_order) || state.accommodations.length + 1,
            amenity: text(body.amenity), amenityDiscount: Math.max(0, Number(body.amenity_discount) || 0),
            locks: target.locks.length ? target.locks : [`unit_${target.id}`], active: bool(body.active),
        });
        if (!item) state.accommodations.push(target);
        if (oldCode && oldCode !== target.code) {
            state.prices[target.code] = state.prices[oldCode] || {};
            delete state.prices[oldCode];
        }
        state.prices[target.code] ||= {};
        const desiredPosition = Math.min(state.accommodations.length, Math.max(1, Number(body.sort_order) || state.accommodations.length));
        const ordered = state.accommodations.filter(accommodationItem => accommodationItem !== target).sort((a, b) => a.sortOrder - b.sortOrder);
        ordered.splice(desiredPosition - 1, 0, target);
        ordered.forEach((accommodationItem, index) => { accommodationItem.sortOrder = index + 1; });
        state.accommodations.splice(0, state.accommodations.length, ...ordered);
        state.settings.accommodationColors[target.id] ||= '#6f8b79';
        return success('A kabin adatai mentve.');
    }
    if (action === 'extra_save') {
        const item = id ? state.extras.find(x => x.id === id) : null;
        const target = item || { id: nextId(state.extras) };
        Object.assign(target, { code: text(body.code).toUpperCase(), name: text(body.name), price: body.price === '' ? null : Math.max(0, Number(body.price)), mode: item?.mode || 'per_booking', accommodationIds: array(body.accommodation_ids).map(Number), active: bool(body.active) });
        if (!item) state.extras.push(target);
        return success('Az extra mentve.');
    }
    if (action === 'period_save') {
        const item = id ? state.periods.find(x => x.id === id) : null;
        const target = item || { id: nextId(state.periods) };
        const prices = {};
        for (const accommodationItem of state.accommodations) {
            const value = body[`period_price_${accommodationItem.code}`];
            if (value !== undefined && value !== '') prices[accommodationItem.code] = Math.max(0, Number(value));
        }
        Object.assign(target, { name: text(body.name), type: item?.type || 'peak', startsOn: text(body.starts_on), endsOn: text(body.ends_on), priority: item?.priority || 20, recurring: bool(body.recurring), disablesDiscount: true, active: bool(body.active), prices });
        if (!item) state.periods.push(target);
        return success('Az árazási időszak mentve.');
    }
    if (action === 'blocked_save') {
        const item = id ? state.blocked.find(x => x.id === id) : null;
        const target = item || { id: nextId(state.blocked) };
        Object.assign(target, { startsOn: text(body.starts_on), endsOn: text(body.ends_on), note: text(body.note), accommodationIds: array(body.accommodation_ids).map(Number), active: bool(body.active) });
        if (!item) state.blocked.push(target);
        return success('A lezárt időszak mentve.');
    }
    if (action === 'coupon_save') {
        const item = id ? state.coupons.find(x => x.id === id) : null;
        const target = item || { id: nextId(state.coupons), usageCount: 0 };
        if (body.valid_from && body.valid_to && body.valid_from > body.valid_to) {
            return redirect(res, '/admin/?page=coupons&error=' + encodeURIComponent('A kupon zárónapja nem lehet korábbi a kezdőnapnál.'));
        }
        const value = Math.max(5, Math.min(100, Math.round(Number(body.value) / 5) * 5));
        Object.assign(target, { code: text(body.code).toUpperCase(), type: 'percent', value, validFrom: text(body.valid_from), validTo: text(body.valid_to), usageLimit: bool(body.unlimited) || body.usage_limit === '' ? null : Math.max(1, Number(body.usage_limit)), minAmount: null, active: bool(body.active) });
        if (!item) state.coupons.push(target);
        return success('A kupon mentve.');
    }
    return redirect(res, '/admin/?error=' + encodeURIComponent('Ismeretlen admin művelet.'));
}

function managementPage(action) {
    if (action.startsWith('accommodation')) return 'accommodations';
    if (action.startsWith('price')) return 'prices';
    if (action.startsWith('extra')) return 'extras';
    if (action.startsWith('period')) return 'periods';
    if (action.startsWith('blocked')) return 'blocked';
    if (action.startsWith('coupon')) return 'coupons';
    if (action.startsWith('setting')) return 'settings';
    if (action.startsWith('booking')) return 'bookings';
    return 'dashboard';
}

function nextId(items) {
    return items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
}

function nextBookingCode(prefix) {
    const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^${escapedPrefix}-(\\d+)$`);
    if (!bookingSequences.has(prefix)) {
        const highest = state.bookings.reduce((maximum, booking) => {
            const match = text(booking.code).match(pattern);
            return match ? Math.max(maximum, Number(match[1]) || 0) : maximum;
        }, 0);
        bookingSequences.set(prefix, highest);
    }
    const next = bookingSequences.get(prefix) + 1;
    bookingSequences.set(prefix, next);
    return `${prefix}-${String(next).padStart(4, '0')}`;
}

function previewAdmin(req, res) {
    if (process.env.PREVIEW_AUTH_BYPASS === '1') {
        return { username: adminUsername };
    }

    const jar = cookies(req);
    const session = jar[sessionCookie];
    if (session && sessions.has(session)) {
        return { username: adminUsername };
    }

    const remembered = jar[rememberCookie];
    if (!remembered || !remembered.includes(':')) {
        return null;
    }

    const [selector, validator] = remembered.split(':', 2);
    const record = rememberTokens.get(hashToken(selector));
    if (!record || record.expiresAt <= Date.now() || record.userAgentHash !== userAgentHash(req)) {
        rememberTokens.delete(hashToken(selector));
        clearCookie(res, rememberCookie);
        return null;
    }

    if (!timingSafeStringEqual(record.validatorHash, hashToken(validator))) {
        rememberTokens.delete(hashToken(selector));
        clearCookie(res, rememberCookie);
        return null;
    }

    const sessionId = token(32);
    const newValidator = token(32);
    sessions.set(sessionId, { username: adminUsername, createdAt: Date.now() });
    rememberTokens.set(hashToken(selector), {
        validatorHash: hashToken(newValidator),
        userAgentHash: userAgentHash(req),
        expiresAt: Date.now() + 30 * 86400000,
    });
    setCookie(res, sessionCookie, sessionId, { httpOnly: true, sameSite: 'Lax', path: '/' });
    setCookie(res, rememberCookie, selector + ':' + newValidator, { httpOnly: true, sameSite: 'Lax', path: '/', maxAge: 30 * 86400 });

    return { username: adminUsername };
}

function attemptPreviewLogin(req, res, username, password, rememberDevice) {
    prunePreviewAttempts();
    const ip = req.socket.remoteAddress || 'local';
    const identifier = hashToken(username.toLowerCase() + '|' + ip);
    const failedCount = loginAttempts.filter(item => item.identifier === identifier && !item.success && item.at >= Date.now() - 15 * 60000).length;
    if (failedCount >= 8 || username !== adminUsername || !verifyPbkdf2(password, adminPasswordHash)) {
        loginAttempts.push({ identifier, success: false, at: Date.now() });
        return false;
    }

    loginAttempts.push({ identifier, success: true, at: Date.now() });
    const sessionId = token(32);
    sessions.set(sessionId, { username: adminUsername, createdAt: Date.now() });
    setCookie(res, sessionCookie, sessionId, { httpOnly: true, sameSite: 'Lax', path: '/' });

    if (rememberDevice) {
        const selector = token(18);
        const validator = token(32);
        rememberTokens.set(hashToken(selector), {
            validatorHash: hashToken(validator),
            userAgentHash: userAgentHash(req),
            expiresAt: Date.now() + 30 * 86400000,
        });
        setCookie(res, rememberCookie, selector + ':' + validator, { httpOnly: true, sameSite: 'Lax', path: '/', maxAge: 30 * 86400 });
    } else {
        clearCookie(res, rememberCookie);
    }

    return true;
}

function logoutPreviewAdmin(req, res) {
    const jar = cookies(req);
    if (jar[sessionCookie]) {
        sessions.delete(jar[sessionCookie]);
    }
    if (jar[rememberCookie]?.includes(':')) {
        const [selector] = jar[rememberCookie].split(':', 2);
        rememberTokens.delete(hashToken(selector));
    }
    clearCookie(res, sessionCookie);
    clearCookie(res, rememberCookie);
}

function verifyPbkdf2(password, storedHash) {
    const [algo, iterations, salt, expected] = storedHash.split('$');
    if (algo !== 'pbkdf2_sha256' || !iterations || !salt || !expected) {
        return false;
    }
    const calculated = crypto.pbkdf2Sync(password, salt, Number(iterations), 32, 'sha256').toString('base64url');
    return timingSafeStringEqual(calculated, expected);
}

function prunePreviewAttempts() {
    const oldest = Date.now() - 24 * 60 * 60000;
    while (loginAttempts.length && loginAttempts[0].at < oldest) {
        loginAttempts.shift();
    }
}

function userAgentHash(req) {
    return hashToken(req.headers['user-agent'] || '');
}

function hashToken(value) {
    return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function timingSafeStringEqual(a, b) {
    const left = Buffer.from(String(a));
    const right = Buffer.from(String(b));
    return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function token(bytes) {
    return crypto.randomBytes(bytes).toString('base64url');
}

function publicPage(params) {
    const selected = selectedAccommodation(params);
    const publicAccommodations = state.accommodations
        .filter(a => a.active !== false)
        .slice()
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.name.localeCompare(b.name, 'hu'));
    const month = normalizeMonth(params.get('month') || todayIso().slice(0, 7));
    const calendar = selected ? calendarData(selected, month) : null;
    const nextCalendar = selected ? calendarData(selected, shiftMonth(month, 1)) : null;
    const created = params.get('created');
    const error = params.get('error');
    const defaultGuests = selected ? Math.max(selected.minGuests, 2) : 2;
    const initialCheckin = params.get('checkin_date') || params.get('checkin') || '';
    const initialCheckout = params.get('checkout_date') || params.get('checkout') || '';
    const initialCoupon = params.get('coupon_code') || '';
    const calendarMinDate = todayIso();
    const calendarMaxDate = iso(addMonths(parseIsoDate(calendarMinDate), 24));
    const calendarMinMonth = calendarMinDate.slice(0, 7);
    const calendarMaxMonth = calendarMaxDate.slice(0, 7);
    const monthLink = targetMonth => `/?${new URLSearchParams(Object.fromEntries(Object.entries({ accommodation: selected?.id || '', choose: 1, month: targetMonth, checkin_date: initialCheckin, checkout_date: initialCheckout }).filter(([, value]) => value !== '')))}#booking`;

    return layout(`${demoBrand} - Foglalás`, `
        <main class="public-shell booking-page">
            <section class="booking-hero">
                <div class="hero-nav"><a class="hero-brand" href="/">Ligetlak <small>Erdőre hangolva</small></a><a class="hero-admin-switch" href="/admin/">Admin felület</a></div>
                <div class="hero-content"><h1>Lassulj le.<br>Az erdő vár.</h1><p class="hero-lead">Két különálló erdei kabin vár benneteket privát wellnesszel, távol a hétköznapok zajától.</p><a class="hero-cta" href="#szallasok">Szállást választok</a></div>
            </section>
            <section class="booking-information" aria-label="Foglalási információk">
                <article class="booking-information-column">
                    <h2>Foglalási tudnivalók</h2>
                    <dl class="policy-list">
                        <div><dt>Minimum tartózkodás</dt><dd>Alapesetben 2 éjszaka, kiemelt ünnepi időszakokban 3 éjszaka.</dd></div>
                        <div><dt>Foglalás és előleg</dt><dd>A foglalás az 50% előleg beérkezésével válik véglegessé. A díjbekérőt e-mailben küldjük.</dd></div>
                        <div><dt>Érkezés és távozás</dt><dd>A kabin 15:00 órától foglalható el, távozás napján 10:00 óráig kérjük átadni.</dd></div>
                        <div><dt>Lemondás</dt><dd>Az érkezés előtt legalább 14 nappal jelzett lemondásnál az előleg egy későbbi időpontra áttehető.</dd></div>
                    </dl>
                </article>
                <article class="booking-information-column featured-periods">
                    <h2>Házirend és nyugodt pihenés</h2>
                    <dl class="policy-list">
                        <div><dt>Csendes időszak</dt><dd>22:00 és 8:00 között kérjük a liget nyugalmának megőrzését.</dd></div>
                        <div><dt>Dohányzás és kisállatok</dt><dd>A kabinokban tilos a dohányzás. Háziállatot jelenleg nem tudunk fogadni.</dd></div>
                        <div><dt>Gyermekek</dt><dd>Kiságyat és etetőszéket előzetes kérésre, díjmentesen készítünk be.</dd></div>
                        <div><dt>Wellness és programok</dt><dd>A privát szauna és a fürdődézsa korlátlan használata a szállásdíj része. Rendezvény és hangos program csak előzetes egyeztetéssel tartható.</dd></div>
                    </dl>
                    <p class="featured-season"><strong>Bemutató kupon:</strong> a <strong>PROBA10</strong> kód 10% kedvezményt ad.</p>
                </article>
            </section>
            ${created ? `<div class="alert alert-success">A foglalási kérés rögzítve: <strong>${esc(created)}</strong>. Az admin previewban azonnal látszik.</div>` : ''}
            ${error ? `<div class="alert alert-error">${esc(error)}</div>` : ''}
            <section class="stay-grid" id="szallasok" aria-label="Szállásegységek">
                ${publicAccommodations.map(a => stayCard(a, selected?.id || 0, month)).join('')}
            </section>
            ${selected ? `
            <form class="booking-form booking-flow" id="booking-form" method="post" action="/booking" data-quote-url="/quote" data-accommodation-name="${esc(selected.name)}">
                <input type="hidden" name="accommodation_id" value="${selected.id}">
                <section class="booking-workspace" id="booking">
                    <div class="calendar-panel">
                        <div class="booking-submit-status" id="booking-submit-status" aria-live="polite" tabindex="-1" hidden></div>
                        <div class="calendar-heading">
                            <div><p class="eyebrow">${esc(selected.name)}</p><h2>Mikor pihennél nálunk?</h2></div>
                            <div class="calendar-controls">
                                <div class="calendar-jump">
                                    <label class="calendar-jump-date"><span>Ugrás dátumhoz</span><span class="calendar-picker-field"><input type="text" id="calendar-jump-display" readonly placeholder="ÉÉÉÉ. HH. NN." aria-label="Dátum választása" aria-haspopup="dialog" aria-expanded="false"><input type="hidden" id="calendar-jump-date" data-min-date="${calendarMinDate}" data-max-date="${calendarMaxDate}" value="${esc(initialCheckin >= calendarMinDate && initialCheckin <= calendarMaxDate ? initialCheckin : '')}"></span></label>
                                    <button class="button secondary" type="button" data-calendar-jump>Ugrás</button>
                                    <div class="booking-date-picker" data-booking-date-picker hidden>
                                        <div class="booking-date-picker-head"><button type="button" data-booking-date-previous aria-label="Előző hónap">‹</button><div><select data-booking-date-year aria-label="Év"></select><strong data-booking-date-month></strong></div><button type="button" data-booking-date-next aria-label="Következő hónap">›</button></div>
                                        <div class="booking-date-picker-weekdays" aria-hidden="true"><span>H</span><span>K</span><span>Sze</span><span>Cs</span><span>P</span><span>Szo</span><span>V</span></div>
                                        <div class="booking-date-picker-days" data-booking-date-days></div>
                                    </div>
                                </div>
                                <div class="month-nav">
                                    ${calendar.month > calendarMinMonth ? `<a class="button secondary" data-calendar-direction="previous" aria-label="Előző hónapok megjelenítése" href="${monthLink(calendar.previous)}"><span aria-hidden="true">←</span> Előző hónap</a>` : '<button class="button secondary" type="button" disabled aria-label="Már az aktuális hónapot látod"><span aria-hidden="true">←</span> Előző hónap</button>'}
                                    ${calendar.month < calendarMaxMonth ? `<a class="button secondary" data-calendar-direction="next" aria-label="Következő hónapok megjelenítése" href="${monthLink(calendar.next)}">Következő hónap <span aria-hidden="true">→</span></a>` : '<button class="button secondary" type="button" disabled aria-label="Elérted a kétéves foglalási időszak végét">Következő hónap <span aria-hidden="true">→</span></button>'}
                                </div>
                            </div>
                        </div>
                        <div class="calendar-legend">
                            <span><i class="free"></i>Szabad</span>
                            <span><i class="pending"></i>Függőben</span>
                            <span><i class="booked"></i>Foglalt</span>
                            <span><i class="blocked"></i>Lezárt</span>
                        </div>
                        <div class="public-calendar-pair" data-start-month="${calendar.month}">
                            <section class="public-calendar-month"><h3>${esc(calendar.month.replace('-', '. '))}.</h3>${calendarHtml(calendar)}</section>
                            <section class="public-calendar-month"><h3>${esc(nextCalendar.month.replace('-', '. '))}.</h3>${calendarHtml(nextCalendar)}</section>
                        </div>
                    </div>
                    <div class="booking-details">
                        <div class="selected-stay">
                            <img src="${selected.image}" alt="${esc(selected.name)}">
                            <div><span>${esc(selected.name)}</span><strong>${capacityLabel(selected)}</strong></div>
                        </div>
                        <div class="grid two">
                            <label><span>Érkezés</span><input type="date" name="checkin_date" id="checkin-date" min="${todayIso()}" max="${calendarMaxDate}" required value="${esc(initialCheckin)}"></label>
                            <label><span>Távozás</span><input type="date" name="checkout_date" id="checkout-date" min="${todayIso()}" required value="${esc(initialCheckout)}"></label>
                        </div>
                        <label><span>Név *</span><input type="text" name="guest_name" required value="Teszt Vendég"></label>
                        <label><span>E-mail *</span><input type="email" name="guest_email" required value="vendeg@example.com"></label>
                        <label><span>Telefonszám *</span><input type="tel" name="guest_phone" required value="+36 30 000 0003"></label>
                        <label><span>Hányan érkeztek? *</span><input type="number" id="guest-count" name="guests" required min="${selected.minGuests}" max="${selected.maxGuests}" data-normal-min="${selected.minGuests}" data-normal-max="${selected.maxGuests}" data-new-year-min="2" data-new-year-max="${newYearMaximumGuests[selected.code] || selected.maxGuests}" value="${defaultGuests}"><small class="field-help" id="guest-capacity-help">Maximum ${selected.maxGuests} fő.</small></label>
                        <fieldset class="fieldset compact-options">
                            <legend>Plusz szolgáltatások</legend>
                            <input type="hidden" name="include_included_amenity" value="1">
                            ${selected.amenity ? `<div class="included-wellness-note"><strong>${esc(selected.amenity)}</strong><span>Korlátlan használattal, a szállásdíj részeként.</span></div>` : ''}
                            ${state.extras.filter(e => e.accommodationIds.includes(selected.id)).map(extraOption).join('')}
                        </fieldset>
                        <label><span>Megjegyzés</span><textarea name="guest_notes" rows="3"></textarea></label>
                    </div>
                </section>
                <section class="summary-panel">
                    <div class="summary-heading">
                        <p class="eyebrow">Összegzés</p>
                        <h2>Foglalási összegző</h2>
                    </div>
                    <div class="quote-box" id="quote-box" aria-live="polite"><p class="quote-hint">A pontos ár a dátumok kijelölése után automatikusan megjelenik.</p><p class="price-note">Az itt megjelenő árak tájékoztató jellegűek. A pontos fizetendő összeget a visszaigazolás után e-mailben küldjük el.</p></div>
                    <div class="booking-finish">
                        <label><span>Kuponkód</span><input type="text" name="coupon_code" autocomplete="off" placeholder="PROBA10" value="${esc(initialCoupon)}"></label>
                        <label class="check privacy-row"><input type="checkbox" name="privacy_accepted" value="1" required><span>Elolvastam és elfogadom az adatvédelmi tájékoztatót.</span></label>
                        <div class="actions"><button type="submit" class="button primary">Foglalás elküldése</button></div>
                    </div>
                </section>
            </form>
            ` : `
            <section class="booking-selection-prompt" aria-live="polite">
                <h2>Válassz szállást a foglalás megkezdéséhez!</h2>
                <p>A naptár és a foglalási adatok a kiválasztott szállásegységre kattintva jelennek meg.</p>
            </section>
            `}
            <section class="bucket-list-section contact-offer-section" aria-labelledby="contact-offer-title">
                <p class="section-number">Weboldal és foglalási rendszer</p>
                <h2 id="contact-offer-title">Tetszik, amit látsz?</h2>
                <p>Ha a saját szálláshelyedhez is ilyen átgondolt weboldalt és foglalási rendszert szeretnél, keress meg. Szívesen megmutatom, mit építhetünk együtt.</p>
                <a class="bucket-list-button" href="https://csitaryoffice.hu/szolgaltatasok/" target="_blank" rel="noopener noreferrer">Keress meg</a>
            </section>
        </main>
        <script src="/assets/app.js?v=forest-hungary-24"></script>
    `);
}

function stayCard(a, selectedId, month) {
    return `<a class="stay-card ${a.id === selectedId ? 'active' : ''}" href="/?accommodation=${a.id}&choose=1&month=${month}">
        <img src="${a.image}" alt="${esc(a.name)}">
        <span class="stay-card-body">
            <strong>${esc(a.name)}</strong>
            <small>${capacityLabel(a)}</small><p>${esc(a.description || '')}</p>
            <em>${money(startingPrice(a))}-tól / éj</em>
        </span>
    </a>`;
}

function calendarHtml(calendar) {
    const weekdays = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'];
    const blanks = Array.from({ length: calendar.offset }, () => '<div class="calendar-empty"></div>').join('');
    const days = Array.from({ length: calendar.days }, (_, index) => {
        const day = index + 1;
        const date = `${calendar.month}-${String(day).padStart(2, '0')}`;
        const item = calendar.statuses[date] || { morning: 'free', afternoon: 'free', labels: [] };
        const past = date < todayIso();
        const full = past || (item.morning !== 'free' && item.afternoon !== 'free');
        const accessibilityLabel = past ? 'Elmúlt' : (full ? 'Foglalt' : (item.morning !== 'free' || item.afternoon !== 'free' ? 'Részben foglalt' : 'Szabad'));
        return `<button class="calendar-day morning-${item.morning} afternoon-${item.afternoon}${past ? ' past-date' : ''}" type="button" data-date="${date}" data-morning-status="${item.morning}" data-afternoon-status="${item.afternoon}" aria-label="${date} – ${accessibilityLabel}" ${full ? 'disabled' : ''}><strong>${day}</strong></button>`;
    }).join('');

    return `<div class="availability-calendar" data-min-nights="${state.settings.publicMinNights}">
        ${weekdays.map(day => `<div class="calendar-weekday">${day}</div>`).join('')}
        ${blanks}${days}
    </div>`;
}

function extraOption(extra) {
    const sauna = extra.code === 'SAUNA_TUB_SHOWER';
    const priceUnit = sauna ? 'nap' : (extra.mode === 'per_night' ? 'éj' : 'foglalás');
    const price = extra.price === null ? 'ár egyeztetés alapján' : `${money(extra.price)} / ${priceUnit}`;
    return `<label class="check"><input type="checkbox" name="extra_ids" value="${extra.id}" ${sauna ? 'data-sauna-extra' : ''}><span>${esc(extra.name)} <small>${price}</small></span></label>${sauna ? `<div class="sauna-days" data-sauna-days data-extra-id="${extra.id}" data-selected-dates="[]"></div>` : ''}`;
}

function adminPage(params) {
    const success = params.get('success');
    const error = params.get('error');
    const page = params.get('page') || 'dashboard';
    const pages = {
        dashboard: adminDashboardPage,
        calendar: adminCalendarPage,
        bookings: adminBookingsPage,
        archive: adminArchivePage,
        accommodations: adminAccommodationsPage,
        prices: adminPricesPage,
        extras: adminExtrasPage,
        periods: adminPeriodsPage,
        blocked: adminBlockedPage,
        coupons: adminCouponsPage,
        settings: adminSettingsPage,
    };
    const content = (pages[page] || adminDashboardPage)(params);

    return layout(`${demoBrand} Admin - preview`, `
        <div class="admin-layout">
            <aside class="admin-sidebar" data-admin-sidebar>
                <div class="admin-sidebar-head"><h1>Ligetlak Admin</h1><button class="admin-menu-toggle" type="button" aria-expanded="false" aria-controls="admin-navigation" data-admin-menu-toggle><span></span><span></span><span></span><b>Menü</b></button></div>
                <div class="admin-sidebar-menu" id="admin-navigation" data-admin-menu>
                <nav>
                    <a class="${page === 'dashboard' ? 'active' : ''}" href="/admin/">Áttekintés</a>
                    <a class="${page === 'calendar' ? 'active' : ''}" href="/admin/?page=calendar">Naptár</a>
                    <a class="${page === 'bookings' ? 'active' : ''}" href="/admin/?page=bookings">Foglalások</a>
                    <a class="${page === 'archive' ? 'active' : ''}" href="/admin/?page=archive">Archívum</a>
                    <a class="${page === 'accommodations' ? 'active' : ''}" href="/admin/?page=accommodations">Kabinok</a>
                    <a class="${page === 'prices' ? 'active' : ''}" href="/admin/?page=prices">Kabinárak</a>
                    <a class="${page === 'extras' ? 'active' : ''}" href="/admin/?page=extras">Extrák</a>
                    <a class="${page === 'periods' ? 'active' : ''}" href="/admin/?page=periods">Árazási időszakok</a>
                    <a class="${page === 'blocked' ? 'active' : ''}" href="/admin/?page=blocked">Lezárt időpontok</a>
                    <a class="${page === 'coupons' ? 'active' : ''}" href="/admin/?page=coupons">Kuponok</a>
                    <a class="${page === 'settings' ? 'active' : ''}" href="/admin/?page=settings">Beállítások</a>
                    <a href="/">Publikus oldal</a>
                </nav>
                </div>
            </aside>
            <main class="admin-content">
                <div class="admin-topbar">
                    <div><p class="eyebrow">Funkcionális preview</p><h1>${adminPageTitle(page)}</h1></div>
                    <div class="admin-topbar-actions"><a class="button secondary admin-public-switch" href="/">Foglalási oldal</a><span>Bemutató rendszer · ${esc(adminUsername)}</span></div>
                </div>
                ${success ? `<div class="alert alert-success">${esc(success)}</div>` : ''}
                ${error ? `<div class="alert alert-error">${esc(error)}</div>` : ''}
                ${content}
            </main>
        </div>
        <script src="/assets/app.js?v=forest-hungary-25"></script>
    `);
}

function adminPageTitle(page) {
    return {
        dashboard: 'Áttekintés', calendar: 'Naptár', bookings: 'Foglalások', archive: 'Archívum',
        accommodations: 'Kabinok', prices: 'Kabinárak', extras: 'Extrák',
        periods: 'Árazási időszakok', blocked: 'Lezárt időpontok',
        coupons: 'Kuponok', settings: 'Beállítások',
    }[page] || 'Áttekintés';
}

function adminDashboardPage(params) {
    const dashboardLists = {
        all: ['Összes foglalás', state.bookings],
        active: ['Aktív foglalások', state.bookings.filter(b => ['new', 'confirmed', 'modified'].includes(b.statusCode))],
        pending: ['Függőben lévő foglalások', state.bookings.filter(b => b.statusCode === 'new')],
        upcoming: ['Közelgő foglalások', state.bookings.filter(b => b.checkout >= todayIso()).slice().sort((a, b) => a.checkin.localeCompare(b.checkin))],
    };
    const dashboardPanels = Object.entries(dashboardLists).map(([key, [title, rows]]) => `
        <div data-dashboard-panel="${key}" ${key === 'upcoming' ? '' : 'hidden'}>
            <h2>${esc(title)}</h2>
            ${rows.length === 0 ? '<div class="alert alert-info">Ebben a kategóriában jelenleg nincs foglalás.</div>' : ''}
            ${bookingTable(rows, false)}
        </div>
    `).join('');
    return `
        <section class="admin-card">
            <div class="admin-topbar"><h2>Naptár</h2><div class="inline-actions"><a class="button primary" href="/admin/?page=bookings&action=new">Új foglalás hozzáadása</a><a class="button secondary" href="/admin/?page=calendar">Naptár menü</a></div></div>
            ${adminCalendarPanel(params, true)}
        </section>
        <section class="stats" role="tablist" aria-label="Foglalások gyorsszűrője">
            <button class="stat" type="button" role="tab" aria-selected="false" data-dashboard-tab="all"><span>Összes foglalás</span><strong>${state.bookings.length}</strong><small>Lista megjelenítése</small></button>
            <button class="stat" type="button" role="tab" aria-selected="false" data-dashboard-tab="active"><span>Aktív foglalás</span><strong>${state.bookings.filter(b => ['new', 'confirmed', 'modified'].includes(b.statusCode)).length}</strong><small>Lista megjelenítése</small></button>
            <button class="stat" type="button" role="tab" aria-selected="false" data-dashboard-tab="pending"><span>Függőben</span><strong>${state.bookings.filter(b => b.statusCode === 'new').length}</strong><small>Lista megjelenítése</small></button>
        </section>
        <section class="admin-card" id="dashboard-bookings">
            ${dashboardPanels}
        </section>
        ${adminUtilitySections()}
    `;
}

function adminAccommodationsPage(params) {
    const id = Number(params.get('id'));
    const row = id ? state.accommodations.find(item => item.id === id) : null;
    if (params.get('action') === 'new' || (params.get('action') === 'edit' && row)) {
        const item = row || { id: '', code: '', name: '', minGuests: 1, maxGuests: 2, amenity: '', amenityDiscount: 0, image: '/assets/images/demo/ligetlak-hero-v4.jpg', description: '', sortOrder: state.accommodations.length + 1, locks: [], active: true };
        const positionCount = state.accommodations.length + (row ? 0 : 1);
        const positionOptions = Array.from({ length: positionCount }, (_, index) => `<option value="${index + 1}" ${Number(item.sortOrder) === index + 1 ? 'selected' : ''}>${index + 1}.</option>`).join('');
        return adminFormCard(row ? 'Kabin szerkesztése' : 'Új kabin', 'accommodation_save', 'accommodations', `
            ${hiddenId(item.id)}<div class="grid three">
                ${input('Név', 'name', item.name, 'text', true)}<label><span>Megjelenési sorrend</span><select name="sort_order">${positionOptions}</select></label>
                ${input('Minimum vendég', 'min_guests', item.minGuests, 'number', true)}${input('Maximum vendég', 'max_guests', item.maxGuests, 'number', true)}${input('Wellness megnevezése', 'amenity', item.amenity)}
            </div>
            <label><span>Kabin képe</span><input type="file" name="image_upload" accept="image/jpeg,image/png,image/webp"><small class="field-help">JPG, PNG vagy WebP, legfeljebb 8 MB.</small></label>
            ${item.image ? `<div class="admin-current-image"><img src="${esc(item.image)}" alt="${esc(item.name || 'Kabin')} jelenlegi képe"><strong>Jelenlegi kép</strong></div>` : ''}
            <label><span>Leírás</span><textarea name="description" rows="3">${esc(item.description || '')}</textarea></label>
            <p class="field-help">A kabin hétköznapi és hétvégi árai külön, a „Kabinárak” menüpontban szerkeszthetők.</p>
            ${check('active', 'Megjelenjen a foglalási felületen', item.active !== false)}`, true, true);
    }
    const rows = state.accommodations.slice().sort((a, b) => a.sortOrder - b.sortOrder).map(a => `<tr><td>${a.sortOrder}.</td><td>${esc(a.name)}</td><td>${a.minGuests}–${a.maxGuests} fő</td><td>${esc(a.amenity)}</td><td>${a.active === false ? 'Nem' : 'Igen'}</td><td>${editDelete('accommodations', 'accommodation_delete', a.id)}</td></tr>`).join('');
    return adminListCard('Kabinok', 'accommodations', 'Új kabin', '<th>Sorrend</th><th>Név</th><th>Létszám</th><th>Wellness</th><th>Publikus</th><th></th>', rows);
}

function adminPricesPage() {
    const cards = state.accommodations.map(a => {
        const fields = [];
        for (let guests = a.minGuests; guests <= a.maxGuests; guests += 1) {
            const prices = state.prices[a.code]?.[guests] || {};
            fields.push(`<label><span>${guests} fő – hétköznapi ár / éj</span><div class="price-input"><input type="number" inputmode="numeric" min="0" name="weekday_price_${esc(a.code)}_${guests}" value="${esc(prices.weekday ?? '')}"><span>Ft</span></div></label>`);
            fields.push(`<label><span>${guests} fő – hétvégi ár / éj</span><div class="price-input"><input type="number" inputmode="numeric" min="0" name="weekend_price_${esc(a.code)}_${guests}" value="${esc(prices.weekend ?? '')}"><span>Ft</span></div></label>`);
        }
        return `<fieldset class="fieldset price-accommodation-card"><legend>${esc(a.name)}</legend><div class="price-input-grid">${fields.join('')}</div></fieldset>`;
    }).join('');
    return `<section class="admin-card price-matrix-card"><div class="admin-topbar"><div><p class="eyebrow">Alap árterv</p><h2>Kabinárak</h2></div></div><form method="post" action="/admin/manage"><input type="hidden" name="action" value="prices_save"><div class="price-accommodation-list">${cards}</div><div class="actions"><button class="primary" type="submit">Kabinárak mentése</button></div></form></section>`;
}

function adminExtrasPage(params) {
    const id = Number(params.get('id'));
    const row = id ? state.extras.find(item => item.id === id) : null;
    if (params.get('action') === 'new' || (params.get('action') === 'edit' && row)) {
        const item = row || { id: '', code: '', name: '', price: '', mode: 'per_booking', accommodationIds: [], active: true };
        return adminFormCard(row ? 'Extra szerkesztése' : 'Új extra', 'extra_save', 'extras', `${hiddenId(item.id)}<div class="grid three">${input('Kód', 'code', item.code, 'text', true)}${input('Név', 'name', item.name, 'text', true)}${input('Ár', 'price', item.price ?? '', 'number')}</div>${accommodationChecks(item.accommodationIds)}${check('active', 'Aktív', item.active !== false)}`);
    }
    const rows = state.extras.map(x => `<tr><td>${esc(x.code)}</td><td>${esc(x.name)}</td><td>${money(x.price)}</td><td>${x.active === false ? 'Nem' : 'Igen'}</td><td>${editDelete('extras', 'extra_delete', x.id)}</td></tr>`).join('');
    return adminListCard('Extrák', 'extras', 'Új extra', '<th>Kód</th><th>Név</th><th>Ár</th><th>Aktív</th><th></th>', rows);
}

function adminPeriodsPage(params) {
    const id = Number(params.get('id'));
    const row = id ? state.periods.find(item => item.id === id) : null;
    if (params.get('action') === 'new' || (params.get('action') === 'edit' && row)) {
        const item = row || { id: '', name: '', type: 'peak', startsOn: '', endsOn: '', priority: 20, recurring: false, disablesDiscount: true, active: true, prices: {} };
        const periodPrices = state.accommodations.map(a => unitNumberInput(`${a.name} ára éjszakánként`, `period_price_${a.code}`, item.prices?.[a.code] ?? '', 'Ft', 1000, 0, '', true)).join('');
        return adminFormCard(row ? 'Időszak szerkesztése' : 'Új időszak', 'period_save', 'periods', `<p class="field-help">Add meg az időszak nevét, dátumait és a kabinok erre az időszakra érvényes éjszakánkénti árát.</p>${hiddenId(item.id)}<div class="grid three">${input('Név', 'name', item.name, 'text', true)}${input('Kezdete', 'starts_on', item.startsOn, 'date', true)}${input('Vége', 'ends_on', item.endsOn, 'date', true)}</div><fieldset class="fieldset price-accommodation-card"><legend>Időszaki kabinárak</legend><div class="price-input-grid">${periodPrices}</div></fieldset><div class="grid two">${check('recurring', 'Évente ismétlődjön', item.recurring)}${check('active', 'Aktív', item.active !== false)}</div>`);
    }
    const rows = state.periods.map(p => `<tr><td>${esc(p.name)}</td><td>${esc(p.startsOn)} – ${esc(p.endsOn)}</td><td>${state.accommodations.map(a => `${esc(a.name)}: ${money(p.prices?.[a.code] ?? 0)} / éj`).join('<br>')}</td><td>${p.recurring ? 'Évente' : 'Egyszeri'}</td><td>${p.active ? 'Igen' : 'Nem'}</td><td>${editDelete('periods', 'period_delete', p.id)}</td></tr>`).join('');
    return adminListCard('Árazási időszakok', 'periods', 'Új időszak', '<th>Név</th><th>Dátum</th><th>Időszaki árak</th><th>Ismétlődés</th><th>Aktív</th><th></th>', rows);
}

function adminBlockedPage(params) {
    const id = Number(params.get('id'));
    const row = id ? state.blocked.find(item => item.id === id) : null;
    if (params.get('action') === 'new' || (params.get('action') === 'edit' && row)) {
        const item = row || { id: '', startsOn: '', endsOn: '', accommodationIds: [], note: '', active: true };
        return adminFormCard(row ? 'Lezárás szerkesztése' : 'Új lezárás', 'blocked_save', 'blocked', `${hiddenId(item.id)}<div class="grid three">${input('Kezdete', 'starts_on', item.startsOn, 'date', true)}${input('Vége', 'ends_on', item.endsOn, 'date', true)}${input('Megjegyzés / ok', 'note', item.note)}</div>${accommodationChecks(item.accommodationIds)}${check('active', 'Aktív', item.active !== false)}`);
    }
    const rows = state.blocked.map(p => `<tr><td>${esc(p.startsOn)} – ${esc(p.endsOn)}</td><td>${p.accommodationIds.map(id => esc(accommodation(id)?.name || '')).join(', ')}</td><td>${esc(p.note)}</td><td>${p.active ? 'Igen' : 'Nem'}</td><td>${editDelete('blocked', 'blocked_delete', p.id)}</td></tr>`).join('');
    return adminListCard('Lezárt időpontok', 'blocked', 'Új lezárás', '<th>Időszak</th><th>Szállások</th><th>Megjegyzés</th><th>Aktív</th><th></th>', rows);
}

function adminCouponsPage(params) {
    const id = Number(params.get('id'));
    const row = id ? state.coupons.find(item => item.id === id) : null;
    if (params.get('action') === 'new' || (params.get('action') === 'edit' && row)) {
        const item = row || { id: '', code: '', type: 'percent', value: 5, validFrom: '', validTo: '', usageLimit: null, active: true };
        return adminFormCard(row ? 'Kupon szerkesztése' : 'Új kupon', 'coupon_save', 'coupons', `${hiddenId(item.id)}<div class="grid three">${input('Kód', 'code', item.code, 'text', true)}${unitNumberInput('Kedvezmény', 'value', item.value, '%', 5, 5, 100, true)}${unitNumberInput('Felhasználási limit', 'usage_limit', item.usageLimit ?? '', '×', 1, 1, '', false, 'data-coupon-limit-input')} ${input('Érvényesség kezdete', 'valid_from', item.validFrom || '', 'date')}${input('Érvényesség vége', 'valid_to', item.validTo || '', 'date')}</div>${check('unlimited', 'Korlátlan felhasználás', item.usageLimit === null, 'data-coupon-unlimited')}${check('active', 'Aktív', item.active !== false)}`);
    }
    const rows = state.coupons.map(c => `<tr><td>${esc(c.code)}</td><td>${c.value}%</td><td>${esc(c.validFrom || 'Nincs kezdőnap')}<br>${esc(c.validTo || 'Nincs zárónap')}</td><td>${c.usageLimit === null ? 'Korlátlan' : `${c.usageLimit}×`}</td><td>${c.usageCount}×</td><td>${c.active ? 'Igen' : 'Nem'}</td><td>${editDelete('coupons', 'coupon_delete', c.id)}</td></tr>`).join('');
    return adminListCard('Kuponok', 'coupons', 'Új kupon', '<th>Kód</th><th>Kedvezmény</th><th>Érvényesség</th><th>Limit</th><th>Használat</th><th>Aktív</th><th></th>', rows);
}

function adminSettingsPage() {
    const accommodationColors = state.accommodations.map(a => `<label class="color-setting"><span>${esc(a.name)}</span><input type="color" name="accommodation_color_${a.id}" value="${esc(state.settings.accommodationColors[a.id] || '#2f6f55')}"></label>`).join('');
    const statusLabels = { pending: 'Függő', confirmed: 'Visszaigazolt', paid: 'Fizetett', rejected: 'Visszautasított', cancelled: 'Lemondott', blocked: 'Lezárt' };
    const statusColors = Object.entries(statusLabels).map(([key, label]) => `<label class="color-setting"><span>${label}</span><input type="color" name="status_color_${key}" value="${esc(state.settings.statusColors[key])}"></label>`).join('');
    return adminFormCard('Beállítások', 'settings_save', 'settings', `<div class="grid two">${input('Online minimum éjszakák', 'public_min_nights', state.settings.publicMinNights, 'number', true)}</div><fieldset class="fieldset color-settings"><legend>Kabinok színei az admin naptárban</legend><div class="color-settings-grid">${accommodationColors}</div></fieldset><fieldset class="fieldset color-settings"><legend>Foglalási állapotok színei</legend><div class="color-settings-grid">${statusColors}</div></fieldset>`, false);
}

function adminListCard(title, page, newLabel, headings, rows) {
    return `<section class="admin-card"><div class="admin-topbar"><h2>${title}</h2><a class="button primary" href="/admin/?page=${page}&action=new">${newLabel}</a></div><div class="table-wrap management-table-wrap"><table class="management-table"><thead><tr>${headings}</tr></thead><tbody>${rows || '<tr><td colspan="8">Nincs megjeleníthető adat.</td></tr>'}</tbody></table></div></section>`;
}

function adminFormCard(title, action, page, fields, back = true, multipart = false) {
    return `<section class="admin-card"><h2>${title}</h2><form method="post" action="/admin/manage" ${multipart ? 'enctype="multipart/form-data"' : ''}><input type="hidden" name="action" value="${action}">${fields}<div class="actions"><button class="primary" type="submit">Mentés</button>${back ? `<a class="button secondary" href="/admin/?page=${page}">Vissza</a>` : ''}</div></form></section>`;
}

function input(label, name, value, type = 'text', required = false) {
    return `<label><span>${label}</span><input type="${type}" name="${name}" value="${esc(value)}" ${required ? 'required' : ''}></label>`;
}

function check(name, label, checkedValue, attributes = '') {
    return `<label class="check"><input type="checkbox" name="${name}" value="1" ${checkedValue ? 'checked' : ''} ${attributes}><span>${label}</span></label>`;
}

function unitNumberInput(label, name, value, unit, step = 1, min = 0, max = '', required = false, attributes = '') {
    return `<label><span>${label}</span><div class="unit-input"><input type="number" name="${name}" value="${esc(value)}" step="${step}" min="${min}" ${max !== '' ? `max="${max}"` : ''} ${required ? 'required' : ''} ${attributes}><span>${unit}</span></div></label>`;
}

function hiddenId(id) {
    return id ? `<input type="hidden" name="id" value="${id}">` : '';
}

function accommodationChecks(selectedIds = []) {
    return `<fieldset class="fieldset"><legend>Szállások</legend>${state.accommodations.map(a => `<label class="check"><input type="checkbox" name="accommodation_ids" value="${a.id}" ${selectedIds.includes(a.id) ? 'checked' : ''}><span>${esc(a.name)}</span></label>`).join('')}</fieldset>`;
}

function editDelete(page, action, id) {
    return `<div class="inline-actions"><a class="button secondary" href="/admin/?page=${page}&action=edit&id=${id}">Szerkesztés</a><form method="post" action="/admin/manage" onsubmit="return confirm('Biztosan törlöd?')"><input type="hidden" name="action" value="${action}"><input type="hidden" name="id" value="${id}"><button class="secondary" type="submit">Törlés</button></form></div>`;
}

function adminCalendarPage(params) {
    return `<section class="admin-card"><div class="admin-topbar"><h2>Naptár</h2><div class="inline-actions"><a class="button primary" href="/admin/?page=bookings&action=new">Új foglalás hozzáadása</a><a class="button secondary" href="/admin/?page=bookings">Foglaláslista</a></div></div>${adminCalendarPanel(params, false)}</section>`;
}

function adminBookingsPage(params) {
    const action = params.get('action') || 'list';
    const id = Number(params.get('id'));
    if (action === 'new') {
        const options = state.accommodations.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('');
        const extraOptions = state.extras.filter(extra => extra.active).map(extra => {
            const sauna = extra.code === 'SAUNA_TUB_SHOWER';
            return `<div data-admin-extra-option data-accommodation-ids="${extra.accommodationIds.join(',')}"><label class="check"><input type="checkbox" name="extra_ids" value="${extra.id}" ${sauna ? 'data-sauna-extra' : ''}><span>${esc(extra.name)}${extra.price === null ? '' : ' · ' + money(extra.price)}</span></label>${sauna ? `<div class="sauna-days" data-sauna-days data-extra-id="${extra.id}" data-selected-dates="[]"></div>` : ''}</div>`;
        }).join('');
        return adminFormCard('Új foglalás hozzáadása', 'booking_create', 'bookings', `
            <div class="grid three">${input('Vendég neve', 'guest_name', '', 'text', true)}${input('E-mail', 'guest_email', '', 'email')}${input('Telefonszám', 'guest_phone', '')}
            <label><span>Apartman</span><select name="accommodation_id" required data-admin-accommodation>${options}</select></label><label><span>Érkezés</span><input type="date" id="checkin-date" name="checkin_date" required></label><label><span>Távozás</span><input type="date" id="checkout-date" name="checkout_date" required></label>${input('Vendégek', 'guests', 2, 'number', true)}${input('Kézi végösszeg', 'manual_total', '', 'number')}</div>
            <input type="hidden" name="include_included_amenity" value="1"><div class="included-wellness-note"><strong>Privát wellness az árban</strong><span>A szauna és a fürdődézsa használata automatikusan a foglalás része.</span></div>
            <fieldset class="fieldset"><legend>Az apartmanhoz elérhető plusz szolgáltatások</legend>${extraOptions}</fieldset>
            <label><span>Vendég megjegyzése</span><textarea name="guest_notes" rows="3"></textarea></label><label><span>Admin megjegyzés</span><textarea name="admin_notes" rows="3"></textarea></label>`);
    }
    if (action === 'edit' && id) {
        const booking = state.bookings.find(b => b.id === id);
        return booking ? bookingDetail(booking) : '<section class="admin-card"><p>A foglalás nem található.</p></section>';
    }

    const filters = bookingFilters(params, false);
    const rows = filterBookings(filters);
    return `
        <section class="admin-card">
            <div class="admin-topbar"><h2>Foglalások</h2><a class="button primary" href="/admin/?page=bookings&action=new">Új foglalás hozzáadása</a></div>
            ${bookingFilterbar(filters)}
            ${rows.length === 0 ? '<div class="alert alert-info">Nem található a megadott feltételeknek megfelelő foglalás. Módosítsd a keresést vagy töröld a szűrőket.</div>' : ''}
            ${bookingTable(rows, true)}
        </section>
    `;
}

function adminArchivePage(params) {
    const action = params.get('action') || 'list';
    const id = Number(params.get('id'));
    if (action === 'edit' && id) {
        const booking = state.bookings.find(b => b.id === id);
        return booking ? bookingDetail(booking, 'archive') : '<section class="admin-card"><p>A foglalás nem található.</p></section>';
    }
    const filters = bookingFilters(params, true);
    const rows = filterBookings(filters);
    return `<section class="admin-card"><div class="admin-topbar"><h2>Archív foglalások</h2></div>${bookingFilterbar(filters, 'archive')}${rows.length === 0 ? '<div class="alert alert-info">Nem található a megadott feltételeknek megfelelő foglalás.</div>' : ''}${bookingTable(rows, true, 'archive')}</section>`;
}

function bookingFilterbar(filters, page = 'bookings') {
    const statusOptions = state.bookingStatuses.map(status => `<option value="${status.code}" ${filters.status === status.code ? 'selected' : ''}>${esc(status.label)}</option>`).join('');
    const paymentOptions = state.paymentStatuses.map(status => `<option value="${status.code}" ${filters.paymentStatus === status.code ? 'selected' : ''}>${esc(status.label)}</option>`).join('');
    const accommodationOptions = state.accommodations.map(a => `<option value="${a.id}" ${String(filters.accommodationId) === String(a.id) ? 'selected' : ''}>${esc(a.name)}</option>`).join('');
    return `
        <form class="admin-filterbar" method="get" action="/admin/">
            <input type="hidden" name="page" value="${page}">
            <label><span>Keresés minden adatban</span><input name="q" value="${esc(filters.q)}" placeholder="Név, e-mail, telefon, azonosító, dátum, összeg…"></label>
            <label><span>Szállás</span><select name="accommodation_id"><option value="">Mind</option>${accommodationOptions}</select></label>
            <label><span>Státusz</span><select name="status"><option value="">Mind</option>${statusOptions}</select></label>
            <label><span>Fizetés</span><select name="payment_status"><option value="">Mind</option>${paymentOptions}</select></label>
            <label><span>Foglalás időbeli helyzete</span><select name="scope">
                <option value="all" ${filters.scope === 'all' ? 'selected' : ''}>Minden foglalás</option>
                <option value="blocking" ${filters.scope === 'blocking' ? 'selected' : ''}>Aktív foglalások</option>
                <option value="ongoing" ${filters.scope === 'ongoing' ? 'selected' : ''}>Éppen zajlik</option>
                <option value="upcoming" ${filters.scope === 'upcoming' ? 'selected' : ''}>Jövőbeli</option>
                <option value="past" ${filters.scope === 'past' ? 'selected' : ''}>Már lezajlott / archív</option>
            </select></label>
            <div class="admin-filterbar-final-row">
                <label><span>Érkezés ettől</span><input type="date" name="from" value="${esc(filters.from)}"></label>
                <label><span>Távozás eddig</span><input type="date" name="to" value="${esc(filters.to)}"></label>
                <label><span>Rendezés</span><select name="sort">
                    <option value="checkin_desc" ${filters.sort === 'checkin_desc' ? 'selected' : ''}>Érkezés szerint csökkenő</option>
                    <option value="checkin_asc" ${filters.sort === 'checkin_asc' ? 'selected' : ''}>Érkezés szerint növekvő</option>
                    <option value="created_desc" ${filters.sort === 'created_desc' ? 'selected' : ''}>Legfrissebb kérés</option>
                    <option value="guest_asc" ${filters.sort === 'guest_asc' ? 'selected' : ''}>Vendég neve</option>
                    <option value="total_desc" ${filters.sort === 'total_desc' ? 'selected' : ''}>Összeg szerint</option>
                </select></label>
                <div class="filter-actions"><button class="primary" type="submit">Szűrés</button><a class="button secondary" href="/admin/?page=${page}">Törlés</a></div>
            </div>
        </form>
    `;
}

function bookingFilters(params, archived = false) {
    return {
        q: text(params.get('q')),
        accommodationId: text(params.get('accommodation_id')),
        status: text(params.get('status')),
        paymentStatus: text(params.get('payment_status')),
        from: text(params.get('from')),
        to: text(params.get('to')),
        sort: text(params.get('sort') || 'checkin_desc'),
        scope: text(params.get('scope') || (archived ? 'past' : 'all')),
    };
}

function filterBookings(filters) {
    const q = filters.q.toLowerCase();
    let rows = state.bookings.filter(b => {
        const a = accommodation(b.accommodationId);
        const selectedExtras = (b.extraIds || []).map(id => state.extras.find(extra => extra.id === id)?.name || id);
        const haystack = [b.id, b.code, b.source, b.guestName, b.guestEmail, b.guestPhone, b.guestNotes, b.adminNotes, b.rejectionReason, b.checkin, b.checkout, b.guests, b.includeAmenity, b.originalTotal, b.finalTotal, b.manualTotal, b.depositAmount, b.remainingAmount, b.securityDepositAmount, paymentAccountLabel(b.paymentAccount), b.couponCode, b.couponDiscount, b.statusCode, bookingStatusLabel(b.statusCode), b.paymentStatus, paymentStatusLabel(b.paymentStatus), b.createdAt, b.updatedAt, a.id, a.code, a.name, ...selectedExtras, JSON.stringify(b.extraDates || {})].join(' ').toLowerCase();
        const scopeMatches = filters.scope === 'past' ? b.checkout < todayIso()
            : filters.scope === 'blocking' ? ['new', 'confirmed', 'modified'].includes(b.statusCode)
            : filters.scope === 'ongoing' ? b.checkin <= todayIso() && b.checkout >= todayIso()
                : filters.scope === 'upcoming' ? b.checkin > todayIso()
                    : true;
        return (!q || haystack.includes(q))
            && scopeMatches
            && (!filters.accommodationId || String(b.accommodationId) === String(filters.accommodationId))
            && (!filters.status || b.statusCode === filters.status)
            && (!filters.paymentStatus || b.paymentStatus === filters.paymentStatus)
            && (!filters.from || b.checkout >= filters.from)
            && (!filters.to || b.checkin <= filters.to);
    });

    rows = rows.slice();
    if (filters.sort === 'checkin_asc') rows.sort((a, b) => a.checkin.localeCompare(b.checkin));
    else if (filters.sort === 'created_desc') rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    else if (filters.sort === 'guest_asc') rows.sort((a, b) => a.guestName.localeCompare(b.guestName, 'hu'));
    else if (filters.sort === 'total_desc') rows.sort((a, b) => b.finalTotal - a.finalTotal);
    else rows.sort((a, b) => b.checkin.localeCompare(a.checkin));
    return rows;
}

function bookingTable(rows, actions, page = 'bookings') {
    const body = rows.map(b => {
        const a = accommodation(b.accommodationId);
        return `<tr class="booking-table-row" data-booking-modal-url="/admin/?page=${page}&action=edit&id=${b.id}" tabindex="0">
            <td data-label="Azonosító"><span class="cell-value"><a class="booking-table-detail-link" data-booking-modal href="/admin/?page=${page}&action=edit&id=${b.id}">${esc(b.code)}</a></span></td>
            <td data-label="Vendég"><span class="cell-value">${esc(b.guestName)}<br><small>${esc(b.guestEmail)}<br>${esc(b.guestPhone)}</small></span></td>
            <td data-label="Szállás"><span class="cell-value">${esc(a.name)}</span></td>
            <td data-label="Időszak"><span class="cell-value">${esc(b.checkin)} - ${esc(b.checkout)}</span></td>
            <td data-label="Státusz"><span class="cell-value"><span class="status-pill status-${esc(b.statusCode)}">${esc(bookingStatusLabel(b.statusCode))}</span></span></td>
            <td data-label="Fizetés"><span class="cell-value"><span class="status-pill payment-${esc(b.paymentStatus)}">${esc(paymentStatusLabel(b.paymentStatus))}</span></span></td>
            <td data-label="Összeg"><span class="cell-value">${money(b.finalTotal)}</span></td>
            ${actions ? `<td class="action-cell" data-label="Műveletek"><div class="inline-actions action-cell-buttons">
                <a class="button secondary" data-booking-modal href="/admin/?page=${page}&action=edit&id=${b.id}">Adatlap</a>
                ${b.statusCode !== 'confirmed' ? `<form method="post" action="/admin/quick-status"><input type="hidden" name="id" value="${b.id}"><input type="hidden" name="target_status" value="confirmed"><button class="secondary" type="submit">Visszaigazolás előkészítése</button></form>` : ''}
                ${!['rejected', 'cancelled'].includes(b.statusCode) ? `<form method="post" action="/admin/quick-status"><input type="hidden" name="id" value="${b.id}"><input type="hidden" name="target_status" value="rejected"><button class="secondary" type="submit">Elutasítás indoklása</button></form>` : ''}
                <form method="post" action="/admin/booking-delete" onsubmit="return confirm('Biztosan végleg törlöd ezt a foglalást? Ez nem vonható vissza.')"><input type="hidden" name="id" value="${b.id}"><input type="hidden" name="return_page" value="${page}"><button class="danger" type="submit">Törlés</button></form>
            </div></td>` : ''}
        </tr>`;
    }).join('');

    const colspan = actions ? 8 : 7;
    return `<div class="table-wrap"><table class="booking-table"><thead><tr><th>Azonosító</th><th>Vendég</th><th>Szállás</th><th>Időszak</th><th>Státusz</th><th>Fizetés</th><th>Összeg</th>${actions ? '<th></th>' : ''}</tr></thead><tbody>${body || `<tr><td colspan="${colspan}">Nincs megjeleníthető foglalás.</td></tr>`}</tbody></table></div>`;
}

function bookingDetail(b, backPage = (b.checkout < todayIso() ? 'archive' : 'bookings')) {
    const a = accommodation(b.accommodationId);
    const saunaDates = Object.values(b.extraDates || {}).flat().sort();
    return `
        <section class="admin-card booking-detail-card">
            <div class="admin-topbar"><h2>Foglalás adatlapja</h2><div class="inline-actions"><a class="button secondary" href="/admin/?page=${backPage}">Vissza a listához</a><form method="post" action="/admin/booking-delete" onsubmit="return confirm('Biztosan végleg törlöd ezt a foglalást? Ez nem vonható vissza.')"><input type="hidden" name="id" value="${b.id}"><input type="hidden" name="return_page" value="${backPage}"><button class="danger" type="submit">Foglalás törlése</button></form></div></div>
            <div class="booking-record-summary">
                <div><span>Azonosító</span><strong>${esc(b.code)}</strong></div>
                <div><span>Forrás</span><strong>${esc(bookingSourceLabel(b.source))}</strong></div>
                <div><span>Létrehozva</span><strong>${esc(b.createdAt)}</strong></div>
                <div><span>Frissítve</span><strong>${esc(b.updatedAt)}</strong></div>
                <div><span>Kalkulált tájékoztató ár</span><strong>${money(b.originalTotal)}</strong></div>
                ${b.couponCode ? `<div><span>Kuponkedvezmény</span><strong>${esc(b.couponCode)} · ${money(b.couponDiscount)}</strong></div>` : ''}
                <div><span>Teljes összeg</span><strong>${money(b.finalTotal)}</strong></div>
                <div><span>Előleg</span><strong>${b.depositAmount !== '' ? money(b.depositAmount) : '-'}</strong></div>
                <div><span>Hátralévő összeg</span><strong>${b.remainingAmount !== '' ? money(b.remainingAmount) : '-'}</strong></div>
                <div><span>Kaució</span><strong>${b.securityDepositAmount !== '' ? money(b.securityDepositAmount) : '-'}</strong></div>
                <div><span>Utalási bankszámla</span><strong>${esc(paymentAccountLabel(b.paymentAccount))}</strong></div>
                <div><span>Szauna kért napjai</span><strong>${saunaDates.length ? esc(saunaDates.join(', ')) : 'Nincs'}</strong></div>
            </div>
            <form method="post" action="/admin/booking">
                <input type="hidden" name="id" value="${b.id}">
                <div class="grid three">
                    <label><span>Azonosító</span><input name="booking_code" required value="${esc(b.code)}"></label>
                    <label><span>Forrás</span><select name="source" required>${[['web', 'Weboldal'], ['phone', 'Telefon'], ['email', 'Email'], ['other', 'Egyéb']].map(([value, label]) => `<option value="${value}" ${normalizedBookingSource(b.source) === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
                    <label><span>Aktuális szállás</span><input value="${esc(a.name)}" disabled></label>
                </div>
                <div class="grid three">
                    <label><span>Név</span><input name="guest_name" required value="${esc(b.guestName)}"></label>
                    <label><span>E-mail</span><input type="email" name="guest_email" required value="${esc(b.guestEmail)}"></label>
                    <label><span>Telefon</span><input name="guest_phone" required value="${esc(b.guestPhone)}"></label>
                </div>
                <div class="grid four">
                    <label><span>Szállás</span><select name="accommodation_id" data-admin-accommodation>${state.accommodations.map(item => `<option value="${item.id}" ${item.id === b.accommodationId ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}</select></label>
                    <label><span>Érkezés</span><input type="date" id="checkin-date" name="checkin_date" required value="${esc(b.checkin)}"></label>
                    <label><span>Távozás</span><input type="date" id="checkout-date" name="checkout_date" required value="${esc(b.checkout)}"></label>
                    <label><span>Vendégek</span><input type="number" min="1" name="guests" required value="${b.guests}"></label>
                </div>
                <input type="hidden" name="include_included_amenity" value="1">
                <div class="included-wellness-note"><strong>Privát wellness az árban</strong><span>A szauna és a fürdődézsa használata automatikusan a foglalás része.</span></div>
                <fieldset class="fieldset"><legend>Extrák</legend>${state.extras.map(extra => {
                    const sauna = extra.code === 'SAUNA_TUB_SHOWER';
                    const dates = (b.extraDates || {})[extra.id] || [];
                    return `<div data-admin-extra-option data-accommodation-ids="${esc(extra.accommodationIds.join(','))}"><label class="check"><input type="checkbox" name="extra_ids" value="${extra.id}" ${sauna ? 'data-sauna-extra' : ''} ${b.extraIds.includes(extra.id) ? 'checked' : ''}><span>${esc(extra.name)}${extra.price === null ? '' : ' · ' + money(extra.price)}</span></label>${sauna ? `<div class="sauna-days" data-sauna-days data-extra-id="${extra.id}" data-selected-dates="${esc(JSON.stringify(dates))}"></div>` : ''}</div>`;
                }).join('')}</fieldset>
                <div class="price-editor">
                    <div><span>Kalkulált összeg kedvezmény előtt</span><strong>${money(b.originalTotal)}</strong></div>
                    <label><span>Teljes összeg${b.couponCode ? ' kedvezmény előtt' : ''}</span><input type="number" min="0" name="manual_total" data-booking-total data-coupon-discount="${b.couponDiscount || 0}" value="${esc(b.manualTotal !== '' ? b.manualTotal : b.originalTotal)}"><small class="field-help">Ez az összeg nem tartalmazza a kauciót.</small></label>
                    ${b.couponCode ? `<div><span>Fizetendő a kuponnal</span><strong data-booking-final>${money(b.finalTotal)}</strong></div>` : ''}
                    <label><span>Előleg</span><input type="number" min="0" name="deposit_amount" data-booking-deposit value="${esc(b.depositAmount)}"></label>
                    <label><span>Hátralévő összeg</span><input type="number" min="0" name="remaining_amount" data-booking-remaining readonly value="${esc(b.remainingAmount !== '' ? b.remainingAmount : b.finalTotal)}"><small class="field-help">A rendszer automatikusan számolja a teljes összegből és az előlegből.</small></label>
                    <label><span>Kaució</span><input type="number" min="0" name="security_deposit_amount" value="${esc(b.securityDepositAmount)}"><small class="field-help">A kaució külön tétel, nem része a szállás teljes összegének.</small></label>
                    <label><span>Utalási bankszámla</span><select name="payment_account" data-payment-account>${paymentAccountOptions(b.paymentAccount)}</select><small class="field-help">Ez jelenik meg a fizetési tájékoztatóban.</small></label>
                    <div class="new-payment-account" data-new-payment-account hidden><label><span>Számlatulajdonos</span><input name="new_account_name"></label><label><span>Bankszámlaszám</span><input name="new_account_number"></label></div>
                </div>
                ${b.couponCode ? `<input type="hidden" name="coupon_code" value="${esc(b.couponCode)}"><div class="coupon-used"><strong>${esc(b.couponCode)}</strong><span>A kupon ${money(b.couponDiscount)} kedvezményt adott, amelyet a rendszer a kaució nélküli teljes összegből vont le.</span></div>` : ''}
                <label><span>Foglalási státusz</span><select name="status">${state.bookingStatuses.map(status => `<option value="${status.code}" ${status.code === b.statusCode ? 'selected' : ''}>${esc(status.label)}</option>`).join('')}</select></label>
                <label><span>Fizetési státusz</span><select name="payment_status">${state.paymentStatuses.map(status => `<option value="${status.code}" ${status.code === b.paymentStatus ? 'selected' : ''}>${esc(status.label)}</option>`).join('')}</select></label>
                <label><span>Elutasítás / lemondás indoka</span><textarea name="rejection_reason" rows="3">${esc(b.rejectionReason)}</textarea><small class="field-help">Elutasított vagy lemondott státusznál kötelező; a vendégnek küldött e-mailbe is bekerül.</small></label>
                <label><span>Vendég megjegyzése</span><textarea name="guest_notes" rows="3">${esc(b.guestNotes)}</textarea></label>
                <label><span>Belső admin megjegyzés</span><textarea name="admin_notes" rows="3">${esc(b.adminNotes)}</textarea></label>
                <div class="actions"><button class="primary" type="submit">Mentés</button><a class="button secondary" href="/admin/?page=${backPage}">Vissza</a></div>
            </form>
        </section>
    `;
}

function adminUtilitySections() {
    return `
        <section class="admin-card" id="coupons">
            <h2>Kupon létrehozása</h2>
            <form method="post" action="/admin/coupon">
                <div class="grid four">
                    <label><span>Kód</span><input name="code" required placeholder="PL. TAVASZ15"></label>
                    ${unitNumberInput('Kedvezmény', 'discount_value', 5, '%', 5, 5, 100, true)}
                    ${unitNumberInput('Felhasználási limit', 'usage_limit', '', '×', 1, 1, '', false, 'data-coupon-limit-input')}
                    <label><span>Érvényesség kezdete</span><input type="date" name="valid_from"></label>
                    <label><span>Érvényesség vége</span><input type="date" name="valid_to"></label>
                </div>
                ${check('unlimited', 'Korlátlan felhasználás', false, 'data-coupon-unlimited')}
                <button class="primary" type="submit">Kupon mentése</button>
            </form>
            ${couponTable()}
        </section>
        <section class="admin-card" id="blocked">
            <h2>Lezárt időszak létrehozása</h2>
            <form method="post" action="/admin/block">
                <div class="grid three">
                    <label><span>Kezdete</span><input type="date" name="starts_on" required></label>
                    <label><span>Vége</span><input type="date" name="ends_on" required></label>
                    <label><span>Megjegyzés</span><input name="note"></label>
                </div>
                <fieldset class="fieldset"><legend>Érintett szállások</legend>${state.accommodations.map(a => `<label class="check"><input type="checkbox" name="accommodation_ids" value="${a.id}"><span>${esc(a.name)}</span></label>`).join('')}</fieldset>
                <button class="primary" type="submit">Lezárás mentése</button>
            </form>
            ${blockedTable()}
        </section>
    `;
}

function adminCalendarPanel(params, compact) {
    const requestedView = ['week', 'month', 'quarter'].includes(params.get('calendar_view')) ? params.get('calendar_view') : 'month';
    const view = compact && requestedView === 'quarter' ? 'month' : requestedView;
    const today = todayIso();
    const anchor = parseIsoDate(params.get('calendar_date') || today);
    const range = adminCalendarRange(view, anchor);
    const events = adminCalendarEvents(range.from, range.to);
    const title = view === 'quarter'
        ? `${monthLabel(range.start)} - ${monthLabel(addMonths(range.start, 2))}`
        : view === 'week'
            ? `${iso(range.start)} - ${iso(addDays(range.end, -1))}`
            : monthLabel(range.start);
    const page = compact ? 'dashboard' : 'calendar';
    const base = `/admin/?page=${page}&calendar_view=${view}`;
    const body = view === 'week'
        ? adminWeekGrid(range.start, events)
        : view === 'quarter'
            ? `<div class="admin-calendar-three">${[0, 1, 2].map(i => adminMonthGrid(addMonths(range.start, i), events, true)).join('')}</div>`
            : adminMonthGrid(range.start, events, compact);

    return `
        <div class="admin-calendar-shell">
            <form class="admin-calendar-toolbar" method="get" action="/admin/">
                <input type="hidden" name="page" value="${page}">
                ${compact ? `<div class="segmented two-options">
                    <a class="${view === 'week' ? 'active' : ''}" href="/admin/?page=dashboard&calendar_view=week&calendar_date=${iso(anchor)}">Heti</a>
                    <a class="${view === 'month' ? 'active' : ''}" href="/admin/?page=dashboard&calendar_view=month&calendar_date=${iso(anchor)}">Havi</a>
                </div>` : `<div class="segmented">
                    <a class="${view === 'week' ? 'active' : ''}" href="/admin/?page=calendar&calendar_view=week&calendar_date=${iso(anchor)}">Heti</a>
                    <a class="${view === 'month' ? 'active' : ''}" href="/admin/?page=calendar&calendar_view=month&calendar_date=${iso(anchor)}">Havi</a>
                    <a class="${view === 'quarter' ? 'active' : ''}" href="/admin/?page=calendar&calendar_view=quarter&calendar_date=${iso(anchor)}">3 havi</a>
                </div>`}
                <input type="hidden" name="calendar_view" value="${view}">
                <div class="admin-calendar-date-row"><label><span>Dátum</span><input type="date" name="calendar_date" value="${iso(anchor)}"></label><button class="primary" type="submit">Ugrás</button></div>
                <div class="calendar-toolbar-actions">
                    <a class="button secondary" href="${base}&calendar_date=${iso(range.previous)}">Előző</a>
                    <a class="button secondary" href="${base}&calendar_date=${today}">Ma</a>
                    <a class="button secondary" href="${base}&calendar_date=${iso(range.next)}">Következő</a>
                </div>
            </form>
            ${adminCalendarLegend()}
            <div class="admin-calendar-title"><strong>${esc(title)}</strong><span>${events.length} esemény</span></div>
            ${body}
        </div>
    `;
}

function adminCalendarRange(view, anchor) {
    if (view === 'week') {
        const start = addDays(anchor, -((anchor.getDay() + 6) % 7));
        const end = addDays(start, 7);
        return { start, end, from: iso(start), to: iso(end), previous: addDays(anchor, -7), next: addDays(anchor, 7) };
    }

    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const months = view === 'quarter' ? 3 : 1;
    const end = addMonths(start, months);
    return { start, end, from: iso(start), to: iso(end), previous: addMonths(anchor, -months), next: addMonths(anchor, months) };
}

function adminCalendarEvents(from, to) {
    const bookingEvents = state.bookings
        .filter(b => b.checkin < to && b.checkout >= from)
        .map(b => ({
            id: b.id,
            kind: 'booking',
            label: b.code,
            guestName: b.guestName,
            accommodationName: accommodation(b.accommodationId).name,
            accommodationCode: accommodation(b.accommodationId).code,
            accommodationId: b.accommodationId,
            startsOn: b.checkin,
            endsOn: b.checkout,
            status: b.statusCode,
            paymentStatus: b.paymentStatus,
        }));
    const blockedEvents = state.blocked
        .filter(b => b.active && b.startsOn < to && b.endsOn > from)
        .map(b => ({
            id: b.id,
            kind: 'blocked',
            label: b.note || 'Lezárt időszak',
            guestName: '',
            accommodationName: b.accommodationIds.map(id => accommodation(id).name).join(', '),
            startsOn: b.startsOn,
            endsOn: b.endsOn,
            status: 'blocked',
        }));
    return [...bookingEvents, ...blockedEvents];
}

function adminWeekGrid(start, events) {
    return `<div class="admin-calendar-scroll"><div class="admin-calendar-week">${[0, 1, 2, 3, 4, 5, 6].map(i => adminDayCell(addDays(start, i), events, true)).join('')}</div></div>`;
}

function adminMonthGrid(month, events, compact) {
    const start = new Date(month.getFullYear(), month.getMonth(), 1);
    const blanks = Array.from({ length: (start.getDay() + 6) % 7 }, () => '<div class="admin-calendar-empty"></div>').join('');
    const days = Array.from({ length: new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate() }, (_, index) => adminDayCell(new Date(start.getFullYear(), start.getMonth(), index + 1), events, false)).join('');
    return `<div class="admin-calendar-month ${compact ? 'compact' : ''}"><h3>${esc(monthLabel(start))}</h3><div class="admin-calendar-scroll"><div class="admin-calendar-grid">${['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'].map(day => `<div class="admin-calendar-weekday">${day}</div>`).join('')}${blanks}${days}</div></div></div>`;
}

function adminDayCell(date, events, showWeekday) {
    const key = iso(date);
    const todayClass = key === todayIso() ? 'today' : '';
    const items = events
        .filter(event => event.startsOn <= key && event.endsOn >= key)
        .map(event => {
            const statusKey = calendarStatusKey(event);
            const klass = event.kind === 'blocked' ? 'blocked' : eventClass(event.status);
            const segment = `${key === event.startsOn ? ' starts-here' : ''}${key === event.endsOn ? ' ends-here' : ''}`;
            const eventColor = state.settings.statusColors[statusKey] || '#718078';
            const unitColor = event.accommodationId ? (state.settings.accommodationColors[event.accommodationId] || eventColor) : eventColor;
            const unitLabel = event.kind === 'booking' ? event.accommodationName.replace(/\s+Kabin$/i, '') : 'ZÁR';
            const inner = `<span><b class="event-unit">${esc(unitLabel)}</b> ${esc(event.label)}</span><small>${esc(event.kind === 'booking' ? event.guestName + ' · ' + event.accommodationName : event.accommodationName)}</small>`;
            return event.kind === 'booking'
                ? `<a class="admin-calendar-event ${klass}${segment}" style="--event-color:${eventColor};--unit-color:${unitColor}" data-booking-modal href="/admin/?page=bookings&action=edit&id=${event.id}">${inner}</a>`
                : `<span class="admin-calendar-event ${klass}" style="--event-color:${eventColor};--unit-color:${unitColor}">${inner}</span>`;
        }).join('');
    return `<div class="admin-calendar-day ${todayClass}"><div class="admin-calendar-day-head"><strong>${date.getDate()}</strong>${showWeekday ? `<span>${dayName(date)}</span>` : ''}</div><div class="admin-calendar-events">${items}</div></div>`;
}

function calendarStatusKey(event) {
    if (event.kind === 'blocked') return 'blocked';
    if (event.status === 'rejected') return 'rejected';
    if (event.status === 'cancelled') return 'cancelled';
    if (event.paymentStatus === 'paid') return 'paid';
    if (['confirmed', 'modified', 'completed'].includes(event.status)) return 'confirmed';
    return 'pending';
}

function adminCalendarLegend() {
    const statusLabels = { pending: 'Függő', confirmed: 'Visszaigazolt', paid: 'Fizetett', rejected: 'Visszautasított', cancelled: 'Lemondott', blocked: 'Lezárt' };
    const statuses = Object.entries(statusLabels).map(([key, label]) => `<span><i style="background:${esc(state.settings.statusColors[key])}"></i>${label}</span>`).join('');
    const accommodations = state.accommodations.map(a => `<span><i style="background:${esc(state.settings.accommodationColors[a.id] || '#2f6f55')}"></i>${esc(a.name)}</span>`).join('');
    return `<div class="admin-calendar-legend"><div><strong>Állapot</strong>${statuses}</div><div><strong>Kabin</strong>${accommodations}</div></div>`;
}

function eventClass(status) {
    if (status === 'new') return 'pending';
    if (['rejected', 'cancelled'].includes(status)) return 'cancelled';
    return 'booked';
}

function bookingStatusLabel(code) {
    return state.bookingStatuses.find(status => status.code === code)?.label || code;
}

function paymentStatusLabel(code) {
    return state.paymentStatuses.find(status => status.code === code)?.label || code;
}

function paymentAccountLabel(code) {
    const account = paymentAccounts[code];
    return account ? `${account.name} – ${account.accountNumber}` : 'Nincs kiválasztva';
}

function paymentAccountOptions(selected = '') {
    return `<option value="">Válassz bankszámlát</option>` + Object.entries(paymentAccounts)
        .map(([code, account]) => `<option value="${code}" ${selected === code ? 'selected' : ''}>${esc(account.name)} – ${esc(account.accountNumber)}</option>`)
        .join('') + '<option value="__new__">Új bankszámla hozzáadása</option>';
}

function normalizedBookingSource(source) {
    if (source === 'public') return 'web';
    if (source === 'admin') return 'other';
    return ['web', 'phone', 'email', 'other'].includes(source) ? source : 'other';
}

function bookingSourceLabel(source) {
    return { web: 'Weboldal', phone: 'Telefon', email: 'Email', other: 'Egyéb' }[normalizedBookingSource(source)];
}

function couponTable() {
    return `<div class="table-wrap"><table><thead><tr><th>Kód</th><th>Kedvezmény</th><th>Érvényesség</th><th>Limit</th><th>Használat</th></tr></thead><tbody>${state.coupons.map(c => `<tr><td>${esc(c.code)}</td><td>${esc(c.value + '%')}</td><td>${esc(c.validFrom || 'Nincs kezdőnap')}<br>${esc(c.validTo || 'Nincs zárónap')}</td><td>${c.usageLimit === null ? 'Korlátlan' : esc(c.usageLimit + '×')}</td><td>${c.usageCount}×</td></tr>`).join('')}</tbody></table></div>`;
}

function blockedTable() {
    return `<div class="table-wrap"><table><thead><tr><th>Időszak</th><th>Szállások</th><th>Megjegyzés</th></tr></thead><tbody>${state.blocked.map(b => `<tr><td>${esc(b.startsOn)} - ${esc(b.endsOn)}</td><td>${esc(b.accommodationIds.map(id => accommodation(id).name).join(', '))}</td><td>${esc(b.note)}</td></tr>`).join('')}</tbody></table></div>`;
}

function quote(input, excludeBookingId = null) {
    const a = accommodation(Number(input.accommodation_id));
    const checkin = text(input.checkin_date);
    const checkout = text(input.checkout_date);
    const guests = Number(input.guests);
    const nights = dateRange(checkin, checkout);
    const stayNights = nightsBetween(checkin, checkout);
    const newYearStay = stayNights.some(isNewYearNight);

    const minimumNights = newYearStay ? Math.max(state.settings.publicMinNights, 3) : state.settings.publicMinNights;
    if (nights < minimumNights) {
        throw new Error(newYearStay ? 'A szilveszteri időszakban minimum 3 éjszaka foglalható.' : `Minimum foglalás ${minimumNights} éjszaka.`);
    }
    const minimumGuests = newYearStay ? 2 : a.minGuests;
    const maximumGuests = newYearStay ? (newYearMaximumGuests[a.code] || a.maxGuests) : a.maxGuests;
    if (guests < minimumGuests || guests > maximumGuests) {
        throw new Error('A vendégek száma nem felel meg a kiválasztott szállásegység kapacitásának.');
    }
    const standardCapacity = { TOLGY: 6, BEREK: 2 }[a.code] || guests;
    const pricedGuests = Math.min(guests, standardCapacity);
    const extraBedCount = Math.max(0, guests - standardCapacity);
    if (stayNights.some(night => !isNewYearNight(night)) && !state.prices[a.code][pricedGuests]) throw new Error(`Nincs ár beállítva ehhez: ${a.name}, ${pricedGuests} fő.`);
    assertNoConflicts(a, checkin, checkout, excludeBookingId);

    let roomSubtotal = 0;
    const nightRows = [];
    for (const night of stayNights) {
        const specialNewYearNight = isNewYearNight(night);
        const period = highlightedPeriod(night);
        const weekday = !period && isWeekday(night);
        const amenityDiscount = !specialNewYearNight && !bool(input.include_included_amenity) ? a.amenityDiscount : 0;
        const configuredPrice = state.prices[a.code][pricedGuests];
        const periodPrice = Number(period?.prices?.[a.code]);
        const hasPeriodPrice = Number.isFinite(periodPrice) && periodPrice > 0;
        const base = hasPeriodPrice ? periodPrice : specialNewYearNight ? newYearHousePrices[a.code] : (weekday ? configuredPrice.weekday : configuredPrice.weekend);
        const extraBedAmount = hasPeriodPrice || specialNewYearNight ? 0 : extraBedCount * (weekday ? 12500 : 15000);
        const total = Math.max(0, base + extraBedAmount - amenityDiscount);
        roomSubtotal += total;
        nightRows.push({
            date: iso(night),
            dayName: dayName(night),
            period: period?.name || '',
            extraBedAmount,
            total,
        });
    }

    const selectedExtras = array(input.extra_ids).map(Number);
    const requestedExtraDates = extractExtraDates(input);
    const extraRows = state.extras
        .filter(e => selectedExtras.includes(e.id) && e.accommodationIds.includes(a.id))
        .map(e => {
            const selectedDates = e.code === 'SAUNA_TUB_SHOWER'
                ? (requestedExtraDates[e.id] || []).filter(date => date >= checkin && date < checkout)
                : [];
            if (e.code === 'SAUNA_TUB_SHOWER' && selectedDates.length === 0) throw new Error('A szauna kérése esetén válassz ki legalább egy napot.');
            const quantity = e.mode === 'per_night' ? (selectedDates.length || nights) : 1;
            return { id: e.id, code: e.code, name: e.name, quantity, amount: e.price === null ? 0 : e.price * quantity, custom: e.price === null, selectedDates };
        });
    const extrasTotal = extraRows.reduce((sum, e) => sum + e.amount, 0);
    const subtotal = roomSubtotal + extrasTotal;
    const coupon = calculateCoupon(text(input.coupon_code), subtotal);

    return {
        accommodation: a,
        checkin,
        checkout,
        guests,
        includeAmenity: bool(input.include_included_amenity),
        nights,
        nightRows,
        roomSubtotal,
        extraRows,
        extraDates: Object.fromEntries(extraRows.filter(row => row.selectedDates.length).map(row => [row.id, row.selectedDates])),
        extrasTotal,
        subtotal,
        coupon,
        couponDiscount: coupon.discount,
        total: Math.max(0, subtotal - coupon.discount),
    };
}

function assertNoConflicts(a, checkin, checkout, excludeBookingId = null) {
    const requestedLocks = new Set(a.locks);
    const overlaps = (start, end) => checkin < end && checkout > start;

    for (const booking of state.bookings) {
        if (excludeBookingId !== null && booking.id === excludeBookingId) {
            continue;
        }
        if (['rejected', 'cancelled'].includes(booking.statusCode)) {
            continue;
        }
        const booked = accommodation(booking.accommodationId);
        if (overlaps(booking.checkin, booking.checkout) && booked.locks.some(lock => requestedLocks.has(lock))) {
            throw new Error(`Az időszak ütközik meglévő foglalással: ${booking.code}.`);
        }
    }

    for (const block of state.blocked.filter(b => b.active)) {
        const locks = block.accommodationIds.flatMap(id => accommodation(id).locks);
        if (overlaps(block.startsOn, block.endsOn) && locks.some(lock => requestedLocks.has(lock))) {
            throw new Error('Az időszak adminisztrációs lezárással ütközik.');
        }
    }
}

function calendarData(a, month) {
    const [year, monthIndex] = month.split('-').map(Number);
    const start = new Date(year, monthIndex - 1, 1);
    const end = new Date(year, monthIndex, 1);
    const statuses = {};
    const priority = { free: 0, pending: 1, booked: 2, blocked: 3 };
    const requestedLocks = new Set(a.locks);

    const setRange = (startsOn, endsOn, type, label, locks) => {
        if (!locks.some(lock => requestedLocks.has(lock))) return;
        const first = maxIso(iso(start), startsOn);
        const last = minIso(iso(addDays(end, -1)), endsOn);
        for (let key = first; key <= last; key = iso(addDays(parseIsoDate(key), 1))) {
            statuses[key] ||= { morning: 'free', afternoon: 'free', labels: [] };
            if (!statuses[key].labels.includes(label)) statuses[key].labels.push(label);
            const startKey = startsOn;
            const endKey = endsOn;
            if (key > startKey && priority[type] >= priority[statuses[key].morning]) statuses[key].morning = type;
            if (key < endKey && priority[type] >= priority[statuses[key].afternoon]) statuses[key].afternoon = type;
        }
    };

    state.bookings
        .filter(b => !['rejected', 'cancelled'].includes(b.statusCode))
        .forEach(b => setRange(b.checkin, b.checkout, b.statusCode === 'new' ? 'pending' : 'booked', accommodation(b.accommodationId).code, accommodation(b.accommodationId).locks));
    state.blocked.filter(b => b.active).forEach(b => setRange(b.startsOn, b.endsOn, 'blocked', 'ZÁR', b.accommodationIds.flatMap(id => accommodation(id).locks)));

    return {
        month,
        previous: shiftMonth(month, -1),
        next: shiftMonth(month, 1),
        offset: (start.getDay() + 6) % 7,
        days: new Date(year, monthIndex, 0).getDate(),
        statuses,
    };
}

function publicQuotePayload(result) {
    const extras = result.extraRows.map(row => ({ name: row.name, quantity: row.quantity, amount: row.custom ? 'egyeztetés alatt' : money(row.amount), selected_dates: row.selectedDates }));
    if (bool(result.includeAmenity) && result.accommodation.amenity) {
        extras.unshift({ name: result.accommodation.amenity, quantity: 'teljes tartózkodás', amount: 'az alapár része' });
    }

    return {
        nights: result.nights,
        accommodation_name: result.accommodation.name,
        checkin_date: result.checkin,
        checkout_date: result.checkout,
        guests: result.guests,
        room_subtotal: money(result.roomSubtotal),
        extras_total: money(result.extrasTotal),
        subtotal: money(result.subtotal),
        coupon_discount: money(result.couponDiscount),
        total: money(result.total),
        night_rows: result.nightRows.map(row => ({
            date: row.date,
            day_name: row.dayName,
            period: row.period,
            total: money(row.total),
        })),
        extras,
    };
}

function selectedAccommodation(params) {
    const visible = state.accommodations
        .filter(a => a.active !== false)
        .slice()
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.name.localeCompare(b.name, 'hu'));
    const requested = params.get('accommodation');
    if (params.get('choose') !== '1' || !requested) return null;
    const id = Number(requested);
    return visible.find(a => a.id === id) || null;
}

function accommodation(id) {
    const item = state.accommodations.find(a => a.id === id);
    if (!item) throw new Error('A kiválasztott szállásegység nem elérhető.');
    return item;
}

function findCoupon(code) {
    const normalized = text(code).toUpperCase();
    return state.coupons.find(c => c.code.toUpperCase() === normalized);
}

function calculateCoupon(code, subtotal) {
    const coupon = findCoupon(code);
    if (!text(code)) return { discount: 0, code: '' };
    if (!coupon || !coupon.active) throw new Error('A kuponkód nem érvényes.');
    if (coupon.validFrom && todayIso() < coupon.validFrom) throw new Error('A kuponkód még nem érvényes.');
    if (coupon.validTo && todayIso() > coupon.validTo) throw new Error('A kuponkód érvényessége lejárt.');
    if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) throw new Error('A kuponkód felhasználási limitje betelt.');
    const discount = coupon.type === 'percent' ? Math.round(subtotal * coupon.value / 100) : Math.round(coupon.value);
    return { discount: Math.max(0, Math.min(subtotal, discount)), code: coupon.code };
}

function startingPrice(a) {
    return Math.max(0, Math.min(...Object.values(state.prices[a.code]).map(price => price.weekday)));
}

function capacityLabel(a) {
    return a.minGuests > 1 && a.minGuests !== a.maxGuests ? `${a.minGuests}-${a.maxGuests} fő` : `max. ${a.maxGuests} fő`;
}

function validatePublicGuest(input) {
    const name = text(input.guest_name);
    const email = text(input.guest_email);
    const phone = text(input.guest_phone);
    if (name.length < 2) throw new Error('A vendég nevének megadása kötelező.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Adj meg érvényes e-mail-címet.');
    if (phone.replace(/\D/g, '').length < 7) throw new Error('Adj meg érvényes telefonszámot.');
}

function assertPublicBookingHorizon(input) {
    const checkin = text(input.checkin_date);
    const maximum = iso(addMonths(parseIsoDate(todayIso()), 24));
    if (checkin < todayIso()) throw new Error('Korábbi napra nem lehet foglalási igényt küldeni.');
    if (checkin > maximum) throw new Error('Legfeljebb két évre előre lehet foglalási igényt küldeni.');
}

function dateRange(start, end) {
    const startDate = new Date(start + 'T00:00:00');
    const endDate = new Date(end + 'T00:00:00');
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
        throw new Error('A foglalási dátumok hibásak.');
    }
    return Math.round((endDate - startDate) / 86400000);
}

function nightsBetween(start, end) {
    const nights = [];
    for (let date = new Date(start + 'T00:00:00'); date < new Date(end + 'T00:00:00'); date.setDate(date.getDate() + 1)) {
        nights.push(new Date(date));
    }
    return nights;
}

function normalizeMonth(month) {
    const currentMonth = todayIso().slice(0, 7);
    const maximumMonth = shiftMonth(currentMonth, 24);
    if (!/^\d{4}-\d{2}$/.test(month)) return currentMonth;
    if (month < currentMonth) return currentMonth;
    if (month > maximumMonth) return maximumMonth;
    return month;
}

function shiftMonth(month, amount) {
    const [year, monthIndex] = month.split('-').map(Number);
    const date = new Date(year, monthIndex - 1 + amount, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function minIso(a, b) {
    return a < b ? a : b;
}

function maxIso(a, b) {
    return a > b ? a : b;
}

function parseIsoDate(value) {
    const parts = text(value).split('-').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) {
        return new Date();
    }
    return new Date(parts[0], parts[1] - 1, parts[2]);
}

function addDays(date, amount) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
}

function addMonths(date, amount) {
    return new Date(date.getFullYear(), date.getMonth() + amount, date.getDate());
}

function monthLabel(date) {
    const months = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
    return `${date.getFullYear()}. ${months[date.getMonth()]}`;
}

function todayIso() {
    return iso(new Date());
}

function nowText() {
    const date = new Date();
    return `${iso(date)} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function isWeekday(date) {
    const day = date.getDay();
    return day === 0 || (day >= 1 && day <= 4);
}

function isNewYearNight(date) {
    const monthDay = iso(date).slice(5);
    return monthDay >= '12-30' || monthDay <= '01-04';
}

function highlightedPeriod(date) {
    const key = iso(date);
    return state.periods
        .filter(period => {
            if (!period.active) return false;
            if (!period.recurring) return period.startsOn <= key && period.endsOn >= key;
            const monthDay = key.slice(5);
            const startDay = period.startsOn.slice(5);
            const endDay = period.endsOn.slice(5);
            return startDay <= endDay
                ? monthDay >= startDay && monthDay <= endDay
                : monthDay >= startDay || monthDay <= endDay;
        })
        .sort((a, b) => (b.priority || 0) - (a.priority || 0) || b.id - a.id)[0] || null;
}

function extractExtraDates(input) {
    const result = {};
    for (const [key, value] of Object.entries(input)) {
        const match = key.match(/^extra_dates\[(\d+)\]\[\]$/);
        if (!match) continue;
        const id = Number(match[1]);
        result[id] = [...new Set(array(value).map(text))].sort();
    }
    return result;
}

function dayName(date) {
    return ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'][date.getDay()];
}

function statusLabel(type) {
    return { free: 'Szabad', pending: 'Függőben', booked: 'Foglalt', blocked: 'Lezárt' }[type] || 'Szabad';
}

function iso(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function money(amount) {
    return new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 0 }).format(Number(amount || 0)) + ' Ft';
}

function validColor(value, fallback) {
    const normalized = text(value).toLowerCase();
    return /^#[0-9a-f]{6}$/.test(normalized) ? normalized : fallback;
}

function layout(title, body) {
    const canonical = `http://127.0.0.1:${port}/`;
    const seoImage = `${canonical}assets/images/demo/ligetlak-hero-v4.jpg`;
    return `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><link rel="icon" href="/assets/images/csitary-office-favicon-32.png" sizes="32x32" type="image/png"><link rel="icon" href="/assets/images/csitary-office-favicon-192.png" sizes="192x192" type="image/png"><link rel="apple-touch-icon" href="/assets/images/csitary-office-apple-touch-icon.png" sizes="180x180"><meta name="description" content="${demoBrand} bemutató foglalási rendszer szállásválasztóval, naptárral és azonnali árösszegzéssel."><link rel="canonical" href="${canonical}"><meta property="og:type" content="website"><meta property="og:title" content="Foglalás: ${demoBrand}"><meta property="og:description" content="Válassz szállást, jelöld ki az időpontot, és próbáld ki a foglalási folyamatot."><meta property="og:url" content="${canonical}"><meta property="og:image" content="${seoImage}"><meta property="og:image:alt" content="Magyar erdei kabin professzionális fotón"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="Foglalás: ${demoBrand}"><meta name="twitter:description" content="Bemutató online szállásfoglalás."><meta name="twitter:image" content="${seoImage}"><link rel="stylesheet" href="/assets/app.css?v=forest-hungary-25"></head><body>${body}</body></html>`;
}

function sendHtml(res, html, status = 200) {
    res.writeHead(status, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        Pragma: 'no-cache',
        Expires: '0',
    });
    res.end(html);
}

function sendJson(res, data, status = 200) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
}

function sendAsset(res, pathname) {
    const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
    const file = path.join(root, 'public', safePath);
    if (!file.startsWith(path.join(root, 'public'))) {
        return sendHtml(res, 'Tiltott útvonal', 403);
    }
    if (!fs.existsSync(file)) {
        return sendHtml(res, 'Nem található', 404);
    }
    const ext = path.extname(file).toLowerCase();
    const type = ext === '.css' ? 'text/css; charset=utf-8' : ext === '.js' ? 'text/javascript; charset=utf-8' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.png' ? 'image/png' : 'application/octet-stream';
    res.writeHead(200, {
        'Content-Type': type,
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        Pragma: 'no-cache',
        Expires: '0',
    });
    fs.createReadStream(file).pipe(res);
}

function redirect(res, location) {
    res.writeHead(303, { Location: location });
    res.end();
}

function cookies(req) {
    return String(req.headers.cookie || '')
        .split(';')
        .map(item => item.trim())
        .filter(Boolean)
        .reduce((jar, item) => {
            const index = item.indexOf('=');
            if (index === -1) return jar;
            const key = decodeURIComponent(item.slice(0, index));
            const value = decodeURIComponent(item.slice(index + 1));
            jar[key] = value;
            return jar;
        }, {});
}

function setCookie(res, name, value, options = {}) {
    const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];
    if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.max(0, Number(options.maxAge))}`);
    parts.push(`Path=${options.path || '/'}`);
    if (options.httpOnly) parts.push('HttpOnly');
    if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
    const current = res.getHeader('Set-Cookie');
    const next = Array.isArray(current) ? current.slice() : current ? [current] : [];
    next.push(parts.join('; '));
    res.setHeader('Set-Cookie', next);
}

function clearCookie(res, name) {
    setCookie(res, name, '', { maxAge: 0, httpOnly: true, sameSite: 'Lax', path: '/' });
}

function readForm(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        req.on('data', chunk => {
            size += chunk.length;
            if (size > 10 * 1024 * 1024) {
                reject(new Error('A beküldött űrlap túl nagy.'));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => {
            const data = Buffer.concat(chunks);
            const contentType = String(req.headers['content-type'] || '');
            const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.slice(1).find(Boolean);
            if (contentType.startsWith('multipart/form-data') && boundary) {
                resolve(parseMultipartForm(data, boundary));
                return;
            }
            resolve(parseQuery(data.toString('utf8')));
        });
        req.on('error', reject);
    });
}

function parseMultipartForm(data, boundary) {
    const result = {};
    const parts = data.toString('latin1').split(`--${boundary}`);
    for (let part of parts) {
        part = part.replace(/^\r\n/, '').replace(/\r\n$/, '');
        if (!part || part === '--') continue;
        if (part.endsWith('--')) part = part.slice(0, -2);
        const separator = part.indexOf('\r\n\r\n');
        if (separator < 0) continue;
        const headerText = part.slice(0, separator);
        let content = part.slice(separator + 4);
        if (content.endsWith('\r\n')) content = content.slice(0, -2);
        const disposition = headerText.match(/content-disposition:\s*form-data;([^\r\n]+)/i)?.[1] || '';
        const name = disposition.match(/name="([^"]+)"/i)?.[1];
        if (!name) continue;
        const filename = disposition.match(/filename="([^"]*)"/i)?.[1];
        const mime = headerText.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || 'application/octet-stream';
        const value = filename !== undefined
            ? { filename, mime, data: Buffer.from(content, 'latin1') }
            : Buffer.from(content, 'latin1').toString('utf8');
        if (result[name] === undefined) result[name] = value;
        else if (Array.isArray(result[name])) result[name].push(value);
        else result[name] = [result[name], value];
    }
    return result;
}

function text(value) {
    return String(value ?? '').trim();
}

function bool(value) {
    if (Array.isArray(value)) {
        return value.some(item => bool(item));
    }

    return value === '1' || value === 1 || value === true || value === 'on';
}

function array(value) {
    if (Array.isArray(value)) return value;
    if (value === undefined || value === null || value === '') return [];
    return [value];
}

function esc(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}
