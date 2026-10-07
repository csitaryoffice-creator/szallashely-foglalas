window.LigetlakBoot = function () {
    const adminMenuToggle = document.querySelector('[data-admin-menu-toggle]');
    const adminSidebar = document.querySelector('[data-admin-sidebar]');
    if (adminMenuToggle && adminMenuToggle.dataset.bound !== '1') {
        adminMenuToggle.dataset.bound = '1';
        adminMenuToggle.addEventListener('click', () => {
            const open = adminSidebar?.classList.toggle('menu-open') || false;
            adminMenuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
    }
    document.querySelectorAll('[data-admin-menu] a').forEach((link) => {
        if (link.dataset.bound === '1') return;
        link.dataset.bound = '1';
        link.addEventListener('click', () => {
            adminSidebar?.classList.remove('menu-open');
            adminMenuToggle?.setAttribute('aria-expanded', 'false');
        });
    });

    const dashboardTabs = Array.from(document.querySelectorAll('[data-dashboard-tab]'));
    const dashboardPanels = Array.from(document.querySelectorAll('[data-dashboard-panel]'));
    dashboardTabs.forEach((tab) => {
        if (tab.dataset.bound === '1') return;
        tab.dataset.bound = '1';
        tab.addEventListener('click', () => {
            const selected = tab.dataset.dashboardTab;
            dashboardTabs.forEach((item) => {
                const active = item === tab;
                item.classList.toggle('active', active);
                item.setAttribute('aria-selected', active ? 'true' : 'false');
            });
            dashboardPanels.forEach((panel) => {
                panel.hidden = panel.dataset.dashboardPanel !== selected;
            });
        });
    });

    function closeBookingModal() {
        const modal = document.querySelector('[data-booking-detail-modal]');
        if (!modal) return;
        modal.remove();
        document.body.classList.remove('modal-open');
    }

    function syncBookingFinance(scope = document) {
        scope.querySelectorAll('[data-booking-total]').forEach((totalInput) => {
            const form = totalInput.closest('form');
            const depositInput = form?.querySelector('[data-booking-deposit]');
            const remainingInput = form?.querySelector('[data-booking-remaining]');
            const finalOutput = form?.querySelector('[data-booking-final]');
            if (!remainingInput) return;
            const payable = Math.max(0, Number(totalInput.value || 0) - Number(totalInput.dataset.couponDiscount || 0));
            remainingInput.value = String(Math.max(0, payable - Number(depositInput?.value || 0)));
            if (finalOutput) finalOutput.textContent = new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 0 }).format(payable) + ' Ft';
        });
        scope.querySelectorAll('[data-payment-account]').forEach((select) => {
            const fields = select.closest('.price-editor')?.querySelector('[data-new-payment-account]');
            if (!fields) return;
            fields.hidden = select.value !== '__new__';
            fields.querySelectorAll('input').forEach((input) => { input.required = select.value === '__new__'; });
        });
        scope.querySelectorAll('[data-coupon-unlimited]').forEach((checkbox) => {
            const form = checkbox.closest('form');
            const limit = form?.querySelector('[data-coupon-limit-input]');
            if (!limit) return;
            limit.disabled = checkbox.checked;
            if (checkbox.checked) limit.value = '';
        });
    }

    async function refreshAdminCalendar() {
        const current = document.querySelector('.admin-calendar-shell');
        if (!current) return;
        try {
            const response = await fetch(window.location.href, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
            const incoming = new DOMParser().parseFromString(await response.text(), 'text/html').querySelector('.admin-calendar-shell');
            if (incoming) current.replaceWith(incoming);
        } catch (error) {
            // A mentett adatlap ettől még használható marad.
        }
    }

    async function openBookingModal(href) {
        let modal = document.querySelector('[data-booking-detail-modal]');
        if (!modal) {
            modal = document.createElement('div');
            modal.className = 'booking-detail-modal';
            modal.dataset.bookingDetailModal = '1';
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
            modal.setAttribute('aria-label', 'Foglalás adatlapja');
            modal.innerHTML = '<div class="booking-detail-modal-panel"><button class="booking-detail-modal-close" type="button" data-booking-modal-close aria-label="Adatlap bezárása">Bezárás</button><div class="booking-detail-modal-content" data-booking-modal-content><div class="booking-detail-loading">Adatlap betöltése…</div></div></div>';
            document.body.appendChild(modal);
        }
        const content = modal.querySelector('[data-booking-modal-content]');
        content.innerHTML = '<div class="booking-detail-loading">Adatlap betöltése…</div>';
        document.body.classList.add('modal-open');
        try {
            const response = await fetch(href, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
            if (!response.ok) throw new Error('Az adatlap nem tölthető be.');
            const card = new DOMParser().parseFromString(await response.text(), 'text/html').querySelector('.booking-detail-card');
            if (!card) throw new Error('Az adatlap nem található.');
            content.replaceChildren(card);
            syncBookingFinance(content);
            window.LigetlakBoot();
            modal.querySelector('[data-booking-modal-close]')?.focus();
        } catch (error) {
            content.innerHTML = `<div class="alert alert-error">${error.message}</div>`;
        }
    }

    if (document.documentElement.dataset.adminDialogBound !== '1') {
        document.documentElement.dataset.adminDialogBound = '1';
        document.addEventListener('click', (event) => {
            const trigger = event.target.closest('[data-booking-modal]');
            if (trigger && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
                event.preventDefault();
                openBookingModal(trigger.href);
                return;
            }
            const bookingRow = event.target.closest('[data-booking-modal-url]');
            if (bookingRow && !event.target.closest('a, button, input, select, textarea, form')) {
                openBookingModal(bookingRow.dataset.bookingModalUrl);
                return;
            }
            if (event.target.closest('[data-booking-modal-close]') || event.target.matches('[data-booking-detail-modal]')) {
                closeBookingModal();
            }
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                closeBookingModal();
                return;
            }
            const bookingRow = event.target.closest('[data-booking-modal-url]');
            if (bookingRow && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                openBookingModal(bookingRow.dataset.bookingModalUrl);
            }
        });
        document.addEventListener('input', (event) => {
            if (event.target.matches('[data-booking-total], [data-booking-deposit]')) syncBookingFinance(event.target.closest('form') || document);
        });
        document.addEventListener('change', (event) => {
            if (event.target.matches('[data-payment-account], [data-coupon-unlimited]')) syncBookingFinance(event.target.closest('form') || document);
        });
        document.addEventListener('submit', async (event) => {
            const modal = event.target.closest('[data-booking-detail-modal]');
            if (!modal || !event.target.matches('form[action="/admin/booking"]')) return;
            event.preventDefault();
            const submitButton = event.submitter;
            submitButton?.setAttribute('disabled', 'disabled');
            try {
                const response = await fetch(event.target.action, {
                    method: 'POST',
                    body: new FormData(event.target),
                    headers: { 'X-Requested-With': 'XMLHttpRequest' },
                });
                const contentType = response.headers.get('content-type') || '';
                if (contentType.includes('application/json')) {
                    const payload = await response.json();
                    if (!response.ok || !payload.ok) throw new Error((payload.errors || ['A mentés nem sikerült.']).join(' '));
                } else {
                    const card = new DOMParser().parseFromString(await response.text(), 'text/html').querySelector('.booking-detail-card');
                    if (!card) throw new Error('A frissített adatlap nem tölthető be.');
                    modal.querySelector('[data-booking-modal-content]').replaceChildren(card);
                    syncBookingFinance(modal);
                    window.LigetlakBoot();
                    await refreshAdminCalendar();
                }
            } catch (error) {
                const content = modal.querySelector('[data-booking-modal-content]');
                content.insertAdjacentHTML('afterbegin', `<div class="alert alert-error">${error.message}</div>`);
            } finally {
                submitButton?.removeAttribute('disabled');
            }
        });
    }
    syncBookingFinance();

    const form = document.querySelector('.booking-form');
    const checkinInput = document.getElementById('checkin-date');
    const checkoutInput = document.getElementById('checkout-date');
    const saunaCheckbox = document.querySelector('[data-sauna-extra]');
    const saunaDays = document.querySelector('[data-sauna-days]');
    const adminAccommodation = document.querySelector('[data-admin-accommodation]');
    const adminExtraOptions = Array.from(document.querySelectorAll('[data-admin-extra-option]'));
    const stayCards = Array.from(document.querySelectorAll('.stay-card'));

    function scrollToElementGracefully(element, duration = 1050) {
        const start = window.scrollY;
        const target = Math.max(0, element.getBoundingClientRect().top + start - 22);
        const distance = target - start;
        const root = document.documentElement;
        const previousScrollBehavior = root.style.scrollBehavior;
        root.style.scrollBehavior = 'auto';
        if (Math.abs(distance) < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            window.scrollTo(0, target);
            root.style.scrollBehavior = previousScrollBehavior;
            return;
        }
        const startedAt = performance.now();
        const ease = (progress) => progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;
        const step = (now) => {
            const progress = Math.min(1, (now - startedAt) / duration);
            window.scrollTo(0, start + distance * ease(progress));
            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                root.style.scrollBehavior = previousScrollBehavior;
            }
        };
        window.requestAnimationFrame(step);
    }

    stayCards.forEach((card) => {
        if (card.dataset.selectionBound === '1') {
            return;
        }
        card.dataset.selectionBound = '1';
        card.addEventListener('click', async (event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
                return;
            }
            event.preventDefault();
            card.setAttribute('aria-busy', 'true');
            try {
                const response = await fetch(card.href, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
                if (!response.ok) {
                    throw new Error('Nem sikerült betölteni a foglalási naptárt.');
                }
                const documentFragment = new DOMParser().parseFromString(await response.text(), 'text/html');
                const incomingForm = documentFragment.querySelector('.booking-form');
                const currentBookingArea = document.querySelector('.booking-form, .booking-selection-prompt');
                if (!incomingForm || !currentBookingArea) {
                    throw new Error('Hiányos foglalási nézet.');
                }
                currentBookingArea.replaceWith(incomingForm);
                stayCards.forEach((item) => item.classList.toggle('active', item === card));
                const cleanUrl = new URL(card.href, window.location.origin);
                cleanUrl.searchParams.delete('choose');
                cleanUrl.hash = '';
                window.history.pushState({}, '', cleanUrl.pathname + cleanUrl.search);
                window.LigetlakBoot();
                scrollToElementGracefully(incomingForm);
            } catch (error) {
                window.location.assign(card.href);
            } finally {
                card.removeAttribute('aria-busy');
            }
        });
    });

    const currentUrl = new URL(window.location.href);
    const selectedFromCard = currentUrl.searchParams.get('choose') === '1';
    const resumeCheckoutSelection = currentUrl.searchParams.get('selecting_checkout') === '1';
    const renderedStartMonth = document.querySelector('.public-calendar-pair')?.dataset.startMonth || '';
    const calendarMonthWasClamped = Boolean(form && renderedStartMonth && currentUrl.searchParams.get('month') !== renderedStartMonth);
    if (form && (selectedFromCard || resumeCheckoutSelection || calendarMonthWasClamped)) {
        currentUrl.searchParams.delete('choose');
        currentUrl.searchParams.delete('selecting_checkout');
        if (renderedStartMonth) {
            currentUrl.searchParams.set('month', renderedStartMonth);
        }
        window.history.replaceState({}, '', currentUrl.pathname + currentUrl.search + currentUrl.hash);
    }

    function filterAdminExtras() {
        if (!adminAccommodation || adminExtraOptions.length === 0) {
            return;
        }

        const accommodationId = String(adminAccommodation.value);
        adminExtraOptions.forEach((option) => {
            const supported = String(option.dataset.accommodationIds || '').split(',').filter(Boolean);
            const visible = supported.includes(accommodationId);
            option.hidden = !visible;
            option.querySelectorAll('input').forEach((input) => {
                input.disabled = !visible;
                if (!visible && input.type === 'checkbox') {
                    input.checked = false;
                }
            });
        });
        renderSaunaDays();
    }

    saunaCheckbox?.addEventListener('change', renderSaunaDays);
    adminAccommodation?.addEventListener('change', filterAdminExtras);
    saunaDays?.addEventListener('change', () => {
        validateSaunaDays();
        scheduleQuote();
    });
    checkinInput?.addEventListener('change', renderSaunaDays);
    checkoutInput?.addEventListener('change', renderSaunaDays);
    saunaCheckbox?.closest('form')?.addEventListener('submit', (event) => {
        if (!validateSaunaDays()) {
            event.preventDefault();
            saunaCheckbox.reportValidity();
        }
    });
    filterAdminExtras();
    renderSaunaDays();

    if (!form) {
        return;
    }
    if (form.dataset.bookingInitialized === '1') {
        return;
    }
    form.dataset.bookingInitialized = '1';

    const quoteBox = document.getElementById('quote-box');
    const bookingStatus = document.getElementById('booking-submit-status');
    const calendarPanel = document.querySelector('.calendar-panel');
    const calendarJumpDate = document.getElementById('calendar-jump-date');
    const calendarJumpDisplay = document.getElementById('calendar-jump-display');
    const calendarJumpButton = document.querySelector('[data-calendar-jump]');
    const bookingDatePicker = document.querySelector('[data-booking-date-picker]');
    const bookingDatePrevious = document.querySelector('[data-booking-date-previous]');
    const bookingDateNext = document.querySelector('[data-booking-date-next]');
    const bookingDateYear = document.querySelector('[data-booking-date-year]');
    const bookingDateMonth = document.querySelector('[data-booking-date-month]');
    const bookingDateDays = document.querySelector('[data-booking-date-days]');
    const guestInput = document.getElementById('guest-count');
    const guestCapacityHelp = document.getElementById('guest-capacity-help');
    let calendar = document.querySelector('.availability-calendar');
    let dayButtons = [];
    let calendarNavigationLinks = [];
    let selectingCheckout = resumeCheckoutSelection;
    let quoteTimer = null;

    function clampGuests() {
        if (!guestInput) {
            return;
        }

        const max = Number(guestInput.max || 99);
        const min = Number(guestInput.min || 1);
        const current = Number(guestInput.value || min);
        if (current > max) {
            guestInput.value = String(max);
        }
        if (current < min) {
            guestInput.value = String(min);
        }
    }

    function isNewYearNight(value) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) {
            return false;
        }
        const monthDay = value.slice(5);
        return monthDay >= '12-30' || monthDay <= '01-04';
    }

    function stayOverlapsNewYear(checkin, checkout) {
        if (!checkin || !checkout || checkout <= checkin) {
            return isNewYearNight(checkin);
        }
        for (let date = checkin; date < checkout; date = addDays(date, 1)) {
            if (isNewYearNight(date)) {
                return true;
            }
        }
        return false;
    }

    function effectiveMinimumNights(checkin, checkout) {
        const normalMinimum = Number(calendar ? calendar.dataset.minNights : 1) || 1;
        return stayOverlapsNewYear(checkin, checkout) ? Math.max(normalMinimum, 3) : normalMinimum;
    }

    function syncGuestLimits() {
        if (!guestInput) {
            return;
        }
        const special = stayOverlapsNewYear(checkinInput?.value || '', checkoutInput?.value || '');
        const minimum = Number(special ? guestInput.dataset.newYearMin : guestInput.dataset.normalMin) || 1;
        const maximum = Number(special ? guestInput.dataset.newYearMax : guestInput.dataset.normalMax) || 1;
        guestInput.min = String(minimum);
        guestInput.max = String(maximum);
        if (guestCapacityHelp) {
            guestCapacityHelp.textContent = special
                ? `Szilveszteri időszak: ${minimum}-${maximum} fő, pótágy nélkül.`
                : `Maximum ${maximum} fő.`;
        }
        clampGuests();
    }

    function syncCalendarNavigation() {
        calendarNavigationLinks.forEach((link) => {
            const target = new URL(link.href, window.location.origin);
            if (checkinInput?.value) {
                target.searchParams.set('checkin_date', checkinInput.value);
            } else {
                target.searchParams.delete('checkin_date');
            }
            if (checkoutInput?.value) {
                target.searchParams.set('checkout_date', checkoutInput.value);
            } else {
                target.searchParams.delete('checkout_date');
            }
            if (selectingCheckout) {
                target.searchParams.set('selecting_checkout', '1');
            } else {
                target.searchParams.delete('selecting_checkout');
            }
            target.hash = '';
            link.href = target.pathname + target.search;
        });
    }

    function wait(milliseconds) {
        return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
    }

    async function changeCalendarMonths(href, direction, trigger = null, requestedStartDate = '') {
        const pair = document.querySelector('.public-calendar-pair');
        const navigation = document.querySelector('.month-nav');
        if (!pair || !navigation || calendarPanel?.dataset.calendarLoading === '1') {
            return;
        }

        calendarPanel.dataset.calendarLoading = '1';
        calendarPanel.setAttribute('aria-busy', 'true');
        try {
            const response = await fetch(href, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
            if (!response.ok) {
                throw new Error('A hónap nem tölthető be.');
            }
            const fetched = new DOMParser().parseFromString(await response.text(), 'text/html');
            const incomingPair = fetched.querySelector('.public-calendar-pair');
            const incomingNavigation = fetched.querySelector('.month-nav');
            if (!incomingPair || !incomingNavigation) {
                throw new Error('Hiányos naptárnézet.');
            }

            pair.classList.add(direction === 'next' ? 'calendar-leave-left' : 'calendar-leave-right');
            await wait(280);
            pair.replaceWith(incomingPair);
            navigation.replaceWith(incomingNavigation);
            incomingPair.classList.add(direction === 'next' ? 'calendar-enter-right' : 'calendar-enter-left');
            window.requestAnimationFrame(() => {
                window.requestAnimationFrame(() => incomingPair.classList.add('calendar-enter-active'));
            });
            await wait(520);
            incomingPair.classList.remove('calendar-enter-right', 'calendar-enter-left', 'calendar-enter-active');

            const targetUrl = new URL(href, window.location.origin);
            targetUrl.searchParams.delete('choose');
            targetUrl.searchParams.delete('selecting_checkout');
            targetUrl.hash = '';
            window.history.replaceState({}, '', targetUrl.pathname + targetUrl.search);
            bindCalendarControls();
            syncCalendarNavigation();
            if (requestedStartDate) {
                selectingCheckout = false;
                const selected = selectCalendarDate(requestedStartDate);
                if (calendarJumpDisplay) {
                    calendarJumpDisplay.setCustomValidity(selected ? '' : 'A kiválasztott kezdőnap nem foglalható.');
                    if (!selected) {
                        calendarJumpDisplay.reportValidity();
                    }
                }
            } else {
                highlightSelectedRange();
            }
        } catch (error) {
            if (trigger) {
                const originalLabel = trigger.textContent;
                trigger.textContent = 'Próbáld újra';
                window.setTimeout(() => { trigger.textContent = originalLabel; }, 1800);
            }
        } finally {
            delete calendarPanel.dataset.calendarLoading;
            calendarPanel.removeAttribute('aria-busy');
        }
    }

    function bindCalendarControls() {
        calendar = document.querySelector('.availability-calendar');
        dayButtons = Array.from(document.querySelectorAll('.calendar-day'));
        calendarNavigationLinks = Array.from(document.querySelectorAll('.month-nav a'));

        dayButtons.forEach((button) => {
            if (!button.disabled && button.dataset.calendarBound !== '1') {
                button.dataset.calendarBound = '1';
                button.addEventListener('click', () => selectCalendarDate(button.dataset.date));
            }
        });

    }

    if (calendarPanel?.dataset.navigationDelegated !== '1') {
        calendarPanel.dataset.navigationDelegated = '1';
        calendarPanel.addEventListener('click', (event) => {
            const link = event.target.closest('.month-nav a[data-calendar-direction]');
            if (!link || !calendarPanel.contains(link)) {
                return;
            }
            event.preventDefault();
            const direction = link.dataset.calendarDirection === 'previous' ? 'previous' : 'next';
            changeCalendarMonths(link.href, direction, link);
        });
    }

    function initializeBookingDatePicker() {
        if (!calendarJumpDate || !calendarJumpDisplay || !bookingDatePicker || !bookingDateYear || !bookingDateMonth || !bookingDateDays) {
            return;
        }

        const minimum = calendarJumpDate.dataset.minDate || '';
        const maximum = calendarJumpDate.dataset.maxDate || '';
        const minimumMonth = minimum.slice(0, 7);
        const maximumMonth = maximum.slice(0, 7);
        const monthNames = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
        let visibleMonth = (calendarJumpDate.value || minimum).slice(0, 7);

        const displayDate = (value) => {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
                return '';
            }
            const [year, month, day] = value.split('-');
            return `${year}. ${month}. ${day}.`;
        };

        const shiftPickerMonth = (month, amount) => {
            const [year, monthNumber] = month.split('-').map(Number);
            const shifted = new Date(year, monthNumber - 1 + amount, 1);
            return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}`;
        };

        const clampPickerMonth = (month) => {
            if (month < minimumMonth) return minimumMonth;
            if (month > maximumMonth) return maximumMonth;
            return month;
        };

        const renderPicker = () => {
            visibleMonth = clampPickerMonth(visibleMonth);
            const [year, month] = visibleMonth.split('-').map(Number);
            bookingDateYear.value = String(year);
            bookingDateMonth.textContent = monthNames[month - 1];
            bookingDatePrevious.disabled = visibleMonth <= minimumMonth;
            bookingDateNext.disabled = visibleMonth >= maximumMonth;

            const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7;
            const lastDay = new Date(year, month, 0).getDate();
            const cells = [];
            for (let index = 0; index < firstWeekday; index += 1) {
                const empty = document.createElement('span');
                empty.className = 'booking-date-picker-empty';
                cells.push(empty);
            }
            for (let day = 1; day <= lastDay; day += 1) {
                const value = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const button = document.createElement('button');
                button.type = 'button';
                button.textContent = String(day);
                button.disabled = value < minimum || value > maximum;
                button.classList.toggle('selected', value === calendarJumpDate.value);
                button.setAttribute('aria-label', displayDate(value));
                button.addEventListener('click', () => {
                    calendarJumpDate.value = value;
                    calendarJumpDisplay.value = displayDate(value);
                    calendarJumpDisplay.setCustomValidity('');
                    bookingDatePicker.hidden = true;
                    calendarJumpDisplay.setAttribute('aria-expanded', 'false');
                    renderPicker();
                });
                cells.push(button);
            }
            bookingDateDays.replaceChildren(...cells);
        };

        const years = [];
        const minimumYear = Number(minimum.slice(0, 4));
        const maximumYear = Number(maximum.slice(0, 4));
        for (let year = minimumYear; year <= maximumYear; year += 1) {
            const option = document.createElement('option');
            option.value = String(year);
            option.textContent = String(year);
            years.push(option);
        }
        bookingDateYear.replaceChildren(...years);
        calendarJumpDisplay.value = displayDate(calendarJumpDate.value);

        const openPicker = () => {
            bookingDatePicker.hidden = false;
            calendarJumpDisplay.setAttribute('aria-expanded', 'true');
            visibleMonth = clampPickerMonth((calendarJumpDate.value || minimum).slice(0, 7));
            renderPicker();
        };

        calendarJumpDisplay.setAttribute('aria-expanded', 'false');
        calendarJumpDisplay.addEventListener('click', openPicker);
        calendarJumpDisplay.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openPicker();
            }
        });
        bookingDatePrevious?.addEventListener('click', () => {
            visibleMonth = shiftPickerMonth(visibleMonth, -1);
            renderPicker();
        });
        bookingDateNext?.addEventListener('click', () => {
            visibleMonth = shiftPickerMonth(visibleMonth, 1);
            renderPicker();
        });
        bookingDateYear.addEventListener('change', () => {
            visibleMonth = clampPickerMonth(`${bookingDateYear.value}-${visibleMonth.slice(5)}`);
            renderPicker();
        });
        bookingDatePicker.addEventListener('click', (event) => event.stopPropagation());
        document.addEventListener('click', (event) => {
            if (!event.target.closest('.calendar-jump')) {
                bookingDatePicker.hidden = true;
                calendarJumpDisplay.setAttribute('aria-expanded', 'false');
            }
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                bookingDatePicker.hidden = true;
                calendarJumpDisplay.setAttribute('aria-expanded', 'false');
            }
        });
        renderPicker();
    }

    initializeBookingDatePicker();

    calendarJumpButton?.addEventListener('click', () => {
        if (!calendarJumpDate || !calendarJumpDisplay) {
            return;
        }
        const date = calendarJumpDate.value;
        const minimum = calendarJumpDate.dataset.minDate;
        const maximum = calendarJumpDate.dataset.maxDate;
        const validFormat = /^\d{4}-\d{2}-\d{2}$/.test(date);
        const withinLimits = validFormat
            && (!minimum || date >= minimum)
            && (!maximum || date <= maximum);
        calendarJumpDisplay.setCustomValidity(withinLimits ? '' : 'Válassz napot a megadott kétéves időszakon belül.');
        if (!withinLimits) {
            calendarJumpDisplay.reportValidity();
            return;
        }

        const targetMonth = date.slice(0, 7);
        const currentMonth = document.querySelector('.public-calendar-pair')?.dataset.startMonth || targetMonth;
        const direction = targetMonth < currentMonth ? 'previous' : 'next';
        const minimumNights = effectiveMinimumNights(date, addDays(date, 1));
        const targetUrl = new URL(window.location.href);
        targetUrl.searchParams.set('month', targetMonth);
        targetUrl.searchParams.set('choose', '1');
        targetUrl.searchParams.set('checkin_date', date);
        targetUrl.searchParams.set('checkout_date', addDays(date, minimumNights));
        targetUrl.searchParams.delete('selecting_checkout');
        targetUrl.hash = '';
        changeCalendarMonths(targetUrl.toString(), direction, calendarJumpButton, date);
    });

    function syncDateLimits(adjustCheckout) {
        if (!checkinInput || !checkoutInput) {
            return;
        }

        const minNights = effectiveMinimumNights(checkinInput.value, checkoutInput.value);
        const earliestCheckout = checkinInput.value ? addDays(checkinInput.value, minNights) : checkoutInput.min;
        if (earliestCheckout) {
            checkoutInput.min = earliestCheckout;
        }
        if (adjustCheckout && checkinInput.value && (!checkoutInput.value || checkoutInput.value < earliestCheckout)) {
            checkoutInput.value = earliestCheckout;
        }
    }

    function selectCalendarDate(date) {
        if (!checkinInput || !checkoutInput) {
            return false;
        }

        const checkin = checkinInput.value;

        if (!checkin || !selectingCheckout || date <= checkin) {
            const button = dayButtons.find((item) => item.dataset.date === date);
            if (button && button.dataset.afternoonStatus !== 'free') {
                return false;
            }
            const minNights = effectiveMinimumNights(date, addDays(date, 1));
            checkinInput.value = date;
            checkoutInput.value = addDays(date, minNights);
            selectingCheckout = true;
        } else {
            const minNights = effectiveMinimumNights(checkin, date);
            const requestedNights = daysBetween(checkin, date);
            checkoutInput.value = requestedNights < minNights ? addDays(checkin, minNights) : date;
            selectingCheckout = false;
        }

        syncDateLimits(true);
        syncGuestLimits();
        syncCalendarNavigation();
        highlightSelectedRange();
        renderSaunaDays();
        scheduleQuote();
        return true;
    }

    function highlightSelectedRange() {
        const checkin = checkinInput ? checkinInput.value : '';
        const checkout = checkoutInput ? checkoutInput.value : '';

        dayButtons.forEach((button) => {
            const date = button.dataset.date;
            button.classList.toggle('selected-start', Boolean(checkin && date === checkin));
            button.classList.toggle('selected-range', Boolean(checkin && checkout && date > checkin && date < checkout));
            button.classList.toggle('selected-end', Boolean(checkout && date === checkout));
        });
    }

    function renderQuote(data) {
        if (!quoteBox) {
            return;
        }

        if (!data.ok) {
            quoteBox.innerHTML = '<div class="quote-errors">' + data.errors.map((error) => '<p>' + escapeHtml(error) + '</p>').join('') + '</div>';
            return;
        }

        const quote = data.quote;
        const meta = [
            ['Apartman', quote.accommodation_name],
            ['Időszak', quote.checkin_date + ' - ' + quote.checkout_date],
            ['Létszám', quote.guests + ' fő'],
            ['Éjszakák', quote.nights]
        ].map((item) => '<div><span>' + escapeHtml(item[0]) + '</span><strong>' + escapeHtml(item[1]) + '</strong></div>').join('');

        const nights = quote.night_rows.map((row) => {
            const period = row.period ? ' · ' + escapeHtml(row.period) : '';
            return '<li><span>' + escapeHtml(row.date) + ' (' + escapeHtml(row.day_name) + ')' + period + '</span><strong>' + escapeHtml(row.total) + '</strong></li>';
        }).join('');

        const extras = quote.extras.length
            ? '<ul>' + quote.extras.map((extra) => {
                const dates = extra.selected_dates && extra.selected_dates.length
                    ? '<small>' + escapeHtml(extra.selected_dates.join(', ')) + '</small>'
                    : '';
                return '<li><span>' + escapeHtml(extra.name) + ' × ' + escapeHtml(extra.quantity) + dates + '</span><strong>' + escapeHtml(extra.amount) + '</strong></li>';
            }).join('') + '</ul>'
            : '<p>Nincs kiválasztott extra.</p>';

        const hasNewYearNight = quote.night_rows.some((row) => row.period === 'Szilveszteri időszak');
        const newYearNotice = hasNewYearNight
            ? '<p class="quote-special-notice"><strong>Kérjük, vedd figyelembe:</strong> a szilveszteri időszakba eső éjszakákra a vendégek számától függetlenül teljes házdíj fizetendő.</p>'
            : '';

        quoteBox.innerHTML =
            '<div class="quote-meta">' + meta + '</div>' +
            newYearNotice +
            '<div class="quote-summary">' +
            '<div><span>Szállás részösszeg</span><strong>' + escapeHtml(quote.room_subtotal) + '</strong></div>' +
            '<div><span>Extrák</span><strong>' + escapeHtml(quote.extras_total) + '</strong></div>' +
            '<div><span>Kupon kedvezmény</span><strong>-' + escapeHtml(quote.coupon_discount) + '</strong></div>' +
            '<div class="total"><span>Végösszeg</span><strong>' + escapeHtml(quote.total) + '</strong></div>' +
            '</div>' +
            '<details open><summary>Éjszakánkénti bontás</summary><ul>' + nights + '</ul></details>' +
            '<div class="quote-extras"><h3>Extrák</h3>' + extras + '</div>' +
            '<p class="price-note">Az itt megjelenő árak tájékoztató jellegűek. A pontos fizetendő összeget a visszaigazolás után e-mailben küldjük el.</p>';
    }

    function requestQuote() {
        if (!form || !quoteBox || !form.dataset.quoteUrl) {
            return;
        }

        clampGuests();

        if (!checkinInput.value || !checkoutInput.value || !guestInput.value) {
            renderWaitingQuote();
            return;
        }

        quoteBox.innerHTML = '<p>Kalkuláció folyamatban...</p>';
        fetch(form.dataset.quoteUrl, {
            method: 'POST',
            body: new URLSearchParams(new FormData(form)),
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        })
            .then((response) => response.json())
            .then(renderQuote)
            .catch(() => {
                quoteBox.innerHTML = '<div class="quote-errors"><p>Nem sikerült lekérni a kalkulációt.</p></div>';
            });
    }

    function renderBookingStatus(data, successful) {
        if (!bookingStatus) {
            return;
        }

        if (successful) {
            const code = data.booking_code
                ? '<p class="booking-result-code">Foglalási azonosító: <strong>' + escapeHtml(data.booking_code) + '</strong></p>'
                : '';
            bookingStatus.className = 'booking-submit-status is-success';
            bookingStatus.setAttribute('role', 'status');
            bookingStatus.innerHTML = '<div class="booking-result-icon" aria-hidden="true">✓</div>'
                + '<h2>Köszönjük a foglalási igényedet!</h2>'
                + '<p>' + escapeHtml(data.message || 'A foglalási igényed sikeresen megérkezett. Hamarosan e-mailben jelentkezünk.') + '</p>'
                + code;
        } else {
            const errors = Array.isArray(data.errors) && data.errors.length
                ? '<ul>' + data.errors.map((error) => '<li>' + escapeHtml(error) + '</li>').join('') + '</ul>'
                : '<p>A foglalási igényt most nem sikerült elküldeni.</p>';
            const phone = data.contact_phone || '+36 30 000 0000';
            const email = data.contact_email || 'hello@ligetlak.example';
            bookingStatus.className = 'booking-submit-status is-error';
            bookingStatus.setAttribute('role', 'alert');
            bookingStatus.innerHTML = '<div class="booking-result-icon" aria-hidden="true">!</div>'
                + '<h2>A foglalási igényt nem sikerült elküldeni</h2>'
                + errors
                + '<p>Kérj segítséget a <a href="tel:+36307149778">' + escapeHtml(phone) + '</a> telefonszámon vagy a '
                + '<a href="mailto:' + escapeHtml(email) + '">' + escapeHtml(email) + '</a> címen.</p>'
                + '<button class="button secondary" type="button" data-booking-status-close>Vissza a foglaláshoz</button>';
        }
        bookingStatus.hidden = false;
        calendarPanel?.classList.add('booking-result-visible');
        window.requestAnimationFrame(() => {
            bookingStatus.scrollIntoView({ behavior: 'smooth', block: 'center' });
            bookingStatus.focus({ preventScroll: true });
        });
    }

    bookingStatus?.addEventListener('click', (event) => {
        if (!event.target.closest('[data-booking-status-close]')) {
            return;
        }
        bookingStatus.hidden = true;
        calendarPanel?.classList.remove('booking-result-visible');
    });

    function scheduleQuote() {
        window.clearTimeout(quoteTimer);
        quoteTimer = window.setTimeout(requestQuote, 250);
    }

    function renderWaitingQuote() {
        if (!quoteBox) {
            return;
        }

        const accommodation = form.dataset.accommodationName || '-';
        const guests = guestInput && guestInput.value ? guestInput.value + ' fő' : '-';
        const checkin = checkinInput && checkinInput.value ? checkinInput.value : '-';
        const checkout = checkoutInput && checkoutInput.value ? checkoutInput.value : '-';

        quoteBox.innerHTML =
            '<div class="quote-meta">' +
            '<div><span>Apartman</span><strong>' + escapeHtml(accommodation) + '</strong></div>' +
            '<div><span>Időszak</span><strong>' + escapeHtml(checkin + ' - ' + checkout) + '</strong></div>' +
            '<div><span>Létszám</span><strong>' + escapeHtml(guests) + '</strong></div>' +
            '<div><span>Éjszakák</span><strong>-</strong></div>' +
            '</div>' +
            '<p class="quote-hint">A pontos ár a dátumok kijelölése után automatikusan megjelenik.</p>' +
            '<p class="price-note">Az itt megjelenő árak tájékoztató jellegűek. A pontos fizetendő összeget a visszaigazolás után e-mailben küldjük el.</p>';
    }

    function addDays(value, days) {
        const parts = value.split('-').map(Number);
        const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + days));
        return formatDate(date);
    }

    function daysBetween(start, end) {
        const startParts = start.split('-').map(Number);
        const endParts = end.split('-').map(Number);
        const startDate = new Date(Date.UTC(startParts[0], startParts[1] - 1, startParts[2]));
        const endDate = new Date(Date.UTC(endParts[0], endParts[1] - 1, endParts[2]));
        return Math.round((endDate - startDate) / 86400000);
    }

    function formatDate(date) {
        return [
            date.getUTCFullYear(),
            String(date.getUTCMonth() + 1).padStart(2, '0'),
            String(date.getUTCDate()).padStart(2, '0')
        ].join('-');
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function renderSaunaDays() {
        if (!saunaCheckbox || !saunaDays) {
            return;
        }

        const selected = new Set(
            Array.from(saunaDays.querySelectorAll('input:checked')).map((input) => input.value)
        );
        if (selected.size === 0 && saunaDays.dataset.selectedDates) {
            try {
                JSON.parse(saunaDays.dataset.selectedDates).forEach((date) => selected.add(date));
            } catch (error) {
                // Invalid retained form state is ignored and rebuilt from the dates.
            }
            saunaDays.dataset.selectedDates = '';
        }

        saunaDays.hidden = !saunaCheckbox.checked;
        saunaDays.innerHTML = '';
        if (!saunaCheckbox.checked || !checkinInput.value || !checkoutInput.value || checkoutInput.value <= checkinInput.value) {
            if (saunaCheckbox.checked) {
                saunaDays.innerHTML = '<p class="sauna-days-hint">Előbb válaszd ki az érkezés és távozás dátumát.</p>';
            }
            validateSaunaDays();
            return;
        }

        const title = document.createElement('p');
        title.className = 'sauna-days-title';
        title.textContent = 'Mely napokon szeretnétek szaunázni?';
        saunaDays.appendChild(title);

        const choices = document.createElement('div');
        choices.className = 'sauna-day-choices';
        for (let date = checkinInput.value; date < checkoutInput.value; date = addDays(date, 1)) {
            const label = document.createElement('label');
            label.className = 'sauna-day-choice';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.name = 'extra_dates[' + saunaDays.dataset.extraId + '][]';
            input.value = date;
            input.checked = selected.has(date);
            const text = document.createElement('span');
            text.textContent = formatHungarianDay(date);
            label.append(input, text);
            choices.appendChild(label);
        }
        saunaDays.appendChild(choices);
        validateSaunaDays();
    }

    function validateSaunaDays() {
        if (!saunaCheckbox) {
            return true;
        }
        const valid = !saunaCheckbox.checked || Boolean(saunaDays && saunaDays.querySelector('input:checked'));
        saunaCheckbox.setCustomValidity(valid ? '' : 'Válassz ki legalább egy szaunanapot.');
        return valid;
    }

    function formatHungarianDay(value) {
        const parts = value.split('-');
        const date = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
        const weekday = ['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo'][date.getUTCDay()];
        return Number(parts[1]) + '. ' + Number(parts[2]) + '. ' + weekday;
    }

    guestInput?.addEventListener('input', () => {
        clampGuests();
        scheduleQuote();
    });
    checkinInput?.addEventListener('input', () => {
        selectingCheckout = false;
        syncDateLimits(true);
        syncGuestLimits();
        syncCalendarNavigation();
        renderSaunaDays();
    });
    checkoutInput?.addEventListener('input', () => {
        selectingCheckout = false;
        syncDateLimits(true);
        syncGuestLimits();
        syncCalendarNavigation();
        renderSaunaDays();
    });
    form.addEventListener('input', scheduleQuote);
    form.addEventListener('change', () => {
        highlightSelectedRange();
        syncGuestLimits();
        syncCalendarNavigation();
        scheduleQuote();
    });
    form.addEventListener('submit', (event) => {
        clampGuests();
        if (event.defaultPrevented) {
            return;
        }

        event.preventDefault();
        const submitButton = form.querySelector('button[type="submit"]');
        const originalLabel = submitButton ? submitButton.textContent : '';
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = 'Küldés folyamatban…';
        }
        if (bookingStatus) {
            bookingStatus.hidden = true;
            calendarPanel?.classList.remove('booking-result-visible');
        }

        fetch(form.action, {
            method: 'POST',
            body: new FormData(form),
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        })
            .then(async (response) => {
                const data = await response.json();
                renderBookingStatus(data, response.ok && data.ok === true);
            })
            .catch(() => {
                renderBookingStatus({
                    errors: ['A foglalási igényt hálózati hiba miatt most nem sikerült elküldeni.'],
                    contact_phone: '+36 30 000 0000',
                    contact_email: 'hello@ligetlak.example'
                }, false);
            })
            .finally(() => {
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent = originalLabel;
                }
            });
    });

    bindCalendarControls();
    clampGuests();
    syncDateLimits(true);
    syncGuestLimits();
    syncCalendarNavigation();
    highlightSelectedRange();
    requestQuote();
};

window.LigetlakBoot();
