document.addEventListener('DOMContentLoaded', () => {
  const D = window.DARB;
  const controls = [...document.querySelectorAll('[data-account-setting]')];
  const states = [...document.querySelectorAll('[data-account-settings-state]')];
  if (!controls.length) return;

  D.ready.then(async () => {
    if (!D.requireAuth()) return;
    const setStatus = (message, isError = false) => {
      states.forEach((state) => {
        state.textContent = message;
        state.classList.toggle('error', isError);
        state.classList.toggle('muted', !isError);
      });
    };

    let settings;
    try {
      settings = await window.DARB_API.getSettings();
      controls.forEach((control) => {
        control.checked = settings[control.dataset.accountSetting] === true;
        control.disabled = false;
      });
      setStatus('تُحفظ تفضيلات الخصوصية والإشعارات في حسابك.');
    } catch (error) {
      console.error('Could not load account settings:', error);
      setStatus(error.message || 'تعذر تحميل إعدادات الحساب.', true);
      return;
    }

    controls.forEach((control) => {
      control.addEventListener('change', async () => {
        const key = control.dataset.accountSetting;
        const previousValue = settings[key] === true;
        control.disabled = true;
        setStatus('جار حفظ الإعداد...');
        try {
          settings = await window.DARB_API.saveSettings({ [key]: control.checked });
          controls.forEach((item) => {
            const k = item.dataset.accountSetting;
            if (k in settings) {
              item.checked = settings[k] === true;
            }
          });
          if (key === 'shareLocation' && !settings.shareLocation) {
            D.STORAGE.remove(D.KEYS.passengerLocation);
            D.STORAGE.remove(D.KEYS.driverLocation);
          }
          setStatus('تم حفظ الإعداد في حسابك.');
        } catch (error) {
          control.checked = previousValue;
          setStatus(error.message || 'تعذر حفظ الإعداد. أعد المحاولة.', true);
          D.toast(error.message || 'تعذر حفظ الإعداد.', 'error');
        } finally {
          control.disabled = false;
        }
      });
    });
  }).catch((error) => {
    console.error('Account settings initialization failed:', error);
    states.forEach((state) => {
      state.textContent = error.message || 'تعذر تهيئة إعدادات الحساب.';
      state.classList.add('error');
    });
  });
});
