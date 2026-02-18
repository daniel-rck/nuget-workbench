type ConsolidateRequest = {
  PackageId: string;
  TargetVersion: string;
  ProjectPaths: Array<string>;
};

type ConsolidateResponse = {
  Success: boolean;
  Error?: string;
};
