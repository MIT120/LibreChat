/**
 * Enhanced Header - Shows conversation information with book connection chips
 */

import React, { useMemo, useEffect } from 'react';
import { getConfigDefaults, Permissions, PermissionTypes } from 'librechat-data-provider';
import { useOutletContext, useParams } from 'react-router-dom';
import SimpleBadge from '~/components/ui/SimpleBadge';
import { Button } from '~/components/ui/Button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '~/components/ui/DropdownMenu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/Tooltip';
import type { ContextType } from '~/common';
import { useGetStartupConfig } from '~/data-provider';
import { useHasAccess, useMediaQuery } from '~/hooks';
import { useConversationByConversationId, useCreateConversation } from '~/hooks/useConversations';
import AddMultiConvo from './AddMultiConvo';
import ExportAndShareMenu from './ExportAndShareMenu';
import { HeaderNewChat, OpenSidebar, PresetsMenu } from './Menus';
import BookmarkMenu from './Menus/BookmarkMenu';
import ModelSelector from './Menus/Endpoints/ModelSelector';
import { TemporaryChat } from './TemporaryChat';

// Icons
import {
  BookOpen,
  Clock,
  MessageSquare,
  Pin,
  PinOff,
  Edit,
  TrendingUp,
  Users,
  MoreHorizontal,
  Pause,
  Play,
  Archive
} from 'lucide-react';

const defaultInterface = getConfigDefaults().interface;

const CONVERSATION_TYPE_COLORS = {
  writing_session: 'bg-green-100 text-green-800',
  planning: 'bg-blue-100 text-blue-800',
  editing: 'bg-yellow-100 text-yellow-800',
  research: 'bg-purple-100 text-purple-800',
  brainstorming: 'bg-pink-100 text-pink-800',
  review: 'bg-orange-100 text-orange-800',
  collaboration: 'bg-indigo-100 text-indigo-800'
};

const STATUS_COLORS = {
  active: 'bg-green-500',
  paused: 'bg-yellow-500',
  completed: 'bg-blue-500',
  archived: 'bg-gray-500'
};

export default function EnhancedHeader() {
  const { conversationId } = useParams();
  const { data: startupConfig } = useGetStartupConfig();
  const { navVisible, setNavVisible } = useOutletContext<ContextType>();
  const interfaceConfig = useMemo(
    () => startupConfig?.interface ?? defaultInterface,
    [startupConfig],
  );

  // Get conversation data
  const { data: conversationData } = useConversationByConversationId(conversationId || '');
  const createConversation = useCreateConversation();

  const hasAccessToBookmarks = useHasAccess({
    permissionType: PermissionTypes.BOOKMARKS,
    permission: Permissions.USE,
  });

  const hasAccessToMultiConvo = useHasAccess({
    permissionType: PermissionTypes.MULTI_CONVO,
    permission: Permissions.USE,
  });

  const isSmallScreen = useMediaQuery('(max-width: 768px)');

  // Extract conversation information
  const conversation = conversationData?.conversation;
  const bookTitle = conversation?.bookId ? 'Connected Book' : null; // You'd get this from book data
  
  // Auto-create conversation if it doesn't exist and we have a conversationId
  useEffect(() => {
    if (conversationId && !conversation && conversationId !== 'new') {
      // Auto-create a book conversation if one doesn't exist
      // This would need book context - for now it's just a placeholder
      // createConversation.mutate({
      //   conversationId,
      //   bookId: 'default-book-id',
      //   workspaceId: 'default-workspace-id',
      //   title: 'Writing Session',
      //   type: 'writing_session'
      // });
    }
  }, [conversationId, conversation, createConversation]);

  // Format time ago
  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Format duration
  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    return `${hours}h ${remainingMins}m`;
  };

  return (
    <div className="sticky top-0 z-10 flex h-12 w-full items-center justify-between bg-white px-2 font-semibold text-text-primary dark:bg-gray-800">
      <div className="hide-scrollbar flex w-full items-center justify-between gap-2 overflow-x-auto">
        {/* Left section - Navigation and tools */}
        <div className="mx-1 flex items-center gap-2">
          <div
            className={`flex items-center gap-2 ${
              !isSmallScreen ? 'transition-all duration-200 ease-in-out' : ''
            } ${
              !navVisible
                ? 'translate-x-0 opacity-100'
                : 'pointer-events-none translate-x-[-100px] opacity-0'
            }`}
          >
            <OpenSidebar setNavVisible={setNavVisible} />
            <HeaderNewChat />
          </div>
          <div
            className={`flex items-center gap-2 ${
              !isSmallScreen ? 'transition-all duration-200 ease-in-out' : ''
            } ${!navVisible ? 'translate-x-0' : 'translate-x-[-100px]'}`}
          >
            <ModelSelector startupConfig={startupConfig} />
            {interfaceConfig.presets === true && interfaceConfig.modelSelect && <PresetsMenu />}
            {hasAccessToBookmarks === true && <BookmarkMenu />}
            {hasAccessToMultiConvo === true && <AddMultiConvo />}
            {isSmallScreen && (
              <>
                <ExportAndShareMenu
                  isSharedButtonEnabled={startupConfig?.sharedLinksEnabled ?? false}
                />
                <TemporaryChat />
              </>
            )}
          </div>
        </div>

        {/* Center section - Conversation info */}
        {conversation && (
          <div className="flex items-center gap-3 px-4">
            {/* Status indicator */}
            <div className="flex items-center gap-2">
              <div 
                className={`w-2 h-2 rounded-full ${STATUS_COLORS[conversation.status as keyof typeof STATUS_COLORS] || 'bg-gray-400'}`}
                title={`Status: ${conversation.status}`}
              />
              {conversation.flags?.isPinned && (
                <Pin className="h-3 w-3 text-yellow-600" />
              )}
            </div>

            {/* Book connection chip */}
            {bookTitle && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge 
                      variant="outline" 
                      className="text-xs bg-blue-50 text-blue-700 border-blue-200 cursor-pointer hover:bg-blue-100"
                    >
                      <BookOpen className="h-3 w-3 mr-1" />
                      {bookTitle}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Connected to book: {bookTitle}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Conversation type badge */}
            <Badge 
              className={`text-xs ${CONVERSATION_TYPE_COLORS[conversation.type as keyof typeof CONVERSATION_TYPE_COLORS] || 'bg-gray-100 text-gray-800'}`}
            >
              {conversation.type.replace('_', ' ')}
            </Badge>

            {/* Stats display */}
            <div className="flex items-center gap-3 text-xs text-gray-600">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {conversation.stats?.messageCount || 0}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{conversation.stats?.messageCount || 0} messages</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1">
                      <Edit className="h-3 w-3" />
                      {(conversation.stats?.wordsGenerated || 0).toLocaleString()}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{(conversation.stats?.wordsGenerated || 0).toLocaleString()} words generated</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {(conversation.stats?.totalSessionTime || 0) > 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(conversation.stats.totalSessionTime)}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Total session time: {formatDuration(conversation.stats.totalSessionTime)}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {conversation.productivity > 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        {conversation.productivity} WPM
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Productivity: {conversation.productivity} words per minute</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            {/* Conversation actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  {conversation.status === 'active' ? (
                    <>
                      <Pause className="h-4 w-4 mr-2" />
                      Pause Session
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Resume Session
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem>
                  {conversation.flags?.isPinned ? (
                    <>
                      <PinOff className="h-4 w-4 mr-2" />
                      Unpin
                    </>
                  ) : (
                    <>
                      <Pin className="h-4 w-4 mr-2" />
                      Pin
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Archive className="h-4 w-4 mr-2" />
                  Archive
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Right section - Export and temp chat */}
        {!isSmallScreen && (
          <div className="flex items-center gap-2">
            <ExportAndShareMenu
              isSharedButtonEnabled={startupConfig?.sharedLinksEnabled ?? false}
            />
            <TemporaryChat />
          </div>
        )}
      </div>
    </div>
  );
}
