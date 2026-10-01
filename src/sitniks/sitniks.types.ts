export type SitniksChat = {
  id: string;
  initialSource: string;
  ownerName: string;
  userId: string;
  userName: string;
  status: string;
};

export type SitniksMessage = {
  sentBy: string;
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
};

export type HasMessagesOptions = {
  chatId: string;
  isComment: boolean;
};

export type ClientMessageOptions = {
  chatId: string;
  userId: string;
};

export type ChangeStatusOptions = {
  chatId: string;
  status: string;
};

export type SitniksRequest = {
  method: 'GET' | 'PATCH';
  path: string;
  query?: URLSearchParams;
  body?: string;
};
