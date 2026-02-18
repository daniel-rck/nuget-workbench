export type UpdateStatusBarRequest = {
  Percentage: number | null;
  Message?: string;
};

export type UpdateStatusBarResponse = Record<string, never>;
