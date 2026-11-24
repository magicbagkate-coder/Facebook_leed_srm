export type StatusCounts = {
  total: number;
  unanswered: number;
};

/** One measurement: both watched statuses at one moment. */
export type StatsPoint = {
  at: string;
  newChats: StatusCounts;
  productChoice: StatusCounts;
};
