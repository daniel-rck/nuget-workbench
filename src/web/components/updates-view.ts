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
  GET_OUTDATED_PACKAGES,
  BATCH_UPDATE_PACKAGES,
} from "@/common/messaging/core/commands";
import { OutdatedPackageViewModel } from "../types";

const template = html<UpdatesView>`
  <div class="updates-container">
    <div class="toolbar">
      <vscode-button appearance="icon" @click=${(x) => x.LoadOutdatedPackages()}>
        <span class="codicon codicon-refresh"></span>
      </vscode-button>
      <span class="status-text">${(x) => x.statusText}</span>
      <div class="toolbar-right">
        ${when(
          (x) => x.packages.length > 0,
          html<UpdatesView>`
            <vscode-button
              @click=${(x) => x.UpdateAllSelected()}
              ?disabled=${(x) => x.isUpdating}
            >
              Update All
            </vscode-button>
          `
        )}
      </div>
    </div>

    ${when(
      (x) => x.isLoading,
      html<UpdatesView>`
        <div class="loading">
          <vscode-progress-ring class="loader"></vscode-progress-ring>
          <span>${(x) => x.loadingText}</span>
        </div>
      `
    )}

    ${when(
      (x) => !x.isLoading && x.packages.length === 0 && !x.hasError,
      html<UpdatesView>`
        <div class="empty">
          <span class="codicon codicon-check"></span>
          All packages are up to date
        </div>
      `
    )}

    ${when(
      (x) => x.hasError,
      html<UpdatesView>`
        <div class="error">
          <span class="codicon codicon-error"></span>
          Failed to check for updates
        </div>
      `
    )}

    ${when(
      (x) => !x.isLoading && x.packages.length > 0,
      html<UpdatesView>`
        <div class="package-list">
          ${repeat(
            (x) => x.packages,
            html<OutdatedPackageViewModel>`
              <div class="outdated-row ${(x) => (x.IsUpdating ? 'updating' : '')}">
                <div class="row-left">
                  <vscode-checkbox
                    :checked="${(x) => x.Selected}"
                    @change=${(x, c) => {
                      x.Selected = (c.event.target as HTMLInputElement).checked;
                    }}
                    ?disabled=${(x) => x.IsUpdating}
                  ></vscode-checkbox>
                  <div class="package-info">
                    <span class="package-name">${(x) => x.Id}</span>
                    <span class="version-info">
                      <span class="old-version">${(x) => x.InstalledVersion}</span>
                      <span class="codicon codicon-arrow-right"></span>
                      <span class="new-version">${(x) => x.LatestVersion}</span>
                    </span>
                    <span class="project-count">${(x) => x.Projects.length} project${(x) => x.Projects.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <div class="row-right">
                  ${when(
                    (x) => x.IsUpdating,
                    html<OutdatedPackageViewModel>`<vscode-progress-ring class="row-loader"></vscode-progress-ring>`,
                    html<OutdatedPackageViewModel>`
                      <vscode-button
                        appearance="icon"
                        @click=${(x, c) => (c.parent as UpdatesView).UpdateSingle(x)}
                      >
                        <span class="codicon codicon-arrow-circle-up"></span>
                      </vscode-button>
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
  .updates-container {
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

    .outdated-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 6px;
      gap: 8px;
      cursor: default;

      &:hover {
        background-color: var(--vscode-list-hoverBackground);
      }

      &.updating {
        opacity: 0.6;
      }

      .row-left {
        display: flex;
        align-items: center;
        gap: 8px;
        overflow: hidden;
        flex: 1;
      }

      .package-info {
        display: flex;
        flex-direction: column;
        overflow: hidden;

        .package-name {
          font-weight: bold;
          font-size: 13px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .version-info {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;

          .old-version {
            color: var(--vscode-descriptionForeground);
          }

          .codicon {
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
          }

          .new-version {
            color: var(--vscode-charts-green);
          }
        }

        .project-count {
          font-size: 11px;
          color: var(--vscode-descriptionForeground);
        }
      }

      .row-right {
        display: flex;
        align-items: center;

        .row-loader {
          height: 16px;
          width: 16px;
        }
      }
    }
  }
`;

@customElement({
  name: "updates-view",
  template,
  styles: [codicon, scrollableBase, styles],
})
export class UpdatesView extends FASTElement {
  @IMediator mediator!: IMediator;
  @observable packages: Array<OutdatedPackageViewModel> = [];
  @observable isLoading: boolean = false;
  @observable isUpdating: boolean = false;
  @observable hasError: boolean = false;
  @observable prerelease: boolean = false;
  @observable statusText: string = "";
  @observable loadingText: string = "Checking for updates...";
  @observable projectPaths: string[] = [];

  async LoadOutdatedPackages() {
    this.isLoading = true;
    this.hasError = false;
    this.packages = [];
    this.loadingText = "Checking for updates...";

    try {
      const result = await this.mediator.PublishAsync<
        GetOutdatedPackagesRequest,
        GetOutdatedPackagesResponse
      >(GET_OUTDATED_PACKAGES, {
        Prerelease: this.prerelease,
        ProjectPaths: this.projectPaths.length > 0 ? this.projectPaths : undefined,
      });

      if (result.IsFailure) {
        this.hasError = true;
        this.statusText = "Failed to check for updates";
      } else {
        this.packages = (result.Packages ?? []).map(
          (p) => new OutdatedPackageViewModel(p)
        );
        this.packages.forEach((p) => (p.Selected = true));
        this.statusText =
          this.packages.length > 0
            ? `${this.packages.length} update${this.packages.length !== 1 ? "s" : ""} available`
            : "";
      }
    } catch {
      this.hasError = true;
    } finally {
      this.isLoading = false;
    }
  }

  async UpdateSingle(pkg: OutdatedPackageViewModel) {
    pkg.IsUpdating = true;
    try {
      await this.mediator.PublishAsync<BatchUpdateRequest, BatchUpdateResponse>(
        BATCH_UPDATE_PACKAGES,
        {
          Updates: [
            {
              PackageId: pkg.Id,
              Version: pkg.LatestVersion,
              ProjectPaths: pkg.Projects.map((p) => p.Path),
            },
          ],
        }
      );
      // Remove from list on success
      this.packages = this.packages.filter((p) => p.Id !== pkg.Id);
      this.statusText =
        this.packages.length > 0
          ? `${this.packages.length} update${this.packages.length !== 1 ? "s" : ""} available`
          : "All packages are up to date";
    } finally {
      pkg.IsUpdating = false;
    }
  }

  async UpdateAllSelected() {
    const selected = this.packages.filter((p) => p.Selected);
    if (selected.length === 0) return;

    this.isUpdating = true;
    try {
      await this.mediator.PublishAsync<BatchUpdateRequest, BatchUpdateResponse>(
        BATCH_UPDATE_PACKAGES,
        {
          Updates: selected.map((p) => ({
            PackageId: p.Id,
            Version: p.LatestVersion,
            ProjectPaths: p.Projects.map((proj) => proj.Path),
          })),
        }
      );
      // Reload to see what's left
      await this.LoadOutdatedPackages();
    } finally {
      this.isUpdating = false;
    }
  }
}
