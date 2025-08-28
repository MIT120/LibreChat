import { createActionModel } from './action';
import { createAgentModel } from './agent';
import { createAssistantModel } from './assistant';
import { createBalanceModel } from './balance';
import { createBannerModel } from './banner';
import { createBookModel } from './book';
import { createChapterModel } from './chapter';
import { createConversationTagModel } from './conversationTag';
import { createConversationModel } from './convo';
import { createCS2MatchModel } from './cs2Match';
import { createCS2PlayerModel } from './cs2Player';
import { createCS2TeamModel } from './cs2Team';
import { createFileModel } from './file';
import { createKeyModel } from './key';
import { createMemoryModel } from './memory';
import { createMessageModel } from './message';
import { createPageModel } from './page';
import { createPluginAuthModel } from './pluginAuth';
import { createPresetModel } from './preset';
import { createProjectModel } from './project';
import { createPromptModel } from './prompt';
import { createPromptGroupModel } from './promptGroup';
import { createRoleModel } from './role';
import { createSessionModel } from './session';
import { createSharedLinkModel } from './sharedLink';
import { createTokenModel } from './token';
import { createToolCallModel } from './toolCall';
import { createTransactionModel } from './transaction';
import { createUserModel } from './user';
import { createImageStyleConfigModel } from './imageStyleConfig';

/**
 * Creates all database models for all collections
 */
export function createModels(mongoose: typeof import('mongoose')) {
  return {
    User: createUserModel(mongoose),
    Token: createTokenModel(mongoose),
    Session: createSessionModel(mongoose),
    Balance: createBalanceModel(mongoose),
    Conversation: createConversationModel(mongoose),
    Message: createMessageModel(mongoose),
    Agent: createAgentModel(mongoose),
    Role: createRoleModel(mongoose),
    Action: createActionModel(mongoose),
    Assistant: createAssistantModel(mongoose),
    File: createFileModel(mongoose),
    Banner: createBannerModel(mongoose),
    Project: createProjectModel(mongoose),
    Key: createKeyModel(mongoose),
    PluginAuth: createPluginAuthModel(mongoose),
    Transaction: createTransactionModel(mongoose),
    Preset: createPresetModel(mongoose),
    Prompt: createPromptModel(mongoose),
    PromptGroup: createPromptGroupModel(mongoose),
    ConversationTag: createConversationTagModel(mongoose),
    SharedLink: createSharedLinkModel(mongoose),
    ToolCall: createToolCallModel(mongoose),
    MemoryEntry: createMemoryModel(mongoose),
    CS2Match: createCS2MatchModel(mongoose),
    CS2Team: createCS2TeamModel(mongoose),
    CS2Player: createCS2PlayerModel(mongoose),
    Book: createBookModel(mongoose),
    Chapter: createChapterModel(mongoose),
    Page: createPageModel(mongoose),
    ImageStyleConfig: createImageStyleConfigModel(mongoose),
  };
}
