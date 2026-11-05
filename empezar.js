/* ==========================================================
   Astro — Empezar proyecto
   ========================================================== */

// ---- Valores a configurar ---------------------------------
// Google Apps Script (Web App) que recibe las solicitudes.
const FORM_ENDPOINT = "https://script.google.com/macros/s/AKfycbxiwxXhjbk3mkbO5zg40grdVQDZmScwuq7wVWdiM44k9NI5eMYwydRa04heByg17h0/exec";
const REQUEST_TIMEOUT_MS = 15000; // más de 15 s sin respuesta cuenta como fallo
const CALENDAR_URL = "https://calendar.app.google/isoHAyYLjibSVk5j6";
const WHATSAPP_NUMBER = "526691520390"; // 52 + 10 dígitos, sin espacios
const MIN_SECONDS = 5; // tiempo mínimo en la página antes de poder enviar
// -----------------------------------------------------------

(function () {
  'use strict';

  const loadedAt = Date.now();
  let isSubmitting = false;
  let sent = false;

  // ================================================================
  // NAV (mismo comportamiento que index.html)
  // ================================================================
  const nav = document.getElementById('nav');
  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 24);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const navToggle = document.getElementById('navToggle');
  const mobileMenu = document.getElementById('mobileMenu');
  navToggle.addEventListener('click', () => {
    const isOpen = navToggle.classList.toggle('is-open');
    mobileMenu.classList.toggle('is-open', isOpen);
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileMenu.classList.contains('is-open')) {
      navToggle.click();
      navToggle.focus();
    }
  });

  // ================================================================
  // FORMULARIO
  // ================================================================
  const form = document.getElementById('startForm');
  const layout = document.getElementById('startLayout');
  const success = document.getElementById('success');
  const submitBtn = document.getElementById('submitBtn');
  const submitLabel = submitBtn.querySelector('.btn-label');
  const submitError = document.getElementById('submitError');
  const submitErrorText = document.getElementById('submitErrorText');
  const errorWhatsapp = document.getElementById('errorWhatsapp');

  const $ = (id) => document.getElementById(id);
  const fields = {
    nombre: $('nombre'),
    whatsapp: $('whatsapp'),
    correo: $('correo'),
    negocio: $('negocio'),
    objetivo: $('objetivo'),
    origen: $('origen'),
    botcheck: $('botcheck'),
  };

  const checkedValues = (name) =>
    Array.from(form.querySelectorAll(`input[name="${name}"]:checked`)).map((i) => i.value);
  const checkedValue = (name) => checkedValues(name)[0] || '';

  // Teléfono mexicano: 10 dígitos, opcionalmente con +52 / 52 al inicio
  const normalizePhone = (raw) => {
    let d = String(raw).replace(/[^\d]/g, '');
    if (d.length === 12 && d.startsWith('52')) d = d.slice(2);
    if (d.length === 13 && d.startsWith('521')) d = d.slice(3);
    return d;
  };
  const isValidPhone = (raw) => /^[2-9]\d{9}$/.test(normalizePhone(raw));
  const formatPhone = (d) => (d.length === 10 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : d);
  const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

  const getData = () => ({
    nombre: fields.nombre.value.trim(),
    whatsapp: normalizePhone(fields.whatsapp.value),
    correo: fields.correo.value.trim(),
    negocio: fields.negocio.value.trim(),
    servicios: checkedValues('servicios'),
    punto: checkedValue('punto'),
    presupuesto: checkedValue('presupuesto'),
    tiempo: checkedValue('tiempo'),
    objetivo: fields.objetivo.value.trim(),
    origen: fields.origen.value.trim(),
  });

  // ---- Reglas de validación ----------------------------------------
  // Cada regla devuelve el mensaje de error o '' si está bien.
  const rules = {
    nombre: () => {
      const v = fields.nombre.value.trim();
      if (!v) return 'Escribe tu nombre.';
      if (v.length < 2) return 'Tu nombre parece muy corto.';
      return '';
    },
    whatsapp: () => {
      const v = fields.whatsapp.value.trim();
      if (!v) return 'Necesito tu WhatsApp para responderte.';
      if (!isValidPhone(v)) return 'Escribe un número de 10 dígitos, por ejemplo 669 123 4567.';
      return '';
    },
    correo: () => {
      const v = fields.correo.value.trim();
      if (v && !isValidEmail(v)) return 'Revisa el correo, parece que le falta algo.';
      return '';
    },
    servicios: () => (checkedValues('servicios').length ? '' : 'Elige al menos una opción.'),
    punto: () => (checkedValue('punto') ? '' : 'Elige la opción que más se parezca a tu caso.'),
    presupuesto: () => (checkedValue('presupuesto') ? '' : 'Elige un rango, aunque sea aproximado.'),
    tiempo: () => (checkedValue('tiempo') ? '' : 'Dime para cuándo lo quieres.'),
    objetivo: () => {
      const v = fields.objetivo.value.trim();
      if (!v) return 'Cuéntame en pocas palabras qué quieres lograr.';
      if (v.length < 10) return 'Dame un poco más de detalle (mínimo 10 caracteres).';
      return '';
    },
  };

  const groupNames = ['servicios', 'punto', 'presupuesto', 'tiempo'];

  const showError = (name, msg) => {
    const errorEl = $(`${name}-error`);
    if (errorEl) errorEl.textContent = msg;
    if (groupNames.includes(name)) {
      $(`${name}-options`).classList.toggle('is-invalid', !!msg);
    } else if (fields[name]) {
      if (msg) fields[name].setAttribute('aria-invalid', 'true');
      else fields[name].removeAttribute('aria-invalid');
    }
  };

  const validate = (name) => {
    const msg = rules[name]();
    showError(name, msg);
    return !msg;
  };

  const firstFocusable = (name) =>
    groupNames.includes(name) ? form.querySelector(`input[name="${name}"]`) : fields[name];

  // Validar al salir de cada campo de texto
  ['nombre', 'whatsapp', 'correo', 'objetivo'].forEach((name) => {
    fields[name].addEventListener('blur', () => {
      if (fields[name].value.trim() || fields[name].hasAttribute('aria-invalid')) validate(name);
    });
    // Si ya marcaba error, se limpia en cuanto la persona lo corrige
    fields[name].addEventListener('input', () => {
      if (fields[name].hasAttribute('aria-invalid') && !rules[name]()) showError(name, '');
    });
  });

  // Formatear el WhatsApp al salir
  fields.whatsapp.addEventListener('blur', () => {
    const d = normalizePhone(fields.whatsapp.value);
    if (/^[2-9]\d{9}$/.test(d)) fields.whatsapp.value = formatPhone(d);
  });

  // Limpiar error de grupo al elegir
  groupNames.forEach((name) => {
    form.querySelectorAll(`input[name="${name}"]`).forEach((input) => {
      input.addEventListener('change', () => {
        if (!rules[name]()) showError(name, '');
      });
    });
  });

  // ================================================================
  // RESUMEN EN VIVO
  // ================================================================
  const summaryEls = {};
  document.querySelectorAll('[data-summary]').forEach((el) => {
    summaryEls[el.dataset.summary] = el;
  });
  const progressLabel = $('progressLabel');
  const progressBar = $('progressBar');
  const progressFill = $('progressFill');
  const TOTAL = 6;

  const setSummary = (key, value) => {
    const el = summaryEls[key];
    if (!el) return;
    const text = value || 'Sin responder';
    if (el.textContent !== text) el.textContent = text;
    el.classList.toggle('is-empty', !value);
  };

  const updateSummary = () => {
    const d = getData();
    setSummary('servicios', d.servicios.join(', '));
    setSummary('punto', d.punto);
    setSummary('presupuesto', d.presupuesto);
    setSummary('tiempo', d.tiempo);

    const answered = [
      !rules.nombre() && !rules.whatsapp(),
      d.servicios.length > 0,
      !!d.punto,
      !!d.presupuesto,
      !!d.tiempo,
      d.objetivo.length >= 10,
    ].filter(Boolean).length;

    const label = `${answered} de ${TOTAL} respondidas`;
    if (progressLabel.textContent !== label) progressLabel.textContent = label;
    progressBar.setAttribute('aria-valuenow', String(answered));
    progressFill.style.width = `${(answered / TOTAL) * 100}%`;
  };

  form.addEventListener('input', updateSummary);
  form.addEventListener('change', updateSummary);
  updateSummary();

  // ================================================================
  // WHATSAPP
  // ================================================================
  const waLink = (text) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;

  const successMessage = (d) => {
    const quien = d.negocio ? `${d.nombre} de ${d.negocio}` : d.nombre;
    return `Hola, soy ${quien}. Acabo de enviar mi solicitud en byastro.lat y quiero platicar sobre mi proyecto.`;
  };

  const fallbackMessage = (d) => {
    const lines = [`Hola, soy ${d.nombre || '(nombre)'}${d.negocio ? ` de ${d.negocio}` : ''}.`];
    lines.push('Intenté enviar la solicitud en byastro.lat pero no se pudo. Te paso mis datos:');
    if (d.servicios.length) lines.push(`• Necesito: ${d.servicios.join(', ')}`);
    if (d.punto) lines.push(`• Hoy: ${d.punto}`);
    if (d.presupuesto) lines.push(`• Presupuesto: ${d.presupuesto}`);
    if (d.tiempo) lines.push(`• Tiempo: ${d.tiempo}`);
    if (d.objetivo) lines.push(`• Quiero lograr: ${d.objetivo}`);
    return lines.join('\n');
  };

  // ================================================================
  // ENVÍO
  // ================================================================
  // Las opciones se envían con el texto completo que se ve en pantalla
  // (el atributo value de cada input coincide con su etiqueta).
  const buildPayload = (d) => ({
    nombre: d.nombre,
    whatsapp: d.whatsapp,
    correo: d.correo,
    negocio: d.negocio,
    servicios: d.servicios,
    punto_de_partida: d.punto,
    presupuesto: d.presupuesto,
    tiempo: d.tiempo,
    descripcion: d.objetivo,
    origen: d.origen,
    website: fields.botcheck.value,
  });

  // text/plain evita el preflight CORS, que Apps Script no responde.
  // Solo cuenta como éxito una respuesta JSON con { ok: true }.
  const send = async (d) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(buildPayload(d)),
        signal: controller.signal,
      });
      let json = null;
      try { json = await res.json(); } catch (e) { /* respuesta sin JSON */ }
      if (!json || json.ok !== true) {
        throw new Error((json && (json.error || json.message)) || `Respuesta inválida (HTTP ${res.status})`);
      }
    } finally {
      clearTimeout(timer);
    }
  };

  const setSubmitting = (on) => {
    isSubmitting = on;
    submitBtn.disabled = on;
    submitBtn.setAttribute('aria-busy', String(on));
    submitLabel.textContent = on ? 'Enviando…' : 'Enviar solicitud';
  };

  const showSuccess = (d) => {
    sent = true;
    $('calendarBtn').href = CALENDAR_URL;
    $('successWhatsapp').href = waLink(successMessage(d));
    layout.hidden = true;
    success.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    success.focus({ preventScroll: true });
  };

  const showSubmitError = (d, text) => {
    submitErrorText.textContent = text;
    errorWhatsapp.href = waLink(fallbackMessage(d));
    submitError.hidden = false;
    submitError.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isSubmitting || sent) return;

    submitError.hidden = true;

    // Validar todo y llevar el foco al primer error
    const order = ['nombre', 'whatsapp', 'correo', 'servicios', 'punto', 'presupuesto', 'tiempo', 'objetivo'];
    const invalid = order.filter((name) => !validate(name));
    if (invalid.length) {
      const target = firstFocusable(invalid[0]);
      if (target) {
        target.focus({ preventScroll: true });
        (target.closest('.field, .form-group, .form-section') || target)
          .scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    const d = getData();

    // Anti-spam: honeypot lleno = bot. Se le muestra éxito sin enviar nada.
    if (fields.botcheck.value) {
      showSuccess(d);
      return;
    }

    // Anti-spam: envío demasiado rápido
    const elapsed = (Date.now() - loadedAt) / 1000;
    if (elapsed < MIN_SECONDS) {
      showSubmitError(d, 'Vas muy rápido. Espera unos segundos y vuelve a presionar "Enviar solicitud".');
      return;
    }

    setSubmitting(true);
    try {
      await send(d);
      showSuccess(d);
    } catch (err) {
      showSubmitError(d, 'Revisa tu conexión e inténtalo de nuevo, o escríbeme directo por WhatsApp. Lo que llenaste sigue aquí.');
      setSubmitting(false);
    }
  });
})();
