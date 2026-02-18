import {
  FASTElement,
  customElement,
  html,
  css,
  repeat,
  observable,
  when,
} from "@microsoft/fast-element";

import codicon from "@/web/styles/codicon.css";
import { scrollableBase } from "@/web/styles/base.css";
import { IMediator } from "@/web/registrations";
import {
  GET_INCONSISTENT_PACKAGES,
  CONSOLIDATE_PACKAGES,
} from "@/common/messaging/core/commands";
import { InconsistentPackageViewModel } from "../types";

const template = html<ConsolidateView>`
  <div class="consolidate-container">
    <div class="toolbar">
      <vscode-button appearance="icon" @click=${(x) => x.LoadInconsistentPackages()}>
        <span class="codicon codicon-refresh"></span>
      </vscode-button>
      <span class="status-text">${(x) => x.statusText}</span>
      <div class="toolbar-right">
        ${when(
          (x) => x.packages.length > 0,
          html<ConsolidateView>`
            <vscode-button
              @click=${(x) => x.ConsolidateAll()}
              ?disabled=${(x) => x.isConsolidating}
            >
              Consolidate All
            </vscode-button>
          `
        )}
      </div>
    </div>

    ${when(
      (x) => x.isLoading,
      html<ConsolidateView>`
        <div class="loading">
          <vscode-progress-ring class="loader"></vscode-progress-ring>
          <span>Checking for inconsistencies...</span>
        </div>
      `
    )}

    ${when(
      (x) => !x.isLoading && x.packages.length === 0 && !x.hasError,
      html<ConsolidateView>`
        <div class="empty">
          <span class="codicon codicon-check"></span>
          All package versions are consistent
        </div>
      `
    )}

    ${when(
      (x) => x.hasError,
      html<ConsolidateView>`
        <div class="error">
          <span class="codicon codicon-error"></span>
          Failed to check for inconsistencies
        </div>
      `
    )}

    ${when(
      (x) => !x.isLoading && x.packages.length > 0,
      html<ConsolidateView>`
        <div class="package-list">
          ${repeat(
            (x) => x.packages,
            html<InconsistentPackageViewModel>`
              <div class="inconsistent-row ${(x) => (x.IsConsolidating ? 'consolidating' : '')}">
                <div class="row-header">
                  <span class="package-name">${(x) => x.Id}</span>
                  ${when(
                    (x) => x.CpmManaged,
                    html<InconsistentPackageViewModel>`
                      <span class="cpm-badge">CPM Override</span>
                    `
                  )}
                  <div class="row-actions">
                    ${when(
                      (x) => x.IsConsolidating,
                      html<InconsistentPackageViewModel>`<vscode-progress-ring class="row-loader"></vscode-progress-ring>`,
                      html<InconsistentPackageViewModel>`
                        <vscode-dropdown
                          class="version-dropdown"
                          :value=${(x) => x.TargetVersion}
                          @change=${(x, c) => {
                            x.TargetVersion = (c.event.target as HTMLInputElement).value;
                          }}
                        >
                          ${repeat(
                            (x) => x.Versions.map((v) => v.Version),
                            html<string>`<vscode-option>${(x) => x}</vscode-option>`
                          )}
                        </vscode-dropdown>
                        <vscode-button
                          appearance="icon"
                          @click=${(x, c) => (c.parent as ConsolidateView).ConsolidateSingle(x)}
                        >
                          <span class="codicon codicon-arrow-circle-up"></span>
                        </vscode-button>
                      `
                    )}
                  </div>
                </div>
                <div class="version-details">
                  ${repeat(
                    (x) => x.Versions,
                    html<{ Version: string; Projects: Array<{ Name: string; Path: string }> }>`
                      <div class="version-row">
                        <span class="version">${(x) => x.Version}</span>
                        <span class="projects">${(x) => x.Projects.map((p) => p.Name).join(", ")}</span>
                      </div>
                    `
                  )}
                </div>
              </div>
            `
          )}
        </div>
      `
    )}
  </div>
`;

const styles = css`
  .consolidate-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;

    .toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px;
      margin-bottom: 6px;

      .status-text {
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
        flex: 1;
      }

      .toolbar-right {
        display: flex;
        align-items: center;
        gap: 8px;
      }
    }

    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      margin-top: 32px;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
    }

    .empty {
      display: flex;
      gap: 6px;
      justify-content: center;
      margin-top: 32px;
      color: var(--vscode-descriptionForeground);
    }

    .error {
      display: flex;
      gap: 4px;
      justify-content: center;
      margin-top: 32px;
      color: var(--vscode-errorForeground);
    }

    .package-list {
      overflow-y: auto;
      flex: 1;
    }

    .inconsistent-row {
      padding: 6px;
      border-bottom: 1px solid var(--vscode-panelSection-border);

      &.consolidating {
        opacity: 0.6;
      }

      .row-header {
        display: flex;
        align-items: center;
        gap: 8px;

        .package-name {
          font-weight: bold;
          font-size: 13px;
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .cpm-badge {
          font-size: 10px;
          padding: 1px 4px;
          border-radius: 3px;
          background-color: var(--vscode-badge-background);
          color: var(--vscode-badge-foreground);
        }

        .row-actions {
          display: flex;
          align-items: center;
          gap: 4px;

          .version-dropdown {
            min-width: 100px;
          }

          .row-loader {
            height: 16px;
            width: 16px;
          }
        }
      }

      .version-details {
        margin-top: 4px;
        padding-left: 4px;

        .version-row {
          display: flex;
          gap: 8px;
          font-size: 11px;
          padding: 2px 0;

          .version {
            min-width: 60px;
            color: var(--vscode-charts-yellow);
            font-family: var(--vscode-editor-font-family);
          }

          .projects {
            color: var(--vscode-descriptionForeground);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
        }
      }
    }
  }
`;

@customElement({
  name: "consolidate-view",
  template,
  styles: [codicon, scrollableBase, styles],
})
export class ConsolidateView extends FASTElement {
  @IMediator mediator!: IMediator;
  @observable packages: Array<InconsistentPackageViewModel> = [];
  @observable isLoading: boolean = false;
  @observable isConsolidating: boolean = false;
  @observable hasError: boolean = false;
  @observable statusText: string = "";
  @observable projectPaths: string[] = [];

  async LoadInconsistentPackages() {
    this.isLoading = true;
    this.hasError = false;
    this.packages = [];

    try {
      const result = await this.mediator.PublishAsync<
        GetInconsistentPackagesRequest,
        GetInconsistentPackagesResponse
      >(GET_INCONSISTENT_PACKAGES, {
        ProjectPaths: this.projectPaths.length > 0 ? this.projectPaths : undefined,
      });

      if (result.IsFailure) {
        this.hasError = true;
        this.statusText = "Failed to check";
      } else {
        this.packages = (result.Packages ?? []).map(
          (p) => new InconsistentPackageViewModel(p)
        );
        this.statusText =
          this.packages.length > 0
            ? `${this.packages.length} package${this.packages.length !== 1 ? "s" : ""} with inconsistent versions`
            : "";
      }
    } catch {
      this.hasError = true;
    } finally {
      this.isLoading = false;
    }
  }

  async ConsolidateSingle(pkg: InconsistentPackageViewModel) {
    pkg.IsConsolidating = true;
    try {
      const allProjects = pkg.Versions.flatMap((v) =>
        v.Projects.map((p) => p.Path)
      );

      await this.mediator.PublishAsync<ConsolidateRequest, ConsolidateResponse>(
        CONSOLIDATE_PACKAGES,
        {
          PackageId: pkg.Id,
          TargetVersion: pkg.TargetVersion,
          ProjectPaths: allProjects,
        }
      );

      this.packages = this.packages.filter((p) => p.Id !== pkg.Id);
      this.statusText =
        this.packages.length > 0
          ? `${this.packages.length} package${this.packages.length !== 1 ? "s" : ""} with inconsistent versions`
          : "All versions are consistent";
    } finally {
      pkg.IsConsolidating = false;
    }
  }

  async ConsolidateAll() {
    this.isConsolidating = true;
    try {
      for (const pkg of this.packages) {
        await this.ConsolidateSingle(pkg);
      }
    } finally {
      this.isConsolidating = false;
      await this.LoadInconsistentPackages();
    }
  }

}
