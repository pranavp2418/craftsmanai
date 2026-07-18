import axios, { AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import {
  getAccessToken,
  setAccessToken as setMemoryAccessToken,
  setStoredUser,
  clearAllClientStorage,
} from '../auth';

// Create the custom Axios instance
const axiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL,
  withCredentials: true, // For HttpOnly cookies
});

// Types for concurrency handling
interface FailedRequestQueue {
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
}

let isRefreshing = false;
let failedQueue: FailedRequestQueue[] = [];

const processQueue = (error: AxiosError | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    try {
      const token = getAccessToken();
      if (token) {
        if (!config.headers) config.headers = {} as any;
        (config.headers as any).Authorization = `Bearer ${token}`;
      }
      if (config.method === 'get' || config.method === 'GET') {
        if (!config.headers) config.headers = {} as any;
        config.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
        config.headers['Pragma'] = 'no-cache';
        config.headers['Expires'] = '0';
      }
    } catch (e) {
      // ignore token read errors
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  },
);

axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    // Empty Response Handling: Return an empty object if no data to avoid parsing errors
    // Specifically helpful for 204 No Content or empty responses
    if (!response.data && response.data !== false && response.data !== 0) {
      response.data = {};
    }

    // Check user-profile endpoint response for credit or plan exhaustion
    if (response.config.url?.includes('/api/v2/user-profile/')) {
      if (response.data) {
        if (response.data.role?.toLowerCase() !== 'admin') {
          if (response.data.token_exhausted === true) {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('app:credits_exhausted', {
                  detail: {
                    message: response.data.message || 'Upgrade or add a top-up pack to keep designing.'
                  }
                })
              );
            }
          }
          if (response.data.plan_expired === true) {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('app:plan_expired', {
                  detail: {
                    planName: response.data.plan_name || null,
                    message: response.data.message
                  }
                })
              );
            }
          }
        }
      }
    }

    return response;
  },
  async (error: AxiosError) => {
    // Dev helper: log server error bodies to console for easier debugging
    if (process.env.NODE_ENV !== 'production') {
      try {
        // eslint-disable-next-line no-console
        console.debug('[axios] response error data:', error.response?.data ?? error.toJSON());
      } catch (e) {
        // ignore
      }
    }
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // 403 Handling: Inject default message
    if (error.response?.status === 403) {
      if (error.response.data && typeof error.response.data === 'object') {
        (error.response.data as any).message =
          (error.response.data as any).message || 'Access forbidden';
      } else {
        if (!error.response.data) {
          error.response.data = { message: 'Access forbidden' };
        }
      }
    }

    const isAuthRequest =
      originalRequest?.url?.includes('/login') || originalRequest?.url?.includes('/refresh-token');

    // 401 Handling: Token Refresh
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthRequest
    ) {
      if (isRefreshing) {
        try {
          // Wait for the token refresh to complete
          await new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          });
          // Retry the original request
          return axiosInstance(originalRequest);
        } catch (err) {
          return Promise.reject(err);
        }
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Attempt to refresh token using refresh cookie
        const refreshResponse = await axios.post(
          `${process.env.NEXT_PUBLIC_BACKEND_URL || ''}/api/v2/auth/refresh-token`,
          {},
          { withCredentials: true },
        );

        const newAccessToken = refreshResponse.data?.access_token;
        if (newAccessToken) {
          setMemoryAccessToken(newAccessToken);
        }

        processQueue(null, newAccessToken || null);
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as AxiosError);

        // Auto-Logout on refresh failure
        if (typeof window !== 'undefined') {
          setMemoryAccessToken(null);
          setStoredUser(null);
          clearAllClientStorage();
          window.location.href = '/login';
        }

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default axiosInstance;
