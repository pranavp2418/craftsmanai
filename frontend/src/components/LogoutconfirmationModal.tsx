/**
 * Reusable Confirmation Modal Component
 * 
 * A flexible, customizable confirmation modal that can be used globally throughout the application.
 * 
 * @example
 * // Basic usage for logout confirmation
 * import ConfirmationModal from '@/src/components/ConfirmationModal';
 * import { LogOut } from 'lucide-react'; 
 * 
 * <ConfirmationModal
 *   isOpen={showModal}
 *   onClose={() => setShowModal(false)}
 *   onConfirm={handleLogout}
 *   icon={LogOut}
 *   title="Logout Confirmation"
 *   description="Are you sure you want to logout?"
 *   confirmText="Logout"
 * />
 * 
 * @example
 * // Delete confirmation with custom colors
 * import { Trash2 } from 'lucide-react';
 * 
 * <ConfirmationModal
 *   isOpen={showDeleteModal}
 *   onClose={() => setShowDeleteModal(false)}
 *   onConfirm={handleDelete}
 *   icon={Trash2}
 *   iconBgColor="bg-red-100"
 *   iconColor="text-red-600"
 *   title="Delete Item"
 *   description="This action cannot be undone."
 *   confirmText="Delete"
 *   confirmButtonColor="bg-red-600"
 *   confirmButtonHoverColor="hover:bg-red-700"
 * />
 */

import React from 'react';
import { LucideIcon, Loader2 } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  icon: LucideIcon;
  iconBgColor?: string;
  iconColor?: string;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  confirmButtonColor?: string;
  confirmButtonHoverColor?: string;
  isLoading?: boolean;
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  icon: Icon,
  iconBgColor = 'bg-red-100',
  iconColor = 'text-red-600',
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmButtonColor = 'bg-red-600',
  confirmButtonHoverColor = 'hover:bg-red-700',
  isLoading = false,
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop - Covers entire page including sidebar */}
      <div 
        className="fixed inset-0 bg-[#00000080] mb-0 backdrop-blur-sm transition-opacity z-100 animate-fade-in"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-101 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl md:rounded-3xl shadow-2xl max-w-md w-full p-5 md:p-6 lg:p-8 animate-scale-in">
          {/* Icon and Title */}
          <div className="flex items-start gap-3 md:gap-4 mb-3 md:mb-4">
            <div className={`shrink-0 w-12 h-12 md:w-14 md:h-14 ${iconBgColor} rounded-xl md:rounded-2xl flex items-center justify-center`}>
              <Icon className={`w-6 h-6 md:w-7 md:h-7 ${iconColor}`} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg md:text-xl font-semibold text-gray-900 mb-1.5 md:mb-2 leading-tight">
                {title}
              </h3>
              <p className="text-gray-600 text-xs md:text-sm leading-snug md:leading-relaxed">
                {description}
              </p>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2 md:gap-3 mt-5 md:mt-6 lg:mt-8">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 md:px-6 py-2.5 md:py-3 lg:py-3.5 bg-white border border-[#2F68C5] text-[#2F68C5] text-sm md:text-base font-medium rounded-[24px] hover:bg-blue-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className={`flex-1 px-4 md:px-6 py-2.5 md:py-3 lg:py-3.5 ${confirmButtonColor} text-white text-sm md:text-base font-semibold rounded-[24px] ${confirmButtonHoverColor} transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
