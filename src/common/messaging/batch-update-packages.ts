type BatchUpdateRequest = {
  Updates: Array<{
    PackageId: string;
    Version: string;
    ProjectPaths: Array<string>;
  }>;
};

type BatchUpdateResponse = {
  Results: Array<{
    PackageId: string;
    Success: boolean;
    Error?: string;
  }>;
};
