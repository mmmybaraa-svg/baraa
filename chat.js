document.addEventListener('DOMContentLoaded', () => {
  const D = window.DARB;
  D.ready.then(async () => {
    const user = D.requireAuth();
    if (!user) return;
    // جلسة بدون رمز لن تُقبل في الاتصال الفوري (SignalR) وتُرفض من الخادم:
    // نسجّل الخروج في هذه الحالة بدلاً من محاولة الاتصال بلا رمز.
    if (!D.STORAGE.get(D.KEYS.token, '')) {
      D.logout();
      return;
    }

    const api = window.DARB_API;
    let readReceiptsEnabled = false;
    try {
      readReceiptsEnabled = (await api.getSettings()).readReceipts === true;
    } catch (error) {
      console.error('Could not load conversation privacy settings:', error);
      D.toast(error.message || 'تعذر تحميل إعدادات الخصوصية.', 'error');
    }
    const params = new URLSearchParams(location.search);
    const requestedConversationId = params.get('conversation');
    const partnerId = params.get('user');
    const tripId = params.get('trip');
    const workspace = document.querySelector('[data-chat-workspace]');
    const list = document.querySelector('[data-conversation-list]');
    const listState = document.querySelector('[data-conversation-state]');
    const emptyState = document.querySelector('[data-chat-empty]');
    const thread = document.querySelector('[data-chat-thread]');
    const host = document.querySelector('[data-chat-messages]');
    const form = document.querySelector('[data-chat-form]');
    const input = form.elements.namedItem('message');
    const submit = form.querySelector('[type="submit"]');
    const notice = document.querySelector('[data-chat-notice]');
    const olderButton = document.querySelector('[data-chat-older]');
    const photoButton = document.querySelector('[data-chat-photo]');
    const photoMenu = document.querySelector('[data-chat-photo-menu]');
    const fileInput = document.querySelector('[data-chat-file-upload]');
    const cameraInput = document.querySelector('[data-chat-camera-upload]');
    const previewPanel = document.querySelector('[data-chat-image-preview]');
    const previewThumb = document.querySelector('[data-chat-image-thumb]');
    const previewName = document.querySelector('[data-chat-image-name]');
    const previewSize = document.querySelector('[data-chat-image-size]');
    const previewProgress = document.querySelector('[data-chat-image-progress]');
    const sendImageButton = document.querySelector('[data-chat-send-image]');
    const cancelImageButton = document.querySelector('[data-chat-image-cancel]');
    const replaceImageButton = document.querySelector('[data-chat-image-replace]');
    const photoGalleryButton = document.querySelector('[data-chat-photo-gallery]');
    const photoCaptureButton = document.querySelector('[data-chat-photo-capture]');
    const lightbox = document.querySelector('[data-chat-lightbox]');
    const lightboxImage = document.querySelector('[data-chat-lightbox-image]');
    const lightboxClose = document.querySelector('[data-chat-lightbox-close]');
    const micButton = document.querySelector('[data-chat-mic]');
    const voicePanel = document.querySelector('[data-chat-voice]');
    const recordingState = document.querySelector('[data-recording-state]');
    const reviewState = document.querySelector('[data-review-state]');
    const recordingTimer = document.querySelector('[data-recording-timer]');
    const levelMeter = document.querySelector('[data-level-meter]');
    const recordingStop = document.querySelector('[data-recording-stop]');
    const recordingCancel = document.querySelector('[data-recording-cancel]');
    const reviewPlay = document.querySelector('[data-review-play]');
    const reviewProgress = document.querySelector('[data-review-progress]');
    const reviewTime = document.querySelector('[data-review-time]');
    const reviewRerecord = document.querySelector('[data-review-rerecord]');
    const reviewDelete = document.querySelector('[data-review-delete]');
    const reviewSend = document.querySelector('[data-review-send]');
    const reviewAudio = document.querySelector('[data-review-audio]');
    let conversations = [];
    let conversation = null;
    let messages = [];
    let pendingMessage = null;
    let nextCursor = null;
    let hasMore = false;
    let hub = null;
    let pollTimer = null;
    let sending = false;
    let blockedByMe = false;
    let blockedMe = false;
    let blockStatusLoaded = false;
    let blockStatusError = '';
    let historyLoading = false;
    let selectedImage = null;
    let selectedImageUrl = '';
    let uploadingImage = false;
    const imageBlobUrls = new Map();
    let imageClientMessageId = null;
    // حالة المكالمات (صوت/فيديو)
    let call = null;
    let callPeer = null;
    let callLocalStream = null;
    let callRemoteStream = null;
    let callIceConfig = null;
    let callTimer = null;
    let callRingTimer = null;
    let callElapsedSeconds = 0;
    let callStarting = false;
    let callAccepting = false;
    let callRemoteVideoSeen = false;
    let callLog = [];
    // حالة الرسائل الصوتية (تسجيل / مراجعة / رفع) وتنسيق تشغيل مشترك
    let voice = {
      state: 'idle', // idle | recording | review
      stream: null,
      recorder: null,
      chunks: [],
      blob: null,
      previewUrl: '',
      mimeType: '',
      duration: 0,
      clientMessageId: null,
      startedAt: 0,
      timer: null,
      audioContext: null,
      analyser: null
    };
    let startingVoice = false;
    let uploadingVoice = false;
    let voicePlayback = null; // عنصر الصوت النشط حاليًا (يُوقف عند تشغيل غيره)

    const setNotice = (message, type = 'info') => {
      notice.textContent = message;
      notice.className = `chat-notice notice ${type}`;
      notice.classList.toggle('hidden', !message);
    };
    const updateBlockControls = () => {
      const blocked = blockedByMe || blockedMe;
      const voiceLocked = !blockStatusLoaded || blocked || voice.state === 'recording' || voice.state === 'review';
      input.disabled = voiceLocked;
      submit.disabled = voiceLocked || sending;
      photoButton.disabled = voiceLocked || uploadingImage;
      micButton.disabled = !blockStatusLoaded || blocked
        || uploadingImage || uploadingVoice || startingVoice || voice.state === 'review';
      micButton.classList.toggle('recording', voice.state === 'recording');
      if (photoButton.disabled) closePhotoMenu();
      updateSendImageButtons();
      if (!blockStatusLoaded) {
        setNotice(blockStatusError || 'جارٍ التحقق من حالة الحظر...', blockStatusError ? 'error' : 'info');
      } else if (blockedByMe) {
        setNotice('لقد حظرت هذا المستخدم.', 'info');
      } else if (blockedMe) {
        setNotice('لا يمكنك إرسال رسائل جديدة إلى هذا المستخدم.', 'error');
      } else {
        setNotice('');
      }
      const blockLabel = document.querySelector('[data-chat-block-label]');
      if (blockLabel) blockLabel.textContent = blockedByMe ? 'إلغاء الحظر' : 'حظر المستخدم';
      updateCallControls();
    };
    const refreshBlockStatus = async () => {
      blockStatusLoaded = false;
      blockStatusError = '';
      updateBlockControls();
      try {
        const status = await api.getConversationBlockStatus(conversation.id);
        blockedByMe = status.blockedByMe === true;
        blockedMe = status.blockedMe === true;
        blockStatusLoaded = true;
      } catch (error) {
        console.error('Could not load conversation block status:', error);
        blockStatusError = error.message || 'تعذر التحقق من حالة الحظر. أعد المحاولة.';
      }
      updateBlockControls();
    };
    const setConnectionStatus = (state) => {
      const label = state === 'connected' ? 'متصل مباشرة'
        : state === 'reconnecting' ? 'جارٍ إعادة الاتصال...'
          : 'غير متصل — مزامنة دورية';
      document.querySelector('[data-chat-status]').textContent =
        `${label} • محادثة مرتبطة بحجز ${conversation?.bookingStatus === 'confirmed' ? 'مؤكد' : ''}`.trim();
      if (state === 'connected') stopPolling();
      else startPolling();
      // انقطاع الإشارة يمنع استمرار مكالمة نشطة فعليًا؛ نُنهيها حتى لا تعلق الوسائط.
      if ((state === 'disconnected' || state === 'reconnecting') && call?.status === 'active') {
        finishCall('failed');
      }
    };
    const startPolling = () => {
      if (pollTimer) return;
      pollTimer = window.setInterval(() => {
        const sync = conversation ? syncSelectedConversation() : refreshConversations();
        sync.catch((error) => {
          console.error('Chat synchronization failed:', error);
          if (conversation) setNotice(error.message || 'تعذر تحديث الرسائل.', 'error');
        });
      }, 3000);
    };
    const stopPolling = () => {
      if (!pollTimer) return;
      clearInterval(pollTimer);
      pollTimer = null;
    };
    const formatTime = (value) => {
      const date = new Date(value);
      return Number.isNaN(date.getTime())
        ? ''
        : new Intl.DateTimeFormat('ar-JO', { hour: '2-digit', minute: '2-digit' }).format(date);
    };
    const safePhoto = (value) => typeof value === 'string'
      && (/^https:\/\/[^\s]+$/i.test(value) || /^data:image\/(?:jpeg|png|webp);base64,/i.test(value));
    const createAvatar = (profile, className) => {
      const avatar = document.createElement('span');
      avatar.className = className;
      const initial = String(profile?.fullName || 'د').trim().charAt(0) || 'د';
      if (safePhoto(profile?.profilePhoto)) {
        const image = document.createElement('img');
        image.src = profile.profilePhoto;
        image.alt = '';
        avatar.append(image);
      } else {
        avatar.textContent = initial;
      }
      return avatar;
    };
    function renderConversations() {
      list.replaceChildren();
      if (!conversations.length) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = 'لا توجد محادثات بعد. تبدأ المحادثة بعد تأكيد حجز.';
        list.append(empty);
        return;
      }
      conversations.forEach((item) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'conversation-item';
        button.setAttribute('aria-current', String(item.id === conversation?.id));
        button.append(createAvatar(item.partner, 'conversation-avatar'));
        const copy = document.createElement('span');
        copy.className = 'conversation-copy';
        const top = document.createElement('span');
        top.className = 'conversation-topline';
        const name = document.createElement('strong');
        name.textContent = item.partner?.fullName || `@${item.partner?.username || 'مستخدم دَرْب'}`;
        top.append(name);
        const time = document.createElement('time');
        time.className = 'conversation-time';
        time.textContent = formatTime(item.lastActivityAt);
        top.append(time);
        const bottom = document.createElement('span');
        bottom.className = 'conversation-topline';
        const preview = document.createElement('span');
        preview.className = 'conversation-preview';
        preview.textContent = item.lastMessage?.type === 'voice'
          ? 'رسالة صوتية'
          : (item.lastMessage?.text || 'لا توجد رسائل بعد');
        bottom.append(preview);
        if (item.unreadCount > 0) {
          const unread = document.createElement('span');
          unread.className = 'conversation-unread';
          unread.textContent = item.unreadCount > 99 ? '99+' : String(item.unreadCount);
          unread.setAttribute('aria-label', `${item.unreadCount} رسائل غير مقروءة`);
          bottom.append(unread);
        }
        copy.append(top, bottom);
        button.append(copy);
        button.addEventListener('click', () => {
          openConversation(item).catch((error) => {
            console.error('Could not open conversation:', error);
            setNotice(error.message || 'تعذر فتح المحادثة.', 'error');
          });
        });
        list.append(button);
      });
    }

    async function refreshConversations() {
      listState.textContent = 'جار تحميل المحادثات...';
      try {
        conversations = await api.getConversations();
        window.dispatchEvent(new CustomEvent('darb:conversations-updated', {
          detail: { conversations }
        }));
        listState.textContent = conversations.length ? '' : 'محادثاتك محفوظة هنا.';
        renderConversations();
      } catch (error) {
        listState.textContent = error.message || 'تعذر تحميل المحادثات.';
        throw error;
      }
    }

    function upsertMessage(message) {
      if (!message?.id) return;
      const index = messages.findIndex((item) => item.id === message.id
        || (message.clientMessageId && item.clientMessageId === message.clientMessageId));
      if (index === -1) messages.push(message);
      else messages[index] = { ...messages[index], ...message };
      messages.sort((first, second) => String(first.createdAt).localeCompare(String(second.createdAt))
        || String(first.id).localeCompare(String(second.id)));
    }

    function renderMessages(preserveScroll = false, forceBottom = false) {
      const previousHeight = host.scrollHeight;
      const previousTop = host.scrollTop;
      // هل كان المستخدم قريبًا من نهاية صندوق الرسائل قبل إعادة الرسم؟
      // نعتمد عليه كي لا نُجبره على النزول للأسفل وهو يقرأ رسائل قديمة.
      const wasNearBottom = previousHeight - previousTop - host.clientHeight <= 80;
      host.replaceChildren();
      const settledCalls = callLog.filter((entry) => entry.status !== 'ringing' && entry.status !== 'active');
      if (!messages.length && !pendingMessage && !settledCalls.length) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = 'ابدأ المحادثة برسالة متعلقة بالرحلة.';
        host.append(empty);
      }
      const entries = messages.map((message) => ({
        at: String(message.createdAt),
        element: createMessageElement(message)
      }));
      settledCalls.forEach((entry) => entries.push({
        at: String(entry.endedAt || entry.requestedAt),
        element: createCallElement(entry)
      }));
      entries.sort((first, second) => first.at.localeCompare(second.at));
      entries.forEach((entry) => host.append(entry.element));
      if (pendingMessage) host.append(createMessageElement(pendingMessage));
      if (preserveScroll) {
        // الحفاظ على موضع القراءة عند إضافة رسائل أقدم في الأعلى.
        host.scrollTop = host.scrollHeight - previousHeight + previousTop;
      } else if (forceBottom || wasNearBottom) {
        host.scrollTop = host.scrollHeight;
      } else {
        // وصول رسالة جديدة والمستخدم يقرأ بالأعلى: لا نُحرّك عرضه.
        host.scrollTop = previousTop;
      }
    }

    function createMessageElement(message) {
      const mine = message.senderId === user.id;
      const item = document.createElement('article');
      item.className = `chat-message${mine ? ' mine' : ''}${message.failed ? ' failed' : ''}`;
      const bubble = document.createElement('div');
      bubble.className = 'chat-bubble';
      const imageData = message.type === 'image' && message.image && typeof message.image === 'object'
        ? message.image
        : null;
      const voiceData = message.type === 'voice' && message.audio && typeof message.audio === 'object'
        ? message.audio
        : null;
      if (voiceData) {
        bubble.classList.add('chat-bubble-voice');
        appendVoiceContent(bubble, message, voiceData);
      } else if (imageData) {
        bubble.classList.add('chat-bubble-image');
        appendImageContent(bubble, message, imageData);
      } else {
        bubble.textContent = String(message.text || '');
      }
      const meta = document.createElement('div');
      meta.className = 'chat-meta';
      const time = document.createElement('time');
      time.textContent = formatTime(message.createdAt) || (message.pending ? 'الآن' : '');
      meta.append(time);
      if (mine) {
        const state = document.createElement('span');
        state.className = message.failed ? 'chat-status-error' : message.readAt || message.read
          ? 'chat-status-read' : '';
        state.textContent = message.failed ? 'تعذر الإرسال'
          : message.pending ? 'قيد الإرسال'
            : message.readAt || message.read ? 'تمت القراءة'
              : message.deliveredAt || message.delivered ? 'تم التسليم' : 'تم الإرسال';
        meta.append(state);
        if (message.failed) {
          const retry = document.createElement('button');
          retry.type = 'button';
          retry.className = 'chat-retry';
          retry.textContent = 'إعادة المحاولة';
          retry.addEventListener('click', () => {
            if (message.type === 'image') sendSelectedImage();
            else form.requestSubmit();
          });
          meta.append(retry);
        }
      }
      item.append(bubble, meta);
      return item;
    }

    function appendImageContent(bubble, message, imageData) {
      const imageEl = document.createElement('img');
      imageEl.className = 'chat-image-content';
      const imageUrl = typeof imageData.url === 'string' ? imageData.url : '';
      const isLocal = message.pending || message.failed || /^blob:|^data:/.test(imageUrl);
      if (!imageUrl || (isLocal && !/^blob:|^data:/.test(imageUrl))) {
        // صورة لم تُرفع بعد (فشل الإرسال) أو رابط غير صالح: نعرض مكانًا محجوزًا.
        imageEl.classList.add('chat-image-error');
        imageEl.alt = message.failed ? 'تعذر إرسال الصورة' : 'صورة';
      } else if (isLocal) {
        imageEl.src = imageUrl;
        imageEl.alt = 'صورة';
        imageEl.addEventListener('click', () => showLightbox(imageUrl, 'صورة'));
      } else {
        imageEl.classList.add('chat-image-loading');
        imageEl.alt = '';
        ensureImage(imageUrl).then((objectUrl) => {
          if (!imageEl.isConnected || !objectUrl) return;
          imageEl.classList.remove('chat-image-loading');
          imageEl.src = objectUrl;
          imageEl.alt = 'صورة';
          imageEl.addEventListener('click', () => showLightbox(objectUrl, 'صورة'));
        }).catch((error) => {
          if (!imageEl.isConnected) return;
          imageEl.classList.remove('chat-image-loading');
          imageEl.classList.add('chat-image-error');
          imageEl.alt = 'تعذر تحميل الصورة';
          console.error('Could not load the image:', error);
        });
      }
      bubble.append(imageEl);
    }

    // ------------------------------------------------------------------
    // الرسائل الصوتية: تسجيل عبر MediaRecorder، مراجعة قبل الإرسال، رفع
    // multipart إلى الخادم، وتشغيل آمن عبر نقطة المصادقة (بدون Base64).
    // ------------------------------------------------------------------
    const VOICE_MAX_SECONDS = 120;
    const VOICE_MAX_BYTES = 5 * 1024 * 1024;
    const VOICE_PLAY_ICON = '<svg class="chat-voice-icon-play" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.14v13.72c0 .8.87 1.3 1.56.88l10.5-6.86a1.05 1.05 0 0 0 0-1.76L9.56 4.26A1.04 1.04 0 0 0 8 5.14Z"/></svg>';
    const VOICE_PAUSE_ICON = '<svg class="chat-voice-icon-pause" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4.5" height="16" rx="1.4"/><rect x="13.5" y="4" width="4.5" height="16" rx="1.4"/></svg>';
    const voiceBlobUrls = new Map(); // message.id -> Object URL لتفادي إعادة التحميل

    function normalizeVoiceMime(type) {
      return String(type || '').split(';')[0].trim().toLowerCase();
    }

    function pickVoiceMimeType() {
      if (typeof MediaRecorder === 'undefined') return '';
      const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/ogg'];
      for (const candidate of candidates) {
        try {
          if (MediaRecorder.isTypeSupported(candidate)) return candidate;
        } catch (error) { /* ignore */ }
      }
      return '';
    }

    function voiceExtensionForMime(mime) {
      const base = normalizeVoiceMime(mime);
      if (base === 'audio/mp4' || base === 'audio/x-m4a' || base === 'audio/3gpp') return '.mp4';
      if (base === 'audio/ogg' || base === 'audio/opus') return '.ogg';
      if (base === 'audio/mpeg' || base === 'audio/mp3') return '.mp3';
      if (base === 'audio/wav' || base === 'audio/x-wav') return '.wav';
      return '.webm';
    }

    function setVoicePermissionError(error) {
      if (error?.name === 'NotAllowedError') {
        setNotice('من فضلك ائذن بالوصول إلى الميكروفون لتسجيل رسالة صوتية.', 'error');
      } else if (error?.name === 'NotFoundError') {
        setNotice('تعذر العثور على ميكروفون متاح على هذا الجهاز.', 'error');
      } else if (error?.name === 'NotReadableError') {
        setNotice('الميكروفون قيد الاستخدام من تطبيق آخر أو لا يستجيب. أعد المحاولة.', 'error');
      } else {
        setNotice(error?.message || 'تعذر بدء التسجيل الصوتي.', 'error');
      }
    }

    function cleanupVoicePreview() {
      if (voice.previewUrl) {
        URL.revokeObjectURL(voice.previewUrl);
        voice.previewUrl = '';
      }
      reviewAudio.pause();
      reviewAudio.removeAttribute('src');
      reviewAudio.currentTime = 0;
      reviewProgress.value = '0';
      reviewProgress.style.removeProperty('--chat-voice-fill');
      reviewTime.textContent = '00:00 / 00:00';
      reviewPlay.classList.remove('playing');
      voice.blob = null;
      voice.duration = 0;
      voice.clientMessageId = null;
      voice.mimeType = '';
    }

    function releaseVoiceStream() {
      if (!voice.stream) return;
      voice.stream.getTracks().forEach((track) => { try { track.stop(); } catch (error) { /* ignore */ } });
      voice.stream = null;
    }

    function teardownVoiceAnalyser() {
      if (voice.audioContext) {
        try { voice.audioContext.close(); } catch (error) { /* ignore */ }
        voice.audioContext = null;
      }
      voice.analyser = null;
    }

    function closeVoicePanel() {
      voicePanel.classList.add('hidden');
      recordingState.classList.add('hidden');
      reviewState.classList.add('hidden');
    }

    function showRecordingState() {
      reviewState.classList.add('hidden');
      recordingState.classList.remove('hidden');
      voicePanel.classList.remove('hidden');
      updateBlockControls();
    }

    function showReviewState() {
      recordingState.classList.add('hidden');
      reviewState.classList.remove('hidden');
      voicePanel.classList.remove('hidden');
      updateBlockControls();
    }

    function resetVoiceToIdle() {
      clearInterval(voice.timer);
      voice.timer = null;
      teardownVoiceAnalyser();
      if (voice.recorder && voice.recorder.state !== 'inactive') {
        try { voice.recorder.stop(); } catch (error) { /* ignore */ }
      }
      voice.recorder = null;
      voice.chunks = [];
      releaseVoiceStream();
      cleanupVoicePreview();
      voice.state = 'idle';
      closeVoicePanel();
      updateBlockControls();
    }

    function setupVoiceLevelMeter() {
      try {
        const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextCtor || !voice.stream) return;
        const context = new AudioContextCtor();
        const source = context.createMediaStreamSource(voice.stream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.65;
        source.connect(analyser);
        voice.audioContext = context;
        voice.analyser = analyser;
      } catch (error) {
        voice.analyser = null;
      }
    }

    function updateVoiceLevelMeter() {
      if (!voice.analyser || !levelMeter) return;
      const bars = Array.from(levelMeter.children);
      if (!bars.length) return;
      const levels = new Uint8Array(voice.analyser.frequencyBinCount);
      voice.analyser.getByteFrequencyData(levels);
      const bins = levels.slice(0, Math.floor(levels.length * 0.7));
      const average = bins.length ? bins.reduce((sum, value) => sum + value, 0) / bins.length : 0;
      const normalized = Math.min(1, average / 140);
      const height = Math.max(14, Math.round(normalized * 100));
      bars.forEach((bar, index) => {
        bar.style.height = `${height}%`;
        bar.classList.toggle('on', normalized >= (index + 1) / bars.length - 0.12);
      });
    }

    function stopVoiceRecording() {
      const recorder = voice.recorder;
      if (!recorder || recorder.state === 'inactive') return;
      recorder.stop();
    }

    async function startVoiceRecording() {
      if (startingVoice || voice.state !== 'idle' || uploadingVoice) return;
      if (!conversation || !blockStatusLoaded || blockedByMe || blockedMe) {
        setNotice(blockedMe ? 'لا يمكنك إرسال رسائل جديدة إلى هذا المستخدم.'
          : blockedByMe ? 'لقد حظرت هذا المستخدم.'
            : 'جارٍ التحقق من حالة الحظر قبل التسجيل.', 'error');
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        setNotice('متصفحك لا يدعم تسجيل الرسائل الصوتية. أرسل رسالة نصية بدلاً من ذلك.', 'error');
        return;
      }
      const mimeType = pickVoiceMimeType();
      if (!mimeType) {
        setNotice('متصفحك لا يدعم صيغ التسجيل الصوتي المدعومة.', 'error');
        return;
      }
      if (voicePlayback) { try { voicePlayback.pause(); } catch (error) { /* ignore */ } }
      closePhotoMenu();
      startingVoice = true;
      updateBlockControls();
      setNotice('');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        let recorder;
        try {
          recorder = new MediaRecorder(stream, { mimeType });
        } catch (optionsError) {
          recorder = new MediaRecorder(stream);
        }
        voice.stream = stream;
        voice.recorder = recorder;
        voice.chunks = [];
        voice.mimeType = mimeType;
        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) voice.chunks.push(event.data);
        };
        recorder.onstop = () => {
          // جلسة تسجيل أحدث بدأت أو أُهملت هذه الجلسة: نتجاهل بياناتها بصمت.
          if (voice.recorder !== recorder) return;
          clearInterval(voice.timer);
          voice.timer = null;
          teardownVoiceAnalyser();
          releaseVoiceStream();
          voice.recorder = null;
          const duration = Math.max(0, (Date.now() - voice.startedAt) / 1000);
          const mime = normalizeVoiceMime(recorder.mimeType || voice.mimeType);
          let blob;
          try {
            blob = new Blob(voice.chunks, { type: mime });
          } catch (error) {
            blob = null;
          }
          voice.chunks = [];
          if (!blob || duration < 0.4 || blob.size === 0) {
            voice.state = 'idle';
            closeVoicePanel();
            setNotice('التسجيل قصير جدًا. أعد المحاولة.', 'error');
            updateBlockControls();
            return;
          }
          if (blob.size > VOICE_MAX_BYTES) {
            voice.state = 'idle';
            closeVoicePanel();
            setNotice('حجم التسجيل كبير جدًا. أعد المحاولة.', 'error');
            updateBlockControls();
            return;
          }
          voice.blob = blob;
          voice.mimeType = blob.type;
          voice.duration = duration;
          voice.previewUrl = URL.createObjectURL(blob);
          reviewAudio.src = voice.previewUrl;
          reviewAudio.load();
          reviewTime.textContent = `00:00 / ${secondsToTimer(Math.floor(duration))}`;
          reviewProgress.value = '0';
          reviewProgress.style.setProperty('--chat-voice-fill', '0%');
          voice.state = 'review';
          showReviewState();
        };
        recorder.start();
        voice.startedAt = Date.now();
        voice.duration = 0;
        recordingTimer.textContent = '00:00';
        voice.state = 'recording';
        showRecordingState();
        setupVoiceLevelMeter();
        voice.timer = window.setInterval(() => {
          const elapsed = (Date.now() - voice.startedAt) / 1000;
          voice.duration = elapsed;
          recordingTimer.textContent = secondsToTimer(Math.floor(elapsed));
          updateVoiceLevelMeter();
          if (elapsed >= VOICE_MAX_SECONDS) {
            setNotice('تم بلوغ الحد الأقصى للتسجيل (دقيقتان).');
            stopVoiceRecording();
          }
        }, 200);
      } catch (error) {
        setVoicePermissionError(error);
      } finally {
        startingVoice = false;
        updateBlockControls();
      }
    }

    function pauseOtherVoicePlayback(audio) {
      if (voicePlayback && voicePlayback !== audio) {
        try { voicePlayback.pause(); } catch (error) { /* ignore */ }
      }
    }

    function toggleVoiceReviewPlay() {
      if (!reviewAudio.src) return;
      if (reviewAudio.paused) {
        pauseOtherVoicePlayback(reviewAudio);
        reviewAudio.play().catch(() => {
          setNotice('تعذر تشغيل التسجيل.', 'error');
        });
      } else {
        reviewAudio.pause();
      }
    }

    async function sendVoiceRecording() {
      if (!conversation || voice.state !== 'review' || uploadingVoice || !voice.blob) return;
      if (!blockStatusLoaded) {
        setNotice('جارٍ التحقق من حالة الحظر قبل الإرسال.', 'info');
        return;
      }
      if (blockedByMe || blockedMe) {
        setNotice(blockedMe ? 'لا يمكنك إرسال رسائل جديدة إلى هذا المستخدم.'
          : 'لقد حظرت هذا المستخدم.', 'error');
        return;
      }
      const blob = voice.blob;
      const duration = voice.duration;
      const mimeType = voice.mimeType;
      const clientMessageId = voice.clientMessageId || crypto.randomUUID();
      voice.clientMessageId = clientMessageId;
      uploadingVoice = true;
      updateBlockControls();
      pendingMessage = {
        id: `pending-${clientMessageId}`,
        clientMessageId,
        senderId: user.id,
        type: 'voice',
        audio: { url: voice.previewUrl, mimeType, duration, size: blob.size },
        createdAt: new Date().toISOString(),
        pending: true
      };
      renderMessages(false, true);
      try {
        const saved = await api.uploadVoiceMessage(conversation.id, {
          audio: blob,
          fileName: `voice${voiceExtensionForMime(mimeType)}`,
          clientMessageId,
          duration,
          mimeType
        });
        pendingMessage = null;
        upsertMessage(saved);
        resetVoiceToIdle();
        setNotice('');
        renderMessages(false, true);
        await refreshConversations();
      } catch (error) {
        // لا نُبقي فقاعة معلقة؛ تبقى لوحة المراجعة مفتوحة مع التسجيل لإعادة المحاولة.
        pendingMessage = null;
        renderMessages(false, true);
        setNotice(error.message || 'تعذر إرسال الرسالة الصوتية. أعد المحاولة.', 'error');
        if (error.status === 403) await refreshBlockStatus();
      } finally {
        uploadingVoice = false;
        updateBlockControls();
        if (voice.state === 'review') reviewSend.focus();
        else input.focus();
      }
    }

    reviewPlay.innerHTML = `${VOICE_PLAY_ICON}${VOICE_PAUSE_ICON}`;
    reviewAudio.addEventListener('play', () => {
      reviewPlay.classList.add('playing');
      reviewPlay.setAttribute('aria-label', 'إيقاف التسجيل مؤقتًا');
      voicePlayback = reviewAudio;
    });
    reviewAudio.addEventListener('pause', () => {
      reviewPlay.classList.remove('playing');
      reviewPlay.setAttribute('aria-label', 'تشغيل التسجيل');
      if (voicePlayback === reviewAudio) voicePlayback = null;
    });
    reviewAudio.addEventListener('ended', () => {
      reviewProgress.value = '0';
      reviewProgress.style.setProperty('--chat-voice-fill', '0%');
      reviewTime.textContent = `00:00 / ${secondsToTimer(Math.floor(reviewAudio.duration || voice.duration))}`;
    });
    reviewAudio.addEventListener('timeupdate', () => {
      if (reviewAudio.duration && Number.isFinite(reviewAudio.duration) && reviewAudio.duration > 0) {
        const fraction = reviewAudio.currentTime / reviewAudio.duration;
        reviewProgress.value = String(Math.round(fraction * 1000));
        reviewProgress.style.setProperty('--chat-voice-fill', `${(fraction * 100).toFixed(1)}%`);
      }
      reviewTime.textContent = `${secondsToTimer(Math.floor(reviewAudio.currentTime))} / ${secondsToTimer(Math.floor(reviewAudio.duration || voice.duration))}`;
    });
    reviewProgress.addEventListener('input', () => {
      if (!reviewAudio.duration || !Number.isFinite(reviewAudio.duration)) return;
      reviewAudio.currentTime = (Number(reviewProgress.value) / 1000) * reviewAudio.duration;
    });

    // فقاعة الرسالة الصوتية داخل المحادثة: تشغيل/إيقاف مع مؤشر تقدم وزمن.
    function appendVoiceContent(bubble, message, audioData) {
      const wrapper = document.createElement('div');
      wrapper.className = 'chat-voice';

      const play = document.createElement('button');
      play.type = 'button';
      play.className = 'chat-voice-play';
      play.setAttribute('aria-label', 'تشغيل الرسالة الصوتية');
      play.innerHTML = `${VOICE_PLAY_ICON}${VOICE_PAUSE_ICON}`;

      const body = document.createElement('div');
      body.className = 'chat-voice-body';

      const progress = document.createElement('input');
      progress.type = 'range';
      progress.className = 'chat-voice-progress';
      progress.min = '0';
      progress.max = '1000';
      progress.value = '0';
      progress.setAttribute('aria-label', 'موضع التشغيل');

      const time = document.createElement('span');
      time.className = 'chat-voice-time';

      const audio = document.createElement('audio');
      audio.preload = 'none';

      const errorHost = document.createElement('div');
      errorHost.className = 'chat-voice-error hidden';

      const durationSec = Math.max(0, Number(audioData?.duration) || 0);
      time.textContent = `00:00 / ${secondsToTimer(Math.floor(durationSec))}`;

      const localUrl = typeof audioData?.url === 'string' && /^blob:/.test(audioData.url)
        ? audioData.url
        : '';
      let loadedUrl = localUrl || voiceBlobUrls.get(message.id) || '';

      const loadSource = async () => {
        if (loadedUrl) return loadedUrl;
        if (!conversation || typeof audioData?.url !== 'string') {
          setError('تعذر تحميل الرسالة الصوتية.');
          return '';
        }
        try {
          const objectUrl = await api.fetchVoiceAudio(audioData.url);
          voiceBlobUrls.set(message.id, objectUrl);
          loadedUrl = objectUrl;
          audio.src = objectUrl;
          errorHost.classList.add('hidden');
          return objectUrl;
        } catch (error) {
          setError('تعذر تحميل الرسالة الصوتية.');
          return '';
        }
      };

      const setError = (errorText) => {
        errorHost.textContent = '';
        const label = document.createElement('span');
        label.textContent = errorText;
        errorHost.append(label);
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'chat-voice-retry';
        retry.textContent = 'إعادة المحاولة';
        retry.addEventListener('click', () => {
          loadSource().catch(() => {});
        });
        errorHost.append(retry);
        errorHost.classList.remove('hidden');
      };

      play.addEventListener('click', async () => {
        if (audio.paused) {
          const source = await loadSource();
          if (!source) return;
          pauseOtherVoicePlayback(audio);
          audio.play().catch((error) => {
            console.error('Could not play the voice message:', error);
            setNotice('تعذر تشغيل الرسالة الصوتية.', 'error');
          });
        } else {
          audio.pause();
        }
      });

      progress.addEventListener('input', () => {
        if (audio.duration && Number.isFinite(audio.duration)) {
          audio.currentTime = (Number(progress.value) / 1000) * audio.duration;
        }
      });

      audio.addEventListener('play', () => {
        play.classList.add('playing');
        play.setAttribute('aria-label', 'إيقاف الرسالة الصوتية مؤقتًا');
        voicePlayback = audio;
      });
      audio.addEventListener('pause', () => {
        play.classList.remove('playing');
        play.setAttribute('aria-label', 'تشغيل الرسالة الصوتية');
        if (voicePlayback === audio) voicePlayback = null;
      });
      audio.addEventListener('ended', () => {
        progress.value = '0';
        progress.style.setProperty('--chat-voice-fill', '0%');
      });
      audio.addEventListener('timeupdate', () => {
        if (audio.duration && Number.isFinite(audio.duration) && audio.duration > 0) {
          const fraction = audio.currentTime / audio.duration;
          progress.value = String(Math.round(fraction * 1000));
          progress.style.setProperty('--chat-voice-fill', `${(fraction * 100).toFixed(1)}%`);
          time.textContent = `${secondsToTimer(Math.floor(audio.currentTime))} / ${secondsToTimer(Math.floor(audio.duration))}`;
        }
      });
      audio.addEventListener('error', () => {
        if (!audio.error) return;
        voiceBlobUrls.delete(message.id);
        loadedUrl = '';
        setError('تعذر تشغيل الرسالة الصوتية.');
      });

      body.append(progress, errorHost, time);
      wrapper.append(play, body);
      bubble.append(wrapper, audio);

      if (loadedUrl) audio.src = loadedUrl;
    }

    function formatBytes(value) {
      const bytes = Number(value);
      if (!Number.isFinite(bytes) || bytes < 0) return '';
      if (bytes < 1024) return `${bytes} بايت`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} كيلوبايت`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} ميغابايت`;
    }

    async function ensureImage(relativeUrl) {
      // الصور خاصة: تُجلَب عبر نقطة مصادقة، وتُخزَّن مؤقتًا كـ Object URL
      // حتى لا يُعاد التحميل عند كل إعادة رسم للرسائل.
      if (!conversation) return '';
      const cached = imageBlobUrls.get(relativeUrl);
      if (cached) return cached;
      const objectUrl = await api.loadImage(conversation.id, relativeUrl);
      imageBlobUrls.set(relativeUrl, objectUrl);
      return objectUrl;
    }

    function showLightbox(url, alt) {
      lightboxImage.src = url;
      lightboxImage.alt = alt || 'صورة';
      lightbox.classList.remove('hidden');
      document.body.classList.add('lightbox-open');
      lightboxClose.focus();
    }

    function closeLightbox() {
      lightbox.classList.add('hidden');
      lightboxImage.removeAttribute('src');
      lightboxImage.alt = '';
      document.body.classList.remove('lightbox-open');
    }

    function closePhotoMenu() {
      photoMenu.classList.add('hidden');
      photoButton.setAttribute('aria-expanded', 'false');
    }

    function clearImageSelection() {
      if (selectedImageUrl) URL.revokeObjectURL(selectedImageUrl);
      selectedImage = null;
      selectedImageUrl = '';
      imageClientMessageId = null;
      // إن كان هناك فقاعة صورة فاشلة (أو قيد الإرسال) تشير إلى هذه المعاينة،
      // نزيلها حتى لا يُعرض رابط مُلغى أو تُعاد محاولة إرسال معاينة محذوفة.
      if (pendingMessage && pendingMessage.type === 'image') pendingMessage = null;
      fileInput.value = '';
      cameraInput.value = '';
      previewThumb.removeAttribute('src');
      previewName.textContent = '';
      previewSize.textContent = '';
      previewProgress.classList.add('hidden');
      previewProgress.textContent = 'جارٍ رفع الصورة...';
      previewPanel.classList.add('hidden');
      sendImageButton.disabled = false;
      cancelImageButton.disabled = false;
      replaceImageButton.disabled = false;
    }

    function updateSendImageButtons() {
      const locked = uploadingImage || !blockStatusLoaded || blockedByMe || blockedMe;
      sendImageButton.disabled = locked || !selectedImage;
      cancelImageButton.disabled = uploadingImage;
      replaceImageButton.disabled = uploadingImage;
    }

    const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

    function selectImageFile(file) {
      closePhotoMenu();
      if (!file) return;
      // التحقق المبدئي من النوع والحجم قبل الرفع؛ الخادم يتحقق مجددًا من المحتوى.
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        setNotice('صيغة الصورة غير مدعومة. استخدم JPEG أو PNG أو WebP.', 'error');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setNotice('حجم الصورة كبير جدًا. الحد الأقصى 10 ميغابايت.', 'error');
        return;
      }
      if (selectedImageUrl) URL.revokeObjectURL(selectedImageUrl);
      selectedImage = file;
      selectedImageUrl = URL.createObjectURL(file);
      imageClientMessageId = crypto.randomUUID();
      previewThumb.src = selectedImageUrl;
      previewName.textContent = file.name || 'صورة';
      previewSize.textContent = formatBytes(file.size);
      previewPanel.classList.remove('hidden');
      previewProgress.classList.add('hidden');
      updateSendImageButtons();
      setNotice('');
    }

    async function sendSelectedImage() {
      if (!conversation || uploadingImage || !selectedImage) return;
      if (!blockStatusLoaded) {
        setNotice('جارٍ التحقق من حالة الحظر قبل الإرسال.', 'info');
        return;
      }
      if (blockedByMe || blockedMe) {
        setNotice(blockedMe ? 'لا يمكنك إرسال رسائل جديدة إلى هذا المستخدم.'
          : 'لقد حظرت هذا المستخدم.', 'error');
        return;
      }
      const file = selectedImage;
      const clientMessageId = imageClientMessageId || crypto.randomUUID();
      imageClientMessageId = clientMessageId;
      uploadingImage = true;
      updateSendImageButtons();
      updateBlockControls();
      previewProgress.textContent = 'جارٍ رفع الصورة... 0%';
      previewProgress.classList.remove('hidden');
      const localUrl = selectedImageUrl;
      pendingMessage = {
        id: `pending-${clientMessageId}`,
        clientMessageId,
        senderId: user.id,
        type: 'image',
        image: { url: localUrl, mimeType: file.type, size: file.size },
        createdAt: new Date().toISOString(),
        pending: true
      };
      renderMessages(false, true);
      try {
        // رفع فعلي عبر multipart ثم حفظ الرسالة؛ لا نُعلن النجاح قبل حفظها.
        const saved = await api.sendImageMessage(conversation.id, file, clientMessageId, (percent) => {
          previewProgress.textContent = `جارٍ رفع الصورة... ${percent}%`;
        });
        pendingMessage = null;
        upsertMessage(saved);
        clearImageSelection();
        setNotice('');
        renderMessages(false, true);
        await refreshConversations();
      } catch (error) {
        if (pendingMessage) {
          pendingMessage.failed = true;
          pendingMessage.pending = false;
        }
        renderMessages(false, true);
        previewProgress.classList.add('hidden');
        setNotice(error.message || 'تعذر إرسال الصورة. أعد المحاولة.', 'error');
        if (error.status === 403) await refreshBlockStatus();
      } finally {
        uploadingImage = false;
        updateSendImageButtons();
        updateBlockControls();
        if (!sendImageButton.disabled) sendImageButton.focus();
      }
    }

    function formatCallDuration(seconds) {
      const total = Math.max(0, Math.floor(Number(seconds) || 0));
      const minutes = Math.floor(total / 60);
      const rest = total % 60;
      return minutes > 0 ? `${minutes} د ${String(rest).padStart(2, '0')} ث` : `${rest} ث`;
    }

    function createCallElement(entry) {
      const kind = entry.type === 'video' ? 'فيديو' : 'صوتية';
      let label;
      switch (entry.status) {
        case 'completed':
          label = `مكالمة ${kind}${entry.durationSeconds > 0 ? ` (${formatCallDuration(entry.durationSeconds)})` : ''}`;
          break;
        case 'missed':
          label = `مكالمة ${kind} فائتة`;
          break;
        case 'rejected':
          label = `مكالمة ${kind} مرفوضة`;
          break;
        case 'cancelled':
          label = `أُلغيت مكالمة ${kind}`;
          break;
        case 'failed':
          label = `تعذر إجراء مكالمة ${kind}`;
          break;
        default:
          label = `مكالمة ${kind}`;
      }
      const item = document.createElement('div');
      item.className = 'chat-call-entry';
      item.textContent = label;
      return item;
    }

    async function refreshCallLog() {
      if (!conversation) { callLog = []; renderMessages(true); return; }
      try {
        const result = await api.getConversationCalls(conversation.id);
        callLog = Array.isArray(result.items) ? result.items : [];
      } catch (error) {
        console.error('Could not load the call log:', error);
        callLog = [];
      }
      renderMessages(true);
    }

    async function acknowledgeIncoming() {
      if (!conversation) return;
      const incoming = messages.filter((message) => message.receiverId === user.id);
      const undelivered = incoming.filter((message) => !message.deliveredAt && !message.delivered)
        .map((message) => message.id);
      if (undelivered.length) {
        const result = await api.acknowledgeDelivery(conversation.id, undelivered);
        result.deliveredMessageIds.forEach((id) => {
          const message = messages.find((item) => item.id === id);
          if (message) {
            message.delivered = true;
            message.deliveredAt = result.deliveredAt;
          }
        });
      }
      if (readReceiptsEnabled && incoming.some((message) => !message.readAt && !message.read)) {
        const unread = incoming.filter((message) => !message.readAt && !message.read)
          .map((message) => message.id);
        const result = await api.markMessagesRead(conversation.id, unread);
        result.readMessageIds.forEach((id) => {
          const message = incoming.find((item) => item.id === id);
          if (!message) return;
          message.read = true;
          message.readAt = result.readAt;
        });
      }
      renderMessages();
    }

    async function syncSelectedConversation() {
      if (!conversation) return;
      const result = await api.getMessages(conversation.id, null, 50);
      result.items.forEach(upsertMessage);
      if (!historyLoading) {
        hasMore = result.hasMore;
        nextCursor = result.nextCursor;
        olderButton.classList.toggle('hidden', !hasMore);
      }
      renderMessages();
      await acknowledgeIncoming();
      await refreshConversations();
    }

    async function handleHubEvent(type, update) {
      if (type === 'call:incoming') { await handleIncomingCall(update); return; }
      if (type === 'call:accepted') { await handleCallAccepted(update); return; }
      if (type === 'call:ended') { await handleCallEnded(update); return; }
      if (type === 'call:signal') { await handleCallSignal(update); return; }
      if (type === 'message') {
        if (update.conversationId === conversation?.id) {
          upsertMessage(update);
          renderMessages();
          try {
            await acknowledgeIncoming();
          } catch (error) {
            console.error('Message acknowledgment failed:', error);
            setNotice('وصلت الرسالة، لكن تعذر تحديث حالة التسليم أو القراءة.', 'error');
          }
        }
        await refreshConversations();
        return;
      }
      if (type === 'delivered' || type === 'read') {
        if (update.conversationId === conversation?.id) {
          const timestamp = type === 'read' ? update.readAt : update.deliveredAt;
          update.messageIds.forEach((id) => {
            const message = messages.find((item) => item.id === id);
            if (message) {
              if (type === 'read') message.readAt = timestamp;
              else message.deliveredAt = timestamp;
            }
          });
          renderMessages();
        }
        await refreshConversations();
        return;
      }
      if (type === 'conversation') {
        await refreshConversations();
        if (update.conversationId === conversation?.id) await refreshBlockStatus();
      }
    }

    async function openConversation(item) {
      const details = await api.getConversation(item.id);
      if (!details.participantIds?.includes(user.id)) throw new Error('ليس لديك صلاحية لهذه المحادثة.');
      const otherId = details.participantIds.find((id) => id !== user.id);
      if (!otherId) throw new Error('بيانات المحادثة غير صالحة.');
      const selectedPartner = item.partner?.profilePhoto === undefined
        ? await api.getPublicProfile(otherId)
        : item.partner;
      conversation = { ...details, partner: selectedPartner };
      const partner = conversation.partner;
      messages = [];
      pendingMessage = null;
      if (voice.state !== 'idle') resetVoiceToIdle();
      nextCursor = null;
      hasMore = false;
      blockedByMe = false;
      blockedMe = false;
      blockStatusLoaded = false;
      // معاينة صورة مختارة من محادثة سابقة لا تناسب المحادثة الجديدة.
      clearImageSelection();
      closeLightbox();
      document.querySelector('[data-chat-name]').textContent = partner.fullName || 'مستخدم دَرْب';
      document.querySelector('[data-chat-status]').textContent = 'جارٍ الاتصال...';
      const avatarHost = document.querySelector('[data-chat-avatar]');
      const avatar = createAvatar(partner, 'chat-avatar');
      avatarHost.replaceWith(avatar);
      avatar.dataset.chatAvatar = '';
      const profileLink = document.querySelector('[data-chat-profile]');
      profileLink.href = `profile.html?user=${encodeURIComponent(otherId)}`;
      profileLink.classList.remove('hidden');
      closeChatMenu();
      updateBlockControls();
      emptyState.classList.add('hidden');
      thread.classList.remove('hidden');
      workspace.classList.add('has-active');
      workspace.classList.remove('show-list');
      renderConversations();
      await refreshBlockStatus();
      await syncSelectedConversation();
      await refreshCallLog();
      try {
        if (hub) await hub.switchTo(conversation.id);
        else {
          hub = await api.connectChat(conversation.id, handleHubEvent, setConnectionStatus, syncSelectedConversation);
        }
      } catch (error) {
        console.error('SignalR connection failed; periodic synchronization will be used:', error);
        setConnectionStatus('disconnected');
      }
    }

    async function loadOlderMessages() {
      if (!conversation || !hasMore || !nextCursor || historyLoading) return;
      historyLoading = true;
      olderButton.disabled = true;
      try {
        const result = await api.getMessages(conversation.id, nextCursor, 50);
        const older = result.items.filter((message) => !messages.some((item) => item.id === message.id));
        messages = [...older, ...messages];
        hasMore = result.hasMore;
        nextCursor = result.nextCursor;
        olderButton.classList.toggle('hidden', !hasMore);
        renderMessages(true);
        await acknowledgeIncoming();
      } catch (error) {
        setNotice(error.message || 'تعذر تحميل الرسائل الأقدم.', 'error');
      } finally {
        historyLoading = false;
        olderButton.disabled = false;
      }
    }

    // ------------------------------------------------------------------
    // المكالمات الصوتية والمرئية عبر WebRTC (تنسيق الإشارات عبر SignalR)
    // ------------------------------------------------------------------
    const callOverlay = document.querySelector('[data-call-overlay]');
    const callViews = {
      incoming: callOverlay.querySelector('[data-call-view="incoming"]'),
      outgoing: callOverlay.querySelector('[data-call-view="outgoing"]'),
      active: callOverlay.querySelector('[data-call-view="active"]')
    };
    const callAudioButton = document.querySelector('[data-call-audio]');
    const callVideoButton = document.querySelector('[data-call-video]');
    const chatMenuToggle = document.querySelector('[data-chat-menu-toggle]');
    const chatMenu = document.querySelector('[data-chat-menu]');
    const chatBlockButton = document.querySelector('[data-chat-block]');
    const chatReportButton = document.querySelector('[data-chat-report]');
    let chatBlockBusy = false;
    const callRingTimeoutMs = 45000;

    function updateCallControls() {
      const enabled = !!conversation && !callStarting && !call
        && blockStatusLoaded && !blockedByMe && !blockedMe;
      callAudioButton.disabled = !enabled;
      callVideoButton.disabled = !enabled;
      callAudioButton.classList.toggle('busy', callStarting);
      callVideoButton.classList.toggle('busy', callStarting);
    }

    function clearRingTimer() {
      if (callRingTimer) { clearTimeout(callRingTimer); callRingTimer = null; }
    }

    function clearCallTimers() {
      if (callTimer) { clearInterval(callTimer); callTimer = null; }
      clearRingTimer();
      callElapsedSeconds = 0;
    }

    function setCallView(name) {
      Object.entries(callViews).forEach(([key, view]) => view.classList.toggle('hidden', key !== name));
      callOverlay.classList.toggle('call-overlay-video', name === 'active' && call?.type === 'video');
      callOverlay.classList.remove('hidden');
    }

    function fillCallView(view, partner) {
      const avatarHost = view.querySelector('[data-call-avatar]');
      if (avatarHost) {
        const avatar = createAvatar(partner, 'call-avatar');
        avatar.dataset.callAvatar = '';
        avatarHost.replaceWith(avatar);
      }
      const name = view.querySelector('[data-call-name]');
      if (name) name.textContent = partner?.fullName || `@${partner?.username || 'مستخدم دَرْب'}`;
    }

    function secondsToTimer(total) {
      const minutes = Math.floor(total / 60);
      const seconds = total % 60;
      return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    function startCallClock() {
      if (callTimer) clearInterval(callTimer);
      callElapsedSeconds = 0;
      callTimer = window.setInterval(() => {
        if (!call) return;
        callElapsedSeconds += 1;
        if (call.status === 'active') {
          const timer = callViews.active.querySelector('[data-call-timer]');
          if (timer) timer.textContent = secondsToTimer(callElapsedSeconds);
        } else if (call.role === 'caller') {
          const subtitle = callViews.outgoing.querySelector('[data-call-subtitle]');
          if (subtitle) subtitle.textContent = `بانتظار الرد • ${callElapsedSeconds} ث`;
        }
      }, 1000);
    }

    function stopCallMedia() {
      [callLocalStream, callRemoteStream].forEach((stream) => {
        if (!stream) return;
        stream.getTracks().forEach((track) => { try { track.stop(); } catch (error) { /* ignore */ } });
      });
      if (callPeer) { try { callPeer.close(); } catch (error) { /* ignore */ } }
      callPeer = null;
      callLocalStream = null;
      callRemoteStream = null;
      callRemoteVideoSeen = false;
      const remote = callViews.active.querySelector('[data-call-remote]');
      const local = callViews.active.querySelector('[data-call-local]');
      if (remote) { remote.srcObject = null; remote.classList.add('hidden'); remote.classList.remove('call-remote-audio'); }
      if (local) { local.srcObject = null; local.classList.add('hidden'); }
      const voice = callViews.active.querySelector('[data-call-voice]');
      if (voice) voice.classList.remove('hidden');
      callViews.active.querySelector('[data-call-mic]')?.classList.remove('off');
      callViews.active.querySelector('[data-call-cam]')?.classList.remove('off');
      callOverlay.classList.add('hidden');
      callOverlay.classList.remove('call-overlay-video');
    }

    async function requestCallMedia(type) {
      const constraints = {
        audio: true,
        video: type === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false
      };
      return navigator.mediaDevices.getUserMedia(constraints);
    }

    async function sendCallSignal(type, data) {
      if (!call || !hub) throw new Error('الاتصال اللحظي غير متاح.');
      const target = call.role === 'caller' ? call.calleeId : call.callerId;
      await hub.sendCallSignal(call.id, target, type, JSON.stringify(data));
    }

    function setupPeerConnection() {
      const configuration = {
        iceServers: Array.isArray(callIceConfig?.iceServers) && callIceConfig.iceServers.length
          ? callIceConfig.iceServers
          : [{ urls: 'stun:stun.l.google.com:19302' }]
      };
      callPeer = new RTCPeerConnection(configuration);
      callRemoteStream = new MediaStream();
      if (callLocalStream) callLocalStream.getTracks().forEach((track) => callPeer.addTrack(track, callLocalStream));
      callPeer.ontrack = (event) => {
        if (event.track) callRemoteStream.addTrack(event.track);
        const remote = callViews.active.querySelector('[data-call-remote]');
        const voice = callViews.active.querySelector('[data-call-voice]');
        remote.srcObject = callRemoteStream;
        if (event.track?.kind === 'video') {
          callRemoteVideoSeen = true;
          remote.classList.remove('hidden');
          remote.classList.remove('call-remote-audio');
          if (voice) voice.classList.add('hidden');
        } else if (!callRemoteVideoSeen) {
          // مكالمة صوتية: نشغّل الصوت عبر عنصر مخفي دون إظهار الفيديو.
          remote.classList.remove('hidden');
          remote.classList.add('call-remote-audio');
        }
      };
      callPeer.onicecandidate = (event) => {
        if (event.candidate && call?.status === 'active') {
          sendCallSignal('ice', { candidate: event.candidate.toJSON() }).catch((error) => {
            console.error('Could not send an ICE candidate:', error);
          });
        }
      };
      callPeer.onconnectionstatechange = () => {
        if (call?.status === 'active' && callPeer?.connectionState === 'failed') finishCall('failed');
      };
    }

    async function enterActiveCall() {
      const video = call.type === 'video';
      const active = callViews.active;
      fillCallView(active, call.partner);
      active.querySelector('[data-call-timer]').textContent = '00:00';
      const voice = active.querySelector('[data-call-voice]');
      const remote = active.querySelector('[data-call-remote]');
      const local = active.querySelector('[data-call-local]');
      voice.classList.toggle('hidden', video);
      remote.classList.add('hidden');
      remote.classList.remove('call-remote-audio');
      active.querySelector('[data-call-cam]').classList.toggle('hidden', !video);
      if (video && callLocalStream) {
        local.srcObject = callLocalStream;
        local.classList.remove('hidden');
      } else {
        local.srcObject = null;
        local.classList.add('hidden');
      }
      setCallView('active');
      startCallClock();
    }

    function showIncomingCallUI(payload) {
      call = {
        id: payload.id,
        conversationId: payload.conversationId,
        callerId: payload.callerId,
        calleeId: payload.calleeId,
        type: payload.type,
        status: 'ringing',
        requestedAt: payload.requestedAt,
        role: 'callee',
        partner: payload.caller || {}
      };
      fillCallView(callViews.incoming, call.partner);
      callViews.incoming.querySelector('[data-call-subtitle]').textContent =
        payload.type === 'video' ? 'مكالمة فيديو واردة' : 'مكالمة صوتية واردة';
      setCallView('incoming');
      updateCallControls();
      callRingTimer = window.setTimeout(() => {
        if (call?.role === 'callee' && call.status === 'ringing') finishCall('timeout');
      }, callRingTimeoutMs);
    }

    function showOutgoingCallUI() {
      fillCallView(callViews.outgoing, call.partner);
      callViews.outgoing.querySelector('[data-call-subtitle]').textContent = 'جارٍ الاتصال...';
      setCallView('outgoing');
      updateCallControls();
      startCallClock();
      callRingTimer = window.setTimeout(() => {
        if (call?.role === 'caller' && call.status === 'ringing') finishCall('timeout');
      }, callRingTimeoutMs);
    }

    async function startCall(type) {
      if (!conversation || callStarting || call) return;
      if (!blockStatusLoaded || blockedByMe || blockedMe) {
        setNotice(blockedMe ? 'لا يمكنك الاتصال بهذا المستخدم.'
          : blockedByMe ? 'لقد حظرت هذا المستخدم.'
            : 'جارٍ التحقق من حالة الحظر قبل الاتصال.', 'error');
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') {
        setNotice('متصفحك لا يدعم المكالمات الصوتية أو المرئية.', 'error');
        return;
      }
      callStarting = true;
      updateCallControls();
      try {
        if (!callIceConfig) {
          try { callIceConfig = await api.getCallIceConfig(); }
          catch (error) { console.error('Could not load ICE configuration; falling back to STUN:', error); }
        }
        callLocalStream = await requestCallMedia(type);
        const created = await api.startCall(conversation.id, type);
        call = { ...created, role: 'caller', partner: conversation.partner };
        showOutgoingCallUI();
      } catch (error) {
        stopCallMedia();
        if (error?.name === 'NotAllowedError') setNotice('من فضلك ائذن بالوصول إلى الميكروفون أو الكاميرا لإجراء المكالمة.', 'error');
        else if (error?.name === 'NotFoundError') setNotice('تعذر العثور على ميكروفون أو كاميرا متاحة.', 'error');
        else setNotice(error?.message || 'تعذر بدء المكالمة.', 'error');
      } finally {
        callStarting = false;
        updateCallControls();
      }
    }

    async function acceptIncomingCall() {
      if (!call || call.role !== 'callee' || call.status !== 'ringing' || callAccepting) return;
      callAccepting = true;
      try {
        callLocalStream = await requestCallMedia(call.type);
        const updated = await api.acceptCall(call.id);
        call.status = updated.status || 'active';
        call.answeredAt = updated.answeredAt;
        clearRingTimer();
        await enterActiveCall();
        setupPeerConnection();
      } catch (error) {
        const failedCall = call;
        stopCallMedia();
        call = null;
        clearCallTimers();
        updateCallControls();
        if (failedCall) {
          try { await api.rejectCall(failedCall.id, 'rejected'); }
          catch (rejectError) { console.error('Could not reject the call after a failure:', rejectError); }
        }
        if (error?.name === 'NotAllowedError') setNotice('من فضلك ائذن بالوصول إلى الميكروفون أو الكاميرا لقبول المكالمة.', 'error');
        else setNotice(error?.message || 'تعذر قبول المكالمة.', 'error');
      } finally {
        callAccepting = false;
      }
    }

    async function handleIncomingCall(payload) {
      if (!payload?.id) return;
      if (call || callStarting) {
        // المستخدم مشغول بمكالمة أخرى؛ نرفض المكالمة الجديدة فورًا.
        try { await api.rejectCall(payload.id, 'busy'); }
        catch (error) { console.error('Could not reject a concurrent call:', error); }
        return;
      }
      showIncomingCallUI(payload);
    }

    async function handleCallAccepted(payload) {
      if (!call || payload.id !== call.id || call.role !== 'caller' || call.status !== 'ringing') return;
      call.status = 'active';
      call.answeredAt = payload.answeredAt;
      clearRingTimer();
      await enterActiveCall();
      try {
        setupPeerConnection();
        const offer = await callPeer.createOffer();
        await callPeer.setLocalDescription(offer);
        await sendCallSignal('offer', { type: 'offer', sdp: offer.sdp });
      } catch (error) {
        console.error('Could not create the WebRTC offer:', error);
        await finishCall('failed');
      }
    }

    async function handleCallSignal(payload) {
      if (!call || payload.callId !== call.id || call.status !== 'active' || !callPeer) return;
      let data;
      try { data = typeof payload.data === 'string' ? JSON.parse(payload.data) : payload.data; }
      catch (error) { console.error('Invalid call signal payload:', error); return; }
      try {
        if (payload.type === 'offer' && call.role === 'callee') {
          await callPeer.setRemoteDescription(new RTCSessionDescription(data));
          const answer = await callPeer.createAnswer();
          await callPeer.setLocalDescription(answer);
          await sendCallSignal('answer', { type: 'answer', sdp: answer.sdp });
        } else if (payload.type === 'answer' && call.role === 'caller') {
          await callPeer.setRemoteDescription(new RTCSessionDescription(data));
        } else if (payload.type === 'ice' && data?.candidate) {
          await callPeer.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      } catch (error) {
        console.error('Call signaling failed:', error);
        await finishCall('failed');
      }
    }

    function summarizeCall(payload, localCall) {
      const kind = (payload.type || localCall.type) === 'video' ? 'فيديو' : 'صوتية';
      switch (payload.status) {
        case 'completed':
          return `انتهت مكالمة ${kind}${payload.durationSeconds > 0 ? ` (${formatCallDuration(payload.durationSeconds)})` : ''}.`;
        case 'missed':
          return localCall.role === 'caller' ? `لم يتم الرد على مكالمة ${kind}.` : `مكالمة ${kind} فائتة.`;
        case 'rejected':
          return localCall.role === 'caller' ? `تم رفض مكالمة ${kind}.` : `رفضت مكالمة ${kind}.`;
        case 'cancelled':
          return localCall.role === 'callee' ? `ألغى الطرف الآخر مكالمة ${kind}.` : `أُلغيت مكالمة ${kind}.`;
        case 'failed':
          return `تعذر إجراء مكالمة ${kind}.`;
        default:
          return '';
      }
    }

    async function handleCallEnded(payload) {
      if (!call || payload.id !== call.id) return;
      const summary = summarizeCall(payload, call);
      call = null;
      clearCallTimers();
      stopCallMedia();
      updateCallControls();
      await refreshCallLog();
      if (summary) D.toast(summary, payload.status === 'completed' ? 'success' : 'info');
    }

    async function finishCall(reason = 'completed') {
      const active = call;
      if (!active) { updateCallControls(); return; }
      const wasActive = active.status === 'active';
      call = null;
      clearCallTimers();
      stopCallMedia();
      updateCallControls();
      try {
        if (wasActive) await api.endCall(active.id, reason === 'failed' ? 'failed' : 'completed');
        else if (active.role === 'caller') await api.cancelCall(active.id, reason === 'timeout' ? 'timeout' : 'cancelled');
        else await api.rejectCall(active.id, reason === 'timeout' ? 'timeout' : 'rejected');
      } catch (error) {
        if (error?.status !== 409) console.error('Could not finalize the call on the server:', error);
      } finally {
        await refreshCallLog();
      }
    }

    function toggleMic() {
      const track = callLocalStream?.getAudioTracks?.()[0];
      const button = callViews.active.querySelector('[data-call-mic]');
      if (!track) { setNotice('لا يوجد ميكروفون نشط.', 'error'); return; }
      const muted = !track.enabled;
      track.enabled = muted;
      button.classList.toggle('off', muted);
      button.setAttribute('aria-pressed', String(muted));
      button.querySelector('span').textContent = muted ? 'تشغيل الصوت' : 'كتم';
    }

    function toggleCamera() {
      if (call?.type !== 'video') return;
      const track = callLocalStream?.getVideoTracks?.()[0];
      const button = callViews.active.querySelector('[data-call-cam]');
      if (!track) return;
      const off = !track.enabled;
      track.enabled = off;
      button.classList.toggle('off', off);
      button.setAttribute('aria-pressed', String(off));
      button.querySelector('span').textContent = off ? 'تشغيل الكاميرا' : 'الكاميرا';
      const local = callViews.active.querySelector('[data-call-local]');
      local.classList.toggle('hidden', off);
    }

    callAudioButton.addEventListener('click', () => startCall('audio'));
    callVideoButton.addEventListener('click', () => startCall('video'));
    callViews.incoming.querySelector('[data-call-accept]').addEventListener('click', acceptIncomingCall);
    callViews.incoming.querySelector('[data-call-reject]').addEventListener('click', () => finishCall('rejected'));
    callViews.outgoing.querySelector('[data-call-cancel]').addEventListener('click', () => finishCall('cancelled'));
    callViews.active.querySelector('[data-call-end]').addEventListener('click', () => finishCall('completed'));
    callViews.active.querySelector('[data-call-mic]').addEventListener('click', toggleMic);
    callViews.active.querySelector('[data-call-cam]').addEventListener('click', toggleCamera);

    // ------------------------------------------------------------------
    // قائمة خيارات المحادثة: الملف الشخصي، الحظر، الإبلاغ
    // ------------------------------------------------------------------
    const closeChatMenu = () => {
      if (!chatMenu) return;
      chatMenu.classList.add('hidden');
      if (chatMenuToggle) chatMenuToggle.setAttribute('aria-expanded', 'false');
    };
    const toggleChatMenu = () => {
      if (!chatMenu || !conversation) return;
      const willOpen = chatMenu.classList.contains('hidden');
      chatMenu.classList.toggle('hidden', !willOpen);
      if (chatMenuToggle) chatMenuToggle.setAttribute('aria-expanded', String(willOpen));
    };
    const peerUserId = () => {
      if (!conversation) return null;
      return conversation.participantIds?.find((id) => id !== user.id)
        || conversation.partner?.id
        || null;
    };
    const toggleBlockConversation = async () => {
      if (!conversation || !blockStatusLoaded || chatBlockBusy) return;
      chatBlockBusy = true;
      closeChatMenu();
      setNotice(blockedByMe ? 'جارٍ إلغاء الحظر...' : 'جارٍ حظر المستخدم...', 'info');
      try {
        if (blockedByMe) await api.unblockConversation(conversation.id);
        else await api.blockConversation(conversation.id);
        await refreshBlockStatus();
      } catch (error) {
        console.error('Could not update block status:', error);
        setNotice(error.message || 'تعذر تحديث حالة الحظر. أعد المحاولة.', 'error');
      } finally {
        chatBlockBusy = false;
      }
    };
    const reportConversationPartner = async () => {
      const peerId = peerUserId();
      if (!conversation || !peerId) return;
      const reason = window.prompt('سبب الإبلاغ عن هذا المستخدم (اختياري):', 'سلوك مخالف');
      if (reason === null) return; // أُلغي الإبلاغ
      closeChatMenu();
      try {
        await api.reportUser(peerId, reason.trim() || 'other');
        D.toast('تم إرسال الإبلاغ عن المستخدم.', 'success');
      } catch (error) {
        console.error('Could not report user:', error);
        D.toast(error.message || 'تعذر إرسال الإبلاغ.', 'error');
      }
    };
    if (chatMenuToggle && chatMenu) {
      chatMenuToggle.addEventListener('click', (event) => { event.stopPropagation(); toggleChatMenu(); });
      if (chatBlockButton) chatBlockButton.addEventListener('click', toggleBlockConversation);
      if (chatReportButton) chatReportButton.addEventListener('click', reportConversationPartner);
      document.addEventListener('click', (event) => {
        if (!event.target.closest('.chat-menu-wrap') && !chatMenu.classList.contains('hidden')) closeChatMenu();
      });
    }

    try {
      await refreshConversations();
      let selected = null;
      if (requestedConversationId) {
        const details = await api.getConversation(requestedConversationId);
        selected = conversations.find((item) => item.id === details.id);
        if (!selected) throw new Error('المحادثة غير متاحة لهذا الحساب.');
      } else if (partnerId && tripId) {
        const opened = await api.openConversation(partnerId, tripId);
        await refreshConversations();
        selected = conversations.find((item) => item.id === opened.id);
        if (!selected) throw new Error('تعذر تحميل المحادثة بعد إنشائها.');
      }
      try {
        hub = await api.connectChat(
          null,
          handleHubEvent,
          setConnectionStatus,
          async () => {
            await refreshConversations();
            await syncSelectedConversation();
          }
        );
      } catch (error) {
        console.error('SignalR connection failed; periodic synchronization will be used:', error);
        setConnectionStatus('disconnected');
      }
      if (selected) await openConversation(selected);
    } catch (error) {
      listState.textContent = error.message || 'تعذر تحميل المحادثات.';
      setNotice(error.message || 'تعذر فتح المحادثة.', 'error');
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!conversation || sending || !blockStatusLoaded || blockedByMe || blockedMe) return;
      const text = input.value.trim();
      if (!text) return;
      if (text.length > 2000) {
        setNotice('الرسالة طويلة جدًا. الحد الأقصى 2000 حرف.', 'error');
        return;
      }
      const clientMessageId = input.dataset.clientMessageId || crypto.randomUUID();
      input.dataset.clientMessageId = clientMessageId;
      sending = true;
      updateBlockControls();
      pendingMessage = {
        id: `pending-${clientMessageId}`,
        clientMessageId,
        senderId: user.id,
        text,
        createdAt: new Date().toISOString(),
        pending: true
      };
      renderMessages(false, true);
      try {
        const saved = await api.sendMessage(conversation.id, text, clientMessageId);
        pendingMessage = null;
        upsertMessage(saved);
        input.value = '';
        delete input.dataset.clientMessageId;
        setNotice('');
        renderMessages(false, true);
        await refreshConversations();
      } catch (error) {
        pendingMessage.failed = true;
        pendingMessage.pending = false;
        renderMessages(false, true);
        setNotice(error.message || 'تعذر إرسال الرسالة. أعد المحاولة للاستخدام الآمن.', 'error');
        if (error.status === 403) await refreshBlockStatus();
      } finally {
        sending = false;
        updateBlockControls();
        if (!submit.disabled) input.focus();
      }
    });

    document.querySelector('[data-chat-refresh]').addEventListener('click', () => {
      refreshConversations().then(syncSelectedConversation).catch((error) => {
        setNotice(error.message || 'تعذر تحديث المحادثات.', 'error');
      });
    });
    document.querySelector('[data-chat-back]').addEventListener('click', () => {
      workspace.classList.add('show-list');
    });
    olderButton.addEventListener('click', loadOlderMessages);

    // ------------------------------------------------------------------
    // أحداث الرسائل الصوتية: تسجيل، مراجعة قبل الإرسال، وإعادة التسجيل
    // ------------------------------------------------------------------
    micButton.addEventListener('click', () => {
      if (voice.state === 'recording') {
        setNotice('');
        stopVoiceRecording();
      } else {
        startVoiceRecording().catch((error) => {
          console.error('Could not start voice recording:', error);
          setVoicePermissionError(error);
        });
      }
    });
    recordingStop.addEventListener('click', () => {
      setNotice('');
      stopVoiceRecording();
    });
    recordingCancel.addEventListener('click', () => {
      setNotice('');
      resetVoiceToIdle();
    });
    reviewPlay.addEventListener('click', toggleVoiceReviewPlay);
    reviewRerecord.addEventListener('click', () => {
      setNotice('');
      resetVoiceToIdle();
      startVoiceRecording().catch((error) => {
        console.error('Could not re-record the voice message:', error);
        setVoicePermissionError(error);
      });
    });
    reviewDelete.addEventListener('click', () => {
      setNotice('');
      resetVoiceToIdle();
      input.focus();
    });
    reviewSend.addEventListener('click', () => {
      sendVoiceRecording().catch((error) => {
        console.error('Could not send the voice message:', error);
        setNotice(error.message || 'تعذر إرسال الرسالة الصوتية.', 'error');
      });
    });

    // ------------------------------------------------------------------
    // أحداث الصور: فتح القائمة، اختيار/التقاط، الإرسال، عرض الصورة في نافذة منبثقة
    // ------------------------------------------------------------------
    const togglePhotoMenu = () => {
      const willOpen = photoMenu.classList.contains('hidden');
      photoMenu.classList.toggle('hidden', !willOpen);
      photoButton.setAttribute('aria-expanded', String(willOpen));
    };
    const pickPhotoFile = () => { closePhotoMenu(); fileInput.click(); };
    const pickCameraPhoto = () => { closePhotoMenu(); cameraInput.click(); };
    photoButton.addEventListener('click', togglePhotoMenu);
    photoGalleryButton.addEventListener('click', pickPhotoFile);
    photoCaptureButton.addEventListener('click', pickCameraPhoto);
    if (!('capture' in document.createElement('input'))) photoCaptureButton.disabled = true;
    fileInput.addEventListener('change', () => {
      selectImageFile(fileInput.files && fileInput.files[0]);
      fileInput.value = '';
    });
    cameraInput.addEventListener('change', () => {
      selectImageFile(cameraInput.files && cameraInput.files[0]);
      cameraInput.value = '';
    });
    cancelImageButton.addEventListener('click', () => {
      clearImageSelection();
      updateSendImageButtons();
      setNotice('');
    });
    replaceImageButton.addEventListener('click', pickPhotoFile);
    sendImageButton.addEventListener('click', sendSelectedImage);
    document.addEventListener('click', (event) => {
      if (!event.target.closest('[data-chat-attach]') && !photoMenu.classList.contains('hidden')) closePhotoMenu();
    });
    lightboxClose.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (event) => {
      if (event.target === lightbox) closeLightbox();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (!lightbox.classList.contains('hidden')) closeLightbox();
      closeChatMenu();
    });

    window.addEventListener('beforeunload', () => {
      stopPolling();
      clearImageSelection();
      closeLightbox();
      imageBlobUrls.forEach((url) => { try { URL.revokeObjectURL(url); } catch (error) { /* ignore */ } });
      imageBlobUrls.clear();
      const active = call;
      if (active) {
        const reason = active.status === 'active' ? 'completed' : 'cancelled';
        const token = D.STORAGE.get(D.KEYS.token, '');
        fetch(`${window.DARB_API_BASE_URL || ''}/api/calls/${encodeURIComponent(active.id)}/end`, {
          method: 'POST',
          keepalive: true,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ reason })
        }).catch(() => {});
        stopCallMedia();
      }
      if (hub) hub.stop();
      if (voice.state !== 'idle') resetVoiceToIdle();
    }, { once: true });
  }).catch((error) => {
    console.error('Chat initialization failed:', error);
  });
});
