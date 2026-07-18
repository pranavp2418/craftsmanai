'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, Info, Loader2, ChevronDown, Check, Search, PlusCircle, ArrowLeft } from 'lucide-react';
import { useClickOutside } from '@/src/utils/hooks/clickOutsideClose';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { addQuizQuestion, resetAddQuestion } from '@/redux/slices/admin/quiz/adminQuizAddQuestionSlice';
import { fetchQuestionKeys, resetKeys } from '@/redux/slices/admin/quiz/adminQuestionKeysSlice';
import { createQuestionKey, resetCreateKey } from '@/redux/slices/admin/quiz/adminCreateQuestionKeySlice';
import { useDebounce } from '@/src/utils/hooks/useDebounce';

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

interface AddQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  jewelleryType: string;
  jewelleryTypeValue: string;
  jewellerySubtype: string;
  onSuccess: () => void;
}

const inputBase =
  'w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 bg-[#F9F9F9] focus:outline-none focus:ring-2 focus:ring-[#2C62B9]/60 transition-colors';

const placeholderStyle = 'placeholder:text-[#8A8A8A]';

const generateId = () => Math.random().toString(36).slice(2, 9);

type QuestionType = 'single_select' | 'multiple_select' | 'text' | 'file_upload' | 'range' | 'custom_text';

const isValidUrl = (url: string) => {
  if (!url) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (_) {
    return false;
  }
};

export default function AddQuestionModal({
  isOpen,
  onClose,
  jewelleryType,
  jewelleryTypeValue,
  jewellerySubtype,
  onSuccess,
}: AddQuestionModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dispatch = useAppDispatch();

  const { loading: submitting, error: submitError } = useAppSelector((s) => s.adminQuizAddQuestion);
  const { keys: availableKeys, pagination, loading: loadingKeys, loadingMore } = useAppSelector((s) => s.adminQuestionKeys);
  const { loading: creatingKey, success: keyCreated, error: keyError } = useAppSelector((s) => s.adminCreateQuestionKey);

  const [questionText, setQuestionText] = useState('');
  const [questionKey, setQuestionKey] = useState('');
  const [questionType, setQuestionType] = useState<QuestionType>('single_select');
  const [minSelections, setMinSelections] = useState(1);
  const [maxSelections, setMaxSelections] = useState(1);
  const [order, setOrder] = useState(0);
  const [status, setStatus] = useState<'enabled' | 'disabled'>('enabled');
  const [options, setOptions] = useState<AnswerOption[]>([
    { id: generateId(), imageUrl: '', label: '' },
    { id: generateId(), imageUrl: '', label: '' },
  ]);

  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyCategory, setNewKeyCategory] = useState('');
  const [newKeySubsection, setNewKeySubsection] = useState('');
  const [newKeyDescription, setNewKeyDescription] = useState('');

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 400);

  useClickOutside(modalRef, onClose);
  useClickOutside(dropdownRef, () => setIsDropdownOpen(false));

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setQuestionText('');
      setQuestionKey('');
      setQuestionType('single_select');
      setMinSelections(1);
      setMaxSelections(1);
      setOrder(0);
      setStatus('enabled');
      setOptions([
        { id: generateId(), imageUrl: '', label: '' },
        { id: generateId(), imageUrl: '', label: '' },
      ]);
      setIsCreatingKey(false);
      setNewKeyName('');
      setNewKeyCategory('');
      setNewKeySubsection('');
      setNewKeyDescription('');
      dispatch(resetAddQuestion());
      dispatch(resetCreateKey());
      dispatch(fetchQuestionKeys());
    }
  }, [isOpen, dispatch]);

  // Handle server-side search with debounce
  useEffect(() => {
    if (!isOpen) return;

    dispatch(fetchQuestionKeys({ search: debouncedSearchQuery.trim(), page: 1 }));
  }, [debouncedSearchQuery, isOpen, dispatch]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 50) {
      if (!loadingMore && pagination?.has_next) {
        dispatch(fetchQuestionKeys({
          search: debouncedSearchQuery.trim(),
          page: pagination.current_page + 1,
          append: true
        }));
      }
    }
  };

  if (!isOpen) return null;

  const handleAddOption = () => {
    if (options.length >= 15) return;
    setOptions((prev) => [...prev, { id: generateId(), imageUrl: '', label: '' }]);
  };

  const handleRemoveOption = (id: string) => {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((o) => o.id !== id));
  };

  const handleOptionChange = (id: string, field: 'imageUrl' | 'label', value: string) => {
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, [field]: value } : o)));
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

  const handleCancel = () => {
    dispatch(resetAddQuestion());
    onClose();
  };

  const handleSubmit = async () => {
    if (!questionText.trim() || !questionKey.trim() || !jewellerySubtype) return;
    const result = await dispatch(
      addQuizQuestion({
        jewellery_type: jewelleryTypeValue,
        jewellery_subtype: jewellerySubtype,
        question_key: questionKey,
        question_text: questionText,
        question_type: questionType,
        options: (questionType === 'text' || questionType === 'file_upload' || questionType === 'range')
          ? []
          : options.map((o) => ({
            name: o.label,
            image_url: o.imageUrl,
            suboptions: o.suboptions && o.suboptions.length > 0
              ? o.suboptions.map(s => ({ name: s.label, image_url: s.imageUrl }))
              : undefined
          })),
        min_selections: (questionType === 'text' || questionType === 'file_upload' || questionType === 'range') ? 1 : minSelections,
        max_selections: (questionType === 'text' || questionType === 'file_upload' || questionType === 'range') ? 1 : maxSelections,
        order,
        is_active: status === 'enabled',
      })
    );
    if (addQuizQuestion.fulfilled.match(result)) onSuccess();
  };

  const handleSaveNewKey = async () => {
    if (!newKeyName.trim() || !newKeyCategory.trim() || !newKeySubsection.trim()) return;
    const result = await dispatch(
      createQuestionKey({
        question_key: newKeyName.trim(),
        category: newKeyCategory.trim(),
        subsection: newKeySubsection.trim(),
        description: newKeyDescription.trim(),
        is_active: true
      })
    );
    if (createQuestionKey.fulfilled.match(result)) {
      setQuestionKey(newKeyName.trim());
      setIsCreatingKey(false);
      dispatch(fetchQuestionKeys({ search: debouncedSearchQuery.trim(), page: 1 }));
    }
  };

  const showOptions = questionType === 'single_select' || questionType === 'multiple_select' || questionType === 'custom_text';

  const hasInvalidUrl = showOptions && options.some(o =>
    (o.imageUrl && !isValidUrl(o.imageUrl)) ||
    (o.suboptions && o.suboptions.some(s => s.imageUrl && !isValidUrl(s.imageUrl)))
  );

  const modalContent = (
    <>
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-9999 transition-opacity" />
      <div className="fixed inset-0 z-10000 flex items-center justify-center p-4">
        <div ref={modalRef} className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between mx-5 py-4 border-b-2 border-gray-200">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Add Quiz Question</h2>
              <p className="text-sm text-gray-500 mt-0.5">{jewelleryType}</p>
            </div>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer shrink-0 ml-4 mt-0.5"><X className="w-5 h-5" /></button>
          </div>

          <div className="overflow-y-auto px-5 py-5 space-y-5 flex-1 scrollbar-hide">
            {/* Question Text */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Question Text <span className="text-red-500">*</span></label>
              <textarea rows={3} value={questionText} onChange={(e) => setQuestionText(e.target.value)} placeholder="Enter your quiz question here..." className={`${inputBase} ${placeholderStyle} resize-none bg-[#F9F9F9]`} />
            </div>

            {/* Question Key */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-gray-700">Question Key <span className="text-red-500">*</span></label>
                {!isCreatingKey ? <button type="button" onClick={() => setIsCreatingKey(true)} className="text-[11px] font-bold text-[#2C62B9] hover:underline flex items-center gap-1 cursor-pointer"><PlusCircle className="w-3 h-3" /> ADD NEW KEY</button> : <button type="button" onClick={() => setIsCreatingKey(false)} className="text-[11px] font-bold text-gray-500 hover:underline flex items-center gap-1 cursor-pointer"><ArrowLeft className="w-3 h-3" /> BACK</button>}
              </div>
              {!isCreatingKey ? (
                <div className="relative" ref={dropdownRef}>
                  <div className={`${inputBase} flex items-center justify-between cursor-pointer`} onClick={() => { setIsDropdownOpen(!isDropdownOpen); if (!availableKeys.length) dispatch(fetchQuestionKeys()); }}>
                    <span className={`truncate ${questionKey ? 'text-gray-900' : 'text-[#8A8A8A]'}`}>{questionKey || 'e.g., metal_type, style_preference'}</span>
                    <div className="flex items-center gap-2">
                      {loadingKeys && <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />}
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                  {isDropdownOpen && (
                    <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-[101] overflow-hidden">
                      <div className="p-2 border-b border-gray-100 bg-gray-50"><div className="relative"><Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input autoFocus type="text" placeholder="Search..." className="w-full pl-8 pr-3 py-1.5 text-sm bg-white border border-gray-200 rounded" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onClick={(e) => e.stopPropagation()} /></div></div>
                      <div className="max-h-[200px] overflow-y-auto py-1 scrollbar-hide" onScroll={handleScroll}>
                        {availableKeys.length === 0 && !loadingKeys ? (
                          <div className="px-4 py-4 text-center text-xs text-gray-400 italic">No matches</div>
                        ) : (
                          availableKeys.map((k) => (
                            <div key={k.quiz_question_key} className={`px-4 py-2 hover:bg-gray-50 cursor-pointer flex flex-col gap-0.5 ${questionKey === k.quiz_question_key ? 'bg-blue-50' : ''}`} onClick={(e) => { e.stopPropagation(); setQuestionKey(k.quiz_question_key); setIsDropdownOpen(false); }}>
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-900 truncate pr-4">{k.description || 'No Description'}</span>
                                {questionKey === k.quiz_question_key && <Check className="w-4 h-4 text-blue-500 shrink-0" />}
                              </div>
                              <span className="text-[10px] text-gray-500 line-clamp-1 italic">{k.quiz_question_key}</span>
                            </div>
                          ))
                        )}
                        {loadingMore && (
                          <div className="flex justify-center p-2">
                            <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                          </div>
                        )}
                        {/* <div className="px-4 py-2 border-t border-gray-50 hover:bg-blue-50 cursor-pointer flex items-center gap-2 text-blue-600 font-bold text-xs" onClick={(e) => { e.stopPropagation(); setIsCreatingKey(true); setIsDropdownOpen(false); }}><Plus className="w-3 h-3" /> CREATE NEW KEY</div> */}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-[#F8FAFF] border border-blue-100 p-4 rounded-xl space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 ml-1 uppercase">Key Identifier</label>
                    <input placeholder="Key identifier" className={inputBase} value={newKeyName} onChange={(e) => setNewKeyName(e.target.value.toLowerCase().replace(/\s+/g, '_'))} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-500 ml-1 uppercase">Category</label>
                      <select
                        className={`${inputBase} cursor-pointer`}
                        value={newKeyCategory}
                        onChange={(e) => setNewKeyCategory(e.target.value)}
                      >
                        <option value="">Select Category</option>
                        <option value="material_details">Material Details</option>
                        <option value="stone_details">Stone Details</option>
                        <option value="dimension_details">Dimension Details</option>
                        <option value="specification_details">Specification Details</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-500 ml-1 uppercase">Subsection</label>
                      <input placeholder="Subsection" className={inputBase} value={newKeySubsection} onChange={(e) => setNewKeySubsection(e.target.value.replace(/\s+/g, '_'))} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 ml-1 uppercase">Description</label>
                    <input placeholder="Description" className={inputBase} value={newKeyDescription} onChange={(e) => setNewKeyDescription(e.target.value)} />
                  </div>
                  {keyError && <p className="text-[10px] text-red-500 font-bold">{keyError}</p>}
                  <div className="flex justify-end gap-2"><button onClick={() => setIsCreatingKey(false)} className="px-3 py-1.5 text-[10px] font-bold text-gray-500">CANCEL</button><button onClick={handleSaveNewKey} disabled={creatingKey || !newKeyName} className="px-4 py-1.5 bg-[#2C62B9] text-white text-[10px] font-bold rounded-lg disabled:opacity-50">{creatingKey ? 'AUTHORIZING...' : 'AUTHORIZE NEW KEY'}</button></div>
                </div>
              )}
            </div>

            {/* Question Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Question Type <span className="text-red-500">*</span></label>
              <select value={questionType} onChange={(e) => { const val = e.target.value as QuestionType; setQuestionType(val); if (val !== 'multiple_select' && val !== 'custom_text') { setMinSelections(1); setMaxSelections(1); } }} className={`${inputBase} cursor-pointer`}>
                <option value="single_select">Single Select</option><option value="multiple_select">Multiple Select</option><option value="text">Text</option><option value="file_upload">File Upload</option><option value="range">Range</option><option value="custom_text">Custom Text</option>
              </select>
            </div>

            {/* Min / Max / Order */}
            <div className="grid grid-cols-3 gap-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Min Selections</label><input type="number" min={1} disabled={questionType !== 'multiple_select' && questionType !== 'custom_text'} value={minSelections} onChange={(e) => setMinSelections(Number(e.target.value))} className={`${inputBase} disabled:opacity-50`} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Max Selections</label><input type="number" min={1} disabled={questionType !== 'multiple_select' && questionType !== 'custom_text'} value={maxSelections} onChange={(e) => setMaxSelections(Number(e.target.value))} className={`${inputBase} disabled:opacity-50`} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Order</label><input type="number" value={order} onChange={(e) => setOrder(Number(e.target.value))} className={inputBase} /></div>
            </div>

            {/* Status */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Status</p>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={status === 'enabled'} onChange={() => setStatus('enabled')} className="w-4 h-4 accent-[#2C62B9] cursor-pointer" /><span className="text-sm text-gray-700">Enable</span></label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={status === 'disabled'} onChange={() => setStatus('disabled')} className="w-4 h-4 accent-[#2C62B9] cursor-pointer" /><span className="text-sm text-gray-700">Disabled</span></label>
              </div>
            </div>

            {/* Answer Options */}
            {showOptions && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 mb-3 w-full"><p className="text-sm font-medium text-gray-700">Answer Options <span className="text-gray-400 font-normal text-xs ml-2">(Min 2, Max 6)</span></p>{options.length < 15 && <button type="button" onClick={handleAddOption} className="text-sm font-medium text-[#2C62B9] flex items-center gap-2 cursor-pointer"><Plus className="w-3.5 h-3.5" /> Add Option</button>}</div>
                {options.map((option, index) => (
                  <div key={option.id} className="border border-gray-200 rounded-xl p-4 space-y-3 bg-white relative">
                    <div className="flex items-center justify-between"><span className="text-xs font-medium text-gray-400">Option {index + 1}</span>{options.length > 2 && <button type="button" onClick={() => handleRemoveOption(option.id)} className="text-gray-300 hover:text-red-400 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>}</div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">Image URL</label>
                      <input
                        value={option.imageUrl}
                        onChange={(e) => handleOptionChange(option.id, 'imageUrl', e.target.value)}
                        placeholder="https://..."
                        className={`${inputBase} ${option.imageUrl && !isValidUrl(option.imageUrl) ? 'border-red-500 ring-red-500 ring-1' : ''}`}
                      />
                      {option.imageUrl && !isValidUrl(option.imageUrl) && (
                        <p className="text-[10px] text-red-500 mt-1 ml-1 font-medium tracking-tight">Please enter a valid image URL starting with http:// or https://</p>
                      )}
                    </div>
                    <div><label className="block text-xs font-medium text-gray-700 mb-1.5">Option Label</label><input value={option.label} onChange={(e) => handleOptionChange(option.id, 'label', e.target.value)} placeholder="e.g., Platinum" className={inputBase} /></div>

                    {/* Add Suboption Section */}
                    <div className="pt-2 border-t border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-500">Suboptions</span>
                        <button type="button" onClick={() => handleAddSuboption(option.id)} className="text-xs font-medium text-[#2C62B9] flex items-center gap-1 cursor-pointer"><Plus className="w-3 h-3" /> Add Suboption</button>
                      </div>
                      {option.suboptions && option.suboptions.length > 0 && (
                        <div className="space-y-3 mt-3">
                          {option.suboptions.map((sub, sIndex) => (
                            <div key={sub.id} className="bg-gray-50 p-3 rounded-lg border border-gray-100 relative">
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Suboption {sIndex + 1}</span>
                                <button type="button" onClick={() => handleRemoveSuboption(option.id, sub.id)} className="text-gray-300 hover:text-red-400 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-[10px] font-medium text-gray-600 mb-1">Image URL</label>
                                  <input value={sub.imageUrl} onChange={(e) => handleSuboptionChange(option.id, sub.id, 'imageUrl', e.target.value)} placeholder="https://..." className={`${inputBase} py-1.5 text-xs ${sub.imageUrl && !isValidUrl(sub.imageUrl) ? 'border-red-500 ring-red-500 ring-1' : ''}`} />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-medium text-gray-600 mb-1">Label</label>
                                  <input value={sub.label} onChange={(e) => handleSuboptionChange(option.id, sub.id, 'label', e.target.value)} placeholder="e.g., YW" className={`${inputBase} py-1.5 text-xs`} />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mx-5 py-4 border-t-2 border-gray-200">
            {submitError && <p className="text-xs text-red-500 text-center mb-3">{submitError}</p>}
            <div className="flex items-center gap-3">
              <button type="button" onClick={handleCancel} disabled={submitting} className="flex-1 px-4 py-2.5 rounded-full bg-[#EBF3FE] text-sm font-medium text-gray-700">Cancel</button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !questionText || !questionKey || !jewellerySubtype || hasInvalidUrl}
                className={`flex-1 px-4 py-2.5 rounded-full text-white text-sm font-medium ${submitting || !questionText || !questionKey || !jewellerySubtype || hasInvalidUrl ? 'bg-gray-300' : 'bg-[#2C62B9]'}`}
              >
                {submitting ? 'Adding...' : 'Add Question'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(modalContent, document.body);
}
