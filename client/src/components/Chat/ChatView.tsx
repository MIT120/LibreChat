import type { TMessage } from 'librechat-data-provider';
import { Constants } from 'librechat-data-provider';
import { memo, useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useParams } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import type { ChatFormValues } from '~/common';
import { Spinner } from '~/components/svg';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/Tabs';
import { useGetMessagesByConvoId } from '~/data-provider';
import { useAddedResponse, useChatHelpers, useLocalize, useSSE } from '~/hooks';
import { AddedChatContext, ChatContext, ChatFormProvider, useFileMapContext } from '~/Providers';
import store from '~/store';
import { buildTree, cn } from '~/utils';
import BookPreview from './BookPreview';
import Footer from './Footer';
import Header from './Header';
import ChatForm from './Input/ChatForm';
import ConversationStarters from './Input/ConversationStarters';
import Landing from './Landing';
import MessagesView from './Messages/MessagesView';
import Presentation from './Presentation';

function LoadingSpinner() {
  return (
    <div className="relative flex-1 overflow-hidden overflow-y-auto">
      <div className="relative flex h-full items-center justify-center">
        <Spinner className="text-text-primary" />
      </div>
    </div>
  );
}

function ChatView({ index = 0 }: { index?: number }) {
  const localize = useLocalize();
  const { conversationId } = useParams();
  const rootSubmission = useRecoilValue(store.submissionByIndex(index));
  const addedSubmission = useRecoilValue(store.submissionByIndex(index + 1));
  const centerFormOnLanding = useRecoilValue(store.centerFormOnLanding);

  const fileMap = useFileMapContext();

  const { data: messagesTree = null, isLoading } = useGetMessagesByConvoId(conversationId ?? '', {
    select: useCallback(
      (data: TMessage[]) => {
        const dataTree = buildTree({ messages: data, fileMap });
        return dataTree?.length === 0 ? null : (dataTree ?? null);
      },
      [fileMap],
    ),
    enabled: !!fileMap,
  });

  const chatHelpers = useChatHelpers(index, conversationId);
  const addedChatHelpers = useAddedResponse({ rootIndex: index });
  const { conversation } = store.useCreateConversationAtom(index);
  const isSubmitting = useRecoilValue(store.isSubmittingFamily(index));
  const [bookRefreshKey, setBookRefreshKey] = useState(0);
  useEffect(() => {
    if (isSubmitting === false) {
      setBookRefreshKey((k) => k + 1);
    }
  }, [isSubmitting]);

  useSSE(rootSubmission, chatHelpers, false);
  useSSE(addedSubmission, addedChatHelpers, true);

  const methods = useForm<ChatFormValues>({
    defaultValues: { text: '' },
  });

  let content: JSX.Element | null | undefined;
  const isLandingPage =
    (!messagesTree || messagesTree.length === 0) &&
    (conversationId === Constants.NEW_CONVO || !conversationId);
  const isNavigating = (!messagesTree || messagesTree.length === 0) && conversationId != null;

  if (isLoading && conversationId !== Constants.NEW_CONVO) {
    content = <LoadingSpinner />;
  } else if ((isLoading || isNavigating) && !isLandingPage) {
    content = <LoadingSpinner />;
  } else if (!isLandingPage) {
    // Center book viewer with messages stacked above when needed
    content = (
      <div className="flex h-full w-full flex-col overflow-hidden">
        <div className="h-10 shrink-0 border-b border-border-light bg-surface-primary px-3 py-2 text-sm font-medium text-text-secondary">
          {/* Editor title intentionally blank to avoid literal string & missing key */}
        </div>
        <div className="flex h-full w-full overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <BookPreview className="h-full" />
          </div>
        </div>
      </div>
    );
  } else {
    content = <Landing centerFormOnLanding={centerFormOnLanding} />;
  }

  const RightPanel = (
    <div className="flex h-full w-full flex-col">
      <Tabs defaultValue="chat" className="flex h-full w-full flex-col">
        <div className="border-b border-border-light bg-surface-primary px-2 pt-2">
          <TabsList className="flex w-full justify-start gap-1 overflow-x-auto">
            <TabsTrigger value="chat">{localize('com_ui_chat')}</TabsTrigger>
            <TabsTrigger value="tools">{localize('com_ui_tools')}</TabsTrigger>
            <TabsTrigger value="files">{localize('com_ui_files')}</TabsTrigger>
            <TabsTrigger value="history">{localize('com_ui_chat_history')}</TabsTrigger>
          </TabsList>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden p-2">
          <TabsContent value="chat" className="mt-0 h-full rounded-none p-0">
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex-1 overflow-auto">
                {isLoading && conversationId !== Constants.NEW_CONVO ? (
                  <LoadingSpinner />
                ) : !isLandingPage ? (
                  <MessagesView messagesTree={messagesTree} />
                ) : null}
              </div>
              <div className="w-full shrink-0 pt-2">
                <ChatForm index={index} />
              </div>
              {isLandingPage ? <ConversationStarters /> : <Footer />}
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );

  return (
    <ChatFormProvider {...methods}>
      <ChatContext.Provider value={chatHelpers}>
        <AddedChatContext.Provider value={addedChatHelpers}>
          <Presentation rightPanel={RightPanel}>
            <div className="flex h-full w-full flex-col">
              {!isLoading && <Header />}
              <div className={cn('flex h-full flex-col overflow-hidden')}>
                {/* Center book/editor view */}
                <div className={cn('flex-1 overflow-hidden')}>{content}</div>
              </div>
            </div>
          </Presentation>
        </AddedChatContext.Provider>
      </ChatContext.Provider>
    </ChatFormProvider>
  );
}

export default memo(ChatView);
