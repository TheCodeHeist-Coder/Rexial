import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const apiHost =
    import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';
  
export const api = axios.create({
    baseURL: apiHost,
    timeout: 10000,
});

// Request interceptor
api.interceptors.request.use((config) => {
    const token = useAuthStore.getState().token;

    if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

// Response interceptor
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            useAuthStore.getState().logout();
        }
        return Promise.reject(error);
    }
);