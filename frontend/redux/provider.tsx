'use client';

import { ReactNode, useEffect } from 'react';
import { Provider } from 'react-redux';
import { store } from './store';
import { useAppDispatch } from './hooks';
import { refreshAccessToken, setAccessToken as setAuthAccessToken, setInitialized } from './slices/auth/authSlice';
import { getAccessToken, getStoredUser, isProductionEnv } from '@/src/utils/auth';
import { setUser } from './slices/login/loginSlice';

interface ReduxProviderProps {
  children: ReactNode;
}

export default function ReduxProvider({ children }: ReduxProviderProps) {
  return (
    <Provider store={store}>
      <ReduxInitializer />
      {children}
    </Provider>
  );
}

function ReduxInitializer() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (isProductionEnv()) {
      // Silent restore on app load using refresh cookie
      dispatch(refreshAccessToken());
      return;
    }

    const token = getAccessToken();
    if (token) {
      dispatch(setAuthAccessToken(token));
    }

    const storedUser = getStoredUser();
    if (storedUser) {
      dispatch(setUser(storedUser as any));
    }

    dispatch(setInitialized(true));
  }, [dispatch]);

  return null;
}
