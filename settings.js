document.addEventListener('DOMContentLoaded', () => {
  const D = window.DARB;
  const appearanceKey = 'darb_appearance_preferences';
  const defaults = { theme: 'light', fontSize: 'medium', reducedMotion: false, highContrast: false };

  const readAppearance = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(appearanceKey) || '{}');
      return {
        theme: ['light', 'dark', 'system'].includes(saved.theme) ? saved.theme : defaults.theme,
        fontSize: ['small', 'medium', 'large'].includes(saved.fontSize) ? saved.fontSize : defaults.fontSize,
        reducedMotion: saved.reducedMotion === true,
        highContrast: saved.highContrast === true
      };
    } catch {
      return { ...defaults };
    }
  };

  D.ready.then(async () => {
    const user = D.requireAuth();
    if (!user) return;

    const sections = [...document.querySelectorAll('[data-settings-section]')];
    const panels = [...document.querySelectorAll('[data-settings-panel]')];
    const passwordForm = document.querySelector('[data-password-form]');
    const passwordError = document.querySelector('[data-password-error]');
    const blockedList = document.querySelector('[data-block-list]');
    const blockedState = document.querySelector('[data-blocks-state]');
    const logoutDialog = document.querySelector('[data-settings-logout-dialog]');
    const logoutButton = document.querySelector('[data-settings-logout]');
    const logoutConfirm = document.querySelector('[data-logout-confirm]');
    const logoutCancel = document.querySelector('[data-logout-cancel]');
    const deleteDialog = document.querySelector('[data-settings-delete-dialog]');
    const deleteButton = document.querySelector('[data-delete-account]');
    const deleteConfirm = document.querySelector('[data-delete-confirm]');
    const deleteCancel = document.querySelector('[data-delete-cancel]');
    const deleteError = document.querySelector('[data-delete-error]');
    const deletePasswordInput = document.querySelector('[name="deleteConfirmPassword"]');
    let activeSection = 'account';
    let blockedUsers = [];
    let passwordSaving = false;
    let logoutInProgress = false;
    let deleteInProgress = false;

    const roleName = user.role === 'driver' ? 'سائق' : user.role === 'passenger' ? 'راكب' : 'مستخدم';
    document.querySelector('[data-settings-name]').textContent = user.fullName || 'مستخدم دَرْب';
    document.querySelector('[data-settings-username]').textContent = user.username ? `@${user.username}` : '';
    document.querySelector('[data-settings-role]').textContent = roleName;
    document.querySelector('[data-account-name]').textContent = user.fullName || '—';
    document.querySelector('[data-account-username]').textContent = user.username ? `@${user.username}` : '—';
    document.querySelector('[data-account-email]').textContent = user.email || '—';
    document.querySelector('[data-account-phone]').textContent = user.phone || '—';
    document.querySelector('[data-account-role]').textContent = roleName;

    logoutButton.addEventListener('click', () => logoutDialog.showModal());
    logoutCancel.addEventListener('click', () => logoutDialog.close());
    logoutConfirm.addEventListener('click', () => {
      logoutInProgress = true;
      logoutConfirm.disabled = true;
      logoutDialog.close();
      D.logout();
    });
    logoutDialog.addEventListener('click', (event) => {
      if (event.target === logoutDialog) logoutDialog.close();
    });

    deleteButton.addEventListener('click', () => {
      deleteError.classList.add('hidden');
      deletePasswordInput.value = '';
      deleteDialog.showModal();
    });
    deleteCancel.addEventListener('click', () => deleteDialog.close());
    deleteConfirm.addEventListener('click', async () => {
      const password = deletePasswordInput.value.trim();
      deleteError.classList.add('hidden');
      if (password.length < 6) {
        deleteError.textContent = 'كلمة المرور مطلوبة ويجب أن تكون 6 أحرف على الأقل.';
        deleteError.classList.remove('hidden');
        return;
      }
      deleteInProgress = true;
      deleteConfirm.disabled = true;
      deleteConfirm.textContent = 'جاري الحذف...';
      try {
        await window.DARB_API.deleteAccount(password);
        D.toast('تم حذف حسابك وجميع بياناتك نهائيًا.', 'success');
        deleteDialog.close();
        // Clear all local storage and redirect to login
        D.logout();
        setTimeout(() => location.href = 'login.html', 1500);
      } catch (error) {
        deleteError.textContent = error.message || 'تعذر حذف الحساب. حاول مرة أخرى.';
        deleteError.classList.remove('hidden');
      } finally {
        deleteInProgress = false;
        deleteConfirm.disabled = false;
        deleteConfirm.textContent = 'حذف الحساب نهائيًا';
      }
    });
    deleteDialog.addEventListener('click', (event) => {
      if (event.target === deleteDialog) deleteDialog.close();
    });

    const avatar = document.querySelector('[data-settings-avatar]');
    if (typeof user.profilePhoto === 'string'
      && (/^https:\/\/[^\s]+$/i.test(user.profilePhoto) || /^data:image\/(?:jpeg|png|webp);base64,/i.test(user.profilePhoto))) {
      const image = document.createElement('img');
      image.src = user.profilePhoto;
      image.alt = '';
      avatar.replaceChildren(image);
    } else {
      avatar.textContent = String(user.fullName || 'د').trim().charAt(0) || 'د';
    }

    const hasUnsavedPassword = () => [...passwordForm.elements]
      .some((element) => element.name && element.value.length > 0);
    const switchSection = (section) => {
      if (section === activeSection) return;
      if (hasUnsavedPassword() && !window.confirm('لديك تغييرات غير محفوظة في نموذج كلمة المرور. هل تريد إلغاءها ومغادرة القسم؟')) return;
      if (hasUnsavedPassword()) passwordForm.reset();
      activeSection = section;
      sections.forEach((button) => {
        if (button.dataset.settingsSection === section) button.setAttribute('aria-current', 'page');
        else button.removeAttribute('aria-current');
      });
      panels.forEach((panel) => panel.classList.toggle('hidden', panel.dataset.settingsPanel !== section));
      history.replaceState(null, '', `#${section}`);
    };
    sections.forEach((button) => button.addEventListener('click', () => switchSection(button.dataset.settingsSection)));
    const requestedSection = location.hash.slice(1);
    if (sections.some((button) => button.dataset.settingsSection === requestedSection)) {
      activeSection = '';
      switchSection(requestedSection);
    }
    window.addEventListener('beforeunload', (event) => {
      if (logoutInProgress || deleteInProgress || !hasUnsavedPassword()) return;
      event.preventDefault();
      event.returnValue = '';
    });

    const loadBlockedUsers = async () => {
      blockedState.textContent = 'جار تحميل الحسابات المحظورة...';
      blockedList.replaceChildren();
      try {
        blockedUsers = await window.DARB_API.getBlockedUsers();
        if (!blockedUsers.length) {
          blockedState.textContent = 'لا توجد حسابات محظورة حاليًا.';
          return;
        }
        blockedState.textContent = '';
        blockedUsers.forEach((blockedUser) => {
          const row = document.createElement('article');
          row.className = 'settings-block-item';
          const photo = document.createElement('span');
          photo.className = 'settings-block-avatar';
          if (typeof blockedUser.profilePhoto === 'string'
            && (/^https:\/\/[^\s]+$/i.test(blockedUser.profilePhoto) || /^data:image\/(?:jpeg|png|webp);base64,/i.test(blockedUser.profilePhoto))) {
            const image = document.createElement('img');
            image.src = blockedUser.profilePhoto;
            image.alt = '';
            photo.append(image);
          } else {
            photo.textContent = String(blockedUser.fullName || 'د').trim().charAt(0) || 'د';
          }
          const copy = document.createElement('span');
          copy.className = 'settings-block-copy';
          const name = document.createElement('strong');
          name.textContent = blockedUser.fullName || 'مستخدم دَرْب';
          const username = document.createElement('span');
          username.dir = 'ltr';
          username.textContent = blockedUser.username ? `@${blockedUser.username}` : '';
          const date = document.createElement('span');
          date.textContent = blockedUser.createdAt
            ? `تاريخ الحظر: ${new Intl.DateTimeFormat('ar-JO', { dateStyle: 'medium' }).format(new Date(blockedUser.createdAt))}`
            : '';
          copy.append(name, username, date);
          const unblock = document.createElement('button');
          unblock.type = 'button';
          unblock.className = 'btn btn-outline';
          unblock.textContent = 'إلغاء الحظر';
          unblock.addEventListener('click', async () => {
            if (!window.confirm(`هل تريد إلغاء حظر ${blockedUser.fullName || 'هذا المستخدم'}؟`)) return;
            unblock.disabled = true;
            try {
              await window.DARB_API.unblockUser(blockedUser.id);
              D.toast('تم إلغاء الحظر. بقيت المحادثة والرسائل السابقة محفوظة.', 'success');
              await loadBlockedUsers();
            } catch (error) {
              D.toast(error.message || 'تعذر إلغاء الحظر. حاول مرة أخرى.', 'error');
              unblock.disabled = false;
            }
          });
          row.append(photo, copy, unblock);
          blockedList.append(row);
        });
      } catch (error) {
        console.error('Could not load blocked accounts:', error);
        blockedState.textContent = error.message || 'تعذر تحميل قائمة الحظر.';
      }
    };
    document.querySelector('[data-blocks-refresh]').addEventListener('click', loadBlockedUsers);
    await loadBlockedUsers();

    passwordForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (passwordSaving) return;
      const currentPassword = passwordForm.elements.namedItem('currentPassword').value;
      const newPassword = passwordForm.elements.namedItem('newPassword').value;
      const confirmation = passwordForm.elements.namedItem('confirmPassword').value;
      passwordError.classList.add('hidden');
      if (newPassword.length < 6 || newPassword.length > 256) {
        passwordError.textContent = 'يجب أن تتكون كلمة المرور الجديدة من 6 إلى 256 حرفًا.';
        passwordError.classList.remove('hidden');
        return;
      }
      if (newPassword !== confirmation) {
        passwordError.textContent = 'تأكيد كلمة المرور لا يطابق كلمة المرور الجديدة.';
        passwordError.classList.remove('hidden');
        return;
      }
      const submit = passwordForm.querySelector('[type="submit"]');
      passwordSaving = true;
      submit.disabled = true;
      try {
        await window.DARB_API.changePassword(currentPassword, newPassword);
        passwordForm.reset();
        D.toast('تم تحديث كلمة المرور. جلستك الحالية ما زالت فعالة.', 'success');
      } catch (error) {
        passwordError.textContent = error.message || 'تعذر تحديث كلمة المرور.';
        passwordError.classList.remove('hidden');
      } finally {
        passwordSaving = false;
        submit.disabled = false;
      }
    });
    passwordForm.addEventListener('reset', () => passwordError.classList.add('hidden'));

    const syncAppearanceControls = () => {
      const preferences = readAppearance();
      document.querySelectorAll('input[name="theme"]').forEach((input) => {
        input.checked = input.value === preferences.theme;
      });
      document.querySelectorAll('input[name="fontSize"]').forEach((input) => {
        input.checked = input.value === preferences.fontSize;
      });
      document.querySelector('[data-appearance-option="reducedMotion"]').checked = preferences.reducedMotion;
      document.querySelector('[data-appearance-option="highContrast"]').checked = preferences.highContrast;
    };
    const saveAppearance = (updates) => {
      const next = { ...readAppearance(), ...updates };
      try {
        localStorage.setItem(appearanceKey, JSON.stringify(next));
        window.dispatchEvent(new Event('darb:appearance-updated'));
        syncAppearanceControls();
      } catch (error) {
        console.error('Could not save appearance preferences:', error);
        D.toast('تعذر حفظ تفضيلات المظهر على هذا الجهاز.', 'error');
      }
    };
    document.querySelectorAll('input[name="theme"]').forEach((input) => {
      input.addEventListener('change', () => saveAppearance({ theme: input.value }));
    });
    document.querySelectorAll('input[name="fontSize"]').forEach((input) => {
      input.addEventListener('change', () => saveAppearance({ fontSize: input.value }));
    });
    document.querySelector('[data-appearance-option="reducedMotion"]').addEventListener('change', (event) => {
      saveAppearance({ reducedMotion: event.target.checked });
    });
    document.querySelector('[data-appearance-option="highContrast"]').addEventListener('change', (event) => {
      saveAppearance({ highContrast: event.target.checked });
    });
    document.querySelector('[data-appearance-reset]').addEventListener('click', () => {
      try {
        localStorage.setItem(appearanceKey, JSON.stringify(defaults));
        window.dispatchEvent(new Event('darb:appearance-updated'));
        syncAppearanceControls();
        D.toast('تمت استعادة إعدادات المظهر الافتراضية.', 'success');
      } catch (error) {
        console.error('Could not reset appearance preferences:', error);
        D.toast('تعذر استعادة إعدادات المظهر على هذا الجهاز.', 'error');
      }
    });
    syncAppearanceControls();

    document.querySelector('[data-open-notifications]').addEventListener('click', (event) => {
      // This button lives outside the nav, so the global "click outside closes
      // panels" handler would immediately close the panel we are about to open.
      event.stopPropagation();
      const button = document.querySelector('[data-nav-panel-toggle="notifications"]');
      if (!button) {
        D.toast('قائمة الإشعارات غير متاحة في هذه الجلسة.', 'error');
        return;
      }
      button.click();
      button.focus();
    });

    document.querySelector('[data-location-check]').addEventListener('click', async (event) => {
      const state = document.querySelector('[data-location-state]');
      const button = event.currentTarget;
      if (!navigator.geolocation) {
        state.textContent = 'الموقع غير متاح في هذا المتصفح.';
        return;
      }
      button.disabled = true;
      state.textContent = 'جار التحقق من الإذن...';
      try {
        const permission = navigator.permissions?.query
          ? await navigator.permissions.query({ name: 'geolocation' })
          : null;
        if (permission?.state === 'denied') {
          state.textContent = 'الإذن مرفوض. يمكنك تغييره من إعدادات الموقع في المتصفح.';
          return;
        }
        await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, {
          maximumAge: 0,
          timeout: 10000,
          enableHighAccuracy: false
        }));
        state.textContent = 'الإذن ممنوح والموقع متاح الآن. لم تُحفظ الإحداثيات.';
      } catch (error) {
        state.textContent = error.code === 1
          ? 'الإذن غير ممنوح. يمكنك السماح به من إعدادات المتصفح.'
          : error.code === 3 ? 'انتهت مهلة طلب الموقع.' : 'الموقع غير متاح حاليًا.';
      } finally {
        button.disabled = false;
      }
    });
  }).catch((error) => {
    console.error('Settings initialization failed:', error);
    D.toast(error.message || 'تعذر تحميل الإعدادات.', 'error');
  });
});
