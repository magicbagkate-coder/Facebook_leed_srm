export type SitniksChat = {
  id: string;
  initialSource: string;
  ownerName: string;
  userId: string;
  userName: string;
  status: string;
  tags: string[];
};

export type SitniksMessage = {
  sentBy: string;
  createdAt: string;
  messageType?: string;
  managerName?: string;
  text?: string;
  attachmentUrl?: string;
};

export type ChatListResponse = {
  data: SitniksChat[];
  count: number;
};

export type ChatMessagesResponse = {
  data: SitniksMessage[];
};

export type ListChatsOptions = {
  status: string;
  initialSource: string;
  startDate?: string;
};

export type LatestMessagesOptions = {
  chatId: string;
  limit: number;
};

export type HasMessagesOptions = {
  chatId: string;
  isComment: boolean;
};

export type ClientMessageOptions = {
  chatId: string;
  userId: string;
};

export type SetTagsOptions = {
  chatId: string;
  tags: string[];
};

export type ChangeStatusOptions = {
  chatId: string;
  status: string;
};

export type SitniksRequest = {
  method: 'GET' | 'PATCH' | 'PUT';
  path: string;
  query?: URLSearchParams;
  body?: string;
};
