import React, { useState, useRef, useEffect } from 'react';
import { Edit2, Trash2, MoreVertical } from 'lucide-react';
import Image from 'next/image';
import DisableTypeConfirmModal from './DisableTypeConfirmModal';
import EnableTypeConfirmModal from './EnableTypeConfirmModal';
import DeleteTypeConfirmModal from './DeleteTypeConfirmModal';

export interface JewelryType {
    id: string;
    name: string;
    status: 'active' | 'disabled';
    image: string;
}

interface JewelryTypeCardProps {
    type: JewelryType;
    selected: boolean;
    onClick: () => void;
    onEdit: (e: React.MouseEvent) => void;
    onDelete: (e: React.MouseEvent) => void;
    onToggleStatus: () => void;
}

const JewelryTypeCard: React.FC<JewelryTypeCardProps> = ({
    type,
    selected,
    onClick,
    onEdit,
    onDelete,
    onToggleStatus
}) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isDisableModalOpen, setIsDisableModalOpen] = useState(false);
    const [isEnableModalOpen, setIsEnableModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };

        if (isMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isMenuOpen]);

    const handleMenuToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsMenuOpen(!isMenuOpen);
    };

    const handleEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsMenuOpen(false);
        onEdit(e);
    };

    const handleToggleStatus = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsMenuOpen(false);
        
        // If type is active, show disable confirmation modal
        if (type.status === 'active') {
            setIsDisableModalOpen(true);
        } else {
            // If disabled, show enable confirmation modal
            setIsEnableModalOpen(true);
        }
    };

    const handleConfirmDisable = () => {
        setIsDisableModalOpen(false);
        onToggleStatus();
    };

    const handleConfirmEnable = () => {
        setIsEnableModalOpen(false);
        onToggleStatus();
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsMenuOpen(false);
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = () => {
        setIsDeleteModalOpen(false);
        // Create a synthetic event for onDelete
        const syntheticEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
        }) as unknown as React.MouseEvent;
        onDelete(syntheticEvent);
    };
    return (
        <div
            onClick={onClick}
            className={`relative rounded-xl md:rounded-2xl lg:rounded-2xl p-3 md:p-4 lg:p-6 cursor-pointer transition-all duration-200 ${
                selected
                    ? 'border-2 border-[#C2D8FC]'
                    : type.status === 'disabled'
                    ? 'border border-[#D5D5D5]'
                    : 'border border-[#F1F1F1] hover:shadow-sm'
            } ${
                type.status === 'disabled' ? 'bg-[#F1F1F1]' : 'bg-white'
            }`}
        >
            {/* Top Section - Title, Status Badge, and Action Buttons */}
            <div className="flex items-center justify-between mb-2 md:mb-3 lg:mb-4">
                {/* Left Side - Title and Status */}
                <div className="flex items-center gap-1.5 md:gap-2 lg:gap-3">
                    <span 
                        className={`font-semibold text-sm md:text-base lg:text-xl leading-tight md:leading-snug lg:leading-normal ${
                            type.status === 'disabled' ? 'text-[#8A8A8A]' : 'text-[#111827]'
                        }`}
                    >
                        {type.name}
                    </span>
                    <span 
                        className={`px-2 md:px-2.5 lg:px-3 py-0.5 md:py-0.5 lg:py-1 rounded-full text-[10px] md:text-[11px] lg:text-xs font-medium whitespace-nowrap leading-tight md:leading-snug lg:leading-normal ${
                            type.status === 'active' 
                                ? 'bg-[#DCFCE7] text-[#1D8C1D]' 
                                : 'bg-[#E3E3E3] text-[#8A8A8A]'
                        }`}
                    >
                        {type.status === 'active' ? 'Active' : 'Disabled'}
                    </span>
                </div>
                
                {/* Right Side - Action Menu */}
                <div className="relative" ref={menuRef}>
                    <button
                        onClick={handleMenuToggle}
                        className="p-1 md:p-1.5 lg:p-2 hover:bg-gray-100 rounded-md md:rounded-lg lg:rounded-lg transition-colors cursor-pointer"
                    >
                        <MoreVertical className="w-4 h-4 md:w-5 md:h-5 lg:w-5 lg:h-5" strokeWidth={2} color="#1A1A1A" />
                    </button>

                    {/* Dropdown Menu */}
                    {isMenuOpen && (
                        <div className="absolute right-0 top-full mt-1 w-32 md:w-36 lg:w-40 bg-white rounded-lg md:rounded-xl lg:rounded-xl shadow-lg border border-gray-200 py-1 md:py-1.5 lg:py-2 z-50">
                            {/* Edit Option */}
                            <button
                                onClick={handleEdit}
                                className="w-full px-2 md:px-3 lg:px-4 py-1.5 md:py-2 lg:py-2.5 flex items-center gap-2 md:gap-2.5 lg:gap-3 hover:bg-gray-50 transition-colors text-left cursor-pointer"
                            >
                                <Edit2 className="w-3.5 h-3.5 md:w-4 md:h-4 lg:w-4 lg:h-4" strokeWidth={2} color="#1A1A1A" />
                                <span className="text-xs md:text-sm lg:text-sm font-medium text-[#1A1A1A] leading-tight md:leading-snug lg:leading-normal">Edit</span>
                            </button>

                            {/* Toggle Status Option */}
                            <button
                                onClick={handleToggleStatus}
                                className="w-full px-2 md:px-3 lg:px-4 py-1.5 md:py-2 lg:py-2.5 flex items-center gap-2 md:gap-2.5 lg:gap-3 hover:bg-gray-50 transition-colors text-left cursor-pointer"
                            >
                                <svg 
                                    className="w-3.5 h-3.5 md:w-4 md:h-4 lg:w-4 lg:h-4 shrink-0"
                                    viewBox="0 0 16 16" 
                                    fill="none" 
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <circle 
                                        cx="8" 
                                        cy="8" 
                                        r="7" 
                                        stroke={type.status === 'active' ? '#F97316' : '#22C55E'}
                                        strokeWidth="2"
                                    />
                                    {type.status === 'active' ? (
                                        <line 
                                            x1="5" 
                                            y1="8" 
                                            x2="11" 
                                            y2="8" 
                                            stroke="#F97316" 
                                            strokeWidth="2" 
                                            strokeLinecap="round"
                                        />
                                    ) : (
                                        <path 
                                            d="M5 8L7 10L11 6" 
                                            stroke="#22C55E" 
                                            strokeWidth="2" 
                                            strokeLinecap="round" 
                                            strokeLinejoin="round"
                                        />
                                    )}
                                </svg>
                                <span className={`text-xs md:text-sm lg:text-sm font-medium leading-tight md:leading-snug lg:leading-normal ${
                                    type.status === 'active' ? 'text-[#F97316]' : 'text-[#22C55E]'
                                }`}>
                                    {type.status === 'active' ? 'Disabled' : 'Enable'}
                                </span>
                            </button>

                            {/* Delete Option */}
                            <button
                                onClick={handleDelete}
                                className="w-full px-2 md:px-3 lg:px-4 py-1.5 md:py-2 lg:py-2.5 flex items-center gap-2 md:gap-2.5 lg:gap-3 hover:bg-gray-50 transition-colors text-left cursor-pointer"
                            >
                                <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4 lg:w-4 lg:h-4" strokeWidth={2} color="#EF4444" />
                                <span className="text-xs md:text-sm lg:text-sm font-medium text-[#EF4444] leading-tight md:leading-snug lg:leading-normal">Delete</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Image Container */}
            <div className="relative w-full h-32 md:h-36 lg:h-44 overflow-hidden rounded bg-gray-100 flex items-center justify-center">
                {type.image ? (
                    <Image
                        src={type.image}
                        alt={type.name}
                        fill
                        className={`object-cover transition-all ${
                            type.status === 'disabled' ? 'grayscale opacity-60' : ''
                        }`}
                        unoptimized
                    />
                ) : (
                    <span className="text-xs text-gray-400 select-none">No Image</span>
                )}
            </div>

            {/* Disable Confirmation Modal */}
            <DisableTypeConfirmModal
                isOpen={isDisableModalOpen}
                onClose={() => setIsDisableModalOpen(false)}
                onConfirm={handleConfirmDisable}
                typeName={type.name}
            />

            {/* Enable Confirmation Modal */}
            <EnableTypeConfirmModal
                isOpen={isEnableModalOpen}
                onClose={() => setIsEnableModalOpen(false)}
                onConfirm={handleConfirmEnable}
                typeName={type.name}
            />

            {/* Delete Confirmation Modal */}
            <DeleteTypeConfirmModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleConfirmDelete}
                typeName={type.name}
            />
        </div>
    );
};

export default JewelryTypeCard;
