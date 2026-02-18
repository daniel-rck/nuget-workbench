type GetOutdatedPackagesRequest = {
  Prerelease: boolean;
  ProjectPaths?: string[];
};

type GetOutdatedPackagesResponse = {
  IsFailure: boolean;
  Packages?: Array<OutdatedPackage>;
  Error?: HttpError;
};
