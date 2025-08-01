import { createUserModel } from './user';
import { createTokenModel } from './token';
import { createSessionModel } from './session';
import { createBalanceModel } from './balance';
import { createConversationModel } from './convo';
import { createMessageModel } from './message';
import { createAgentModel } from './agent';
import { createRoleModel } from './role';
import { createActionModel } from './action';
import { createAssistantModel } from './assistant';
import { createFileModel } from './file';
import { createBannerModel } from './banner';
import { createProjectModel } from './project';
import { createKeyModel } from './key';
import { createPluginAuthModel } from './pluginAuth';
import { createTransactionModel } from './transaction';
import { createPresetModel } from './preset';
import { createPromptModel } from './prompt';
import { createPromptGroupModel } from './promptGroup';
import { createConversationTagModel } from './conversationTag';
import { createSharedLinkModel } from './sharedLink';
import { createToolCallModel } from './toolCall';
import { createMemoryModel } from './memory';
import { createCS2MatchModel } from './cs2Match';
import { createCS2TeamModel } from './cs2Team';
import { createCS2PlayerModel } from './cs2Player';
import { createBookModel } from './book';
import { createChapterModel } from './chapter';

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
  };
}
