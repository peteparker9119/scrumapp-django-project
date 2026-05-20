import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refresh = localStorage.getItem('refresh_token');
        if (!refresh) throw new Error('No refresh token');
        const res = await axios.post('/api/auth/refresh/', { refresh });
        localStorage.setItem('access_token', res.data.access);
        original.headers.Authorization = `Bearer ${res.data.access}`;
        return api(original);
      } catch {
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export const authAPI = {
  login:    (data) => api.post('/auth/login/', data),
  register: (data) => api.post('/auth/register/', data),
  refresh:  (data) => api.post('/auth/refresh/', data),
  me:       ()     => api.get('/auth/me/'),
  getUsers: ()     => api.get('/users/'),
};

export const projectAPI = {
  getAll:    ()         => api.get('/projects/'),
  getOne:    (id)       => api.get(`/projects/${id}/`),
  create:    (data)     => api.post('/projects/', data),
  update:    (id, data) => api.patch(`/projects/${id}/`, data),
  addMember: (id, data) => api.post(`/projects/${id}/members/`, data),
};

export const requirementAPI = {
  getAll:        (params)       => api.get('/requirements/', { params }),
  getOne:        (id)           => api.get(`/requirements/${id}/`),
  create:        (data)         => api.post('/requirements/', data),
  update:        (id, data)     => api.put(`/requirements/${id}/`, data),
  approve:       (id, data)     => api.patch(`/requirements/${id}/approve/`, data),
  convert:       (id)           => api.post(`/requirements/${id}/convert/`),
  addComment:    (id, data)     => api.post(`/requirements/${id}/comments/`, data),
  getCriteria:   (id)           => api.get(`/requirements/${id}/criteria/`),
  updateCriteria:(id, data)     => api.patch(`/requirements/${id}/criteria/`, data),
  addWatcher:    (id, data)     => api.post(`/requirements/${id}/watchers/`, data),
  replaceTags:   (id, data)     => api.post(`/requirements/${id}/tags/`, data),
};

export const backlogAPI = {
  getAll:  (params)       => api.get('/backlog/', { params }),
  getOne:  (id)           => api.get(`/backlog/${id}/`),
  create:  (data)         => api.post('/backlog/', data),
  update:  (id, data)     => api.patch(`/backlog/${id}/`, data),
  reorder: (data)         => api.patch('/backlog/reorder/', data),
  remove:  (id)           => api.delete(`/backlog/${id}/`),
};

export const sprintAPI = {
  getAll:           (params)           => api.get('/sprints/', { params }),
  getOne:           (id)               => api.get(`/sprints/${id}/`),
  create:           (data)             => api.post('/sprints/', data),
  update:           (id, data)         => api.patch(`/sprints/${id}/`, data),
  addItem:          (id, data)         => api.post(`/sprints/${id}/items/`, data),
  addItemsBulk:     (id, data)         => api.post(`/sprints/${id}/items/bulk/`, data),
  removeItem:       (id, itemId)       => api.delete(`/sprints/${id}/items/${itemId}/`),
  updateItemStatus: (id, itemId, data) => api.patch(`/sprints/${id}/items/${itemId}/status/`, data),
  getBurndown:      (id)               => api.get(`/sprints/${id}/burndown/`),
  getCapacity:      (id)               => api.get(`/sprints/${id}/capacity/`),
  saveCapacity:     (id, data)         => api.post(`/sprints/${id}/capacity/`, data),
  getMembers:       (id)               => api.get(`/sprints/${id}/members/`),
  saveMember:       (id, data)         => api.post(`/sprints/${id}/members/`, data),
  removeMember:     (id, data)         => api.delete(`/sprints/${id}/members/`, { data }),
};

export const dashboardAPI = {
  getStats: (project_id) => api.get('/dashboard/stats/', { params: { project_id } }),
};

export const employeeMasterAPI = {
  getAll:  ()         => api.get('/employees-master/'),
  getOne:  (id)       => api.get(`/employees-master/${id}/`),
  create:  (data)     => api.post('/employees-master/', data),
  update:  (id, data) => api.put(`/employees-master/${id}/`, data),
  remove:  (id)       => api.delete(`/employees-master/${id}/`),
};

export const bugAPI = {
  getAll:     (params)     => api.get('/bugs/', { params }),
  getOne:     (id)         => api.get(`/bugs/${id}/`),
  create:     (data)       => api.post('/bugs/', data),
  update:     (id, data)   => api.patch(`/bugs/${id}/`, data),
  addComment: (id, data)   => api.post(`/bugs/${id}/comments/`, data),
  getStats:   (params)     => api.get('/bugs/stats/', { params }),
};

export const retroAPI = {
  getAll:     (params)           => api.get('/retrospectives/', { params }),
  getOne:     (id)               => api.get(`/retrospectives/${id}/`),
  getOrCreate:(data)             => api.post('/retrospectives/', data),
  addItem:    (id, data)         => api.post(`/retrospectives/${id}/items/`, data),
  updateItem: (id, itemId, data) => api.patch(`/retrospectives/${id}/items/${itemId}/`, data),
  deleteItem: (id, itemId)       => api.delete(`/retrospectives/${id}/items/${itemId}/`),
  voteItem:   (id, itemId)       => api.post(`/retrospectives/${id}/items/${itemId}/vote/`),
  publish:    (id)               => api.patch(`/retrospectives/${id}/publish/`),
};

export const reportAPI = {
  getVelocity: (params) => api.get('/reports/velocity/', { params }),
  getSprints:  (params) => api.get('/reports/sprints/',  { params }),
  getBugs:     (params) => api.get('/reports/bugs/',     { params }),
  getTeam:     (params) => api.get('/reports/team/',     { params }),
};

export const adminAPI = {
  getLogs:        (params)     => api.get('/admin/logs/', { params }),
  getUsers:       ()           => api.get('/users/'),
  createUser:     (data)       => api.post('/users/', data),
  updateUser:     (id, data)   => api.patch(`/users/${id}/`, data),
  deleteUser:     (id)         => api.delete(`/users/${id}/`),
  getWorkspace:   ()           => api.get('/admin/workspace/'),
  updateWorkspace:(key, data)  => api.put(`/admin/workspace/${key}/`, data),
  getScrumStats:  ()           => api.get('/admin/scrum-stats/'),
};

export const groomingAPI = {
  getAll:          (params)          => api.get('/grooming/', { params }),
  getOne:          (id)              => api.get(`/grooming/${id}/`),
  create:          (data)            => api.post('/grooming/', data),
  update:          (id, data)        => api.put(`/grooming/${id}/`, data),
  submitForReview: (id)              => api.post(`/grooming/${id}/submit/`),
  reviewStage:     (id, stage, data) => api.patch(`/grooming/${id}/review/${stage}/`, data),
  addComment:      (id, data)        => api.post(`/grooming/${id}/comments/`, data),
  getReadyForSprint:(params)         => api.get('/grooming/ready-for-sprint/', { params }),
  getStats:        (params)          => api.get('/grooming/stats/', { params }),
};

export const releaseAPI = {
  getAll:           (params)        => api.get('/releases/', { params }),
  getOne:           (id)            => api.get(`/releases/${id}/`),
  create:           (data)          => api.post('/releases/', data),
  update:           (id, data)      => api.patch(`/releases/${id}/`, data),
  updateDeployment: (id, env, data) => api.patch(`/releases/${id}/deploy/${env}/`, data),
  addSprint:        (id, data)      => api.post(`/releases/${id}/sprints/`, data),
  addComment:       (id, data)      => api.post(`/releases/${id}/comments/`, data),
  getStats:         (params)        => api.get('/releases/stats/', { params }),
};

export const employeeAPI = {
  getAll:  ()         => api.get('/employees/'),
  getOne:  (id)       => api.get(`/employees/${id}/`),
  create:  (data)     => api.post('/employees/', data),
  update:  (id, data) => api.put(`/employees/${id}/`, data),
  remove:  (id)       => api.delete(`/employees/${id}/`),
};

export default api;
