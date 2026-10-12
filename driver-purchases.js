(function () {
  'use strict';

  const D = window.DARB;
  let renderVersion = 0;
  let renderTimer;

  const statusLabels = {
    pending_payment: 'بانتظار التحويل',
    awaiting_verification: 'بانتظار مراجعة الدفع',
    approved_credited: 'تم التحقق وإضافة النقاط',
    rejected: 'مرفوض - راجع سبب الرفض'
  };

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('ar-JO', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  }

  function formatPrice(price, currency) {
    return `${Number(price).toFixed(2)} ${D.escape(currency)}`;
  }

  function renderPurchase(item) {
    const awaitingTransfer = item.status === 'pending_payment';
    const status = statusLabels[item.status] || 'حالة غير معروفة';
    const evidenceForm = awaitingTransfer
      ? `<form class="driver-purchase-transfer" data-transfer-form="${D.escape(item.id)}">
          <label for="transfer-${D.escape(item.id)}">رقم الحوالة${item.requiresReference ? ' (مطلوب)' : ' (اختياري)'}</label>
          <input id="transfer-${D.escape(item.id)}" name="transferReference" maxlength="100"
            autocomplete="off" ${item.requiresReference ? 'required' : ''}>
          <button class="btn btn-primary" type="submit">إرسال للمراجعة</button>
        </form>`
      : '';
    const instructions = awaitingTransfer
      ? `<div class="driver-purchase-instructions">
          <strong>تعليمات التحويل - ${D.escape(item.paymentMethodName)}</strong>
          <p>${D.escape(item.instructions)}</p>
          <p>${D.escape(item.recipientDetails)}</p>
          <small>لا تُضاف النقاط تلقائيًا. أرسل رقم الحوالة وانتظر مراجعتها.</small>
        </div>`
      : '';
    const message = item.status === 'awaiting_verification'
      ? 'تم استلام بيانات التحويل، والطلب بانتظار مراجعة يدوية.'
      : item.status === 'approved_credited'
        ? 'تم التحقق من الدفع وإضافة النقاط إلى محفظتك.'
        : item.status === 'rejected'
          ? `لم تتم الموافقة على الطلب.${item.rejectionReason ? ` السبب: ${D.escape(item.rejectionReason)}` : ''}`
          : '';
    return `<article class="driver-purchase">
      <div class="driver-purchase-heading">
        <div><strong>${D.escape(item.packageName)}</strong><small>المرجع: ${D.escape(item.reference)}</small></div>
        <span class="badge ${item.status === 'approved_credited' ? 'open' : item.status === 'rejected' ? 'cancelled' : 'pending'}">${D.escape(status)}</span>
      </div>
      <div class="driver-purchase-details">
        <span>${Number(item.points)} نقطة</span>
        <span>${formatPrice(item.price, item.currency)}</span>
        <span>${formatDate(item.createdAt)}</span>
      </div>
      ${message ? `<p class="driver-purchase-status">${message}</p>` : ''}
      ${instructions}
      ${evidenceForm}
    </article>`;
  }

  async function render() {
    const user = D.requireAuth('driver');
    if (!user) return;
    const version = ++renderVersion;
    const mount = document.querySelector('#driverPurchasesMount') || document.createElement('section');
    mount.id = 'driverPurchasesMount';
    mount.className = 'card driver-purchases';
    const wallet = document.querySelector('#driverPointsMount');
    if (!mount.isConnected) {
      if (wallet?.parentNode) wallet.parentNode.insertBefore(mount, wallet.nextSibling);
      else document.querySelector('#currentTrip')?.before(mount);
    }
    mount.innerHTML = '<h2>شراء نقاط السائق</h2><p class="muted" role="status">جارٍ تحميل الحزم وسجل الطلبات...</p>';
    try {
      const [points, packagesResult, methodsResult, purchasesResult] = await Promise.all([
        window.DARB_API.getDriverPoints(user.id),
        window.DARB_API.getDriverPointPackages(),
        window.DARB_API.getDriverPointPaymentMethods(),
        window.DARB_API.getDriverPointPurchases()
      ]);
      if (version !== renderVersion || D.getUser()?.id !== user.id) return;
      const packages = packagesResult.items || [];
      const methods = methodsResult.items || [];
      const purchases = purchasesResult.items || [];
      const availablePackages = packages.filter((item) => Number.isInteger(item.points) && item.points > 0);
      const configuredMethods = methods.filter((item) => item.configured
        && item.instructions && item.recipientDetails);
      const packageCards = availablePackages.length
        ? availablePackages.map((item) => {
          const methodAvailable = configuredMethods.some((method) => method.currency === item.currency);
          return `<article class="driver-package">
            <h3>${D.escape(item.name)}</h3>
            ${item.description ? `<p>${D.escape(item.description)}</p>` : ''}
            <strong>${Number(item.points)} نقطة</strong>
            <span>${formatPrice(item.price, item.currency)}</span>
            <button class="btn btn-primary" type="button" data-buy-package="${D.escape(item.id)}"
              ${methodAvailable ? '' : 'disabled'}>طلب تحويل</button>
          </article>`;
        }).join('')
        : '<p class="empty">حزم النقاط غير متاحة حاليًا. لم تُضف حزم شراء بعد.</p>';
      const paymentNotice = configuredMethods.length
        ? ''
        : '<p class="notice warning">التحويل اليدوي غير مُعد حاليًا. لا يمكن إنشاء طلب شراء حتى تُضاف تعليمات التحويل وبيانات المستلم.</p>';
      mount.innerHTML = `
        <div class="section-head">
          <div><h2>شراء نقاط السائق</h2><p class="muted">رصيدك الموحد: <strong>${Number(points.currentBalance)} نقطة</strong></p></div>
        </div>
        ${paymentNotice}
        <div class="driver-package-grid">${packageCards}</div>
        <div class="driver-purchase-history">
          <h3>طلبات الشراء</h3>
          ${purchases.length ? purchases.map(renderPurchase).join('') : '<p class="empty">لا توجد طلبات شراء حتى الآن.</p>'}
        </div>`;
      mount.querySelectorAll('[data-buy-package]').forEach((button) => {
        button.addEventListener('click', async () => {
          button.disabled = true;
          try {
            const selected = availablePackages.find((item) => item.id === button.dataset.buyPackage);
            const method = configuredMethods.find((item) => item.currency === selected?.currency);
            if (!selected || !method) throw new Error('الحزمة أو طريقة التحويل لم تعد متاحة.');
            await window.DARB_API.createDriverPointPurchase(selected.id, method.id);
            D.toast('تم إنشاء طلب التحويل. راجع التعليمات وأرسل رقم الحوالة.', 'success');
            await render();
          } catch (error) {
            D.toast(error.message || 'تعذر إنشاء طلب شراء النقاط.', 'error');
            button.disabled = false;
          }
        });
      });
      mount.querySelectorAll('[data-transfer-form]').forEach((form) => {
        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          const button = form.querySelector('button[type="submit"]');
          button.disabled = true;
          try {
            await window.DARB_API.submitDriverPointTransfer(
              form.dataset.transferForm,
              form.elements.transferReference.value.trim()
            );
            D.toast('أُرسل الطلب للمراجعة. ستُضاف النقاط بعد التحقق فقط.', 'success');
            await render();
          } catch (error) {
            D.toast(error.message || 'تعذر إرسال بيانات التحويل.', 'error');
            button.disabled = false;
          }
        });
      });
    } catch (error) {
      if (version !== renderVersion) return;
      console.error('Could not load driver points purchasing:', error);
      mount.innerHTML = `<h2>شراء نقاط السائق</h2>
        <p class="notice warning">تعذر تحميل محفظة النقاط أو حزم الشراء. تحقق من اتصال الخادم ثم أعد تحميل الصفحة.</p>`;
    }
  }

  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = window.setTimeout(() => {
      D.ready.then(render).catch((error) => {
        console.error('Driver points purchasing initialization failed:', error);
      });
    }, 100);
  }

  document.addEventListener('DOMContentLoaded', () => {
    scheduleRender();
  });
  window.addEventListener('darb:data-updated', () => {
    if (D.getUser()?.role === 'driver') scheduleRender();
  });
})();
