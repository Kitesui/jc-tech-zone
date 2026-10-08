/* ============================================================
   api.js — jQuery AJAX API Client for JC TECH ZONE
   All server communication uses $.ajax() as required by gemini.md
   ============================================================ */

const API = (() => {
  const BASE = '/api';

  function request(method, endpoint, data) {
    return new Promise((resolve, reject) => {
      $.ajax({
        url: BASE + endpoint,
        method: method.toUpperCase(),
        contentType: 'application/json',
        data: data ? JSON.stringify(data) : undefined,
        success: resolve,
        error: (xhr) => {
          const err = xhr.responseJSON?.error || xhr.responseJSON?.message || `Request failed (${xhr.status})`;
          reject(new Error(err));
        },
      });
    });
  }

  return {
    // Tickets
    createTicket:     (d)      => request('POST',   '/tickets', d),
    getTickets:       (params) => request('GET',    '/tickets?' + $.param(params || {})),
    trackTicket:      (ref)    => request('GET',    `/tickets/track/${encodeURIComponent(ref)}`),
    getTicket:        (id)     => request('GET',    `/tickets/${id}`),
    updateTicket:     (id, d)  => request('PUT',    `/tickets/${id}`, d),
    addWorkLog:       (id, d)  => request('POST',   `/tickets/${id}/logs`, d),
    deleteTicket:     (id)     => request('DELETE', `/tickets/${id}`),

    // Products
    getProducts:  (params) => request('GET',    '/products?' + $.param(params || {})),
    getProduct:   (id)     => request('GET',    `/products/${id}`),
    createProduct:(d)      => request('POST',   '/products', d),
    updateProduct:(id, d)  => request('PUT',    `/products/${id}`, d),
    deleteProduct:(id)     => request('DELETE', `/products/${id}`),

    // Technicians
    getTechnicians:    ()     => request('GET',  '/technicians'),
    createTechnician:  (d)    => request('POST', '/technicians', d),
    updateTechnician:  (id,d) => request('PUT',  `/technicians/${id}`, d),

    // Feedback
    submitFeedback: (d)        => request('POST', '/feedback', d),
    getFeedback:    (ticket_id)=> request('GET',  `/feedback/${ticket_id}`),

    // Health
    health: () => request('GET', '/health'),
  };
})();
