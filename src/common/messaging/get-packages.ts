type GetPackagesRequest = {
  Url: string;
  SourceName?: string;
  Filter: string;
  Prerelease: boolean;
  Skip: number;
  Take: number;
  PasswordScriptPath?: string;
  ForceReload?: boolean;
};

type GetPackagesResponse = {
  IsFailure: boolean;
  Packages?: Array<Package>;
  Error?: HttpError;
};
