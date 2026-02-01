import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';

const API_URL = import.meta.env.VITE_API_URL || '';

interface PushState {
  isSupported: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  permission: NotificationPermission | 'default';
  error: string | null;
}

// Check if running on iOS
function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

// Check if app is installed as PWA
function isPWA(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
         (window.navigator as any).standalone === true;
}

// Check if push notifications are supported
function isPushSupported(): boolean {
  return 'serviceWorker' in navigator &&
         'PushManager' in window &&
         'Notification' in window;
}

// Convert VAPID public key from base64 to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [state, setState] = useState<PushState>({
    isSupported: false,
    isSubscribed: false,
    isLoading: true,
    permission: 'default',
    error: null,
  });

  // Check current subscription status
  const checkSubscription = useCallback(async () => {
    if (!isPushSupported() || !user) {
      setState(prev => ({ ...prev, isLoading: false, isSupported: false }));
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      const permission = Notification.permission;

      setState({
        isSupported: true,
        isSubscribed: !!subscription,
        isLoading: false,
        permission,
        error: null,
      });
    } catch (error) {
      console.error('Error checking push subscription:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to check notification status',
      }));
    }
  }, [user]);

  // Register service worker and check status on mount
  useEffect(() => {
    if (!isPushSupported()) {
      setState(prev => ({ ...prev, isLoading: false, isSupported: false }));
      return;
    }

    // Register service worker
    navigator.serviceWorker.register('/sw.js')
      .then(() => {
        console.log('Service Worker registered');
        checkSubscription();
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Failed to register service worker',
        }));
      });
  }, [checkSubscription]);

  // Subscribe to push notifications
  const subscribe = useCallback(async () => {
    if (!isPushSupported() || !user) {
      return { success: false, error: 'Push notifications not supported' };
    }

    // iOS requires PWA to be installed
    if (isIOS() && !isPWA()) {
      return {
        success: false,
        error: 'Please add this app to your home screen first to enable notifications',
        requiresInstall: true,
      };
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(prev => ({
          ...prev,
          isLoading: false,
          permission,
          error: 'Notification permission denied',
        }));
        return { success: false, error: 'Permission denied' };
      }

      // Get VAPID public key from server
      const keyResponse = await fetch(`${API_URL}/api/push/vapid-public-key`, {
        credentials: 'include',
      });

      if (!keyResponse.ok) {
        throw new Error('Failed to get VAPID key');
      }

      const { publicKey } = await keyResponse.json();

      // Subscribe to push
      const registration = await navigator.serviceWorker.ready;
      const applicationServerKey = urlBase64ToUint8Array(publicKey);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      });

      // Send subscription to server
      const response = await fetch(`${API_URL}/api/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });

      if (!response.ok) {
        throw new Error('Failed to save subscription');
      }

      setState({
        isSupported: true,
        isSubscribed: true,
        isLoading: false,
        permission: 'granted',
        error: null,
      });

      return { success: true };
    } catch (error: any) {
      console.error('Error subscribing to push:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to enable notifications',
      }));
      return { success: false, error: error.message };
    }
  }, [user]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Notify server
        await fetch(`${API_URL}/api/push/unsubscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });

        // Unsubscribe locally
        await subscription.unsubscribe();
      }

      setState(prev => ({
        ...prev,
        isSubscribed: false,
        isLoading: false,
      }));

      return { success: true };
    } catch (error: any) {
      console.error('Error unsubscribing:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to disable notifications',
      }));
      return { success: false, error: error.message };
    }
  }, []);

  return {
    ...state,
    subscribe,
    unsubscribe,
    isIOS: isIOS(),
    isPWA: isPWA(),
    needsInstall: isIOS() && !isPWA(),
  };
}
