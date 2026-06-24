export type AgentChatRole = 'user' | 'assistant';

export interface AgentChatMessage {
  id: string;
  role: AgentChatRole;
  content: string;
  /** 是否在本轮回复中触发了 DeepSeek 服务端 web_search */
  webSearchUsed?: boolean;
  /** 期望联网但实际走了 OpenAI 非联网通道 */
  offlineReply?: boolean;
}

export interface AgentChatConversation {
  id: string;
  title: string;
  messages: AgentChatMessage[];
  updatedAt: number;
  createdAt: number;
}

export interface AgentChatSessionSnapshot {
  activeConversationId: string;
  conversations: AgentChatConversation[];
}

export interface AgentChatHistoryGroup {
  label: string;
  items: AgentChatConversation[];
}
