import React, { useState, useEffect, useRef } from 'react';
import { X, Repeat2, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { editJewelleryType, resetJewelleryTypeEdit } from '@/redux/slices/admin/jewellery/adminJewelleryTypeEditSlice';

interface EditJewelryTypeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    type: {
        id: string;
        name: string;
        status: 'active' | 'disabled';
        image: string;
    } | null;
}

const EditJewelryTypeModal: React.FC<EditJewelryTypeModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    type
}) => {
    const dispatch = useAppDispatch();
    const { loading: submitting, error: submitError } = useAppSelector(
        (s) => s.adminJewelleryTypeEdit
    );

    const [typeName, setTypeName] = useState('');
    const [status, setStatus] = useState<'active' | 'disabled'>('active');
    const [currentImage, setCurrentImage] = useState<string>('');
    const [newImageFile, setNewImageFile] = useState<File | null>(null);
    const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [nameError, setNameError] = useState('');
    const [imageError, setImageError] = useState('');

    useEffect(() => {
        if (type) {
            setTypeName(type.name);
            setStatus(type.status);
            setCurrentImage(type.image);
            setNewImagePreview(null);
            setNewImageFile(null);
            setNameError('');
            setImageError('');
            dispatch(resetJewelleryTypeEdit());
        }
    }, [type, dispatch]);

    if (!isOpen || !type) return null;

    const handleImageChange = (file: File) => {
        if (file && file.type.startsWith('image/')) {
            if (file.size <= 5 * 1024 * 1024) { // 5MB limit
                setNewImageFile(file);
                const reader = new FileReader();
                reader.onloadend = () => {
                    setNewImagePreview(reader.result as string);
                };
                reader.readAsDataURL(file);
            } else {
                alert('File size must be less than 5MB');
            }
        }
    };

    const handleReplaceImage = () => {
        fileInputRef.current?.click();
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageError('');
            handleImageChange(file);
        }
    };

    const handleDeleteImage = () => {
        setNewImagePreview(null);
        setNewImageFile(null);
        setCurrentImage('');
    };

    const handleSubmit = async () => {
        if (!type) return;
        let valid = true;
        if (!typeName.trim()) { setNameError('Type name is required.'); valid = false; }
        if (!currentImage && !newImageFile) { setImageError('Type image is required.'); valid = false; }
        if (!valid) return;
        setNameError('');
        setImageError('');
        const result = await dispatch(
            editJewelleryType({
                type_id: type.id,
                label: typeName.trim(),
                status,
                image: newImageFile,
            })
        );
        if (editJewelleryType.fulfilled.match(result)) {
            dispatch(resetJewelleryTypeEdit());
            setNameError('');
            setImageError('');
            onSuccess();
            onClose();
        }
    };

    const handleCancel = () => {
        if (!type) return;
        setTypeName(type.name);
        setStatus(type.status);
        setCurrentImage(type.image);
        setNewImagePreview(null);
        setNewImageFile(null);
        setNameError('');
        setImageError('');
        dispatch(resetJewelleryTypeEdit());
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 cursor-pointer"
                onClick={handleCancel}
            />

            {/* Modal Content */}
            <div
                className="relative bg-white rounded-2xl md:rounded-3xl lg:rounded-3xl w-full max-w-lg z-10 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 md:p-5 lg:p-6 pb-3 md:pb-3.5 lg:pb-4 relative">
                    <h2 className="text-lg md:text-xl lg:text-2xl font-semibold text-[#111827] leading-tight md:leading-snug lg:leading-normal">
                        Edit Jewelery Type
                    </h2>
                    <p className="text-xs md:text-xs lg:text-sm text-[#515151] mt-1.5 md:mt-1.5 lg:mt-2 leading-tight md:leading-snug lg:leading-normal">
                        Update jewelery type information
                    </p>

                    {/* Close Button */}
                    <button
                        onClick={handleCancel}
                        className="absolute top-4 md:top-5 lg:top-6 right-4 md:right-5 lg:right-6 p-1.5 md:p-1.5 lg:p-2 hover:bg-gray-100 rounded-md md:rounded-lg lg:rounded-lg transition-colors cursor-pointer"
                    >
                        <X className="w-4 h-4 md:w-5 md:h-5 lg:w-5 lg:h-5" color="#6B7280" />
                    </button>
                </div>

                {/* Separator Line */}
                <div className="h-px bg-[#E5E5E5] mx-6" />

                {/* Form Content */}
                <div className="p-4 md:p-5 lg:p-6 space-y-4 md:space-y-5 lg:space-y-6">
                    {/* Type Name Input */}
                    <div>
                        <label className="block text-xs md:text-sm lg:text-sm font-medium text-[#111827] mb-1.5 md:mb-1.5 lg:mb-2 leading-tight md:leading-snug lg:leading-normal">
                            Type Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={typeName}
                            onChange={(e) => { setTypeName(e.target.value); if (nameError) setNameError(''); }}
                            placeholder="e.g., Ring, Necklace, Bracelet"
                            className={`w-full px-3 md:px-3.5 lg:px-4 py-2 md:py-2.5 lg:py-3 rounded-lg bg-[#F9F9F9] border text-xs md:text-sm lg:text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#2C62B9] focus:border-transparent transition-all leading-tight md:leading-snug lg:leading-normal ${nameError ? 'border-red-500' : 'border-[#F1F1F1]'}`}
                        />
                        {nameError && <p className="text-xs text-red-500 mt-1">{nameError}</p>}
                    </div>

                    {/* Type Image */}
                    <div>
                        <label className="block text-xs md:text-sm lg:text-sm font-medium text-[#111827] mb-1.5 md:mb-1.5 lg:mb-2 leading-tight md:leading-snug lg:leading-normal">
                            Type Image <span className="text-red-500">*</span>
                        </label>

                        {/* Hidden File Input */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={handleFileInput}
                            className="hidden"
                        />

                        {/* Image Preview Container */}
                        {(newImagePreview || currentImage) ? (
                            <div className="relative w-full h-44 md:h-48 lg:h-57 rounded-lg overflow-hidden bg-gray-100">
                                <Image
                                    src={newImagePreview || currentImage}
                                    alt="Type preview"
                                    fill
                                    className="object-cover"
                                    unoptimized
                                />

                                {/* Action Buttons */}
                                <div className="absolute top-2 md:top-2.5 lg:top-3 right-2 md:right-2.5 lg:right-3 flex items-center gap-1.5 md:gap-1.5 lg:gap-2">
                                    <button
                                        onClick={handleReplaceImage}
                                        className="w-8 h-8 md:w-9 md:h-9 lg:w-11 lg:h-11 bg-white rounded-full shadow-lg hover:bg-gray-50 transition-colors cursor-pointer flex items-center justify-center"
                                        title="Replace image"
                                    >
                                        <Repeat2 className="w-4 h-4 md:w-4 md:h-4 lg:w-5 lg:h-5" strokeWidth={2} color="#1A1A1A" />
                                    </button>
                                    <button
                                        onClick={handleDeleteImage}
                                        className="w-8 h-8 md:w-9 md:h-9 lg:w-11 lg:h-11 bg-[#FFFFFF] rounded-full shadow-lg hover:bg-gray-50 transition-colors cursor-pointer flex items-center justify-center"
                                        title="Delete image"
                                    >
                                        <Trash2 className="w-4 h-4 md:w-4 md:h-4 lg:w-5 lg:h-5" strokeWidth={2} color="#EF4444" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className={`relative border-2 border-dashed rounded-lg p-5 md:p-6 lg:p-8 bg-[#FAFAFA] cursor-pointer hover:border-[#2C62B9] hover:bg-[#EBF3FE] transition-all ${imageError ? 'border-red-500' : 'border-[#D1D5DB]'}`}
                            >
                                <div className="flex flex-col items-center justify-center text-center">
                                    <div className="w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 text-[#9CA3AF] mb-2 md:mb-2.5 lg:mb-3">
                                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
                                            <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
                                            <path d="M3 16L8 11L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                            <path d="M11 14L14 11L21 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </div>
                                    <p className="text-xs md:text-sm lg:text-sm font-medium text-[#111827] mb-0.5 md:mb-0.5 lg:mb-1 leading-tight md:leading-snug lg:leading-normal">
                                        Click to upload image
                                    </p>
                                    <p className="text-[10px] md:text-xs lg:text-xs text-[#9CA3AF] leading-tight md:leading-snug lg:leading-normal">
                                        PNG, JPG, WEBP up to 5MB
                                    </p>
                                </div>
                            </div>
                        )}
                        {imageError && <p className="text-xs text-red-500 mt-1">{imageError}</p>}
                    </div>
                </div>

                {/* Separator Line */}
                <div className="h-px bg-[#E5E5E5] mx-4 md:mx-5 lg:mx-6" />

                {/* Footer Actions */}
                <div className="p-4 md:p-5 lg:p-6">
                    {submitError && (
                        <p className="text-xs text-red-500 text-center mb-3">{submitError}</p>
                    )}
                    <div className="flex items-center gap-2 md:gap-2.5 lg:gap-3">
                        <button
                            onClick={handleCancel}
                            disabled={submitting}
                            className="flex-1 px-4 md:px-5 lg:px-6 py-2 md:py-2.5 lg:py-3 rounded-3xl bg-[#EBF3FE] text-[#373737] text-xs md:text-sm lg:text-sm font-medium hover:bg-[#D6E7FC] transition-colors cursor-pointer disabled:opacity-50 leading-tight md:leading-snug lg:leading-normal"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="flex-1 px-4 md:px-5 lg:px-6 py-2 md:py-2.5 lg:py-3 rounded-3xl bg-[#2C62B9] text-white text-xs md:text-sm lg:text-sm font-medium hover:bg-[#244E9A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer leading-tight md:leading-snug lg:leading-normal flex items-center justify-center gap-2"
                        >
                            {submitting ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                'Save Changes'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EditJewelryTypeModal;
