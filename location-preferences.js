(() => {
  const D = window.DARB;
  const requestLocation = window.DARB_GPS.request.bind(window.DARB_GPS);

  window.DARB_GPS.request = async (kind, ui) => {
    if (D.apiEnabled) {
      try {
        const settings = await window.DARB_API.getSettings();
        if (!settings.shareLocation) {
          const message = 'مشاركة الموقع متوقفة من إعدادات الخصوصية.';
          if (ui) ui.status.textContent = message;
          D.toast(message, 'error');
          return;
        }
      } catch (error) {
        const message = error.message || 'تعذر التحقق من إعداد مشاركة الموقع.';
        if (ui) ui.status.textContent = message;
        D.toast(message, 'error');
        return;
      }
    }
    requestLocation(kind, ui);
  };
})();
