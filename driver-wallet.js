(() => {
  'use strict';

  const D = window.DARB;
  const mount = document.querySelector('#driverPointsMount');
  if (!mount) return;

  let refreshing = false;

  function render(points, publishCost, transactions) {
    mount.innerHTML = `
      <div class="section-head">
        <div><h2>محفظة النقاط</h2><p class="muted">الرصيد الحالي وتكلفة نشر الرحلة</p></div>
      </div>
      <div class="points-grid">
        <div class="point-box"><span>رصيد النقاط الموحد</span><strong>${Number(points.currentBalance || 0)} نقطة</strong></div>
        <div class="point-box"><span>تكلفة نشر الرحلة</span><strong>${publishCost} نقطة</strong></div>
        <div class="point-box"><span>المستهلكة</span><strong>${Number(points.totalSpent || 0)} نقطة</strong></div>
      </div>
      <div class="notice ${Number(points.currentBalance || 0) >= publishCost ? 'success' : 'warning'}">
        ${Number(points.currentBalance || 0) >= publishCost
          ? 'الرصيد كافٍ لنشر رحلة جديدة.'
          : `لا يكفي الرصيد لنشر رحلة جديدة. الرصيد الحالي: ${Number(points.currentBalance || 0)} نقطة، التكلفة: ${publishCost} نقطة.`}
      </div>
      <div class="points-history">
        <h3>آخر المعاملات</h3>
        <div class="mini-list">
          ${transactions.slice(0, 5).map((item) => `
            <div class="mini-item">
              <span>${D.escape(item.transactionType === 'publish' ? 'نشر رحلة' : item.reason || 'معاملة')}</span>
              <strong>${item.pointsChanged > 0 ? '+' : ''}${Number(item.pointsChanged)} نقطة</strong>
            </div>`).join('') || '<div class="empty">لا توجد معاملات حتى الآن.</div>'}
        </div>
      </div>`;
  }

  async function refresh() {
    const user = D.requireAuth('driver');
    if (!user || refreshing) return;
    refreshing = true;
    try {
      const [settings, points, transactions] = await Promise.all([
        window.DARB_API.getRewardSettings(),
        window.DARB_API.getDriverPoints(user.id),
        window.DARB_API.getDriverPointTransactions(user.id)
      ]);
      if (D.getUser()?.id !== user.id) return;
      const publishCost = Number(settings.TripPublishCost || settings.tripPublishCost || 50);
      render(points, publishCost, transactions || []);
    } catch (error) {
      console.error('Failed to load driver wallet:', error);
      mount.innerHTML = `<p class="notice warning" role="alert">${D.escape(error.message || 'تعذر تحميل محفظة النقاط.')}</p>`;
    } finally {
      refreshing = false;
    }
  }

  document.addEventListener('DOMContentLoaded', () => D.ready.then(refresh));
  window.addEventListener('darb:data-updated', () => {
    if (D.getUser()?.role === 'driver') D.ready.then(refresh);
  });
  window.setInterval(() => {
    if (document.visibilityState === 'visible') D.ready.then(refresh);
  }, 15000);
})();
