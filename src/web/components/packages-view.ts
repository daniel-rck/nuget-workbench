import {
  FASTElement,
  customElement,
  html,
  css,
  repeat,
  observable,
  when,
  ExecutionContext,
  volatile,
} from "@microsoft/fast-element";

import Split from "split.js";
import hash from "object-hash";
import lodash from "lodash";
import { Configuration, IMediator } from "@/web/registrations";
import {
  GET_PACKAGE,
  GET_PACKAGES,
  GET_PROJECTS,
  UPDATE_STATUS_BAR,
} from "@/common/messaging/core/commands";
import {
  UpdateStatusBarRequest,
  UpdateStatusBarResponse,
} from "@/common/messaging/update-status-bar";
import {
  GetPackageRequest,
  GetPackageResponse,
} from "@/common/messaging/get-package";
import codicon from "@/web/styles/codicon.css";
import { scrollableBase } from "@/web/styles/base.css";
import { PackageViewModel, ProjectViewModel } from "../types";
import { FilterEvent } from "./search-bar";
import { UpdatesView } from "./updates-view";
import { ConsolidateView } from "./consolidate-view";

const template = html<PackagesView>`
  <div class="container">
    <div class="col" id="project-tree">
      <project-tree
        :projects=${(x) => x.projects}
        @selection-changed=${(x, c) =>
          x.OnProjectSelectionChanged(
            (c.event as CustomEvent<string[]>).detail
          )}
      ></project-tree>
    </div>

    <div class="col" id="packages">
      <search-bar
        @reload-invoked=${async (x, e) =>
          await x.ReloadInvoked((e.event as CustomEvent<boolean>).detail)}
        @filter-changed=${async (x, e) =>
          await x.UpdatePackagesFilters(
            (e.event as CustomEvent<FilterEvent>).detail
          )}
      ></search-bar>
      <vscode-panels class="tabs" aria-label="Default"
        @change=${(x, c) => x.OnTabChanged(c.event)}
      >
        <vscode-panel-tab class="tab" id="tab-1">BROWSE</vscode-panel-tab>
        <vscode-panel-tab class="tab" id="tab-2">INSTALLED</vscode-panel-tab>
        <vscode-panel-tab class="tab" id="tab-3">UPDATES</vscode-panel-tab>
        <vscode-panel-tab class="tab" id="tab-4">CONSOLIDATE</vscode-panel-tab>
        <vscode-panel-view class="views" id="view-1">
          <div
            class="packages-container"
            @scroll=${async (x, e) =>
              await x.PackagesScrollEvent(e.event.target as HTMLElement)}
          >
            ${when(
              (x) => !x.packagesLoadingError,
              html<PackagesView>`
                ${repeat(
                  (x) => x.packages,
                  html<PackageViewModel>`
                    <package-row
                      :package=${(x) => x}
                      @click=${(x, c: ExecutionContext<PackagesView, any>) =>
                        c.parent.SelectPackage(x)}
                    >
                    </package-row>
                  `
                )}
                ${when(
                  (x) => !x.noMorePackages,
                  html<PackagesView>`<vscode-progress-ring
                    class="loader"
                  ></vscode-progress-ring>`
                )}
              `,
              html<PackagesView>`<div class="error">
                <span class="codicon codicon-error"></span> Failed to fetch
                packages. See 'Webview Developer Tools' for more details
              </div> `
            )}
          </div>
        </vscode-panel-view>
        <vscode-panel-view class="views installed-packages" id="view-2">
          <div class="packages-container">
            ${repeat(
              (x) => x.projectsPackages,
              html<PackageViewModel>`
                <package-row
                  :showInstalledVersion="${(x) => true}"
                  :package=${(x) => x}
                  @click=${(x, c: ExecutionContext<PackagesView, any>) =>
                    c.parent.SelectPackage(x)}
                >
                </package-row>
              `
            )}
          </div>
        </vscode-panel-view>
        <vscode-panel-view class="views" id="view-3">
          <updates-view
            :prerelease=${(x) => x.filters.Prerelease}
            :projectPaths=${(x) => x.selectedProjectPaths}
          ></updates-view>
        </vscode-panel-view>
        <vscode-panel-view class="views" id="view-4">
          <consolidate-view
            :projectPaths=${(x) => x.selectedProjectPaths}
          ></consolidate-view>
        </vscode-panel-view>
      </vscode-panels>
    </div>

    <div class="col" id="projects">
      ${when(
        (x) => x.selectedPackage != null,
        html<PackagesView>`
          ${when(
            (x) => x.selectedPackage?.Status == "Detailed",
            html<PackagesView>`
              <div class="package-info">
                <span class="package-title">
                  ${when(
                    (x) => x.NugetOrgPackageUrl != null,
                    html<PackagesView>`<a
                      target="_blank"
                      :href=${(x) => x.NugetOrgPackageUrl}
                      ><span
                        class="package-link-icon codicon codicon-link-external"
                      ></span
                      >${(x) => x.selectedPackage?.Name}</a
                    >`,
                    html<PackagesView>`${(x) => x.selectedPackage?.Name}`
                  )}
                </span>
                <div class="version-selector">
                  <vscode-dropdown
                    :value=${(x) => x.selectedVersion}
                    @change=${(x, c) =>
                      (x.selectedVersion = (c.event.target as any).value)}
                  >
                    ${repeat(
                      (x) => x.selectedPackage?.Versions || [],
                      html<string>` <vscode-option>${(x) => x}</vscode-option> `
                    )}
                  </vscode-dropdown>
                  <vscode-button
                    appearance="icon"
                    @click=${(x) => x.LoadProjects()}
                  >
                    <span class="codicon codicon-refresh"></span>
                  </vscode-button>
                </div>
              </div>
              <div class="projects-panel-container">
                <package-details
                  :package=${(x) => x.selectedPackage}
                  :packageVersionUrl=${(x) => x.PackageVersionUrl}
                  :source=${(x) => x.selectedPackage?.SourceUrl || x.filters.SourceUrl}
                  :passwordScriptPath=${(x) => x.CurrentSource?.PasswordScriptPath}
                ></package-details>
                <div class="separator"></div>
                ${when(
                  (x) => x.projects.length > 0,
                  html<PackagesView>`
                    ${repeat(
                      (x) => x.filteredProjects,
                      html<ProjectViewModel>`
                        <project-row
                          @project-updated=${(
                            x,
                            c: ExecutionContext<PackagesView, any>
                          ) => c.parent.OnProjectUpdated(c.event as CustomEvent)}
                          :project=${(x) => x}
                          :packageId=${(
                            x,
                            c: ExecutionContext<PackagesView, any>
                          ) => c.parent.selectedPackage?.Name}
                          :packageVersion=${(
                            x,
                            c: ExecutionContext<PackagesView, any>
                          ) => c.parent.selectedVersion}
                          :sourceUrl=${(
                            x,
                            c: ExecutionContext<PackagesView, any>
                          ) => c.parent.selectedPackage?.SourceUrl}
                        >
                        </project-row>
                      `
                    )}
                  `,
                  html<PackagesView>`<div class="no-projects">
                    <span class="codicon codicon-info"></span> No projects found
                  </div>`
                )}
              </div>
            `,
            html<PackagesView>`${when(
              (x) => x.selectedPackage?.Status == "MissingDetails",
              html<PackagesView>`<vscode-progress-ring
                class="loader packages-details-loader "
              ></vscode-progress-ring>`,
              html<PackagesView>`<div class="error">
                <span class="codicon codicon-error"></span> Failed to fetch the
                package from the selected registry.
              </div> `
            )}`
          )}
        `
      )}
    </div>
  </div>
`;

const styles = css`
  .container {
    display: flex;
    height: 100%;

    .error {
      display: flex;
      gap: 4px;
      justify-content: center;
      flex: 1;
      margin-top: 32px;
      color: var(--vscode-errorForeground);
    }

    &:focus-visible {
      outline: unset;
    }

    .col {
      overflow: hidden;
    }

    .gutter {
      display: flex;
      margin: 0 6px;
      justify-content: center;
      transition: background-color 0.1s ease-out;

      &:hover {
        cursor: col-resize;
        background-color: var(--vscode-sash-hoverBorder);
      }
    }

    .gutter-nested {
      width: 1px;
      background-color: var(--vscode-panelSection-border);
    }

    #project-tree {
      display: flex;
      flex-direction: column;
    }

    #packages {
      display: flex;
      flex-direction: column;
      .loader {
        align-self: center;
        flex: 1;
      }

      .tabs {
        .tab {
          height: unset;
          font-size: 11px;
        }

        .installed-packages {
          flex-direction: column;
        }

        .views {
          flex: 1;
          padding: 0;
          overflow: hidden;
        }
        &::part(tablist) {
          font-size: 11px;
          padding: 0px;
        }
        &::part(tabpanel) {
          overflow: hidden;
          display: flex;
          margin-top: 6px;
        }
      }

      .packages-container {
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        flex: 1;

        .package {
          margin-bottom: 3px;
        }

        .loader {
          margin: 10px 0px;
        }
      }
    }

    #projects {
      display: flex;
      flex-direction: column;

      .packages-details-loader {
        align-self: center;
        margin-top: 20px;
      }

      .package-info {
        padding: 3px;
        margin-left: 2px;
        margin-right: 3px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;

        .package-title {
          font-size: 14px;
          font-weight: bold;
          overflow: hidden;
          text-overflow: ellipsis;
          text-wrap: nowrap;

          a {
            text-decoration: none;
            color: var(--vscode-editor-foreground);
          }

          .package-link-icon {
            vertical-align: middle;
            font-size: 12px;
            margin-right: 3px;
          }
        }

        .version-selector {
          text-wrap: nowrap;
          min-width: 128px;
        }
      }
      .projects-panel-container {
        overflow-y: auto;
        overflow-x: hidden;
        .no-projects {
          display: flex;
          gap: 4px;
          margin-left: 6px;
        }

        .separator {
          margin: 10px 0px;
          height: 1px;
          background-color: var(--vscode-panelSection-border);
        }
      }
    }
  }
`;

const PACKAGE_FETCH_TAKE = 50;
const PACKAGE_CONTAINER_SCROLL_MARGIN = 196;
const NUGET_ORG_PREFIX = "https://api.nuget.org";

@customElement({
  name: "packages-view",
  template,
  styles: [codicon, scrollableBase, styles],
})
export class PackagesView extends FASTElement {
  splitter: Split.Instance | null = null;
  packagesPage: number = 0;
  packagesLoadingInProgress: boolean = false;
  currentLoadPackageHash: string = "";
  activeTabId: string = "tab-1";
  updatesLoaded: boolean = false;
  consolidateLoaded: boolean = false;
  @IMediator mediator!: IMediator;
  @Configuration configuration!: Configuration;
  @observable projects: Array<ProjectViewModel> = [];
  @observable selectedVersion: string = "";
  @observable selectedPackage: PackageViewModel | null = null;
  @observable packages: Array<PackageViewModel> = [];
  @observable projectsPackages: Array<PackageViewModel> = [];
  @observable filters: FilterEvent = {
    Prerelease: true,
    Query: "",
    SourceUrl: "",
  };
  @observable noMorePackages: boolean = false;
  @observable packagesLoadingError: boolean = false;
  @observable selectedProjectPaths: string[] = [];

  connectedCallback(): void {
    super.connectedCallback();

    const projectTree = this.shadowRoot!.getElementById("project-tree")!;
    const packages = this.shadowRoot!.getElementById("packages")!;
    const projects = this.shadowRoot!.getElementById("projects")!;

    this.splitter = Split([projectTree, packages, projects], {
      sizes: [20, 45, 35],
      minSize: [120, 200, 150],
      gutterSize: 4,
      gutter: (_index: number, direction) => {
        const gutter = document.createElement("div");
        const gutterNested = document.createElement("div");
        gutter.className = `gutter gutter-${direction}`;
        gutterNested.className = "gutter-nested";
        gutter.appendChild(gutterNested);
        return gutter;
      },
    });
    this.filters.SourceUrl = "";
    this.LoadPackages();
    this.LoadProjects();
  }

  disconnectedCallback(): void {
    this.splitter?.destroy();
  }

  @volatile
  get CurrentSource() {
    return this.configuration.Configuration?.Sources.find(s => s.Url === this.filters.SourceUrl);
  }

  @volatile
  get NugetOrgPackageUrl() {
    const sourceUrl = this.selectedPackage?.SourceUrl || this.filters.SourceUrl;
    if (sourceUrl.startsWith(NUGET_ORG_PREFIX))
      return `https://www.nuget.org/packages/${this.selectedPackage?.Name}/${this.selectedVersion}`;
    else return null;
  }

  @volatile
  get PackageVersionUrl() {
    if (
      this.selectedPackage?.Status != "Detailed" ||
      this.selectedPackage?.Model.Versions == undefined ||
      this.selectedPackage?.Model.Versions.length < 1 ||
      !this.selectedPackage?.Model.Version
    )
      return "";

    return (
      this.selectedPackage?.Model.Versions.filter(
        (x) => x.Version == this.selectedVersion
      )[0].Id ?? ""
    );
  }

  @volatile
  get filteredProjects(): Array<ProjectViewModel> {
    if (this.selectedProjectPaths.length === 0) return this.projects;
    return this.projects.filter((p) => this.selectedProjectPaths.includes(p.Path));
  }

  OnProjectSelectionChanged(paths: string[]) {
    this.selectedProjectPaths = paths;
    this.updatesLoaded = false;
    this.consolidateLoaded = false;
    this.debouncedLoadProjectsPackages();
  }

  private debouncedLoadProjectsPackages = lodash.debounce(() => {
    this.LoadProjectsPackages();
  }, 300);

  OnTabChanged(event: Event) {
    const panel = event.target as HTMLElement;
    const activeTab = panel?.querySelector?.("[aria-selected='true']");
    const tabId = activeTab?.id || "";
    this.activeTabId = tabId;

    if (tabId === "tab-3") {
      const updatesView = this.shadowRoot?.querySelector("updates-view") as UpdatesView | null;
      if (updatesView && !this.updatesLoaded) {
        this.updatesLoaded = true;
        updatesView.LoadOutdatedPackages();
      }
    } else if (tabId === "tab-4") {
      const consolidateView = this.shadowRoot?.querySelector("consolidate-view") as ConsolidateView | null;
      if (consolidateView && !this.consolidateLoaded) {
        this.consolidateLoaded = true;
        consolidateView.LoadInconsistentPackages();
      }
    }
  }

  async LoadProjectsPackages(forceReload: boolean = false) {
    const projectsToUse = this.selectedProjectPaths.length > 0
      ? this.projects.filter((p) => this.selectedProjectPaths.includes(p.Path))
      : this.projects;

    const packages = projectsToUse
      ?.flatMap((p) => p.Packages)
      .filter((x) =>
        x.Id.toLowerCase().includes(this.filters.Query?.toLowerCase())
      );

    // Group packages by Id and track versions and whether at least one is not pinned
    const grouped = packages.reduce((acc: { [key: string]: { versions: string[], allowsUpdate: boolean } }, item) => {
      const { Id, Version, IsPinned } = item;

      if (!acc[Id]) {
        acc[Id] = { versions: [], allowsUpdate: false };
      }

      if (acc[Id].versions.indexOf(Version) < 0) {
        acc[Id].versions.push(Version);
      }

      // If at least one project has this package not pinned, allow updates
      if (!IsPinned) {
        acc[Id].allowsUpdate = true;
      }

      return acc;
    }, {});

    this.projectsPackages = Object.entries(grouped).map(
      ([Id, data]) => {
        const pkg = new PackageViewModel(
          {
            Id: Id,
            Name: Id,
            IconUrl: "",
            Versions: data.versions.map((x) => ({
              Id: "",
              Version: x,
            })),
            InstalledVersion:
              data.versions.length > 1
                ? "Multiple"
                : data.versions[0] ?? "",
            Version: "",
            Description: "",
            LicenseUrl: "",
            ProjectUrl: "",
            Verified: false,
            TotalDownloads: 0,
            Tags: [],
            Registration: "",
            Authors: [],
          },
          "MissingDetails"
        );
        pkg.AllowsUpdate = data.allowsUpdate;
        return pkg;
      }
    );

    const total = this.projectsPackages.length;
    let completed = 0;

    if (total > 0) {
      await this.mediator.PublishAsync<
        UpdateStatusBarRequest,
        UpdateStatusBarResponse
      >(UPDATE_STATUS_BAR, {
        Percentage: 0,
        Message: "Loading installed packages...",
      });
    }

    try {
      const promises = this.projectsPackages.map(async (pkg) => {
        await this.UpdatePackage(pkg, forceReload);
        completed++;
        await this.mediator.PublishAsync<
          UpdateStatusBarRequest,
          UpdateStatusBarResponse
        >(UPDATE_STATUS_BAR, {
          Percentage: (completed / total) * 100,
          Message: "Loading installed packages...",
        });
      });
      await Promise.all(promises);
    } finally {
      if (total > 0) {
        await this.mediator.PublishAsync<
          UpdateStatusBarRequest,
          UpdateStatusBarResponse
        >(UPDATE_STATUS_BAR, {
          Percentage: null,
        });
      }
    }
  }

  async OnProjectUpdated(event: CustomEvent) {
    const isCpmEnabled = event.detail?.isCpmEnabled ?? false;
    if (isCpmEnabled) {
      // When CPM is enabled, reload all projects as the update affects all of them
      await this.LoadProjects();
    } else {
      // For non-CPM projects, just refresh the packages list
      await this.LoadProjectsPackages();
    }
  }

  async UpdatePackage(projectPackage: PackageViewModel, forceReload: boolean = false) {
    const result = await this.mediator.PublishAsync<
      GetPackageRequest,
      GetPackageResponse
    >(GET_PACKAGE, {
      Id: projectPackage.Id,
      Url: this.filters.SourceUrl,
      SourceName: this.CurrentSource?.Name,
      Prerelease: this.filters.Prerelease,
      PasswordScriptPath: this.CurrentSource?.PasswordScriptPath,
      ForceReload: forceReload,
    });

    if (result.IsFailure || !result.Package) {
      projectPackage.Status = "Error";
    } else {
      if (projectPackage.Version != "") result.Package.Version = "";
      projectPackage.UpdatePackage(result.Package, result.SourceUrl);
      projectPackage.Status = "Detailed";
    }
  }

  async UpdatePackagesFilters(filters: FilterEvent) {
    const forceReload = this.filters.Prerelease !== filters.Prerelease;
    this.filters = filters;
    await this.LoadPackages(false, forceReload);
    await this.LoadProjectsPackages(forceReload);
  }

  async SelectPackage(selectedPackage: PackageViewModel) {
    this.packages
      .filter((x) => x.Selected)
      .forEach((x) => (x.Selected = false));
    this.projectsPackages
      .filter((x) => x.Selected)
      .forEach((x) => (x.Selected = false));
    selectedPackage.Selected = true;
    this.selectedPackage = selectedPackage;
    if (this.selectedPackage.Status == "MissingDetails") {
      const packageToUpdate = this.selectedPackage;
      const result = await this.mediator.PublishAsync<
        GetPackageRequest,
        GetPackageResponse
      >(GET_PACKAGE, {
        Id: packageToUpdate.Id,
        Url: this.filters.SourceUrl,
        SourceName: this.CurrentSource?.Name,
        Prerelease: this.filters.Prerelease,
        PasswordScriptPath: this.CurrentSource?.PasswordScriptPath,
      });

      if (result.IsFailure || !result.Package) {
        packageToUpdate.Status = "Error";
      } else {
        if (packageToUpdate.Version != "") result.Package.Version = "";
        packageToUpdate.UpdatePackage(result.Package, result.SourceUrl);
        packageToUpdate.Status = "Detailed";
      }
    }
    this.selectedVersion = this.selectedPackage.Version;
  }

  async PackagesScrollEvent(target: HTMLElement) {
    if (this.packagesLoadingInProgress || this.noMorePackages) return;
    if (
      target.scrollTop + target.getBoundingClientRect().height >
      target.scrollHeight - PACKAGE_CONTAINER_SCROLL_MARGIN
    )
    await this.LoadPackages(true);
  }

  async ReloadInvoked(forceReload: boolean = false) {
    await this.LoadPackages(false, forceReload);
    await this.LoadProjects(forceReload);
    this.updatesLoaded = false;
    this.consolidateLoaded = false;
  }

  async LoadPackages(append: boolean = false, forceReload: boolean = false) {
    const _getLoadPackageRequest = () => {
      return {
        Url: this.filters.SourceUrl,
        SourceName: this.CurrentSource?.Name,
        Filter: this.filters.Query,
        Prerelease: this.filters.Prerelease,
        Skip: this.packagesPage * PACKAGE_FETCH_TAKE,
        Take: PACKAGE_FETCH_TAKE,
        PasswordScriptPath: this.CurrentSource?.PasswordScriptPath,
        ForceReload: forceReload,
      };
    };

    this.packagesLoadingError = false;
    this.packagesLoadingInProgress = true;
    if (append == false) {
      this.packagesPage = 0;
      this.selectedPackage = null;
      this.packages = [];
    }
    this.noMorePackages = false;

    const requestObject = _getLoadPackageRequest();
    this.currentLoadPackageHash = hash(requestObject);

    const result = await this.mediator.PublishAsync<
      GetPackagesRequest,
      GetPackagesResponse
    >(GET_PACKAGES, requestObject);
    if (this.currentLoadPackageHash != hash(_getLoadPackageRequest())) return;
    if (result.IsFailure) {
      this.packagesLoadingError = true;
    } else {
      const packagesViewModels = result.Packages!.map(
        (x) => new PackageViewModel(x)
      );
      if (packagesViewModels.length < requestObject.Take)
        this.noMorePackages = true;
      this.packages.push(...packagesViewModels);
      this.packagesPage++;
      this.packagesLoadingInProgress = false;
    }
  }

  async LoadProjects(forceReload: boolean = false) {
    this.projects = [];
    const result = await this.mediator.PublishAsync<
      GetProjectsRequest,
      GetProjectsResponse
    >(GET_PROJECTS, { ForceReload: forceReload });

    this.projects = result.Projects.map((x) => new ProjectViewModel(x));
    this.selectedProjectPaths = this.projects.map((p) => p.Path);
    await this.LoadProjectsPackages(forceReload);
  }
}
