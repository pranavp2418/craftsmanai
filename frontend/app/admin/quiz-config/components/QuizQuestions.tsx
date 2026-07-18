'use client';

import React, { useState } from 'react';
import { Plus, ArrowUp, ChevronUp, ChevronDown } from 'lucide-react';
import AddQuestionModal from './AddQuestionModal';
import EditQuestionModal from './EditQuestionModal';
import ToggleQuestionModal from './ToggleQuestionModal';
import ReorderModal from './ReorderModal';
import { useAppDispatch } from '@/redux/hooks';
import { toggleQuestionStatus } from '@/redux/slices/admin/quiz/adminQuizQuestionsSlice';
import { toggleQuizQuestionStatus, resetToggleStatus } from '@/redux/slices/admin/quiz/adminQuizToggleStatusSlice';
import { QuizQuestion, QuizOption } from '@/redux/slices/admin/quiz/adminQuizQuestionsSlice';


interface QuizQuestionsProps {
  jewelleryType: string;
  jewelleryTypeValue?: string;
  jewellerySubtype?: string;
  hasQuestions: boolean;
  onAddQuestion: () => void;
  questions: QuizQuestion[];
  loading?: boolean;
}

const QuizQuestions: React.FC<QuizQuestionsProps> = ({
  jewelleryType,
  jewelleryTypeValue,
  jewellerySubtype,
  hasQuestions,
  onAddQuestion,
  questions,
  loading = false,
}) => {
  const [orderedQuestions, setOrderedQuestions] = useState<QuizQuestion[]>(questions);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestion | null>(null);
  const dispatch = useAppDispatch();
  const [toggleTarget, setToggleTarget] = useState<{ question: QuizQuestion; mode: 'enable' | 'disable' } | null>(null);
  const [pendingReorder, setPendingReorder] = useState<{ questionId: string; direction: 'up' | 'down' } | null>(null);

  // Sync orderedQuestions when questions from API change
  React.useEffect(() => {
    setOrderedQuestions(questions);
    setExpandedIds(questions.map((q) => q.id));
  }, [questions]);

  const applyReorder = (questionId: string, direction: 'up' | 'down') => {
    setOrderedQuestions((prev) => {
      const idx = prev.findIndex((q) => q.id === questionId);
      if (idx === -1) return prev;
      const next = [...prev];
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= next.length) return prev;
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next;
    });
  };

  const handleOpenModal = () => setIsModalOpen(true);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleReorderClick = (questionId: string, direction: 'up' | 'down') => {
    setPendingReorder({ questionId, direction });
  };

  return (
    <>
      <AddQuestionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        jewelleryType={jewelleryType}
        jewelleryTypeValue={jewelleryTypeValue || ''}
        jewellerySubtype={jewellerySubtype || ''}
        onSuccess={() => {
          setIsModalOpen(false);
          onAddQuestion();
        }}
      />
      <EditQuestionModal
        isOpen={!!editingQuestion}
        onClose={() => setEditingQuestion(null)}
        jewelleryType={jewelleryType}
        jewelleryTypeValue={jewelleryTypeValue}
        jewellerySubtype={jewellerySubtype}
        question={editingQuestion}
      />
      <ToggleQuestionModal
        isOpen={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        mode={toggleTarget?.mode ?? 'enable'}
        questionText={toggleTarget?.question.text ?? ''}
        onConfirm={async () => {
          if (!toggleTarget) return;
          const { question } = toggleTarget;
          // newStatus is the opposite of current (what we want to set)
          const newStatus = question.status === 'enabled' ? 'INACTIVE' : 'ACTIVE';
          // Optimistic update
          dispatch(toggleQuestionStatus(String(question.id)));
          setToggleTarget(null);
          const result = await dispatch(toggleQuizQuestionStatus({ questionId: String(question.id), newStatus }));
          if (toggleQuizQuestionStatus.rejected.match(result)) {
            // Revert on failure
            dispatch(toggleQuestionStatus(String(question.id)));
          }
          dispatch(resetToggleStatus());
        }}
      />
      <ReorderModal
        isOpen={!!pendingReorder}
        onClose={() => setPendingReorder(null)}
        onConfirm={() => {
          if (pendingReorder) applyReorder(pendingReorder.questionId, pendingReorder.direction);
        }}
      />

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden px-3 sm:px-6 pb-6 sm:pb-10">
        {/* Header */}
        <div className="py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200">
          <div>
            <h2 className="text-[18px] font-medium text-gray-900">Quiz Questions</h2>
            <p className="text-sm text-gray-500 mt-0.5">All questions for {jewelleryType}</p>
          </div>
          <button
            onClick={handleOpenModal}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#2C62B9] text-white text-base tracking-wide  rounded-full hover:bg-[#2556a3] active:bg-[#1f4a8a] transition-colors cursor-pointer w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            Add Question
          </button>
        </div>

        {/* Loading Shimmer */}
        {loading && (
          <div className="animate-pulse">
            {[...Array(4)].map((_, i) => (
              <div key={i} className={`py-4 px-2 ${i !== 3 ? 'border-b border-gray-200' : ''}`}>
                <div className="flex items-start gap-2">
                  {/* Reorder chevrons placeholder */}
                  <div className="flex flex-col items-center gap-2 pt-1 shrink-0">
                    <div className="w-4 h-4 bg-gray-200 rounded" />
                    <div className="w-4 h-4 bg-gray-200 rounded" />
                  </div>

                  {/* Content column */}
                  <div className="flex-1 min-w-0">
                    {/* Badges + action buttons row */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <div className="h-5 w-12 bg-gray-200 rounded-full" />
                        <div className="h-5 w-16 bg-gray-200 rounded-full" />
                        <div className="h-5 w-24 bg-gray-200 rounded-full hidden sm:block" />
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="h-4 w-8 bg-gray-200 rounded" />
                        <div className="h-4 w-14 bg-gray-200 rounded" />
                      </div>
                    </div>

                    {/* Question text */}
                    <div className="space-y-2 mb-4">
                      <div className="h-3 w-full bg-gray-200 rounded" />
                      <div className="h-3 w-3/4 bg-gray-200 rounded" />
                    </div>

                    {/* Image options grid */}
                    <div className="ml-0 grid grid-cols-4 sm:flex sm:flex-wrap gap-2 sm:gap-3">
                      {[...Array(4)].map((_, j) => (
                        <div key={j} className="flex flex-col items-center gap-1">
                          <div className="w-full aspect-square sm:w-20 sm:h-20 bg-gray-200 rounded-lg" />
                          <div className="h-2.5 w-full bg-gray-200 rounded" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && !hasQuestions && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-[#F1F1F1] flex items-center justify-center mb-4">
              <div className="w-10 h-10 rounded-full bg-[#515151] flex items-center justify-center">
                <ArrowUp className="w-5 h-5 text-white" />
              </div>
            </div>
            <p className="text-sm font-medium text-gray-900 mb-1">
              No quiz questions configured yet
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Create your first quiz question for {jewelleryType}
            </p>
            <button
              onClick={handleOpenModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#2C62B9] text-white text-sm font-medium rounded-lg hover:bg-[#2556a3] active:bg-[#1f4a8a] transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add first question
            </button>
          </div>
        )}

        {/* Questions List */}
        {!loading && hasQuestions && (
          <div>
            {orderedQuestions.map((question: QuizQuestion, index: number) => {
              const isExpanded = expandedIds.includes(question.id);
              const isDisabled = question.status === 'disabled';
              const isLast = index === orderedQuestions.length - 1;
              const isFirst = index === 0;

              return (
                <div
                  key={question.id}
                  className={`${!isLast ? 'border-b border-gray-200' : ''} ${isDisabled ? 'bg-[#FAFAFA]' : 'bg-white'}`}
                >
                  <div className="py-4 px-2">
                    <div className="flex items-start gap-2">
                      {/* Chevron controls */}
                      <div className="flex flex-col items-center gap-2 pt-1 shrink-0">
                        <button
                          onClick={() => !isFirst && handleReorderClick(question.id, 'up')}
                          className={`transition-colors ${
                            isFirst
                              ? 'text-gray-200 cursor-not-allowed'
                              : 'text-gray-400 hover:text-gray-600 cursor-pointer'
                          }`}
                          disabled={isFirst}
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => !isLast && handleReorderClick(question.id, 'down')}
                          className={`transition-colors ${
                            isLast
                              ? 'text-gray-200 cursor-not-allowed'
                              : 'text-gray-400 hover:text-gray-600 cursor-pointer'
                          }`}
                          disabled={isLast}
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Content column */}
                      <div className="flex-1 min-w-0">
                        {/* Row 1: badges + action buttons */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          {/* Badges */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-[#E3E3E3] text-[#515151]">
                              {question.questionNumber}
                            </span>
                            {isDisabled ? (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-[#E3E3E3] text-[#515151]">
                                Disabled
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-[#DCFCE7] text-[#1D8C1D]">
                                Enabled
                              </span>
                            )}
                            {/* Type badge — hidden on mobile, shown on sm+ */}
                            <span className="hidden sm:inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-[#E2ECFE] text-[#2C62B9]">
                              {question.type}
                            </span>
                          </div>
                          {/* Action buttons */}
                          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                            <button
                              onClick={() => setEditingQuestion(question)}
                              className="text-xs sm:text-sm font-medium text-gray-700 hover:text-gray-900 hover:underline transition-colors cursor-pointer"
                            >
                              Edit
                            </button>
                            {isDisabled ? (
                              <button
                                onClick={() => setToggleTarget({ question, mode: 'enable' })}
                                className="text-xs sm:text-sm font-medium text-[#1D8C1D] hover:opacity-70 transition-opacity cursor-pointer"
                              >
                                Enable
                              </button>
                            ) : (
                              <button
                                onClick={() => setToggleTarget({ question, mode: 'disable' })}
                                className="text-xs sm:text-sm font-medium text-red-500 hover:opacity-70 transition-opacity cursor-pointer"
                              >
                                Disable
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Type badge — mobile only, sits below badge row */}
                        <span className="sm:hidden inline-flex mb-2 px-2 py-0.5 text-xs font-medium rounded-full bg-[#E2ECFE] text-[#2C62B9]">
                          {question.type}
                        </span>

                        {/* Question text — always full width */}
                        <p className={`text-sm font-medium text-[#111827] leading-snug ${isDisabled ? 'opacity-60' : ''}`}>
                          {question.text}
                        </p>
                      </div>
                    </div>

                    {/* Answer Options Content (Only if applicable) */}
                    {isExpanded && question.options && question.options.length > 0 && (
                      <div className="mt-4 ml-6 flex flex-wrap gap-4 sm:gap-6">
                        {question.options.map((option: QuizOption) => (
                          <div key={option.id} className="flex flex-col items-center gap-2 max-w-[120px]">
                            {/* Main Option Image */}
                            <div className={`w-[78px] h-[78px] rounded-2xl overflow-hidden border border-gray-200 shrink-0 bg-gray-50 ${isDisabled ? 'opacity-50' : ''}`}>
                              {option.image ? (
                                <img src={option.image} alt={option.label || 'Quiz Option'} className="w-full h-full object-cover object-center" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400">NO IMG</div>
                              )}
                            </div>
                            <span className={`text-xs text-[#4B5563] text-center w-full px-0.5 leading-snug ${isDisabled ? 'opacity-50' : ''}`}>
                              {option.label}
                            </span>
                            
                            {/* Suboptions rendering */}
                            {option.suboptions && option.suboptions.length > 0 && (
                              <div className="flex flex-wrap items-center justify-center gap-1.5 mt-0.5 border-t border-gray-100 pt-2 w-full">
                                {option.suboptions.map((sub, sIdx) => (
                                  <div key={sIdx} className="flex flex-col items-center gap-0.5" title={sub.name}>
                                    <div className={`w-8 h-8 rounded-lg overflow-hidden border border-gray-200 shrink-0 bg-white ${isDisabled ? 'opacity-50' : ''}`}>
                                      {sub.image_url ? (
                                        <img src={sub.image_url} alt={sub.name || 'Suboption'} className="w-full h-full object-cover object-center" />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center text-[6px] text-gray-400">IMG</div>
                                      )}
                                    </div>
                                    <span className={`text-[10px] text-[#4B5563] text-center truncate w-full max-w-[40px] ${isDisabled ? 'opacity-50' : ''}`}>
                                      {sub.name}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

export default QuizQuestions;
