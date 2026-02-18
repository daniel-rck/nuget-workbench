import { IRequestHandler } from "@/common/messaging/core/types";
import * as vscode from "vscode";
import TaskExecutor from "../utilities/task-executor";
import CpmResolver from "../utilities/cpm-resolver";
import { Logger } from "../../common/logger";
import StatusBarUtils from "../utilities/status-bar-utils";

export class BatchUpdatePackages
  implements IRequestHandler<BatchUpdateRequest, BatchUpdateResponse>
{
  async HandleAsync(request: BatchUpdateRequest): Promise<BatchUpdateResponse> {
    Logger.info(
      `BatchUpdatePackages.HandleAsync: Updating ${request.Updates.length} packages`
    );

    const results: Array<{ PackageId: string; Success: boolean; Error?: string }> = [];

    for (let i = 0; i < request.Updates.length; i++) {
      const update = request.Updates[i];
      StatusBarUtils.ShowText(
        `Updating ${update.PackageId} to ${update.Version} (${i + 1}/${request.Updates.length})...`
      );

      try {
        for (const projectPath of update.ProjectPaths) {
          const isCpm = CpmResolver.GetPackageVersions(projectPath) !== null;
          const skipRestore =
            !!vscode.workspace
              .getConfiguration("NugetGallery")
              .get<string>("skipRestore") && !isCpm;

          // Remove first, then add with new version
          const removeArgs = [
            "package",
            "remove",
            update.PackageId,
            "--project",
            projectPath.replace(/\\/g, "/"),
          ];

          const removeTask = new vscode.Task(
            { type: "dotnet", task: "dotnet remove package" },
            vscode.TaskScope.Workspace,
            "nuget-gallery-batch",
            "dotnet",
            new vscode.ShellExecution("dotnet", removeArgs)
          );
          removeTask.presentationOptions.reveal = vscode.TaskRevealKind.Silent;
          await TaskExecutor.ExecuteTask(removeTask);

          const addArgs = [
            "package",
            "add",
            update.PackageId,
            "--project",
            projectPath.replace(/\\/g, "/"),
            "--version",
            update.Version,
          ];
          if (skipRestore) {
            addArgs.push("--no-restore");
          }

          const addTask = new vscode.Task(
            { type: "dotnet", task: "dotnet add package" },
            vscode.TaskScope.Workspace,
            "nuget-gallery-batch",
            "dotnet",
            new vscode.ShellExecution("dotnet", addArgs)
          );
          addTask.presentationOptions.reveal = vscode.TaskRevealKind.Silent;
          await TaskExecutor.ExecuteTask(addTask);
        }

        results.push({ PackageId: update.PackageId, Success: true });
        Logger.info(
          `BatchUpdatePackages: Successfully updated ${update.PackageId} to ${update.Version}`
        );
      } catch (err: any) {
        Logger.error(
          `BatchUpdatePackages: Failed to update ${update.PackageId}`,
          err
        );
        results.push({
          PackageId: update.PackageId,
          Success: false,
          Error: err.message ?? "Unknown error",
        });
      }
    }

    CpmResolver.ClearCache();
    StatusBarUtils.hide();

    return { Results: results };
  }
}
