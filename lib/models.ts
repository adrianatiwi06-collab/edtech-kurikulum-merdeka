// Available AI Models Configuration
// This file is separate from gemini.ts to avoid importing server-side code in client components

export const AVAILABLE_MODELS = [
  { value: 'gemini-2.0-flash', label: '⚡ Gemini 2.0 Flash (Recommended)' },
  { value: 'gemini-3-pro-preview', label: '🔥 Gemini 3 Pro Preview' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
  { value: 'gemini-2.5-flash-lite-preview-06-17', label: 'Gemini 2.5 Flash Lite Preview' },
  { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
  { value: 'gemini-1.5-pro-latest', label: 'Gemini 1.5 Pro Latest' },
  { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
  { value: 'gemini-1.5-flash-latest', label: 'Gemini 1.5 Flash Latest' },
  { value: 'gemini-1.5-flash-8b', label: 'Gemini 1.5 Flash 8B' },
  { value: 'gemini-1.5-flash-8b-latest', label: 'Gemini 1.5 Flash 8B Latest' }
] as const;

export type ModelValue = typeof AVAILABLE_MODELS[number]['value'];
