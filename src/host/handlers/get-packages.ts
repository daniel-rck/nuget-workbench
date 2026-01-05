import { IRequestHandler } from "@/common/messaging/core/types";
import nugetApiFactory from "../nuget/api-factory";
import * as vscode from "vscode";
import { Logger } from "../../common/logger";
import NuGetConfigResolver from "../utilities/nuget-config-resolver";

export class GetPackages implements IRequestHandler<GetPackagesRequest, GetPackagesResponse> {
  async HandleAsync(request: GetPackagesRequest): Promise<GetPackagesResponse> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    if (request.ForceReload) {
      nugetApiFactory.ClearCache();
    }

    if (request.Url === "") {
      const sources = await NuGetConfigResolver.GetSourcesAndDecodePasswords(workspaceRoot);

      if (!request.Filter) {
        if (sources.length > 0) {
          request.Url = sources[0].Url;
        } else {
          return { IsFailure: false, Packages: [] };
        }
      } else {
        try {
          const promises = sources.map(async (source) => {
            try {
              const api = await nugetApiFactory.GetSourceApi(source.Url);
              return await api.GetPackagesAsync(
                request.Filter,
                request.Prerelease,
                request.Skip,
                request.Take
              );
            } catch (error) {
              Logger.error(`GetPackages.HandleAsync: Failed to fetch packages from ${source.Url}`, error);
              return { data: [] };
            }
          });

          const results = await Promise.all(promises);
          let allPackages: Package[] = [];
          const seenIds = new Set<string>();

          results.forEach(result => {
            result.data.forEach(pkg => {
              if (!seenIds.has(pkg.Id)) {
                seenIds.add(pkg.Id);
                allPackages.push(pkg);
              }
            });
          });

          return {
            IsFailure: false,
            Packages: allPackages
          };
        } catch (err: any) {
           Logger.error(`GetPackages.HandleAsync: Failed to fetch packages from all sources`, err);
           return {
             IsFailure: true,
             Error: { Message: "Failed to fetch packages from all sources" }
           };
        }
      }
    }

    Logger.info(`GetPackages.HandleAsync: Fetching packages from ${request.Url} with filter '${request.Filter}'`);
    let api = await nugetApiFactory.GetSourceApi(request.Url);
    try {
      let packages = await api.GetPackagesAsync(
        request.Filter,
        request.Prerelease,
        request.Skip,
        request.Take
      );
      Logger.info(`GetPackages.HandleAsync: Successfully fetched ${packages.data.length} packages`);
      let result: GetPackagesResponse = {
        IsFailure: false,
        Packages: packages.data,
      };
      return result;
    } catch (err: any) {
      Logger.error(`GetPackages.HandleAsync: Failed to fetch packages from ${request.Url}`, err);
      let result: GetPackagesResponse = {
        IsFailure: true,
        Error: {
          Message: "Failed to fetch packages",
        },
      };
      return result;
    }
  }
}
