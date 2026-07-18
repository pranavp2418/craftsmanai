export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const COUNTRY_PHONE_MAX_LENGTHS: Record<string, number> = {
  '+91': 10,
  '+1': 10,
  '+44': 10,
  '+971': 9,
  '+61': 9,
  '+966': 9,
  '+49': 11,
  '+33': 9,
  '+39': 10,
  '+81': 10,
  '+86': 11,
  '+7': 10,
  '+55': 11,
  '+27': 9,
};

export const DEFAULT_PHONE_LENGTH = 10;
export const PHONE_MIN_LENGTH = 6;
export const PHONE_MAX_LENGTH = 15;

export const sanitizePhoneDigits = (value: string, maxLength = DEFAULT_PHONE_LENGTH) =>
  value.replace(/\D/g, '').slice(0, maxLength);

export const getPhoneMaxLength = (countryCode: string) =>
  COUNTRY_PHONE_MAX_LENGTHS[countryCode] || DEFAULT_PHONE_LENGTH;

export const getPhoneLengthMessage = (countryCode: string) => {
  const length = getPhoneMaxLength(countryCode);
  return `Phone number for ${countryCode} must be exactly ${length} digits.`;
};

export const isValidEmail = (value: string) => EMAIL_REGEX.test(value.trim());

export const looksLikeEmail = (value: string) => EMAIL_REGEX.test(value.trim());

export const isValidPhoneDigits = (value: string, countryCode: string) => {
  const digits = value.trim().replace(/\D/g, '');
  const maxLength = getPhoneMaxLength(countryCode);
  return digits.length >= PHONE_MIN_LENGTH && digits.length <= maxLength;
};
