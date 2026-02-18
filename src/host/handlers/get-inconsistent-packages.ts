import { IRequestHandler } from "@/common/messaging/core/types";
import * as vscode from "vscode";
import ProjectParser from "../utilities/project-parser";
import CpmResolver from "../utilities/cpm-resolver";
import { Logger } from "../../common/logger";

export class GetInconsistentPackages
  implements IRequestHandler<GetInconsistentPackagesRequest, GetInconsistentPackagesResponse>
{
  async HandleAsync(
    request: GetInconsistentPackagesRequest
  ): Promise<GetInconsistentPackagesResponse> {
    Logger.info("GetInconsistentPackages.HandleAsync: Checking for version inconsistencies");

    try {
      let projectFiles = await vscode.workspace.findFiles(
        "**/*.{csproj,fsproj,vbproj}",
        "**/node_modules/**"
      );

      if (request.ProjectPaths && request.ProjectPaths.length > 0) {
        projectFiles = projectFiles.filter((f) => request.ProjectPaths!.includes(f.fsPath));
      }

      const projects: Array<Project> = [];
      let anyCpmEnabled = false;

      for (const file of projectFiles) {
        try {
          const cpmVersions = CpmResolver.GetPackageVersions(file.fsPath);
          const project = ProjectParser.Parse(file.fsPath, cpmVersions);
          project.CpmEnabled = cpmVersions !== null;
          if (project.CpmEnabled) anyCpmEnabled = true;
          projects.push(project);
        } catch (e) {
          Logger.error(`GetInconsistentPackages: Failed to parse ${file.fsPath}`, e);
        }
      }

      // Group packages by Id, collecting all versions and their projects
      const packageMap = new Map<
        string,
        Map<string, Array<{ Name: string; Path: string }>>
      >();

      for (const project of projects) {
        for (const pkg of project.Packages) {
          if (!pkg.Version) continue;

          if (!packageMap.has(pkg.Id)) {
            packageMap.set(pkg.Id, new Map());
          }

          const versionMap = packageMap.get(pkg.Id)!;
          if (!versionMap.has(pkg.Version)) {
            versionMap.set(pkg.Version, []);
          }

          versionMap
            .get(pkg.Version)!
            .push({ Name: project.Name, Path: project.Path });
        }
      }

      // Filter to packages with more than one version
      const inconsistent: Array<InconsistentPackage> = [];

      for (const [packageId, versionMap] of packageMap) {
        if (versionMap.size <= 1) continue;

        const versions = Array.from(versionMap.entries())
          .map(([version, projects]) => ({ Version: version, Projects: projects }))
          .sort((a, b) => this.compareVersions(b.Version, a.Version));

        const latestInstalledVersion = versions[0].Version;

        // Check if any project has this as CPM-managed
        const isCpmManaged = anyCpmEnabled;

        inconsistent.push({
          Id: packageId,
          Versions: versions,
          LatestInstalledVersion: latestInstalledVersion,
          CpmManaged: isCpmManaged,
        });
      }

      inconsistent.sort((a, b) => a.Id.localeCompare(b.Id));

      Logger.info(
        `GetInconsistentPackages: Found ${inconsistent.length} packages with inconsistent versions`
      );
      return { IsFailure: false, Packages: inconsistent };
    } catch (err: any) {
      Logger.error("GetInconsistentPackages: Failed", err);
      return {
        IsFailure: true,
        Error: { Message: "Failed to check for inconsistent packages" },
      };
    }
  }

  private compareVersions(a: string, b: string): number {
    const cleanA = a.replace(/[[\]()]/g, "");
    const cleanB = b.replace(/[[\]()]/g, "");

    const partsA = cleanA.split(/[.\-+]/).map((p) => {
      const n = parseInt(p, 10);
      return isNaN(n) ? p : n;
    });
    const partsB = cleanB.split(/[.\-+]/).map((p) => {
      const n = parseInt(p, 10);
      return isNaN(n) ? p : n;
    });

    const maxLen = Math.max(partsA.length, partsB.length);
    for (let i = 0; i < maxLen; i++) {
      const pA = partsA[i] ?? 0;
      const pB = partsB[i] ?? 0;

      if (typeof pA === "number" && typeof pB === "number") {
        if (pA !== pB) return pA - pB;
      } else {
        const cmp = String(pA).localeCompare(String(pB));
        if (cmp !== 0) return cmp;
      }
    }
    return 0;
  }
}
