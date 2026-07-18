"use client"

import { useState, useEffect, useRef } from 'react';
import { X, Star, Plus, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { createSubscriptionPlan, resetCreatePlan } from '@/redux/slices/admin/subscriptions/adminCreatePlanSlice';
import { updateSubscriptionPlan, resetUpdatePlan } from '@/redux/slices/admin/subscriptions/adminUpdatePlanSlice';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialData?: any;
};

export default function CreatePlanModal({ isOpen, onClose, onSuccess, initialData }: Props) {
  const dispatch = useAppDispatch();
  const { loading: creating, error: createError, success: createSuccess } = useAppSelector((s) => s.adminCreatePlan);
  const { loading: updating, error: updateError, success: updateSuccess } = useAppSelector((s) => s.adminUpdatePlan);

  const [isPopular, setIsPopular] = useState(false);
  const [features, setFeatures] = useState<string[]>([]);
  const [newFeature, setNewFeature] = useState('');
  const [name, setName] = useState('');
  const [monthlyPrice, setMonthlyPrice] = useState('0');
  const [yearlyPrice, setYearlyPrice] = useState('0');
  const [description, setDescription] = useState('');
  const [limits, setLimits] = useState({ renders: 0, shares: 0, quotes: 0 });
  const [isActive, setIsActive] = useState(true);
  const [accessOptions, setAccessOptions] = useState({
    canUseLogo: false,
    canUseBrandName: false,
    canUseCustomColor: false,
    hasUnlimitedRenders: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Guard to prevent double onSuccess triggers
  const handledSuccess = useRef(false);

  useEffect(() => {
    if (initialData && isOpen) {
      setName(initialData.name || '');
      setMonthlyPrice(initialData.monthly_price?.toString() || '0');
      setYearlyPrice(initialData.yearly_price?.toString() || (parseInt(initialData.monthly_price?.toString() || '0') * 10).toString());
      setDescription(initialData.description || '');
      setFeatures(initialData.feature_points || []);
      setIsPopular(!!initialData.is_most_popular);
      setIsActive(initialData.is_active !== false);
      setLimits({
        renders: initialData.monthly_renders || 0,
        shares: initialData.customer_shares || 0,
        quotes: initialData.manufacturer_quotes || 0,
      });
      setAccessOptions({
        canUseLogo: Boolean(initialData.can_use_logo),
        canUseBrandName: Boolean(initialData.can_use_brand_name),
        canUseCustomColor: Boolean(initialData.can_use_custom_color),
        hasUnlimitedRenders: Boolean(initialData.has_unlimited_renders),
      });
    } else if (isOpen) {
      setName('');
      setMonthlyPrice('0');
      setYearlyPrice('0');
      setDescription('');
      setFeatures([]);
      setIsPopular(false);
      setIsActive(true);
      setLimits({ renders: 0, shares: 0, quotes: 0 });
      setAccessOptions({
        canUseLogo: false,
        canUseBrandName: false,
        canUseCustomColor: false,
        hasUnlimitedRenders: false,
      });
    }
  }, [initialData, isOpen]);

  useEffect(() => {
    if ((createSuccess || updateSuccess) && isOpen && !handledSuccess.current) {
      handledSuccess.current = true;
      toast.success(initialData ? 'Plan updated successfully.' : 'Plan created successfully.');
      dispatch(resetCreatePlan());
      dispatch(resetUpdatePlan());
      onSuccess?.();
      onClose();
    }
  }, [createSuccess, updateSuccess, isOpen, dispatch, onSuccess, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const controlledFeatures = {
      canUseLogo: 'Logo',
      canUseBrandName: 'Brand Name',
      canUseCustomColor: 'Custom Color',
      hasUnlimitedRenders: 'Unlimited Render',
    };

    const toAdd = [
      accessOptions.canUseLogo ? controlledFeatures.canUseLogo : null,
      accessOptions.canUseBrandName ? controlledFeatures.canUseBrandName : null,
      accessOptions.canUseCustomColor ? controlledFeatures.canUseCustomColor : null,
      accessOptions.hasUnlimitedRenders ? controlledFeatures.hasUnlimitedRenders : null,
    ].filter(Boolean) as string[];

    const toRemove = [
      !accessOptions.canUseLogo ? controlledFeatures.canUseLogo : null,
      !accessOptions.canUseBrandName ? controlledFeatures.canUseBrandName : null,
      !accessOptions.canUseCustomColor ? controlledFeatures.canUseCustomColor : null,
      !accessOptions.hasUnlimitedRenders ? controlledFeatures.hasUnlimitedRenders : null,
    ].filter(Boolean) as string[];

    setFeatures((prevFeatures) => {
      // 1. Remove unchecked features
      const toRemoveLower = new Set(toRemove.map(f => f.trim().toLowerCase()));
      const filtered = prevFeatures.filter(f => !toRemoveLower.has(f.trim().toLowerCase()));

      // 2. Add checked features if not already present
      const existingNames = new Set(filtered.map(f => f.trim().toLowerCase()));
      const mergedFeatures = [...filtered];

      toAdd.forEach((feature) => {
        const normalized = feature.trim().toLowerCase();
        if (!existingNames.has(normalized)) {
          mergedFeatures.push(feature);
          existingNames.add(normalized);
        }
      });

      return mergedFeatures;
    });
  }, [
    isOpen,
    accessOptions.canUseLogo,
    accessOptions.canUseBrandName,
    accessOptions.canUseCustomColor,
    accessOptions.hasUnlimitedRenders,
  ]);

  useEffect(() => {
    const message = updateError || createError;
    if (message) {
      toast.error(message);
    }
  }, [createError, updateError]);

  // Reset the success tracker when the modal is closed
  useEffect(() => {
    if (!isOpen) {
      handledSuccess.current = false;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const addFeature = () => {
    if (!newFeature.trim()) {
      setErrors((prev) => ({ ...prev, newFeature: 'Feature cannot be empty' }));
      return;
    }
    setFeatures([...features, newFeature.trim()]);
    setNewFeature('');
    setErrors((prev) => ({ ...prev, newFeature: '' }));
  };

  const removeFeature = (idx: number) => {
    const removedFeatureText = features[idx]?.trim().toLowerCase();
    
    if (removedFeatureText) {
      if (removedFeatureText === 'logo') {
        setAccessOptions((prev) => ({ ...prev, canUseLogo: false }));
      } else if (removedFeatureText === 'brand name') {
        setAccessOptions((prev) => ({ ...prev, canUseBrandName: false }));
      } else if (removedFeatureText === 'custom color') {
        setAccessOptions((prev) => ({ ...prev, canUseCustomColor: false }));
      } else if (removedFeatureText === 'unlimited render') {
        setAccessOptions((prev) => ({ ...prev, hasUnlimitedRenders: false }));
      }
    }

    setFeatures(features.filter((_, i) => i !== idx));
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Plan name is required';

    const monthly = parseFloat(monthlyPrice);
    const yearly = parseFloat(yearlyPrice);
    if (Number.isNaN(monthly) || monthly < 0) next.monthlyPrice = 'Enter a valid non-negative number';
    if (Number.isNaN(yearly) || yearly < 0) next.yearlyPrice = 'Enter a valid non-negative number';

    if (!description.trim()) next.description = 'Description is required';
    if (features.length === 0) next.features = 'Add at least one feature';

    const renderVal = Number(limits.renders);
    const shareVal = Number(limits.shares);
    const quoteVal = Number(limits.quotes);
    if (!Number.isFinite(renderVal)) next.renders = 'Enter a valid number';
    if (!Number.isFinite(shareVal)) next.shares = 'Enter a valid number';
    if (!Number.isFinite(quoteVal)) next.quotes = 'Enter a valid number';

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSavePlan = async () => {
    if (!validate()) return;
    handledSuccess.current = false;

    const payload = {
      name: name.trim(),
      description: description.trim(),
      price: parseFloat(monthlyPrice) || 0,
      monthly_price: parseFloat(monthlyPrice) || 0,
      yearly_price: parseFloat(yearlyPrice) || 0,
      duration_days: 30,
      is_active: isActive,
      is_most_popular: isPopular,
      feature_points: features,
      monthly_renders: limits.renders,
      customer_shares: limits.shares,
      manufacturer_quotes: limits.quotes,
      can_use_logo: accessOptions.canUseLogo,
      can_use_brand_name: accessOptions.canUseBrandName,
      can_use_custom_color: accessOptions.canUseCustomColor,
      has_unlimited_renders: accessOptions.hasUnlimitedRenders,
    };

    if (initialData?.id) {
      dispatch(updateSubscriptionPlan({ plan_id: initialData.id, payload }));
    } else {
      dispatch(createSubscriptionPlan(payload));
    }
  };

  const handleCancel = () => {
    dispatch(resetCreatePlan());
    dispatch(resetUpdatePlan());
    onClose();
  };

  const submitting = creating || updating;
  const globalError = createError || updateError;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={handleCancel}
      />

      {/* Modal Container */}
      <div className="relative bg-white w-full max-w-[560px] max-h-[90vh] flex flex-col rounded-[24px] shadow-2xl animate-in fade-in zoom-in duration-200 overflow-hidden">
        {/* Header - Stays at top */}
        <div className="px-8 py-5 border-b border-gray-50 flex items-center justify-between shrink-0">
          <h2 className="text-[18px] font-semibold text-[#111827]">
            {initialData ? 'Edit Plan' : 'Create New Plan'}
          </h2>
          <button
            onClick={handleCancel}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 pt-4 space-y-5 no-scrollbar text-left">
          {globalError && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs text-center font-medium">
              {globalError}
            </div>
          )}

          {/* Plan Name */}
          <div>
            <label className="block text-[11px] font-semibold text-[#6B7280] mb-1.5 uppercase tracking-wider">Plan Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErrors((prev) => ({ ...prev, name: '' }));
              }}
              placeholder="e.g. Starter"
              className={`w-full h-[38px] px-4 bg-white border ${errors.name ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : 'border-[#E5E7EB] focus:border-[#2F68C5]'} rounded-[8px] focus:outline-none transition-all placeholder:text-gray-400 text-gray-900 text-[13px]`}
            />
            {errors.name && <p className="text-[11px] text-red-500 mt-1">{errors.name}</p>}
          </div>

          {/* Pricing Row */}
          <div className="grid grid-cols-1  gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-[#6B7280] mb-1.5 uppercase tracking-wider">Monthly Price ($)</label>
              <input
                type="text"
                value={monthlyPrice}
                onChange={(e) => {
                  setMonthlyPrice(e.target.value);
                  setErrors((prev) => ({ ...prev, monthlyPrice: '' }));
                }}
                className={`w-full h-[38px] px-4 bg-white border ${errors.monthlyPrice ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : 'border-[#E5E7EB] focus:border-[#2F68C5]'} rounded-[8px] focus:outline-none transition-all text-gray-900 text-[13px]`}
              />
              {errors.monthlyPrice && <p className="text-[11px] text-red-500 mt-1">{errors.monthlyPrice}</p>}
            </div>
          
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-semibold text-[#6B7280] mb-1.5 uppercase tracking-wider">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setErrors((prev) => ({ ...prev, description: '' }));
              }}
              placeholder="Describe the plan features..."
              className={`w-full px-4 py-2 bg-white border ${errors.description ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : 'border-[#E5E7EB] focus:border-[#2F68C5]'} rounded-[8px] focus:outline-none transition-all placeholder:text-gray-400 text-gray-900 text-[13px] resize-none`}
            />
            {errors.description && <p className="text-[11px] text-red-500 mt-1">{errors.description}</p>}
          </div>

          {/* Popular Toggle Card */}
          <div className="bg-[#F9FAFB] rounded-[16px] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between border border-[#F3F4F6] gap-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-[#2F68C5] shadow-sm border border-gray-100 shrink-0">
                <Star className={`w-5 h-5 ${isPopular ? 'fill-[#2F68C5]' : ''}`} />
              </div>
              <div className="flex-1">
                <div className="text-[13px] font-bold text-[#374151]">Mark as Most Popular</div>
                <div className="text-[11px] text-gray-400 max-w-[200px]">Highlights this plan with a "Most Popular" badge.</div>
              </div>
            </div>
            <button
              onClick={() => setIsPopular(!isPopular)}
              className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-1 shrink-0 cursor-pointer ${isPopular ? 'bg-[#2F68C5]' : 'bg-gray-200'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-200 ${isPopular ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>

          {/* Feature Points */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Feature Points ({features.length})</label>
            </div>

            <div className="space-y-2 mb-3">
              {features.map((f, i) => (
                <div key={i} className="flex items-center justify-between bg-[#F9FAFB] border border-[#F3F4F6] px-4 py-2.5 rounded-[12px] transition-all">
                  <div className="flex items-center gap-3">
                    <svg width="15" height="14" viewBox="0 0 15 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M5.81948 8.85505L10.9772 3.48839L11.7621 4.31672L5.81948 10.5117L2.25391 6.79005L3.03878 5.97339L5.81948 8.85505Z" fill="#3B82F6" />
                    </svg>
                    <span className="text-[13px] text-[#374151] font-medium leading-tight">{f}</span>
                  </div>
                  <button onClick={() => removeFeature(i)} className="p-1 ml-1 text-red-400 hover:text-red-500 cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={newFeature}
                onChange={(e) => {
                  setNewFeature(e.target.value);
                  setErrors((prev) => ({ ...prev, newFeature: '' }));
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addFeature();
                  }
                }}
                placeholder="e.g. Unlimited AI renders"
                className={`flex-1 h-[38px] px-4 bg-white border ${errors.newFeature ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : 'border-[#E5E7EB] focus:border-[#2F68C5]'} rounded-full focus:outline-none transition-all text-[13px]`}
              />
              <button
                onClick={addFeature}
                className="bg-[#2F68C5] text-white h-[38px] px-6 rounded-lg flex items-center justify-center gap-2 text-[13px] font-semibold cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
            {errors.features && <p className="text-[11px] text-red-500 mt-1">{errors.features}</p>}
            {errors.newFeature && !errors.features && <p className="text-[11px] text-red-500 mt-1">{errors.newFeature}</p>}
          </div>

          {/* Plan Access Options */}
          <div className="pt-2">
            <h4 className="text-sm font-semibold text-[#4a4f59] mb-2 tracking-wider">Plan Access Options</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { key: 'canUseLogo', label: 'Logo' },
                { key: 'canUseBrandName', label: 'Brand Name' },
                { key: 'canUseCustomColor', label: 'Custom Color' },
                { key: 'hasUnlimitedRenders', label: 'Unlimited Render' },
              ].map((option) => (
                <label key={option.key} className="flex items-center gap-2 rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 text-[13px] text-[#374151]">
                  <input
                    type="checkbox"
                    checked={accessOptions[option.key as keyof typeof accessOptions]}
                    onChange={(e) =>
                      setAccessOptions((prev) => ({
                        ...prev,
                        [option.key]: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-gray-300 text-[#2F68C5] focus:ring-[#2F68C5]"
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Usage Limits */}
          <div className="pt-2">
            <h4 className="text-sm font-semibold text-[#4a4f59] mb-2 tracking-wider">Usage Limits</h4>
            {/* <p className="text-xs text-[#6B7280] mb-2  tracking-wider">Set to -1 for unlimited access.</p> */}
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-[10px] font-medium text-[#9CA3AF] mb-1.5 uppercase">Monthly Renders</label>
                <input
                  type="text"
                  value={limits.renders}
                  onChange={(e) => {
                    setLimits({ ...limits, renders: parseInt(e.target.value) || 0 });
                    setErrors((prev) => ({ ...prev, renders: '' }));
                  }}
                  className={`w-full h-[38px] px-3 bg-white border ${errors.renders ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : 'border-[#E5E7EB] focus:border-[#2F68C5]'} rounded-[8px] focus:outline-none text-[13px]`}
                />
                {errors.renders && <p className="text-[11px] text-red-500 mt-1">{errors.renders}</p>}
              </div>
              {/* <div>
                <label className="block text-[10px] font-medium text-[#9CA3AF] mb-1.5 uppercase">Shares</label>
                <input
                  type="text"
                  value={limits.shares}
                  onChange={(e) => {
                    setLimits({ ...limits, shares: parseInt(e.target.value) || 0 });
                    setErrors((prev) => ({ ...prev, shares: '' }));
                  }}
                  className={`w-full h-[38px] px-3 bg-white border ${errors.shares ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : 'border-[#E5E7EB] focus:border-[#2F68C5]'} rounded-[8px] focus:outline-none text-[13px]`}
                />
                {errors.shares && <p className="text-[11px] text-red-500 mt-1">{errors.shares}</p>}
              </div>
              <div>
                <label className="block text-[10px] font-medium text-[#9CA3AF] mb-1.5 uppercase">Quotes</label>
                <input
                  type="text"
                  value={limits.quotes}
                  onChange={(e) => {
                    setLimits({ ...limits, quotes: parseInt(e.target.value) || 0 });
                    setErrors((prev) => ({ ...prev, quotes: '' }));
                  }}
                  className={`w-full h-[38px] px-3 bg-white border ${errors.quotes ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : 'border-[#E5E7EB] focus:border-[#2F68C5]'} rounded-[8px] focus:outline-none text-[13px]`}
                />
                {errors.quotes && <p className="text-[11px] text-red-500 mt-1">{errors.quotes}</p>}
              </div> */}
            </div>
          </div>

          <div className="pt-2 border-t border-[#F3F4F6] mt-2">
            <h4 className="text-sm font-semibold text-[#4a4f59] mb-2 tracking-wider">Status</h4>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-[13px] text-[#374151]">
                <input
                  type="radio"
                  name="plan-status"
                  checked={isActive}
                  onChange={() => setIsActive(true)}
                  className="h-4 w-4 border-gray-300 text-[#2F68C5] focus:ring-[#2F68C5]"
                />
                <span>Active</span>
              </label>
              <label className="flex items-center gap-2 text-[13px] text-[#374151]">
                <input
                  type="radio"
                  name="plan-status"
                  checked={!isActive}
                  onChange={() => setIsActive(false)}
                  className="h-4 w-4 border-gray-300 text-[#2F68C5] focus:ring-[#2F68C5]"
                />
                <span>Inactive</span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 sm:p-8 border-t border-gray-50 flex flex-col sm:flex-row gap-3 sm:gap-4 shrink-0 px-1">
          <button
            onClick={handleCancel}
            disabled={submitting}
            className="flex-1 py-3 text-[#2F68C5] font-semibold border-[1.5px] border-[#2F68C5] rounded-full transition-all text-[16px] order-2 sm:order-1 disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSavePlan}
            disabled={submitting}
            className="flex-1 py-3 bg-[#2F68C5] text-[#E9EFFD] font-semibold rounded-full transition-all shadow-md shadow-blue-200 text-[16px] order-1 sm:order-2 disabled:opacity-70 flex items-center justify-center gap-2 cursor-pointer"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {initialData ? (updating ? 'Saving...' : 'Save Changes') : (creating ? 'Creating...' : 'Create Plan')}
          </button>
        </div>
      </div>
    </div>
  );
}
