/* ================================================================
   DODDZ GO — js/technician-apply.js
   ------------------------------------------------------------
   منطق صفحة استمارة فني الحلاقة (technician-apply.html):
     1) التحقق من البيانات في الواجهة (رسايل عربية مفهومة).
     2) الصورة اختيارية: لو اختار صورة والرفع فشل، الاستمارة تفضل
        تمشي من غيرها — الصورة ما تعطّلس الإرسال خالص.
     3) الإرسال بدالة submit_technician_application في Supabase
        (RLS بيتعامل مع anon؛ مفيش أي صلاحية معرّفة هنا في JS).
     4) كود المتابعة: الفني بيشوف حالة طلبه بدالة
        technician_application_status (الحالة وملاحظات الإدارة بس).
     5) صفحة معزولة: مفيهاش روابط للخارج، والقفل في js/job-lock.js.
   مفيش سلة/حساب/منتجات في الملف ده.
================================================================ */
(function () {
  'use strict';

  var BUCKET = 'technician-applications';
  var LAST_CODE_KEY = 'doddz_job_last_code';
  var STATE_KEY = 'doddz_job_form';

  var STATUS_META = {
    pending:   { label: 'قيد المراجعة',           note: 'الاستمارة وصلت وفي انتظار المراجعة.' },
    reviewing: { label: 'بيراجعها فريق التوظيف',  note: 'فيه حد بيشوف بياناتك دلوقتي.' },
    approved:  { label: 'مقبولة',                 note: 'تم قبول الاستمارة، وهيتواصلوا معاك على الرقم.' },
    hired:     { label: 'تم التعيين',             note: 'تم الاتفاق على التعيين.' },
    rejected:  { label: 'غير مقبولة حاليًا',      note: 'الاستمارة اتراجعت ومفيش مكان مناسب حاليًا.' }
  };

  var $ = function (sel) { return document.querySelector(sel); };

  var form       = $('#ta-form');
  var doneCard   = $('#ta-done');
  var errorsEl   = $('#ta-errors');
  var submitBtn  = $('#ta-submit');
  var photoInput = $('#ta-photo');
  var photoBtn   = $('#ta-photo-btn');
  var photoClear = $('#ta-photo-clear');
  var photoPrev  = $('#ta-photo-prev');
  var photoState = $('#ta-photo-state');
  var photoBox   = $('#ta-photo-box');

  var pickedFile = null;
  var busy = false;

  function client() { return window.supabaseClient || null; }

  function icon(name, size) {
    if (window.DoddzIcon && window.DoddzIcon.has && window.DoddzIcon.has(name)) {
      return window.DoddzIcon.svg(name, { size: size || 15, cls: 'ic-inline' });
    }
    return '';
  }

  /* ── أدوات ─────────────────────────────────────────────────── */
  // ٠١٢٣٤٥٦٧٨٩ وفارسي → ASCII، عشان اللي يكتب بالرقم العربي ما تقفش
  function toAsciiDigits(v) {
    return String(v == null ? '' : v)
      .replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 1632); })
      .replace(/[۰-۹]/g, function (d) { return String(d.charCodeAt(0) - 1776); });
  }

  function val(sel) {
    var el = $(sel);
    return el ? String(el.value || '').trim() : '';
  }

  function num(sel) {
    var raw = toAsciiDigits(val(sel)).replace(/[^\d.]/g, '');
    if (!raw) return null;
    var n = parseInt(raw, 10);
    return isNaN(n) ? null : n;
  }

  function showError(list) {
    if (!errorsEl) return;
    if (!list || !list.length) {
      errorsEl.classList.remove('is-on');
      errorsEl.innerHTML = '';
      return;
    }
    errorsEl.innerHTML = '<b>' + icon('warning', 15) +
      ' كمل البيانات الناقصة</b>' + list.map(function (t) { return '• ' + t; }).join('<br>');
    errorsEl.classList.add('is-on');
    errorsEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function setPhotoState(msg, warn) {
    if (!photoState) return;
    photoState.innerHTML = msg ? (icon(warn ? 'info' : 'check', 14) + ' ' + msg) : '';
    photoState.classList.toggle('is-warn', !!warn);
  }

  function mark(sel, on) {
    var el = $(sel);
    if (!el) return;
    el.style.borderColor = on ? '#B3261E' : '';
    el.style.background = on ? '#FDF3F2' : '';
    if (on) el.classList.add('ta-bad'); else el.classList.remove('ta-bad');
  }

  /* ── 1) بلاطات التخصصات ─────────────────────────────────────── */
  function wireSpecs() {
    var box = $('#ta-specs');
    if (!box) return;
    box.addEventListener('change', function (e) {
      var input = e.target.closest('input[type="checkbox"]');
      if (!input) return;
      var chip = input.closest('.ta-spec');
      if (chip) chip.classList.toggle('is-on', input.checked);
    });
  }

  function pickedSpecs() {
    var out = [];
    document.querySelectorAll('#ta-specs input[type="checkbox"]:checked').forEach(function (c) {
      if (c.value) out.push(c.value);
    });
    return out;
  }

  /* ── 2) الصورة (اختيارية) ──────────────────────────────────── */
  function wirePhoto() {
    if (!photoInput || !photoBtn) return;

    photoBtn.addEventListener('click', function () { photoInput.click(); });

    photoInput.addEventListener('change', function () {
      var f = photoInput.files && photoInput.files[0];
      if (!f) { clearPhoto(); return; }
      if (f.type && f.type.indexOf('image/') !== 0) {
        setPhotoState('الملف ده مش صورة.', true);
        clearPhoto();
        return;
      }
      if (f.size > 12 * 1024 * 1024) {
        setPhotoState('الصورة أكبر من 12 ميجابايت — اختار صورة أصغر.', true);
        clearPhoto();
        return;
      }
      pickedFile = f;
      try {
        photoPrev.src = URL.createObjectURL(f);
        photoPrev.classList.add('is-on');
      } catch (e) { /* مفيش معاينة، والرفع كله تمام */ }
      if (photoClear) photoClear.hidden = false;
      if (photoBox) photoBox.classList.remove('is-bad');
      setPhotoState('تم اختيار الصورة — هتتضغط أوتوماتيك وقت الإرسال.');
      saveDraft();
    });

    if (photoClear) photoClear.addEventListener('click', clearPhoto);
  }

  function clearPhoto() {
    pickedFile = null;
    try {
      if (photoInput) photoInput.value = '';
      if (photoPrev) { photoPrev.removeAttribute('src'); photoPrev.classList.remove('is-on'); }
      if (photoClear) photoClear.hidden = true;
    } catch (e) {}
    setPhotoState('');
  }

  // بترجّع رابط عام أو null — أي فشل بيرجع null من غير ما يعطّل الإرسال
  function uploadPhoto() {
    if (!pickedFile) return Promise.resolve(null);
    var sb = client();
    if (!sb || !sb.storage || !window.DoddzMedia || !DoddzMedia.compress) {
      setPhotoState('مفيش اتصال بالسحابة — الاستمارة هتتمشي من غير الصورة.', true);
      return Promise.resolve(null);
    }

    setPhotoState('برفع الصورة…');
    var objectPath = '';
    return DoddzMedia.compress(pickedFile, { maxSide: 900, quality: 0.8 })
      .then(function (res) {
        var id = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
        // أول مجلد لازم يكون apps/ — سياسة الـ RLS بترفض أي مجلد غيره
        objectPath = 'apps/' + id + '/photo.jpg';
        return sb.storage.from(BUCKET)
          .upload(objectPath, res.blob, { contentType: 'image/jpeg', upsert: false, cacheControl: '3600' });
      })
      .then(function (out) {
        if (out && out.error) throw out.error;
        var pub = sb.storage.from(BUCKET).getPublicUrl(objectPath);
        if (!pub || !pub.data || !pub.data.publicUrl) throw new Error('مفيش رابط');
        setPhotoState('الصورة اترفعت.');
        return pub.data.publicUrl;
      })
      .catch(function (err) {
        console.warn('[Apply] photo upload:', err);
        setPhotoState('الصورة ما اترفعش — الاستمارة هتتمشي من غير الصورة.', true);
        return null;
      });
  }

  /* ── 3) المسوّدة: بيانات الفني ما تتفش لو الصفحة اتقفلت بالغلط ── */
  function saveDraft() {
    try {
      var d = {
        name: val('#ta-name'), phone: val('#ta-phone'), alt: val('#ta-alt-phone'),
        age: val('#ta-age'), gov: val('#ta-gov'), area: val('#ta-area'),
        address: val('#ta-address'), exp: val('#ta-exp'), prev: val('#ta-prev'),
        cert: val('#ta-certificate'), salary: val('#ta-salary'), email: val('#ta-email'),
        sys: val('#ta-system'), shift: val('#ta-shift'), from: val('#ta-from'),
        port: val('#ta-portfolio'), notes: val('#ta-notes'), specs: pickedSpecs()
      };
      sessionStorage.setItem(STATE_KEY, JSON.stringify(d));
    } catch (e) {}
  }

  function restoreDraft() {
    var d = null;
    try { d = JSON.parse(sessionStorage.getItem(STATE_KEY) || 'null'); } catch (e) {}
    if (!d) return;
    var map = {
      '#ta-name': d.name, '#ta-phone': d.phone, '#ta-alt-phone': d.alt, '#ta-age': d.age,
      '#ta-gov': d.gov, '#ta-area': d.area, '#ta-address': d.address, '#ta-exp': d.exp,
      '#ta-prev': d.prev, '#ta-certificate': d.cert, '#ta-salary': d.salary,
      '#ta-email': d.email,
      '#ta-system': d.sys, '#ta-shift': d.shift, '#ta-from': d.from,
      '#ta-portfolio': d.port, '#ta-notes': d.notes
    };
    Object.keys(map).forEach(function (sel) {
      var el = $(sel);
      if (el && map[sel]) el.value = map[sel];
    });
    (d.specs || []).forEach(function (s) {
      var box = document.querySelector('#ta-specs input[value="' + s + '"]');
      if (box) { box.checked = true; var c = box.closest('.ta-spec'); if (c) c.classList.add('is-on'); }
    });
  }

  function dropDraft() {
    try { sessionStorage.removeItem(STATE_KEY); } catch (e) {}
  }

  /* ── 4) التحقق والإرسال ────────────────────────────────────── */
  function collect() {
    var bad = [];
    var name  = val('#ta-name');
    var phone = toAsciiDigits(val('#ta-phone')).replace(/\D/g, '');
    var alt   = toAsciiDigits(val('#ta-alt-phone')).replace(/\D/g, '');
    var age   = num('#ta-age');
    var gov   = val('#ta-gov');
    var exp   = num('#ta-exp');
    var salary = num('#ta-salary');

    mark('#ta-name', false); mark('#ta-phone', false); mark('#ta-age', false);
    mark('#ta-gov', false); mark('#ta-exp', false); mark('#ta-salary', false);

    if (name.length < 3) { bad.push('اكتب الاسم بالكامل (٣ حروف على الأقل).'); mark('#ta-name', true); }
    if (!/^01\d{9}$/.test(phone)) {
      bad.push('رقم الموبايل لازم يكون ١١ رقم ويبدأ بـ 01.');
      mark('#ta-phone', true);
    }
    if (alt && !/^01\d{9}$/.test(alt)) { bad.push('الرقم التاني مش صحيح — سيبه فاضي أو اكتبه صح.'); mark('#ta-alt-phone', true); }
    if (age === null || age < 16 || age > 70) {
      bad.push('السن لازم يكون بين ١٦ و ٧٠.');
      mark('#ta-age', true);
    }
    if (!gov) { bad.push('اختار المحافظة اللي ساكن فيها.'); mark('#ta-gov', true); }
    var email = val('#ta-email');
    if (email && (email.indexOf('@') < 1 || email.indexOf('.') < 0)) {
      bad.push('البريد الإلكتروني مش مكتوب صح — سيبه فاضي أو اكتبه كامل.');
      mark('#ta-email', true);
    }
    if (exp === null) { bad.push('حدد سنوات الخبرة.'); mark('#ta-exp', true); }
    if (salary === null || salary <= 0) { bad.push('اكتب المرتب المتوقع بالجنيه.'); mark('#ta-salary', true); }

    var consent = $('#ta-consent');
    if (!(consent && consent.checked)) bad.push('لازم توافق على حفظ البيانات للاستخدامها في التوظيف.');

    return {
      ok: bad.length === 0,
      bad: bad,
      payload: {
        p_full_name: name,
        p_phone: phone,
        p_alt_phone: alt || null,
        p_age: age,
        p_governorate: gov,
        p_area: val('#ta-area') || null,
        p_address: val('#ta-address') || null,
        p_experience_years: exp,
        p_previous_salons: val('#ta-prev') || null,
        p_specialties: pickedSpecs(),
        p_expected_salary: salary,
        p_work_system: val('#ta-system') || null,
        p_preferred_shift: val('#ta-shift') || null,
        p_available_from: val('#ta-from') || null,
        p_portfolio_url: val('#ta-portfolio') || null,
        p_notes: val('#ta-notes') || null,
        p_email: val('#ta-email') || null,
        p_certification: val('#ta-certificate') || null,
        p_consent: true
      }
    };
  }

  function setBusy(on) {
    busy = !!on;
    if (!submitBtn) return;
    submitBtn.disabled = busy;
    submitBtn.innerHTML = busy
      ? icon('clock', 16) + ' جارِ الإرسال…'
      : icon('check', 16) + ' إرسال الاستمارة';
  }

  function onSubmit(e) {
    if (e) e.preventDefault();
    if (busy) return;

    showError([]);
    var data = collect();
    if (!data.ok) { showError(data.bad); return; }

    var sb = client();
    if (!sb) {
      showError(['الاتصال بالسحابة مش شغال — افتح الصفحة على نت تاني وحاول تاني.']);
      return;
    }

    setBusy(true);

    uploadPhoto().then(function (photoUrl) {
      var payload = data.payload;
      payload.p_photo_url = photoUrl || null;
      return sb.rpc('submit_technician_application', payload);
    }).then(function (res) {
      if (res.error) throw res.error;
      var out = typeof res.data === 'string' ? JSON.parse(res.data) : (res.data || {});
      if (!out || out.success !== true) throw new Error((out && out.error) || 'الاستمارة ما اتبعتش');
      showDone(out);
    }).catch(function (err) {
      console.error('[Apply] submit:', err);
      var msg = (err && err.message) ? String(err.message) : '';
      // رسايل الدالة في Supabase عربية، وغير كده بنوري رسالة عامة
      if (!/[؀-ۿ]/.test(msg)) msg = 'حصل خطأ أثناء الإرسال — حاول مرة تانية.';
      showError([msg]);
    }).then(function () {
      setBusy(false);
    });
  }

  function showDone(out) {
    dropDraft();
    var code = out.track_code || '—';
    try { sessionStorage.setItem(LAST_CODE_KEY, code); } catch (e) {}

    var codeEl = $('#ta-done-code');
    if (codeEl) codeEl.textContent = code;

    var msgEl = $('#ta-done-msg');
    if (msgEl) {
      msgEl.textContent = out.duplicate === true
        ? 'في استمارة مسجلة بنفس رقم الموبايل قبل كده، وهي دي اللي هتتراجع. احتفظ بالكود للمتابعة.'
        : 'الاستمارة وصلت للإدارة. فريق التوظيف بيراجع الطلبات، وهيتواصل معاك على رقم الموبايل اللي كتبته.';
    }

    if (form) form.hidden = true;
    if (doneCard) {
      doneCard.hidden = false;
      doneCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    var input = $('#ta-code-input');
    if (input) input.value = code;
    lookup().catch(function () {});
  }

  function resetForm() {
    if (form) {
      form.reset();
      form.hidden = false;
      clearPhoto();
      document.querySelectorAll('#ta-specs .ta-spec.is-on').forEach(function (c) { c.classList.remove('is-on'); });
      showError([]);
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (doneCard) doneCard.hidden = true;
  }

  /* ── 5) متابعة الحالة بكود المتابعة ────────────────────────── */
  function lookup() {
    var outEl = $('#ta-lookup-result');
    var code = val('#ta-code-input').toUpperCase().replace(/\s+/g, '');
    if (!outEl) return Promise.resolve();

    if (!code) {
      outEl.innerHTML = '<span style="color:#A65A00">' + icon('info', 15) + ' اكتب كود المتابعة الأول (مثال: TA-1A2B3C4D).</span>';
      return Promise.resolve();
    }
    var sb = client();
    if (!sb) {
      outEl.innerHTML = '<span style="color:#8C2B2B">الاتصال بالسحابة مش شغال.</span>';
      return Promise.resolve();
    }

    outEl.innerHTML = icon('clock', 15) + ' جارِ السؤال…';
    return sb.rpc('technician_application_status', { p_track_code: code })
      .then(function (res) {
        if (res.error) throw res.error;
        var rows = res.data || [];
        var row = Array.isArray(rows) ? rows[0] : rows;
        if (!row || !row.status) {
          outEl.innerHTML = '<span style="color:#8C2B2B">' + icon('warning', 15) +
            ' مفيش استمارة بالكود ده — اتأكد من الحروف والأرقام.</span>';
          return;
        }
        var meta = STATUS_META[row.status] || STATUS_META.pending;
        var when = row.submitted_at ? new Date(row.submitted_at).toLocaleString('ar-EG') : '';
        outEl.innerHTML =
          '<span class="ta-state ' + row.status + '">' + icon('info', 14) + ' ' + meta.label + '</span>' +
          '<div style="margin-top:8px">' + meta.note + (when ? ' تاريخ الإرسال: ' + when + '.' : '') + '</div>' +
          (row.admin_notes
            ? '<div style="margin-top:6px"><b>رد الإدارة:</b> ' + escapeHtml(row.admin_notes) + '</div>'
            : '');
      })
      .catch(function (err) {
        console.warn('[Apply] lookup:', err);
        outEl.innerHTML = '<span style="color:#8C2B2B">' + icon('warning', 15) +
          ' تعذر معرفة الحالة — اتأكد إن ملف <b>supabase/12-technician-applications.sql</b> اتنفّذ في SQL Editor.</span>';
      });
  }

  function escapeHtml(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ── 6) التشغيل ────────────────────────────────────────────── */
  function boot() {
    if (!form) return;

    wireSpecs();
    wirePhoto();
    restoreDraft();

    form.addEventListener('input', saveDraft);
    form.addEventListener('change', saveDraft);
    form.addEventListener('submit', onSubmit);

    var againBtn = $('#ta-another');
    if (againBtn) againBtn.addEventListener('click', resetForm);

    var goLookup = $('#ta-go-lookup');
    if (goLookup) goLookup.addEventListener('click', function () {
      var card = $('#ta-lookup-card');
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      var input = $('#ta-code-input');
      if (input && !input.value) {
        try { input.value = sessionStorage.getItem(LAST_CODE_KEY) || ''; } catch (e) {}
      }
    });

    var lookupBtn = $('#ta-lookup-btn');
    if (lookupBtn) lookupBtn.addEventListener('click', function () { lookup(); });
    var codeInput = $('#ta-code-input');
    if (codeInput) codeInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); lookup(); }
    });

    // لو الفني سبق وبعت استمارة في نفس التبويب، نملّي كود المتابعة الأخير
    var last = null;
    try { last = sessionStorage.getItem(LAST_CODE_KEY); } catch (e) {}
    if (last && codeInput && !codeInput.value) codeInput.value = last;

    if (window.DoddzIcon && DoddzIcon.hydrate) DoddzIcon.hydrate();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
