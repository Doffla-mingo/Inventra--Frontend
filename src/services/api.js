import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// Attach JWT token to every request
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// Auto logout on 401
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authAPI = {
  login:    data => api.post('/auth/login', data),
  register: data => api.post('/auth/register', data),
  me:       ()   => api.get('/auth/me'),
  profile:  data => api.put('/auth/profile', data),
  password: data => api.put('/auth/password', data),
};

// ── Products ──────────────────────────────────────────────────────────────────
export const productsAPI = {
  list:      params => api.get('/products', { params }),
  stats:     ()     => api.get('/products/stats'),
  discounts: ()     => api.get('/products/discounts'),
  scanQR:    code   => api.get(`/products/qr/${code}`),
  get:       id     => api.get(`/products/${id}`),
  create:    data   => api.post('/products', data),
  update:    (id, data) => api.put(`/products/${id}`, data),
  delete:    id     => api.delete(`/products/${id}`),
  importCSV: file   => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/products/import/csv', form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
};

// ── Triggers ──────────────────────────────────────────────────────────────────
export const triggersAPI = {
  list:   ()     => api.get('/triggers'),
  create: data   => api.post('/triggers', data),
  update: (id, data) => api.put(`/triggers/${id}`, data),
  delete: id     => api.delete(`/triggers/${id}`),
  check:  ()     => api.post('/triggers/check'),
};

// ── Emails ────────────────────────────────────────────────────────────────────
export const emailsAPI = {
  list:     params => api.get('/emails', { params }),
  sendTest: ()     => api.post('/emails/test'),
};

// ── Users (admin) ─────────────────────────────────────────────────────────────
export const usersAPI = {
  list:   () => api.get('/users'),
  delete: id => api.delete(`/users/${id}`),
};

export default api;
