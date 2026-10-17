/* ================================================================
   Doddz Go — js/seller-barber.js
   تبويبات صاحب الصالون: فريق المحل · الصور · المواعيد · اللوكيشن
   ----------------------------------------------------------------
   * المنطق كله بيتكلم على BarberStore (اللي بيوصل Supabase) — مفيش SQL هنا.
   * الصور بتترفع على Storage عن طريق window.DoddzMedia، والصف بيخزن الرابط بس.
   * الملفات دي شغالة جوه لوحة البائع (index.html) بس، فلو التبويبات مش موجودة
     في الصفحة السكريبت يسكت من غير أخطاء.
   * الأمان: بنطلب صالون مربوط بالحساب الحالي (DoddzSeller.getBarber) —
     مش أول صالون معتمد، عشان صاحب مكان يعدّل مكان تاني بالغلط.
================================================================ */
(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const B = () => window.BarberStore;
  const S = () => window.DoddzSeller;

  const HERO_LIMIT = 20;
  let currentTab = null;
  let teamEdit = { id: null, name: '', title: '', photoUrl: '', isOwner: false, active: true, sortOrder: 0 };
  let busy = false;

  /* ── أدوات صغيرة ───────────────────────────────────────────── */
  function notify(msg) {
    if (S() && S().notify) S().notify(msg);
    else if (typeof window.showToast === 'function') window.showToast(msg);
    else alert(msg);
  }

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function errBox(id, msg) {
    const el = $(id);
    if (!el) return;
    if (msg) {
      el.innerHTML = '• ' + esc(msg);
      el.classList.add('show');
    } else {
      el.classList.remove('show');
      el.innerHTML = '';
    }
  }

  /** رابط الصورة: Storage خارجي، أو مسار نسبي للموقع */
  function imgSrc(url) {
    const u = String(url || '').trim();
    if (!u) return '';
    if (/^https?:\/\//i.test(u) || u.startsWith('/') || u.startsWith('data:')) return u;
    return '';
  }

  function avatarHtml(url, name, size) {
    const src = imgSrc(url);
    const sizeStyle = size ? ' style="width:' + size + 'px;height:' + size + 'px"' : '';
    if (src) return '<span class="sb-thumb-wrap"' + sizeStyle + '><img src="' + esc(src) + '" alt="' + esc(name || '') + '"/></span>';
    const initial = (String(name || 'ف').trim().slice(0, 1)) || 'ف';
    return '<span class="sb-thumb-wrap sb-thumb-empty"' + sizeStyle + '>' + esc(initial) + '</span>';
  }

  /** الصالون بتاع الحساب الحالي بالظبط (لا يوجد رجوع لأول حلاق معتمد) */
  function myBarber() {
    const s = S(), bs = B();
    if (!bs) return null;
    if (s && typeof s.getBarber === 'function') {
      const b = s.getBarber();
      if (b) return b;
    }
    // احتياطي بنفس الشرط، لو واجهة اللوحة اتحمّلت ناقصة أو getBarber رجّعت null
    const uid = s && s.getUserId ? s.getUserId() : null;
    if (uid && bs.getByUserId) { const byUser = bs.getByUserId(uid); if (byUser) return byUser; }
    const pid = s && s.getProviderId ? s.getProviderId() : null;
    if (pid && bs.getById) { const byId = bs.getById(String(pid)); if (byId) return byId; }
    return null;
  }

  /**
   * myBarber() + إعادة سحب الكتالوج من السحابة لو الصف مش موجود محليًا.
   * ده اللي بيربط حساب اتسجّل من جهاز تاني بأول فتح للوحة على الجهاز ده.
   */
  async function ensureBarber() {
    const direct = myBarber();
    if (direct) return direct;
    const s = S();
    if (s && typeof s.ensureBarber === 'function') {
      const viaSeller = await s.ensureBarber();
      if (viaSeller) return viaSeller;
    }
    return myBarber();
  }

  /** الرسالة بتقول بالضبط الناقص: دخول؟ قسم؟ ولا ملف صالون نفسه؟ */
  function missingBarberReason() {
    const s = S();
    const uid = s && s.getUserId ? s.getUserId() : null;
    if (!uid) return 'لازم تسجّلي دخول بحساب صاحب الصالون الأول.';
    const cat = s && s.getCategory ? s.getCategory() : null;
    const pid = s && s.getProviderId ? s.getProviderId() : null;
    if (cat && cat !== 'barbers') {
      const label = (window.SectionsStore && SectionsStore.SECTIONS && SectionsStore.SECTIONS[cat] && SectionsStore.SECTIONS[cat].label) || cat;
      return 'حسابك ده مسجّل في قسم «' + label + '» مش «قصها» — التبويبات دي لأصحاب الصالونات بس.';
    }
    if (pid) return 'فيه نشاط مربوط بالحساب (رقم ' + pid + ') بس مش وصل لكتالوج «قصها» — دوسي «تحديث» أو اعملي ريفريش للصفحة.';
    return 'لسه مفيش ملف صالون مربوط بحسابك في «قصها». اعملي طلب انضمام من «دخول/طلب انضمام» واختاري قسم قصها، والأدمن يعتمده هيظهر الفريق والصور والمواعيد هنا.';
  }

  function noBarberMessage(listEl) {
    if (listEl) {
      listEl.innerHTML = '<div class="adm-empty">' + esc(missingBarberReason()) +
        ' <button type="button" class="adm-btn secondary" id="sb-retry-barber" style="margin-right:8px">إعادة المحاولة</button></div>';
    }
  }

  /* ================================================================
     1) فريق المحل
  ================================================================ */
  function resetTeamForm() {
    teamEdit = { id: null, name: '', title: '', photoUrl: '', isOwner: false, active: true, sortOrder: 0 };
    const t = B();
    const count = myBarber() && t ? t.getTeam(myBarber().id, true).length : 0;
    if ($('#sb-team-name')) $('#sb-team-name').value = '';
    if ($('#sb-team-title')) $('#sb-team-title').value = '';
    if ($('#sb-team-photo')) $('#sb-team-photo').value = '';
    if ($('#sb-team-owner')) $('#sb-team-owner').checked = false;
    if ($('#sb-team-active')) $('#sb-team-active').checked = true;
    if ($('#sb-team-photo-state')) $('#sb-team-photo-state').textContent = '';
    const title = $('#sb-team-form-title');
    if (title) title.textContent = count ? 'إضافة عضو جديد (الحد الأقصى ' + (t.MAX_TEAM || 12) + ')' : 'أول عضو في الفريق';
    const save = $('#sb-team-save');
    if (save) save.textContent = '➕ إضافة / حفظ';
  }

  function fillTeamForm(m) {
    teamEdit = {
      id: m.id, name: m.name || '', title: m.title || '', photoUrl: m.photoUrl || '',
      isOwner: !!m.isOwner, active: m.active !== false, sortOrder: Number(m.sortOrder) || 0
    };
    if ($('#sb-team-name')) $('#sb-team-name').value = m.name || '';
    if ($('#sb-team-title')) $('#sb-team-title').value = m.title || '';
    if ($('#sb-team-owner')) $('#sb-team-owner').checked = !!m.isOwner;
    if ($('#sb-team-active')) $('#sb-team-active').checked = m.active !== false;
    if ($('#sb-team-photo')) $('#sb-team-photo').value = '';
    if ($('#sb-team-photo-state')) $('#sb-team-photo-state').textContent = m.photoUrl ? 'الصورة الحالية محفوظة — اختاري ملف جديد لو عايزه تغيّرها.' : '';
    const title = $('#sb-team-form-title');
    if (title) title.textContent = 'تعديل: ' + (m.name || 'عضو');
    const save = $('#sb-team-save');
    if (save) save.textContent = '💾 حفظ التعديل';
  }

  async function renderTeam() {
    const listEl = $('#sb-team-list');
    const stats = $('#sb-team-stats');
    const bs = B();
    if (!listEl) return;
    const barber = await ensureBarber();
    if (!barber || !bs) { noBarberMessage(listEl); if (stats) stats.textContent = 'لا يوجد صالون'; return; }

    if (bs.refreshTeam) await bs.refreshTeam(barber.id);
    const rows = bs.getTeam(barber.id, true);
    if (stats) stats.textContent = barber.name + ' · ' + rows.length + ' / ' + (bs.MAX_TEAM || 12) + ' عضو';

    if (!rows.length) {
      listEl.innerHTML = '<div class="adm-empty">الفريق فاضي — ضيف أول عضو بالفورم تحت، وهيظهر للزائر في صفحة الصالون.</div>';
      resetTeamForm();
      return;
    }
    listEl.innerHTML = rows.map((m, i) => `
      <div class="sb-team-card${m.active === false ? ' off' : ''}${m.isOwner ? ' owner' : ''}">
        <div class="sb-team-photo">${avatarHtml(m.photoUrl, m.name, 46)}</div>
        <div class="sb-team-info">
          <strong>${esc(m.name)}</strong>
          <span>${esc(m.title || 'فني')}${m.isOwner ? ' · صاحب الصالون' : ''}${m.active === false ? ' · مخفي' : ''}</span>
        </div>
        <div class="sb-team-actions">
          <button type="button" class="adm-btn secondary" data-team-move="up" data-id="${esc(m.id)}" ${i === 0 ? 'disabled' : ''} title="تقديم">▲</button>
          <button type="button" class="adm-btn secondary" data-team-move="down" data-id="${esc(m.id)}" ${i === rows.length - 1 ? 'disabled' : ''} title="تأخير">▼</button>
          <button type="button" class="adm-btn secondary" data-team-edit="${esc(m.id)}">تعديل</button>
          <button type="button" class="adm-btn secondary danger" data-team-del="${esc(m.id)}">حذف</button>
        </div>
      </div>
    `).join('');
  }

  async function saveTeam() {
    if (busy) return;
    const bs = B();
    const barber = await ensureBarber();
    if (!barber || !bs) { errBox('#sb-team-errors', missingBarberReason()); return; }

    const name = ($('#sb-team-name')?.value || '').trim();
    const title = ($('#sb-team-title')?.value || '').trim();
    const isOwner = !!$('#sb-team-owner')?.checked;
    const active = !!$('#sb-team-active')?.checked;
    const file = $('#sb-team-photo')?.files?.[0];

    errBox('#sb-team-errors', '');
    if (name.length < 2) { errBox('#sb-team-errors', 'اكتب اسم العضو (حرفين على الأقل)'); return; }

    busy = true;
    const state = $('#sb-team-photo-state');
    try {
      let photoUrl = teamEdit.photoUrl || '';
      if (file) {
        const up = window.DoddzMedia;
        if (!up) { errBox('#sb-team-errors', 'أداة رفع الصور مش متحمّلة'); return; }
        if (state) state.textContent = 'جاري رفع الصورة...';
        const res = await up.uploadImage(file, barber.id, { kind: 'team', maxSide: 700 });
        photoUrl = res.url;
        if (state) state.textContent = 'اترفعت ✓';
      }

      const res = await bs.saveTeamMember(barber.id, {
        id: teamEdit.id || undefined,
        name, title, photoUrl, isOwner, active,
        sortOrder: teamEdit.sortOrder
      });
      if (!res.success) { errBox('#sb-team-errors', res.error || 'تعذر الحفظ'); return; }
      if (res.offline) notify('اتحفظ على الجهاز لحد دلوقتي — اربطي نت عشان يرفع على السحابة');
      notify(teamEdit.id ? 'تم تعديل العضو' : 'تمت إضافة العضو للفريق');
      resetTeamForm();
      await renderTeam();
    } catch (e) {
      errBox('#sb-team-errors', e?.message || 'تعذر حفظ العضو');
      if (state) state.textContent = '';
    } finally {
      busy = false;
    }
  }

  async function moveTeam(id, dir) {
    const bs = B();
    const barber = await ensureBarber();
    if (!bs || !bs.reorderTeam || !barber) return;
    const ids = bs.getTeam(barber.id, true).map(t => String(t.id));
    const i = ids.indexOf(String(id));
    if (i < 0) return;
    const j = dir === 'up' ? i - 1 : i + 1;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    const res = await bs.reorderTeam(barber.id, ids);
    if (res && res.success === false) errBox('#sb-team-errors', res.error || 'تعذر ترتيب الفريق');
    await renderTeam();
  }

  function wireTeam() {
    $('#sb-team-refresh')?.addEventListener('click', () => renderTeam());
    $('#sb-team-save')?.addEventListener('click', saveTeam);
    $('#sb-team-reset')?.addEventListener('click', () => { resetTeamForm(); });
    $('#sb-team-list')?.addEventListener('click', async (e) => {
      const bs = B();
      const barber = await ensureBarber();
      if (!bs || !barber) return;
      const editBtn = e.target.closest('[data-team-edit]');
      const delBtn = e.target.closest('[data-team-del]');
      const moveBtn = e.target.closest('[data-team-move]');

      if (moveBtn) { await moveTeam(moveBtn.dataset.id, moveBtn.dataset.teamMove); return; }

      if (editBtn) {
        const m = bs.getTeam(barber.id, true).find(t => String(t.id) === editBtn.dataset.teamEdit);
        if (m) fillTeamForm(m);
        $('#sb-team-name')?.focus();
        return;
      }
      if (delBtn) {
        const m = bs.getTeam(barber.id, true).find(t => String(t.id) === delBtn.dataset.teamDel);
        if (!m) return;
        if (!confirm('تحذف «' + m.name + '» من الفريق؟')) return;
        const res = await bs.deleteTeamMember(m.id);
        if (!res.success) { errBox('#sb-team-errors', res.error || 'تعذر الحذف'); return; }
        if (teamEdit.id === m.id) resetTeamForm();
        notify('تم حذف العضو');
        await renderTeam();
      }
    });
  }

  /* ================================================================
     2) الصور: بروفايل + غلاف + ألبوم المكان + عينات الشغل
  ================================================================ */
  function setHeroPreviews(barber) {
    const av = $('#sb-prev-avatar');
    const cv = $('#sb-prev-cover');
    if (av) av.innerHTML = barber ? avatarHtml(barber.avatarUrl, barber.name, 72) : '';
    if (cv) {
      const src = imgSrc(barber && barber.coverUrl);
      cv.innerHTML = src
        ? '<img src="' + esc(src) + '" alt=""/>'
        : '<span class="sb-no-img">لا توجد صورة غلاف</span>';
    }
  }

  function mediaCard(x) {
    return `
      <div class="sb-media-card${x.active === false ? ' off' : ''}" data-media-id="${esc(x.id)}">
        <div class="sb-media-img"><img src="${esc(imgSrc(x.url))}" alt="" loading="lazy"/>
          ${x.active === false ? '<span class="sb-media-flag">مخفية</span>' : ''}
        </div>
        <input type="text" class="sb-media-caption" data-caption value="${esc(x.caption || '')}" maxlength="80" placeholder="تعليق قصير (اختياري)"/>
        <div class="sb-media-btns">
          <button type="button" class="adm-btn secondary" data-media-toggle="${esc(x.id)}">${x.active === false ? 'إظهار' : 'إخفاء'}</button>
          <button type="button" class="adm-btn secondary danger" data-media-del="${esc(x.id)}">حذف</button>
        </div>
      </div>`;
  }

  function renderGrid(sel, rows, countSel, limit) {
    const box = $(sel);
    if (box) box.innerHTML = rows.length
      ? rows.map(r => mediaCard(r)).join('')
      : '<div class="adm-empty">لسه مفيش صور — اختاري ملفات من الجهاز.</div>';
    const c = $(countSel);
    if (c) c.textContent = rows.length + '/' + limit;
  }

  async function renderMedia() {
    const bs = B();
    const barber = await ensureBarber();
    setHeroPreviews(barber);
    if (!barber || !bs) {
      noBarberMessage($('#sb-gallery-grid'));
      const stats = $('#sb-media-stats');
      if (stats) stats.textContent = 'لا يوجد صالون';
      return;
    }
    if (bs.refreshMedia) await bs.refreshMedia(barber.id);
    const stats = $('#sb-media-stats');
    if (stats) {
      const g = bs.mediaCount(barber.id, 'gallery');
      const s = bs.mediaCount(barber.id, 'sample');
      stats.textContent = barber.name + ' · ألبوم ' + g + ' · عينات ' + s;
    }
    renderGrid('#sb-gallery-grid', bs.getMedia(barber.id, 'gallery', true), '#sb-gallery-count', bs.MAX_GALLERY || HERO_LIMIT);
    renderGrid('#sb-sample-grid', bs.getMedia(barber.id, 'sample', true), '#sb-sample-count', bs.MAX_SAMPLES || HERO_LIMIT);
  }

  /** رفع صورة البروفايل أو الغلاف وتخزين الرابط في البروفايل */
  async function uploadHero(kind, inputSel, stateLabel) {
    const bs = B();
    const barber = await ensureBarber();
    if (!barber || !bs) { errBox('#sb-media-errors', missingBarberReason()); return; }
    const file = $(inputSel)?.files?.[0];
    if (!file) return;
    const up = window.DoddzMedia;
    if (!up) { errBox('#sb-media-errors', 'أداة رفع الصور مش متحمّلة'); return; }

    busy = true;
    try {
      const res = await up.uploadImage(file, barber.id, { kind });
      const fields = kind === 'avatar'
        ? { avatarUrl: res.url, avatar: '' }
        : { coverUrl: res.url };
      const saved = bs.updateProfile(barber.id, fields);
      if (!saved.success) throw new Error(saved.error || 'تعذر الحفظ');
      if (bs.pushCatalogField) {
        const push = await bs.pushCatalogField(barber.id, fields);
        if (push && push.ok === false) notify('الصورة اتحفظت محليًا بس: ' + (push.error || ''));
      }
      notify(stateLabel + ' تم رفعها');
      errBox('#sb-media-errors', '');
      $(inputSel).value = '';
      setHeroPreviews(bs.getById(barber.id));
    } catch (e) {
      errBox('#sb-media-errors', e?.message || 'تعذر رفع الصورة');
    } finally {
      busy = false;
    }
  }

  /** رفع دفعة صور للألبوم أو العينات */
  async function uploadBatch(kind, inputSel, stateSel) {
    const bs = B();
    const barber = await ensureBarber();
    if (!barber || !bs) { errBox('#sb-media-errors', missingBarberReason()); return; }
    const input = $(inputSel);
    const files = [...(input?.files || [])];
    if (!files.length) return;

    const limit = kind === 'sample' ? (bs.MAX_SAMPLES || HERO_LIMIT) : (bs.MAX_GALLERY || HERO_LIMIT);
    const room = Math.max(0, limit - bs.mediaCount(barber.id, kind, true));
    if (!room) { errBox('#sb-media-errors', 'الألبوم اكتمل — الحد الأقصى ' + limit + ' صورة'); input.value = ''; return; }
    const accepted = files.slice(0, room);
    if (accepted.length !== files.length) notify('خدنا أول ' + room + ' صورة عشان الحد الأقصى ' + limit);

    const up = window.DoddzMedia;
    if (!up) { errBox('#sb-media-errors', 'أداة رفع الصور مش متحمّلة'); return; }

    const state = $(stateSel);
    busy = true;
    let done = 0;
    try {
      if (state) state.textContent = 'جاري الرفع 0/' + accepted.length + '...';
      const out = await up.uploadMany(accepted, barber.id, { kind, parallel: 2 }, () => {
        done++;
        if (state) state.textContent = 'جاري الرفع ' + done + '/' + accepted.length + '...';
      });
      let added = 0;
      for (const img of out.uploaded) {
        const res = await bs.addMedia(barber.id, { kind, url: img.url });
        if (res.success) added++;
        else errBox('#sb-media-errors', res.error || 'تعذر إضافة صورة للألبوم');
      }
      const errs = out.errors || [];
      if (errs.length) errBox('#sb-media-errors', errs[0].message || 'بعض الصور مرفعتش');
      if (state) state.textContent = added ? 'اتضافت ' + added + ' صورة ✓' : '';
      if (added) notify('تمت إضافة ' + added + ' صورة');
      input.value = '';
      await renderMedia();
    } catch (e) {
      errBox('#sb-media-errors', e?.message || 'تعذر رفع الصور');
      if (state) state.textContent = '';
    } finally {
      busy = false;
    }
  }

  function findMedia(bs, barber, id) {
    const all = [...bs.getMedia(barber.id, 'gallery', true), ...bs.getMedia(barber.id, 'sample', true)];
    return all.find(x => String(x.id) === String(id)) || null;
  }

  async function mediaAction(id, action, captionInput) {
    const bs = B();
    const barber = await ensureBarber();
    if (!bs || !barber) return;
    const row = findMedia(bs, barber, id);
    if (!row) return;

    if (action === 'toggle') {
      const res = await bs.updateMedia(id, { active: row.active === false });
      if (!res.success) { errBox('#sb-media-errors', res.error || 'تعذر التغيير'); return; }
    } else if (action === 'del') {
      if (!confirm('تحذف الصورة دي؟')) return;
      const res = await bs.deleteMedia(id);
      if (!res.success) { errBox('#sb-media-errors', res.error || 'تعذر الحذف'); return; }
    } else if (action === 'caption') {
      const res = await bs.updateMedia(id, { caption: captionInput });
      if (!res.success) { errBox('#sb-media-errors', res.error || 'تعذر حفظ التعليق'); return; }
    }
    await renderMedia();
  }

  function wireMedia() {
    $('#sb-media-refresh')?.addEventListener('click', () => renderMedia());
    $('#sb-avatar-input')?.addEventListener('change', () => uploadHero('avatar', '#sb-avatar-input', 'صورة البروفايل'));
    $('#sb-cover-input')?.addEventListener('change', () => uploadHero('cover', '#sb-cover-input', 'صورة الغلاف'));
    $('#sb-gallery-input')?.addEventListener('change', () => uploadBatch('gallery', '#sb-gallery-input', '#sb-gallery-state'));
    $('#sb-sample-input')?.addEventListener('change', () => uploadBatch('sample', '#sb-sample-input', '#sb-sample-state'));

    ['#sb-gallery-grid', '#sb-sample-grid'].forEach(sel => {
      const box = $(sel);
      if (!box) return;
      box.addEventListener('click', (e) => {
        const t = e.target.closest('[data-media-toggle]');
        const d = e.target.closest('[data-media-del]');
        if (t) mediaAction(t.dataset.mediaToggle, 'toggle');
        else if (d) mediaAction(d.dataset.mediaDel, 'del');
      });
      box.addEventListener('change', (e) => {
        const inp = e.target.closest('[data-caption]');
        if (!inp) return;
        const card = inp.closest('[data-media-id]');
        if (card) mediaAction(card.dataset.mediaId, 'caption', inp.value);
      });
    });
  }

  /* ================================================================
     3) مواعيد كل يوم
  ================================================================ */
  function hourOptions(list, selected) {
    return list.map(v => '<option value="' + v + '"' + (Number(v) === Number(selected) ? ' selected' : '') + '>' + v + ':00</option>').join('');
  }

  async function renderHours() {
    const bs = B();
    const barber = await ensureBarber();
    const box = $('#sb-hours-rows');
    const stats = $('#sb-hours-stats');
    if (!box) return;
    if (!barber || !bs) { noBarberMessage(box); if (stats) stats.textContent = 'لا يوجد صالون'; return; }

    const view = bs.hoursView(barber);
    if (stats) stats.textContent = barber.name + ' · ' + bs.weekHoursText(barber);
    const slotEl = $('#sb-hours-slot');
    if (slotEl) slotEl.value = Number(barber.slotMinutes) || 30;

    box.innerHTML = view.map(d => `
      <div class="sb-hour-row${d.open ? '' : ' closed'}" data-day="${d.day}">
        <span class="sb-hour-day">${esc(d.label)}</span>
        <span class="sb-hour-check"><input type="checkbox" data-open ${d.open ? 'checked' : ''}/></span>
        <span class="sb-hour-time"><select data-from>${hourOptions(Array.from({ length: 24 }, (_, i) => i), d.from)}</select></span>
        <span class="sb-hour-time"><select data-to>${hourOptions(Array.from({ length: 24 }, (_, i) => i + 1), d.to)}</select></span>
      </div>
    `).join('');

    box.querySelectorAll('.sb-hour-row').forEach(row => {
      const cb = row.querySelector('[data-open]');
      cb.addEventListener('change', () => row.classList.toggle('closed', !cb.checked));
    });
  }

  function collectHours() {
    const rows = [...document.querySelectorAll('#sb-hours-rows .sb-hour-row')];
    return rows.map(row => ({
      day: Number(row.dataset.day),
      open: !!row.querySelector('[data-open]')?.checked,
      from: Number(row.querySelector('[data-from]')?.value || 0),
      to: Number(row.querySelector('[data-to]')?.value || 1)
    }));
  }

  async function saveHoursForm() {
    const bs = B();
    const barber = await ensureBarber();
    if (!barber || !bs) { errBox('#sb-hours-errors', missingBarberReason()); return; }
    const days = collectHours();
    const closedAll = days.every(d => !d.open);
    if (closedAll) { errBox('#sb-hours-errors', 'لازم يوم واحد على الأقل يكون مفتوح'); return; }
    const bad = days.find(d => d.open && d.to <= d.from);
    if (bad) {
      const dayName = (bs.DAYS_AR && bs.DAYS_AR[bad.day]) || ('يوم ' + bad.day);
      errBox('#sb-hours-errors', dayName + ': نهاية العمل لازم بعد البداية');
      return;
    }

    const slot = Number($('#sb-hours-slot')?.value) || 30;
    errBox('#sb-hours-errors', '');
    const btn = $('#sb-hours-save');
    if (btn) { btn.disabled = true; btn.textContent = 'جاري الحفظ...'; }
    try {
      const res = await bs.saveHours(barber.id, days, { slotMinutes: slot });
      if (!res.success) { errBox('#sb-hours-errors', res.error || 'تعذر حفظ المواعيد'); return; }
      notify(res.offline ? 'المواعيد اتحفظت على الجهاز — اربطي نت للمزامنة' : 'تم حفظ مواعيد الصالون');
      await renderHours();
      if (typeof window.renderBarbersSection === 'function') window.renderBarbersSection();
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '💾 حفظ المواعيد'; }
    }
  }

  function wireHours() {
    $('#sb-hours-refresh')?.addEventListener('click', () => renderHours());
    $('#sb-hours-save')?.addEventListener('click', saveHoursForm);
    $('#sb-hours-copy')?.addEventListener('click', () => {
      const first = document.querySelector('#sb-hours-rows .sb-hour-row');
      if (!first) return;
      const open = !!first.querySelector('[data-open]')?.checked;
      const from = first.querySelector('[data-from]')?.value;
      const to = first.querySelector('[data-to]')?.value;
      document.querySelectorAll('#sb-hours-rows .sb-hour-row').forEach(row => {
        const cb = row.querySelector('[data-open]');
        cb.checked = open;
        row.classList.toggle('closed', !open);
        row.querySelector('[data-from]').value = from;
        row.querySelector('[data-to]').value = to;
      });
      notify('اتنسخ لباقي الأيام — دوسي حفظ');
    });
  }

  /* ================================================================
     4) اللوكيشن
     خط الطول والعرض مش معروضين لصاحب الصالون — الحقول لسه موجودة
     (مخفية في index.html) عشان القيم اللي اتحفظت قبل كده ما تضيعش.
  ================================================================ */
  const GEO_BTN_LABEL = '📍 حدّد موقعي على الخريطة';

  async function renderLocation() {
    const bs = B();
    const barber = await ensureBarber();
    const stats = $('#sb-loc-stats');
    if (!barber || !bs) {
      if (stats) stats.textContent = 'لا يوجد صالون';
      ['#sb-loc-address', '#sb-loc-lat', '#sb-loc-lng', '#sb-loc-map', '#sb-loc-note'].forEach(s => { if ($(s)) $(s).value = ''; });
      return;
    }
    const loc = barber.location || {};
    if (stats) stats.textContent = barber.name + (loc.address ? ' · ' + loc.address : ' · من غير عنوان');
    if ($('#sb-loc-address')) $('#sb-loc-address').value = loc.address || '';
    if ($('#sb-loc-lat')) $('#sb-loc-lat').value = loc.lat || '';
    if ($('#sb-loc-lng')) $('#sb-loc-lng').value = loc.lng || '';
    if ($('#sb-loc-map')) $('#sb-loc-map').value = loc.mapUrl || '';
    if ($('#sb-loc-note')) $('#sb-loc-note').value = loc.note || '';
    updateLocPreview();
  }

  /** رابط الخريطة: المستخدم اختاره > الإحداثيات > العنوان */
  function locMapUrl(loc) {
    if (loc.mapUrl) return loc.mapUrl;
    if (loc.lat && loc.lng) return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(loc.lat + ',' + loc.lng);
    if (loc.address) return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(loc.address);
    return '';
  }

  function readLocForm() {
    return {
      address: ($('#sb-loc-address')?.value || '').trim(),
      lat: ($('#sb-loc-lat')?.value || '').trim(),
      lng: ($('#sb-loc-lng')?.value || '').trim(),
      mapUrl: ($('#sb-loc-map')?.value || '').trim(),
      note: ($('#sb-loc-note')?.value || '').trim()
    };
  }

  function updateLocPreview() {
    const box = $('#sb-loc-box');
    if (!box) return;
    const loc = readLocForm();
    const url = locMapUrl(loc);
    box.innerHTML = url
      ? '<a href="' + esc(url) + '" target="_blank" rel="noopener">🗺️ ' + esc(loc.address || (loc.lat + ',' + loc.lng)) + '</a>'
      : '<span class="sb-no-img">اكتب العنوان — رابط الخريطة هيظهر هنا أوتوماتيك</span>';
  }

  async function saveLocationForm() {
    const bs = B();
    const barber = await ensureBarber();
    if (!barber || !bs) { errBox('#sb-loc-errors', missingBarberReason()); return; }
    const loc = readLocForm();
    errBox('#sb-loc-errors', '');
    const btn = $('#sb-loc-save');
    if (btn) { btn.disabled = true; btn.textContent = 'جاري الحفظ...'; }
    try {
      const res = await bs.saveLocation(barber.id, loc);
      if (!res.success) { errBox('#sb-loc-errors', res.error || 'تعذر حفظ اللوكيشن'); return; }
      notify(res.offline ? 'اللوكيشن اتحفظ على الجهاز — اربطي نت للمزامنة'
        : (res.cleared ? 'تم مسح عنوان الصالون' : 'تم حفظ موقع الصالون'));
      await renderLocation();
      if (typeof window.renderBarbersSection === 'function') window.renderBarbersSection();
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '💾 حفظ اللوكيشن'; }
    }
  }

  function wireLocation() {
    $('#sb-loc-refresh')?.addEventListener('click', () => renderLocation());
    $('#sb-loc-save')?.addEventListener('click', saveLocationForm);
    ['#sb-loc-address', '#sb-loc-lat', '#sb-loc-lng', '#sb-loc-map'].forEach(s => $(s)?.addEventListener('input', updateLocPreview));
    $('#sb-loc-preview')?.addEventListener('click', () => {
      const url = locMapUrl(readLocForm());
      if (!url) { errBox('#sb-loc-errors', 'اكتب العنوان الأول'); return; }
      window.open(url, '_blank', 'noopener');
    });
    $('#sb-loc-geo')?.addEventListener('click', () => {
      if (!navigator.geolocation) { errBox('#sb-loc-errors', 'المتصفح ده مش بيدعم تحديد الموقع — اكتب العنوان وكفاية'); return; }
      const btn = $('#sb-loc-geo');
      if (btn) { btn.disabled = true; btn.textContent = 'جاري التحديد...'; }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if ($('#sb-loc-lat')) $('#sb-loc-lat').value = pos.coords.latitude.toFixed(6);
          if ($('#sb-loc-lng')) $('#sb-loc-lng').value = pos.coords.longitude.toFixed(6);
          if (btn) { btn.disabled = false; btn.textContent = GEO_BTN_LABEL; }
          updateLocPreview();
          notify('تم تحديد موقعك — دوسي حفظ اللوكيشن');
        },
        () => {
          if (btn) { btn.disabled = false; btn.textContent = GEO_BTN_LABEL; }
          errBox('#sb-loc-errors', 'متقدرناش نحدّد الموقع — اكتبّي العنوان بالظبط واحفظي، ده كفاية');
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  /* ================================================================
     التشغيل
  ================================================================ */
  const RENDERERS = {
    'barber-team': renderTeam,
    'barber-gallery': renderMedia,
    'barber-hours': renderHours,
    'barber-location': renderLocation
  };

  function render(tab) {
    const fn = RENDERERS[tab];
    if (fn) Promise.resolve(fn()).catch(e => console.warn('[SellerBarber]', tab, e));
  }

  function boot() {
    if (!$('#seller-view-barber-team')) return;   // الصفحة دي مفيهاش لوحة بائع
    wireTeam(); wireMedia(); wireHours(); wireLocation();
    // زرار «إعادة المحاولة» في رسالة «مفيش صالون مربوط» — بيسحب الكتالوج من السحابة
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#sb-retry-barber')) return;
      render(currentTab || 'barber-team');
    });
    // الحدث بيتبعت على window (js/seller.js) — ف لازم الاستماع يكون على window،
    // مش document (الحدث ما يوصلش لأسفل الشجرة).
    window.addEventListener('doddz:seller-tab', (e) => {
      const tab = e.detail && e.detail.tab;
      currentTab = tab;
      if (tab === 'barber-team') resetTeamForm();
      render(tab);
    });
    // لو الملف اتحمّل بعد ما اللوحة فاتحة (ترتيب السكربتات)
    if (window.DoddzSeller) {
      window.DoddzSeller.onSectionChange = () => render(currentTab);
      const active = document.querySelector('#seller-overlay .adm-tab.active');
      if (active && RENDERERS[active.dataset.tab]) render(active.dataset.tab);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
