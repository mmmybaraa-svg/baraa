(() => {
  'use strict';

  const D = window.DARB;
  const mount = document.querySelector('#passengerPointsMount');
  if (!mount) return;

  let settings = { enabled: false, minimumPoints: 10, maximumPoints: 200, maximumPointsPerHour: 200 };
  let rewardPoints = 10;
  let settingsLoaded = false;
  let updateTransferSettings = () => {};

  function showError(target, error) {
    if (!target) return;
    target.textContent = error.message || 'تعذر تحميل البيانات.';
    target.classList.add('notice', 'error');
  }

  function formatPoints(value) {
    return `${Number(value || 0).toLocaleString('ar-JO')} نقطة`;
  }

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('ar-JO', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  }

  function renderBalance(wallet) {
    rewardPoints = wallet.pointsPerEligibleTrip || rewardPoints;
    if (settingsLoaded) renderPolicy();
    mount.querySelectorAll('[data-passenger-points-balance]').forEach((node) => {
      node.textContent = formatPoints(wallet.balance);
    });
  }

  function renderPolicy() {
    const node = mount.querySelector('[data-passenger-points-policy]');
    if (!node) return;
    node.textContent = settings.enabled
      ? `تُضاف ${Number(rewardPoints).toLocaleString('ar-JO')} نقاط بعد تأكيد إكمال الرحلة من الطرفين. التحويل من ${settings.minimumPoints} إلى ${settings.maximumPoints} نقطة، وبمضاعفات 10. الحد خلال الساعة ${settings.maximumPointsPerHour} نقطة.`
      : 'تأكيد إكمال الرحلات متاح، لكن تحويل النقاط غير مفعّل حاليًا.';
  }

  function renderPointHistory(wallet, transfers) {
    const target = mount.querySelector('[data-passenger-point-history]');
    if (!target) return;

    const entries = [
      ...(wallet.transactions || [])
        .filter((item) => item.transactionType !== 'transfer_out')
        .map((item) => ({
          points: item.pointsChanged,
          label: item.reason || 'مكافأة رحلة مكتملة',
          date: item.transactionAt
        })),
      ...(transfers.items || [])
        .filter((item) => item.direction === 'sent')
        .map((item) => ({
          points: -Number(item.points),
          label: `تحويل إلى ${item.counterparty?.fullName || item.counterparty?.username || 'سائق'}`,
          date: item.createdAt
        }))
    ].sort((a, b) => String(b.date).localeCompare(String(a.date)));

    target.innerHTML = entries.length
      ? entries.map((item) => `
          <article class="passenger-point-entry">
            <strong>${item.points > 0 ? '+' : ''}${Number(item.points).toLocaleString('ar-JO')} نقطة</strong>
            <span>${D.escape(item.label)}</span>
            <time datetime="${D.escape(item.date)}">${D.escape(formatDate(item.date))}</time>
          </article>`).join('')
      : '<p class="empty">لا توجد حركات نقاط حتى الآن.</p>';
  }

  function renderCompletions(items) {
    const list = mount.querySelector('[data-passenger-completion-list]');
    if (!list) return;
    const outstanding = items.filter((item) => !item.completedAt);
    list.innerHTML = outstanding.length
      ? outstanding.map((item) => {
          const trip = item.trip || {};
          const route = `${D.escape(trip.startLocality || '—')} ← ${D.escape(trip.destinationUniversity || '—')}`;
          const date = `${D.escape(formatDate(trip.departureDate))} · ${D.escape(trip.departureTime || '—')}`;
          const waiting = item.passengerConfirmed
            ? '<p class="muted">تم تسجيل تأكيدك؛ بانتظار تأكيد السائق.</p>'
            : item.driverConfirmed
              ? '<p class="muted">أكد السائق إكمال الرحلة؛ أكدها لإضافة المكافأة.</p>'
              : '<p class="muted">بعد تأكيدك، تُضاف المكافأة عند تأكيد السائق أيضًا.</p>';
          const confirmationButton = item.passengerConfirmed
            ? ''
            : `<button class="btn btn-outline" type="button" data-confirm-booking-completion="${D.escape(item.bookingId)}">تأكيد إكمال الرحلة</button>`;
          return `<article class="passenger-completion">
            <strong>${route}</strong>
            <p class="muted">${date}</p>
            ${waiting}
            ${confirmationButton}
          </article>`;
        }).join('')
      : '<p class="empty">لا توجد رحلات بانتظار تأكيدك.</p>';
  }

  function renderSearchResults(drivers) {
    const results = mount.querySelector('[data-driver-search-results]');
    const transferForm = mount.querySelector('[data-points-transfer-form]');
    if (!results || !transferForm) return;
    const list = Array.isArray(drivers) ? drivers : [];
    results.innerHTML = list.length
      ? list.map((driver) => `
          <button class="passenger-driver-result" type="button" data-select-driver="${D.escape(driver.id)}">
            <strong>${D.escape(driver.fullName || driver.username || 'سائق')}</strong>
            <span>${driver.username ? `@${D.escape(driver.username)}` : ''}</span>
          </button>`).join('')
      : '<p class="empty">لم يتم العثور على سائق.</p>';
  }

  function newIdempotencyKey() {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  async function loadBalance() {
    const wallet = await window.DARB_API.getPassengerPoints();
    renderBalance(wallet);
    return wallet;
  }

  async function loadHistory(wallet) {
    if (!mount.querySelector('[data-passenger-point-history]')) return;
    const transfers = await window.DARB_API.getPointTransfers();
    renderPointHistory(wallet, transfers);
  }

  async function loadCompletions() {
    if (!mount.querySelector('[data-passenger-completion-list]')) return;
    const completions = await window.DARB_API.getBookingCompletions();
    renderCompletions(completions.items || []);
  }

  function setupDriverSearch() {
    const form = mount.querySelector('[data-driver-search-form]');
    const results = mount.querySelector('[data-driver-search-results]');
    const transferForm = mount.querySelector('[data-points-transfer-form]');
    if (!form || !results || !transferForm) return;

    const queryInput = form.querySelector('[name="query"]');
    const amountInput = transferForm.querySelector('[name="points"]');
    const transferButton = transferForm.querySelector('[type="submit"]');
    updateTransferSettings = () => {
      amountInput.min = String(Math.max(10, settings.minimumPoints));
      amountInput.max = String(settings.maximumPoints);
      transferButton.disabled = !settings.enabled;
    };
    updateTransferSettings();
    const driverById = new Map();
    let selectedDriver = null;

    function clearSelection() {
      selectedDriver = null;
      transferForm.classList.add('hidden');
      transferForm.reset();
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const query = queryInput.value.trim();
      results.replaceChildren();
      results.classList.remove('notice', 'error');
      clearSelection();
      if (query.length < 2) {
        results.textContent = 'أدخل حرفين على الأقل للبحث.';
        results.classList.add('notice', 'error');
        return;
      }
      const button = form.querySelector('[type="submit"]');
      button.disabled = true;
      try {
        const result = await window.DARB_API.searchTransferDrivers(query);
        driverById.clear();
        (result.items || []).forEach((driver) => driverById.set(driver.id, driver));
        renderSearchResults(result.items || []);
      } catch (error) {
        showError(results, error);
      } finally {
        button.disabled = false;
      }
    });

    results.addEventListener('click', (event) => {
      const button = event.target.closest('[data-select-driver]');
      if (!button) return;
      selectedDriver = driverById.get(button.dataset.selectDriver);
      if (!selectedDriver) return;
      transferForm.querySelector('[data-transfer-recipient]').textContent =
        `تحويل إلى ${selectedDriver.fullName || selectedDriver.username}`;
      transferForm.classList.remove('hidden');
      results.classList.remove('notice', 'error');
    });

    mount.querySelector('[data-clear-recipient]')?.addEventListener('click', clearSelection);
    transferForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const points = Number(amountInput.value);
      if (!selectedDriver || !Number.isInteger(points) || points < Math.max(10, settings.minimumPoints)
        || points > settings.maximumPoints || points % 10 !== 0
        || !transferForm.querySelector('[name="confirm"]').checked || !settings.enabled) {
        showError(results, new Error('تحقق من اختيار السائق وتأكيد التحويل وإدخال نقاط من مضاعفات 10 ضمن الحد المسموح.'));
        return;
      }
      const button = transferButton;
      button.disabled = true;
      try {
        await window.DARB_API.transferPoints({
          driverId: selectedDriver.id,
          points,
          idempotencyKey: newIdempotencyKey()
        });
        D.toast('تم تحويل النقاط بنجاح.', 'success');
        clearSelection();
        await loadBalance();
      } catch (error) {
        showError(results, error);
      } finally {
        button.disabled = false;
      }
    });
  }

  mount.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-confirm-booking-completion]');
    if (!button) return;
    button.disabled = true;
    try {
      const result = await window.DARB_API.confirmBookingCompletion(button.dataset.confirmBookingCompletion);
      D.toast(result.completed
        ? `اكتملت الرحلة بعد تأكيد الطرفين. أُضيفت ${result.pointsAwarded} نقطة إلى رصيدك.`
        : 'سُجل تأكيدك. ستُضاف النقاط بعد تأكيد السائق أيضًا.',
      'success');
      const wallet = await loadBalance();
      await Promise.all([loadCompletions(), loadHistory(wallet)]);
    } catch (error) {
      D.toast(error.message || 'تعذر تأكيد إكمال الرحلة.', 'error');
      button.disabled = false;
    }
  });

  async function render() {
    const user = D.requireAuth('passenger');
    if (!user) return;
    setupDriverSearch();
    const tasks = [];
    if (mount.querySelector('[data-passenger-points-policy], [data-points-transfer-form]')) {
      tasks.push(window.DARB_API.getPointTransferSettings().then((result) => {
        settings = result;
        settingsLoaded = true;
        updateTransferSettings();
        renderPolicy();
      }).catch((error) => {
        showError(mount.querySelector('[data-passenger-points-policy]'), error);
      }));
    }
    const walletPromise = window.DARB_API.getPassengerPoints();
    tasks.push(walletPromise.then(renderBalance).catch((error) => {
      showError(mount.querySelector('[data-passenger-points-balance]')?.parentElement, error);
    }));
    if (mount.querySelector('[data-passenger-completion-list]')) {
      tasks.push(loadCompletions().catch((error) => {
        showError(mount.querySelector('[data-passenger-completion-list]'), error);
      }));
    }
    if (mount.querySelector('[data-passenger-point-history]')) {
      tasks.push(Promise.all([walletPromise, window.DARB_API.getPointTransfers()])
        .then(([wallet, transfers]) => renderPointHistory(wallet, transfers))
        .catch((error) => showError(mount.querySelector('[data-passenger-point-history]'), error)));
    }
    await Promise.all(tasks);
  }

  document.addEventListener('DOMContentLoaded', () => D.ready.then(render));
})();
