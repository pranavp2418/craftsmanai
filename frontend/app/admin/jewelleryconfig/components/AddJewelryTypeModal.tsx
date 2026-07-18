import React, { useState } from 'react';
import { X, Image as ImageIcon } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { createJewelleryType, resetJewelleryTypeCreate } from '@/redux/slices/admin/jewellery/adminJewelleryTypeCreateSlice';

interface AddJewelryTypeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const AddJewelryTypeModal: React.FC<AddJewelryTypeModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
}) => {
    const dispatch = useAppDispatch();
    const { loading: submitting, error: submitError } = useAppSelector(
        (s) => s.adminJewelleryTypeCreate
    );

    const [typeName, setTypeName] = useState('');
    const [status, setStatus] = useState<'active' | 'disabled'>('active');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [nameError, setNameError] = useState('');
    const [imageError, setImageError] = useState('');

    if (!isOpen) return null;

    const handleImageChange = (file: File) => {
        if (file && file.type.startsWith('image/')) {
            if (file.size <= 5 * 1024 * 1024) { // 5MB limit
                setImageFile(file);
                const reader = new FileReader();
                reader.onloadend = () => {
                    setImagePreview(reader.result as string);
                };
                reader.readAsDataURL(file);
            } else {
                alert('File size must be less than 5MB');
            }
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) {
            handleImageChange(file);
        }
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleImageChange(file);
        }
    };

    const handleSubmit = async () => {
        let valid = true;
        if (!typeName.trim()) {
            setNameError('Type name is required.');
            valid = false;
        } else {
            setNameError('');
        }
        if (!imageFile) {
            setImageError('Type image is required.');
            valid = false;
        } else {
            setImageError('');
        }
        if (!valid) return;
        const result = await dispatch(
            createJewelleryType({ label: typeName.trim(), status, image: imageFile })
        );
        if (createJewelleryType.fulfilled.match(result)) {
            setTypeName('');
            setStatus('active');
            setImageFile(null);
            setImagePreview(null);
            setNameError('');
            setImageError('');
            dispatch(resetJewelleryTypeCreate());
            onSuccess();
            onClose();
        }
    };

    const handleCancel = () => {
        setTypeName('');
        setStatus('active');
        setImageFile(null);
        setImagePreview(null);
        setNameError('');
        setImageError('');
        dispatch(resetJewelleryTypeCreate());
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 lg:p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 cursor-pointer"
                onClick={handleCancel}
            />

            {/* Modal Content */}
            <div
                className="relative bg-white rounded-2xl md:rounded-3xl lg:rounded-3xl w-full max-w-md md:max-w-lg lg:max-w-lg z-10 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 md:p-5 lg:p-6 pb-3 md:pb-3.5 lg:pb-4">
                    <h2 className="text-lg md:text-xl lg:text-2xl font-semibold text-[#111827] leading-tight md:leading-snug lg:leading-normal">
                        Add Jewelery Type
                    </h2>
                    <p className="text-xs md:text-xs lg:text-sm text-[#515151] mt-1.5 md:mt-1.5 lg:mt-2 leading-tight md:leading-snug lg:leading-normal">
                        Create a new jewelery type for categorization
                    </p>
                </div>

                {/* Separator Line */}
                <div className="h-px bg-[#E5E5E5] mx-4 md:mx-5 lg:mx-6" />

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
                            onChange={(e) => {
                                setTypeName(e.target.value);
                                if (e.target.value.trim()) setNameError('');
                            }}
                            placeholder="e.g., Ring, Necklace, Bracelet"
                            className={`w-full px-3 md:px-3.5 lg:px-4 py-2 md:py-2.5 lg:py-3 rounded-lg bg-[#F9F9F9] border text-xs md:text-sm lg:text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#2C62B9] focus:border-transparent transition-all leading-tight md:leading-snug lg:leading-normal ${nameError ? 'border-red-400' : 'border-[#F1F1F1]'
                                }`}
                        />
                        {nameError && (
                            <p className="text-xs text-red-500 mt-1">{nameError}</p>
                        )}
                    </div>

                    {/* Type Image Upload */}
                    <div>
                        <label className="block text-xs md:text-sm lg:text-sm font-medium text-[#111827] mb-1.5 md:mb-1.5 lg:mb-2 leading-tight md:leading-snug lg:leading-normal">
                            Type Image <span className="text-red-500">*</span>
                        </label>
                        <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            className={`relative border-2 border-dashed rounded-lg p-5 md:p-6 lg:p-8 transition-all cursor-pointer ${isDragging
                                    ? 'border-[#2C62B9] bg-[#EBF3FE]'
                                    : imageError
                                        ? 'border-red-400 bg-[#FAFAFA]'
                                        : 'border-[#D1D5DB] bg-[#FAFAFA]'
                                }`}
                        >
                            <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                onChange={(e) => {
                                    handleFileInput(e);
                                    if (e.target.files?.[0]) setImageError('');
                                }}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <div className="flex flex-col items-center justify-center text-center">
                                {imagePreview ? (
                                    <img
                                        src={imagePreview}
                                        alt="Preview"
                                        className="w-20 h-20 md:w-22 md:h-22 lg:w-24 lg:h-24 object-cover rounded-lg"
                                    />
                                ) : (
                                    <>
                                        <ImageIcon className="w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 text-[#9CA3AF] mb-2 md:mb-2.5 lg:mb-3" strokeWidth={1.5} />
                                        <p className="text-xs md:text-sm lg:text-sm font-medium text-[#111827] mb-0.5 md:mb-0.5 lg:mb-1 leading-tight md:leading-snug lg:leading-normal">
                                            Click to upload or drag & drop
                                        </p>
                                        <p className="text-[10px] md:text-xs lg:text-xs text-[#9CA3AF] leading-tight md:leading-snug lg:leading-normal">
                                            PNG, JPG, WEBP up to 5MB
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>
                        {imageError && (
                            <p className="text-xs text-red-500 mt-1">{imageError}</p>
                        )}
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
                            disabled={!typeName.trim() || submitting}
                            className="flex-1 px-4 md:px-5 lg:px-6 py-2 md:py-2.5 lg:py-3 rounded-3xl bg-[#2C62B9] text-white text-xs md:text-sm lg:text-sm font-medium hover:bg-[#244E9A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer leading-tight md:leading-snug lg:leading-normal flex items-center justify-center gap-2"
                        >
                            {submitting ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Adding...
                                </>
                            ) : (
                                'Add Type'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AddJewelryTypeModal;
