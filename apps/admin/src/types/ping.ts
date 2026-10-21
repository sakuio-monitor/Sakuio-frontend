export type PingTask = {
  id: number;
  weight?: number;
  name: string;
  type: string;
  target: string;
  interval: number;
  default_on: boolean;
  clients: string[];
};

export type PingTaskDraft = {
  name: string;
  type: "icmp" | "tcp" | "http";
  target: string;
  interval: number;
  default_on: boolean;
  clients: string[];
};

export type AdminClientSummary = {
  uuid: string;
  name: string;
};
