'use client';

import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import SubmitQuoteModal from './SubmitQuoteModal';
import QuoteSuccessModal from './QuoteSuccessModal';

interface QuoteFormProps {
  productImage: string;
  title: string;
  requestSku: string;
  companyName: string;
  lastUpdated: string;
  isNew?: boolean;
  requestId: string;
  manufacturerId: string;
  renderId: string;
  brandPrimaryColor?: string;
  onCancel: () => void;
  onSubmit: (data: QuoteData) => Promise<boolean>;
  refetchAfterSubmit: () => void;
}

interface QuoteData {
  manufacturingCost: string;
  estimatedTime: string;
  timeUnit: string;
  comments: string;
}

type QuoteErrors = Partial<Record<'manufacturingCost' | 'estimatedTime' | 'comments', string>>;

const MAX_PRODUCTION_NOTES_CHARS = 500;

const countCharacters = (value: string): number => value.length;
const limitCharacters = (value: string, maxChars: number): string => value.slice(0, maxChars);

export default function QuoteForm({
  productImage,
  title,
  requestSku,
  companyName,
  lastUpdated,
  isNew = false,
  requestId: _requestId,
  manufacturerId: _manufacturerId,
  renderId: _renderId,
  brandPrimaryColor = '#3B82F6',
  onCancel,
  onSubmit,
  refetchAfterSubmit,
}: QuoteFormProps) {
  const [formData, setFormData] = useState<QuoteData>({
    manufacturingCost: '',
    estimatedTime: '',
    timeUnit: 'Days',
    comments: '',
  });
  const [errors, setErrors] = useState<QuoteErrors>({});
  const [showModal, setShowModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  const commentCharacterCount = countCharacters(formData.comments);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const nextErrors: QuoteErrors = {};
    const cost = Number(formData.manufacturingCost);
    const time = Number(formData.estimatedTime);
    const comments = formData.comments.trim();

    if (!formData.manufacturingCost || !cost || cost < 0) {
      nextErrors.manufacturingCost = 'Please enter a valid manufacturing cost';
    }

    if (!formData.estimatedTime || !time || time <= 0) {
      nextErrors.estimatedTime = 'Please enter a valid production time';
    }



    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setShowModal(true);
  };

  const handleConfirmSubmit = async () => {
    setSubmitLoading(true);
    const sanitizedFormData = {
      ...formData,
      comments: limitCharacters(formData.comments, MAX_PRODUCTION_NOTES_CHARS),
    };
    const isSuccess = await onSubmit(sanitizedFormData);
    setSubmitLoading(false);

    if (isSuccess) {
      setShowModal(false);
      setShowSuccessModal(true);
      toast.success('Quote submitted successfully!');
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  const handleCommentsChange = (value: string) => {
    setFormData((currentData) => ({
      ...currentData,
      comments: limitCharacters(value, MAX_PRODUCTION_NOTES_CHARS),
    }));
    setErrors((currentErrors) => ({ ...currentErrors, comments: '' }));
  };

  const handleCommentsPaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    event.preventDefault();

    const pastedText = event.clipboardData.getData('text');
    const currentValue = formData.comments;

    const start = event.currentTarget.selectionStart ?? currentValue.length;
    const end = event.currentTarget.selectionEnd ?? currentValue.length;

    const nextValue = currentValue.slice(0, start) + pastedText + currentValue.slice(end);

    setFormData((currentData) => ({
      ...currentData,
      comments: limitCharacters(nextValue, MAX_PRODUCTION_NOTES_CHARS),
    }));
    setErrors((currentErrors) => ({ ...currentErrors, comments: '' }));
  };

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 mt-16 z-[9999]">
      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5 md:space-y-6">
        {/* Product Header Card */}
        <div className="bg-white rounded-xl md:rounded-2xl p-4 sm:p-5 md:p-6 shadow-[0px_4px_12px_0px_rgba(0,0,0,0.08)] mb-4 sm:mb-5 md:mb-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4 sm:gap-5 md:gap-6">
              <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-gray-100 rounded-lg sm:rounded-xl shrink-0 overflow-hidden">
                <img src={productImage} alt={title} className="w-full h-full object-cover" />
              </div>

              <div className="flex-1 min-w-64">
                <h2 className="text-lg sm:text-xl flex justify-between md:text-2xl font-semibold text-gray-900 mb-1 sm:mb-2">
                  {title} {isNew && (
                <div className=" md:hidden  self-end px-3 py-1 bg-amber-100 text-amber-700 text-xs sm:text-sm font-medium rounded-full shrink-0">
                  New
                </div>
              )}
                </h2>
                <div className="space-y-0.5 sm:space-y-1">
                  <p className="text-xs sm:text-sm text-gray-600">{requestSku}</p>
                  <p className="text-xs sm:text-sm text-gray-600">{companyName}</p>
                  <p className="text-xs sm:text-sm text-gray-600">
                    <span className="font-semibold">Last Updated:</span> {lastUpdated}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex w-full flex-col items-end gap-4 md:justify-end md:min-w-[18rem] md:gap-7">
              {isNew && (
                <div className="hidden md:block  self-end px-3 py-1 bg-amber-100 text-amber-700 text-xs sm:text-sm font-medium rounded-full shrink-0">
                  New
                </div>
              )}

              <div className="flex w-full flex-col-reverse gap-3 sm:w-auto sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={onCancel}
                  className="w-full min-w-0 cursor-pointer rounded-full border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-black/5 sm:w-auto sm:min-w-[7.5rem] sm:px-6 sm:py-3 sm:text-base"
                  style={{ borderColor: brandPrimaryColor, color: brandPrimaryColor }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-full min-w-0 cursor-pointer rounded-full px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 sm:w-auto sm:min-w-[9rem] sm:px-6 sm:py-3 sm:text-base"
                  style={{ backgroundColor: brandPrimaryColor }}
                >
                  Submit Quote
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Price & Feasibility and Lead Time Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
          <div className="bg-white rounded-xl md:rounded-2xl p-4 sm:p-5 md:p-6 shadow-[0px_4px_12px_0px_rgba(0,0,0,0.08)]">
            <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-4 sm:mb-5">
              Price & Feasibility
            </h3>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                Manufacturing Cost<span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-gray-800 text-sm sm:text-base">
                  $
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={formData.manufacturingCost}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (/^\d*\.?\d*$/.test(value)) {
                      setFormData({
                        ...formData,
                        manufacturingCost: value,
                      });
                      setErrors((currentErrors) => ({ ...currentErrors, manufacturingCost: '' }));
                    }
                  }}
                  placeholder="0.00"
                  className={`w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-2.5 sm:py-3 bg-white dark:bg-white border rounded-lg sm:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-gray-900 text-sm sm:text-base placeholder:text-gray-400 dark:placeholder:text-gray-400 ${
                    errors.manufacturingCost ? 'border-red-500' : 'border-gray-200 dark:border-gray-200'
                  }`}
                  required
                />
              </div>
              {errors.manufacturingCost && (
                <p className="mt-2 text-xs text-red-600">{errors.manufacturingCost}</p>
              )}
              <p className="text-xs text-gray-500 mt-2">
                Enter the cost at which this job can be manufactured.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl md:rounded-2xl p-4 sm:p-5 md:p-6 shadow-[0px_4px_12px_0px_rgba(0,0,0,0.08)]">
            <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-4 sm:mb-5">
              Lead Time
            </h3>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                Estimated Production Time<span className="text-red-500">*</span>
              </label>
              <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                <input
                  type="number"
                  min="1"
                  value={formData.estimatedTime}
                  onKeyDown={(e) => {
                    if (['e', 'E', '+', '-'].includes(e.key)) {
                      e.preventDefault();
                    }
                  }}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value.length <= 3) {
                      setFormData({
                        ...formData,
                        estimatedTime: value,
                      });
                      setErrors((currentErrors) => ({ ...currentErrors, estimatedTime: '' }));
                    }
                  }}
                  placeholder="0"
                  className={`w-full min-w-0 flex-1 px-3 sm:px-4 py-2.5 sm:py-3 bg-white dark:bg-white border rounded-lg sm:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-gray-900 text-sm sm:text-base placeholder:text-gray-400 dark:placeholder:text-gray-400 ${
                    errors.estimatedTime ? 'border-red-500' : 'border-gray-200 dark:border-gray-200'
                  }`}
                  required
                />
                <select
                  value={formData.timeUnit}
                  onChange={(e) =>
                    setFormData({ ...formData, timeUnit: e.target.value })
                  }
                  className="w-full sm:w-auto sm:min-w-[6rem] px-3 sm:px-4 py-2.5 sm:py-3 bg-white dark:bg-white border border-gray-200 dark:border-gray-200 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-gray-900 text-sm sm:text-base cursor-pointer"
                >
                  <option>Days</option>
                  <option>Weeks</option>
                  <option>Months</option>
                </select>
              </div>
              {errors.estimatedTime && (
                <p className="mt-2 text-xs text-red-600">{errors.estimatedTime}</p>
              )}
              <p className="text-xs text-gray-500 mt-2">
                Estimated time to complete manufacturing.
              </p>
            </div>
          </div>
        </div>

        {/* Production Notes */}
        <div className="bg-white rounded-xl md:rounded-2xl p-4 sm:p-5 md:p-6 shadow-[0px_4px_12px_0px_rgba(0,0,0,0.08)]">
          <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-4 sm:mb-5">
            Production Notes
          </h3>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
              Comments
            </label>
            <textarea
              value={formData.comments}
              onChange={(e) => handleCommentsChange(e.target.value)}
              onPaste={handleCommentsPaste}
              maxLength={MAX_PRODUCTION_NOTES_CHARS}
              placeholder="Confirm feasibility and include any important production notes. Mention the cost confirmation here."
              rows={5}
              className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white dark:bg-white border rounded-lg sm:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-gray-900 text-sm sm:text-base placeholder:text-gray-400 dark:placeholder:text-gray-400 resize-none ${
                errors.comments ? 'border-red-500' : 'border-gray-200 dark:border-gray-200'
              }`}
            />
            {errors.comments && (
              <p className="mt-2 text-xs text-red-600">{errors.comments}</p>
            )}
            <div className="mt-2 flex items-center justify-between gap-3 text-xs text-gray-500">
              <p>Optional: Confirm feasibility and provide production details.</p>
              <p
                className={`${
                  commentCharacterCount >= MAX_PRODUCTION_NOTES_CHARS
                    ? 'text-red-500 font-medium'
                    : 'text-gray-500'
                }`}
              >
                {commentCharacterCount}/{MAX_PRODUCTION_NOTES_CHARS} characters
              </p>
            </div>
          </div>
        </div>

        {/* Important Notice */}
        <div className="bg-white border-none rounded-xl md:rounded-2xl p-4 sm:p-5 flex gap-3 sm:gap-4">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm sm:text-base font-medium text-amber-900 mb-1">
              Important Notice
            </h4>
            <p className="text-xs sm:text-sm text-amber-800">
              Once submitted, this quote cannot be edited. Please review all details carefully before submitting.
            </p>
          </div>
        </div>
      </form>

      {/* Submit Quote Confirmation Modal */}
      {showModal && (
        <SubmitQuoteModal
          isOpen={showModal}
          productName={title}
          jobId={requestSku}
          retailer={companyName}
          price={`$${formData.manufacturingCost}`}
          leadTime={`${formData.estimatedTime} ${formData.timeUnit}`}
          loading={submitLoading}
          brandPrimaryColor={brandPrimaryColor}
          onConfirm={handleConfirmSubmit}
          onClose={handleCloseModal}
        />
      )}

      {/* Quote Success Modal */}
      {showSuccessModal && (
        <QuoteSuccessModal
          isOpen={showSuccessModal}
          brandPrimaryColor={brandPrimaryColor}
          onClose={() => {
            refetchAfterSubmit();
            setShowSuccessModal(false);
          }}
        />
      )}
    </div>
  );
}
