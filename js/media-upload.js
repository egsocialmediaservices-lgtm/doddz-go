/* ================================================================
   Doddz Go — js/media-upload.js
   رفع صور الأنشطة على Supabase Storage (bucket: provider-media)
   ----------------------------------------------------------------
   * بيضغط الصورة في المتصفح (canvas) قبل الرفع: طول الضلع 1400px و JPEG 82%
     → صورة الموبايل العادية بتبقى ~150KB بدل 3MB.
   * المسار دايمًا يبدأ بمعرّف النشاط:  <providerId>/<kind>/<file>.jpg
     وسياسات RLS بتسمح بالرفع لمالك النشاط ده بس (شوف supabase/08-*.sql).
   * بيرجع رابط عام بيتحفظ في العمود/الصف — فحجم صفحة الصالون يفضل كيلوبايتات.
   * مفيش أي منطق تجاري هنا — رفّع صور وبس.
================================================================ */
(function () {
  'use strict';

  var BUCKET = 'provider-media';
  var MAX_SIDE = 1400;
  var QUALITY = 0.82;
  var MAX_INPUT_BYTES = 12 * 1024 * 1024;   // 12MB قبل الضغط — أكبر من كده مرفوض

  function client() {
    return window.supabaseClient || null;
  }

  function clamp(label, msg) {
    var e = new Error(msg);
    e.label = label;
    return e;
  }

  function randomId() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  /* ── 1) الضغط ────────────────────────────────────────────────
     بيرجع Blob JPEG + الأبعاد الجديدة. الفوتوشوب/PNG بيتحول JPEG
     (الخلفية بتتملا أبيض لو PNG شفاف). */
  function compress(file, opts) {
    opts = opts || {};
    var maxSide = opts.maxSide || MAX_SIDE;
    var quality = typeof opts.quality === 'number' ? opts.quality : QUALITY;

    return new Promise(function (resolve, reject) {
      if (!file) return reject(clamp('no-file', 'مفيش ملف متحدد.'));
      if (file.type && file.type.indexOf('image/') !== 0) {
        return reject(clamp('bad-type', 'الملف ده مش صورة.'));
      }
      if (file.size > MAX_INPUT_BYTES) {
        return reject(clamp('too-big', 'الصورة أكبر من 12 ميجابايت — اختاري صورة أصغر.'));
      }

      var url = URL.createObjectURL(file);
      var img = new Image();

      img.onload = function () {
        try {
          var w = img.naturalWidth || img.width;
          var h = img.naturalHeight || img.height;
          if (!w || !h) throw clamp('no-dims', 'متقدرش يقرا مقاس الصورة.');

          var scale = Math.min(1, maxSide / Math.max(w, h));
          var tw = Math.max(1, Math.round(w * scale));
          var th = Math.max(1, Math.round(h * scale));

          var canvas = document.createElement('canvas');
          canvas.width = tw;
          canvas.height = th;
          var ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, tw, th);
          ctx.imageSmoothingEnabled = true;
          if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, tw, th);

          canvas.toBlob(function (blob) {
            URL.revokeObjectURL(url);
            if (!blob) return reject(clamp('encode', 'فشل تحويل الصورة.'));
            resolve({ blob: blob, width: tw, height: th, from: { width: w, height: h } });
          }, 'image/jpeg', quality);
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(clamp('decode', 'الصورة مش قابلة للقراءة — جرّبي صورة تانية.'));
      };
      img.src = url;
    });
  }

  /* ── 2) الرفع ────────────────────────────────────────────────
     uploadImage(file, providerId, {kind}) → { url, path, size, width, height } */
  function uploadImage(file, providerId, opts) {
    opts = opts || {};
    var sb = client();
    if (!sb) return Promise.reject(clamp('offline', 'الاتصال بـSupabase مقفول — جرّبي على نت تاني.'));
    if (!providerId) return Promise.reject(clamp('no-provider', 'مفيش نشاط مربوط بالحساب ده لحد دلوقتي.'));

    return compress(file, opts).then(function (res) {
      var kind = (opts.kind || 'misc').replace(/[^a-z0-9_-]/gi, '').slice(0, 20) || 'misc';
      var path = String(providerId).replace(/[^A-Za-z0-9_-]/g, '') + '/' + kind + '/' + randomId() + '.jpg';

      return sb.storage
        .from(BUCKET)
        .upload(path, res.blob, { contentType: 'image/jpeg', upsert: false, cacheControl: '3600' })
        .then(function (out) {
          if (out.error) throw clamp('upload', out.error.message || 'فشل رفع الصورة.');
          var pub = sb.storage.from(BUCKET).getPublicUrl(path);
          if (!pub || !pub.data || !pub.data.publicUrl) throw clamp('url', 'اترفعت بس مرجعش رابط.');
          return {
            url: pub.data.publicUrl,
            path: path,
            size: res.blob.size,
            width: res.width,
            height: res.height
          };
        });
    });
  }

  /* رفع أكتر من صورة ورا بعض (الألبوم) — بالتوازي المحدود عشان الواجهة تفضل خفيفة */
  function uploadMany(files, providerId, opts, onEach) {
    var list = Array.prototype.slice.call(files || []);
    var limit = (opts && opts.parallel) || 3;
    var done = [];
    var errors = [];
    var i = 0;

    function next() {
      if (i >= list.length) return Promise.resolve();
      var file = list[i++];
      return uploadImage(file, providerId, opts)
        .then(function (r) {
          done.push(r);
          if (onEach) { try { onEach(r, done.length, list.length); } catch (e) {} }
        })
        .catch(function (err) { errors.push({ file: file && file.name, message: err && err.message }); })
        .then(next);
    }

    var runners = [];
    for (var k = 0; k < Math.min(limit, list.length); k++) runners.push(next());

    return Promise.all(runners).then(function () {
      return { uploaded: done, errors: errors };
    });
  }

  /* ── 3) الحذف ────────────────────────────────────────────────
     بياخد الرابط العام ويطلع منه المسار، وبيسكت لو فشل (الصورة ممكن تبقى اتحذفت). */
  function pathFromUrl(url) {
    if (!url || typeof url !== 'string') return null;
    var marker = '/' + BUCKET + '/';
    var at = url.indexOf(marker);
    if (at === -1) return null;
    return decodeURIComponent(url.slice(at + marker.length));
  }

  function removeImage(url) {
    var sb = client();
    var path = pathFromUrl(url);
    if (!sb || !path) return Promise.resolve({ skipped: true });
    return sb.storage.from(BUCKET).remove([path]).then(function (out) {
      return { removed: !!(out && out.data && out.data.length), error: out && out.error };
    }).catch(function (err) {
      return { removed: false, error: err };
    });
  }

  /* الصور القديمة كانت base64 جوه العمود — بنميّزها عشان متتحاولش تتحذف من Storage */
  function isDataUrl(url) {
    return typeof url === 'string' && url.slice(0, 5) === 'data:';
  }

  function isHosted(url) {
    return !!pathFromUrl(url);
  }

  window.DoddzMedia = {
    BUCKET: BUCKET,
    compress: compress,
    uploadImage: uploadImage,
    uploadMany: uploadMany,
    removeImage: removeImage,
    pathFromUrl: pathFromUrl,
    isDataUrl: isDataUrl,
    isHosted: isHosted
  };
})();
