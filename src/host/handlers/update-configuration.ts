import { IRequestHandler } from "@/common/messaging/core/types";
import * as vscode from "vscode";
import { Logger } from "../../common/logger";
import { UpdateConfigurationRequest, UpdateConfigurationResponse } from "@/common/messaging/update-configuration";

export default class UpdateConfiguration
  implements IRequestHandler<UpdateConfigurationRequest, UpdateConfigurationResponse>
{
  async HandleAsync(request: UpdateConfigurationRequest): Promise<UpdateConfigurationResponse> {
    Logger.info("UpdateConfiguration.HandleAsync: Updating configuration");
    const config = vscode.workspace.getConfiguration("NugetGallery");

    const sources = request.Configuration.Sources.map((x) => 
      JSON.stringify({ 
        name: x.Name, 
        url: x.Url,
        ...(x.PasswordScriptPath && { passwordScriptPath: x.PasswordScriptPath })
      })
    );

    await config.update("skipRestore", request.Configuration.SkipRestore, vscode.ConfigurationTarget.Global);
    await config.update("enablePackageVersionInlineInfo", request.Configuration.EnablePackageVersionInlineInfo, vscode.ConfigurationTarget.Global);
    await config.update("prerelease", request.Configuration.Prerelease, vscode.ConfigurationTarget.Global);
    await config.update("sources", sources, vscode.ConfigurationTarget.Global);
    Logger.info("UpdateConfiguration.HandleAsync: Configuration updated successfully");
    return {};
  }
}
