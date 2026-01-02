import { IRequestHandler } from "@/common/messaging/core/types";
import nugetApiFactory from "../nuget/api-factory";
import * as vscode from "vscode";
import { Logger } from "../../common/logger";

export class GetPackages implements IRequestHandler<GetPackagesRequest, GetPackagesResponse> {
  async HandleAsync(request: GetPackagesRequest): Promise<GetPackagesResponse> {
    Logger.info(`GetPackages: Fetching packages from ${request.Url} with filter '${request.Filter}'`);
    let api = await nugetApiFactory.GetSourceApi(request.Url);
    try {
      let packages = await api.GetPackagesAsync(
        request.Filter,
        request.Prerelease,
        request.Skip,
        request.Take
      );
      Logger.info(`GetPackages: Successfully fetched ${packages.data.length} packages`);
      let result: GetPackagesResponse = {
        IsFailure: false,
        Packages: packages.data,
      };
      return result;
    } catch (err: any) {
      Logger.error(`GetPackages: Failed to fetch packages from ${request.Url}`, err);
      console.error("Failed to fetch packages:", request.Url, err);
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
