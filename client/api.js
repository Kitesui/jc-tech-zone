// API client using jQuery AJAX with auth token handling and route guards.

const API = (() => {
  const BASE = '/api';

  function getToken() {
    return localStorage.getItem('jc_token');
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem('jc_user') || 'null');
    } catch {
      return null;
    }
  }

  function setAuth(token, user) {
    localStorage.setItem('jc_token', token);
    localStorage.setItem('jc_user', JSON.stringify(user));
  }

  function clearAuth() {
    localStorage.removeItem('jc_token');
    localStorage.removeItem('jc_user');
  }

  // Self-contained Web Audio notification chime (warm ascending C5 -> G5 harmonic interval).
  // Zero external MP3 dependency, zero latency, smooth envelope without clicks.
  function chime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = chime.ctx || (chime.ctx = new AudioCtx());
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;

      // Note 1: Warm foundation tone (C5 - 523.25 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now);
      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.28);

      // Note 2: Crisp harmonic chime (G5 - 783.99 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(783.99, now + 0.08);
      gain2.gain.setValueAtTime(0.001, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.14, now + 0.10);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.42);
    } catch {}
  }

  function notify(m, staff) {
    if (!m.title || (m.by && m.by === getUser()?.id)) return;
    if (m.tech_id && m.tech_id !== getUser()?.id) return;
    UI.toast(`<strong>${escapeHtml(m.title)}</strong><br>${escapeHtml(m.message)}`, 'info', 6000);
    chime();
    if (staff && document.hidden && window.Notification && Notification.permission === 'granted') {
      new Notification(m.title, { body: m.message, icon: '/logo.jpg' });
    }
  }

  function request(method, endpoint, data) {
    const token = getToken();
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return new Promise((resolve, reject) => {
      $.ajax({
        url: BASE + endpoint,
        method: method.toUpperCase(),
        headers,
        contentType: 'application/json',
        data: data ? JSON.stringify(data) : undefined,
        success: resolve,
        error: (xhr) => {
          if (xhr.status === 401 && !endpoint.startsWith('/auth')) {
            clearAuth();
            if (location.pathname.includes('admin') || location.pathname.includes('tech')) {
              window.location.href = '/login';
              return;
            }
          }
          const err = xhr.responseJSON?.error || xhr.responseJSON?.message || `Request failed (${xhr.status})`;
          reject(new Error(err));
        },
      });
    });
  }

  return {
    login: (username, password) =>
      request('POST', '/auth/login', { username, password }).then((res) => {
        if (res.token && res.user) {
          setAuth(res.token, res.user);
        }
        return res;
      }),
    logout: () => {
      clearAuth();
      window.location.href = '/login';
    },
    clearAuth,
    getMe: () => request('GET', '/auth/me'),
    getUser,
    getToken,
    isAuthenticated: () => !!getToken(),

    createTicket: (d) => request('POST', '/tickets', d),
    getTickets: (params) => request('GET', '/tickets?' + $.param(params || {})),
    getHomeServiceSlots: (date) => request('GET', '/tickets/home-service-slots?date=' + encodeURIComponent(date)),
    trackTicket: (ref) => request('GET', `/tickets/track/${encodeURIComponent(ref)}`),
    getTicket: (id) => request('GET', `/tickets/${id}`),
    updateTicket: (id, d) => request('PUT', `/tickets/${id}`, d),
    addWorkLog: (id, d) => request('POST', `/tickets/${id}/logs`, d),
    deleteTicket: (id) => request('DELETE', `/tickets/${id}`),

    getProducts: (params) => request('GET', '/products?' + $.param(params || {})),
    getCategories: () => request('GET', '/products/categories'),
    getProduct: (id) => request('GET', `/products/${id}`),
    createProduct: (d) => request('POST', '/products', d),
    updateProduct: (id, d) => request('PUT', `/products/${id}`, d),
    deleteProduct: (id) => request('DELETE', `/products/${id}`),

    getTechnicians: () => request('GET', '/technicians'),
    createTechnician: (d) => request('POST', '/technicians', d),
    updateTechnician: (id, d) => request('PUT', `/technicians/${id}`, d),
    deleteTechnician: (id) => request('DELETE', `/technicians/${id}`),

    submitFeedback: (d) => request('POST', '/feedback', d),
    getFeedback: (ticket_id) => request('GET', `/feedback/${ticket_id}`),
    getFeedbackSummary: () => request('GET', '/feedback/summary'),

    health: () => request('GET', '/health'),
    playChime: chime,

    // Live updates: pass ref for a customer's ticket, omit for staff (uses token).
    live: (onChange, ref) => {
      if (!ref && window.Notification && Notification.permission === 'default') {
        $(document).one('click', () => Notification.requestPermission());
      }
      const es = new EventSource(BASE + '/events?' + (ref ? 'ref=' + encodeURIComponent(ref) : 'token=' + encodeURIComponent(getToken())));
      let timer, opened = false;
      const fire = (msg) => { clearTimeout(timer); timer = setTimeout(() => onChange(msg), 300); };
      es.onmessage = (e) => { const m = JSON.parse(e.data); notify(m, !ref); fire(m); };
      es.onopen = () => { if (opened) fire(); opened = true; };
      return es;
    },
  };
})();

// ── Global UI Notification & Confirmation Dialogs ──────────
window.UI = {
  toast: function(message, type = 'success', duration = 3800) {
    if (typeof $ === 'undefined') return;
    let $container = $('#jcToastContainer');
    if (!$container.length) {
      $container = $('<div id="jcToastContainer" class="toast-container-jc"></div>').appendTo('body');
    }
    const icons = {
      success: '<i class="bi bi-check-circle-fill" style="color:var(--success);font-size:1.15rem;"></i>',
      error: '<i class="bi bi-exclamation-triangle-fill" style="color:var(--danger);font-size:1.15rem;"></i>',
      danger: '<i class="bi bi-exclamation-triangle-fill" style="color:var(--danger);font-size:1.15rem;"></i>',
      warning: '<i class="bi bi-exclamation-circle-fill" style="color:var(--warning);font-size:1.15rem;"></i>',
      info: '<i class="bi bi-info-circle-fill" style="color:var(--primary);font-size:1.15rem;"></i>',
    };
    const icon = icons[type] || icons.info;
    const $toast = $(`
      <div class="toast-jc toast-${type}">
        <div class="toast-icon-wrap flex-shrink-0">${icon}</div>
        <div class="toast-body-content flex-grow-1" style="font-size:0.83rem;line-height:1.4;">${message}</div>
        <button type="button" class="btn-close btn-close-white ms-auto flex-shrink-0" style="font-size:0.65rem;" aria-label="Close"></button>
      </div>
    `);
    $container.append($toast);

    function removeToast() {
      $toast.addClass('toast-hide');
      setTimeout(() => $toast.remove(), 260);
    }

    $toast.find('.btn-close').on('click', removeToast);
    if (duration > 0) {
      setTimeout(removeToast, duration);
    }
  },

  confirm: function(options) {
    return new Promise((resolve) => {
      if (typeof $ === 'undefined' || typeof bootstrap === 'undefined') {
        resolve(true);
        return;
      }
      let opts = typeof options === 'string' ? { message: options } : (options || {});
      const title = opts.title || 'Please Confirm';
      const message = opts.message || 'Are you sure you want to proceed?';
      const confirmText = opts.confirmText || 'Confirm';
      const cancelText = opts.cancelText || 'Cancel';
      const isDanger = opts.danger !== false;
      const btnClass = opts.confirmClass || (isDanger ? 'btn-danger-jc' : 'btn-primary-jc');
      const icon = opts.icon || (isDanger ? 'bi-exclamation-triangle-fill' : 'bi-question-circle-fill');
      const iconColor = isDanger ? 'var(--danger)' : 'var(--primary)';

      let $modal = $('#jcConfirmModal');
      if (!$modal.length) {
        $modal = $(`
          <div class="modal fade modal-jc" id="jcConfirmModal" tabindex="-1" aria-hidden="true" style="z-index:1090;">
            <div class="modal-dialog modal-dialog-centered" style="max-width:440px;">
              <div class="modal-content shadow-lg" style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,0.85);">
                <div class="modal-body p-4 text-center">
                  <div id="jcConfirmIcon" class="mb-3 d-inline-flex align-items-center justify-content-center rounded-circle"
                       style="width:62px;height:62px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.28);transition:all .2s ease;">
                    <i class="bi bi-exclamation-triangle-fill" style="font-size:1.75rem;color:var(--danger);"></i>
                  </div>
                  <h5 id="jcConfirmTitle" class="modal-title mb-2 text-white" style="font-family:var(--font-display);font-weight:700;letter-spacing:0.02em;"></h5>
                  <div id="jcConfirmMessage" class="mb-0" style="color:#e2e8f0;font-size:0.9rem;line-height:1.6;"></div>
                </div>
                <div class="modal-footer justify-content-center gap-2 p-3" style="background:var(--bg-card2);border-top:1px solid var(--border);">
                  <button type="button" class="btn-outline-jc" id="jcConfirmCancelBtn" data-bs-dismiss="modal" style="min-width:96px;">
                    ${cancelText}
                  </button>
                  <button type="button" id="jcConfirmOkBtn" style="min-width:130px;">
                    ${confirmText}
                  </button>
                </div>
              </div>
            </div>
          </div>
        `).appendTo('body');
      }

      $('#jcConfirmTitle').text(title);
      $('#jcConfirmMessage').html(message);
      $('#jcConfirmOkBtn').text(confirmText).attr('class', btnClass);
      $('#jcConfirmCancelBtn').text(cancelText);
      $('#jcConfirmIcon').html(`<i class="bi ${icon}" style="font-size:1.75rem;color:${iconColor};"></i>`)
        .css({
          background: isDanger ? 'rgba(239,68,68,0.14)' : 'rgba(0,168,150,0.14)',
          borderColor: isDanger ? 'rgba(239,68,68,0.3)' : 'rgba(0,168,150,0.3)'
        });

      const modalInstance = bootstrap.Modal.getOrCreateInstance($modal[0]);
      let resolved = false;

      // Handle backdrop z-index when opened over another modal (e.g. editTicketModal)
      $modal.off('shown.bs.modal').on('shown.bs.modal', () => {
        const backdrops = $('.modal-backdrop');
        if (backdrops.length > 1) {
          $(backdrops[backdrops.length - 1]).css('z-index', 1085);
        }
      });

      $('#jcConfirmOkBtn').off('click').on('click', () => {
        resolved = true;
        modalInstance.hide();
        resolve(true);
      });

      $modal.off('hidden.bs.modal').on('hidden.bs.modal', () => {
        if (!resolved) {
          resolve(false);
        }
        // If an underlying modal is still open, keep body locked and modal-open
        if ($('.modal.show').length > 0) {
          $('body').addClass('modal-open');
        }
      });

      modalInstance.show();
    });
  }
};

// Graceful intercept of window.alert so no ugly native browser alerts appear
if (typeof window !== 'undefined') {
  window.alert = function(msg) {
    if (window.UI && window.UI.toast) {
      const isErr = String(msg).toLowerCase().includes('error') || String(msg).toLowerCase().includes('failed');
      window.UI.toast(msg, isErr ? 'error' : 'success');
    } else {
      console.log('[Alert]', msg);
    }
  };

  window.escapeHtml = function(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };
}
