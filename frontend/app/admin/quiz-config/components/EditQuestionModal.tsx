'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, Info } from 'lucide-react';
import { useClickOutside } from '@/src/utils/hooks/clickOutsideClose';
import { useAppDispatch } from '@/redux/hooks';
import { editQuizQuestion, resetEditQuestion } from '@/redux/slices/admin/quiz/adminQuizEditQuestionSlice';
import { updateQuestion, QuizQuestion } from '@/redux/slices/admin/quiz/adminQuizQuestionsSlice';

interface AnswerSuboption {
  id: string;
  imageUrl: string;
  label: string;
}

interface AnswerOption {
  id: string;
  imageUrl: string;
  label: string;
  suboptions?: AnswerSuboption[];
}


interface EditQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  jewelleryType: string;
  jewelleryTypeValue?: string;
  jewellerySubtype?: string;
  question: QuizQuestion | null;
}

const inputBase =
  'w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors';

const placeholderStyle = 'placeholder:text-[#8A8A8A]';

const generateId = () => Math.random().toString(36).slice(2, 9);

export default function EditQuestionModal({
  isOpen,
  onClose,
  jewelleryType,
  jewelleryTypeValue,
  jewellerySubtype,
  question,
}: EditQuestionModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  const [questionText, setQuestionText] = useState('');
  const [status, setStatus] = useState<'enabled' | 'disabled'>('enabled');
  const [options, setOptions] = useState<AnswerOption[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const dispatch = useAppDispatch();

  useClickOutside(modalRef, onClose);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Populate form when question changes
  useEffect(() => {
    if (isOpen && question) {
      setQuestionText(question.text);
      setStatus(question.status);
      setOptions(
        question.options.map((o) => ({
          id: o.id,
          imageUrl: o.image,
          label: o.label,
          suboptions: o.suboptions ? o.suboptions.map((s, i) => ({
             id: `sub-${o.id}-${i}`,
             imageUrl: s.image_url || '',
             label: s.name || '',
          })) : []
        }))
      );
    }
  }, [isOpen, question]);

  if (!isOpen || !question) return null;

  const handleAddOption = () => {
    if (options.length >= 6) return;
    setOptions((prev) => [...prev, { id: generateId(), imageUrl: '', label: '' }]);
  };

  const handleRemoveOption = (id: string) => {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((o) => o.id !== id));
  };

  const handleOptionChange = (id: string, field: 'imageUrl' | 'label', value: string) => {
    setOptions((prev) =>
      prev.map((o) => (o.id === id ? { ...o, [field]: value } : o))
    );
  };

  const handleAddSuboption = (optionId: string) => {
    setOptions((prev) => prev.map((o) => {
      if (o.id === optionId) {
        return { ...o, suboptions: [...(o.suboptions || []), { id: generateId(), imageUrl: '', label: '' }] };
      }
      return o;
    }));
  };

  const handleRemoveSuboption = (optionId: string, subId: string) => {
    setOptions((prev) => prev.map((o) => {
      if (o.id === optionId) {
        return { ...o, suboptions: (o.suboptions || []).filter(s => s.id !== subId) };
      }
      return o;
    }));
  };

  const handleSuboptionChange = (optionId: string, subId: string, field: 'imageUrl' | 'label', value: string) => {
    setOptions((prev) => prev.map((o) => {
      if (o.id === optionId) {
        return { ...o, suboptions: (o.suboptions || []).map(s => s.id === subId ? { ...s, [field]: value } : s) };
      }
      return o;
    }));
  };

  const handleSubmit = async () => {
    setSubmitError(null);

    if (!questionText.trim()) {
      setSubmitError('Question text is required.');
      return;
    }
    const emptyImageIdx = options.findIndex((o) => !o.imageUrl.trim());
    if (emptyImageIdx !== -1) {
      setSubmitError(`Option ${emptyImageIdx + 1} has an empty Image URL. Please provide a valid URL.`);
      return;
    }
    const emptyLabelIdx = options.findIndex((o) => !o.label.trim());
    if (emptyLabelIdx !== -1) {
      setSubmitError(`Option ${emptyLabelIdx + 1} label is required.`);
      return;
    }

    const result = await dispatch(
      editQuizQuestion({
        questionId: question.id,
        jewellery_type: jewelleryTypeValue || jewelleryType,
        jewellery_subtype: jewellerySubtype,
        question_text: questionText,
        question_type: 'single_select',
        options: options.map((o) => ({ 
          name: o.label, 
          image_url: o.imageUrl,
          suboptions: o.suboptions && o.suboptions.length > 0
            ? o.suboptions.map(s => ({ name: s.label, image_url: s.imageUrl }))
            : undefined
        })),
        min_selections: 0,
        max_selections: 0,
        order: parseInt(question.questionNumber.replace('Q', ''), 10) || 0,
        is_active: status === 'enabled',
      })
    );
    if (editQuizQuestion.fulfilled.match(result)) {
      // Update question in store directly from API response
      const updatedData = (result.payload as { data: unknown })?.data;
      if (updatedData) dispatch(updateQuestion(updatedData));
      dispatch(resetEditQuestion());
      onClose();
    } else {
      const errMsg = (result.payload as string) ?? 'Something went wrong. Please try again.';
      setSubmitError(errMsg);
    }
  };

  const modalContent = (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-9999 transition-opacity" />

      {/* Modal */}
      <div className="fixed inset-0 z-10000 flex items-center justify-center p-4">
        <div
          ref={modalRef}
          className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between mx-5 py-4 border-b-2 border-gray-200">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Edit Quiz Question</h2>
              <p className="text-sm text-gray-500 mt-0.5">{jewelleryType}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer shrink-0 ml-4 mt-0.5"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="overflow-y-auto px-5 py-5 space-y-5 flex-1 scrollbar-hide">
            {/* Question Text */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Question Text <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={2}
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="Enter your quiz question here..."
                className={`${inputBase} ${placeholderStyle} resize-none`}
              />
            </div>

            {/* Status */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Status</p>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="edit-status"
                    value="enabled"
                    checked={status === 'enabled'}
                    onChange={() => setStatus('enabled')}
                    className="w-4 h-4 accent-[#2C62B9] cursor-pointer"
                  />
                  <span className="text-sm text-gray-700">Enable</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="edit-status"
                    value="disabled"
                    checked={status === 'disabled'}
                    onChange={() => setStatus('disabled')}
                    className="w-4 h-4 accent-[#2C62B9] cursor-pointer"
                  />
                  <span className="text-sm text-gray-700">Disabled</span>
                </label>
              </div>
            </div>

            {/* Answer Options */}
            <div>
              <div className="flex flex-row items-start sm:items-center justify-between gap-3 mb-3 w-full ">
                <p className="text-sm font-medium text-gray-700 text-nowrap">
                  Answer Options <span className="text-red-500">*</span>
                  <span className="text-gray-400 font-normal block md:hidden text-xs mt-1 sm:mt-0 ml-0 sm:ml-2">(Min 2, Max 6)</span>
                   <span className="text-gray-400 font-normal hidden md:inline text-xs mt-1 sm:mt-0 ml-0 sm:ml-2">(Minimum 2, Maximum 6)</span>
                </p>
                {options.length < 6 && (
                  <button
                    type="button"
                    onClick={handleAddOption}
                    className=" text-sm font-medium text-[#2C62B9] hover:opacity-70 transition-opacity flex items-center justify-center gap-2 px-3 py-2 rounded-md cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Option
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {options.map((option) => (
                  <div
                    key={option.id}
                    className="relative border border-gray-200 rounded-xl p-3 bg-white flex flex-row gap-3"
                  >
                    {/* Image preview */}
                    <div className="shrink-0 w-28 h-32 md:w-28 md:h-32 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                      {option.imageUrl ? (
                        <img
                          src={option.imageUrl}
                          alt={option.label || 'Option image'}
                          className="w-full h-full object-cover object-center"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-7 h-7"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 18h16.5M3 3h18M3.75 6.75h.008v.008H3.75V6.75z"
                            />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Fields */}
                    <div className="flex-1 min-w-0 space-y-2.5">
                      {/* Delete btn */}
                      <div className="flex justify-end">
                        {options.length > 2 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveOption(option.id)}
                            className="absolute text-red-400 hover:text-red-500 transition-colors cursor-pointer"
                            aria-label="Remove option"
                          >
                            <Trash2 className="md:w-4 md:h-4 w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Image URL */}
                      <div className='-mt-2 pr-5'>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Image URL <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={option.imageUrl}
                          onChange={(e) => handleOptionChange(option.id, 'imageUrl', e.target.value)}
                          placeholder="https://example.com/image.jpg"
                          className={`${inputBase} ${placeholderStyle}`}
                        />
                      </div>

                      {/* Option Label */}
                      <div className='pr-5'>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Option Label <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={option.label}
                          onChange={(e) => handleOptionChange(option.id, 'label', e.target.value)}
                          placeholder="e.g., Platinum, Round, Plain Band"
                          className={`${inputBase} ${placeholderStyle}`}
                        />
                      </div>
                      
                      {/* Add Suboption Section */}
                      <div className="pt-2 border-t border-gray-100 pr-5">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-gray-500">Suboptions</span>
                          <button type="button" onClick={() => handleAddSuboption(option.id)} className="text-xs font-medium text-[#2C62B9] flex items-center gap-1 cursor-pointer hover:underline"><Plus className="w-3 h-3" /> Add Suboption</button>
                        </div>
                        {option.suboptions && option.suboptions.length > 0 && (
                          <div className="space-y-3 mt-3">
                            {option.suboptions.map((sub, sIndex) => (
                              <div key={sub.id} className="bg-gray-50 p-2 sm:p-3 rounded-lg border border-gray-200 relative">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Suboption {sIndex + 1}</span>
                                  <button type="button" onClick={() => handleRemoveSuboption(option.id, sub.id)} className="text-gray-400 hover:text-red-500 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-[10px] font-medium text-gray-600 mb-0.5">Image URL</label>
                                    <input value={sub.imageUrl} onChange={(e) => handleSuboptionChange(option.id, sub.id, 'imageUrl', e.target.value)} placeholder="https://..." className={`${inputBase} py-1 px-2 text-xs`} />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-medium text-gray-600 mb-0.5">Label</label>
                                    <input value={sub.label} onChange={(e) => handleSuboptionChange(option.id, sub.id, 'label', e.target.value)} placeholder="e.g., YW" className={`${inputBase} py-1 px-2 text-xs`} />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Guidelines Box */}
            <div
              className="rounded-xl border p-4"
              style={{ borderColor: '#C2D8FC', backgroundColor: '#EBF3FE' }}
            >
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 mt-0.5 shrink-0 text-[#2C62B9]" />
                <div>
                  <p className="text-sm font-medium text-[#2C62B9] mb-1.5">
                    Quiz Configuration Guidelines:
                  </p>
                  <ul className="space-y-1 list-disc list-inside">
                    {[
                      'Questions must be clear and specific to the jewellery type',
                      'Images should be high quality and clearly visible',
                      'Each option must have both an image and a label',
                      'Changes affect new requests only, existing requests remain unchanged',
                    ].map((guideline) => (
                      <li key={guideline} className="text-xs text-[#2C62B9]">
                        {guideline}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-col gap-2 mx-5 py-4 border-t-2 border-gray-200">
            {submitError && (
              <p className="text-xs text-red-500 text-center">{submitError}</p>
            )}
            <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 cursor-pointer px-4 py-2.5 rounded-full text-sm font-medium text-gray-700 hover:opacity-90 transition-colors"
              style={{ backgroundColor: '#EBF3FE' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="flex-1 px-4 py-2.5 rounded-full bg-[#2C62B9] text-white text-sm font-medium hover:bg-[#2556a3] active:bg-[#1f4a8a] transition-colors cursor-pointer"
            >
              Save Changes
            </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(modalContent, document.body);
}
