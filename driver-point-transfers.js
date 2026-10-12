(function () {
  'use strict';

  const D = window.DARB;
  const mount = document.querySelector('#driverPointTransfersMount');
  if (!mount) return;

  let rendering = false;

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('ar-JO', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  }

  function renderHistory(wallet, transfers, pointTransactions, errors) {
    const entries = [
      ...(pointTransactions || []).map((item) => ({
        points: item.pointsChanged,
        label: item.transactionType === 'publish' ? 'نشر رحلة' : item.reason || 'معاملة نقاط',
        date: item.transactionAt
      })),
      ...(wallet?.transactions || []).filter((item) => item.transactionType !== 'transfer_in').map((item) => ({
        points: item.pointsChanged,
        label: 'استخدام نقاط مستلمة لنشر رحلة',
        date: item.transactionAt
      })),
      ...(transfers?.items || [])
        .filter((item) => item.direction === 'received')
        .map((item) => ({
          points: Number(item.points),
          label: `من ${item.counterparty?.fullName || item.counterparty?.username || 'راكب'}`,
          date: item.createdAt
        }))
    ].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const history = mount.querySelector('[data-driver-transferred-history]');
    if (!history) return;
    const warning = errors.length
      ? `<p class="notice warning" role="alert">${errors.map((error) => D.escape(error)).join('<br>')}</p>`
      : '';
    history.innerHTML = warning + (entries.length
      ? entries.map((item) => `<article class="driver-transferred-entry">
          <strong>${item.points > 0 ? '+' : ''}${Number(item.points)} نقطة</strong>
          <span>${D.escape(item.label)}</span>
          <time datetime="${D.escape(item.date)}">${D.escape(formatDate(item.date))}</time>
        </article>`).join('')
      : '<p class="empty">لا توجد حركات نقاط محوّلة حتى الآن.</p>');
  }

  function renderCompletions(items, error) {
    const outstanding = items.filter((item) => item.status === 'confirmed');
    const list = mount.querySelector('[data-driver-completion-list]');
    if (!list) return;
    const warning = error
      ? `<p class="notice warning" role="alert">${D.escape(error)}</p>`
      : '';
    list.innerHTML = warning + (outstanding.length
      ? outstanding.map((item) => {
        const trip = item.trip || {};
        const route = `${D.escape(trip.startLocality || '—')} ← ${D.escape(trip.destinationUniversity || '—')}`;
        const state = item.driverConfirmed
          ? '<p class="muted">تم تسجيل تأكيدك؛ بانتظار تأكيد الراكب.</p>'
          : `<button class="btn btn-outline" type="button" data-confirm-booking-completion="${D.escape(item.bookingId)}">تأكيد إكمال الرحلة</button>`;
        return `<article class="driver-completion">
          <strong>${route}</strong>
          <p class="muted">${D.escape(D.formatDate(trip.departureDate || '—'))} · ${D.escape(trip.departureTime || '—')}</p>
          ${item.passengerConfirmed ? '<p class="muted">أكد الراكب إكمال الرحلة.</p>' : ''}
          ${state}
        </article>`;
      }).join('')
      : '<p class="empty">لا توجد حجوزات مؤكدة تنتظر إكمال الرحلة.</p>');
  }

  async function render() {
    const user = D.requireAuth('driver');
    if (!user || rendering) return;
    rendering = true;
    try {
      const hasHistory = Boolean(mount.querySelector('[data-driver-transferred-history]'));
      const hasCompletions = Boolean(mount.querySelector('[data-driver-completion-list]'));
      const [walletResult, transfersResult, pointTransactionsResult, completionsResult] = await Promise.allSettled([
        hasHistory ? window.DARB_API.getDriverTransferredPoints() : Promise.resolve(null),
        hasHistory ? window.DARB_API.getPointTransfers() : Promise.resolve(null),
        hasHistory ? window.DARB_API.getDriverPointTransactions(user.id) : Promise.resolve(null),
        hasCompletions ? window.DARB_API.getBookingCompletions() : Promise.resolve(null)
      ]);
      if (D.getUser()?.id !== user.id) return;
      const policy = mount.querySelector('[data-driver-transferred-policy]');
      if (policy) policy.textContent = 'النقاط المستلمة مضافة إلى رصيدك الموحد، ويمكن استخدامها لنشر الرحلات.';
      const errorText = (error) => String(error?.message || error || 'خطأ غير معروف');
      const historyErrors = [
        walletResult.status === 'rejected' ? `تعذر تحميل رصيد النقاط: ${errorText(walletResult.reason)}` : null,
        transfersResult.status === 'rejected' ? `تعذر تحميل التحويلات: ${errorText(transfersResult.reason)}` : null,
        pointTransactionsResult.status === 'rejected' ? `تعذر تحميل سجل النقاط: ${errorText(pointTransactionsResult.reason)}` : null
      ].filter(Boolean);
      if (hasCompletions) {
        renderCompletions(
          completionsResult.status === 'fulfilled' ? completionsResult.value.items || [] : [],
          completionsResult.status === 'rejected'
            ? errorText(completionsResult.reason)
            : ''
        );
      }
      if (hasHistory) {
        renderHistory(
          walletResult.status === 'fulfilled' ? walletResult.value : null,
          transfersResult.status === 'fulfilled' ? transfersResult.value : null,
          pointTransactionsResult.status === 'fulfilled' ? pointTransactionsResult.value || [] : [],
          historyErrors
        );
      }
    } catch (error) {
      const target = mount.querySelector('[data-driver-completion-list], [data-driver-transferred-history]');
      if (target) target.innerHTML = `<p class="notice warning" role="alert">${D.escape(error.message || 'تعذر تحميل بيانات النقاط المحوّلة.')}</p>`;
    } finally {
      rendering = false;
    }
  }

  mount.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-confirm-booking-completion]');
    if (!button) return;
    button.disabled = true;
    try {
      const result = await window.DARB_API.confirmBookingCompletion(button.dataset.confirmBookingCompletion);
      D.toast(result.completed
        ? `اكتملت الرحلة بعد تأكيد الطرفين. أُضيفت ${result.pointsAwarded} نقطة إلى محفظة الراكب.`
        : 'سُجل تأكيدك. ستُحتسب نقاط الراكب بعد تأكيده أيضًا.',
      'success');
      await render();
    } catch (error) {
      D.toast(error.message || 'تعذر تأكيد إكمال الرحلة.', 'error');
      button.disabled = false;
    }
  });

  document.addEventListener('DOMContentLoaded', () => D.ready.then(render));
  window.addEventListener('darb:data-updated', () => D.ready.then(render));
  window.setInterval(() => {
    if (document.visibilityState === 'visible') D.ready.then(render);
  }, 15000);
})();
