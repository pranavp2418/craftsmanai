'use client';

import React, { useState, useEffect } from 'react';
import AppLayout from '@/src/components/app-layout';
import { Plus } from 'lucide-react';
import JewelryTypeCard, { JewelryType } from './components/jewellryType';
import JewelrySubtypeTable, { JewelrySubtype } from './components/jewellrySubtype';
import AddJewelryTypeModal from './components/AddJewelryTypeModal';
import EditJewelryTypeModal from './components/EditJewelryTypeModal';
import AddSubtypeModal from './components/AddSubtypeModal';
import EditSubtypeModal from './components/EditSubtypeModal';
import DisableSubtypeConfirmModal from './components/DisableSubtypeConfirmModal';
import EnableSubtypeConfirmModal from './components/EnableSubtypeConfirmModal';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { fetchAdminJewelleryTypes } from '@/redux/slices/admin/jewellery/adminJewelleryTypesSlice';
import { toggleJewelleryTypeStatus } from '@/redux/slices/admin/jewellery/adminJewelleryTypeStatusSlice';
import { deleteJewelleryType, resetJewelleryTypeDelete } from '@/redux/slices/admin/jewellery/adminJewelleryTypeDeleteSlice';
import DeleteTypeConfirmModal from './components/DeleteTypeConfirmModal';
import { fetchAdminJewellerySubtypes, resetJewellerySubtypes } from '@/redux/slices/admin/jewellery/adminJewellerySubtypesSlice';
import { toggleJewellerySubtypeStatus, resetJewellerySubtypeStatus } from '@/redux/slices/admin/jewellery/adminJewellerySubtypeStatusSlice';
import { toast } from 'react-toastify';

export default function JewelryConfigPage() {
    const dispatch = useAppDispatch();
    const { types: apiTypes, loading: typesLoading } = useAppSelector((s) => s.adminJewelleryTypes);
    const { loading: deleteLoading, error: deleteError } = useAppSelector((s) => s.adminJewelleryTypeDelete);
    const { subtypes: apiSubtypes, loading: subtypesLoading } = useAppSelector((s) => s.adminJewellerySubtypes);
    const { loading: subtypeStatusLoading, error: subtypeStatusError } = useAppSelector((s) => s.adminJewellerySubtypeStatus);

    const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
    const [types, setTypes] = useState<JewelryType[]>([]);
    const [isAddTypeModalOpen, setIsAddTypeModalOpen] = useState(false);
    const [isEditTypeModalOpen, setIsEditTypeModalOpen] = useState(false);
    const [isAddSubtypeModalOpen, setIsAddSubtypeModalOpen] = useState(false);
    const [isEditSubtypeModalOpen, setIsEditSubtypeModalOpen] = useState(false);
    const [isDisableSubtypeModalOpen, setIsDisableSubtypeModalOpen] = useState(false);
    const [isEnableSubtypeModalOpen, setIsEnableSubtypeModalOpen] = useState(false);
    const [isDeleteTypeModalOpen, setIsDeleteTypeModalOpen] = useState(false);
    const [deletingType, setDeletingType] = useState<JewelryType | null>(null);
    const [editingType, setEditingType] = useState<JewelryType | null>(null);
    const [editingSubtype, setEditingSubtype] = useState<JewelrySubtype | null>(null);
    const [togglingSubtype, setTogglingSubtype] = useState<JewelrySubtype | null>(null);

    // Fetch types from API on mount
    useEffect(() => {
        dispatch(fetchAdminJewelleryTypes());
    }, [dispatch]);

    // Sync local types state when API data arrives
    useEffect(() => {
        if (apiTypes.length > 0) {
            setTypes(apiTypes);
            // Auto-select first type
            setSelectedTypeId((prev) => prev ?? apiTypes[0]?.id ?? null);
        }
    }, [apiTypes]);

    // Fetch subtypes when selected type changes
    useEffect(() => {
        if (selectedTypeId) {
            dispatch(fetchAdminJewellerySubtypes(selectedTypeId));
        } else {
            dispatch(resetJewellerySubtypes());
        }
    }, [selectedTypeId, dispatch]);

    const selectedType = types.find(t => t.id === selectedTypeId);
    const currentSubtypes = apiSubtypes;

    const handleEditType = (e: React.MouseEvent, type: JewelryType) => {
        e.stopPropagation();
        setEditingType(type);
        setIsEditTypeModalOpen(true);
    };

    const handleDeleteType = (e: React.MouseEvent, type: JewelryType) => {
        e.stopPropagation();
        setDeletingType(type);
        setIsDeleteTypeModalOpen(true);
    };

    const handleConfirmDeleteType = async () => {
        if (!deletingType) return;
        const result = await dispatch(deleteJewelleryType(deletingType.id));
        if (deleteJewelleryType.fulfilled.match(result)) {
            setTypes((prev) => prev.filter((t) => t.id !== deletingType.id));
            if (selectedTypeId === deletingType.id) setSelectedTypeId(null);
            dispatch(resetJewelleryTypeDelete());
            setIsDeleteTypeModalOpen(false);
            toast.success(`"${deletingType.name}" has been deleted.`);
            setDeletingType(null);
        }
    };

    const handleToggleTypeStatus = async (type: JewelryType) => {
        const newStatus = type.status === 'active' ? 'disabled' : 'active';
        const result = await dispatch(toggleJewelleryTypeStatus({ type_id: type.id, status: newStatus }));
        if (toggleJewelleryTypeStatus.fulfilled.match(result)) {
            const updated = result.payload;
            setTypes((prev) => prev.map((t) => t.id === updated.id ? { ...t, ...updated } : t));
            toast.success(`"${type.name}" has been ${newStatus === 'active' ? 'enabled' : 'disabled'}.`);
        } else {
            toast.error((result.payload as string) || 'Failed to update status.');
        }
    };

    const handleEditSubtype = (subtype: JewelrySubtype) => {
        setEditingSubtype(subtype);
        setIsEditSubtypeModalOpen(true);
    };

    const handleToggleSubtype = (subtype: JewelrySubtype) => {
        setTogglingSubtype(subtype);
        if (subtype.status === 'active') {
            setIsDisableSubtypeModalOpen(true);
        } else {
            setIsEnableSubtypeModalOpen(true);
        }
    };

    const handleConfirmToggleSubtype = async () => {
        if (!togglingSubtype) return;
        const newStatus = togglingSubtype.status === 'active' ? 'disabled' : 'active';
        const result = await dispatch(toggleJewellerySubtypeStatus({ subtype_id: togglingSubtype.id, status: newStatus }));
        if (toggleJewellerySubtypeStatus.fulfilled.match(result)) {
            dispatch(resetJewellerySubtypeStatus());
            setIsDisableSubtypeModalOpen(false);
            setIsEnableSubtypeModalOpen(false);
            toast.success(`"${togglingSubtype.name}" has been ${newStatus === 'active' ? 'enabled' : 'disabled'}.`);
            setTogglingSubtype(null);
            if (selectedTypeId) dispatch(fetchAdminJewellerySubtypes(selectedTypeId));
        } else {
            toast.error((result.payload as string) || 'Failed to update subtype status.');
        }
    };

    // After successful add, refresh list from API
    const handleAddSuccess = () => {
        dispatch(fetchAdminJewelleryTypes());
        toast.success('Jewelery type added successfully.');
    };

    // After successful edit, refresh list from API
    const handleEditSuccess = () => {
        dispatch(fetchAdminJewelleryTypes());
        toast.success('Jewelery type updated successfully.');
    };

    return (
        <AppLayout
            appName="Craftsman.ai"
            headerTitle="Jewellery Configuration"
            headerDescription="Manage jewellery types and subtypes for AI detection, quizzes, and product categorization"
        >
            <div className="space-y-6 pb-8">
                {/* Jewellery Types Section */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-6 pb-6" style={{ borderBottom: '2px solid #D5D5D5' }}>
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">Jewelery Types</h2>
                            <p className="text-sm text-gray-500 mt-1">Select a type to view subtypes</p>
                        </div>
                        <button
                            onClick={() => setIsAddTypeModalOpen(true)}
                            className="flex items-center gap-2 bg-[#2C62B9] text-white px-5 py-2.5 rounded-3xl hover:bg-[#244E9A] transition-colors text-sm font-medium cursor-pointer whitespace-nowrap"
                        >
                            <Plus size={18} />
                            Add Type
                        </button>
                    </div>

                    {typesLoading ? (
                        // Shimmer skeleton for type cards
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="rounded-xl border border-gray-100 overflow-hidden">
                                    {/* Image placeholder */}
                                    <div className="h-40 bg-gray-200 w-full" />
                                    {/* Content placeholder */}
                                    <div className="p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="h-4 w-28 bg-gray-200 rounded" />
                                            <div className="h-5 w-14 bg-gray-200 rounded-full" />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="h-8 w-8 bg-gray-200 rounded-lg" />
                                            <div className="h-8 w-8 bg-gray-200 rounded-lg" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : types.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 bg-gray-50 rounded-xl border border-gray-200">
                            <div className="p-3 bg-blue-100 rounded-full mb-4">
                                <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-1">No Jewelery Types</h3>
                            <p className="text-sm text-gray-600 mb-6 max-w-xs text-center">Create your first jewelery type to get started with AI detection and product categorization.</p>
                            <button
                                onClick={() => setIsAddTypeModalOpen(true)}
                                className="flex items-center gap-2 bg-[#2C62B9] text-white px-5 py-2.5 rounded-full hover:bg-[#244E9A] transition-colors text-sm font-medium"
                            >
                                <Plus size={18} />
                                Create First Type
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {types.map((type) => (
                                <JewelryTypeCard
                                    key={type.id}
                                    type={type}
                                    selected={selectedTypeId === type.id}
                                    onClick={() => setSelectedTypeId(type.id)}
                                    onEdit={(e) => handleEditType(e, type)}
                                    onDelete={(e) => handleDeleteType(e, type)}
                                    onToggleStatus={() => handleToggleTypeStatus(type)}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Jewellery Subtypes Section */}
                {selectedTypeId && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-6 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-semibold text-gray-900">Jewelery Subtypes</h2>
                                <p className="text-sm text-gray-500 mt-1">Subtypes for {selectedType?.name}</p>
                            </div>
                            <button
                                onClick={() => setIsAddSubtypeModalOpen(true)}
                                className="flex items-center gap-2 bg-[#2C62B9] text-white px-5 py-2.5 rounded-3xl hover:bg-[#244E9A] transition-colors text-sm font-medium cursor-pointer whitespace-nowrap"
                            >
                                <Plus size={18} />
                                Add Subtype
                            </button>
                        </div>

                        <div className="p-6">
                            {subtypesLoading ? (
                                <div className="animate-pulse space-y-2">
                                    {/* Table header shimmer */}
                                    <div className="grid grid-cols-4 gap-4 bg-[#F1F1F1] rounded-xl px-4 py-3 mb-2">
                                        {Array.from({ length: 4 }).map((_, i) => (
                                            <div key={i} className="h-3 bg-gray-300 rounded w-3/4" />
                                        ))}
                                    </div>
                                    {/* Row shimmers */}
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <div key={i} className="grid grid-cols-4 gap-4 px-4 py-3 border-b border-gray-100">
                                            <div className="h-3.5 bg-gray-200 rounded w-2/3" />
                                            <div className="h-5 bg-gray-200 rounded-full w-16" />
                                            <div className="h-3.5 bg-gray-200 rounded w-8" />
                                            <div className="flex gap-2">
                                                <div className="h-7 w-7 bg-gray-200 rounded-lg" />
                                                <div className="h-7 w-7 bg-gray-200 rounded-lg" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : currentSubtypes.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 bg-gray-50 rounded-xl border border-gray-200">
                                    <div className="p-3 bg-blue-100 rounded-full mb-4">
                                        <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-base font-semibold text-gray-900 mb-1">No Subtypes Yet</h3>
                                    <p className="text-sm text-gray-600 mb-5 max-w-xs text-center">Add subtypes to {selectedType?.name} to categorize jewelery items.</p>
                                    <button
                                        onClick={() => setIsAddSubtypeModalOpen(true)}
                                        className="flex items-center gap-2 bg-[#2C62B9] text-white px-5 py-2 rounded-full hover:bg-[#244E9A] transition-colors text-sm font-medium"
                                    >
                                        <Plus size={16} />
                                        Add First Subtype
                                    </button>
                                </div>
                            ) : (
                                <JewelrySubtypeTable
                                    subtypes={currentSubtypes}
                                    onEdit={handleEditSubtype}
                                    onToggleStatus={handleToggleSubtype}
                                />
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Add Jewelry Type Modal */}
            <AddJewelryTypeModal
                isOpen={isAddTypeModalOpen}
                onClose={() => setIsAddTypeModalOpen(false)}
                onSuccess={handleAddSuccess}
            />

            {/* Delete Type Confirm Modal */}
            <DeleteTypeConfirmModal
                isOpen={isDeleteTypeModalOpen}
                onClose={() => {
                    if (deleteLoading) return;
                    dispatch(resetJewelleryTypeDelete());
                    setIsDeleteTypeModalOpen(false);
                    setDeletingType(null);
                }}
                onConfirm={handleConfirmDeleteType}
                typeName={deletingType?.name || ''}
                loading={deleteLoading}
                error={deleteError}
            />

            {/* Edit Jewelry Type Modal */}
            <EditJewelryTypeModal
                isOpen={isEditTypeModalOpen}
                onClose={() => {
                    setIsEditTypeModalOpen(false);
                    setEditingType(null);
                }}
                onSuccess={handleEditSuccess}
                type={editingType}
            />

            {/* Add Subtype Modal */}
            <AddSubtypeModal
                isOpen={isAddSubtypeModalOpen}
                onClose={() => setIsAddSubtypeModalOpen(false)}
                onSuccess={() => {
                    setIsAddSubtypeModalOpen(false);
                    toast.success('Subtype added successfully.');
                    if (selectedTypeId) dispatch(fetchAdminJewellerySubtypes(selectedTypeId));
                }}
                typeId={selectedTypeId ?? ''}
                parentTypeName={selectedType?.name || ''}
            />

            {/* Edit Subtype Modal */}
            <EditSubtypeModal
                isOpen={isEditSubtypeModalOpen}
                onClose={() => {
                    setIsEditSubtypeModalOpen(false);
                    setEditingSubtype(null);
                }}
                onSuccess={() => {
                    setIsEditSubtypeModalOpen(false);
                    setEditingSubtype(null);
                    toast.success('Subtype updated successfully.');
                    if (selectedTypeId) dispatch(fetchAdminJewellerySubtypes(selectedTypeId));
                }}
                subtype={editingSubtype}
                parentTypeName={selectedType?.name || ''}
                typeId={selectedTypeId || ''}
            />

            {/* Disable Subtype Confirmation Modal */}
            <DisableSubtypeConfirmModal
                isOpen={isDisableSubtypeModalOpen}
                onClose={() => {
                    if (subtypeStatusLoading) return;
                    dispatch(resetJewellerySubtypeStatus());
                    setIsDisableSubtypeModalOpen(false);
                    setTogglingSubtype(null);
                }}
                onConfirm={handleConfirmToggleSubtype}
                subtypeName={togglingSubtype?.name || ''}
                loading={subtypeStatusLoading}
                error={subtypeStatusError}
            />

            {/* Enable Subtype Confirmation Modal */}
            <EnableSubtypeConfirmModal
                isOpen={isEnableSubtypeModalOpen}
                onClose={() => {
                    if (subtypeStatusLoading) return;
                    dispatch(resetJewellerySubtypeStatus());
                    setIsEnableSubtypeModalOpen(false);
                    setTogglingSubtype(null);
                }}
                onConfirm={handleConfirmToggleSubtype}
                subtypeName={togglingSubtype?.name || ''}
                loading={subtypeStatusLoading}
                error={subtypeStatusError}
            />
        </AppLayout>
    );
}
