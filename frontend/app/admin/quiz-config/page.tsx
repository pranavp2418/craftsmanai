'use client';

import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/src/components/app-layout';
import JewelleryDropdown from './components/JewelleryDropdown';
import EmptyState from './components/EmptyState';
import QuizQuestions from './components/QuizQuestions';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { useDebounce } from '@/src/utils/hooks/useDebounce';
import { fetchQuizTypes } from '@/redux/slices/admin/quiz/adminQuizTypesSlice';
import { fetchQuizSubtypes, clearSubtypes } from '@/redux/slices/admin/quiz/adminQuizSubtypesSlice';
import { fetchQuizQuestions, clearQuizQuestions } from '@/redux/slices/admin/quiz/adminQuizQuestionsSlice';

function QuizConfigPage() {
  const dispatch = useAppDispatch();
  const { types: jewelleryTypes, loading: typesLoading } = useAppSelector((s) => s.adminQuizTypes);
  const { subtypes: availableSubtypes, loading: subtypesLoading } = useAppSelector((s) => s.adminQuizSubtypes);
  const { questions, loading: questionsLoading } = useAppSelector((s) => s.adminQuizQuestions);

  const [selectedType, setSelectedType] = useState('');
  const [selectedSubtype, setSelectedSubtype] = useState('');
  const debouncedSelectedType = useDebounce(selectedType, 300);
  const debouncedSelectedSubtype = useDebounce(selectedSubtype, 300);
  const hasQuestions = questions.length > 0;

  useEffect(() => {
    dispatch(fetchQuizTypes());
  }, [dispatch]);

  // Fetch questions whenever debounced type or subtype changes
  useEffect(() => {
    if (debouncedSelectedType) {
      const typeLabel = jewelleryTypes.find((t) => t.value === debouncedSelectedType)?.label || debouncedSelectedType;
      const subtypeLabel = availableSubtypes.find((s) => s.value === debouncedSelectedSubtype)?.label || debouncedSelectedSubtype;

      dispatch(
        fetchQuizQuestions({
          jewellery_type: typeLabel,
          ...(debouncedSelectedSubtype && debouncedSelectedSubtype !== 'all' ? { jewellery_subtype: subtypeLabel } : {}),
        })
      );
    } else {
      dispatch(clearQuizQuestions());
    }
  }, [debouncedSelectedType, debouncedSelectedSubtype, dispatch, jewelleryTypes, availableSubtypes]);

  const handleTypeChange = (value: string) => {
    setSelectedType(value);
    setSelectedSubtype(''); // Reset to empty instead of 'all'
    if (value) {
      dispatch(fetchQuizSubtypes(value));
    } else {
      dispatch(clearSubtypes());
      dispatch(clearQuizQuestions());
    }
  };

  const handleAddQuestion = () => {
    if (selectedType) {
      const typeLabel = jewelleryTypes.find((t) => t.value === selectedType)?.label || selectedType;
      const subtypeLabel = availableSubtypes.find((s) => s.value === selectedSubtype)?.label || selectedSubtype;

      dispatch(
        fetchQuizQuestions({
          jewellery_type: typeLabel,
          ...(selectedSubtype && selectedSubtype !== 'all' ? { jewellery_subtype: subtypeLabel } : {}),
        })
      );
    }
  };

  return (
    <AppLayout
      appName="Craftsman.ai"
      headerTitle="Quiz Configuration"
      headerDescription="Configure guided visual quiz questions for jewelery design refinement"
      notificationCount={5}
    >
      <div className="md:mt-3">
        {/* Header */}
        <div className="lg:hidden mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Quiz Configuration</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure guided visual quiz questions for jewelery design refinement
          </p>
        </div>

        {/* Jewellery Mapping Section */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 mb-6">
          <h2 className="text-[18px] tracking-wide font-medium text-gray-900 mb-1">Jewelery Mapping</h2>
          <p className="text-sm text-gray-500 mb-6">
            Select jewelery type and subtype to configure quiz questions
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
            {typesLoading ? (
              // Shimmer for dropdowns while jewellery types load
              <div className="contents animate-pulse">
                <div>
                  <div className="h-3.5 w-28 bg-gray-200 rounded mb-2" />
                  <div className="h-10 w-full bg-gray-200 rounded-lg" />
                </div>
                <div>
                  <div className="h-3.5 w-40 bg-gray-200 rounded mb-2" />
                  <div className="h-10 w-full bg-gray-200 rounded-lg" />
                </div>
              </div>
            ) : (
              <>
                <JewelleryDropdown
                  label="Jewelery Type"
                  required
                  value={selectedType}
                  onChange={handleTypeChange}
                  options={jewelleryTypes}
                  placeholder="Select a jewelery type"
                />
                <JewelleryDropdown
                  label="Jewelery Subtype"
                  required
                  value={selectedSubtype}
                  onChange={setSelectedSubtype}
                  options={
                    subtypesLoading ? [] : availableSubtypes
                  }
                  placeholder={subtypesLoading ? 'Loading...' : 'Select a jewelery subtype'}
                />
              </>
            )}
          </div>
        </div>

        {/* Quiz Questions Section or Empty State */}
        {!selectedType || !selectedSubtype ? (
          <div className="bg-white rounded-2xl border border-gray-200">
            <EmptyState
              title={`Select both type and subtype to ${!selectedType ? 'view' : 'configure'} questions`}
              subtitle="Mandatory mapping required for production-ready quiz configuration"
            />
          </div>
        ) : (
          <QuizQuestions
            jewelleryType={jewelleryTypes.find((t) => t.value === selectedType)?.label || selectedType}
            jewelleryTypeValue={jewelleryTypes.find((t) => t.value === selectedType)?.label || selectedType}
            jewellerySubtype={availableSubtypes.find((s) => s.value === selectedSubtype)?.label || selectedSubtype}
            hasQuestions={hasQuestions}
            onAddQuestion={handleAddQuestion}
            questions={questions}
            loading={questionsLoading}
          />
        )}
      </div>
    </AppLayout>
  );
}

export default QuizConfigPage;