'use client';

import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { toast } from 'react-toastify';

interface CommentItem {
  id: number | string;
  comment: string;
  created_at: string;
}

interface FeedbackSectionProps {
  isInProduction?: boolean;
  additionalNotes?: string;
  comments?: CommentItem[];
  brandPrimaryColor?: string;
}

export default function FeedbackSection({ isInProduction, additionalNotes, comments, brandPrimaryColor = '#2F68C5' }: FeedbackSectionProps) {
  const [feedback, setFeedback] = useState('');
  const [localComments, setLocalComments] = useState<CommentItem[]>(comments ?? []);

  if (isInProduction) {
    return (
      <div className="bg-white rounded-xl md:rounded-2xl p-4 sm:p-5 md:p-6 shadow-sm ">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Additional Notes</h3>
        <p className="text-sm sm:text-base text-gray-600">{additionalNotes}</p>
        {localComments.length > 0 && (
          <div className="mt-4 sm:mt-5 space-y-3">
            <h4 className="text-sm sm:text-base font-semibold text-gray-900">Comments</h4>
            {localComments.map((c) => (
              <div key={c.id} className="p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-800">{c.comment}</p>
                <p className="text-xs text-gray-400 mt-1.5">
                  {new Date(c.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const handleSubmit = () => {
    const trimmedFeedback = feedback.trim();
    if (!trimmedFeedback) return;

    setLocalComments((currentComments) => [
      {
        id: Date.now(),
        comment: trimmedFeedback,
        created_at: new Date().toISOString(),
      },
      ...currentComments,
    ]);
    toast.success('Feedback submitted successfully!');
    setFeedback('');
  };

  return (
    <div className="bg-white rounded-xl md:rounded-2xl p-4 sm:p-5 md:p-6 shadow-sm">
      <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1.5 sm:mb-2">Your Feedback</h3>
      <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">Share your thoughts (optional)</p>

      {localComments.length > 0 && (
        <div className="mb-4 sm:mb-5 space-y-3">
          <h4 className="text-sm sm:text-base font-semibold text-gray-900">Previous Comments</h4>
          {localComments.map((c) => (
            <div key={c.id} className="p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-800">{c.comment}</p>
              <p className="text-xs text-gray-400 mt-1.5">
                {new Date(c.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
              </p>
            </div>
          ))}
        </div>
      )}
      
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Write your feedback here..."
        className="w-full min-h-32 sm:min-h-36 md:min-h-72 px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 text-sm sm:text-base text-gray-800 rounded-lg sm:rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        rows={4}
      />

      <div className="mt-3 sm:mt-4 flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={!feedback.trim()}
          className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 md:px-6 py-2 sm:py-2.5 text-white rounded-full text-sm sm:text-base font-noramal hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: brandPrimaryColor }}
        >
          <>Share feedback <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></>
        </button>
      </div>
    </div>
  );
}
