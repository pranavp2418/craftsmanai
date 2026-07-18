'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import {
  fetchNotificationSettings,
  updateNotificationSettings,
} from '@/redux/slices/retailer/settings/notificationSlice';
import { toast } from 'react-toastify';
import { registerPushSubscription, unsubscribePushNotification } from '@/lib/pushNotifications';

interface NotifSetting {
  id: string;
  label: string;
  helper: string;
  icon: string;
  iconColor: string;
  iconBg: string;
}

const SETTINGS: NotifSetting[] = [
  {
    id: 'email',
    label: 'Email Notifications',
    helper: 'Receive updates via email.',
    icon: 'ri-mail-line',
    iconColor: 'text-indigo-accent',
    iconBg: 'bg-tint-indigo-mid',
  },
  {
    id: 'push',
    label: 'Push Notifications',
    helper: 'Get real-time alerts in the platform.',
    icon: 'ri-notification-3-line',
    iconColor: 'text-brand',
    iconBg: 'bg-tint-brand',
  },
  {
    id: 'design',
    label: 'Design Approval Alerts',
    helper: 'Notify when a customer approves or rejects a design.',
    icon: 'ri-checkbox-circle-line',
    iconColor: 'text-success-medium',
    iconBg: 'bg-tint-emerald',
  },
  {
    id: 'manufacturer',
    label: 'Manufacturer Updates',
    helper: 'Get updates when manufacturers respond or progress changes.',
    icon: 'ri-building-4-line',
    iconColor: 'text-warning',
    iconBg: 'bg-tint-warning',
  },
  {
    id: 'quote',
    label: 'Quote Reminders',
    helper: 'Reminders for pending approvals or quotes.',
    icon: 'ri-price-tag-3-line',
    iconColor: 'text-violet-accent',
    iconBg: 'bg-tint-violet',
  },
];

export default function NotificationsCard() {
  const dispatch = useAppDispatch();

  const { settingsStatus, settingsError, settingsItem, updateStatus, updateError } = useAppSelector(
    (state) => state.retailerNotification
  );
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    email: true,
    push: true,
    design: true,
    manufacturer: true,
    quote: false,
  });

  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    dispatch(fetchNotificationSettings());
  }, [dispatch]);

  useEffect(() => {
    if (settingsItem) {
      setToggles({
        email: settingsItem.email_notifications,
        push: settingsItem.push_notifications,
        design: settingsItem.design_approval_alerts,
        manufacturer: settingsItem.manufacturer_updates,
        quote: settingsItem.quote_reminders,
      });
      setInitialized(true);
    }
  }, [settingsItem]);

  const loading = settingsStatus === 'loading' || !initialized;

  const payload = useMemo(
    () => ({
      email_notifications: toggles.email,
      push_notifications: toggles.push,
      design_approval_alerts: toggles.design,
      manufacturer_updates: toggles.manufacturer,
      quote_reminders: toggles.quote,
    }),
    [toggles]
  );

  const handleToggle = async (id: keyof typeof toggles) => {
    const nextToggles = { ...toggles, [id]: !toggles[id] };

    if (id === 'push') {
      if (nextToggles.push) {
        if (typeof window === 'undefined' || !('Notification' in window)) {
          toast.error('Notifications are not supported by this browser.');
          return;
        }
        if (Notification.permission !== 'granted') {
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') {
            toast.warn('Notification permission denied. Please enable them in your browser settings.');
            return;
          }
        }
        try {
          await registerPushSubscription();
        } catch (err) {
          toast.error('Failed to subscribe to browser notifications.');
          return;
        }
      } else {
        try {
          await unsubscribePushNotification();
        } catch (err) {
          console.error('Failed to unsubscribe:', err);
        }
      }
    }

    setToggles(nextToggles);

    try {
      await dispatch(updateNotificationSettings({
        email_notifications: nextToggles.email,
        push_notifications: nextToggles.push,
        design_approval_alerts: nextToggles.design,
        manufacturer_updates: nextToggles.manufacturer,
        quote_reminders: nextToggles.quote,
      })).unwrap();
      toast.success('Preferences updated');
    } catch {
      // Revert toggle state if update failed on backend
      setToggles(toggles);
    }
  };

  const ShimmerRow = () => (
    <div className="flex items-center justify-between py-4 px-5 rounded-2xl transition-all duration-150 group bg-section border border-sand animate-pulse">
      <div className="flex items-center gap-4 flex-1">
        <div className="w-10 h-10 rounded-xl skeleton-shimmer flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-44 rounded-card skeleton-shimmer" />
          <div className="h-3 w-56 rounded-card skeleton-shimmer" />
        </div>
      </div>
      <div className="w-[44px] h-[24px] rounded-full skeleton-shimmer flex-shrink-0" />
    </div>
  );

  return (
    <div
      className="rounded-sheet p-5 sm:p-8 shadow-glow-indigo-soft bg-glass-72 backdrop-blur-xl border border-glass-strong">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="text-heading font-bold text-ink-900 font-satoshi dark:text-[#E7EAEE]">
            Notifications
          </h2>
          <p className="text-body-sm text-ink-400 mt-1">Control how and when you receive important updates.</p>
        </div>
      </div>

      {settingsError && (
        <div className="mb-4 rounded-xl border border-danger/20 bg-tint-danger-soft px-4 py-3 text-label-sm text-danger">
          {settingsError}
        </div>
      )}
      {updateError && !settingsError && (
        <div className="mb-4 rounded-xl border border-danger/20 bg-tint-danger-soft px-4 py-3 text-label-sm text-danger">
          {updateError}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {loading
          ? SETTINGS.map((s) => <ShimmerRow key={s.id} />)
          : SETTINGS.map((s, i) => (
          <div key={s.id}>
            <div className="flex items-center justify-between py-4 px-5 rounded-2xl transition-all duration-150 group bg-section border border-sand">
              <div className="flex items-center gap-4">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${s.iconBg}`}

                >
                  <span className={`w-5 h-5 flex items-center justify-center ${s.icon} text-heading-xs ${s.iconColor}`}></span>
                </div>
                <div>
                  <p className="text-body font-semibold text-ink-900 font-satoshi">
                    {s.label}
                  </p>
                  <p className="text-label text-ink-400 mt-0.5">{s.helper}</p>
                </div>
              </div>

              <button
                onClick={() => handleToggle(s.id as keyof typeof toggles)}
                disabled={updateStatus === 'loading'}
                className="relative flex-shrink-0 cursor-pointer transition-all duration-200 w-[44px] h-[24px] disabled:opacity-70 disabled:cursor-not-allowed"

                aria-label={`Toggle ${s.label}`}
              >
                <div
                  className={`absolute inset-0 rounded-full transition-all duration-300 ${toggles[s.id] ? "bg-gradient-indigo" : "bg-muted-bg-70"} ${toggles[s.id] ? "shadow-glow-indigo-pill" : "shadow-none"}`}

                />
                <div
                  className={`absolute top-[3px] rounded-full bg-white shadow-sm transition-all duration-300 w-[18px] h-[18px] ${toggles[s.id] ? "left-[23px]" : "left-[3px]"} shadow-card-tiny`}

                />
              </button>
            </div>
            {i < SETTINGS.length - 1 && (
              <div className="h-px mx-5 bg-transparent"/>
            )}
          </div>
        ))}
      </div>

      <p className="text-label-sm text-ink-250 mt-6 px-1">
        Changes take effect immediately across all your devices.
      </p>
    </div>
  );
}
