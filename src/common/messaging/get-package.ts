type GetPackageRequest = {
  Url: string;
  SourceName?: string;
  Id: string;
  Prerelease: boolean;
  PasswordScriptPath?: string;
  ForceReload?: boolean;
};

type GetPackageResponse = {
  IsFailure: boolean;
  Package?: Package;
  Error?: HttpError;
};
