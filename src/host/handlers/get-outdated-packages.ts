import { IRequestHandler } from "@/common/messaging/core/types";
import * as vscode from "vscode";
import ProjectParser from "../utilities/project-parser";
import CpmResolver from "../utilities/cpm-resolver";
import nugetApiFactory from "../nuget/api-factory";
import NuGetConfigResolver from "../utilities/nuget-config-resolver";
import { Logger } from "../../common/logger";
import StatusBarUtils from "../utilities/status-bar-utils";

export class GetOutdatedPackages
  implements IRequestHandler<GetOutdatedPackagesRequest, GetOutdatedPackagesResponse>
{
  async HandleAsync(request: GetOutdatedPackagesRequest): Promise<GetOutdatedPackagesResponse> {
    Logger.info("GetOutdatedPackages.HandleAsync: Checking for outdated packages");
    StatusBarUtils.show(0, "Checking for updates...");

    try {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      const sources = await NuGetConfigResolver.GetSourcesAndDecodePasswords(workspaceRoot);

      if (sources.length === 0) {
        return { IsFailure: false, Packages: [] };
      }

      // Load projects
      let projectFiles = await vscode.workspace.findFiles(
        "**/*.{csproj,fsproj,vbproj}",
        "**/node_modules/**"
      );

      // Filter to specific projects if requested
      if (request.ProjectPaths && request.ProjectPaths.length > 0) {
        projectFiles = projectFiles.filter((f) => request.ProjectPaths!.includes(f.fsPath));
      }

      const projects: Array<Project> = [];
      for (const file of projectFiles) {
        try {
          const cpmVersions = CpmResolver.GetPackageVersions(file.fsPath);
          const project = ProjectParser.Parse(file.fsPath, cpmVersions);
          project.CpmEnabled = cpmVersions !== null;
          projects.push(project);
        } catch (e) {
          Logger.error(`GetOutdatedPackages: Failed to parse ${file.fsPath}`, e);
        }
      }

      // Collect unique installed packages with their versions across projects
      const installedMap = new Map<
        string,
        { version: string; projects: Array<{ Name: string; Path: string; Version: string }> }
      >();

      for (const project of projects) {
        for (const pkg of project.Packages) {
          if (!pkg.Version || pkg.IsPinned) continue;

          const existing = installedMap.get(pkg.Id);
          const projectInfo = { Name: project.Name, Path: project.Path, Version: pkg.Version };

          if (existing) {
            existing.projects.push(projectInfo);
            // Use highest installed version as baseline
            if (this.compareVersions(pkg.Version, existing.version) > 0) {
              existing.version = pkg.Version;
            }
          } else {
            installedMap.set(pkg.Id, {
              version: pkg.Version,
              projects: [projectInfo],
            });
          }
        }
      }

      Logger.info(
        `GetOutdatedPackages: Found ${installedMap.size} unique packages to check`
      );

      // Check each package against feeds in batches
      const outdated: Array<OutdatedPackage> = [];
      const packageIds = Array.from(installedMap.keys());
      const batchSize = 5;

      for (let i = 0; i < packageIds.length; i += batchSize) {
        const batch = packageIds.slice(i, i + batchSize);
        const progress = Math.round(((i + batch.length) / packageIds.length) * 100);
        StatusBarUtils.show(progress, `Checking updates (${i + batch.length}/${packageIds.length})...`);

        const promises = batch.map(async (packageId) => {
          const installed = installedMap.get(packageId)!;
          const latestVersion = await this.getLatestVersion(
            packageId,
            request.Prerelease,
            sources
          );

          if (latestVersion && this.compareVersions(latestVersion.version, installed.version) > 0) {
            outdated.push({
              Id: packageId,
              InstalledVersion: installed.version,
              LatestVersion: latestVersion.version,
              Projects: installed.projects,
              SourceUrl: latestVersion.sourceUrl,
              SourceName: latestVersion.sourceName,
            });
          }
        });

        await Promise.allSettled(promises);
      }

      // Sort by package name
      outdated.sort((a, b) => a.Id.localeCompare(b.Id));

      Logger.info(`GetOutdatedPackages: Found ${outdated.length} outdated packages`);
      return { IsFailure: false, Packages: outdated };
    } catch (err: any) {
      Logger.error("GetOutdatedPackages: Failed", err);
      return {
        IsFailure: true,
        Error: { Message: "Failed to check for outdated packages" },
      };
    } finally {
      StatusBarUtils.hide();
    }
  }

  private async getLatestVersion(
    packageId: string,
    prerelease: boolean,
    sources: Array<{ Name: string; Url: string }>
  ): Promise<{ version: string; sourceUrl: string; sourceName: string } | null> {
    let best: { version: string; sourceUrl: string; sourceName: string } | null = null;

    const promises = sources.map(async (source) => {
      try {
        const api = await nugetApiFactory.GetSourceApi(source.Url);
        const result = await api.GetPackagesAsync(packageId, prerelease, 0, 1);
        const pkg = result.data.find(
          (p) => p.Name.toLowerCase() === packageId.toLowerCase()
        );
        if (pkg) {
          return { version: pkg.Version, sourceUrl: source.Url, sourceName: source.Name };
        }
      } catch {
        // Ignore feed errors
      }
      return null;
    });

    const results = await Promise.allSettled(promises);

    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        if (!best || this.compareVersions(result.value.version, best.version) > 0) {
          best = result.value;
        }
      }
    }

    return best;
  }

  private compareVersions(a: string, b: string): number {
    // Strip pinned notation [x.x.x]
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
