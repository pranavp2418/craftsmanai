import React, { useEffect, useState } from 'react';
import { X, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { createRetailer, resetCreateRetailer } from '@/redux/slices/admin/retailers/adminCreateRetailerSlice';
import CountryCodeSelect from '@/src/utils/components/CountryCodeSelect';
import { getPhoneMaxLength, isValidEmail, sanitizePhoneDigits } from '@/lib/formValidation';

interface AddRetailerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export interface RetailerFormData {
  email: string;
  name: string;
  contactNumber: string;
  password: string;
  confirmPassword: string;
  status: 'active' | 'disabled';
  countryCode: string;
}

const AddRetailerModal: React.FC<AddRetailerModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const dispatch = useAppDispatch();
  const { loading: submitting, error: submitError } = useAppSelector((s) => s.adminCreateRetailer);
  const [formData, setFormData] = useState<RetailerFormData>({
    email: '',
    name: '',
    contactNumber: '',
    password: '',
    confirmPassword: '',
    status: 'active',
    countryCode: '+1',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof RetailerFormData, string>>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (submitError) {
      toast.error(submitError, { toastId: 'create-retailer-error' });
    }
  }, [submitError]);

  if (!isOpen) return null;

  const generatePassword = () => {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    setFormData({ ...formData, password, confirmPassword: password });
    setErrors((prev) => ({ ...prev, password: undefined, confirmPassword: undefined }));
  };

  const validate = () => {
    const nextErrors: Partial<Record<keyof RetailerFormData, string>> = {};
    const emailValue = formData.email.trim();
    const nameValue = formData.name.trim();
    const phoneValue = formData.contactNumber.trim();

    if (!isValidEmail(emailValue)) {
      nextErrors.email = 'Enter a valid email address';
    }
    if (!nameValue) {
      nextErrors.name = 'Name is required';
    }
    const maxLen = getPhoneMaxLength(formData.countryCode);
    if (phoneValue.length < 6 || phoneValue.length > maxLen) {
      nextErrors.contactNumber = `Enter a valid phone number for ${formData.countryCode}`;
    }
    if (formData.password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters';
    }
    if (formData.password !== formData.confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const result = await dispatch(
      createRetailer({
        email: formData.email.trim(),
        name: formData.name.trim(),
        phone: `${formData.countryCode}${formData.contactNumber.trim()}`,
        password: formData.password,
        status: formData.status === 'active' ? 'ACTIVE' : 'INACTIVE',
      })
    );
    if (createRetailer.fulfilled.match(result)) {
      toast.success('Retailer created successfully.', { toastId: 'create-retailer-success' });
      dispatch(resetCreateRetailer());
      setFormData({ email: '', name: '', contactNumber: '', password: '', confirmPassword: '', status: 'active', countryCode: '+1' });
      setErrors({});
      onSuccess();
      onClose();
    }
  };

  const handleCancel = () => {
    dispatch(resetCreateRetailer());
    setFormData({
      email: '',
      name: '',
      contactNumber: '',
      password: '',
      confirmPassword: '',
      status: 'active',
      countryCode: '+1',
    });
    setErrors({});
    onClose();
  };

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-2 sm:p-4 z-[999]">
      <div
        className="absolute inset-0 bg-[#00000080] backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <div 
        className="bg-[#FFFFFF] rounded-xl sm:rounded-2xl w-full relative max-w-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col shadow-[0px_20px_25px_-5px_#0000001A,0px_8px_10px_-6px_#0000001A]"
      >
        {/* Header - Fixed */}
        <div className="flex items-start justify-between p-4 sm:p-6 border-b border-gray-200 shrink-0">
          <div>
            <h2 className="text-[16px] sm:text-[20px] font-bold text-[#111827]">Add New Retailer</h2>
            <p className="text-[12px] sm:text-[14px] text-[#515151] mt-0.5 sm:mt-1">Create a new retailer account</p>
          </div>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Form - Scrollable Content */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 space-y-4 sm:space-y-5">
            {/* Email Address */}
            <div>
              <label className="block text-[12px] sm:text-[14px] font-normal mb-1.5 sm:mb-2 text-[#374151]">
                Email Address<span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value });
                  setErrors((prev) => ({ ...prev, email: undefined }));
                }}
                placeholder="Enter email address"
                className={`w-full px-3 py-2 sm:px-4 sm:py-2.5 bg-[#F9F9F9] border ${errors.email ? 'border-red-400 focus:ring-red-500' : 'border-[#F1F1F1] focus:ring-blue-500'} rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-[#1F2937] placeholder:text-[#8A8A8A] text-[11px] sm:text-[13px]`}
                required
              />
              {errors.email && <p className="text-[11px] sm:text-xs text-red-500 mt-1">{errors.email}</p>}
            </div>

            {/* Retailer Name */}
            <div>
              <label className="block text-[12px] sm:text-[14px] font-normal mb-1.5 sm:mb-2 text-[#374151]">
                Retailer Name<span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  setErrors((prev) => ({ ...prev, name: undefined }));
                }}
                placeholder="Enter retailer/business name"
                className={`w-full px-3 py-2 sm:px-4 sm:py-2.5 bg-[#F9F9F9] border ${errors.name ? 'border-red-400 focus:ring-red-500' : 'border-[#F1F1F1] focus:ring-blue-500'} rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-[#1F2937] placeholder:text-[#8A8A8A] text-[11px] sm:text-[13px]`}
                required
              />
              {errors.name && <p className="text-[11px] sm:text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>

            {/* Contact Number */}
            <div>
              <label className="block text-[12px] sm:text-[14px] font-normal mb-1.5 sm:mb-2 text-[#374151]">
                Contact Number<span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2 sm:gap-3">
                <CountryCodeSelect
                  value={formData.countryCode}
                  onChange={(code) => {
                    const maxLen = getPhoneMaxLength(code);
                    setFormData((prev) => ({ ...prev, countryCode: code, contactNumber: sanitizePhoneDigits(prev.contactNumber, maxLen) }));
                  }}
                  className="min-w-[98px] sm:min-w-[120px]"
                />
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={getPhoneMaxLength(formData.countryCode)}
                  value={formData.contactNumber}
                  onChange={(e) => {
                    const value = sanitizePhoneDigits(e.target.value, getPhoneMaxLength(formData.countryCode));
                    setFormData({ ...formData, contactNumber: value });
                    setErrors((prev) => ({ ...prev, contactNumber: undefined }));
                  }}
                  placeholder="10-digit number"
                  className={`w-full px-3 py-2 sm:px-4 sm:py-2.5 bg-[#F9F9F9] border ${errors.contactNumber ? 'border-red-400 focus:ring-red-500' : 'border-[#F1F1F1] focus:ring-blue-500'} rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-[#1F2937] placeholder:text-[#8A8A8A] text-[11px] sm:text-[13px]`}
                  required
                />
              </div>
              {errors.contactNumber && <p className="text-[11px] sm:text-xs text-red-500 mt-1">{errors.contactNumber}</p>}
            </div>

            {/* Login Credentials Section */}
            <div className="pt-3 sm:pt-4">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h3 className="text-[12px] sm:text-[14px] font-medium text-[#1E1E1E]">Login Credentials</h3>
                <button
                  type="button"
                  onClick={generatePassword}
                  className="flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-sm font-medium text-[#2F68C5] hover:text-[#2558A8] transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Generate Password</span>
                  <span className="sm:hidden">Generate</span>
                </button>
              </div>

              {/* Password */}
              <div className="mb-4 sm:mb-5">
                <label className="block text-[12px] sm:text-[14px] font-normal mb-1.5 sm:mb-2 text-[#374151]">
                  Password<span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => {
                      setFormData({ ...formData, password: e.target.value });
                      setErrors((prev) => ({ ...prev, password: undefined }));
                    }}
                    placeholder="Enter password"
                    className={`w-full px-3 py-2 sm:px-4 sm:py-2.5 bg-[#F9F9F9] border ${errors.password ? 'border-red-400 focus:ring-red-500' : 'border-[#F1F1F1] focus:ring-blue-500'} rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-[#1F2937] pr-9 sm:pr-10 placeholder:text-[#8A8A8A] text-[11px] sm:text-[13px]`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4 sm:w-4.5 sm:h-4.5" /> : <Eye className="w-4 h-4 sm:w-4.5 sm:h-4.5" />}
                  </button>
                </div>
                {errors.password && <p className="text-[11px] sm:text-xs text-red-500 mt-1">{errors.password}</p>}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-[12px] sm:text-[14px] font-normal mb-1.5 sm:mb-2 text-[#374151]">
                  Confirm Password<span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) => {
                      setFormData({ ...formData, confirmPassword: e.target.value });
                      setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                    }}
                    placeholder="Re-enter password"
                    className={`w-full px-3 py-2 sm:px-4 sm:py-2.5 bg-[#F9F9F9] border ${errors.confirmPassword ? 'border-red-400 focus:ring-red-500' : 'border-[#F1F1F1] focus:ring-blue-500'} rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-[#1F2937] pr-9 sm:pr-10 placeholder:text-[#8A8A8A] text-[11px] sm:text-[13px]`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4 sm:w-4.5 sm:h-4.5" /> : <Eye className="w-4 h-4 sm:w-4.5 sm:h-4.5" />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="text-[11px] sm:text-xs text-red-500 mt-1">{errors.confirmPassword}</p>}
              </div>
            </div>

            {/* Account Status */}
            <div className="pt-3 sm:pt-4">
              <h3 className="text-[12px] sm:text-[14px] font-medium text-[#1E1E1E] mb-3 sm:mb-4">Account Status</h3>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-6">
                <label className="flex items-center gap-2 sm:gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    value="active"
                    checked={formData.status === 'active'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'disabled' })}
                    className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 focus:ring-blue-500 shrink-0"
                  />
                  <span className="text-[11px] sm:text-sm font-medium text-[#1F2937]">Active</span>
                  <span className="px-2 py-0.5 sm:px-2.5 bg-[#DCFCE7] text-[#16A34A] text-[10px] sm:text-xs font-medium rounded-full">
                    Can access portal
                  </span>
                </label>
                <label className="flex items-center gap-2 sm:gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    value="disabled"
                    checked={formData.status === 'disabled'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'disabled' })}
                    className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 focus:ring-blue-500 shrink-0"
                  />
                  <span className="text-[11px] sm:text-sm font-medium text-[#1F2937]">Disabled</span>
                  <span className="px-2 py-0.5 sm:px-2.5 bg-[#F3F4F6] text-[#6B7280] text-[10px] sm:text-xs font-medium rounded-full">
                    No access
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Buttons - Fixed Footer */}
          <div className="flex flex-col gap-2 px-4 py-3 sm:px-6 sm:py-4 border-t border-gray-200 shrink-0 bg-white rounded-b-xl sm:rounded-b-2xl">
            {/* API error */}
            {submitError && (
              <p className="text-xs text-red-500 text-center">{submitError}</p>
            )}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={handleCancel}
                disabled={submitting}
                className="flex-1 px-4 py-2.5 sm:px-5 sm:py-3 bg-[#EBF3FE] text-[#2F68C5] text-[12px] sm:text-[14px] font-medium rounded-lg sm:rounded-full tracking-wide hover:bg-[#DBE9FD] transition-colors disabled:opacity-50"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-4 py-2.5 sm:px-5 sm:py-3 bg-[#2C62B9] text-white text-[12px] sm:text-[14px] font-medium rounded-lg sm:rounded-full tracking-wide hover:bg-[#1D4ED8] transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {submitting && (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                {submitting ? 'Creating...' : 'Create Retailer'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddRetailerModal;
