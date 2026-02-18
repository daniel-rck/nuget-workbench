type GetInconsistentPackagesRequest = {
  ProjectPaths?: string[];
};

type GetInconsistentPackagesResponse = {
  IsFailure: boolean;
  Packages?: Array<InconsistentPackage>;
  Error?: HttpError;
};
