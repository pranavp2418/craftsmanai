'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import JewelleryTypeSelector from './JewelleryTypeSelector';
import CameraCapture from './CameraCapture';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { createDesign, resetCreateDesign } from '@/redux/slices/retailer/createDesignSlice';
import { fetchDesigns } from '@/redux/slices/retailer/designsSlice';
import { toast } from 'react-toastify';
import { getAccessToken } from '@/src/utils/auth';
import { getJSON, setJSON, STORAGE_KEYS } from '@/lib/storage';

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: ((event: Event) => void) | null;
}

const prefixMap: Record<string, string> = {
  Ring: 'JCR',
  Pendant: 'JCP',
  Earring: 'JCE',
  Bracelet: 'JCB',
  Necklace: 'JCN',
  Watch: 'JCW',
  Grillz: 'JCG',
  Chain: 'JCC',
  Brooch: 'JCO',
  Anklet: 'JCA',
  Cuff: 'JCF',
};

interface PromptBoxProps {
  expanded?: boolean;
}

interface AttachmentItem {
  id: string;
  url: string;
  file?: File;
}
const ALLOWED_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default function PromptBox({ expanded }: PromptBoxProps) {
  const [prompt, setPrompt] = useState('');
  const [promptError, setPromptError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [category, setCategory] = useState('');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedCategory = sessionStorage.getItem('selected_jewelry_category');
      if (savedCategory) {
        setCategory(savedCategory);
      }
      const savedPrompt = sessionStorage.getItem('prompt_box_text');
      if (savedPrompt) {
        setPrompt(savedPrompt);
      }
      setIsMounted(true);
    }
  }, []);

  useEffect(() => {
    if (isMounted && typeof window !== 'undefined') {
      sessionStorage.setItem('prompt_box_text', prompt);
    }
  }, [prompt, isMounted]);

  useEffect(() => {
    if (isMounted && typeof window !== 'undefined') {
      if (category) {
        sessionStorage.setItem('selected_jewelry_category', category);
      } else {
        sessionStorage.removeItem('selected_jewelry_category');
      }
    }
  }, [category, isMounted]);
  const [designSeq, setDesignSeq] = useState('000');
  const [designSuffix, setDesignSuffix] = useState('');
  const [isSuffixCustomized, setIsSuffixCustomized] = useState(false);
  const [suffixEditing, setSuffixEditing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showCategoryWarning, setShowCategoryWarning] = useState(false);
  const [shakeTrigger, setShakeTrigger] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // No word count helper needed, character length will be checked natively.

  const promptInputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const basePromptRef = useRef('');
  const spokenRef = useRef('');
  const designNumInputRef = useRef<HTMLInputElement>(null);
  const sseRef = useRef<AbortController | null>(null);
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { loading: createLoading, error: createError } = useAppSelector((state) => state.retailerCreateDesign);
  const isCategorySelected = Boolean(category);

  const triggerCategoryRequiredWarning = () => {
    setShowCategoryWarning(true);
    setShakeTrigger((prev) => prev + 1);
  };

  const showCategoryRequiredWarning = () => {
    triggerCategoryRequiredWarning();
    promptInputRef.current?.blur();
  };

  const requireCategorySelection = () => {
    if (category) return true;
    showCategoryRequiredWarning();
    return false;
  };

  useEffect(() => {
    setDesignSeq(String(Math.floor(Math.random() * 900 + 100)).padStart(3, '0'));
    if (category) {
      setShowCategoryWarning(false);
    }
  }, [category]);





  useEffect(() => {
    if (category) {
      setShowCategoryWarning(false);
    } else if (prompt.trim()) {
      setShowCategoryWarning(true);
    } else {
      setShowCategoryWarning(false);
    }
  }, [category, prompt]);

  useEffect(() => {
    if (suffixEditing && designNumInputRef.current) {
      designNumInputRef.current.focus();
    }
  }, [suffixEditing]);

  useEffect(() => {
    const saved = localStorage.getItem('sketchDraft');
    if (saved) {
      const file = dataUrlToFile(saved, `sketch-${Date.now()}.png`);
      setAttachments([{ id: `draft-${Date.now()}`, url: saved, file }]);
      localStorage.removeItem('sketchDraft');
    }
  }, []);

  const dataUrlToFile = (dataUrl: string, filename: string): File => {
    const [header, data] = dataUrl.split(',');
    const mimeMatch = header.match(/data:(.*);base64/);
    const mime = mimeMatch?.[1] || 'image/png';
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new File([bytes], filename, { type: mime });
  };

  const handleAttachClick = () => {
    if (!requireCategorySelection()) return;
    fileInputRef.current?.click();
  };

  const [cameraOpen, setCameraOpen] = useState(false);

  const handleCameraClick = () => {
    if (!requireCategorySelection()) return;
    // Open in-browser camera modal (preferred) on supporting browsers.
    setCameraOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!category) {
      e.target.value = '';
      showCategoryRequiredWarning();
      return;
    }
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const toAdd: AttachmentItem[] = [];
    const currentCount = attachments.length;
    let warned = false;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!ALLOWED_CONTENT_TYPES.includes(file.type)) {
        toast.error(`Invalid file type for "${file.name}". Only PNG, JPEG, GIF, and WEBP images are allowed.`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`"${file.name}" exceeds the 10MB size limit.`);
        continue;
      }
      if (currentCount + toAdd.length >= 2) {
        if (!warned) {
          toast.warning('Maximum 2 images can be attached.');
          warned = true;
        }
        break;
      }
      const url = URL.createObjectURL(file);
      toAdd.push({ id: `upload-${Date.now()}-${i}`, url, file });
    }

    if (toAdd.length > 0) {
      setAttachments((prev) => [...prev, ...toAdd]);
    }
    e.target.value = '';
  };

  const handleCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!category) {
      e.target.value = '';
      showCategoryRequiredWarning();
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_CONTENT_TYPES.includes(file.type)) {
      toast.error('Only PNG, JPEG, GIF, and WEBP images are allowed.');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error('Image exceeds 10MB size limit.');
      e.target.value = '';
      return;
    }

    if (attachments.length >= 2) {
      toast.warning('Maximum 2 images can be attached.');
      e.target.value = '';
      return;
    }

    const url = URL.createObjectURL(file);
    setAttachments((prev) => [...prev, { id: `camera-${Date.now()}`, url, file }]);
    e.target.value = '';
  };

  const addAttachment = (url: string, file?: File) => {
    if (file) {
      if (!ALLOWED_CONTENT_TYPES.includes(file.type)) {
        toast.error('Only PNG, JPEG, GIF, and WEBP images are allowed.');
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error('Image exceeds 10MB size limit.');
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
        return;
      }
    }
    if (attachments.length >= 2) {
      toast.warning('Maximum 2 images can be attached.');
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
      return;
    }

    setAttachments((prev) => [...prev, { id: `image-${Date.now()}`, url, file }]);
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const item = prev.find((entry) => entry.id === id);
      if (item?.url.startsWith('blob:')) {
        URL.revokeObjectURL(item.url);
      }
      return prev.filter((entry) => entry.id !== id);
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (category) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!category) {
      showCategoryRequiredWarning();
      return;
    }
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      const file = files[0];
      if (!ALLOWED_CONTENT_TYPES.includes(file.type)) {
        toast.error('Only PNG, JPEG, GIF, and WEBP images are allowed.');
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error('Image exceeds 10MB size limit.');
        return;
      }
      const url = URL.createObjectURL(file);
      addAttachment(url, file);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (!category) {
      showCategoryRequiredWarning();
      return;
    }
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const blob = items[i].getAsFile();
        if (blob) {
          const file = blob;
          if (!ALLOWED_CONTENT_TYPES.includes(file.type)) {
            toast.error('Only PNG, JPEG, GIF, and WEBP images are allowed.');
            return;
          }
          if (file.size > MAX_FILE_SIZE) {
            toast.error('Image exceeds 10MB size limit.');
            return;
          }
          const url = URL.createObjectURL(file);
          addAttachment(url, file);
        }
        break;
      }
    }
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    setVoiceError(null);

    if (!window.isSecureContext) {
      setVoiceError('Voice input needs HTTPS or localhost to access the microphone.');
      return;
    }

    const SpeechRecognitionImpl =
      (window as Window & { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition ||
      (window as Window & { SpeechRecognition?: any; webkitSpeechRecognition?: any }).webkitSpeechRecognition;
    if (!SpeechRecognitionImpl) {
      setVoiceError('Voice input is supported in Chrome or Edge over HTTPS.');
      return;
    }

    try {
      const recognition = new SpeechRecognitionImpl();
      recognition.lang = 'en-US';
      recognition.continuous = true;
      recognition.interimResults = true;

      basePromptRef.current = prompt;
      spokenRef.current = '';

      recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        if (final) {
          spokenRef.current += ` ${final}`;
        }

        const nextPrompt = [basePromptRef.current, spokenRef.current, interim].filter(Boolean).join(' ').trim();
        if (nextPrompt.length > 2000) {
          const truncated = nextPrompt.slice(0, 2000);
          setPrompt(truncated);
          setPromptError('Description cannot exceed 2,000 characters.');
          recognition.stop();
          setIsListening(false);
          toast.warning('Character limit reached! Description capped at 2,000 characters.');
        } else {
          setPrompt(nextPrompt);
          if (promptError) setPromptError(null);
        }
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        const speechError = event as { error?: string };
        if (speechError.error === 'not-allowed' || speechError.error === 'service-not-allowed') {
          setVoiceError('Mic permission was blocked. Allow microphone access in the browser settings.');
          return;
        }
        if (speechError.error === 'no-speech') {
          setVoiceError('No speech was detected. Try speaking again a little louder.');
          return;
        }
        if (speechError.error === 'audio-capture') {
          setVoiceError('No microphone was found or it is already in use by another app.');
          return;
        }
        setVoiceError('Voice input failed in this browser.');
      };

      recognition.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      setIsListening(true);
      recognition.start();
    } catch {
      setIsListening(false);
      setVoiceError('Voice input could not be started in this browser.');
    }
  };

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    return () => {
      sseRef.current?.abort();
      sseRef.current = null;
    };
  }, []);
  const handleGenerate = async () => {
    if (!category) {
      showCategoryRequiredWarning();
      return;
    }
    if (!prompt.trim() && attachments.length === 0) {
      setPromptError('Prompt or attachment is required.');
      return;
    }
    if (prompt.length > 2000 || promptError) {
      setPromptError('Description cannot exceed 2,000 characters.');
      return;
    }
    if (createLoading || isGenerating) return;

    const seq = Date.now();
    const cat = category || 'Custom';
    const prefix = prefixMap[category] || 'JCX';
    const trimmedSuffix = designSuffix.trim();
    const newId = trimmedSuffix;
    const attachedFiles = attachments.map((item) => item.file).filter((file): file is File => Boolean(file));
    const payload = {
      name: newId,
      jewellery_type: cat,
      user_prompt: prompt.trim() || undefined,
      files: attachedFiles,
    };

    const result = await dispatch(createDesign(payload));
    if (createDesign.fulfilled.match(result)) {
      const data = result.payload;
      const apiId =
        (data?.id ?? data?.request_id ?? data?.data?.id ?? data?.data?.request_id) ?? null;
      const requestId = apiId ? String(apiId) : newId;

      toast.success('Design created successfully!');
      dispatch(resetCreateDesign());

      // Clear category and prompt from sessionStorage on successful design creation
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('selected_jewelry_category');
        sessionStorage.removeItem('prompt_box_text');
      }

      // Refresh list to pick up generated design details
      dispatch(fetchDesigns({ limit: 50, page: 1 }));
      // Immediately redirect to requests detail page to show the generation progress loader
      router.push(`/retailer/requests?id=${requestId}`);
    } else if (createDesign.rejected.match(result)) {
      const errorMsg = (result.payload as string) || 'Failed to create design.';
      toast.error(errorMsg);
    }
  };

  const isFormValid = Boolean(category) && (Boolean(prompt.trim()) || attachments.length > 0) && prompt.length <= 2000 && !promptError;

  return (
    <div>
      <JewelleryTypeSelector value={category} onChange={setCategory} shakeTrigger={shakeTrigger} hasError={showCategoryWarning && !category} />

      {showCategoryWarning && !category && (
        <div className="mb-3 -mt-2 flex items-center gap-1.5 text-[12px] font-medium text-red-500 dark:text-red-400 font-inter animate-pulse">
          <i className="ri-error-warning-line text-[14px]" />
          <span>Please select a jewelry type above to start designing.</span>
        </div>
      )}

      <p className="text-[14px] sm:text-sm font-bold text-[#6B7280] dark:text-[#D1D5DB] uppercase tracking-wider mb-3 font-inter">
        DESCRIBE YOUR JEWELRY DESIGN <span className="text-red-500 font-medium">*</span>
        <br className='block sm:hidden' />
        <span className="text-[10.5px] font-normal normal-case text-[#9CA3AF] dark:text-[#D1D5DB] tracking-normal">(or attach an image)</span>
      </p>

      <div
        className={`w-full rounded-2xl border bg-white dark:bg-surface-100 shadow-[0px_4px_20px_rgba(0,0,0,0.02)] mb-4 overflow-hidden transition-all duration-300 ${isDragging
          ? 'border-blue-500 ring-2 ring-blue-500/20 scale-[1.005] bg-blue-50/5 dark:bg-blue-950/5'
          : 'border-[#ECEEF2] dark:border-border-default'
          }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex items-center gap-2 px-6 py-4 border-b border-[#ECEEF2] dark:border-border-default bg-gray-50/20 dark:bg-surface-150">
          <span className="text-[11.5px] font-medium text-[#9CA3AF] dark:text-[#A1A8B3] font-inter">
            Design #
          </span>
          {suffixEditing ? (
            <div className="flex items-center gap-0.5">
              <input
                ref={designNumInputRef}
                type="text"
                value={designSuffix}
                onChange={(e) => {
                  setDesignSuffix(e.target.value);
                  setIsSuffixCustomized(true);
                }}
                onBlur={() => {
                  setDesignSuffix(designSuffix.trim());
                  setSuffixEditing(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setDesignSuffix(designSuffix.trim());
                    setSuffixEditing(false);
                  }
                }}
                placeholder="e.g. Ria's ring"
                className="text-[13px] font-medium text-[#374151] dark:text-ink bg-[#F8F9FB] dark:bg-surface-150 rounded-lg px-2 py-0.5 outline-none border border-[#E5E7EB] dark:border-border-default w-36 font-inter"
              />
            </div>
          ) : (
            <span
              className="text-[13px] font-semibold text-[#1A1A1A] dark:text-ink font-inter"
            >
              {designSuffix.trim()}
            </span>
          )}
          <button
            onClick={() => setSuffixEditing(!suffixEditing)}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-black/5 transition-colors cursor-pointer"
          >
            <i className="ri-pencil-line text-[13px] text-[#9CA3AF] dark:text-[#A1A8B3]"></i>
          </button>
        </div>

        {voiceError && (
          <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            {voiceError}
          </div>
        )}

        <div className="px-6 pt-5 pb-3">
          <div className="relative">
            <textarea
              ref={promptInputRef}
              value={prompt}
              readOnly={!isCategorySelected}
              disabled={!isCategorySelected}
              aria-disabled={!isCategorySelected}
              onChange={(e) => {
                if (!requireCategorySelection()) return;
                const val = e.target.value;
                setPrompt(val);
                if (val.length > 2000) {
                  setPromptError('Description cannot exceed 2,000 characters.');
                } else {
                  if (promptError) setPromptError(null);
                }
              }}
              maxLength={2000}
              onKeyDown={(e) => {
                if (!isCategorySelected) {
                  e.preventDefault();
                  showCategoryRequiredWarning();
                  return;
                }
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
              onPaste={handlePaste}
              onFocus={() => {
                if (!isCategorySelected) {
                  showCategoryRequiredWarning();
                  return;
                }
                if (isListening) {
                  recognitionRef.current?.stop();
                  setIsListening(false);
                }
              }}
              onClick={() => {
                if (!isCategorySelected) {
                  showCategoryRequiredWarning();
                  return;
                }
                if (isListening) {
                  recognitionRef.current?.stop();
                  setIsListening(false);
                }
              }}
              placeholder="E.g., I want a vintage-style ring with a round diamond center stone, rose gold band with small diamonds on the sides, and a delicate filigree pattern..."
              className={`w-full resize-none !bg-transparent text-[13px] sm:text-[14.5px] text-[#374151] dark:text-ink placeholder:text-[#9CA3AF] dark:placeholder:text-ink-400 placeholder:text-[12px] sm:placeholder:text-[14.5px] outline-none border-none leading-relaxed font-inter ${expanded ? 'h-[280px]' : 'h-[140px]'} ${!isCategorySelected ? 'cursor-not-allowed opacity-70' : ''}`}
            />
            {!isCategorySelected && (
              <button
                type="button"
                aria-label="Select a jewelry type first"
                onClick={requireCategorySelection}
                onMouseDown={(e) => {
                  e.preventDefault();
                  showCategoryRequiredWarning();
                }}
                className="absolute inset-0 z-10 cursor-not-allowed rounded-none bg-transparent"
              />
            )}
          </div>

          <div className="flex justify-between items-start text-[11px] text-[#9CA3AF] dark:text-[#A1A8B3] font-inter select-none">
            <span className="text-left">
              Accepted: PNG, JPEG, GIF, WEBP (Max 10MB)
            </span>
            <span className={`text-right whitespace-nowrap ${prompt.length === 2000 ? 'text-red-500 font-semibold' : ''}`}>
              {prompt.length} / 2000 characters
            </span>
          </div>
        </div>

        {promptError && (
          <div className="mx-6 mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            {promptError}
          </div>
        )}


        {attachments.length > 0 && (
          <div className="mx-6 mb-4 flex flex-wrap gap-3">
            {attachments.map((item, index) => (
              <div
                key={item.id}
                className="relative h-16 w-16 overflow-hidden rounded-xl border border-hairline bg-white dark:bg-surface-100 shadow-sm animate-attachment-pop"
              >
                <img
                  src={item.url}
                  alt={`Attachment ${index + 1}`}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeAttachment(item.id)}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/75"
                  aria-label={`Remove attachment ${index + 1}`}
                >
                  <i className="ri-close-line text-[12px]" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="px-6 pb-5 pt-4 border-t border-hairline bg-gray-50/20 dark:bg-surface-150 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/png, image/jpeg, image/gif, image/webp"
              multiple
              className="hidden"
            />
            <input
              type="file"
              ref={cameraInputRef}
              onChange={handleCameraChange}
              accept="image/png, image/jpeg, image/gif, image/webp"
              capture="environment"
              className="hidden"
            />

            <button
              onClick={handleAttachClick}
              className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-[12px] sm:text-[13px] font-medium transition-all duration-150 cursor-pointer whitespace-nowrap w-full sm:w-auto bg-blue-500/10 text-blue-500 ${!isCategorySelected ? 'opacity-60' : ''}`}
            >
              <span className="w-4 h-4 flex items-center justify-center">
                <i className="ri-attachment-2 text-[14px]"></i>
              </span>
              Attach
            </button>

            <button
              onClick={handleCameraClick}
              className={`w-9 h-9 flex items-center justify-center rounded-full transition-all duration-150 cursor-pointer flex-shrink-0 bg-[#F3F4F6] dark:bg-[#20262E] hover:bg-[#E5E7EB] dark:hover:bg-surface-200 ${!isCategorySelected ? 'opacity-60' : ''}`}
            >
              <i className="ri-camera-line text-[16px] text-[#94A3B8] dark:text-[#A1A8B3]"></i>
            </button>

            <button
              onClick={() => {
                if (!requireCategorySelection()) return;
                router.push('/retailer/sketch');
              }}
              className={`w-9 h-9 flex items-center justify-center rounded-full transition-all duration-150 cursor-pointer flex-shrink-0 bg-[#F3F4F6] dark:bg-[#20262E] hover:bg-[#E5E7EB] dark:hover:bg-surface-200 ${!isCategorySelected ? 'opacity-60' : ''}`}
            >
              <i className="ri-pen-nib-line text-[16px] text-[#94A3B8] dark:text-[#A1A8B3]"></i>
            </button>

            <button
              onClick={() => {
                if (!requireCategorySelection()) return;
                toggleListening();
              }}
              aria-label="Voice input"
              title="Voice input"
              className={`w-9 h-9 flex items-center justify-center rounded-full transition-all duration-150 cursor-pointer relative flex-shrink-0 ${isListening
                ? 'bg-red-50 dark:bg-red-500/10 text-red-500 ring-2 ring-red-200 dark:ring-red-500/30'
                : 'bg-[#F3F4F6] dark:bg-[#20262E] text-[#94A3B8] dark:text-[#A1A8B3] hover:bg-[#E5E7EB] dark:hover:bg-surface-200'
                }`}
            >
              <i className={`${isListening ? 'ri-mic-fill' : 'ri-mic-line'} text-[16px]`} />
              {isListening && (
                <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-red-500 animate-ping" />
              )}
            </button>


          </div>

          <button
            onClick={handleGenerate}
            disabled={createLoading || isGenerating}
            className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-[12px] sm:text-[13.5px] font-semibold text-white transition-all duration-150 cursor-pointer whitespace-nowrap w-full sm:w-auto bg-[linear-gradient(135deg,_#3B82F6_0%,_#8B5CF6_100%)] shadow-[0px_6px_14px_rgba(59,130,246,0.25)] ${!isFormValid
              ? 'opacity-40 cursor-not-allowed shadow-none'
              : 'hover:opacity-90 active:scale-95'
              }`}
          >
            <span className="w-4 h-4 flex items-center justify-center">
              {createLoading || isGenerating ? (
                <i className="ri-loader-4-line text-[15px] animate-spin"></i>
              ) : (
                <i className="ri-magic-line text-[15px]"></i>
              )}
            </span>
            {createLoading || isGenerating ? 'Generating...' : 'Generate Render'}
          </button>
        </div>
        {cameraOpen && (
          <CameraCapture
            onClose={() => setCameraOpen(false)}
            onCapture={(dataUrl) => {
              const file = dataUrlToFile(dataUrl, `camera-${Date.now()}.png`);
              addAttachment(dataUrl, file);
              setCameraOpen(false);
            }}
          />
        )}
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

