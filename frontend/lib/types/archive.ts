/**
 * Shared types for archived requests / versions.
 *
 * These types describe records that live in client localStorage today
 * (see `lib/storage.ts`) and that will move to the backend once the
 * archive API is implemented.
 */

export interface ArchivedRequest {
  id: string;
  type: string;
  customer: string;
  date: string;
  reason: string;
}

export interface ArchivedVersion {
  id: string;
  label: string;
  date: string;
  image: string;
}
