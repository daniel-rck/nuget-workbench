import { IRequestHandler } from "@/common/messaging/core/types";
import * as vscode from "vscode";
import TaskExecutor from "../utilities/task-executor";
import CpmResolver from "../utilities/cpm-resolver";
import { Logger } from "../../common/logger";
import StatusBarUtils from "../utilities/status-bar-utils";

export class ConsolidatePackages
  implements IRequestHandler<ConsolidateRequest, ConsolidateResponse>
{
  async HandleAsync(request: ConsolidateRequest): Promise<ConsolidateResponse> {
    Logger.info(
      `ConsolidatePackages.HandleAsync: Consolidating ${request.PackageId} to ${request.TargetVersion} across ${request.ProjectPaths.length} projects`
    );

    try {
      for (let i = 0; i < request.ProjectPaths.length; i++) {
        const projectPath = request.ProjectPaths[i];
        StatusBarUtils.ShowText(
          `Consolidating ${request.PackageId} (${i + 1}/${request.ProjectPaths.length})...`
        );

        const isCpm = CpmResolver.GetPackageVersions(projectPath) !== null;
        const skipRestore =
          !!vscode.workspace
            .getConfiguration("NugetGallery")
            .get<string>("skipRestore") && !isCpm;

        // Remove the old version
        const removeArgs = [
          "package",
          "remove",
          request.PackageId,
          "--project",
          projectPath.replace(/\\/g, "/"),
        ];

        const removeTask = new vscode.Task(
          { type: "dotnet", task: "dotnet remove package" },
          vscode.TaskScope.Workspace,
          "nuget-gallery-consolidate",
          "dotnet",
          new vscode.ShellExecution("dotnet", removeArgs)
        );
        removeTask.presentationOptions.reveal = vscode.TaskRevealKind.Silent;
        await TaskExecutor.ExecuteTask(removeTask);

        // Add with target version
        const addArgs = [
          "package",
          "add",
          request.PackageId,
          "--project",
          projectPath.replace(/\\/g, "/"),
          "--version",
          request.TargetVersion,
        ];
        if (skipRestore) {
          addArgs.push("--no-restore");
        }

        const addTask = new vscode.Task(
          { type: "dotnet", task: "dotnet add package" },
          vscode.TaskScope.Workspace,
          "nuget-gallery-consolidate",
          "dotnet",
          new vscode.ShellExecution("dotnet", addArgs)
        );
        addTask.presentationOptions.reveal = vscode.TaskRevealKind.Silent;
        await TaskExecutor.ExecuteTask(addTask);
      }

      CpmResolver.ClearCache();
      StatusBarUtils.hide();

      Logger.info(
        `ConsolidatePackages: Successfully consolidated ${request.PackageId} to ${request.TargetVersion}`
      );
      return { Success: true };
    } catch (err: any) {
      Logger.error(`ConsolidatePackages: Failed to consolidate ${request.PackageId}`, err);
      StatusBarUtils.hide();
      return {
        Success: false,
        Error: err.message ?? "Unknown error",
      };
    }
  }
}
