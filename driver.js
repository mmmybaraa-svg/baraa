(function(){'use strict';const D=window.DARB;let editing=null;async function render(){const u=D.requireAuth('driver');if(!u)return;const trips=D.trips(),mine=trips.filter(t=>t.driverId===u.id),bs=D.bookings().filter(b=>b.driverId===u.id);document.querySelector('#driverName').textContent=u.fullName;document.querySelector('#requestCount').textContent=bs.filter(b=>b.status==='pending').length;document.querySelector('#tripCount').textContent=mine.length;let points = { currentBalance: 0, pointsPublished: 0, lastTransactionAt: null, totalSpent: 0 };
let publishCost = 50;
try {
  const settings = await window.DARB_API.getRewardSettings();
  publishCost = Number(settings.TripPublishCost || settings.tripPublishCost || 50);
  points = await window.DARB_API.getDriverPoints(u.id);
} catch (error) {
  console.warn('Failed to load driver points', error);
  points = null;
}
const pointsPanel = document.querySelector('[data-points-panel]') || document.createElement('section');
pointsPanel.className = 'card points-panel';
pointsPanel.innerHTML = `
  <div class="section-head">
    <div><h2>محفظة النقاط</h2><p class="muted">الرصيد الحالي وتكلفة نشر الرحلة</p></div>
  </div>
  <div class="points-grid">
    <div class="point-box"><span>رصيد النقاط الموحد</span><strong>${points ? `${Number(points.currentBalance || 0)} نقطة` : 'غير متاح'}</strong></div>
    <div class="point-box"><span>تكلفة نشر الرحلة</span><strong>${publishCost} نقطة</strong></div>
    <div class="point-box"><span>المستهلكة</span><strong>${points ? `${Number(points.totalSpent || 0)} نقطة` : 'غير متاح'}</strong></div>
  </div>
  <div class="notice ${points && Number(points.currentBalance || 0) >= publishCost ? 'success' : 'warning'}">
    ${!points ? 'تعذر تحميل الرصيد الحالي. لا يمكن تأكيد أهلية نشر رحلة.' : Number(points.currentBalance || 0) >= publishCost ? 'الرصيد كافٍ لنشر رحلة جديدة.' : `لا يكفي الرصيد لنشر رحلة جديدة. الرصيد الحالي: ${Number(points.currentBalance || 0)} نقطة، التكلفة: ${publishCost} نقطة.`}
  </div>
  <div style="margin-top: 15px; display: flex; gap: 10px; flex-wrap: wrap;">
    <a href="driver-point-store.html" class="btn btn-primary">متجر النقاط</a>
    <a href="driver-point-history.html" class="btn btn-outline">عرض سجل النقاط</a>
  </div>
  <div class="points-history">
    <h3>سجل المعاملات</h3>
    <div class="mini-list">
      ${(await window.DARB_API.getDriverPointTransactions(u.id).catch(() => [])).slice(0, 5).map((item) => `
        <div class="mini-item"><span>${item.transactionType === 'publish' ? 'نشر رحلة' : item.reason || 'معاملة'} </span><strong>${item.pointsChanged > 0 ? '+' : ''}${item.pointsChanged} نقطة</strong></div>
      `).join('') || '<div class="empty">لا توجد معاملات حتى الآن.</div>'}
    </div>
  </div>
`;
const pointMount = document.querySelector('#driverPointsMount') || document.createElement('div');
pointMount.id = 'driverPointsMount';
pointMount.innerHTML = '';
pointMount.appendChild(pointsPanel);
const wrapper = document.querySelector('.container');
const before = document.querySelector('#currentTrip');
if (before && !document.querySelector('#driverPointsMount')) {
  before.parentNode.insertBefore(pointMount, before);
}
const current=mine.find(t=>t.status==='open');document.querySelector('#currentTrip').innerHTML=current?`<div class="driver-highlight"><span class="badge open">رحلة مفتوحة</span><h2>${D.escape(current.startLocality)} ← ${D.escape(current.destinationUniversity)}</h2><p class="muted">${D.formatDate(current.departureDate)} · ${current.departureTime}</p><div class="vehicle-grid"><div class="vehicle-item"><strong>${current.availableSeats}</strong>مقاعد متاحة</div><div class="vehicle-item"><strong>${D.formatPrice(current.price)}</strong>السعر</div><div class="vehicle-item"><strong>${D.escape(current.vehicleType)}</strong>النوع</div><div class="vehicle-item"><strong>${D.escape(current.carModel)}</strong>المركبة</div></div></div>`:'<div class="card empty">لا توجد رحلة حالية. أنشئ رحلتك الأولى.</div>';const req=document.querySelector('#requests');const pending=bs.filter(b=>b.status==='pending');req.innerHTML=pending.length?pending.map(b=>{const p=D.users().find(x=>x.id===b.passengerId);const t=trips.find(x=>x.id===b.tripId);return `<div class="request"><div class="request-head"><strong>${D.escape(p?.fullName||'راكب')}</strong><span class="badge pending">قيد المراجعة</span></div><p class="muted">${D.escape(p?.gender||'—')} · ${D.escape(p?.university||'—')} · ${D.escape(p?.area||'—')} · ${D.escape(t?.startLocality||'—')}</p><div class="actions"><button class="btn btn-primary" data-accept="${b.id}">قبول</button><button class="btn btn-danger" data-reject="${b.id}">رفض</button></div></div>`}).join(''):'<div class="empty">لا توجد طلبات حجز.</div>';document.querySelector('#myTrips').innerHTML=mine.length?mine.map(t=>`<div class="card"><div class="request-head"><strong>${D.escape(t.startLocality)} ← ${D.escape(t.destinationUniversity)}</strong><span class="badge ${t.status}">${t.status}</span></div><p>${D.formatDate(t.departureDate)} · ${t.departureTime} · ${D.formatPrice(t.price)} · ${t.availableSeats}/${t.totalSeats} مقاعد</p><div class="actions"><button class="btn btn-outline" data-edit="${t.id}">تعديل</button><button class="btn btn-danger" data-cancel="${t.id}">إلغاء</button></div></div>`).join(''):'<div class="empty">لا توجد رحلات.</div>';bind()}
function bind(){document.querySelectorAll('[data-accept]').forEach(b=>b.onclick=()=>changeBooking(b.dataset.accept,true));document.querySelectorAll('[data-reject]').forEach(b=>b.onclick=()=>changeBooking(b.dataset.reject,false));document.querySelectorAll('[data-cancel]').forEach(b=>b.onclick=()=>cancelTrip(b.dataset.cancel));document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openModal(b.dataset.edit));}async function changeBooking(id,accept){const booking=D.bookings().find(item=>item.id===id);if(!booking||booking.status!=='pending')return;try{await window.DARB_API.reviewBooking(id,accept?'confirmed':'rejected');D.toast(accept?'تم قبول الحجز وتحديث المقاعد.':'تم رفض طلب الحجز.','success');render()}catch(error){D.toast(error.message||'تعذر تحديث طلب الحجز.','error')}}async function cancelTrip(id){const trip=D.trips().find(item=>item.id===id);if(!trip)return;try{await window.DARB_API.saveTrip({...trip,status:'cancelled'});D.toast('تم إلغاء الرحلة.','success');render()}catch(error){D.toast(error.message||'تعذر إلغاء الرحلة.','error')}}function openModal(id){editing=id;const t=D.trips().find(x=>x.id===id);const f=document.querySelector('#tripForm');if(!f)return;f.tripId.value=t?.id||'';f.startLocality.value=t?.startLocality||'';f.startArea.value=t?.startArea||'';f.destinationUniversity.value=t?.destinationUniversity||'';f.departureDate.value=t?.departureDate||'';f.departureTime.value=t?.departureTime||'';f.price.value=t?.price||'';f.totalSeats.value=t?.totalSeats||'';f.vehicleType.value=t?.vehicleType||'Sedan';f.carModel.value=t?.carModel||'';f.carYear.value=t?.carYear||'';document.querySelector('#tripModal').classList.remove('hidden')}function close(){document.querySelector('#tripModal')?.classList.add('hidden');editing=null}async function saveTrip(e){e.preventDefault();const u=D.getUser(),f=e.target,trip={id:editing||D.tid(),driverId:u.id,driverName:u.fullName,driverGender:u.gender,startGovernorate:u.governorate,startArea:f.startArea.value,startLocality:f.startLocality.value,destinationUniversity:f.destinationUniversity.value,departureTime:f.departureTime.value,departureDate:f.departureDate.value,price:Number(f.price.value),totalSeats:Number(f.totalSeats.value),availableSeats:editing?Number(D.trips().find(item=>item.id===editing)?.availableSeats||f.totalSeats.value):Number(f.totalSeats.value),vehicleType:f.vehicleType.value,vehicleModel:f.carModel.value,carModel:f.carModel.value,vehicleYear:Number(f.carYear.value),plateNumber:u.plateNumber||'غير متاح',status:'open',passengers:editing?D.trips().find(item=>item.id===editing)?.passengers||[]:[],createdAt:new Date().toISOString(),driverLocation:null,notes:''};if(!trip.startLocality||!trip.destinationUniversity||!trip.departureDate||!trip.departureTime||trip.price<0||trip.totalSeats<1||trip.vehicleYear<1990){D.toast('تحقق من بيانات الرحلة.','error');return}if(new Date(trip.departureDate+'T'+trip.departureTime)<new Date()){D.toast('لا يمكن إنشاء رحلة في وقت سابق.','error');return}
try {
  if (editing) {
    await window.DARB_API.saveTrip(trip);
  } else {
    const settings = await window.DARB_API.getRewardSettings();
    const publishCost = Number(settings.TripPublishCost || settings.tripPublishCost || 50);
    const balance = (await window.DARB_API.getDriverPoints(u.id)).currentBalance;
    if (balance < publishCost) {
      D.toast(`رصيد النقاط غير كافٍ. الرصيد الحالي: ${balance}، التكلفة: ${publishCost}.`, 'error');
      return;
    }
    await window.DARB_API.publishTripWithPoints({ tripJson: JSON.stringify(trip), tripId: trip.id });
  }
  D.toast(editing?'تم تحديث الرحلة.':'تم إنشاء الرحلة.','success');
  close();
  render();
} catch (error) {
  D.toast(error.message || 'تعذر حفظ الرحلة.','error');
}
return;
}

document.addEventListener('DOMContentLoaded',()=>D.ready.then(()=>{render();document.querySelector('#openTripModal')?.addEventListener('click',()=>openModal(null));document.querySelectorAll('#closeTripModalX, #closeTripModal').forEach(button=>button.addEventListener('click',close));document.querySelector('#tripForm')?.addEventListener('submit',saveTrip);document.querySelector('#tripModal')?.addEventListener('click',e=>{if(e.target.id==='tripModal')close()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.querySelector('#tripModal')?.classList.contains('hidden'))close()})}));window.addEventListener('darb:data-updated',()=>D.ready.then(render));})();
