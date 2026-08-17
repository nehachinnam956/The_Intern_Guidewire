import axios from 'axios';

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
});

// Attach JWT to every request
API.interceptors.request.use(config => {
  const token = localStorage.getItem('ds_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const auth = {
  sendOtp: (phone) => API.post('/auth/send-otp', { phone }),
  verifyOtp: (phone, code) => API.post('/auth/verify-otp', { phone, code }),
  register: (data) => API.post('/auth/register', data),
  me: () => API.get('/auth/me'),
};

export const stores = {
  list: () => API.get('/stores'),
  get: (id) => API.get(`/stores/${id}`),
  calcPremium: (data) => API.post('/stores/calculate-premium', data),
};

export const policy = {
  create: (data) => API.post('/policy/create', data),
  active: () => API.get('/policy/active'),
  togglePause: () => API.patch('/policy/toggle-pause'),
  cancel: () => API.patch('/policy/cancel'),
};

export const weather = {
  check: (storeId) => API.get(`/weather/check/${storeId}`),
  history: (storeId) => API.get(`/weather/history/${storeId}`),
};

export const claims = {
  history: () => API.get('/claims/history'),
  // Streaming claim — uses EventSource
  file: (data) => API.post('/claims/file', data),
};

export const payment = {
  createOrder: (amount) => API.post('/payment/create-order', { amount }),
  verify: (data) => API.post('/payment/verify', data),
};

export const admin = {
  stats: () => API.get('/admin/stats'),
  lossRatios: () => API.get('/admin/loss-ratios'),
  fraudQueue: () => API.get('/admin/fraud-queue'),
  forecast: () => API.get('/admin/forecast'),
  updateClaim: (id, data) => API.patch(`/admin/claim/${id}`, data),
};

export default API;
