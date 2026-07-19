import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

let API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api';

export const setApiBaseUrl = (baseUrl: string) => {
  API_URL = baseUrl;
  apiClient.defaults.baseURL = baseUrl;
};

export const getApiBaseUrl = () => API_URL;

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config) => {
  try {
    const token = await SecureStore.getItemAsync('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (error) {
    console.error('Error fetching token from SecureStore', error);
  }
  return config;
});
