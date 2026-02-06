document.addEventListener('DOMContentLoaded', () => {
    // Zentrale DOM-Referenzen (einmalig nach DOM-Ready auflösen)
    const menuToggle = document.getElementById('menu-toggle');
    const slideMenu = document.getElementById('slide-menu');
    const menuClose = document.getElementById('menu-close');
    const menuItems = document.querySelectorAll('.menu-item');
    const menuBackdrop = document.querySelector('.overlay-backdrop');
    const mainContent = document.getElementById('main-content');
    const contentArea = document.querySelector('.content-area');
    const footerLogo = document.getElementById('footer-logo');
    const allMyLinksTrigger = document.getElementById('allmylinks-trigger');
    const mp3Modal = document.getElementById('mp3-modal');
    const linksModal = document.getElementById('links-modal');
    const modalCloseButtons = document.querySelectorAll('.modal-close-button');

    // Zeitsteuerung für Rotationen und Intro-Animation
    const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
    const INTRO_DURATION_MS = 3000;
    const PAGE_LABELS = {
        holiday: 'Feiertage',
        hackerquotes: 'Hacker Quotes',
        facts: 'Fakten',
        favquotes: 'Zitate',
        events: 'Ereignisse',
        need2know: 'Unnützlich-Nützlich'
    };

    // Laufzeit-State (Timer, Caches, Indizes)
    let quoteRotationTimer = null;
    let introTimer = null;
    let fallbackAttempts = 0;
    let favQuotesCache = null;
    let favQuoteIndex = null;
    let factsCache = null;
    let factsIndex = null;
    let needToKnowCache = null;
    let needToKnowIndex = null;

    const FOOTER_LOGO_DEFAULT = 'assets/logo-dark.svg';
    const FOOTER_LOGO_HOVER = 'assets/logo-hover.svg';
    const STORAGE_KEYS = {
        factsIndex: 'dailyFacts4U.factsIndex',
        needToKnowIndex: 'dailyFacts4U.need2knowIndex'
    };

    // Timer-Helfer, um doppelte Intervalle zu vermeiden
    const clearQuoteTimer = () => {
        if (quoteRotationTimer) {
            clearTimeout(quoteRotationTimer);
            quoteRotationTimer = null;
        }
    };

    const clearIntroTimer = () => {
        if (introTimer) {
            clearTimeout(introTimer);
            introTimer = null;
        }
    };

    // --- Menu Functionality ---
    // Overlay-Menü öffnen/schließen inkl. ARIA-Status
    const openMenu = () => {
        slideMenu.classList.add('open');
        menuToggle.setAttribute('aria-expanded', 'true');
        slideMenu.setAttribute('aria-hidden', 'false');
    };

    const closeMenu = () => {
        slideMenu.classList.remove('open');
        menuToggle.setAttribute('aria-expanded', 'false');
        slideMenu.setAttribute('aria-hidden', 'true');
    };

    menuToggle.addEventListener('click', () => {
        if (slideMenu.classList.contains('open')) {
            closeMenu();
        } else {
            openMenu();
        }
    });

    menuClose.addEventListener('click', closeMenu);

    menuBackdrop.addEventListener('click', closeMenu);

    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            closeMenu();
        });
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && slideMenu.classList.contains('open')) {
            closeMenu();
        }
    });

    // --- Modal Functionality ---
    // Footer-Logo öffnet das MP3-Modal; AllMyLinks öffnet Links-Modal
    footerLogo.addEventListener('click', () => {
        mp3Modal.classList.add('open');
    });

    if (allMyLinksTrigger && linksModal) {
        allMyLinksTrigger.addEventListener('click', (event) => {
            event.preventDefault();
            linksModal.classList.add('open');
        });
    }

    footerLogo.addEventListener('mouseenter', () => {
        footerLogo.src = FOOTER_LOGO_HOVER;
    });

    footerLogo.addEventListener('mouseleave', () => {
        footerLogo.src = FOOTER_LOGO_DEFAULT;
    });

    footerLogo.addEventListener('focus', () => {
        footerLogo.src = FOOTER_LOGO_HOVER;
    });

    footerLogo.addEventListener('blur', () => {
        footerLogo.src = FOOTER_LOGO_DEFAULT;
    });

    modalCloseButtons.forEach(button => {
        button.addEventListener('click', () => {
            const modal = button.closest('.modal');
            if (modal) {
                modal.classList.remove('open');
            }
        });
    });

    // Klick außerhalb der Modal-Box schließt das Modal
    const closeOnBackdrop = (modal) => {
        if (!modal) return;
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.classList.remove('open');
            }
        });
    };

    closeOnBackdrop(mp3Modal);
    closeOnBackdrop(linksModal);

    // Datums-Key im Format DD.MM für die JSON-Daten
    const getTodayKey = () => {
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        return `${day}.${month}`;
    };

    // ISO-Kalenderwoche für die Feiertagszeile
    const getISOWeekNumber = (date) => {
        const tempDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = tempDate.getUTCDay() || 7;
        tempDate.setUTCDate(tempDate.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(tempDate.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((tempDate - yearStart) / 86400000) + 1) / 7);
        return String(weekNo).padStart(2, '0');
    };

    // Nutzungsfreundliche Datumsformate
    const formatHolidayDateLine = (date) => {
        const weekday = new Intl.DateTimeFormat('de-DE', { weekday: 'long' }).format(date);
        const monthName = new Intl.DateTimeFormat('de-DE', { month: 'long' }).format(date);
        const day = String(date.getDate()).padStart(2, '0');
        const year = date.getFullYear();
        const week = getISOWeekNumber(date);
        return `${weekday} (KW: ${week}) - ${day}. ${monthName} ${year}`;
    };

    const formatFullDate = (date) => {
        const day = String(date.getDate()).padStart(2, '0');
        const monthName = new Intl.DateTimeFormat('de-DE', { month: 'long' }).format(date);
        return `${day}. ${monthName}`;
    };

    // Stabiler Index: pro 12h Zeitraum eine Quote
    const getQuoteIndex = (length) => {
        if (length <= 0) return 0;
        const intervalIndex = Math.floor(Date.now() / TWELVE_HOURS_MS);
        return intervalIndex % length;
    };

    const getNextIndex = (length, current) => {
        if (length <= 0) return 0;
        if (typeof current !== 'number' || Number.isNaN(current)) return 0;
        return (current + 1) % length;
    };

    const getRandomStartIndex = (length) => {
        if (length <= 0) return 0;
        return Math.floor(Math.random() * length);
    };

    const clampIndex = (length, index) => {
        if (length <= 0) return 0;
        if (typeof index !== 'number' || Number.isNaN(index)) return 0;
        return Math.min(Math.max(index, 0), length - 1);
    };

    // Sucht den nächsten Eintrag, der sich vom aktuellen unterscheidet
    const getNextDistinctIndex = (items, currentIndex, signatureFn) => {
        if (!Array.isArray(items) || items.length === 0) return 0;
        const safeIndex = clampIndex(items.length, currentIndex);
        const currentSignature = signatureFn(items[safeIndex]);
        let nextIndex = safeIndex;
        for (let i = 0; i < items.length; i += 1) {
            nextIndex = getNextIndex(items.length, nextIndex);
            if (signatureFn(items[nextIndex]) !== currentSignature) {
                return nextIndex;
            }
        }
        return safeIndex;
    };

    // Lokale Persistenz der Rotationen (z.B. Facts/Need2Know)
    const getStoredIndex = (key) => {
        if (!key) return null;
        try {
            const raw = window.localStorage.getItem(key);
            if (raw === null) return null;
            const parsed = Number.parseInt(raw, 10);
            return Number.isNaN(parsed) ? null : parsed;
        } catch (error) {
            console.warn('LocalStorage read failed:', error);
            return null;
        }
    };

    const setStoredIndex = (key, index) => {
        if (!key || typeof index !== 'number' || Number.isNaN(index)) return;
        try {
            window.localStorage.setItem(key, String(index));
        } catch (error) {
            console.warn('LocalStorage write failed:', error);
        }
    };

    // Tagesindex (0-365) für "Quote des Tages"
    const getDayOfYear = () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 0);
        const diff = now - start;
        return Math.floor(diff / (24 * 60 * 60 * 1000));
    };

    const getDailyIndex = (length) => {
        if (length <= 0) return 0;
        return getDayOfYear() % length;
    };

    // Entfernt eingebettete Quellen/Marker aus importierten Daten
    const stripCitations = (value) => {
        if (typeof value !== 'string') return value;
        return value
            .replace(/\s*\[oai_citation:[^\]]+\]\([^\)]+\)/g, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
    };

    // Vereinheitlicht Zitat-Formatierungen über verschiedene Datensätze hinweg
    const normalizeQuoteText = (value) => {
        if (typeof value !== 'string') return value;
        let cleaned = stripCitations(value);
        cleaned = cleaned.replace(/^(DE:|EN:)\s*/i, '');
        cleaned = cleaned.replace(/\s*\((?:EN\s*)?#\d+\)\s*$/i, '');
        return cleaned.trim();
    };

    // UI: Reload-Icon + Button für Content-Rotation
    const createReloadIcon = () => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('aria-hidden', 'true');
        svg.classList.add('reload-icon');

        const pathA = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathA.setAttribute('d', 'M21 12a9 9 0 1 1-3.3-6.9');

        const pathB = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathB.setAttribute('d', 'M21 3v6h-6');

        svg.append(pathA, pathB);
        return svg;
    };

    const createReloadButton = (label, onClick) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'quote-reload';
        button.setAttribute('aria-label', label);
        button.appendChild(createReloadIcon());
        button.addEventListener('click', () => {
            onClick();
            if (contentArea) {
                contentArea.scrollTop = 0;
            }
        });
        return button;
    };

    // UI: Wiederverwendbarer Content-Card-Baustein
    const buildCard = ({ kicker, headline, body, meta, italicBody = false }) => {
        const card = document.createElement('div');
        card.className = 'content-card';

        if (kicker) {
            const kickerEl = document.createElement('div');
            kickerEl.className = 'content-kicker';
            kickerEl.textContent = kicker;
            card.appendChild(kickerEl);
        }

        if (headline) {
            const headlineEl = document.createElement('div');
            headlineEl.className = 'content-headline';
            headlineEl.textContent = headline;
            card.appendChild(headlineEl);
        }

        if (body) {
            const bodyEl = document.createElement('p');
            bodyEl.className = 'content-body';
            if (italicBody) {
                const em = document.createElement('em');
                em.textContent = body;
                bodyEl.appendChild(em);
            } else {
                bodyEl.textContent = body;
            }
            card.appendChild(bodyEl);
        }

        if (meta) {
            const metaEl = document.createElement('div');
            metaEl.className = 'content-meta';
            metaEl.textContent = meta;
            card.appendChild(metaEl);
        }

        return card;
    };

    // Render: Feiertage (DD.MM Key -> heutiger Eintrag)
    const renderHoliday = (data) => {
        const now = new Date();
        const todayKey = getTodayKey();
        const entry = data?.[todayKey];
        const card = document.createElement('div');
        card.className = 'content-card';

        const kicker = document.createElement('div');
        kicker.className = 'content-kicker';
        kicker.textContent = 'Heute:';

        const dateLine = document.createElement('div');
        dateLine.className = 'holiday-date';
        dateLine.textContent = formatHolidayDateLine(now);

        const title = document.createElement('div');
        title.className = 'holiday-title';
        title.textContent = entry || 'Kein Eintrag für heute.';

        card.append(kicker, dateLine, title);
        const hint = document.createElement('div');
        hint.className = 'download-hint';

        const hintText = document.createElement('span');
        hintText.textContent = 'Kalender-Download: ';

        const hintLink = document.createElement('a');
        hintLink.href = 'assets/CrazyHolidays.ics';
        hintLink.textContent = 'CrazyHolidays.ics';
        hintLink.setAttribute('download', 'CrazyHolidays.ics');

        const hintSuffix = document.createElement('span');
        hintSuffix.textContent = ' – in deinen Kalender importieren.';

        hint.append(hintText, hintLink, hintSuffix);
        mainContent.replaceChildren(card, hint);
    };

    // Render: Hacker Quotes (rotierend alle 12h)
    const renderHackerQuote = (data) => {
        const quotes = Array.isArray(data) ? data : [];
        if (quotes.length === 0) {
            const card = buildCard({
                kicker: PAGE_LABELS.hackerquotes,
                headline: 'Keine Zitate verfügbar',
                body: 'Bitte später erneut versuchen.'
            });
            mainContent.replaceChildren(card);
            return;
        }

        const quote = quotes[getQuoteIndex(quotes.length)];
        const card = document.createElement('div');
        card.className = 'content-card';

        const kicker = document.createElement('div');
        kicker.className = 'content-kicker';
        kicker.textContent = PAGE_LABELS.hackerquotes;

        const quoteText = document.createElement('div');
        quoteText.className = 'hacker-quote-text';
        const quoteEm = document.createElement('em');
        quoteEm.textContent = `„${quote.quote}“`;
        quoteText.appendChild(quoteEm);

        const meta = document.createElement('div');
        meta.className = 'hacker-quote-meta';
        meta.textContent = `${quote.character} (${quote.title} | ${quote.year})`;

        card.append(kicker, quoteText, meta);
        mainContent.replaceChildren(card);

        clearQuoteTimer();
        const msIntoInterval = Date.now() % TWELVE_HOURS_MS;
        const msUntilNext = TWELVE_HOURS_MS - msIntoInterval + 50;
        quoteRotationTimer = setTimeout(() => {
            renderHackerQuote(quotes);
        }, msUntilNext);
    };

    // Render: Fakten mit lokalem Rotationsindex
    const renderFacts = (data) => {
        if (!Array.isArray(data) || data.length === 0) {
            renderDefault(data, 'facts');
            return;
        }

        factsCache = data;
        const storedIndex = getStoredIndex(STORAGE_KEYS.factsIndex);
        factsIndex = typeof storedIndex === 'number'
            ? getNextIndex(data.length, storedIndex)
            : getRandomStartIndex(data.length);
        showFactsEntry();
    };

    const showFactsEntry = () => {
        if (!Array.isArray(factsCache) || factsCache.length === 0) {
            renderDefault(factsCache, 'facts');
            return;
        }

        factsIndex = clampIndex(factsCache.length, factsIndex);
        const fact = factsCache[factsIndex];
        if (!fact || typeof fact.headline !== 'string' || typeof fact.text !== 'string') {
            renderDefault(fact, 'facts');
            return;
        }

        const cleanHeadline = stripCitations(fact.headline);
        const cleanText = stripCitations(fact.text);
        const cleanSource = stripCitations(fact.source);
        const card = buildCard({
            kicker: PAGE_LABELS.facts,
            headline: cleanHeadline,
            body: cleanText,
            meta: cleanSource ? `Quelle: ${cleanSource}` : null
        });

        setStoredIndex(STORAGE_KEYS.factsIndex, factsIndex);

        const reload = createReloadButton('Neuen Fakt laden', () => {
            factsIndex = getNextIndex(factsCache.length, factsIndex);
            showFactsEntry();
            mainContent.classList.add('active');
        });

        const stack = document.createElement('div');
        stack.className = 'content-stack';
        stack.append(card, reload);
        mainContent.replaceChildren(stack);
    };

    // Render: Need2Know mit zwei möglichen Daten-Formaten
    const renderNeedToKnow = (data) => {
        if (!Array.isArray(data) || data.length === 0) {
            renderDefault(data, 'need2know');
            return;
        }

        needToKnowCache = data;
        const storedIndex = getStoredIndex(STORAGE_KEYS.needToKnowIndex);
        needToKnowIndex = typeof storedIndex === 'number'
            ? getNextIndex(data.length, storedIndex)
            : getRandomStartIndex(data.length);
        showNeedToKnowEntry();
    };

    const showNeedToKnowEntry = () => {
        if (!Array.isArray(needToKnowCache) || needToKnowCache.length === 0) {
            renderDefault(needToKnowCache, 'need2know');
            return;
        }

        needToKnowIndex = clampIndex(needToKnowCache.length, needToKnowIndex);
        const entry = needToKnowCache[needToKnowIndex];
        if (!entry || typeof entry !== 'object') {
            renderDefault(entry, 'need2know');
            return;
        }

        const card = document.createElement('div');
        card.className = 'content-card';

        const kicker = document.createElement('div');
        kicker.className = 'content-kicker';
        kicker.textContent = PAGE_LABELS.need2know;

        let headlineText = '';
        let bodyText = '';
        let linkHref = '';

        if (typeof entry.headline === 'string' && typeof entry.text === 'string') {
            headlineText = stripCitations(entry.headline);
            bodyText = stripCitations(entry.text);
            linkHref = typeof entry.source === 'string' ? entry.source : '';
        } else if (typeof entry.titel === 'string' && typeof entry.description === 'string') {
            headlineText = entry.titel.trim();
            bodyText = entry.description.trim();
            linkHref = typeof entry.link === 'string' ? entry.link : '';
        } else {
            renderDefault(entry, 'need2know');
            return;
        }

        const headline = document.createElement('div');
        headline.className = 'content-headline';
        headline.textContent = headlineText;

        const body = document.createElement('p');
        body.className = 'content-body';
        body.textContent = bodyText;

        card.append(kicker, headline, body);

        setStoredIndex(STORAGE_KEYS.needToKnowIndex, needToKnowIndex);

        if (linkHref) {
            const link = document.createElement('a');
            link.className = 'need-link';
            link.href = linkHref;
            link.textContent = 'Mehr erfahren';
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            card.appendChild(link);
        }

        const reload = createReloadButton('Neuen Beitrag laden', () => {
            needToKnowIndex = getNextIndex(needToKnowCache.length, needToKnowIndex);
            showNeedToKnowEntry();
            mainContent.classList.add('active');
        });

        const stack = document.createElement('div');
        stack.className = 'content-stack';
        stack.append(card, reload);
        mainContent.replaceChildren(stack);
    };

    // Render: Historische Ereignisse am heutigen Datum
    const renderEvents = (data) => {
        const todayKey = getTodayKey();
        const now = new Date();
        const entry = Array.isArray(data)
            ? data.find((item) => item.datum === todayKey)
            : null;

        const card = document.createElement('div');
        card.className = 'content-card';

        const kicker = document.createElement('div');
        kicker.className = 'content-kicker';
        kicker.textContent = PAGE_LABELS.events;

        const headline = document.createElement('div');
        headline.className = 'content-headline';
        headline.textContent = `Was geschah am, ${formatFullDate(now)}`;

        card.append(kicker, headline);

        if (!entry || !Array.isArray(entry.ereignisse) || entry.ereignisse.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'content-body';
            empty.textContent = 'Keine Ereignisse für heute.';
            card.appendChild(empty);
            mainContent.replaceChildren(card);
            return;
        }

        const list = document.createElement('div');
        list.className = 'events-list';

        entry.ereignisse.forEach((event) => {
            const item = document.createElement('div');
            item.className = 'event-item';

            const year = document.createElement('div');
            year.className = 'event-year';
            year.textContent = event.jahr;

            const desc = document.createElement('div');
            desc.className = 'event-description';
            desc.textContent = event.beschreibung;

            item.append(year, desc);
            list.appendChild(item);
        });

        card.appendChild(list);
        mainContent.replaceChildren(card);
    };

    // Render: Zitat des Tages (Index über Tag des Jahres)
    const renderFavQuotes = (data) => {
        if (!Array.isArray(data) || data.length === 0) {
            renderDefault(data, 'favquotes');
            return;
        }

        favQuotesCache = data;
        favQuoteIndex = getDailyIndex(data.length);
        showFavQuoteEntry();
    };

    const showFavQuoteEntry = () => {
        if (!Array.isArray(favQuotesCache) || favQuotesCache.length === 0) {
            renderDefault(favQuotesCache, 'favquotes');
            return;
        }

        const safeIndex = Math.min(Math.max(favQuoteIndex ?? 0, 0), favQuotesCache.length - 1);
        favQuoteIndex = safeIndex;
        const quote = favQuotesCache[safeIndex];
        const getFavQuoteSignature = (entry) => {
            const text = normalizeQuoteText(entry?.quote) || '';
            const person = typeof entry?.person === 'string' ? entry.person : '';
            return `${text}::${person}`.trim();
        };

        const card = document.createElement('div');
        card.className = 'content-card';

        const kicker = document.createElement('div');
        kicker.className = 'content-kicker';
        kicker.textContent = PAGE_LABELS.favquotes;

        const text = document.createElement('div');
        text.className = 'quote-text';
        const textEm = document.createElement('em');
        const normalizedQuote = normalizeQuoteText(quote?.quote) || 'Kein Zitat verfügbar.';
        textEm.textContent = `„${normalizedQuote}“`;
        text.appendChild(textEm);

        const person = document.createElement('div');
        person.className = 'quote-person';
        person.textContent = quote?.person || 'Unbekannt';
        if (quote?.source) {
            const link = document.createElement('a');
            link.href = quote.source;
            link.textContent = '*';
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.className = 'quote-source-link';
            person.appendChild(link);
        }

        const reload = createReloadButton('Neues Zitat laden', () => {
            favQuoteIndex = getNextDistinctIndex(favQuotesCache, favQuoteIndex, getFavQuoteSignature);
            showFavQuoteEntry();
            mainContent.classList.add('active');
        });

        card.append(kicker, text, person);

        const stack = document.createElement('div');
        stack.className = 'content-stack';
        stack.append(card, reload);

        mainContent.replaceChildren(stack);
    };

    // Fallback für unbekannte/defekte Datensätze
    const renderDefault = (data, pageName) => {
        const content = typeof data?.content === 'string'
            ? data.content
            : 'Inhalt konnte nicht geladen werden.';
        const card = buildCard({
            kicker: PAGE_LABELS[pageName] || 'Daily Facts 4U',
            body: content
        });
        mainContent.replaceChildren(card);
    };

    // Intro zeigt App-Branding und springt danach zu "holiday"
    const showIntroThenHoliday = () => {
        if (introTimer) {
            return;
        }

        clearQuoteTimer();
        const introHeadline = document.createElement('div');
        introHeadline.className = 'intro-headline';
        introHeadline.textContent = 'Daily Facts 4U';

        mainContent.replaceChildren(introHeadline);
        mainContent.classList.add('active');

        introTimer = setTimeout(() => {
            introTimer = null;
            if (window.location.hash !== '#holiday') {
                window.location.hash = 'holiday';
            } else {
                loadContent('holiday');
            }
        }, INTRO_DURATION_MS);
    };

    // Lädt JSON-Dateien und routet zu passenden Render-Funktionen
    const loadContent = async (pageName) => {
        const filePath = `data/${pageName}.json`;
        try {
            clearQuoteTimer();
            clearIntroTimer();
            mainContent.classList.remove('active');
            await new Promise(resolve => setTimeout(resolve, 300));

            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`Could not load ${pageName}. Status: ${response.status}`);
            }
            const data = await response.json();

            if (pageName === 'holiday') {
                renderHoliday(data);
            } else if (pageName === 'hackerquotes') {
                renderHackerQuote(data);
            } else if (pageName === 'events') {
                renderEvents(data);
            } else if (pageName === 'need2know') {
                renderNeedToKnow(data);
            } else if (pageName === 'favquotes') {
                renderFavQuotes(data);
            } else if (pageName === 'facts') {
                renderFacts(data);
            } else {
                renderDefault(data, pageName);
            }

            if (contentArea) {
                contentArea.scrollTop = 0;
            }
            mainContent.classList.add('active');
        } catch (error) {
            console.error('Error loading content:', error);

            // Bei Holiday-Fehlern zunächst das Intro erneut zeigen
            if (pageName === 'holiday') {
                fallbackAttempts += 1;
            }

            if (fallbackAttempts < 2) {
                showIntroThenHoliday();
            } else {
                const card = buildCard({
                    kicker: 'Daily Facts 4U',
                    headline: 'Inhalte fehlen gerade',
                    body: 'Bitte Seite neu laden oder später erneut versuchen.'
                });
                mainContent.replaceChildren(card);
                mainContent.classList.add('active');
            }
        }
    };

    // Hash-Routing: #holiday, #facts, #events, ...
    const handleHashChange = () => {
        const hash = window.location.hash.substring(1);
        if (!hash) {
            showIntroThenHoliday();
            return;
        }
        fallbackAttempts = 0;
        loadContent(hash);
    };

    window.addEventListener('hashchange', handleHashChange);

    handleHashChange();
});
