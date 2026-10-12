(function () {
  'use strict';

  const D = window.DARB;
  let renderVersion = 0;

  const packages = [
    {
      id: 'points_10',
      points: 10,
      price: 0.1,
      currency: 'JOD',
      name: 'باقة 10 نقاط',
      description: '10 نقاط بسعر 0.1 دينار أردني'
    },
    {
      id: 'points_50',
      points: 50,
      price: 0.5,
      currency: 'JOD',
      name: 'باقة 50 نقطة',
      description: '50 نقطة بسعر 0.5 دينار أردني'
    },
    {
      id: 'points_100',
      points: 100,
      price: 1,
      currency: 'JOD',
      name: 'باقة 100 نقطة',
      description: '100 نقطة بسعر 1 دينار أردني'
    }
  ];

  function formatPrice(price, currency) {
    return `${Number(price).toFixed(1)} د.أ`;
  }

  function renderBalance(balance) {
    const balanceEl = document.querySelector('[data-store-balance]');
    if (balanceEl) {
      if (balance !== null && balance !== undefined) {
        balanceEl.textContent = `رصيدك الحالي: ${Number(balance)} نقطة`;
      } else {
        balanceEl.textContent = 'رصيدك الحالي: غير متاح حالياً';
      }
    }
  }

  async function render() {
    const user = D.requireAuth('driver');
    if (!user) return;
    const version = ++renderVersion;
    const mount = document.getElementById('storePackages');
    if (!mount) return;
    
    mount.innerHTML = '<p class="muted" role="status">جارٍ تحميل الرصيد...</p>';
    
    let balance = null;
    try {
      if (window.DARB_API && typeof window.DARB_API.getDriverPoints === 'function') {
        const points = await window.DARB_API.getDriverPoints(user.id);
        balance = Number(points.currentBalance || 0);
      }
    } catch (error) {
      console.warn('Failed to load driver balance', error);
      balance = null;
    }
    
    if (version !== renderVersion || D.getUser()?.id !== user.id) return;
    
    renderBalance(balance);
    
    mount.innerHTML = packages.map((item) => {
      return `<article class="point-package">
        <div class="point-package-header">
          <h3>${D.escape(item.name)}</h3>
          <p class="point-package-desc">${D.escape(item.description)}</p>
        </div>
        <div class="point-package-body">
          <span class="point-package-points">${Number(item.points)} نقطة</span>
          <span class="point-package-price">${formatPrice(item.price, item.currency)}</span>
        </div>
        <div class="point-package-footer">
          <button class="btn btn-primary btn-block" type="button" data-buy-package="${D.escape(item.id)}">شراء الباقة</button>
        </div>
      </article>`;
    }).join('');

    mount.querySelectorAll('[data-buy-package]').forEach((button) => {
      button.addEventListener('click', () => {
        const selected = packages.find((item) => item.id === button.dataset.buyPackage);
        if (selected) {
          const message = `تم اختيار "${selected.name}"\n\nالسعر: ${formatPrice(selected.price, selected.currency)}\nعدد النقاط: ${selected.points} نقطة\n\nملاحظة: الشراء والدفع الإلكتروني لم يُفعلا بعد.\nستُتاح هذه الميزة بعد استكمال إعداد الدفع.\n\nلا يتم خصم أي رصيد أو إضافة أي نقاط في هذه المرحلة.`;
          D.toast('عملية الشراء غير مفعلة بعد', 'warning');
          if (typeof alert === 'function') {
            alert(message);
          }
        }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    D.ready.then(render).catch((error) => {
      console.error('Point store initialization failed:', error);
    });
  });
  
  window.addEventListener('darb:data-updated', () => {
    if (D.getUser()?.role === 'driver') {
      D.ready.then(render);
    }
  });
})();