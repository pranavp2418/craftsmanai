'use client';

import { useState, useRef, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { refineDesign } from '@/redux/slices/retailer/designVariantRefineSlice';
import { fetchVariantsByDesignId } from '@/redux/slices/retailer/designVariantSlice';
import { toast } from 'react-toastify';

const styleTags = ['Minimal', 'Vintage', 'Modern', 'Luxury', 'Art Deco', 'Organic'];
const focusAreas = ['Shape', 'Stone', 'Detailing', 'Metal Finish', 'Size'];
const ALLOWED_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const isAllowedFileType = (file: File) => {
  if (ALLOWED_CONTENT_TYPES.includes(file.type)) return true;
  const extension = file.name.split('.').pop()?.toLowerCase();
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'heif'].includes(extension || '');
};

interface RefinePromptModalProps {
  originalPrompt: string;
  designId?: string | number | null;
  parentVariantId?: string | number | null;
  baseDesignImageUrl?: string | null;
  onClose: () => void;
  onSubmit: (prompt: string, newVariantId?: string | number) => void;
  isLocked?: boolean;
}

export default function RefinePromptModal({
  originalPrompt,
  designId: designIdProp,
  parentVariantId: parentVariantIdProp,
  baseDesignImageUrl: baseDesignImageUrlProp,
  onClose,
  onSubmit,
  isLocked = false,
}: RefinePromptModalProps) {
  const dispatch = useAppDispatch();
  const { variants: variantHistory } = useAppSelector((s) => s.retailerDesignVariant);

  // Find selected variant and design details
  const selectedVariant = variantHistory?.[0] ?? null;
  const resolvedDesignId = designIdProp ?? selectedVariant?.design_id ?? selectedVariant?.designId ?? null;
  const resolvedParentVariantId = parentVariantIdProp ?? selectedVariant?.id ?? null;
  const baseDesignImageUrl = baseDesignImageUrlProp ?? selectedVariant?.base_design_image_url ?? selectedVariant?.base_image_url ?? '';
  const modelUsed = selectedVariant?.model_used ?? 'gpt-image-1.5';

  // No word count helper needed, character length will be checked natively.

  // Editable refine textarea should start empty; the original prompt
  // is shown separately in a read-only view below.
  const [prompt, setPrompt] = useState<string>('');
  const [promptError, setPromptError] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [selectedFocus, setSelectedFocus] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    try {
      const items = e.clipboardData?.items;
      if (!items || items.length === 0) return;

      const images: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            if (!isAllowedFileType(file)) {
              toast.error('Only PNG, JPEG, GIF, WEBP, HEIC, and HEIF images are allowed.');
              continue;
            }
            if (file.size > MAX_FILE_SIZE) {
              toast.error('Image exceeds 10MB size limit.');
              continue;
            }
            images.push(file);
          }
        }
      }

      if (images.length === 0) return;

      const remainingSlots = 2 - uploadedFiles.length;
      if (remainingSlots <= 0) {
        toast.warning('You can upload a maximum of 2 reference images.');
        return;
      }

      const filesToAdd = images.slice(0, remainingSlots);
      const newFiles = [...uploadedFiles, ...filesToAdd];
      setUploadedFiles(newFiles);

      const newUrls = filesToAdd.map((f) => URL.createObjectURL(f));
      setPreviewUrls((prev) => [...prev, ...newUrls]);

      if (images.length > remainingSlots) {
        toast.warning('You can upload a maximum of 2 reference images.');
      }
    } catch (err) {
      console.error('[RefineDesign] paste handler error', err);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isLocked) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (isLocked) return;

    const files = Array.from(e.dataTransfer.files || []);
    if (files && files.length > 0) {
      const validFiles = files.filter((file) => {
        if (!isAllowedFileType(file)) {
          toast.error(`Invalid file type for "${file.name}". Only PNG, JPEG, GIF, WEBP, HEIC, and HEIF images are allowed.`);
          return false;
        }
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`"${file.name}" exceeds the 10MB size limit.`);
          return false;
        }
        return true;
      });

      if (validFiles.length === 0) return;

      const remainingSlots = 2 - uploadedFiles.length;
      if (remainingSlots <= 0) {
        toast.warning('You can upload a maximum of 2 reference images.');
        return;
      }

      const filesToAdd = validFiles.slice(0, remainingSlots);
      const newFiles = [...uploadedFiles, ...filesToAdd];
      setUploadedFiles(newFiles);

      const newUrls = filesToAdd.map((f) => URL.createObjectURL(f));
      setPreviewUrls((prev) => [...prev, ...newUrls]);

      if (validFiles.length > remainingSlots) {
        toast.warning('You can upload a maximum of 2 reference images.');
      }
    }
  };

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.setSelectionRange(prompt.length, prompt.length);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const urlsRef = useRef<string[]>([]);
  urlsRef.current = previewUrls;
  useEffect(() => {
    return () => {
      urlsRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch (e) { }
      });
    };
  }, []);

  const toggleStyle = (tag: string) => {
    setSelectedStyle((prev) => (prev === tag ? null : tag));
    setHasError(false);
    setSubmitError(null);
  };

  const handleSubmit = async () => {
    if (!prompt.trim() && uploadedFiles.length === 0) {
      toast.error('Please enter a prompt or attach reference images to refine the design.');
      inputRef.current?.focus();
      return;
    }

    if (!resolvedDesignId || !resolvedParentVariantId) {
      console.warn('[RefineDesign] Missing data for submit', {
        hasPrompt: Boolean(prompt.trim()),
        designId: resolvedDesignId,
        parentVariantId: resolvedParentVariantId,
      });
      toast.error('Unable to submit: missing design context. Please try again.');
      return;
    }
    setIsSubmitting(true);
    setHasError(false);
    setSubmitError(null);

    try {
      const payload = {
        designId: resolvedDesignId,
        prompt_used: prompt.trim(),
        model_used: modelUsed,
        base_design_image_url: baseDesignImageUrl,
        style_tags: selectedStyle || '',
        design_focus: selectedFocus || '',
        parent_variant_id: Number(resolvedParentVariantId),
        files: uploadedFiles,
      };

      console.info('[RefineDesign] Dispatching refineDesign', payload);

      const resultAction = await dispatch(refineDesign(payload));
      console.info('[RefineDesign] refineDesign result', resultAction);

      if (refineDesign.fulfilled.match(resultAction)) {
        const newVariantId =
          (resultAction.payload as any)?.id ??
          (resultAction.payload as any)?.data?.id ??
          (resultAction.payload as any)?.variant_id ??
          (resultAction.payload as any)?.variant?.id;

        if (resolvedDesignId && newVariantId) {
          try {
            localStorage.setItem(`refinement_generating_${resolvedDesignId}`, 'true');
            localStorage.setItem(`refinement_variant_id_${resolvedDesignId}`, String(newVariantId));
            sessionStorage.setItem(`refinement_generating_${resolvedDesignId}`, 'true');
            sessionStorage.setItem(`refinement_variant_id_${resolvedDesignId}`, String(newVariantId));
          } catch (e) {
            console.error('[RefineDesign] Failed to write refinement keys to storage:', e);
          }
        }

        // Refetch variants to sync the history & newly refined variant
        dispatch(fetchVariantsByDesignId({ designId: resolvedDesignId }));
        onSubmit(prompt.trim(), newVariantId);
        onClose();
      } else {
        setHasError(true);
        const errorMsg = (resultAction.payload as string) || 'Failed to refine design.';
        setSubmitError(errorMsg);
        toast.error(errorMsg);
      }
    } catch (err: any) {
      console.error('[RefineDesign] Refinement failed:', err);
      setHasError(true);
      const errorMsg = err?.message || 'Failed to refine design.';
      setSubmitError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;

    const validSelected = selected.filter((file) => {
      if (!isAllowedFileType(file)) {
        toast.error(`Invalid file type for "${file.name}". Only PNG, JPEG, GIF, WEBP, HEIC, and HEIF images are allowed.`);
        return false;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`"${file.name}" exceeds the 10MB size limit.`);
        return false;
      }
      return true;
    });

    if (validSelected.length === 0) {
      if (fileRef.current) fileRef.current.value = '';
      return;
    }

    const remainingSlots = 2 - uploadedFiles.length;
    if (validSelected.length > remainingSlots) {
      toast.warning('You can upload a maximum of 2 reference images.');
    }

    const filesToAdd = validSelected.slice(0, remainingSlots);
    if (filesToAdd.length === 0) {
      if (fileRef.current) fileRef.current.value = '';
      return;
    }

    const newFiles = [...uploadedFiles, ...filesToAdd];
    setUploadedFiles(newFiles);

    const newUrls = filesToAdd.map((f) => URL.createObjectURL(f));
    setPreviewUrls((prev) => [...prev, ...newUrls]);

    if (fileRef.current) fileRef.current.value = '';
  };

  const removeFile = (idx: number) => {
    try {
      URL.revokeObjectURL(previewUrls[idx]);
    } catch (e) { }
    setUploadedFiles((prev) => prev.filter((_, i) => i !== idx));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="rounded-[20px] mb-5 overflow-hidden bg-white dark:bg-[#1C1F28] shadow-[0_2px_12px_rgba(0,0,0,0.04),_0_0_1px_rgba(0,0,0,0.06)] border border-hairline">
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-hairline">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 flex items-center justify-center rounded-[10px] bg-[rgba(99,102,241,0.10)]">
            <i className="ri-sparkling-line text-[15px] text-[#6366F1]"></i>
          </div>
          <h3
            className="text-[15px] font-semibold text-[#1A1A1A] dark:text-ink font-satoshi"
          >
            Refine Design
          </h3>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#F3F4F6] dark:hover:bg-surface-150 transition-colors cursor-pointer"
        >
          <i className="ri-close-line text-[18px] text-[#9CA3AF] dark:text-[#A1A8B3]"></i>
        </button>
      </div>

      {/* Body */}
      <div className="px-4 sm:px-6 py-4 sm:py-5">
        {/* Prompt Section */}
        <div className="mb-5">
          <label className="block text-[12px] font-semibold uppercase tracking-wider text-[#9CA3AF] dark:text-[#A1A8B3] mb-2">
            Modify Your Prompt <span className="text-red-500 font-semibold">*</span> <span className="text-[10.5px] font-normal normal-case text-[#9CA3AF] dark:text-[#D1D5DB] tracking-normal">(or attach reference images)</span>
          </label>
          <div
            className="relative"
            onDragOver={isLocked ? undefined : handleDragOver}
            onDragLeave={isLocked ? undefined : handleDragLeave}
            onDrop={isLocked ? undefined : handleDrop}
          >
            <textarea
              ref={inputRef}
              value={prompt}
              placeholder={isLocked ? "This design is locked and cannot be modified." : "Describe the changes you'd like (max 2,000 characters). You can paste up to 2 images here."}
              onPaste={isLocked ? undefined : handlePaste}
              maxLength={2000}
              onChange={isLocked ? undefined : (e) => {
                const val = e.target.value;
                setPrompt(val);
                if (val.length > 2000) {
                  setPromptError('Description cannot exceed 2,000 characters.');
                } else {
                  setPromptError(null);
                  setHasError(false);
                  setSubmitError(null);
                }
              }}
              disabled={isLocked}
              rows={4}
              className={`w-full px-4 py-3 pb-14 rounded-[14px] text-[13px] text-[#1A1A1A] dark:text-ink placeholder:text-[#C4C4C4] dark:placeholder:text-ink-400 max-sm:placeholder:text-[12px] outline-none resize-none leading-relaxed border font-inter transition-all duration-300 ${
                isLocked
                  ? 'bg-gray-100 dark:bg-surface-200 cursor-not-allowed opacity-60 border-hairline'
                  : isDragging
                    ? 'border-blue-500 ring-2 ring-blue-500/20 scale-[1.005] bg-blue-50/5 dark:bg-blue-950/5'
                    : 'bg-[#F7F6F3] dark:bg-surface-150 border-hairline'
              }`}
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/png, image/jpeg, image/gif, image/webp, image/heic, image/heif"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              disabled={isLocked}
              onClick={() => {
                if (isLocked) return;
                if (uploadedFiles.length >= 2) {
                  toast.warning('You can upload a maximum of 2 reference images.');
                  return;
                }
                fileRef.current?.click();
              }}
              className={`absolute bottom-3 left-3 flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#D5D9E2] dark:border-border-default bg-[#EFF1F6] dark:bg-surface-200 text-[#2D3748] dark:text-ink transition-all text-[13px] font-medium leading-none ${
                isLocked ? 'cursor-not-allowed opacity-40' : 'hover:bg-[#E2E6EE] dark:hover:bg-surface-250 cursor-pointer'
              }`}
              title={isLocked ? "Refinement disabled" : "Upload reference image"}
            >
              <i className="ri-attachment-line text-[15px] text-[#2D3748] dark:text-ink leading-none"></i>
              <span className="leading-none">Attach image</span>
            </button>
          </div>
          <div className="flex items-center justify-between mt-1.5 select-none font-inter">
            <p className="text-[11px] text-[#C4C4C4] dark:text-[#D1D5DB]">
              Accepted: PNG, JPEG, GIF, WEBP, HEIC, HEIF (Max 10MB)
            </p>
            <div className="text-[11px] text-[#9CA3AF] dark:text-[#A1A8B3]">
              <span className={prompt.length === 2000 ? 'text-red-500 font-semibold' : ''}>
                {prompt.length} / 2000 characters
              </span>
            </div>
          </div>
          {promptError && (
            <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 font-inter">
              {promptError}
            </div>
          )}
          {previewUrls.length > 0 && (
            <div className="mt-3 flex gap-3">
              {previewUrls.map((url, idx) => (
                <div key={idx} className="relative rounded-[12px] overflow-hidden border border-hairline w-[100px] h-[100px] group shadow-sm bg-[#F7F6F3] dark:bg-surface-150 animate-attachment-pop">
                  <img src={url} alt={`Reference ${idx + 1}`} className="w-full h-full object-cover object-top" />
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center bg-black/60 rounded-full hover:bg-black/80 text-white transition-colors cursor-pointer border border-white/20"
                    title="Remove image"
                  >
                    <i className="ri-close-line text-[12px]"></i>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Refinement Options */}
        <div className="mb-5">
          <label className="block text-[12px] font-semibold uppercase tracking-wider text-[#9CA3AF] dark:text-[#A1A8B3] mb-2">
            Style Tags
          </label>
          <div className="flex flex-wrap gap-2">
            {styleTags.map((tag) => {
              const active = selectedStyle === tag;
              return (
                <button
                  key={tag}
                  disabled={isLocked}
                  onClick={() => toggleStyle(tag)}
                  className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-[12px] font-medium transition-all duration-150 whitespace-nowrap ${
                    isLocked 
                      ? 'cursor-not-allowed opacity-50 bg-[#F3F4F6] dark:bg-surface-150 text-[#9CA3AF] dark:text-ink-600' 
                      : active
                        ? 'bg-[#6366F1] text-white cursor-pointer'
                        : 'bg-[#F3F4F6] dark:bg-surface-150 text-[#6B7280] dark:text-ink hover:bg-[#E5E7EB] dark:hover:bg-surface-200 hover:text-[#374151] dark:hover:text-ink cursor-pointer'
                  }`}
                >
                  {active && (
                    <span className="w-3 h-3 inline-flex items-center justify-center mr-1">
                      <i className="ri-check-line text-[10px]"></i>
                    </span>
                  )}
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-5">
          <label className="block text-[12px] font-semibold uppercase tracking-wider text-[#9CA3AF] dark:text-[#A1A8B3] mb-2">
            Design Focus
          </label>
          <div className="flex flex-wrap gap-2">
            {focusAreas.map((area) => {
              const active = selectedFocus === area;
              return (
                <button
                  key={area}
                  disabled={isLocked}
                  onClick={() => {
                    if (isLocked) return;
                    setSelectedFocus(active ? null : area);
                    setHasError(false);
                    setSubmitError(null);
                  }}
                  className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-[12px] font-medium transition-all duration-150 whitespace-nowrap ${
                    isLocked 
                      ? 'cursor-not-allowed opacity-50 bg-[#F3F4F6] dark:bg-surface-150 text-[#9CA3AF] dark:text-ink-600' 
                      : active
                        ? 'bg-[#3B82F6] text-white cursor-pointer'
                        : 'bg-[#F3F4F6] dark:bg-surface-150 text-[#6B7280] dark:text-ink hover:bg-[#E5E7EB] dark:hover:bg-surface-200 hover:text-[#374151] dark:hover:text-ink cursor-pointer'
                  }`}
                >
                  {active && (
                    <span className="w-3 h-3 inline-flex items-center justify-center mr-1">
                      <i className="ri-check-line text-[10px]"></i>
                    </span>
                  )}
                  {area}
                </button>
              );
            })}
          </div>
        </div>

        {/* Inline Error */}
        {hasError && (
          <div className="mb-4 p-3 rounded-[12px] bg-[#FEF2F2] border border-[#FECACA]">
            <div className="flex items-start gap-2">
              <span className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                <i className="ri-error-warning-line text-[14px] text-[#EF4444]"></i>
              </span>
              <div>
                <p className="text-[12.5px] font-medium text-[#B91C1C]">
                  {submitError || 'Unable to generate design.'}
                </p>
                {!submitError && (
                  <p className="text-[11.5px] text-[#DC2626] mt-0.5">
                    Try adjusting your prompt and try again.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-hairline">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-[10px] text-[13px] font-medium text-[#6B7280] dark:text-ink hover:bg-[#F3F4F6] dark:hover:bg-surface-150 transition-colors cursor-pointer whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLocked || (!prompt.trim() && uploadedFiles.length === 0) || prompt.length > 2000 || Boolean(promptError) || isSubmitting}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-[10px] text-[13px] font-semibold text-white transition-all duration-150 whitespace-nowrap disabled:opacity-40 bg-[#6366F1] disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span className="w-4 h-4 flex items-center justify-center">
                <i className="ri-loader-4-line text-[14px] animate-spin"></i>
              </span>
            ) : (
              <span className="w-4 h-4 flex items-center justify-center">
                <i className="ri-sparkling-line text-[13px]"></i>
              </span>
            )}
            {isSubmitting ? 'Generating...' : 'Regenerate Design'}
          </button>
        </div>
      </div>
      <style jsx>{`
        @keyframes pop-and-glow {
          0% {
            transform: scale(0.3);
            opacity: 0;
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.6);
          }
          70% {
            transform: scale(1.1);
            box-shadow: 0 0 0 8px rgba(59, 130, 246, 0.3);
          }
          100% {
            transform: scale(1);
            opacity: 1;
            box-shadow: 0 0 0 0px rgba(59, 130, 246, 0);
          }
        }
        .animate-attachment-pop {
          animation: pop-and-glow 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
      `}</style>
    </div>
  );
}
