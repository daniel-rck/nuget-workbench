import { IRequestHandler } from "@/common/messaging/core/types";
import nugetApiFactory from "../nuget/api-factory";
import * as vscode from "vscode";
import { Logger } from "../../common/logger";

export class GetPackage implements IRequestHandler<GetPackageRequest, GetPackageResponse> {
  async HandleAsync(request: GetPackageRequest): Promise<GetPackageResponse> {
    Logger.info(`GetPackage: Fetching package ${request.Id} from ${request.Url}`);
    let api = await nugetApiFactory.GetSourceApi(request.Url);
    try {
      let packageResult = await api.GetPackageAsync(request.Id);

      if (packageResult.isError) {
        Logger.error(`GetPackage: Failed to fetch package ${request.Id} from ${request.Url}`);
        return {
          IsFailure: true,
          Error: {
            Message: "Failed to fetch package",
          },
        };
      }

      Logger.info(`GetPackage: Successfully fetched package ${request.Id}`);
      let result: GetPackageResponse = {
        IsFailure: false,
        Package: packageResult.data,
      };
      return result;
    } catch (err: any) {
      Logger.error(`GetPackage: Exception while fetching package ${request.Id} from ${request.Url}`, err);
      console.error("Failed to fetch package:", request.Url, err);
      let result: GetPackageResponse = {
        IsFailure: true,
        Error: {
          Message: "Failed to fetch package",
        },
      };
      return result;
    }
  }
}
