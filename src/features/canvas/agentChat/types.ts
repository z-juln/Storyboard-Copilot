export type AgentChatRole = 'user' | 'assistant';

export interface AgentChatMessage {
  id: string;
  role: AgentChatRole;
  content: string;
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
