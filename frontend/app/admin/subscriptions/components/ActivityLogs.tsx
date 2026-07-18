import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, RefreshCw } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { fetchSubscriptionActivityLogs } from '@/redux/slices/admin/subscriptions/adminSubscriptionActivityLogsSlice';
import { useDebounce } from '@/src/utils/hooks/useDebounce';
import Pagination from '@/app/admin/dashboard/components/Pagination';

const icons = {
  created: (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M0 18C0 8.05888 8.05888 0 18 0C27.9411 0 36 8.05888 36 18C36 27.9411 27.9411 36 18 36C8.05888 36 0 27.9411 0 18Z" fill="#F0FDF4" />
      <path d="M18.3199 19.84V21.2267C17.9103 21.0756 17.4837 21 17.0399 21C16.3487 21 15.7045 21.1822 15.1071 21.5467C14.5269 21.9022 14.0661 22.3822 13.7247 22.9867C13.3749 23.6089 13.1999 24.28 13.1999 25H11.9199C11.9199 24.0311 12.1546 23.1333 12.6239 22.3067C13.0762 21.5067 13.6863 20.8711 14.4543 20.4C15.2479 19.9111 16.1098 19.6667 17.0399 19.6667C17.4751 19.6667 17.9018 19.7244 18.3199 19.84ZM17.0399 19C16.3402 19 15.6959 18.8178 15.1071 18.4533C14.5269 18.0978 14.0661 17.6178 13.7247 17.0133C13.3749 16.4 13.1999 15.7289 13.1999 15C13.1999 14.2711 13.3749 13.6 13.7247 12.9867C14.0661 12.3822 14.5269 11.9022 15.1071 11.5467C15.6959 11.1822 16.3402 11 17.0399 11C17.7397 11 18.3839 11.1822 18.9727 11.5467C19.553 11.9022 20.0138 12.3822 20.3551 12.9867C20.705 13.6 20.8799 14.2711 20.8799 15C20.8799 15.7289 20.705 16.4 20.3551 17.0133C20.0138 17.6178 19.553 18.0978 18.9727 18.4533C18.3839 18.8178 17.7397 19 17.0399 19ZM17.0399 17.6667C17.5007 17.6667 17.9274 17.5467 18.3199 17.3067C18.7125 17.0667 19.0239 16.7422 19.2543 16.3333C19.4847 15.9244 19.5999 15.48 19.5999 15C19.5999 14.52 19.4847 14.0756 19.2543 13.6667C19.0239 13.2578 18.7125 12.9333 18.3199 12.6933C17.9274 12.4533 17.5007 12.3333 17.0399 12.3333C16.5791 12.3333 16.1525 12.4533 15.7599 12.6933C15.3674 12.9333 15.0559 13.2578 14.8255 13.6667C14.5951 14.0756 14.4799 14.52 14.4799 15C14.4799 15.48 14.5951 15.9244 14.8255 16.3333C15.0559 16.7422 15.3674 17.0667 15.7599 17.3067C16.1525 17.5467 16.5791 17.6667 17.0399 17.6667ZM20.8799 21.6667V19.6667H22.1599V21.6667H24.0799V23H22.1599V25H20.8799V23H18.9599V21.6667H20.8799Z" fill="#16A34A" />
    </svg>


  ),
  upgraded: (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
      <path d="M0 18C0 8.05888 8.05888 0 18 0C27.9411 0 36 8.05888 36 18C36 27.9411 27.9411 36 18 36C8.05888 36 0 27.9411 0 18Z" fill="#EFF6FF" />
      <path d="M18.0001 11.3327C18.8705 11.3327 19.7025 11.506 20.4961 11.8527C21.2556 12.1905 21.9318 12.6682 22.5249 13.286C23.118 13.9038 23.5766 14.6082 23.9009 15.3993C24.2337 16.226 24.4001 17.0927 24.4001 17.9993C24.4001 18.906 24.2337 19.7727 23.9009 20.5993C23.5766 21.3905 23.118 22.0949 22.5249 22.7127C21.9318 23.3305 21.2556 23.8082 20.4961 24.146C19.7025 24.4927 18.8705 24.666 18.0001 24.666C17.1297 24.666 16.2977 24.4927 15.5041 24.146C14.7446 23.8082 14.0684 23.3305 13.4753 22.7127C12.8822 22.0949 12.4236 21.3905 12.0993 20.5993C11.7665 19.7727 11.6001 18.906 11.6001 17.9993C11.6001 17.0927 11.7665 16.226 12.0993 15.3993C12.4236 14.6082 12.8822 13.9038 13.4753 13.286C14.0684 12.6682 14.7446 12.1905 15.5041 11.8527C16.2977 11.506 17.1297 11.3327 18.0001 11.3327ZM18.0001 23.3327C18.9302 23.3327 19.7921 23.0882 20.5857 22.5993C21.3537 22.1282 21.9638 21.4927 22.4161 20.6927C22.8854 19.866 23.1201 18.9682 23.1201 17.9993C23.1201 17.0305 22.8854 16.1327 22.4161 15.306C21.9638 14.506 21.3537 13.8705 20.5857 13.3993C19.7921 12.9105 18.9302 12.666 18.0001 12.666C17.07 12.666 16.2081 12.9105 15.4145 13.3993C14.6465 13.8705 14.0364 14.506 13.5841 15.306C13.1148 16.1327 12.8801 17.0305 12.8801 17.9993C12.8801 18.9682 13.1148 19.866 13.5841 20.6927C14.0364 21.4927 14.6465 22.1282 15.4145 22.5993C16.2081 23.0882 17.07 23.3327 18.0001 23.3327ZM18.6401 17.9993V20.666H17.3601V17.9993H15.4401L18.0001 15.3327L20.5601 17.9993H18.6401Z" fill="#2563EB" />
    </svg>
  ),
  cancelled: (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
      <path d="M0 18C0 8.05888 8.05888 0 18 0C27.9411 0 36 8.05888 36 18C36 27.9411 27.9411 36 18 36C8.05888 36 0 27.9411 0 18Z" fill="#FEF2F2" />
      <path d="M18.0001 24.666C17.1297 24.666 16.2977 24.4927 15.5041 24.146C14.7446 23.8082 14.0684 23.3305 13.4753 22.7127C12.8822 22.0949 12.4236 21.3905 12.0993 20.5993C11.7665 19.7727 11.6001 18.906 11.6001 17.9993C11.6001 17.0927 11.7665 16.226 12.0993 15.3993C12.4236 14.6082 12.8822 13.9038 13.4753 13.286C14.0684 12.6682 14.7446 12.1905 15.5041 11.8527C16.2977 11.506 17.1297 11.3327 18.0001 11.3327C18.8705 11.3327 19.7025 11.506 20.4961 11.8527C21.2556 12.1905 21.9318 12.6682 22.5249 13.286C23.118 13.9038 23.5766 14.6082 23.9009 15.3993C24.2337 16.226 24.4001 17.0927 24.4001 17.9993C24.4001 18.906 24.2337 19.7727 23.9009 20.5993C23.5766 21.3905 23.118 22.0949 22.5249 22.7127C21.9318 23.3305 21.2556 23.8082 20.4961 24.146C19.7025 24.4927 18.8705 24.666 18.0001 24.666ZM18.0001 23.3327C18.9302 23.3327 19.7921 23.0882 20.5857 22.5993C21.3537 22.1282 21.9638 21.4927 22.4161 20.6927C22.8854 19.866 23.1201 18.9682 23.1201 17.9993C23.1201 17.0305 22.8854 16.1327 22.4161 15.306C21.9638 14.506 21.3537 13.8705 20.5857 13.3993C19.7921 12.9105 18.9302 12.666 18.0001 12.666C17.07 12.666 16.2081 12.9105 15.4145 13.3993C14.6465 13.8705 14.0364 14.506 13.5841 15.306C13.1148 16.1327 12.8801 17.0305 12.8801 17.9993C12.8801 18.9682 13.1148 19.866 13.5841 20.6927C14.0364 21.4927 14.6465 22.1282 15.4145 22.5993C16.2081 23.0882 17.07 23.3327 18.0001 23.3327ZM18.0001 17.0527L19.8049 15.1727L20.7137 16.1193L18.9089 17.9993L20.7137 19.8793L19.8049 20.826L18.0001 18.946L16.1953 20.826L15.2865 19.8793L17.0913 17.9993L15.2865 16.1193L16.1953 15.1727L18.0001 17.0527Z" fill="#DC2626" />
    </svg>
  ),
  paused: (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
      <path d="M0 18C0 8.05888 8.05888 0 18 0C27.9411 0 36 8.05888 36 18C36 27.9411 27.9411 36 18 36C8.05888 36 0 27.9411 0 18Z" fill="#FFF7ED" />
      <path d="M18.0001 24.666C17.1297 24.666 16.2977 24.4927 15.5041 24.146C14.7446 23.8082 14.0684 23.3305 13.4753 22.7127C12.8822 22.0949 12.4236 21.3905 12.0993 20.5993C11.7665 19.7727 11.6001 18.906 11.6001 17.9993C11.6001 17.0927 11.7665 16.226 12.0993 15.3993C12.4236 14.6082 12.8822 13.9038 13.4753 13.286C14.0684 12.6682 14.7446 12.1905 15.5041 11.8527C16.2977 11.506 17.1297 11.3327 18.0001 11.3327C18.8705 11.3327 19.7025 11.506 20.4961 11.8527C21.2556 12.1905 21.9318 12.6682 22.5249 13.286C23.118 13.9038 23.5766 14.6082 23.9009 15.3993C24.2337 16.226 24.4001 17.0927 24.4001 17.9993C24.4001 18.906 24.2337 19.7727 23.9009 20.5993C23.5766 21.3905 23.118 22.0949 22.5249 22.7127C21.9318 23.3305 21.2556 23.8082 20.4961 24.146C19.7025 24.4927 18.8705 24.666 18.0001 24.666ZM18.0001 23.3327C18.9302 23.3327 19.7921 23.0882 20.5857 22.5993C21.3537 22.1282 21.9638 21.4927 22.4161 20.6927C22.8854 19.866 23.1201 18.9682 23.1201 17.9993C23.1201 17.0305 22.8854 16.1327 22.4161 15.306C21.9638 14.506 21.3537 13.8705 20.5857 13.3993C19.7921 12.9105 18.9302 12.666 18.0001 12.666C17.07 12.666 16.2081 12.9105 15.4145 13.3993C14.6465 13.8705 14.0364 14.506 13.5841 15.306C13.1148 16.1327 12.8801 17.0305 12.8801 17.9993C12.8801 18.9682 13.1148 19.866 13.5841 20.6927C14.0364 21.4927 14.6465 22.1282 15.4145 22.5993C16.2081 23.0882 17.07 23.3327 18.0001 23.3327ZM16.0801 15.9993H17.3601V19.9993H16.0801V15.9993ZM18.6401 15.9993H19.9201V19.9993H18.6401V15.9993Z" fill="#EA580C" />
    </svg>
  ),
  resumed: (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
      <path d="M0 18C0 8.05888 8.05888 0 18 0C27.9411 0 36 8.05888 36 18C36 27.9411 27.9411 36 18 36C8.05888 36 0 27.9411 0 18Z" fill="#F0FDFA" />
      <path d="M18.0001 24.666C17.1297 24.666 16.2977 24.4927 15.5041 24.146C14.7446 23.8082 14.0684 23.3305 13.4753 22.7127C12.8822 22.0949 12.4236 21.3905 12.0993 20.5993C11.7665 19.7727 11.6001 18.906 11.6001 17.9993C11.6001 17.0927 11.7665 16.226 12.0993 15.3993C12.4236 14.6082 12.8822 13.9038 13.4753 13.286C14.0684 12.6682 14.7446 12.1905 15.5041 11.8527C16.2977 11.506 17.1297 11.3327 18.0001 11.3327C18.8705 11.3327 19.7025 11.506 20.4961 11.8527C21.2556 12.1905 21.9318 12.6682 22.5249 13.286C23.118 13.9038 23.5766 14.6082 23.9009 15.3993C24.2337 16.226 24.4001 17.0927 24.4001 17.9993C24.4001 18.906 24.2337 19.7727 23.9009 20.5993C23.5766 21.3905 23.118 22.0949 22.5249 22.7127C21.9318 23.3305 21.2556 23.8082 20.4961 24.146C19.7025 24.4927 18.8705 24.666 18.0001 24.666ZM18.0001 23.3327C18.9302 23.3327 19.7921 23.0882 20.5857 22.5993C21.3537 22.1282 21.9638 21.4927 22.4161 20.6927C22.8854 19.866 23.1201 18.9682 23.1201 17.9993C23.1201 17.0305 22.8854 16.1327 22.4161 15.306C21.9638 14.506 21.3537 13.8705 20.5857 15.3993C19.7921 12.9105 18.9302 12.666 18.0001 12.666C17.07 12.666 16.2081 12.9105 15.4145 13.3993C14.6465 13.8705 14.0364 14.506 13.5841 15.306C13.1148 16.1327 12.8801 17.0305 12.8801 17.9993C12.8801 18.9682 13.1148 19.866 13.5841 20.6927C14.0364 21.4927 14.6465 22.1282 15.4145 22.5993C16.2081 23.0882 17.07 23.3327 18.0001 23.3327ZM17.1169 15.6127L20.2401 17.7727C20.2998 17.8171 20.3361 17.8749 20.3489 17.946C20.3617 18.0171 20.351 18.0838 20.3169 18.146C20.2913 18.1727 20.2657 18.1993 20.2401 18.226L17.1169 20.386C17.0572 20.4305 16.9932 20.446 16.9249 20.4327C16.8566 20.4193 16.8012 20.3816 16.7585 20.3193C16.7329 20.2749 16.7201 20.226 16.7201 20.1727V15.826C16.7201 15.7549 16.7457 15.6927 16.7969 15.6393C16.8481 15.586 16.9078 15.5593 16.9761 15.5593C17.0273 15.5593 17.0742 15.5771 17.1169 15.6127Z" fill="#0D9488" />
    </svg>
  ),
  downgraded: (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
      <path d="M0 18C0 8.05888 8.05888 0 18 0C27.9411 0 36 8.05888 36 18C36 27.9411 27.9411 36 18 36C8.05888 36 0 27.9411 0 18Z" fill="#FFFBEB" />
      <path d="M18.0001 11.3327C18.8705 11.3327 19.7025 11.506 20.4961 11.8527C21.2556 12.1905 21.9318 12.6682 22.5249 13.286C23.118 13.9038 23.5766 14.6082 23.9009 15.3993C24.2337 16.226 24.4001 17.0927 24.4001 17.9993C24.4001 18.906 24.2337 19.7727 23.9009 20.5993C23.5766 21.3905 23.118 22.0949 22.5249 22.7127C21.9318 23.3305 21.2556 23.8082 20.4961 24.146C19.7025 24.4927 18.8705 24.666 18.0001 24.666C17.1297 24.666 16.2977 24.4927 15.5041 24.146C14.7446 23.8082 14.0684 23.3305 13.4753 22.7127C12.8822 22.0949 12.4236 21.3905 12.0993 20.5993C11.7665 19.7727 11.6001 18.906 11.6001 17.9993C11.6001 17.0927 11.7665 16.226 12.0993 15.3993C12.4236 14.6082 12.8822 13.9038 13.4753 13.286C14.0684 12.6682 14.7446 12.1905 15.5041 11.8527C16.2977 11.506 17.1297 11.3327 18.0001 11.3327ZM18.0001 23.3327C18.9302 23.3327 19.7921 23.0882 20.5857 22.5993C21.3537 22.1282 21.9638 21.4927 22.4161 20.6927C22.8854 19.866 23.1201 18.9682 23.1201 17.9993C23.1201 17.0305 22.8854 18.1327 22.4161 17.306C21.9638 14.506 21.3537 13.8705 20.5857 13.3993C19.7921 12.9105 18.9302 12.666 18.0001 12.666C17.07 12.666 16.2081 12.9105 15.4145 13.3993C14.6465 13.8705 14.0364 14.506 13.5841 15.306C13.1148 16.1327 12.8801 17.0305 12.8801 17.9993C12.8801 18.9682 13.1148 19.866 13.5841 20.6927C14.0364 21.4927 14.6465 22.1282 15.4145 22.5993C16.2081 23.0882 17.07 23.3327 18.0001 23.3327ZM18.6401 17.9993H20.5601L18.0001 20.666L15.4401 17.9993H17.3601V13.3327H18.6401V17.9993Z" fill="#D97706" />
    </svg>
  ),
};

const ShimmerLoader = () => (
  <div className="divide-y divide-gray-50 animate-pulse">
    {[1, 2, 3, 4, 5].map(i => (
      <div key={i} className="p-4 sm:px-6 sm:py-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex items-start gap-4 flex-1">
          <div className="w-9 h-9 bg-gray-100 rounded-full shrink-0"></div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-5 w-24 bg-gray-200 rounded-full"></div>
              <div className="h-5 w-32 bg-gray-100 rounded"></div>
            </div>
            <div className="flex gap-4">
              <div className="h-4 w-20 bg-gray-50 rounded"></div>
              <div className="h-4 w-32 bg-gray-50 rounded"></div>
            </div>
          </div>
        </div>
        <div className="hidden lg:block h-4 w-32 bg-gray-50 rounded"></div>
      </div>
    ))}
  </div>
);

export default function ActivityLogs() {
  const dispatch = useAppDispatch();
  const { logs, total, page, totalPages, loading, error } = useAppSelector((state) => state.adminSubscriptionActivityLogs);
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All Events');
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebounce(search, 400);

  useEffect(() => {
    if (!showFilters) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setShowFilters(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showFilters]);

  const axiosInstance = require('@/src/utils/hooks/axios').default;

  const lastFetchedParams = useRef<string | null>(null);

  useEffect(() => {
    const searchValue = debouncedSearch.trim();

    const params: any = {
      page: 1,
      search: searchValue,
    };

    if (activeFilter !== 'All Events') {
      params.event_type = activeFilter;
    }

    const paramStr = JSON.stringify(params);
    if (lastFetchedParams.current === paramStr) return;
    lastFetchedParams.current = paramStr;

    dispatch(fetchSubscriptionActivityLogs(params));
  }, [dispatch, activeFilter, debouncedSearch]);

  const handleExport = async () => {
    try {
      setExporting(true);
      const exportParams: any = {
        search: search.trim(),
      };
      if (activeFilter !== 'All Events') {
        exportParams.event_type = activeFilter;
      }
      const response = await axiosInstance.get('/api/v2/admin/subscription-plans/activity-logs/export', {
        responseType: 'blob',
        params: exportParams
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `subscription_activity_logs_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export activity logs.');
    } finally {
      setExporting(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      const filter = activeFilter === 'All Events' ? '' : activeFilter;
      const params: any = { page: newPage, search: debouncedSearch.trim() };
      if (filter) {
        params.event_type = filter;
      }
      lastFetchedParams.current = JSON.stringify(params);
      dispatch(fetchSubscriptionActivityLogs(params));
    }
  };

  const getLogMeta = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('create')) return { iconKey: 'created', color: 'text-[#16A34A]', bgColor: 'bg-[#F0FDF4]' };
    if (t.includes('upgrade')) return { iconKey: 'upgraded', color: 'text-[#2563EB]', bgColor: 'bg-[#EFF6FF]' };
    if (t.includes('cancel')) return { iconKey: 'cancelled', color: 'text-[#DC2626]', bgColor: 'bg-[#FEF2F2]' };
    if (t.includes('pause')) return { iconKey: 'paused', color: 'text-[#EA580C]', bgColor: 'bg-[#FFF7ED]' };
    if (t.includes('resume')) return { iconKey: 'resumed', color: 'text-[#0D9488]', bgColor: 'bg-[#F0FDFA]' };
    if (t.includes('downgrade')) return { iconKey: 'downgraded', color: 'text-[#D97706]', bgColor: 'bg-[#FFFBEB]' };
    return { iconKey: 'created', color: 'text-gray-500', bgColor: 'bg-gray-100' };
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'America/Chicago',
      }).replace(',', ' —');
    } catch {
      return dateStr;
    }
  };

  const filterOptions = ['All Events', 'Subscription Created', 'Subscription Upgraded', 'Subscription Downgraded', 'Subscription Cancelled'];

  return (
    <div className="w-full space-y-4 sm:space-y-6 pb-12 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-2 px-1">
        <div className="w-full sm:w-auto">
          <h1 className="text-xl sm:text-[22px] font-bold text-[#111827] mb-0.5">Subscription Activity Logs</h1>
          <p className="text-sm text-gray-400 font-medium leading-relaxed">Lifecycle events for all subscription actions across the platform.</p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#2F68C5] hover:bg-[#2556A3] text-white px-6 py-2.5 rounded-full text-sm font-bold shadow-md transition-all active:scale-95 group disabled:opacity-70 disabled:pointer-events-none"
        >
          {exporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
          {exporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      <div className="bg-white rounded-[16px] sm:rounded-[24px] border border-[#E5E7EB] shadow-[0px_1px_2px_rgba(0,0,0,0.05)]">
        <div className="p-4 sm:p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 border-b border-gray-50 bg-white rounded-t-[16px] sm:rounded-t-[24px]">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
            <input
              type="text"
              placeholder="Search retailers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 p-2 pl-11 pr-4 bg-white border border-[#E5E7EB] rounded-[12px] sm:rounded-[14px] text-sm focus:outline-none focus:border-[#2F68C5] transition-all font-medium text-[#111827] placeholder:text-[#9CA3AF]"
            />
          </div>

          <div className="relative w-full sm:w-auto" ref={filterDropdownRef}>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="w-full sm:min-w-[170px] h-10 px-4 bg-white border border-[#E5E7EB] rounded-[12px] sm:rounded-[14px] flex items-center justify-between text-sm font-semibold text-[#374151] hover:border-[#2F68C5] transition-all"
            >
              <span>{activeFilter}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`} />
            </button>

            {showFilters && (
              <div className="absolute right-0 top-[calc(100%+8px)] w-full min-w-[220px] bg-white border border-[#E5E7EB] rounded-[16px] shadow-2xl py-2 z-[70] animate-in slide-in-from-top-2 duration-200">
                <div className="px-4 py-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Filter Events</div>
                <div className="max-h-[220px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200">
                  {filterOptions.map((option) => (
                    <button
                      key={option}
                      onClick={() => {
                        setActiveFilter(option);
                        setShowFilters(false);
                      }}
                      className={`w-full text-left px-5 py-2.5 text-sm font-medium transition-colors ${activeFilter === option ? 'bg-[#F3F4F6] text-[#111827] font-bold' : 'text-[#6B7280] hover:bg-gray-50 hover:text-[#111827] text-nowrap'
                        }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="divide-y divide-gray-50">
          {loading && logs.length === 0 ? (
            <ShimmerLoader />
          ) : error ? (
            <div className="p-12 text-center">
              <p className="text-red-500 font-medium mb-4">{error}</p>
              <button
                onClick={() => {
                  const params: any = { page: 1, search: debouncedSearch.trim() };
                  if (activeFilter !== 'All Events') {
                    params.event_type = activeFilter;
                  }
                  dispatch(fetchSubscriptionActivityLogs(params));
                }}
                className="flex items-center gap-2 mx-auto text-xs font-bold text-[#2C62B9] underline uppercase tracking-widest"
              >
                <RefreshCw className="w-3 h-3" /> Retry
              </button>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center text-gray-400 border-none">
              No activity logs found.
            </div>
          ) : (
            logs.map((log) => {
              const meta = getLogMeta(log.event_type);
              const performedBy = log.triggered_by_name || log.triggered_by;
              const planDisplay = log.old_plan_name
                ? `${log.old_plan_name} → ${log.plan_name}`
                : log.plan_name;

              return (
                <div key={log.id} className="p-4 sm:px-6 sm:py-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors group">
                  <div className="flex items-start gap-3 sm:gap-4 flex-1">
                    <div className="shrink-0 mt-0.5 sm:mt-0">
                      {icons[meta.iconKey as keyof typeof icons]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] sm:text-xs font-semibold whitespace-nowrap ${meta.bgColor} ${meta.color}`}>
                          {log.event_type}
                        </span>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium text-[#111827] truncate">{log.retailer_name}</span>
                          <span className="text-[10px] sm:text-xs font-normal text-[#9CA3AF] tracking-tight shrink-0">{log.retailer_id_str}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] sm:text-xs mt-1.5 ml-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[#6B7280] font-normal">Plan:</span>
                          <span className="text-[#374151] font-semibold">{planDisplay}</span>
                        </div>
                        <div className="flex items-center gap-1.5 pl-0 sm:pl-3 border-l-0 sm:border-l border-gray-200">
                          <span className="text-[#6B7280] font-normal">By:</span>
                          <span className="text-[#374151] font-semibold capitalize">{performedBy}</span>
                        </div>
                        <div className="lg:hidden flex items-center gap-1.5 pl-0 border-l-0 text-[#9CA3AF] font-normal italic">
                          {formatDate(log.created_at)}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="hidden lg:block text-xs font-normal text-[#9CA3AF] text-right whitespace-nowrap min-w-[140px]">
                    {formatDate(log.created_at)}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          totalItems={total}
          itemsPerPage={10}
        />
      </div>
    </div>
  );
}
