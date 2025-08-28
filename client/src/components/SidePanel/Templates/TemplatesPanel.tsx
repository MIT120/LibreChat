import React, { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useSetRecoilState } from 'recoil';
import { QueryKeys, Constants } from 'librechat-data-provider';
import type { TMessage } from 'librechat-data-provider';
import { Button } from '~/components/ui/Button';
import { Separator } from '~/components/ui/Separator';
import SimpleBadge from '~/components/ui/SimpleBadge';
import { cn } from '~/utils';
import { useAuthContext, useNewConvo } from '~/hooks';
import {
  bookTemplates,
  templateCategories,
  generateBookCreationPrompt,
} from '~/data/bookTemplates';
import type { BookTemplate } from '~/data/bookTemplates';
import store from '~/store';

// Icons
import {
  ChevronRight,
  ChevronDown,
  ScrollText,
  BookOpen,
  Zap,
} from 'lucide-react';

interface TemplatesPanelProps {
  className?: string;
}

export default function TemplatesPanel({ className }: TemplatesPanelProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthContext();
  const { newConversation: newConvo } = useNewConvo(0);
  const setActivePrompt = useSetRecoilState(store.activePromptByIndex(0));

  const [expandedCategories, setExpandedCategories] = useState<string[]>(['fiction']);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId],
    );
  };

  const handleTemplateClick = useCallback(
    (template: BookTemplate) => {
      if (!user?.id) {
        console.warn('User ID not available for template');
        return;
      }

      // Generate the book creation prompt with user ID
      const promptText = generateBookCreationPrompt(template, user.id);

      // Clear any existing messages and start a new conversation
      queryClient.setQueryData<TMessage[]>([QueryKeys.messages, Constants.NEW_CONVO], []);
      queryClient.invalidateQueries([QueryKeys.messages]);

      // Set the prompt to be inserted into the chat
      setActivePrompt(promptText);

      // Start new conversation and navigate to chat
      newConvo();
      navigate('/c/new', { state: { focusChat: true } });
    },
    [user?.id, queryClient, setActivePrompt, newConvo, navigate],
  );

  const CategorySection = ({ 
    categoryId, 
    category 
  }: { 
    categoryId: string; 
    category: { name: string; icon: string; description: string };
  }) => {
    const isExpanded = expandedCategories.includes(categoryId);
    const categoryTemplates = bookTemplates.filter((t) => t.category === categoryId);

    if (categoryTemplates.length === 0) return null;

    return (
      <div className="mb-4">
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-8 w-full justify-start gap-2 text-sm font-medium',
            'hover:bg-surface-hover text-text-primary',
          )}
          onClick={() => toggleCategory(categoryId)}
        >
          <span className="text-base">{category.icon}</span>
          <span className="flex-1 text-left">{category.name}</span>
          <SimpleBadge variant="secondary" className="text-xs">
            {categoryTemplates.length}
          </SimpleBadge>
          {isExpanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </Button>

        {isExpanded && (
          <div className="mt-2 space-y-1 pl-6">
            {categoryTemplates.map((template) => (
              <TemplateCard key={template.id} template={template} onClick={handleTemplateClick} />
            ))}
          </div>
        )}
      </div>
    );
  };

  const TemplateCard = ({ 
    template, 
    onClick 
  }: { 
    template: BookTemplate; 
    onClick: (template: BookTemplate) => void;
  }) => {
    return (
      <div
        className={cn(
          'group cursor-pointer rounded-md border border-border-light bg-surface-primary p-3',
          'hover:bg-surface-hover hover:border-border-medium transition-colors',
        )}
        onClick={() => onClick(template)}
        title={template.description}
      >
        <div className="flex items-start gap-3">
          <span className="text-xl flex-shrink-0">{template.icon}</span>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-medium text-text-primary truncate">
              {template.name}
            </h4>
            <p className="text-xs text-text-secondary mt-1 line-clamp-2">
              {template.description}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <SimpleBadge variant="outline" className="text-xs">
                {template.genre}
              </SimpleBadge>
              <span className="text-xs text-text-tertiary">
                {template.template.arguments.targetWordCount.toLocaleString()} words
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={cn('flex h-full flex-col bg-surface-primary', className)}>
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border-light p-4">
        <div className="flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-text-primary" />
          <h2 className="text-lg font-semibold text-text-primary">Book Templates</h2>
        </div>
        <p className="text-sm text-text-secondary mt-1">
          Ready-to-use templates for creating books in different genres
        </p>
      </div>

      {/* Quick Start Info */}
      <div className="flex-shrink-0 p-4 bg-surface-secondary/50 border-b border-border-light">
        <div className="flex items-start gap-3">
          <Zap className="h-4 w-4 text-accent-primary mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-medium text-text-primary">Quick Start</h3>
            <p className="text-xs text-text-secondary mt-1">
              Click any template to instantly start creating a book with pre-filled details and your author ID
            </p>
          </div>
        </div>
      </div>

      {/* Templates List */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          {Object.entries(templateCategories).map(([categoryId, category]) => (
            <CategorySection key={categoryId} categoryId={categoryId} category={category} />
          ))}
        </div>

        {/* Footer Info */}
        <Separator className="my-6" />
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <BookOpen className="h-4 w-4 text-text-tertiary" />
            <span className="text-sm font-medium text-text-secondary">
              {bookTemplates.length} Templates Available
            </span>
          </div>
          <p className="text-xs text-text-tertiary">
            Each template includes complete MCP formatting with genre-specific settings
          </p>
        </div>
      </div>
    </div>
  );
}
