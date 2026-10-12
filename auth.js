(function(){'use strict';
  const D = window.DARB;
  const usernamePattern = /^[a-z0-9_]{3,20}$/;

  const universities = [
    ['الجامعة الأردنية','public'],['جامعة اليرموك','public'],['جامعة مؤتة','public'],['جامعة العلوم والتكنولوجيا الأردنية','public'],['الجامعة الهاشمية','public'],['جامعة آل البيت','public'],['جامعة البلقاء التطبيقية','public'],['جامعة الحسين بن طلال','public'],['جامعة الطفيلة التقنية','public'],['الجامعة الألمانية الأردنية','public'],['جامعة عمان العربية','private'],['جامعة الشرق الأوسط','private'],['جامعة جدارا','private'],['جامعة عمان الأهلية الخاصة','private'],['جامعة العلوم التطبيقية الخاصة','private'],['جامعة فيلادلفيا الخاصة','private'],['جامعة الإسراء','private'],['جامعة البترا','private'],['جامعة الزيتونة الأردنية الخاصة','private'],['جامعة الزرقاء','private'],['جامعة جرش','private'],['جامعة إربد الأهلية','private'],['جامعة عجلون الوطنية','private'],['جامعة العقبة للتكنولوجيا','private'],['جامعة العقبة للعلوم الطبية','private'],['جامعة العلوم الإسلامية العالمية','special-law'],['جامعة الحسين التقنية','special-law'],['الجامعة العربية المفتوحة','regional']
  ];

  const locations = {
    "عمّان":{"لواء قصبة عمّان":["عمّان"],"لواء ماركا":["ماركا","النصر"],"لواء القويسمة":["القويسمة","الجويدة","أم الحيران"],"لواء الجامعة":["الجامعة","الجبيهة","صويلح"],"لواء وادي السير":["وادي السير","بيادر وادي السير"],"لواء سحاب":["سحاب"],"لواء الجيزة":["الجيزة","أم الرصاص"],"لواء الموقر":["الموقر","رجم الشامي"],"لواء ناعور":["ناعور","حسبان"]},
    "إربد":{"لواء قصبة إربد":["إربد","الحصن","بني عبيد"],"لواء الكورة":["دير أبي سعيد","جديتا","كفر الماء"],"لواء بني كنانة":["سموع","سما الروسان","يبلا"],"لواء الرمثا":["الرمثا","الطرة"],"لواء الطيبة":["الطيبة","صما"],"لواء الوسطية":["كفر أسد","حوفا"],"لواء الأغوار الشمالية":["الشونة الشمالية","وادي الريان"]},
    "الزرقاء":{"لواء قصبة الزرقاء":["الزرقاء"],"لواء الرصيفة":["الرصيفة"],"لواء الهاشمية":["الهاشمية"],"لواء المفرق":["الظليل","بيرين","الأزرق"]},
    "البلقاء":{"لواء قصبة السلط":["السلط","العارضة"],"لواء الشونة الجنوبية":["الشونة الجنوبية"],"لواء دير علا":["دير علا"],"لواء عين الباشا":["عين الباشا"],"لواء ماحص والفحيص":["الفحيص","ماحص"]},
    "المفرق":{"لواء قصبة المفرق":["المفرق"],"لواء البادية الشمالية":["الصالحية","رحاب"],"لواء البادية الشمالية الغربية":["الخالدية","حوشا"],"لواء الرويشد":["الرويشد"]},
    "جرش":{"لواء قصبة جرش":["جرش","ساكب","برما"]},
    "عجلون":{"لواء قصبة عجلون":["عجلون","صخرة","عرجان"],"لواء كفرنجة":["كفرنجة"]},
    "مأدبا":{"لواء قصبة مأدبا":["مأدبا","جرينة"],"لواء ذيبان":["ذيبان"]},
    "الكرك":{"لواء قصبة الكرك":["الكرك","الثنية"],"لواء المزار الجنوبي":["المزار الجنوبي"],"لواء القصر":["القصر"],"لواء الأغوار الجنوبية":["غور الصافي"]},
    "الطفيلة":{"لواء قصبة الطفيلة":["الطفيلة"],"لواء بصيرا":["بصيرا"],"لواء الحسا":["الحسا"]},
    "معان":{"لواء قصبة معان":["معان"],"لواء البتراء":["وادي موسى"],"لواء الشوبك":["الشوبك"],"لواء الحسينية":["الحسينية"]},
    "العقبة":{"لواء قصبة العقبة":["العقبة"],"لواء القويرة":["القويرة","الديسة","وادي عربة"]}
  };

  function getUsers() {
    try {
      const users = D.STORAGE.get(D.KEYS.users, []);
      return Array.isArray(users) ? users : [];
    } catch {
      return [];
    }
  }

  function saveUsers(users) {
    D.STORAGE.set(D.KEYS.users, users);
  }

  function ensureErrorNode(field) {
    const group = field.closest('.field-group') || field.closest('.field');
    if (!group) return null;
    let error = group.querySelector('.field-error');
    if (!error) {
      error = document.createElement('div');
      error.className = 'field-error';
      group.appendChild(error);
    }
    return error;
  }

  function setFieldState(input, state, message) {
    const group = input.closest('.field-group') || input.closest('.field');
    if (!group) return;
    const error = ensureErrorNode(input);
    const isInvalid = state === 'invalid';
    const isValid = state === 'valid';

    input.classList.toggle('is-invalid', isInvalid);
    input.classList.toggle('is-valid', isValid);
    input.setAttribute('aria-invalid', isInvalid ? 'true' : 'false');
    group.classList.toggle('is-invalid', isInvalid);
    group.classList.toggle('is-valid', isValid);

    if (error) {
      error.textContent = isInvalid ? message : '';
      error.hidden = !isInvalid;
    }
  }

  function validateFullName(value) {
    const trimmed = String(value || '').trim();
    if (!trimmed) return { valid: false, message: 'يرجى إدخال الاسم الكامل.' };
    if (trimmed.length < 2) return { valid: false, message: 'الاسم قصير جدًا.' };
    if (trimmed.length > 100) return { valid: false, message: 'الاسم طويل جدًا.' };
    if (/<|>|&|\{|\}|<script|script/i.test(trimmed)) return { valid: false, message: 'الاسم يحتوي على رموز غير مسموح بها.' };
    return { valid: true, message: '' };
  }

  function validateUsername(value, includeDuplicateCheck = true) {
    const trimmed = String(value || '').trim();
    if (!trimmed) return { valid: false, message: 'يرجى إدخال اسم المستخدم.' };
    if (!usernamePattern.test(trimmed)) {
      if (/\s/.test(trimmed)) return { valid: false, message: 'اسم المستخدم لا يقبل المسافات.' };
      if (trimmed.length < 3) return { valid: false, message: 'اسم المستخدم يجب أن يحتوي على 3 أحرف على الأقل.' };
      if (trimmed.length > 20) return { valid: false, message: 'اسم المستخدم لا يمكن أن يتجاوز 20 حرفًا.' };
      if (/[A-Z]/.test(trimmed)) return { valid: false, message: 'لا يُسمح بالأحرف الكبيرة. استخدم أحرفًا إنجليزية صغيرة وأرقامًا وشرطة سفلية (_) فقط.' };
      if (/[.-]/.test(trimmed)) return { valid: false, message: 'استخدم أحرفًا إنجليزية صغيرة وأرقامًا وشرطة سفلية (_) فقط.' };
      if (/[^a-z0-9_]/.test(trimmed) || /[أ-ي]/.test(trimmed)) return { valid: false, message: 'استخدم أحرفًا إنجليزية صغيرة وأرقامًا وشرطة سفلية (_) فقط.' };
      return { valid: false, message: 'استخدم 3–20 حرفًا: أحرف إنجليزية صغيرة وأرقام وشرطة سفلية (_) فقط.' };
    }
    if (includeDuplicateCheck) {
      const duplicate = getUsers().some((user) => {
        const u = String(user.username || '').trim();
        if (!u) return false;
        return u.toLowerCase() === trimmed.toLowerCase();
      });
      if (duplicate) return { valid: false, message: 'اسم المستخدم مستخدم بالفعل. اختر اسمًا آخر.' };
    }
    return { valid: true, message: '' };
  }

  function validateEmail(value, includeDuplicateCheck = true) {
    const trimmed = String(value || '').trim();
    if (!trimmed) return { valid: false, message: 'يرجى إدخال البريد الإلكتروني.' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return { valid: false, message: 'صيغة البريد الإلكتروني غير صحيحة.' };
    if (includeDuplicateCheck) {
      const duplicate = getUsers().some((user) => String(user.email || '').trim().toLowerCase() === trimmed.toLowerCase());
      if (duplicate) return { valid: false, message: 'هذا البريد مستخدم بالفعل.' };
    }
    return { valid: true, message: '' };
  }

  function validatePhone(value, includeDuplicateCheck = true) {
    const normalized = D.normalizePhone(value || '');
    if (!normalized) return { valid: false, message: 'يرجى إدخال رقم الهاتف.' };
    if (!D.validPhone(normalized)) return { valid: false, message: 'تحقق من صيغة رقم الهاتف.' };
    if (includeDuplicateCheck) {
      const duplicate = getUsers().some((user) => D.normalizePhone(user.phone || '') === normalized);
      if (duplicate) return { valid: false, message: 'رقم الهاتف مسجل مسبقًا.' };
    }
    return { valid: true, message: '', normalized };
  }

  function passwordStrength(value) {
    const trimmed = String(value || '');
    if (!trimmed) return { valid: false, level: 'empty', label: 'لم تُكتب كلمة المرور بعد', score: 0 };

    let score = 0;
    if (trimmed.length >= 8) score += 1;
    if (/[A-Z]/.test(trimmed)) score += 1;
    if (/[a-z]/.test(trimmed)) score += 1;
    if (/\d/.test(trimmed)) score += 1;
    if (/[^A-Za-z0-9]/.test(trimmed)) score += 1;
    if (/(.)\1{2,}/.test(trimmed)) score = Math.max(0, score - 1);
    const common = /123456|password|qwerty|111111|abcdef|123123|000000|admin|letmein/i.test(trimmed);
    if (common) score = Math.max(0, score - 1);

    if (trimmed.length < 8) return { valid: false, level: 'weak', label: 'ضعيفة', score };
    if (score <= 2) return { valid: false, level: 'weak', label: 'ضعيفة', score };
    if (score === 3) return { valid: false, level: 'medium', label: 'متوسطة', score };
    return { valid: true, level: 'strong', label: 'قوية', score };
  }

  function setupPasswordMeter(input) {
    const meterWrap = document.querySelector('[data-password-meter-wrap]') || document.querySelector('.password-strength');
    const meter = document.querySelector('[data-password-meter]') || (meterWrap ? meterWrap.querySelector('.password-strength-fill') : null);
    const meterText = document.querySelector('[data-password-strength-text]') || (meterWrap ? meterWrap.querySelector('.strength-status') : null);
    if (meterWrap && meter) {
      meterWrap.style.display = 'block';
    }
    if (!meter || !meterText) return;

    const refresh = () => {
      const result = passwordStrength(input.value);
      const max = 5;
      const width = input.value ? Math.min((result.score / max) * 100, 100) : 0;
      meter.style.width = `${width}%`;
      meter.style.background = result.level === 'strong' ? '#0f766e' : result.level === 'medium' ? '#d97706' : result.level === 'weak' ? '#e11d48' : '#e2e8f0';
      meterText.textContent = input.value ? result.label : 'لم تُكتب كلمة المرور بعد';
      meterText.style.color = result.level === 'strong' ? '#0f766e' : result.level === 'medium' ? '#b45309' : result.level === 'weak' ? '#be123c' : '#64748b';
    };

    input.addEventListener('input', refresh);
    refresh();
  }

  function bindFieldValidation() {
    const form = document.querySelector('#registerForm');
    if (!form) return;

    const fullNameField = form.querySelector('input[name="fullName"]');
    const usernameField = form.querySelector('input[name="username"]');
    const emailField = form.querySelector('input[name="email"]');
    const phoneField = form.querySelector('input[name="phone"]');
    const passwordField = form.querySelector('input[name="password"]');
    const confirmPasswordField = form.querySelector('#registerConfirmPassword');

    if (fullNameField) {
      fullNameField.addEventListener('input', () => {
        const result = validateFullName(fullNameField.value);
        setFieldState(fullNameField, result.valid ? 'valid' : 'invalid', result.message);
      });
      fullNameField.addEventListener('blur', () => {
        const result = validateFullName(fullNameField.value);
        setFieldState(fullNameField, result.valid ? 'valid' : 'invalid', result.message);
      });
    }

    if (usernameField) {
      usernameField.addEventListener('input', () => {
        const result = validateUsername(usernameField.value, true);
        setFieldState(usernameField, result.valid ? 'valid' : 'invalid', result.message);
      });
      usernameField.addEventListener('blur', () => {
        const result = validateUsername(usernameField.value, true);
        setFieldState(usernameField, result.valid ? 'valid' : 'invalid', result.message);
      });
    }

    if (emailField) {
      emailField.addEventListener('input', () => {
        const result = validateEmail(emailField.value, true);
        setFieldState(emailField, result.valid ? 'valid' : 'invalid', result.message);
      });
      emailField.addEventListener('blur', () => {
        const result = validateEmail(emailField.value, true);
        setFieldState(emailField, result.valid ? 'valid' : 'invalid', result.message);
      });
    }

    if (phoneField) {
      phoneField.addEventListener('input', () => {
        const result = validatePhone(phoneField.value, true);
        setFieldState(phoneField, result.valid ? 'valid' : 'invalid', result.message);
      });
      phoneField.addEventListener('blur', () => {
        const result = validatePhone(phoneField.value, true);
        setFieldState(phoneField, result.valid ? 'valid' : 'invalid', result.message);
      });
    }

    if (passwordField) {
      setupPasswordMeter(passwordField);
      passwordField.addEventListener('input', () => {
        const result = passwordStrength(passwordField.value);
        if (!passwordField.value) {
          setFieldState(passwordField, 'invalid', 'يرجى إدخال كلمة المرور.');
        } else if (passwordField.value.length < 8) {
          setFieldState(passwordField, 'invalid', 'كلمة المرور قصيرة جدًا. استخدم 8 أحرف على الأقل.');
        } else if (!result.valid && result.level === 'weak') {
          setFieldState(passwordField, 'invalid', 'استخدم 8 أحرف على الأقل، ويفضل الجمع بين الأحرف الكبيرة والصغيرة والأرقام والرموز.');
        } else {
          setFieldState(passwordField, 'valid', '');
        }

        if (confirmPasswordField && confirmPasswordField.value) {
          if (confirmPasswordField.value !== passwordField.value) setFieldState(confirmPasswordField, 'invalid', 'كلمتا المرور غير متطابقتين.');
          else setFieldState(confirmPasswordField, 'valid', '');
        }
      });
      passwordField.addEventListener('blur', () => {
        const result = passwordStrength(passwordField.value);
        if (!passwordField.value) {
          setFieldState(passwordField, 'invalid', 'يرجى إدخال كلمة المرور.');
        }
      });
    }

    if (confirmPasswordField) {
      confirmPasswordField.addEventListener('input', () => {
        const passwordValue = passwordField ? passwordField.value : '';
        if (!confirmPasswordField.value.trim()) setFieldState(confirmPasswordField, 'invalid', 'يرجى إدخال تأكيد كلمة المرور.');
        else if (confirmPasswordField.value !== passwordValue) setFieldState(confirmPasswordField, 'invalid', 'كلمتا المرور غير متطابقتين.');
        else setFieldState(confirmPasswordField, 'valid', '');
      });
      confirmPasswordField.addEventListener('blur', () => {
        const passwordValue = passwordField ? passwordField.value : '';
        if (!confirmPasswordField.value.trim()) setFieldState(confirmPasswordField, 'invalid', 'يرجى إدخال تأكيد كلمة المرور.');
        else if (confirmPasswordField.value !== passwordValue) setFieldState(confirmPasswordField, 'invalid', 'كلمتا المرور غير متطابقتين.');
        else setFieldState(confirmPasswordField, 'valid', '');
      });
    }
  }

  function setupPasswordToggleButtons() {
    document.querySelectorAll('[data-password-toggle]').forEach((button) => {
      button.setAttribute('aria-label', button.getAttribute('aria-label') || 'إظهار كلمة المرور');
      button.addEventListener('click', () => {
        const target = document.querySelector(button.dataset.passwordToggle);
        if (!target) return;
        const show = target.type === 'password';
        target.type = show ? 'text' : 'password';
        button.textContent = show ? 'إخفاء' : 'إظهار';
        button.setAttribute('aria-label', show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور');
      });
    });
  }

  function fillUniversities() {
    const selects = document.querySelectorAll('[data-university-select]');
    selects.forEach((select) => {
      select.innerHTML = '<option value="">اختر الجامعة</option>' + universities.map(([name, type]) => `<option value="${D.escape(name)}">${D.escape(name)} — ${type === 'public' ? 'رسمية' : 'خاصة'}</option>`).join('');
    });
  }

  function setupLocations() {
    document.querySelectorAll('[data-governorate]').forEach((governorateField) => {
      const areaField = document.querySelector(`[data-area="${governorateField.dataset.forTarget}"]`);
      const localityField = document.querySelector(`[data-locality="${governorateField.dataset.forTarget}"]`);
      if (!areaField || !localityField) return;

      governorateField.innerHTML = '<option value="">اختر المحافظة</option>' + Object.keys(locations).map((name) => `<option value="${name}">${name}</option>`).join('');
      governorateField.addEventListener('change', () => {
        areaField.innerHTML = '<option value="">اختر اللواء/المنطقة</option>';
        localityField.innerHTML = '<option value="">اختر التجمع/المحلية</option>';
        Object.keys(locations[governorateField.value] || {}).forEach((name) => {
          const option = document.createElement('option');
          option.value = name;
          option.textContent = name;
          areaField.appendChild(option);
        });
      });
      areaField.addEventListener('change', () => {
        localityField.innerHTML = '<option value="">اختر التجمع/المحلية</option>';
        const current = locations[governorateField.value];
        const options = current ? current[areaField.value] || [] : [];
        options.forEach((name) => {
          const option = document.createElement('option');
          option.value = name;
          option.textContent = name;
          localityField.appendChild(option);
        });
      });
    });
  }

  function toggleDriver() {
    const driverSelected = document.querySelector('input[name="role"][value="driver"]:checked');
    document.querySelectorAll('[data-driver-fields]').forEach((field) => {
      field.classList.toggle('hidden', !driverSelected);
    });
  }

  function role() {
    document.querySelectorAll('input[name="role"]').forEach((radio) => {
      radio.addEventListener('change', toggleDriver);
    });
    toggleDriver();
  }

  function login() {
    const form = document.querySelector('#loginForm');
    if (!form || form.dataset.authReady) return;
    form.dataset.authReady = 'true';
    // تسجيل الدخول يتم حصرياً عبر خادم SQL (js/api.js)، وهو من يصدر رمز الجلسة
    // (token) ويحفظه في darb_access_token. لا توجد حسابات محلية هنا: لا ننشئ
    // جلسة "مسجَّل دخوله" بدون رمز، لأن الخادم يرفض مثل هذه الجلسات في
    // الاتصال الفوري (SignalR) بخطأ 401.
    form.addEventListener('submit', (event) => event.preventDefault());
  }

  function register() {
    const form = document.querySelector('#registerForm');
    if (!form || form.dataset.authReady) return;
    form.dataset.authReady = 'true';

    let current = 1;
    const steps = [...form.querySelectorAll('[data-reg-step]')];
    const bars = [...document.querySelectorAll('.progress .step')];

    const show = (stepNumber) => {
      current = Math.max(1, Math.min(stepNumber, steps.length));
      steps.forEach((item, index) => item.classList.toggle('hidden', index !== current - 1));
      bars.forEach((item, index) => item.classList.toggle('active', index < current));
    };

    const message = document.querySelector('#registerMsg') || (() => {
      const node = document.createElement('div');
      node.id = 'registerMsg';
      node.className = 'notice hidden';
      form.prepend(node);
      return node;
    })();

    const tell = (text, ok = false) => {
      message.textContent = text;
      message.className = `notice ${ok ? 'success' : 'error'}`;
    };

    form.querySelectorAll('[data-next]').forEach((button) => {
      button.addEventListener('click', () => {
        const section = steps[current - 1];
      const invalid = [...section.querySelectorAll('input, select')].find((field) => {
        if (!field.required || field.disabled) return false;
        if (field.offsetParent === null) return false;
        return !field.checkValidity();
      });
      if (invalid) {
        invalid.focus();
        invalid.reportValidity();
        return;
      }
        show(current + 1);
      });
    });

    form.querySelectorAll('[data-prev]').forEach((button) => {
      button.addEventListener('click', () => show(current - 1));
    });

    form.querySelectorAll('input[name="role"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        document.querySelectorAll('.role-card').forEach((card) => card.classList.toggle('active', !!card.querySelector('input:checked')));
      });
    });

    form.addEventListener('submit', (event) => {
      // إنشاء الحساب يتم عبر خادم SQL (js/api.js) فقط — وهو من ينشئ الحساب
      // ويصدر رمز الجلسة (token). لا ننشئ حسابات أو جلسات محلية هنا حتى لا
      // تظهر حسابات "مسجَّل دخوله" بدون رمز تُرفض لاحقاً في الاتصال الفوري.
      event.preventDefault();
    });

    show(1);
  }

  document.addEventListener('DOMContentLoaded', () => {
    fillUniversities();
    setupLocations();
    role();
    login();
    register();
    bindFieldValidation();
    setupPasswordToggleButtons();

    const reset = document.querySelector('[data-reset-demo]');
    if (reset) {
      reset.addEventListener('click', () => {
        if (confirm('سيتم حذف بيانات التجربة المحلية بالكامل. هل أنت متأكد؟')) {
          Object.values(D.KEYS).forEach((key) => D.STORAGE.remove(key));
          location.href = 'index.html';
        }
      });
    }
  });
})();
