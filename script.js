(function () {
  'use strict';

  const KEYS = Object.freeze({
    users: 'darb_users',
    current: 'darb_current_user',
    session: 'darb_session',
    token: 'darb_access_token',
    trips: 'darb_trips',
    bookings: 'darb_bookings',
    passengerLocation: 'darb_passenger_location',
    passengerArea: 'darb_passenger_area',
    driverLocation: 'darb_driver_location',
    tracking: 'darb_tracking_state',
    notifications: 'darb_notifications',
    follows: 'darb_follows',
    ratings: 'darb_ratings',
    conversations: 'darb_conversations',
    messages: 'darb_messages'
  });

  const D = {
    KEYS,
    STORAGE: {
      get(key, fallback = []) {
        try {
          const value = localStorage.getItem(key);
          return value === null ? fallback : JSON.parse(value);
        } catch {
          return fallback;
        }
      },
      set(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
        window.dispatchEvent(new CustomEvent('darb:data-updated', { detail: { key } }));
      },
      remove(key) {
        localStorage.removeItem(key);
      }
    },
    getUser() { return this.STORAGE.get(KEYS.current, null); },
    setUser(user) {
      if (!user) {
        this.STORAGE.remove(KEYS.current);
        return;
      }
      const safe = { ...user };
      delete safe.password;
      delete safe.passwordHash;
      delete safe.passwordSalt;
      this.STORAGE.set(KEYS.current, safe);
    },
    users() { return this.STORAGE.get(KEYS.users, []); },
    trips() { return this.STORAGE.get(KEYS.trips, []); },
    bookings() { return this.STORAGE.get(KEYS.bookings, []); },
    uid() { return `u_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`; },
    tid() { return `t_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`; },
    bid() { return `b_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`; },
    toast(message, type = 'info') {
      let item = document.querySelector('.toast');
      if (!item) {
        item = document.createElement('div');
        item.className = 'toast';
        Object.assign(item.style, {
          position: 'fixed', bottom: '18px', right: '18px', zIndex: 9999,
          maxWidth: '360px', padding: '13px 16px', borderRadius: '12px',
          background: '#0f172a', color: '#fff', boxShadow: '0 12px 30px rgba(15,23,42,.24)'
        });
        document.body.appendChild(item);
      }
      item.textContent = message;
      item.style.background = type === 'error' ? '#e11d48' : type === 'success' ? '#0f766e' : '#0f172a';
      clearTimeout(item._timer);
      item._timer = setTimeout(() => item.remove(), 3500);
    },
    escape(value) {
      return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
      })[character]);
    },
    formatPrice(value) { return `${Number(value || 0).toFixed(2)} ${this.isEnglish() ? 'JOD' : 'د.أ'}`; },
    formatDate(value) {
      if (!value) return '—';
      return new Intl.DateTimeFormat(this.isEnglish() ? 'en-GB' : 'ar-JO', { year: 'numeric', month: 'long', day: 'numeric' })
        .format(new Date(`${value}T00:00:00`));
    },
    isEnglish() { return document.documentElement.lang === 'en'; },
    normalizePhone(value) {
      let phone = String(value || '').replace(/[^\d+]/g, '');
      if (phone.startsWith('00962')) phone = `+962${phone.slice(5)}`;
      if (phone.startsWith('07')) phone = `+962${phone.slice(1)}`;
      if (phone.startsWith('962') && !phone.startsWith('+')) phone = `+${phone}`;
      return phone;
    },
    validPhone(value) { return /^(\+9627\d{8}|07\d{8})$/.test(this.normalizePhone(value)); },
    validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '')); },
    redirect(path) { location.href = path; },
    requireAuth(role) {
      const user = this.getUser();
      if (!user) {
        const next = encodeURIComponent(location.pathname.split('/').pop() + location.search);
        location.href = `login.html?next=${next}`;
        return null;
      }
      if (role && user.role !== role) {
        location.href = user.role === 'driver' ? 'driver.html' : 'dashboard.html';
        return null;
      }
      return user;
    },
    logout() {
      const finish = () => { location.href = 'login.html'; };
      if (window.DARB_API) {
        return window.DARB_API.signOut().then(finish).catch((error) => {
          this.toast('تم إنهاء الجلسة على هذا الجهاز، لكن تعذر تأكيد الطلب لدى الخادم. سيتم تحويلك إلى تسجيل الدخول.', 'error');
          console.error('Server sign-out request failed; local credentials were cleared:', error);
          window.setTimeout(finish, 1800);
        });
      }
      else {
        this.STORAGE.remove(KEYS.current);
        this.STORAGE.remove(KEYS.session);
        this.STORAGE.remove(KEYS.token);
        [
          KEYS.trips, KEYS.bookings, KEYS.users, KEYS.passengerLocation,
          KEYS.passengerArea, KEYS.driverLocation, KEYS.tracking, KEYS.notifications,
          KEYS.follows, KEYS.conversations, KEYS.messages
        ].forEach((key) => this.STORAGE.remove(key));
        finish();
      }
    }
  };

  const appearanceKey = 'darb_appearance_preferences';
  const readAppearance = () => {
    try {
      const value = JSON.parse(localStorage.getItem(appearanceKey) || '{}');
      return {
        theme: ['light', 'dark', 'system'].includes(value.theme) ? value.theme : 'light',
        fontSize: ['small', 'medium', 'large'].includes(value.fontSize) ? value.fontSize : 'medium',
        reducedMotion: value.reducedMotion === true,
        highContrast: value.highContrast === true
      };
    } catch {
      return { theme: 'light', fontSize: 'medium', reducedMotion: false, highContrast: false };
    }
  };
  const applyAppearance = () => {
    const preferences = readAppearance();
    const dark = preferences.theme === 'dark'
      || (preferences.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.dataset.fontSize = preferences.fontSize;
    document.documentElement.dataset.reducedMotion = String(preferences.reducedMotion);
    document.documentElement.dataset.highContrast = String(preferences.highContrast);
  };
  applyAppearance();
  window.addEventListener('darb:appearance-updated', applyAppearance);
  window.addEventListener('storage', (event) => {
    if (event.key === appearanceKey) applyAppearance();
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    if (readAppearance().theme === 'system') applyAppearance();
  });

  window.DARB = D;
  D.apiEnabled = true;
  D.apiAuthFormsReady = false;
  document.addEventListener('submit', (event) => {
    if (D.apiAuthFormsReady || !['loginForm', 'registerForm'].includes(event.target?.id)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    D.toast('الخادم غير متاح. لا يمكن تسجيل الدخول أو إنشاء حساب دون الاتصال بـ SQL Server.', 'error');
  }, true);
  D.ready = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'js/api.js';
    script.onload = () => resolve(window.DARB_API.start(D));
    script.onerror = () => {
      console.error('Failed to load SQL API client.');
      D.toast('تعذر تحميل واجهة الاتصال بالخادم.', 'error');
      resolve();
    };
    document.head.appendChild(script);
  });

  function nav() {
    const user = D.getUser();
    document.querySelectorAll('[data-auth-only]').forEach((item) => item.classList.toggle('hidden', !user));
    document.querySelectorAll('[data-role="passenger"]').forEach((item) => item.classList.toggle('hidden', !user || user.role !== 'passenger'));
    document.querySelectorAll('[data-role="driver"]').forEach((item) => item.classList.toggle('hidden', !user || user.role !== 'driver'));
    document.querySelectorAll('[data-guest]').forEach((item) => item.classList.toggle('hidden', !!user));
    const homeToggle = document.querySelector('[data-home-menu-toggle]');
    const homeMenu = document.querySelector('[data-home-menu]');
    if (homeToggle && homeMenu) {
      homeToggle.onclick = () => {
        const expanded = homeToggle.getAttribute('aria-expanded') === 'true';
        homeToggle.setAttribute('aria-expanded', String(!expanded));
        homeMenu.classList.toggle('hidden', expanded);
      };
    }
    const menu = document.querySelector('.menu-btn');
    const links = document.querySelector('.nav-links');
    if (menu && links) {
      links.id = 'siteNavLinks';
      menu.setAttribute('aria-controls', links.id);
      const syncDrawer = (open = links.classList.contains('open')) => {
        const mobile = window.matchMedia('(max-width: 960px)').matches;
        const expanded = mobile && open;
        links.classList.toggle('open', expanded);
        menu.setAttribute('aria-expanded', String(expanded));
        links.setAttribute('aria-hidden', String(mobile && !expanded));
        links.toggleAttribute('inert', mobile && !expanded);
      };
      menu.onclick = () => syncDrawer(!links.classList.contains('open'));
      links.onkeydown = (event) => {
        if (event.key === 'Escape' && links.classList.contains('open')) {
          syncDrawer(false);
          menu.focus();
        }
      };
      links.onclick = (event) => {
        if (event.target.closest('a') && window.matchMedia('(max-width: 960px)').matches)
          syncDrawer(false);
      };
      if (!menu.dataset.drawerResizeReady) {
        window.addEventListener('resize', () => syncDrawer(false), { passive: true });
        menu.dataset.drawerResizeReady = 'true';
      }
      syncDrawer();
    }
  }

  function protect() {
    const page = document.body.dataset.page;
    const user = D.getUser();
    if (page === 'dashboard' && (!user || user.role !== 'passenger')) {
      location.href = user ? 'driver.html' : 'login.html?next=dashboard.html';
    } else if (page === 'profile' && !user) {
      location.href = 'login.html?next=profile.html';
    } else if (page === 'driver' && (!user || user.role !== 'driver')) {
      location.href = user ? 'dashboard.html' : 'login.html?next=driver.html';
    } else if (['driver-balance', 'driver-completions', 'driver-point-history', 'driver-point-store'].includes(page)
      && (!user || user.role !== 'driver')) {
      const next = encodeURIComponent(`${location.pathname.split('/').pop()}${location.search}`);
      location.href = user ? 'dashboard.html' : `login.html?next=${next}`;
    } else if (['passenger-balance', 'passenger-transfers', 'passenger-transfer-history'].includes(page)
      && (!user || user.role !== 'passenger')) {
      const next = encodeURIComponent(`${location.pathname.split('/').pop()}${location.search}`);
      location.href = user ? 'driver.html' : `login.html?next=${next}`;
    } else if ((page === 'settings' || page === 'chat') && !user) {
      const next = encodeURIComponent(`${location.pathname.split('/').pop()}${location.search}`);
      location.href = `login.html?next=${next}`;
    }
  }

  function initializeUserSearch() {
    const links = document.querySelector('.nav-links');
    if (!links || links.querySelector('[data-user-search]')) return;

    const search = document.createElement('div');
    search.className = 'nav-search hidden';
    search.dataset.authOnly = '';
    search.dataset.userSearch = '';
    search.innerHTML = `
      <form class="nav-search-form" role="search">
        <label class="sr-only" for="userSearchInput">ابحث عن مستخدم</label>
        <span class="nav-search-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false"><circle cx="10.8" cy="10.8" r="6.8"></circle><path d="m16 16 4.5 4.5"></path></svg>
        </span>
        <input id="userSearchInput" type="search" autocomplete="off" placeholder="ابحث عن اسم أو اسم مستخدم..." aria-label="ابحث عن اسم أو اسم مستخدم" aria-controls="userSearchResults" aria-expanded="false">
        <button class="nav-search-clear hidden" type="button" aria-label="مسح البحث">×</button>
      </form>
      <section class="nav-search-dropdown hidden" aria-label="نتائج البحث">
        <p class="nav-search-state" data-user-search-state role="status" aria-live="polite"></p>
        <div class="nav-search-results" id="userSearchResults"></div>
      </section>`;
    links.appendChild(search);

    const form = search.querySelector('.nav-search-form');
    const input = search.querySelector('#userSearchInput');
    const clear = search.querySelector('.nav-search-clear');
    const dropdown = search.querySelector('.nav-search-dropdown');
    const state = search.querySelector('[data-user-search-state]');
    const results = search.querySelector('.nav-search-results');
    let debounceTimer;
    let activeController;
    let requestVersion = 0;

    const closeResults = () => {
      dropdown.classList.add('hidden');
      input.setAttribute('aria-expanded', 'false');
    };
    const showState = (message, loading = false) => {
      state.textContent = message;
      state.classList.toggle('is-loading', loading);
      results.replaceChildren();
      dropdown.classList.remove('hidden');
      input.setAttribute('aria-expanded', 'true');
    };
    const renderResults = (users) => {
      results.innerHTML = users.map((user) => {
        const name = D.escape(user.fullName || 'مستخدم دَرْب');
        const username = D.escape(user.username || '');
        const detail = D.escape(user.university || user.governorate || user.bio || '');
        const photo = typeof user.profilePhoto === 'string'
          && (/^https:\/\/[^\s]+$/i.test(user.profilePhoto) || /^data:image\/(?:jpeg|png|webp);base64,/i.test(user.profilePhoto))
          ? `<img src="${D.escape(user.profilePhoto)}" alt="" loading="lazy">`
          : `<span aria-hidden="true">${D.escape(user.fullName?.trim().charAt(0) || 'د')}</span>`;
        const relationshipBlocked = user.blockedByMe || user.blockedMe;
        return `<article class="nav-search-result">
          <a class="nav-search-person" href="profile.html?user=${encodeURIComponent(user.id)}">
            <span class="nav-search-avatar">${photo}</span>
            <span class="nav-search-person-text"><strong>${name}</strong><span dir="ltr">@${username}</span>${detail ? `<small>${detail}</small>` : ''}</span>
          </a>
          <button class="nav-search-follow ${user.following ? 'is-following' : ''} ${relationshipBlocked ? 'is-blocked' : ''}" type="button" data-follow-user="${D.escape(user.id)}" aria-pressed="${Boolean(user.following)}" ${relationshipBlocked ? 'disabled title="المتابعة غير متاحة بسبب وجود حظر."' : ''}>${relationshipBlocked ? 'المتابعة غير متاحة' : user.following ? 'إلغاء المتابعة' : 'متابعة'}</button>
        </article>`;
      }).join('');
      state.textContent = users.length ? '' : 'لم نعثر على مستخدمين يطابقون بحثك.';
      state.classList.remove('is-loading');
      dropdown.classList.remove('hidden');
      input.setAttribute('aria-expanded', 'true');
    };

    form.addEventListener('submit', (event) => event.preventDefault());
    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      activeController?.abort();
      const version = ++requestVersion;
      const query = input.value.trim();
      clear.classList.toggle('hidden', !query);
      results.replaceChildren();
      state.textContent = '';
      state.classList.remove('is-loading');
      closeResults();
      if (!query) {
        return;
      }
      debounceTimer = setTimeout(async () => {
        const controller = new AbortController();
        activeController = controller;
        showState('جارٍ البحث...', true);
        try {
          const response = await window.DARB_API.searchUsers(query, 1, 10, controller.signal);
          if (version === requestVersion && !controller.signal.aborted) renderResults(response.items || []);
        } catch (error) {
          if (error.name === 'AbortError' || version !== requestVersion) return;
          showState(error.status === 401
            ? 'انتهت جلسة الدخول. سجّل الدخول مجددًا.'
            : 'تعذر البحث الآن. تحقق من اتصالك بالخادم وحاول مرة أخرى.');
        }
      }, 300);
    });
    clear.addEventListener('click', () => {
      clearTimeout(debounceTimer);
      activeController?.abort();
      requestVersion++;
      input.value = '';
      clear.classList.add('hidden');
      closeResults();
      results.replaceChildren();
      input.focus();
    });
    search.addEventListener('click', async (event) => {
      const button = event.target.closest?.('[data-follow-user]');
      if (!button) return;
      const id = button.dataset.followUser;
      const following = button.getAttribute('aria-pressed') !== 'true';
      button.disabled = true;
      try {
        await window.DARB_API.toggleFollow(id, following);
        button.setAttribute('aria-pressed', String(following));
        button.classList.toggle('is-following', following);
        button.textContent = following ? 'إلغاء المتابعة' : 'متابعة';
      } catch (error) {
        D.toast(error.message || 'تعذر تحديث المتابعة. حاول مرة أخرى.', 'error');
      } finally {
        button.disabled = false;
      }
    });
    search.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeResults();
    });
    window.addEventListener('darb:relationship-updated', (event) => {
      if (event.detail?.userId === undefined || !input.value.trim()) return;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    window.addEventListener('darb:relationship-synced', (event) => {
      if (event.detail?.userId === undefined || !input.value.trim()) return;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    document.addEventListener('click', (event) => {
      if (!search.contains(event.target)) closeResults();
    });
  }

  function initializeMessaging() {
    const links = document.querySelector('.nav-links');
    if (!links || document.querySelector('[data-nav-messaging]')) return;
    // Keep the messaging centre out of .nav-links: that element is the sidebar's
    // scroll container (overflow-y: auto), which also clips horizontal overflow and
    // would cut off the popover panels. Appending to .nav-inner lets the panels
    // escape the clipped scroll area.
    const navInner = links.closest('.nav-inner') || links.parentElement;

    const messaging = document.createElement('div');
    messaging.className = 'nav-message-center hidden';
    messaging.dataset.authOnly = '';
    messaging.dataset.navMessaging = '';
    messaging.innerHTML = `
      <div class="nav-message-group">
        <button class="nav-icon-button" type="button" data-nav-panel-toggle="messages"
          aria-label="الرسائل" aria-haspopup="true" aria-expanded="false" aria-controls="navMessagesPanel">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H7l-4 2v-5.2A7.5 7.5 0 1 1 20 11.5Z"></path>
            <path d="M8 10h8M8 14h5"></path>
          </svg>
          <span class="nav-icon-count hidden" data-nav-message-count aria-label="رسائل غير مقروءة"></span>
        </button>
        <section class="nav-popover hidden" id="navMessagesPanel" aria-label="أحدث المحادثات">
          <header class="nav-popover-header">
            <strong>الرسائل</strong>
            <a href="chat.html">عرض كل المحادثات</a>
          </header>
          <p class="nav-popover-state" data-nav-message-state role="status" aria-live="polite">جارٍ تحميل المحادثات...</p>
          <div class="nav-conversation-list" data-nav-conversation-list></div>
        </section>
      </div>
      <div class="nav-message-group">
        <button class="nav-icon-button" type="button" data-nav-panel-toggle="notifications"
          aria-label="الإشعارات" aria-haspopup="true" aria-expanded="false" aria-controls="navNotificationsPanel">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"></path>
          </svg>
          <span class="nav-icon-count hidden" data-nav-notification-count aria-label="إشعارات غير مقروءة"></span>
        </button>
        <section class="nav-popover nav-notification-popover hidden" id="navNotificationsPanel" aria-label="الإشعارات">
          <header class="nav-popover-header">
            <strong>الإشعارات</strong>
            <div class="nav-notification-controls">
              <button class="nav-notification-action hidden" type="button" data-notifications-mark-all>تحديد الكل كمقروء</button>
              <button class="nav-notification-action nav-notification-delete-all hidden" type="button" data-notifications-delete-all>حذف الكل</button>
            </div>
          </header>
          <p class="nav-popover-state" data-nav-notification-state role="status" aria-live="polite"></p>
          <div class="nav-notification-list" data-nav-notification-list></div>
        </section>
      </div>`;
    (navInner || links).appendChild(messaging);

    const messageButton = messaging.querySelector('[data-nav-panel-toggle="messages"]');
    const notificationButton = messaging.querySelector('[data-nav-panel-toggle="notifications"]');
    const messagePanel = messaging.querySelector('#navMessagesPanel');
    const notificationPanel = messaging.querySelector('#navNotificationsPanel');
    const messageCount = messaging.querySelector('[data-nav-message-count]');
    const notificationCount = messaging.querySelector('[data-nav-notification-count]');
    const messageState = messaging.querySelector('[data-nav-message-state]');
    const notificationState = messaging.querySelector('[data-nav-notification-state]');
    const conversationList = messaging.querySelector('[data-nav-conversation-list]');
    const notificationList = messaging.querySelector('[data-nav-notification-list]');
    const markAllNotificationsButton = messaging.querySelector('[data-notifications-mark-all]');
    const deleteAllNotificationsButton = messaging.querySelector('[data-notifications-delete-all]');
    const isChatPage = document.body.dataset.page === 'chat';
    let conversations = [];
    let refreshPromise = null;
    let hub = null;
    let signalRLoadPromise = null;

    const countText = (count) => count > 99 ? '99+' : String(count);
    const unreadCount = (item) => {
      const count = Number(item?.unreadCount);
      return Number.isFinite(count) ? Math.max(0, count) : 0;
    };
    const safeImage = (value) => typeof value === 'string'
      && (/^https:\/\/[^\s]+$/i.test(value) || /^data:image\/(?:jpeg|png|webp);base64,/i.test(value));
    const formatDate = (value) => {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      const options = date.toDateString() === new Date().toDateString()
        ? { hour: '2-digit', minute: '2-digit' }
        : { day: 'numeric', month: 'short' };
      return new Intl.DateTimeFormat('ar-JO', options).format(date);
    };
    const setCount = (element, count) => {
      const safeCount = Number.isFinite(count) ? Math.max(0, count) : 0;
      element.textContent = safeCount ? countText(safeCount) : '';
      element.classList.toggle('hidden', safeCount === 0);
    };
    const closePanels = () => {
      messagePanel.classList.add('hidden');
      notificationPanel.classList.add('hidden');
      messageButton.setAttribute('aria-expanded', 'false');
      notificationButton.setAttribute('aria-expanded', 'false');
      messaging.querySelectorAll('[data-was-open]').forEach((button) => button.removeAttribute('data-was-open'));
    };
    const togglePanel = (button, panel, otherButton, otherPanel) => {
      const willOpen = panel.classList.contains('hidden');
      closePanels();
      if (!willOpen) return;
      panel.classList.remove('hidden');
      button.setAttribute('aria-expanded', 'true');
      button.dataset.wasOpen = 'true';
      otherPanel.classList.add('hidden');
      otherButton.setAttribute('aria-expanded', 'false');
    };
    const renderConversations = () => {
      const list = Array.isArray(conversations) ? conversations : [];
      const unique = [...new Map(list.filter((item) => item?.id).map((item) => [item.id, item])).values()];
      const unreadTotal = unique.reduce((total, item) => total + unreadCount(item), 0);
      setCount(messageCount, unreadTotal);
      messageButton.setAttribute('aria-label', unreadTotal
        ? `الرسائل، ${countText(unreadTotal)} رسائل غير مقروءة`
        : 'الرسائل');
      conversationList.replaceChildren();
      messageState.textContent = '';
      if (!unique.length) {
        messageState.textContent = 'لا توجد محادثات بعد.';
        return;
      }
      unique.slice(0, 8).forEach((item) => {
        const unread = unreadCount(item);
        const partner = item.partner || {};
        const name = partner.fullName || 'مستخدم دَرْب';
        const username = partner.username ? `@${partner.username}` : '';
        const lastMessage = item.lastMessage?.text
          ? `${item.lastMessage.senderId === D.getUser()?.id ? 'أنت: ' : ''}${item.lastMessage.text}`
          : 'لا توجد رسائل بعد';
        const href = `chat.html?conversation=${encodeURIComponent(item.id)}`;
        const avatar = safeImage(partner.profilePhoto)
          ? `<img src="${D.escape(partner.profilePhoto)}" alt="" loading="lazy">`
          : `<span aria-hidden="true">${D.escape(name.trim().charAt(0) || 'د')}</span>`;
        const row = document.createElement('a');
        row.className = `nav-conversation${unread ? ' has-unread' : ''}`;
        row.href = href;
        row.setAttribute('aria-label', `محادثة ${name}${unread ? `، ${unread} رسائل غير مقروءة` : ''}`);
        row.innerHTML = `
          <span class="nav-conversation-avatar">${avatar}</span>
          <span class="nav-conversation-copy">
            <span class="nav-conversation-heading"><strong>${D.escape(name)}</strong><time datetime="${D.escape(item.lastActivityAt || '')}">${D.escape(formatDate(item.lastActivityAt))}</time></span>
            <span class="nav-conversation-username" dir="ltr">${D.escape(username)}</span>
            <span class="nav-conversation-preview">${D.escape(lastMessage)}</span>
          </span>
          ${unread ? `<span class="nav-conversation-unread">${D.escape(countText(unread))}</span>` : ''}`;
        conversationList.append(row);
      });
      if (unique.length > 8) {
        const more = document.createElement('a');
        more.className = 'nav-conversation-more';
        more.href = 'chat.html';
        more.textContent = 'عرض كل المحادثات';
        conversationList.append(more);
      }
    };
    const renderNotifications = () => {
      const notifications = D.STORAGE.get(D.KEYS.notifications, []);
      const items = Array.isArray(notifications)
        ? [...new Map(notifications.filter((item) => item?.id).map((item) => [item.id, item])).values()]
        : [];
      const unreadTotal = items.filter((item) => !item.read).length;
      setCount(notificationCount, unreadTotal);
      notificationButton.setAttribute('aria-label', unreadTotal
        ? `الإشعارات، ${countText(unreadTotal)} غير مقروءة`
        : 'الإشعارات');
      markAllNotificationsButton.classList.toggle('hidden', unreadTotal === 0);
      deleteAllNotificationsButton.classList.toggle('hidden', items.length === 0);
      notificationList.replaceChildren();
      notificationState.textContent = '';
      if (!items.length) {
        notificationState.textContent = 'لا توجد إشعارات حاليًا.';
        return;
      }
      items.forEach((notification) => {
        const row = document.createElement('article');
        row.className = `nav-notification${notification.read ? '' : ' is-unread'}`;
        row.dataset.notificationId = notification.id;
        const content = document.createElement('div');
        const message = document.createElement('p');
        message.textContent = notification.message || 'إشعار جديد';
        const time = document.createElement('time');
        time.dateTime = notification.createdAt || '';
        time.textContent = formatDate(notification.createdAt);
        content.append(message, time);
        row.append(content);
        const actions = document.createElement('div');
        actions.className = 'nav-notification-item-actions';
        if (!notification.read) {
          const markRead = document.createElement('button');
          markRead.type = 'button';
          markRead.className = 'nav-notification-icon-action';
          markRead.dataset.notificationRead = notification.id;
          markRead.setAttribute('aria-label', 'تحديد الإشعار كمقروء');
          markRead.title = 'تحديد كمقروء';
          markRead.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m5 12 4 4L19 6"></path></svg>';
          actions.append(markRead);
        }
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'nav-notification-icon-action is-delete';
        remove.dataset.notificationDelete = notification.id;
        remove.setAttribute('aria-label', 'حذف الإشعار');
        remove.title = 'حذف الإشعار';
        remove.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3"></path></svg>';
        actions.append(remove);
        row.append(actions);
        notificationList.append(row);
      });
    };
    const receiveConversations = (event) => {
      if (!Array.isArray(event.detail?.conversations)) return;
      conversations = event.detail.conversations;
      renderConversations();
    };
    const refreshConversations = async () => {
      if (refreshPromise) return refreshPromise;
      refreshPromise = window.DARB_API.getConversations()
        .then((items) => {
          conversations = items;
          renderConversations();
        })
        .catch((error) => {
          console.error('Navbar conversations refresh failed:', error);
          messageState.textContent = Array.isArray(conversations) && conversations.length
            ? 'تعذر تحديث المحادثات؛ قد تكون البيانات المعروضة قديمة.'
            : 'تعذر تحميل المحادثات. تحقق من اتصالك وحاول مجددًا.';
        })
        .finally(() => { refreshPromise = null; });
      return refreshPromise;
    };
    const loadSignalR = () => {
      if (window.signalR) return Promise.resolve();
      if (signalRLoadPromise) return signalRLoadPromise;
      signalRLoadPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/microsoft-signalr/8.0.7/signalr.min.js';
        script.onload = () => window.signalR
          ? resolve()
          : reject(new Error('تعذر تهيئة مكتبة الاتصال الفوري.'));
        script.onerror = () => reject(new Error('تعذر تحميل مكتبة الاتصال الفوري.'));
        document.head.append(script);
      });
      return signalRLoadPromise;
    };

    messageButton.addEventListener('click', () => {
      togglePanel(messageButton, messagePanel, notificationButton, notificationPanel);
      if (!messagePanel.classList.contains('hidden')) refreshConversations();
    });
    notificationButton.addEventListener('click', () => {
      togglePanel(notificationButton, notificationPanel, messageButton, messagePanel);
      if (!notificationPanel.classList.contains('hidden')) {
        renderNotifications();
        window.DARB_API.refreshNotifications()
          .then(renderNotifications)
          .catch((error) => {
            console.error('Navbar notifications refresh failed:', error);
            notificationState.textContent = 'تعذر تحديث الإشعارات. تحقق من اتصالك وحاول مجددًا.';
          });
      }
    });
    notificationList.addEventListener('click', async (event) => {
      const readButton = event.target.closest?.('[data-notification-read]');
      const deleteButton = event.target.closest?.('[data-notification-delete]');
      const target = readButton || deleteButton;
      if (!target || target.disabled) return;
      target.disabled = true;
      try {
        if (readButton) {
          await window.DARB_API.markNotificationRead(readButton.dataset.notificationRead);
          D.toast('تم تحديد الإشعار كمقروء.', 'success');
        } else {
          await window.DARB_API.deleteNotification(deleteButton.dataset.notificationDelete);
          D.toast('تم حذف الإشعار.', 'success');
        }
      } catch (error) {
        console.error('Notification action failed:', error);
        D.toast(error.message || 'تعذر تحديث الإشعار. حاول مرة أخرى.', 'error');
        target.disabled = false;
      }
    });
    markAllNotificationsButton.addEventListener('click', async () => {
      markAllNotificationsButton.disabled = true;
      try {
        await window.DARB_API.markAllNotificationsRead();
        D.toast('تم تحديد جميع الإشعارات كمقروءة.', 'success');
      } catch (error) {
        console.error('Mark all notifications read failed:', error);
        D.toast(error.message || 'تعذر تحديث الإشعارات. حاول مرة أخرى.', 'error');
      } finally {
        markAllNotificationsButton.disabled = false;
      }
    });
    deleteAllNotificationsButton.addEventListener('click', async () => {
      const count = notificationList.querySelectorAll('.nav-notification').length;
      if (!window.confirm(`هل أنت متأكد من حذف جميع إشعاراتك (${count})؟ لا يمكن التراجع عن هذا الإجراء.`)) return;
      deleteAllNotificationsButton.disabled = true;
      try {
        await window.DARB_API.deleteAllNotifications();
        D.toast('تم حذف جميع الإشعارات.', 'success');
      } catch (error) {
        console.error('Delete all notifications failed:', error);
        D.toast(error.message || 'تعذر حذف الإشعارات. حاول مرة أخرى.', 'error');
      } finally {
        deleteAllNotificationsButton.disabled = false;
      }
    });
    messaging.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && (!messagePanel.classList.contains('hidden') || !notificationPanel.classList.contains('hidden'))) {
        const activeButton = messagePanel.classList.contains('hidden') ? notificationButton : messageButton;
        closePanels();
        activeButton.focus();
      }
    });
    document.addEventListener('click', (event) => {
      if (!messaging.contains(event.target)) closePanels();
    });
    window.addEventListener('darb:conversations-updated', receiveConversations);
    window.addEventListener('darb:data-updated', (event) => {
      if (event.detail?.key === D.KEYS.notifications) renderNotifications();
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) refreshConversations();
    });
    if (!D.getUser()) return;
    // لا يسمح الخادم باتصال فوري بلا رمز جلسة (401): نمنع الاتصال ونُخرج
    // أي جلسة قديمة تحمل مستخدماً بدون رمز إلى صفحة تسجيل الدخول.
    if (!D.STORAGE.get(D.KEYS.token, '')) {
      D.STORAGE.remove(D.KEYS.session);
      D.setUser(null);
      location.href = 'login.html';
      return;
    }
    renderNotifications();
    refreshConversations();
    const pollingTimer = window.setInterval(refreshConversations, 15000);

    if (!isChatPage) {
      loadSignalR()
        .then(() => window.DARB_API.connectChat(null, (type, update) => {
          if (type === 'conversation') refreshConversations();
          if (type === 'relationship') {
            window.dispatchEvent(new CustomEvent('darb:relationship-synced', { detail: update }));
          }
        }, (state) => {
          messaging.dataset.connection = state;
        }, refreshConversations))
        .then((connection) => { hub = connection; })
        .catch((error) => {
          console.error('Navbar live messaging unavailable; API polling remains enabled:', error);
        });
    }
    window.addEventListener('beforeunload', () => {
      clearInterval(pollingTimer);
      if (hub) hub.stop();
    }, { once: true });
  }

  function renderNav() {
    const host = document.querySelector('[data-site-nav]');
    if (!host) return;
    host.innerHTML = `<nav class="nav"><div class="container nav-inner"><a class="brand" href="index.html"><img class="brand-mark" src="logo.svg" alt="" width="40" height="40" decoding="async"><span>دَرْب</span></a><button class="menu-btn" aria-label="فتح القائمة">☰</button><div class="nav-links"><div class="nav-home-menu"><button class="nav-home-toggle" type="button" aria-expanded="false" aria-controls="homeMenu" data-home-menu-toggle>الرئيسية <span aria-hidden="true">⌄</span></button><div class="nav-home-dropdown hidden" id="homeMenu" data-home-menu><a href="trips.html">الرحلات</a><a href="index.html#how">كيف يعمل</a><a href="index.html#features">المميزات</a></div></div><span data-auth-only data-role="passenger"><a href="dashboard.html">رحلاتي</a></span><span data-auth-only data-role="passenger"><a href="passenger-balance.html">رصيد الطالب</a></span><span data-auth-only data-role="passenger"><a href="passenger-transfers.html">التحويلات</a></span><span data-auth-only data-role="passenger"><a href="passenger-transfer-history.html">سجل التحويلات</a></span><span data-auth-only data-role="driver"><a href="driver.html">رحلاتي</a></span><span data-auth-only><a href="profile.html">الملف الشخصي</a></span><a data-guest href="login.html">تسجيل الدخول</a><a class="btn btn-primary" data-guest href="register.html">إنشاء حساب</a></div></div></nav>`;
    host.querySelector('.nav-links a[href="driver.html"]')?.parentElement.insertAdjacentHTML('afterend',
      '<span data-auth-only data-role="driver"><a href="driver-balance.html">رصيد السائق</a></span><span data-auth-only data-role="driver"><a href="driver-point-store.html">متجر النقاط</a></span><span data-auth-only data-role="driver"><a href="driver-completions.html">تأكيد الرحلات</a></span><span data-auth-only data-role="driver"><a href="driver-point-history.html">سجل النقاط</a></span>');
    const settingsLink = document.createElement('a');
    settingsLink.href = 'settings.html';
    settingsLink.dataset.authOnly = '';
    settingsLink.dataset.settingsLink = '';
    settingsLink.textContent = 'الإعدادات';
    host.querySelector('.nav-links').appendChild(settingsLink);
    initializeUserSearch();
    initializeMessaging();
    nav();
  }

  document.addEventListener('DOMContentLoaded', () => {
    D.ready.then(() => {
      renderNav();
      protect();
      window.addEventListener('pageshow', (event) => {
        if (event.persisted) protect();
      });
      document.querySelectorAll('[data-demo-banner]').forEach((banner) => {
        banner.classList.add('hidden');
        banner.textContent = '';
      });
      window.addEventListener('darb:data-updated', nav);
    });
  });
})();
