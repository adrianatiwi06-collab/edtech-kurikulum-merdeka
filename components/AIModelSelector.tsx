'use client';

import { useState, useEffect } from 'react';
import { AVAILABLE_MODELS } from '@/lib/models';

interface AIModelSelectorProps {
  onModelChange?: (model: string) => void;
  defaultModel?: string;
}

export default function AIModelSelector({ onModelChange, defaultModel }: AIModelSelectorProps) {
  const [selectedModel, setSelectedModel] = useState(
    defaultModel || localStorage.getItem('preferred_ai_model') || 'gemini-2.0-flash'
  );

  useEffect(() => {
    // Load from localStorage on mount
    const saved = localStorage.getItem('preferred_ai_model');
    if (saved) {
      setSelectedModel(saved);
      onModelChange?.(saved);
    }
  }, []);

  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    localStorage.setItem('preferred_ai_model', model);
    onModelChange?.(model);
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-2">
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">🤖</span>
          <label htmlFor="ai-model-select" className="text-sm font-medium text-gray-700">
            Model AI:
          </label>
        </div>
        <select
          id="ai-model-select"
          value={selectedModel}
          onChange={(e) => handleModelChange(e.target.value)}
          className="w-full px-3 py-2.5 border border-amber-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm font-medium bg-white shadow-sm"
          title="Pilih Model AI Gemini"
        >
          {AVAILABLE_MODELS.map((model) => (
            <option key={model.value} value={model.value}>
              {model.label}
            </option>
          ))}
        </select>
      </div>
      <p className="text-xs text-gray-600">
        💡 <strong>Flash:</strong> Lebih cepat & hemat quota. <strong>Pro:</strong> Lebih akurat & detail.
      </p>
    </div>
  );
}
