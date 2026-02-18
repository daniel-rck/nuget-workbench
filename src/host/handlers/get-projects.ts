import * as vscode from "vscode";
import { IRequestHandler } from "../../common/messaging/core/types";
import ProjectParser from "../utilities/project-parser";
import CpmResolver from "../utilities/cpm-resolver";
import { Logger } from "../../common/logger";


export class GetProjects implements IRequestHandler<GetProjectsRequest, GetProjectsResponse> {
  async HandleAsync(request: GetProjectsRequest): Promise<GetProjectsResponse> {
    Logger.info("GetProjects.HandleAsync: Handling request");
    if (request.ForceReload) {
      CpmResolver.ClearCache();
    }
    
    const projectFiles = await vscode.workspace.findFiles(
      "**/*.{csproj,fsproj,vbproj}",
      "**/node_modules/**"
    );

    Logger.info(`GetProjects.HandleAsync: Found ${projectFiles.length} project files`);

    const projects: Array<Project> = [];
    projectFiles
      .map((x) => x.fsPath)
      .forEach((x) => {
        try {
          const cpmVersions = CpmResolver.GetPackageVersions(x);
          if (cpmVersions) {
            Logger.debug(`GetProjects.HandleAsync: CPM enabled for ${x} with ${cpmVersions.size} versions`);
          } else {
            Logger.debug(`GetProjects.HandleAsync: CPM not enabled for ${x}`);
          }
          const project = ProjectParser.Parse(x, cpmVersions);
          project.CpmEnabled = cpmVersions !== null;
          projects.push(project);
        } catch (e) {
          Logger.error(`GetProjects.HandleAsync: Failed to parse project ${x}`, e);
        }
      });
    const compareName = (nameA: string, nameB: string) => {
      return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
    };
    const sortedProjects = projects.sort((a, b) =>
      compareName(a.Name?.toLowerCase(), b.Name?.toLowerCase())
    );

    const response: GetProjectsResponse = {
      Projects: sortedProjects,
    };
    return response;
  }
}
