/* ================================================================
   DODDZ ICONS — مخزن الأيقونات (js/icons.js)
   ------------------------------------------------------------
   بديل كل الإيموجي في الموقع: أيقونات SVG خطية (24×24، stroke
   بالcurrentColor، stroke-width 1.7) بنفس الستايل بتاع بلاطات الأقسام.

   الاستخدام:
     1) من الـJS:  DoddzIcon.svg('cart')          → نص HTML جاهز
                   DoddzIcon.svg('cart', {size:20, cls:'ic-b', label:'السلة'})
     2) من الـHTML: <i data-icon="cart" data-icon-size="20"></i>
                   بيتستبدل تلقائيًا على DOMContentLoaded (DoddzIcon.hydrate)
     3) إضافة أيقونة جديدة: سطر واحد في OBJECT تحت.

   الأيقونات الزخرفية بتتاخد aria-hidden، واللي لوحدها بتحمل معنى
   بتاخد role="img" + aria-label من opts.label.
================================================================ */
(function () {
  'use strict';

  // كل مسار جوه OBJECT هو محتوى الـ SVG (24×24) — من غير وسم <svg> نفسه
  var PATHS = {
    cart:        '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3.5h2.6l2.2 11.2h11.4L21 7.4H6.2"/>',
    bag:         '<path d="M6 8h12l1 12H5z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    heart:       '<path d="M20.8 6.6a5 5 0 0 0-7.1 0L12 8.3l-1.7-1.7a5 5 0 1 0-7.1 7.1L12 21.5l8.8-7.8a5 5 0 0 0 0-7.1z"/>',
    star:        '<path d="M12 3.6l2.7 5.5 6 .9-4.3 4.3 1 6-5.4-2.8-5.4 2.8 1-6L3.3 10l6-.9z"/>',
    search:      '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    user:        '<circle cx="12" cy="8" r="3.6"/><path d="M4.8 20c1.1-3.6 3.9-5.4 7.2-5.4S18.1 16.4 19.2 20"/>',
    users:       '<circle cx="9" cy="8" r="3.2"/><path d="M3 19c.9-3.1 3.2-4.8 6-4.8s5.1 1.7 6 4.8"/><path d="M16 5.5a3.1 3.1 0 0 1 0 5.6"/><path d="M18.4 14.6c1.6.8 2.6 2.3 3.1 4.4"/>',
    store:       '<path d="M4 9.5V20h16V9.5"/><path d="M3 9.5L5 4h14l2 5.5a3 3 0 0 1-5.5 1.6 3 3 0 0 1-5 0 3 3 0 0 1-5 0A3 3 0 0 1 3 9.5z"/><path d="M10 20v-5h4v5"/>',
    scissors:    '<circle cx="6.5" cy="17.5" r="2.6"/><circle cx="6.5" cy="6.5" r="2.6"/><path d="M8.7 8.3L20 18.5"/><path d="M20 5.5L8.7 15.7"/>',
    carwash:     '<path d="M4.5 15.5h15"/><path d="M6 15.5V12l2-4h8l2 4v3.5"/><circle cx="8" cy="18" r="1.6"/><circle cx="16" cy="18" r="1.6"/><path d="M12 2.5c1.6 1.7 1.6 3.3 0 5-1.6-1.7-1.6-3.3 0-5z"/>',
    needle:      '<path d="M3 21l7.5-7.5"/><path d="M14.5 3l6.5 6.5-8 8-6.5-6.5z"/><circle cx="17.5" cy="6.5" r="1.2"/>',
    craft:       '<path d="M14.5 6.5a3 3 0 1 1 4 4L8 21l-4.5.5L4 17z"/><path d="M12.5 8.5l3 3"/><path d="M16 4l4 4"/>',
    home:        '<path d="M3.5 10.5L12 3.5l8.5 7"/><path d="M5.5 12v8.5h13V12"/><path d="M10 20.5V15h4v5.5"/>',
    kitchen:     '<path d="M5 3.5v7a3.5 3.5 0 0 0 7 0v-7z"/><path d="M8.5 14v6.5"/><path d="M17.5 3.5c1.8 1.3 2.5 3.2 2.5 5.5s-1 3-2.5 3-2.5-.7-2.5-3 .7-4.2 2.5-5.5z"/><path d="M17.5 15v5.5"/>',
    tools:       '<path d="M14.7 6.3a4 4 0 0 0 5.2 5.2L16 15.4l-4-4 2.7-5.1z"/><path d="M3 21l6.2-6.2"/><path d="M9.5 5.5a3 3 0 1 1 4 4L6 17a2 2 0 0 1-2-2z"/>',
    sparkle:     '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M18.5 16.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z"/>',
    bolt:        '<path d="M13.5 2.5L5 13.5h6l-1.5 8L19 10.5h-6z"/>',
    flame:       '<path d="M12 21c3.6 0 6-2.4 6-5.8 0-4.2-3.6-6-4.5-9.2-2.4 1.4-3.6 3.4-3.6 5.4 0 1.2-.6 1.8-1.5 1.8S7 12 7 10.6C5.4 12.4 6 15.2 6 15.2 6 18.6 8.4 21 12 21z"/>',
    tag:         '<path d="M11 3.5H20.5V13L11 21.5 2.5 13 11 3.5z"/><circle cx="16.4" cy="7.6" r="1.4"/>',
    gift:        '<rect x="3.5" y="8.5" width="17" height="4.5" rx="1"/><path d="M5.5 13v7.5h13V13"/><path d="M12 8.5V20.5"/><path d="M12 8.5S9.5 2.5 7 4.5s2.5 4 5 4z"/><path d="M12 8.5s2.5-6 5-4-2.5 4-5 4z"/>',
    truck:       '<path d="M2.5 6.5h11V16h-11z"/><path d="M13.5 9.5H18l3 3.5V16h-7.5"/><circle cx="6.5" cy="18.5" r="1.7"/><circle cx="17" cy="18.5" r="1.7"/>',
    shield:      '<path d="M12 2.8l7 2.8v5.6c0 4.3-2.9 7.8-7 9.4-4.1-1.6-7-5.1-7-9.4V5.6z"/><path d="M8.8 11.8L11 14l4.2-4.4"/>',
    phone:       '<path d="M7.5 3.5l2.2 3.6-1.9 2.2a12.5 12.5 0 0 0 5.3 5.3l2.2-1.9 3.6 2.2-1.2 3A2.5 2.5 0 0 1 14.8 20C8.6 18.4 4.6 14.4 3.5 8.2A2.5 2.5 0 0 1 4.5 4.7z"/>',
    whatsapp:    '<path d="M12 3.2a8.8 8.8 0 0 0-7.5 13.4L3.3 20.8l4.4-1.1A8.8 8.8 0 1 0 12 3.2z"/><path d="M8.8 8.4c-.4 2.6 3.2 6.6 6.2 6.4.8 0 1.6-.6 1.8-1.3l-2.2-1-1 .9c-1.4-.6-2.7-1.9-3.3-3.3l.9-1-1-2.2c-.7.2-1.3 1-1.4 1.5z"/>',
    chat:        '<path d="M4 5.5h16v10.5H9.5L5.5 19.5V16H4z"/><path d="M8.5 9.5h7"/><path d="M8.5 12.5h4.5"/>',
    mail:        '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M4 6.5l8 6 8-6"/>',
    location:    '<path d="M12 21c4-5 6.2-8 6.2-11A6.2 6.2 0 0 0 5.8 10c0 3 2.2 6 6.2 11z"/><circle cx="12" cy="9.8" r="2.4"/>',
    clock:       '<circle cx="12" cy="12" r="8.6"/><path d="M12 7v5.2l3.4 2"/>',
    calendar:    '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17"/><path d="M8 3.5v3.5"/><path d="M16 3.5v3.5"/>',
    check:       '<path d="M20 6.5L9.6 17.5 4 12"/>',
    close:       '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>',
    plus:        '<path d="M12 5v14"/><path d="M5 12h14"/>',
    minus:       '<path d="M5 12h14"/>',
    trash:       '<path d="M4 7h16"/><path d="M9 7V4.5h6V7"/><path d="M6 7l1 13.5h10L18 7"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    warning:     '<path d="M12 3.5L21 19.5H3z"/><path d="M12 9v5"/><path d="M12 16.6v.1"/>',
    info:        '<circle cx="12" cy="12" r="8.6"/><path d="M12 11v5.5"/><path d="M12 7.7v.1"/>',
    arrowLeft:   '<path d="M19 12H5"/><path d="M11 18l-6-6 6-6"/>',
    arrowRight:  '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
    chevronDown: '<path d="M6 9.5l6 6 6-6"/>',
    chevronUp:   '<path d="M6 14.5l6-6 6 6"/>',
    chevronLeft: '<path d="M14.5 6l-6 6 6 6"/>',
    chevronRight:'<path d="M9.5 6l6 6-6 6"/>',
    external:    '<path d="M14 4.5h5.5V10"/><path d="M19 5L11.5 12.5"/><path d="M18 14v5.5H4.5V6H10"/>',
    image:       '<rect x="3.5" y="5" width="17" height="14" rx="2.2"/><circle cx="9" cy="10.2" r="1.8"/><path d="M4.5 17.5l5-4.5 4 3.5 3-2.5 3.5 3"/>',
    box:         '<path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5L12 12l8.5-4.5"/><path d="M12 12v9"/>',
    package:     '<path d="M4 8.5l8-4 8 4v7l-8 4-8-4z"/><path d="M4 8.5l8 4 8-4"/><path d="M12 12.5v7"/>',
    filter:      '<path d="M3.5 6h17"/><path d="M6.5 12h11"/><path d="M10 18h4"/>',
    sort:        '<path d="M7 4.5v15"/><path d="M3.5 16L7 19.5 10.5 16"/><path d="M17 19.5v-15"/><path d="M13.5 8L17 4.5 20.5 8"/>',
    edit:        '<path d="M4 20h4L20 8l-4-4L4 16z"/><path d="M15 5l4 4"/>',
    upload:      '<path d="M12 16V4.5"/><path d="M7 9.5L12 4.5l5 5"/><path d="M4 15v4.5h16V15"/>',
    download:    '<path d="M12 4.5V16"/><path d="M7 11l5 5 5-5"/><path d="M4 19.5h16"/>',
    play:        '<path d="M7.5 4.8v14.4L19 12z"/>',
    eye:         '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    lock:        '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/><path d="M12 14v2.5"/>',
    logout:      '<path d="M14 4.5H5.5V19.5H14"/><path d="M18 8.5l3.5 3.5-3.5 3.5"/><path d="M21 12H10"/>',
    settings:    '<circle cx="12" cy="12" r="3"/><path d="M12 2.8l1.3 2.5 2.7-.5 1 2.6 2.5 1.3-1.2 2.5 1.2 2.5-2.5 1.3-1 2.6-2.7-.5L12 21.2l-1.3-2.5-2.7.5-1-2.6-2.5-1.3 1.2-2.5-1.2-2.5 2.5-1.3 1-2.6 2.7.5z"/>',
    menu:        '<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>',
    grid:        '<rect x="4" y="4" width="7" height="7" rx="1.4"/><rect x="13" y="4" width="7" height="7" rx="1.4"/><rect x="4" y="13" width="7" height="7" rx="1.4"/><rect x="13" y="13" width="7" height="7" rx="1.4"/>',
    mobile:      '<rect x="7" y="2.8" width="10" height="18.4" rx="2.4"/><path d="M10.5 18.4h3"/>',
    laptop:      '<rect x="4.5" y="5" width="15" height="10" rx="1.6"/><path d="M2.5 18.5h19"/>',
    watch:       '<circle cx="12" cy="12" r="5.4"/><path d="M9.5 6.6L10 3h4l.5 3.6"/><path d="M9.5 17.4L10 21h4l.5-3.6"/><path d="M12 9.5V12l1.8 1.2"/>',
    shirt:       '<path d="M8.5 3.5L12 5.5l3.5-2 4.5 2.8-2 4-1.5-1v9H7v-9L5.5 10.3l-2-4z"/>',
    shoe:        '<path d="M3 16.5h18v2.5H3z"/><path d="M3 16.5V9l5 1 3.5-3.5 2.5 3c2 1 5.5 2 8 4.5v2.5"/>',
    beauty:      '<path d="M8.5 9.5h7l1 11h-9z"/><path d="M10 9.5V5a2 2 0 0 1 4 0v4.5"/><path d="M9.5 14h5"/>',
    payment:     '<rect x="2.8" y="6" width="18.4" height="12.5" rx="2.2"/><path d="M2.8 10.5h18.4"/><path d="M6.5 15h3"/>',
    receipt:     '<path d="M5.5 3.5h13v17l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-1 .5z"/><path d="M8.5 8h7"/><path d="M8.5 12h7"/>',
    share:       '<circle cx="6" cy="12.5" r="2.4"/><circle cx="17.5" cy="6.5" r="2.4"/><circle cx="17.5" cy="18.5" r="2.4"/><path d="M8.4 11.5l6.7-3.8"/><path d="M8.4 13.5l6.7 3.8"/>',
    bell:        '<path d="M18 8.5a6 6 0 1 0-12 0c0 5.5-2.5 7-2.5 7h17s-2.5-1.5-2.5-7z"/><path d="M10 19.5a2.2 2.2 0 0 0 4 0"/>',
    percent:     '<path d="M5.5 5.5l13 13"/><circle cx="7.5" cy="7.5" r="2.2"/><circle cx="16.5" cy="16.5" r="2.2"/>',
    ruler:       '<rect x="3" y="8.5" width="18" height="7" rx="1.4" transform="rotate(-45 12 12)"/><path d="M9.5 8.8l1.6 1.6"/><path d="M7.2 11.1l1.6 1.6"/><path d="M12 6.4l1.6 1.6"/>',

    // ── دفعة تانية: أيقونات لازم مكان الإيموجي اللي كان في الموقع ──
    save:        '<path d="M5 3.8h11L20.2 8v12.2H5z"/><path d="M8.5 3.8v5h7v-5"/><rect x="8" y="13" width="8" height="7.2" rx="1"/>',
    map:         '<path d="M9 4.5L3.5 6.8v12.7L9 17.2l6 2.3 5.5-2.3V4.5L15 6.8z"/><path d="M9 4.5v12.7"/><path d="M15 6.8v12.7"/>',
    success:     '<circle cx="12" cy="12" r="8.6"/><path d="M8.2 12.3l2.6 2.6 5-5.4"/>',
    error:       '<circle cx="12" cy="12" r="8.6"/><path d="M9.2 9.2l5.6 5.6"/><path d="M14.8 9.2l-5.6 5.6"/>',
    pause:       '<rect x="7" y="5" width="3.4" height="14" rx="1.2"/><rect x="13.6" y="5" width="3.4" height="14" rx="1.2"/>',
    rocket:      '<path d="M12 3c3.4 2.6 5.2 6.2 5.2 10.4L14 16.8h-4L6.8 13.4C6.8 9.2 8.6 5.6 12 3z"/><circle cx="12" cy="10" r="1.8"/><path d="M10 18.6c-1 .8-1.6 1.8-1.8 2.9 1.4-.2 2.4-.8 3.2-1.7"/><path d="M14 18.6c1 .8 1.6 1.8 1.8 2.9-1.4-.2-2.4-.8-3.2-1.7"/>',
    shower:      '<path d="M4 14.5V8a4 4 0 0 1 8 0v1.5"/><path d="M12 9.5h8"/><path d="M6.5 18v.01"/><path d="M10 19.5v.01"/><path d="M13.5 18v.01"/><path d="M17 19.5v.01"/><path d="M8.5 21v.01"/><path d="M15.5 21v.01"/>',
    thread:      '<path d="M8 4.5h8l-1 15H9z"/><path d="M9.5 8.5h5"/><path d="M9.5 12h5"/><path d="M9.5 15.5h5"/>',
    palette:     '<path d="M12 3.6c4.8 0 8.4 3.4 8.4 7.6 0 2.6-1.8 4-4 4h-1.6c-1.2 0-2 .9-2 2 0 .6.3 1.1.7 1.6.8 1-.6 2.5-1.9 2.5-4.7 0-8.4-3.7-8.4-8.4S7.2 3.6 12 3.6z"/><circle cx="9" cy="9" r="1.2"/><circle cx="13.5" cy="7.5" r="1.2"/><circle cx="16.5" cy="11" r="1.2"/>',
    basket:      '<path d="M3.5 9.5h17L18 20H6z"/><path d="M8.5 9.5L11 3.8"/><path d="M15.5 9.5L13 3.8"/><path d="M9 13v4"/><path d="M15 13v4"/>',
    sofa:        '<path d="M4 11V8.5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2V11"/><path d="M2.5 11.5a1.8 1.8 0 0 1 3.6 0V16h11.8v-4.5a1.8 1.8 0 0 1 3.6 0V19H2.5z"/><path d="M6 19v1.8"/><path d="M18 19v1.8"/>',
    cookware:    '<path d="M4 10.5h12v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"/><path d="M16 12h3.5a2.5 2.5 0 0 1 0 5H16"/><path d="M7.5 7.5c0-1.5 1-2 1-3"/><path d="M11.5 7.5c0-1.5 1-2 1-3"/>',
    bath:        '<path d="M3 12.5h18v3a4.5 4.5 0 0 1-4.5 4.5h-9A4.5 4.5 0 0 1 3 15.5z"/><path d="M6 12.5V6.2A2.7 2.7 0 0 1 8.7 3.5c1.4 0 2.3.9 2.5 2"/><path d="M8 8.5l4-4"/>',
    dog:         '<path d="M4.5 6.5l2.5-2 2 2.5h6l2-2.5 2.5 2v6.5c0 3.6-3 6.5-6.5 6.5h-2C7.5 19.5 4.5 16.6 4.5 13z"/><circle cx="9.5" cy="11.5" r="1"/><circle cx="14.5" cy="11.5" r="1"/><path d="M11 15h2"/>',
    cat:         '<path d="M5 8.5L4 4l4 2.5h8L20 4l-1 4.5v4.5c0 3.9-3.1 6.5-7 6.5s-7-2.6-7-6.5z"/><circle cx="9.5" cy="11" r="1"/><circle cx="14.5" cy="11" r="1"/><path d="M11 14.5h2"/>',
    bird:        '<path d="M8.5 5.5a4 4 0 0 1 7 2.6c0 1.2-.6 2-1.4 2.6l4.4 3.8-5.5.5c-.8 2.6-3 4.4-5.6 4.4-1.4 0-2.6-.4-3.6-1.2l3.4-2.8-2.6-2.4z"/><circle cx="13" cy="8" r=".9"/>',
    paw:         '<ellipse cx="7.5" cy="9" rx="2" ry="2.6"/><ellipse cx="12" cy="7" rx="2" ry="2.6"/><ellipse cx="16.5" cy="9" rx="2" ry="2.6"/><path d="M12 12.5c2.8 0 5 2.2 5 4.4 0 1.8-1.5 2.8-3.2 2.6-1.3-.2-2.3-.2-3.6 0-1.7.2-3.2-.8-3.2-2.6 0-2.2 2.2-4.4 5-4.4z"/>',
    ball:        '<circle cx="12" cy="12" r="8.6"/><path d="M12 3.4c-2.5 2.4-3.8 5.3-3.8 8.6s1.3 6.2 3.8 8.6"/><path d="M15.8 3.4c2.5 2.4 3.8 5.3 3.8 8.6s-1.3 6.2-3.8 8.6"/><path d="M3.6 10.4h16.8"/><path d="M3.6 13.6h16.8"/>',
    candle:      '<path d="M9 10.5h6V21H9z"/><path d="M12 10.5V8"/><path d="M12 8c-1.8-1.4-1.8-3.4 0-5 1.8 1.6 1.8 3.6 0 5z"/>',
    frame:       '<rect x="4" y="4" width="16" height="16" rx="1.6"/><path d="M7 16l3.5-4.5 2.5 3 2-2.5L17 16z"/><circle cx="9.5" cy="8.5" r="1.2"/>',
    wrench:      '<path d="M15.5 3.5a5.5 5.5 0 0 0-5 8.2L3.8 18.4a2.2 2.2 0 0 0 3.1 3.1l6.7-6.7a5.5 5.5 0 0 0 6.9-7.2l-3 3-2.8-1-1-2.8z"/>',
    dress:       '<path d="M8.5 3.5L12 6l3.5-2.5 1 4.5-2 1.5V21H8V9.5L6 8z"/><path d="M8 12h8"/>',
    sneaker:     '<path d="M3 16.5h18v2.5H3z"/><path d="M3 16.5V9l5 1 3.5-3.5 2.5 3c2 1 5.5 2 8 4.5v2.5"/><path d="M8 13.5l2 1.5"/>',
    tie:         '<path d="M10 3.5h4l1 3-2 1.5 2.5 11a2 2 0 0 1-4 0L9.5 8 11 6.5z"/><path d="M10 3.5l2 3 2-3"/>',
    hat:         '<path d="M5.5 12.5A6.5 6.5 0 0 1 12 6a6.5 6.5 0 0 1 6.5 6.5"/><path d="M3 12.5c0 2 1 3 2.5 3h13c1.5 0 2.5-1 2.5-3"/><path d="M9 15.5c1 2 4 2 6 0"/>',
    headphones:  '<path d="M4.5 15v-3a7.5 7.5 0 0 1 15 0v3"/><rect x="2.8" y="13.5" width="4.4" height="7" rx="2"/><rect x="16.8" y="13.5" width="4.4" height="7" rx="2"/>',
    keyboard:    '<rect x="2.5" y="6.5" width="19" height="11" rx="2"/><path d="M6 10h.01"/><path d="M9.5 10h.01"/><path d="M13 10h.01"/><path d="M16.5 10h.01"/><path d="M7.5 14h9"/>',
    camera:      '<path d="M3 8.5h3.5L8 6h8l1.5 2.5H21V19H3z"/><circle cx="12" cy="13" r="3.6"/>',
    bike:        '<circle cx="6" cy="16.5" r="4"/><circle cx="18" cy="16.5" r="4"/><path d="M10 16.5l3-6.5 3.5 1.5"/><path d="M9 10h4"/><path d="M14.5 10l1.5 6.5"/>',
    gamepad:     '<path d="M8 8.5h8c3 0 5 2.6 5 5.5 0 2.2-1.4 3.6-3.2 3.6-1.4 0-2.1-1-3.3-1.6H11.5c-1.2.6-1.9 1.6-3.3 1.6C6.4 17.6 5 16.2 5 14c0-2.9 2-5.5 3-5.5z"/><path d="M9 12v2.5"/><path d="M7.8 13.2h2.4"/><circle cx="15.5" cy="12.6" r=".9"/><circle cx="17.5" cy="14.6" r=".9"/>',
    imagePlaceholder: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M6.5 16.5l3.5-4.5 2.5 3 2-2.5 3 4z"/><circle cx="9" cy="9" r="1.3"/>',
    noImage:     '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M4 19l6-6.5"/><path d="M14.5 11l5 5"/><path d="M6.5 5v3"/><circle cx="15" cy="9" r="1.3"/>'
  };

  // إيموجي قديم → اسم الأيقونة البديلة (بيستخدمها DoddzIcon.glyph / replaceGlyphs)
  var EMOJI_TO_ICON = {
    '📦': 'box', '🛒': 'cart', '🧾': 'receipt', '💾': 'save', '🗑️': 'trash', '🗑': 'trash',
    '✏️': 'edit', '✏': 'edit', '➕': 'plus', '✅': 'success', '❌': 'error', '✓': 'check',
    '✔': 'check', '✕': 'close', '✖': 'close', '★': 'star', '☆': 'starOutline', '⭐': 'star',
    '📍': 'location', '🗺️': 'map', '🗺': 'map', '🕘': 'clock', '📞': 'phone', '💬': 'chat',
    '🏠': 'home', '🏪': 'store', '🚚': 'truck', '⏸': 'pause', '⚠️': 'warning', '⚠': 'warning',
    '❤️': 'heartFilled', '❤': 'heartFilled', '♡': 'heart', '🎨': 'palette', '📏': 'ruler',
    '🚀': 'rocket', '🔍': 'search', '🛠️': 'tools', '🛠': 'tools', '🔧': 'wrench',
    '🚿': 'shower', '🧵': 'thread', '🛍️': 'bag', '🛍': 'bag',
    '🍳': 'cookware', '🛁': 'bath', '🖼️': 'frame', '🖼': 'frame', '🧺': 'basket',
    '🛋️': 'sofa', '🛋': 'sofa', '🕯️': 'candle', '🕯': 'candle', '👗': 'dress',
    '👟': 'sneaker', '👔': 'tie', '👒': 'hat', '🎧': 'headphones', '💻': 'laptop',
    '⌨️': 'keyboard', '⌨': 'keyboard', '📱': 'mobile', '📷': 'camera', '🚲': 'bike',
    '🎮': 'gamepad', '🐕': 'dog', '🐱': 'cat', '🦜': 'bird', '🐾': 'paw', '🎾': 'ball',
    '▲': 'chevronUp', '▴': 'chevronUp', '▼': 'chevronDown', '▾': 'chevronDown',
    '→': 'arrowRight'
  };

  // أسماء أيقونات بتترسم وهي مملوءة (النجوم والمفضلة)
  var FILLED = { star: true, heartFilled: true };

  // اسمين زيادة لنفس الرسمة: نجمة فاضية وقلب مملوء
  PATHS.starOutline = PATHS.star;
  PATHS.heartFilled = PATHS.heart;
  FILLED.starOutline = false;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /** نص SVG جاهز للحقن — name من OBJECT فوق، وopts = {size, cls, label, width, fill, em}
      em:true → SVG بلا عرض ثابت، حجمه = حجم الخط مكانه (CSS: .ic-em) */
  function svg(name, opts) {
    opts = opts || {};
    var body = PATHS[name];
    if (!body) return '';
    var filled = (opts.fill == null) ? !!FILLED[name] : !!opts.fill;
    var cls = 'ic ic-' + name + (opts.cls ? ' ' + opts.cls : '') + (opts.em ? ' ic-em' : '');
    var dim = opts.em ? '' : ' width="' + (opts.size || 20) + '" height="' + (opts.size || 20) + '"';
    var a11y = opts.label
      ? 'role="img" aria-label="' + esc(opts.label) + '"'
      : 'aria-hidden="true" focusable="false"';
    return '<svg class="' + esc(cls) + '"' + dim + ' viewBox="0 0 24 24" ' +
           'fill="' + (filled ? 'currentColor' : 'none') + '" ' +
           'stroke="currentColor" stroke-width="' + (opts.width || (filled ? 1.1 : 1.7)) + '" stroke-linecap="round" ' +
           'stroke-linejoin="round" ' + a11y + '>' + body + '</svg>';
  }

  /** قيمة لوحدها = إيموجي قديم أو اسم أيقونة → أيقونة SVG.
      («📱» → موبايل، «icon:sofa» → كنبة). لو مش معروف: النص بيرجع زي ما هو. */
  function glyph(value, opts) {
    if (value == null || value === '') return '';
    var raw = String(value).trim();
    var name = EMOJI_TO_ICON[raw] || EMOJI_TO_ICON[raw.replace(/\uFE0F/g, '')] ||
               (raw.indexOf('icon:') === 0 ? raw.slice(5) : raw);
    if (PATHS[name]) return svg(name, opts);
    return esc(raw);
  }

  // قايمة الإيموجي مرتّبة الأطول أول (عشان «🗑️» تاخد مكانها قبل «🗑»)
  var EMOJI_KEYS = Object.keys(EMOJI_TO_ICON).sort(function (a, b) { return b.length - a.length; });

  /** جملة فيها إيموجي في نصها (زي «🏠 منزلي») → نفس الكلام والأيقونة مكان الإيموجي.
      طلعتها HTML — تُستعمل مع innerHTML مش textContent. */
  function replaceGlyphs(text, opts) {
    if (text == null) return '';
    var size = (opts && opts.size) || 18;
    var out = String(text);
    var found = false;
    for (var i = 0; i < EMOJI_KEYS.length; i++) {
      var emo = EMOJI_KEYS[i];
      if (out.indexOf(emo) === -1) continue;
      found = true;
      out = out.split(emo).join(svg(EMOJI_TO_ICON[emo], { size: size, cls: 'ic-inline' }));
    }
    return found ? out : esc(out);
  }

  /** اسم أيقونة متوفّر؟ */
  function has(name) { return !!PATHS[name]; }

  /** يستبدل أي <i data-icon="…"> بمحتواه — على الصفحة كلها أو جوه root */
  function hydrate(root) {
    var scope = root || document;
    var list = scope.querySelectorAll('[data-icon]');
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      var name = el.getAttribute('data-icon');
      var opts = {
        size: Number(el.getAttribute('data-icon-size')) || 20,
        cls: el.getAttribute('data-icon-class') || el.className.replace('data-icon', '').trim(),
        label: el.getAttribute('aria-label') || ''
      };
      var wrap = document.createElement('span');
      wrap.innerHTML = svg(name, opts);
      var node = wrap.firstElementChild;
      if (node) {
        if (el.id) node.id = el.id;
        el.replaceWith(node);
      }
    }
  }

  // ── polish: أي إيموجي فاضل في نص مرسوم (من قايمة منتجات أو من Supabase) → أيقونة ──
  // بيشمل الكلام اللي بيتحقن بعد التحميل، فمش محتاجين نعدّل كل سطر في كل ملف.
  var GLYPH_RX = new RegExp(
    EMOJI_KEYS.map(function (e) { return e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|'),
    'g'
  );
  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, TITLE: 1, NOSCRIPT: 1, SVG: 1, HEAD: 1 };

  function makeIcon(el) {
    var tpl = document.createElement('span');
    tpl.innerHTML = svg(EMOJI_TO_ICON[el] || el, { em: true, cls: 'ic-inline' });
    return tpl.firstElementChild;
  }

  function polishTextNodes(scope) {
    if (!scope || !scope.ownerDocument) return;
    var doc = scope.ownerDocument || scope;
    var walker = doc.createTreeWalker(scope, 4 /* SHOW_TEXT */, null);
    var hits = [];
    var node;
    while ((node = walker.nextNode())) {
      GLYPH_RX.lastIndex = 0;
      if (!node.nodeValue || !GLYPH_RX.test(node.nodeValue)) continue;
      var p = node.parentNode;
      if (p && !SKIP_TAGS[p.tagName] && !p.classList.contains('ic')) hits.push(node);
    }
    for (var i = 0; i < hits.length; i++) {
      var t = hits[i];
      var parent = t.parentNode;
      if (!parent) continue;
      var frag = doc.createDocumentFragment();
      var last = 0, m;
      GLYPH_RX.lastIndex = 0;
      while ((m = GLYPH_RX.exec(t.nodeValue)) !== null) {
        if (m.index > last) frag.appendChild(doc.createTextNode(t.nodeValue.slice(last, m.index)));
        var icon = makeIcon(m[0]);
        if (icon) frag.appendChild(icon);
        last = m.index + m[0].length;
        if (m[0].length === 0) GLYPH_RX.lastIndex++;
      }
      if (last < t.nodeValue.length) frag.appendChild(doc.createTextNode(t.nodeValue.slice(last)));
      parent.replaceChild(frag, t);
    }
  }

  function polish(root) { polishTextNodes(root || document.body); }

  // أي عقدة جديدة بتنضاف للصفحة (كرت منتج، توست، جدول أدمن) → تتلمس على طول
  // setTimeout مش requestAnimationFrame: التاب المخفي ما بيشغّلش rAF فالرسالة بتتأجل للأبد
  var pending = [], timerId = 0;
  function flush() {
    timerId = 0;
    var list = pending; pending = [];
    for (var i = 0; i < list.length; i++) polishTextNodes(list[i]);
  }
  function queue(node) {
    pending.push(node);
    if (!timerId) timerId = window.setTimeout(flush, 120);
  }
  function watch() {
    if (!window.MutationObserver || !document.body) return;
    new MutationObserver(function (recs) {
      for (var i = 0; i < recs.length; i++) {
        // عنصر جديد (كرت/صف) → نلمسه. عقدة نص لوحدها (el.textContent = …) → نلمس أبوها.
        if (recs[i].target && recs[i].target.nodeType === 3) {
          if (recs[i].target.parentNode) queue(recs[i].target.parentNode);
          continue;
        }
        var add = recs[i].addedNodes;
        for (var j = 0; j < add.length; j++) {
          if (add[j].nodeType === 1) queue(add[j]);
          else if (add[j].nodeType === 3 && recs[i].target && recs[i].target.nodeType === 1) queue(recs[i].target);
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  window.DoddzIcon = {
    svg: svg, has: has, glyph: glyph, replaceGlyphs: replaceGlyphs,
    hydrate: hydrate, polish: polish, names: Object.keys(PATHS)
  };

  function boot() {
    hydrate();
    polish(document.body);
    watch();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
