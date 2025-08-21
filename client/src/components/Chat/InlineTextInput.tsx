/**
 * Inline Text Input - Appears below selected text for contextual editing
 * Similar to chat input but positioned relative to text selection
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Button } from '~/components/ui';
import { Textarea } from '~/components/ui/Textarea';
import { Send, X, Wand2, MessageSquare, Loader2 } from 'lucide-react';
import { cn } from '~/utils';

interface InlineTextInputProps {
  selectedText: string;
  selectionRect: DOMRect | null;
  isVisible: boolean;
  onSubmit: (instruction: string, action: 'chat' | 'edit') => void;
  onClose: () => void;
  placeholder?: string;
  className?: string;
  isProcessing?: boolean;
}

export default function InlineTextInput({
  selectedText,
  selectionRect,
  isVisible,
  onSubmit,
  onClose,
  placeholder = "Ask AI about this text or request changes...",
  className,
  isProcessing = false
}: InlineTextInputProps) {
  const [input, setInput] = useState('');
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectionRect || !isVisible) {
      return;
    }

    // Position the input below the selection
    const margin = 8;
    const inputHeight = 120; // Approximate height including buttons
    
    let top = selectionRect.bottom + margin;
    let left = selectionRect.left;
    let width = Math.max(selectionRect.width, 320); // Minimum width

    // Adjust if input would go off-screen
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    if (left + width > viewportWidth - margin) {
      left = viewportWidth - width - margin;
    }
    if (left < margin) {
      left = margin;
      width = Math.min(width, viewportWidth - 2 * margin);
    }

    // If input would go below viewport, position above selection
    if (top + inputHeight > viewportHeight - margin) {
      top = selectionRect.top - inputHeight - margin;
    }

    setPosition({ top, left, width });

    // Focus the input after positioning
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }, [selectionRect, isVisible]);

  const handleSubmit = useCallback((action: 'chat' | 'edit') => {
    if (!input.trim()) return;
    onSubmit(input.trim(), action);
    setInput('');
  }, [input, onSubmit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit('chat');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }, [handleSubmit, onClose]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "fixed z-50 bg-white border border-border-medium rounded-lg shadow-lg",
        "transition-all duration-200 animate-in fade-in-0 slide-in-from-top-2",
        className
      )}
      style={{
        top: position.top,
        left: position.left,
        width: position.width,
      }}
    >
      {/* Header with selected text preview */}
      <div className="flex items-center justify-between p-3 border-b border-border-light bg-gray-50 rounded-t-lg">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-600 mb-1">Selected text:</p>
          <p className="text-sm text-gray-800 truncate italic">
            "{selectedText.slice(0, 80)}{selectedText.length > 80 ? '...' : ''}"
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClose}
          className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600 flex-shrink-0 ml-2"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>

      {/* Input area */}
      <div className="p-3">
        <Textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="resize-none border-border-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          rows={2}
          disabled={isProcessing}
        />
        
        {/* Action buttons */}
        <div className="flex items-center justify-between mt-3">
          <div className="text-xs text-gray-500">
            {input.length > 0 && `${input.length} characters`}
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleSubmit('edit')}
              disabled={!input.trim() || isProcessing}
              className="text-xs gap-1"
            >
              {isProcessing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Wand2 className="h-3 w-3" />
              )}
              AI Edit
            </Button>
            
            <Button
              size="sm"
              onClick={() => handleSubmit('chat')}
              disabled={!input.trim() || isProcessing}
              className="text-xs gap-1 bg-blue-600 hover:bg-blue-700"
            >
              {isProcessing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <MessageSquare className="h-3 w-3" />
              )}
              Add to Chat
            </Button>
          </div>
        </div>

        {/* Keyboard shortcuts hint */}
        <div className="text-xs text-gray-400 mt-2 text-center">
          <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">⌘</kbd> + 
          <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs ml-1">Enter</kbd> to add to chat • 
          <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs ml-1">Esc</kbd> to close
        </div>
      </div>
    </div>
  );
}
