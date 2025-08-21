/**
 * Text Selection Bubble - Floating bubble that appears on text selection
 * Similar to Cursor's "Add to Chat" functionality
 */

import React, { useEffect, useState, useRef } from 'react';
import { Button } from '~/components/ui';
import { MessageSquare, Wand2, Copy, X } from 'lucide-react';
import { cn } from '~/utils';

interface SelectionBubbleProps {
  selectedText: string;
  selectionRect: DOMRect | null;
  onAddToChat: (text: string, context?: string) => void;
  onAIEdit: (text: string) => void;
  onCopy: (text: string) => void;
  onClose: () => void;
  className?: string;
  contextBefore?: string;
  contextAfter?: string;
}

export default function TextSelectionBubble({
  selectedText,
  selectionRect,
  onAddToChat,
  onAIEdit,
  onCopy,
  onClose,
  className,
  contextBefore = '',
  contextAfter = ''
}: SelectionBubbleProps) {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const bubbleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectionRect || !selectedText) {
      setIsVisible(false);
      return;
    }

    // Position the bubble above the selection with some margin
    const bubbleHeight = 48; // Approximate height of bubble
    const margin = 8;
    
    let top = selectionRect.top - bubbleHeight - margin;
    let left = selectionRect.left + (selectionRect.width / 2);

    // Adjust position if bubble would go off-screen
    if (top < 0) {
      top = selectionRect.bottom + margin;
    }

    const viewportWidth = window.innerWidth;
    const bubbleWidth = 300; // Approximate width
    
    if (left + bubbleWidth / 2 > viewportWidth) {
      left = viewportWidth - bubbleWidth - margin;
    } else if (left - bubbleWidth / 2 < margin) {
      left = margin + bubbleWidth / 2;
    }

    setPosition({ top, left });
    setIsVisible(true);
  }, [selectionRect, selectedText]);

  if (!selectedText || !isVisible) {
    return null;
  }

  const handleAddToChat = () => {
    const context = `${contextBefore}[SELECTED: ${selectedText}]${contextAfter}`.trim();
    onAddToChat(selectedText, context);
    onClose();
  };

  const handleAIEdit = () => {
    onAIEdit(selectedText);
    onClose();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(selectedText);
      onCopy(selectedText);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  return (
    <div
      ref={bubbleRef}
      className={cn(
        "fixed z-50 flex items-center gap-1 bg-white border border-border-medium rounded-lg shadow-lg",
        "px-2 py-1.5 transform -translate-x-1/2 transition-all duration-200",
        "animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2",
        className
      )}
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      {/* Add to Chat Button */}
      <Button
        size="sm"
        onClick={handleAddToChat}
        className="h-7 px-2 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1"
        title={`Add "${selectedText.slice(0, 50)}${selectedText.length > 50 ? '...' : ''}" to chat`}
      >
        <MessageSquare className="h-3 w-3" />
        Add to Chat
      </Button>

      {/* AI Edit Button */}
      <Button
        size="sm"
        variant="outline"
        onClick={handleAIEdit}
        className="h-7 px-2 text-xs gap-1"
        title="Request AI edit for selected text"
      >
        <Wand2 className="h-3 w-3" />
        AI Edit
      </Button>

      {/* Copy Button */}
      <Button
        size="sm"
        variant="outline"
        onClick={handleCopy}
        className="h-7 px-2 text-xs"
        title="Copy selected text"
      >
        <Copy className="h-3 w-3" />
      </Button>

      {/* Close Button */}
      <Button
        size="sm"
        variant="ghost"
        onClick={onClose}
        className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600"
        title="Close"
      >
        <X className="h-3 w-3" />
      </Button>

      {/* Selection info tooltip */}
      <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-xs bg-black bg-opacity-75 text-white px-2 py-1 rounded whitespace-nowrap">
        {selectedText.length} chars selected
      </div>
    </div>
  );
}
