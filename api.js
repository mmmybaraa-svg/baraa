(function () {
  'use strict';

  const D = window.DARB;
  const baseUrl = window.DARB_API_BASE_URL || '';
  let syncing = false;
  let refreshTimer;
  let notificationRevision = 0;
  let authGeneration = 0;
  const transactionalTrips = new Set();

  async function request(path, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set('Accept', 'application/json');
    if (options.body !== undefined) headers.set('Content-Type', 'application/json');
    const token = D.STORAGE.get(D.KEYS.token, '');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(`${baseUrl}/api${path}`, { ...options, headers });
    if (response.status === 204) return null;
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || `تعذر تنفيذ الطلب (${response.status}).`);
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  function cache(key, value) {
    syncing = true;
    try {
      D.STORAGE.set(key, value);
    } finally {
      syncing = false;
    }
  }

  async function refresh() {
    const trips = await request('/trips');
    cache(D.KEYS.trips, trips);
    const token = D.STORAGE.get(D.KEYS.token, '');
    if (!token) {
      cache(D.KEYS.bookings, []);
      cache(D.KEYS.users, []);
      cache(D.KEYS.notifications, []);
      cache(D.KEYS.tracking, null);
      cache(D.KEYS.passengerLocation, null);
      cache(D.KEYS.driverLocation, null);
      cache(D.KEYS.follows, []);
      cache(D.KEYS.conversations, []);
      cache(D.KEYS.messages, []);
      D.setUser(null);
      return;
    }
    try {
      const refreshGeneration = authGeneration;
      const notificationsAtRequest = notificationRevision;
      const [user, bookings, users, notifications] = await Promise.all([
        request('/auth/me'),
        request('/bookings'),
        request('/users'),
        request('/notifications')
      ]);
      if (refreshGeneration !== authGeneration || token !== D.STORAGE.get(D.KEYS.token, '')) return;
      D.setUser(user);
      cache(D.KEYS.bookings, bookings);
      if (notificationsAtRequest === notificationRevision) cache(D.KEYS.notifications, notifications);
      const publicUsers = users.filter((item) => item.id !== user.id);
      publicUsers.push(user);
      cache(D.KEYS.users, publicUsers);
      const [tracking, locations] = await Promise.all([
        request('/records/tracking'),
        request('/records/location')
      ]);
      if (refreshGeneration !== authGeneration || token !== D.STORAGE.get(D.KEYS.token, '')) return;
      cache(D.KEYS.tracking, tracking.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))[0] || null);
      const byBooking = new Map(locations.map((item) => [item.id, item]));
      cache(D.KEYS.trips, trips.map((trip) => {
        const location = [...byBooking.values()].find((item) => item.tripId === trip.id && item.driverLocation);
        return location ? { ...trip, driverLocation: location.driverLocation } : trip;
      }));
    } catch (error) {
      if ((error.status === 401 || error.status === 404)
        && token === D.STORAGE.get(D.KEYS.token, '')) {
        D.STORAGE.remove(D.KEYS.token);
        D.STORAGE.remove(D.KEYS.session);
        D.setUser(null);
        cache(D.KEYS.bookings, []);
        cache(D.KEYS.users, []);
        cache(D.KEYS.notifications, []);
      }
      throw error;
    }
  }

  async function syncTrips(previous, current) {
    const oldById = new Map(previous.map((trip) => [trip.id, trip]));
    const newById = new Map(current.map((trip) => [trip.id, trip]));
    for (const [id, trip] of newById) {
      if (transactionalTrips.delete(id)) continue;
      if (JSON.stringify(oldById.get(id)) === JSON.stringify(trip)) continue;
      const safeTrip = { ...trip };
      delete safeTrip.driverLocation;
      if (oldById.has(id)) await request(`/trips/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(safeTrip) });
      else await request('/trips', { method: 'POST', body: JSON.stringify(safeTrip) });
    }
    for (const id of oldById.keys()) {
      if (!newById.has(id)) await request(`/trips/${encodeURIComponent(id)}`, { method: 'DELETE' });
    }
  }

  async function syncBookings(previous, current) {
    const oldById = new Map(previous.map((booking) => [booking.id, booking]));
    const newById = new Map(current.map((booking) => [booking.id, booking]));
    for (const [id, booking] of newById) {
      const oldBooking = oldById.get(id);
      if (!oldBooking) {
        await request('/bookings', { method: 'POST', body: JSON.stringify(booking) });
      } else if (oldBooking.status !== booking.status) {
        if (booking.status === 'confirmed') transactionalTrips.add(booking.tripId);
        await request(`/bookings/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: booking.status })
        });
      }
    }
  }

  async function saveLocation(kind, value, user) {
    if (!value || !(await getSettings()).shareLocation) return;
    if (kind === 'passenger') {
      await request(`/records/location/passenger_${encodeURIComponent(user.id)}`, {
        method: 'PUT',
        body: JSON.stringify({ ...value, kind: 'passenger' })
      });
      return;
    }
    const bookings = D.bookings().filter((booking) => booking.driverId === user.id && booking.status === 'confirmed');
    await Promise.all(bookings.map((booking) => request(`/records/location/${encodeURIComponent(booking.id)}`, {
      method: 'PUT',
      body: JSON.stringify({
        tripId: booking.tripId,
        relatedId: booking.passengerId,
        driverLocation: { ...value, driverId: user.id },
        kind: 'driver'
      })
    })));
  }

  function hookStorage() {
    const originalSet = D.STORAGE.set.bind(D.STORAGE);
    D.STORAGE.set = (key, value) => {
      const previous = D.STORAGE.get(key, []);
      originalSet(key, value);
      const user = D.getUser();
      if (syncing || !user) return;
      let operation;
      if (key === D.KEYS.trips) operation = syncTrips(Array.isArray(previous) ? previous : [], Array.isArray(value) ? value : []);
      else if (key === D.KEYS.bookings) operation = syncBookings(Array.isArray(previous) ? previous : [], Array.isArray(value) ? value : []);
      else if (key === D.KEYS.passengerLocation || key === D.KEYS.driverLocation) {
        operation = saveLocation(key === D.KEYS.passengerLocation ? 'passenger' : 'driver', value, user);
      } else if (key === D.KEYS.tracking && value?.bookingId && value.status !== 'cancelled') {
        operation = request(`/records/tracking/${encodeURIComponent(value.bookingId)}`, {
          method: 'PUT',
          body: JSON.stringify({ ...value, relatedId: value.driverId || null })
        });
      }
      if (operation) operation.catch((error) => {
        console.error('SQL API synchronization failed:', error);
        D.toast(error.message || 'تعذرت مزامنة البيانات مع SQL Server.', 'error');
        refresh().catch((refreshError) => console.error('SQL API refresh failed:', refreshError));
      });
    };
  }

  function installAuthForms() {
    D.apiAuthFormsReady = true;
    const login = document.querySelector('#loginForm');
    if (login) {
      const identifier = login.querySelector('[name="login"]');
      if (identifier) {
        identifier.type = 'email';
        identifier.autocomplete = 'username';
        identifier.placeholder = 'name@example.com';
      }
      const label = document.querySelector('label[for="login"]');
      if (label) label.textContent = 'البريد الإلكتروني';
      const submitButton = login.querySelector('button[type="submit"]');
      login.onsubmit = async (event) => {
        event.preventDefault();
        const message = document.querySelector('#authMsg');
        if (submitButton?.disabled) return;
        const originalText = submitButton?.textContent;
        if (submitButton) {
          submitButton.disabled = true;
          submitButton.textContent = 'جار تسجيل الدخول...';
        }
        try {
          const result = await signIn(identifier.value.trim(), login.password.value);
          const next = new URLSearchParams(location.search).get('next');
          location.href = next ? decodeURIComponent(next) : result.role === 'driver' ? 'driver.html' : 'dashboard.html';
        } catch (error) {
          if (message) {
            message.className = 'notice error';
            message.textContent = error.message || 'تعذر تسجيل الدخول.';
          }
        } finally {
          if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = originalText;
          }
        }
      };
    }
    const register = document.querySelector('#registerForm');
    if (register) {
      register.onsubmit = async (event) => {
        event.preventDefault();
        const message = register.querySelector('[data-register-message]');
        const data = Object.fromEntries(new FormData(register).entries());
        data.email = String(data.email || '').trim().toLowerCase();
        data.username = String(data.username || '').trim().toLowerCase();
        data.phone = D.normalizePhone(data.phone);
        if (!data.fullName || !D.validEmail(data.email) || !D.validPhone(data.phone)
          || !/^[a-z0-9_]{3,20}$/.test(data.username) || String(data.password || '').length < 6
          || !data.gender || !data.university || !data.governorate
          || (data.role === 'driver' && (!data.vehicleType || !data.carModel
            || Number(data.carYear) < 1990 || Number(data.passengerSeats) < 1))) {
          D.toast('تحقق من الاسم واسم المستخدم وبيانات الحساب والمركبة المطلوبة.', 'error');
          return;
        }
        const submitButton = register.querySelector('button[type="submit"]');
        if (submitButton?.disabled) return;
        const originalText = submitButton?.textContent;
        if (submitButton) {
          submitButton.disabled = true;
          submitButton.textContent = 'جار إنشاء الحساب...';
        }
        try {
          const result = await request('/auth/register', { method: 'POST', body: JSON.stringify(data) });
          saveSession(result);
          location.href = result.user.role === 'driver' ? 'driver.html' : 'dashboard.html';
        } catch (error) {
          if (message) {
            message.className = 'notice error';
            message.textContent = error.message || 'تعذر إنشاء الحساب.';
          } else D.toast(error.message || 'تعذر إنشاء الحساب.', 'error');
        } finally {
          if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = originalText;
          }
        }
      };
    }
  }

  function saveSession(result) {
    authGeneration++;
    D.STORAGE.set(D.KEYS.token, result.token);
    D.setUser(result.user);
    D.STORAGE.set(D.KEYS.session, { userId: result.user.id, createdAt: new Date().toISOString() });
  }

  async function signIn(identifier, password) {
    const result = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password })
    });
    saveSession(result);
    return result.user;
  }

  async function signOut() {
    let signOutError;
    const token = D.STORAGE.get(D.KEYS.token, '');
    authGeneration++;
    try {
      if (token) await request('/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('SQL API sign-out failed:', error);
      signOutError = error;
    } finally {
      D.STORAGE.remove(D.KEYS.token);
      D.STORAGE.remove(D.KEYS.session);
      D.setUser(null);
      cache(D.KEYS.notifications, []);
      cache(D.KEYS.trips, []);
      cache(D.KEYS.bookings, []);
      cache(D.KEYS.users, []);
      cache(D.KEYS.tracking, null);
      cache(D.KEYS.passengerLocation, null);
      cache(D.KEYS.driverLocation, null);
      cache(D.KEYS.follows, []);
      cache(D.KEYS.conversations, []);
      cache(D.KEYS.messages, []);
      clearInterval(refreshTimer);
    }
    if (signOutError) throw signOutError;
  }

  async function changePassword(currentPassword, newPassword) {
    return request('/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword })
    });
  }

  async function deleteAccount(password) {
    return request('/auth/account', {
      method: 'DELETE',
      body: JSON.stringify({ password })
    });
  }

  async function getSettings() { return request('/settings'); }
  async function saveSettings(settings) {
    return request('/settings', { method: 'PUT', body: JSON.stringify(settings) });
  }

  async function getDriverPoints(driverId) { return request(`/points/${encodeURIComponent(driverId)}`); }
  async function getDriverPointTransactions(driverId) { return request(`/points/${encodeURIComponent(driverId)}/transactions`); }
  async function getPassengerPoints() { return request('/passenger-points'); }
  async function getDriverTransferredPoints() { return request('/driver-transferred-points'); }
  async function searchTransferDrivers(query, signal) {
    const params = new URLSearchParams({ q: query });
    return request(`/point-transfers/drivers?${params}`, { signal });
  }
  async function getPointTransfers() { return request('/point-transfers'); }
  async function getPointTransferSettings() { return request('/point-transfers/settings'); }
  async function getBookingCompletions() { return request('/booking-completions'); }
  async function transferPoints(payload) {
    return request('/point-transfers', { method: 'POST', body: JSON.stringify(payload) });
  }
  async function confirmBookingCompletion(id) {
    const result = await request(`/bookings/${encodeURIComponent(id)}/completion-confirmation`, { method: 'POST' });
    await refreshAfterMutation();
    return result;
  }
  async function getDriverPointPackages() { return request('/driver-points/packages'); }
  async function getDriverPointPaymentMethods() { return request('/driver-points/payment-methods'); }
  async function createDriverPointPurchase(packageId, paymentMethodId) {
    return request('/driver-points/purchases', {
      method: 'POST',
      body: JSON.stringify({ packageId, paymentMethodId })
    });
  }
  async function getDriverPointPurchases() { return request('/driver-points/purchases'); }
  async function submitDriverPointTransfer(id, transferReference) {
    return request(`/driver-points/purchases/${encodeURIComponent(id)}/submit-transfer`, {
      method: 'POST',
      body: JSON.stringify({ transferReference })
    });
  }
  async function getPassengerRewards(passengerId) { return request(`/rewards/${encodeURIComponent(passengerId)}`); }
  async function getRewardSettings() { return request('/reward-settings'); }
  async function saveRewardSettings(settings) {
    return request('/reward-settings', { method: 'PUT', body: JSON.stringify(settings) });
  }
  async function publishTripWithPoints(payload) {
    return request('/trips/publish-with-points', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }
  async function completeTripReward(payload) {
    return request('/rewards/complete-trip', { method: 'PUT', body: JSON.stringify(payload) });
  }
  async function redeemFreeTripReward(payload = {}) {
    return request('/rewards/redemptions/free-trip', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  }

  async function saveProfile(profile) {
    const saved = await request('/users/me', { method: 'PUT', body: JSON.stringify(profile) });
    D.setUser(saved);
    return saved;
  }

  async function getPublicProfile(id) { return request(`/users/${encodeURIComponent(id)}`); }
  async function getBlockedUsers() { return request('/users/me/blocks'); }
  async function getUserRelationshipStatus(id) {
    return request(`/users/${encodeURIComponent(id)}/relationship-status`);
  }
  async function blockUser(id) {
    return request(`/users/${encodeURIComponent(id)}/block`, { method: 'PUT' });
  }
  async function unblockUser(id) {
    return request(`/users/me/blocks/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  async function reportUser(id, reason, details) {
    return request(`/users/${encodeURIComponent(id)}/report`, {
      method: 'POST',
      body: JSON.stringify({ reason, details })
    });
  }
  async function searchUsers(query, page = 1, pageSize = 10, signal) {
    const params = new URLSearchParams({ q: query, page: String(page), pageSize: String(pageSize) });
    return request(`/users/search?${params}`, { signal });
  }
  async function getDriverRatings(id) { return request(`/users/${encodeURIComponent(id)}/ratings`); }
  async function getRatingEligibility(id) { return request(`/users/${encodeURIComponent(id)}/rating-eligibility`); }
  async function isFollowing(id) {
    const result = await request(`/users/${encodeURIComponent(id)}/following/${encodeURIComponent(D.getUser().id)}`);
    return result.following;
  }
  async function toggleFollow(id, following) {
    return request(`/users/${encodeURIComponent(id)}/following`, {
      method: 'PUT',
      body: JSON.stringify({ following })
    });
  }
  async function submitRating(rating) {
    return request('/ratings', { method: 'POST', body: JSON.stringify(rating) });
  }
  async function createBooking(booking) {
    const result = await request('/bookings', { method: 'POST', body: JSON.stringify(booking) });
    await refreshAfterMutation();
    return result;
  }
  async function reviewBooking(id, status) {
    const result = await request(`/bookings/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
    await refreshAfterMutation();
    return result;
  }
  async function saveTrip(trip) {
    const isExisting = D.trips().some((item) => item.id === trip.id);
    const path = isExisting ? `/trips/${encodeURIComponent(trip.id)}` : '/trips';
    const result = await request(path, {
      method: isExisting ? 'PUT' : 'POST',
      body: JSON.stringify(trip)
    });
    await refreshAfterMutation();
    return result;
  }

  async function refreshAfterMutation() {
    try {
      await refresh();
    } catch (error) {
      console.error('SQL Server saved the change but the client refresh failed:', error);
      D.toast('تم حفظ البيانات، لكن تعذر تحديث العرض. أعد تحميل الصفحة.', 'error');
    }
  }
  async function openConversation(targetId, tripId) {
    return request('/conversations', {
      method: 'POST',
      body: JSON.stringify({ targetId, tripId })
    });
  }
  async function getConversations() {
    const result = await request('/conversations');
    return result.items;
  }
  function mutateCachedNotifications(mutator) {
    const notifications = D.STORAGE.get(D.KEYS.notifications, []);
    cache(D.KEYS.notifications, mutator(Array.isArray(notifications) ? notifications : []));
  }
  async function refreshNotifications() {
    const notificationsAtRequest = notificationRevision;
    const notifications = await request('/notifications');
    if (notificationsAtRequest === notificationRevision) cache(D.KEYS.notifications, notifications);
    return notifications;
  }
  async function deleteNotification(id) {
    notificationRevision++;
    await request(`/notifications/${encodeURIComponent(id)}`, { method: 'DELETE' });
    mutateCachedNotifications((items) => items.filter((item) => item.id !== id));
  }
  async function deleteAllNotifications() {
    notificationRevision++;
    await request('/notifications', { method: 'DELETE' });
    mutateCachedNotifications(() => []);
  }
  async function markNotificationRead(id) {
    notificationRevision++;
    const result = await request(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' });
    mutateCachedNotifications((items) => items.map((item) => item.id === id ? { ...item, read: true } : item));
    return result;
  }
  async function markAllNotificationsRead() {
    notificationRevision++;
    const result = await request('/notifications/read', { method: 'PUT' });
    mutateCachedNotifications((items) => items.map((item) => ({ ...item, read: true })));
    return result;
  }
  async function getConversation(id) { return request(`/conversations/${encodeURIComponent(id)}`); }
  async function getConversationBlockStatus(id) {
    return request(`/conversations/${encodeURIComponent(id)}/block-status`);
  }
  async function blockConversation(id) {
    return request(`/conversations/${encodeURIComponent(id)}/block`, { method: 'PUT' });
  }
  async function unblockConversation(id) {
    return request(`/conversations/${encodeURIComponent(id)}/block`, { method: 'DELETE' });
  }
  async function getMessages(id, before, pageSize = 50) {
    const params = new URLSearchParams({ pageSize: String(pageSize) });
    if (before !== undefined && before !== null) params.set('before', String(before));
    return request(`/conversations/${encodeURIComponent(id)}/messages?${params}`);
  }
  async function connectChat(conversationId, onEvent, onState, onReconnect) {
    if (!window.signalR) throw new Error('تعذر تحميل مكتبة الاتصال الفوري.');
    const readToken = () => D.STORAGE.get(D.KEYS.token, '');
    // الخادم يرفض أي اتصال بلا رمز جلسة صالح (401). لا نفتح الاتصال أصلاً
    // إذا لم يوجد رمز: نُنهي حالياً حتى تعتمد الصفحة على المزامنة الدورية
    // بدلاً من إغراق الهب باتصالات غير مصادق عليها.
    if (!readToken()) {
      const error = new Error('انتهت الجلسة. سجّل الدخول ثم أعد المحاولة.');
      error.status = 401;
      onState('disconnected', error);
      throw error;
    }
    const connection = new window.signalR.HubConnectionBuilder()
      .withUrl(`${baseUrl}/hubs/chat`, {
        accessTokenFactory: readToken
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .build();
    const retryDelays = [1000, 2000, 5000, 10000, 30000];
    let joinedConversationId = null;
    let retryIndex = 0;
    let retryTimer = null;
    let stopped = false;
    const scheduleRestart = (error) => {
      onState('disconnected', error);
      if (stopped || retryTimer) return;
      // بدون رمز جلسة لن يُقبل أي اتصال جديد من الخادم، فلا جدوى من
      // إعادة المحاولة المتكررة؛ نتوقف وتتحول الصفحة للمزامنة الدورية.
      if (!readToken()) {
        stopped = true;
        return;
      }
      const delay = retryDelays[Math.min(retryIndex, retryDelays.length - 1)];
      retryIndex++;
      onState('reconnecting');
      retryTimer = window.setTimeout(async () => {
        retryTimer = null;
        try {
          await connection.start();
        if (joinedConversationId) await connection.invoke('JoinConversation', joinedConversationId);
          retryIndex = 0;
          onState('connected');
          await onReconnect();
        } catch (restartError) {
          scheduleRestart(restartError);
        }
      }, delay);
    };
    connection.on('MessageCreated', (message) => onEvent('message', message));
    connection.on('ConversationUpdated', (update) => onEvent('conversation', update));
    connection.on('MessagesDelivered', (update) => onEvent('delivered', update));
    connection.on('MessagesRead', (update) => onEvent('read', update));
    connection.on('RelationshipUpdated', (update) => onEvent('relationship', update));
    connection.on('CallIncoming', (payload) => onEvent('call:incoming', payload));
    connection.on('CallAccepted', (payload) => onEvent('call:accepted', payload));
    connection.on('CallEnded', (payload) => onEvent('call:ended', payload));
    connection.on('CallSignal', (payload) => onEvent('call:signal', payload));
    connection.onreconnecting(() => onState('reconnecting'));
    connection.onreconnected(async () => {
      try {
        if (joinedConversationId) await connection.invoke('JoinConversation', joinedConversationId);
        retryIndex = 0;
        onState('connected');
        await onReconnect();
      } catch (error) {
        scheduleRestart(error);
      }
    });
    connection.onclose((error) => scheduleRestart(error));
    try {
      await connection.start();
      if (conversationId) {
        joinedConversationId = conversationId;
        await connection.invoke('JoinConversation', conversationId);
      }
      onState('connected');
    } catch (error) {
      scheduleRestart(error);
    }
    return {
      switchTo: async (id) => {
        if (joinedConversationId === id && connection.state === window.signalR.HubConnectionState.Connected) return;
        if (joinedConversationId && connection.state === window.signalR.HubConnectionState.Connected) {
          await connection.invoke('LeaveConversation', joinedConversationId);
        }
        joinedConversationId = id;
        if (id && connection.state === window.signalR.HubConnectionState.Connected) {
          await connection.invoke('JoinConversation', id);
        } else if (connection.state === window.signalR.HubConnectionState.Disconnected) {
          scheduleRestart();
        }
      },
      stop: async () => {
        stopped = true;
        if (retryTimer) clearTimeout(retryTimer);
        await connection.stop();
      },
      sendCallSignal: async (callId, targetUserId, type, data) => {
        if (connection.state !== window.signalR.HubConnectionState.Connected) {
          throw new Error('الاتصال اللحظي غير متاح.');
        }
        await connection.invoke('SendCallSignal', callId, targetUserId, type, data);
      }
    };
  }
  async function markMessagesRead(id, messageIds) {
    return request(`/conversations/${encodeURIComponent(id)}/read`, {
      method: 'POST',
      body: JSON.stringify({ messageIds })
    });
  }
  async function acknowledgeDelivery(id, messageIds) {
    if (!messageIds.length) return { deliveredMessageIds: [] };
    return request(`/conversations/${encodeURIComponent(id)}/delivery`, {
      method: 'POST',
      body: JSON.stringify({ messageIds })
    });
  }
  async function sendMessage(id, text, clientMessageId) {
    return request(`/conversations/${encodeURIComponent(id)}/messages`, {
      method: 'POST',
      body: JSON.stringify({ text, clientMessageId })
    });
  }
  async function uploadVoiceMessage(id, payload) {
    const form = new FormData();
    form.append('audio', payload.audio, payload.fileName || 'voice');
    form.append('clientMessageId', payload.clientMessageId);
    form.append('duration', String(payload.duration));
    if (payload.mimeType) form.append('mimeType', payload.mimeType);
    const headers = new Headers();
    headers.set('Accept', 'application/json');
    const token = D.STORAGE.get(D.KEYS.token, '');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(`${baseUrl}/api/conversations/${encodeURIComponent(id)}/voice-messages`, {
      method: 'POST',
      headers,
      body: form
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(result.error || `تعذر إرسال الرسالة الصوتية (${response.status}).`);
      error.status = response.status;
      throw error;
    }
    return result;
  }
  async function fetchVoiceAudio(audioUrl) {
    const headers = new Headers();
    headers.set('Accept', 'audio/*,application/octet-stream');
    const token = D.STORAGE.get(D.KEYS.token, '');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(`${baseUrl}${audioUrl}`, { headers });
    if (!response.ok) {
      const error = new Error('تعذر تحميل الرسالة الصوتية.');
      error.status = response.status;
      throw error;
    }
    return URL.createObjectURL(await response.blob());
  }
  function sendImageMessage(id, file, clientMessageId, onProgress) {
    // رفع فعلي عبر multipart مع تقدم التحميل؛ لا يُخزَّن الملف Base64.
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('clientMessageId', clientMessageId);
      formData.append('file', file, file.name);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${baseUrl}/api/conversations/${encodeURIComponent(id)}/image-messages`);
      xhr.setRequestHeader('Authorization', `Bearer ${D.STORAGE.get(D.KEYS.token, '')}`);
      xhr.responseType = 'json';
      if (onProgress && xhr.upload) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable && event.total > 0) onProgress(Math.round((event.loaded / event.total) * 100));
        });
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(xhr.response);
          return;
        }
        const payload = xhr.response && typeof xhr.response === 'object' ? xhr.response : {};
        const error = new Error(payload.error || `تعذر رفع الصورة (${xhr.status}).`);
        error.status = xhr.status;
        reject(error);
      };
      xhr.onerror = () => reject(new Error('تعذر الاتصال بالخادم عند رفع الصورة.'));
      xhr.send(formData);
    });
  }
  async function loadImage(conversationId, relativeUrl) {
    // الصورة خاصة: تُجلب عبر نقطة مصادقة تتحقق من عضوية المحادثة، وتُعرض
    // كـ Object URL داخل الصفحة دون كشف المسار الداخلي أو الأسرار.
    const path = typeof relativeUrl === 'string' && relativeUrl.startsWith('/api/')
      ? relativeUrl
      : `/api/conversations/${encodeURIComponent(conversationId)}/images/${encodeURIComponent(relativeUrl)}`;
    const response = await fetch(`${baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${D.STORAGE.get(D.KEYS.token, '')}` }
    });
    if (!response.ok) {
      const error = new Error('تعذر تحميل الصورة.');
      error.status = response.status;
      throw error;
    }
    return URL.createObjectURL(await response.blob());
  }
  async function startCall(conversationId, type) {
    return request(`/conversations/${encodeURIComponent(conversationId)}/calls`, {
      method: 'POST',
      body: JSON.stringify({ type })
    });
  }
  async function acceptCall(callId) {
    return request(`/calls/${encodeURIComponent(callId)}/accept`, {
      method: 'POST',
      body: JSON.stringify({})
    });
  }
  async function rejectCall(callId, reason) {
    return request(`/calls/${encodeURIComponent(callId)}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  }
  async function cancelCall(callId, reason) {
    return request(`/calls/${encodeURIComponent(callId)}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  }
  async function endCall(callId, reason) {
    return request(`/calls/${encodeURIComponent(callId)}/end`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  }
  async function getCallIceConfig() {
    return request('/calls/ice-config');
  }
  async function getConversationCalls(conversationId) {
    return request(`/conversations/${encodeURIComponent(conversationId)}/calls`);
  }

  async function start() {
    D.apiEnabled = true;
    hookStorage();
    const scheduleFormSetup = () => setTimeout(installAuthForms, 0);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', scheduleFormSetup, { once: true });
    } else {
      scheduleFormSetup();
    }
    D.setUser(null);
    D.STORAGE.remove(D.KEYS.session);
    cache(D.KEYS.trips, []);
    cache(D.KEYS.bookings, []);
    cache(D.KEYS.users, []);
    cache(D.KEYS.notifications, []);
    cache(D.KEYS.tracking, null);
    try {
      await refresh();
    } catch (error) {
      console.error('SQL Server initialization failed:', error);
      D.toast(error.message || 'تعذر الاتصال بخادم SQL Server.', 'error');
    }
    refreshTimer = setInterval(() => {
      refresh().catch((error) => console.error('SQL Server refresh failed:', error));
    }, 5000);
  }

  window.DARB_API = {
    start,
    signIn,
    signOut,
    changePassword,
    deleteAccount,
    getSettings,
    saveSettings,
    getDriverPoints,
    getDriverPointTransactions,
    getPassengerPoints,
    getDriverTransferredPoints,
    searchTransferDrivers,
    getPointTransfers,
    getPointTransferSettings,
    getBookingCompletions,
    transferPoints,
    confirmBookingCompletion,
    getDriverPointPackages,
    getDriverPointPaymentMethods,
    createDriverPointPurchase,
    getDriverPointPurchases,
    submitDriverPointTransfer,
    getPassengerRewards,
    getRewardSettings,
    saveRewardSettings,
    publishTripWithPoints,
    completeTripReward,
    redeemFreeTripReward,
    saveProfile,
    createBooking,
    reviewBooking,
    saveTrip,
    getPublicProfile,
    getBlockedUsers,
    getUserRelationshipStatus,
    blockUser,
    unblockUser,
    reportUser,
    searchUsers,
    getDriverRatings,
    isFollowing,
    toggleFollow,
    getRatingEligibility,
    submitRating,
    openConversation,
    getConversations,
    refreshNotifications,
    deleteNotification,
    deleteAllNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    getConversation,
    getConversationBlockStatus,
    blockConversation,
    unblockConversation,
    getMessages,
    connectChat,
    markMessagesRead,
    acknowledgeDelivery,
    sendMessage,
    uploadVoiceMessage,
    fetchVoiceAudio,
    sendImageMessage,
    loadImage,
    startCall,
    acceptCall,
    rejectCall,
    cancelCall,
    endCall,
    getCallIceConfig,
    getConversationCalls
  };
})();
