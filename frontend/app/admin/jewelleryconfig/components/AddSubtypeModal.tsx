'use client';

import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { createJewellerySubtype, resetJewellerySubtypeCreate } from '@/redux/slices/admin/jewellery/adminJewellerySubtypeCreateSlice';

interface AddSubtypeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    typeId: string;
    parentTypeName: string;
}

const AddSubtypeModal: React.FC<AddSubtypeModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    typeId,
    parentTypeName,
}) => {
    const dispatch = useAppDispatch();
    const { loading, error, success } = useAppSelector((s) => s.adminJewellerySubtypeCreate);

    const [subtypeName, setSubtypeName] = useState('');
    const [status, setStatus] = useState<'active' | 'disabled'>('active');

    useEffect(() => {
        if (success) {
            dispatch(resetJewellerySubtypeCreate());
            setSubtypeName('');
            setStatus('active');
            onSuccess();
        }
    }, [success, dispatch, onSuccess]);

    if (!isOpen) return null;

    const handleSubmit = () => {
        if (!subtypeName.trim() || !typeId) return;
        dispatch(createJewellerySubtype({
            type_id: typeId,
            label: subtypeName.trim(),
            status,
        }));
    };

    const handleCancel = () => {
        setSubtypeName('');
        setStatus('active');
        dispatch(resetJewellerySubtypeCreate());
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 lg:p-4">
            <div
                className="absolute inset-0 bg-black/50 cursor-pointer"
                onClick={handleCancel}
            />

            <div
                className="relative bg-white rounded-2xl md:rounded-3xl lg:rounded-3xl w-full max-w-xl md:max-w-xl lg:max-w-2xl z-10 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 md:p-5 lg:p-6 pb-3 md:pb-3.5 lg:pb-4 flex items-start justify-between">
                    <div>
                        <h2 className="text-lg md:text-xl lg:text-2xl font-semibold text-[#111827] leading-tight md:leading-snug lg:leading-normal">
                            Add Jewelery Subtype
                        </h2>
                        <p className="text-xs md:text-xs lg:text-sm text-[#515151] mt-1.5 md:mt-1.5 lg:mt-2 leading-tight md:leading-snug lg:leading-normal">
                            Create a new subtype for {parentTypeName}
                        </p>
                    </div>
                    <button
                        onClick={handleCancel}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer mt-0.5"
                    >
                        <X className="w-4 h-4 md:w-5 md:h-5" strokeWidth={2} color="#6B7280" />
                    </button>
                </div>

                <div className="h-px bg-[#D5D5D5] mx-4 md:mx-5 lg:mx-6" />

                {/* Form */}
                <div className="p-4 md:p-5 lg:p-6 space-y-4 md:space-y-5 lg:space-y-6">
                    {/* Parent Type (read-only) */}
                    <div>
                        <label className="block text-xs md:text-sm lg:text-sm font-medium text-[#1E1E1E] mb-1.5 md:mb-1.5 lg:mb-2 leading-tight md:leading-snug lg:leading-normal">
                            Parent Jewelery Type
                        </label>
                        <div className="w-full px-3 md:px-3.5 lg:px-4 py-2 md:py-2.5 lg:py-3 rounded-lg bg-[#F1F1F1] border border-[#F1F1F1] text-xs md:text-sm lg:text-sm text-[#6D6D6D] leading-tight md:leading-snug lg:leading-normal">
                            {parentTypeName}
                        </div>
                    </div>

                    {/* Subtype Name */}
                    <div>
                        <label className="block text-xs md:text-sm lg:text-sm font-medium text-[#1E1E1E] mb-1.5 md:mb-1.5 lg:mb-2 leading-tight md:leading-snug lg:leading-normal">
                            Subtype Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={subtypeName}
                            onChange={(e) => setSubtypeName(e.target.value)}
                            placeholder="e.g., Engagement Ring, Wedding Band"
                            className="w-full px-3 md:px-3.5 lg:px-4 py-2 md:py-2.5 lg:py-3 rounded-lg bg-[#F9F9F9] border border-[#F1F1F1] text-xs md:text-sm lg:text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#2C62B9] focus:border-transparent transition-all leading-tight md:leading-snug lg:leading-normal"
                        />
                    </div>

                    {/* Status */}
                    <div>
                        <label className="block text-xs md:text-sm lg:text-sm font-medium text-[#1E1E1E] mb-2 md:mb-2.5 lg:mb-3 leading-tight md:leading-snug lg:leading-normal">
                            Status
                        </label>
                        <div className="flex items-center gap-4 md:gap-5 lg:gap-6">
                            <label className="flex items-center gap-1.5 md:gap-2 lg:gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="subtype-status"
                                    value="active"
                                    checked={status === 'active'}
                                    onChange={() => setStatus('active')}
                                    className="w-4 h-4 text-[#2C62B9] border-gray-300 focus:ring-[#2C62B9] cursor-pointer"
                                />
                                <span className="text-xs md:text-sm lg:text-sm font-medium text-[#111827]">Active</span>
                            </label>
                            <label className="flex items-center gap-1.5 md:gap-2 lg:gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="subtype-status"
                                    value="disabled"
                                    checked={status === 'disabled'}
                                    onChange={() => setStatus('disabled')}
                                    className="w-4 h-4 text-gray-400 border-gray-300 focus:ring-gray-400 cursor-pointer"
                                />
                                <span className="text-xs md:text-sm lg:text-sm font-medium text-[#111827]">Inactive</span>
                            </label>
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <p className="text-xs md:text-sm text-red-500">{error}</p>
                    )}
                </div>

                <div className="h-px bg-[#D5D5D5] mx-4 md:mx-5 lg:mx-6" />

                {/* Footer */}
                <div className="p-4 md:p-5 lg:p-6 flex items-center gap-2 md:gap-2.5 lg:gap-3">
                    <button
                        onClick={handleCancel}
                        disabled={loading}
                        className="flex-1 px-4 md:px-5 lg:px-6 py-2 md:py-2.5 lg:py-3 rounded-3xl bg-[#EBF3FE] text-[#373737] text-xs md:text-sm lg:text-sm font-medium hover:bg-[#D6E7FC] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed leading-tight md:leading-snug lg:leading-normal"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!subtypeName.trim() || loading}
                        className="flex-1 px-4 md:px-5 lg:px-6 py-2 md:py-2.5 lg:py-3 rounded-3xl bg-[#2C62B9] text-white text-xs md:text-sm lg:text-sm font-medium hover:bg-[#244E9A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer leading-tight md:leading-snug lg:leading-normal flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Adding...
                            </>
                        ) : (
                            'Add Subtype'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddSubtypeModal;
