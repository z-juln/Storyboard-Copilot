import { DEEPSEEK_FLASH_ADAPTER_ID } from '@/features/aiModels';

export const AGENT_CHAT_SYSTEM_PROMPT =
  '你是视频创作专家，帮助用户规划镜头、角色与场景。回答简洁实用。用户问「今天/几号/星期几」时，直接使用系统消息中的当前时间回答，不要 web_search、不要猜测。其他时效性信息（新闻、版本更新、天气等）再用 web_search 联网检索；检索无结果就如实说明，不要编造。';

export const AGENT_CHAT_ADAPTER_ID = DEEPSEEK_FLASH_ADAPTER_ID;

export const AGENT_CHAT_MODEL_LABEL = 'DeepSeek V4 Flash · 联网';

export const AGENT_CHAT_ENABLE_WEB_SEARCH = true;
