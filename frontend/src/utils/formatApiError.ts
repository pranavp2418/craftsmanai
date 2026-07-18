export default function formatApiError(error: any): string {
  if (!error) return 'Unknown error';

  const res = error.response?.data ?? error.response?.data?.detail ?? error;

  // If detail is an array of validation errors
  const detail = error.response?.data?.detail ?? error.response?.data?.errors;
  if (Array.isArray(detail)) {
    try {
      return detail
        .map((d: any) => {
          if (typeof d === 'string') return d;
          if (d?.msg) return d.msg;
          if (Array.isArray(d?.loc) && d.loc.length > 0) return `${String(d.loc.join('.'))}: ${d.msg ?? JSON.stringify(d)}`;
          return JSON.stringify(d);
        })
        .join('; ');
    } catch (e) {
      // fallthrough
    }
  }

  if (res?.message) return String(res.message);
  if (res?.notification_message) return String(res.notification_message);
  if (res?.detail && typeof res.detail === 'string') return String(res.detail);
  if (typeof res === 'string') return res;
  if (error.message) return String(error.message);

  return JSON.stringify(res);
}
