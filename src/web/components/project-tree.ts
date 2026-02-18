import {
  FASTElement,
  customElement,
  html,
  css,
  repeat,
  observable,
} from "@microsoft/fast-element";

import codicon from "@/web/styles/codicon.css";
import { scrollableBase } from "@/web/styles/base.css";
import { ProjectViewModel } from "../types";

const template = html<ProjectTree>`
  <div class="tree-container">
    <div class="tree-header">
      <input type="checkbox"
        :checked="${(x) => x.allChecked}"
        @change=${(x, c) =>
          x.OnSelectAllChanged((c.event.target as HTMLInputElement).checked)}
      />
      <span class="header-label">All Projects</span>
    </div>
    <div class="tree-list">
      ${repeat(
        (x) => x.projects,
        html<ProjectViewModel, ProjectTree>`
          <div class="tree-item">
            <input type="checkbox"
              :checked="${(x, c) =>
                c.parent.selectedPaths.includes(x.Path)}"
              @change=${(x, c) =>
                c.parent.OnItemChanged(
                  x.Path,
                  (c.event.target as HTMLInputElement).checked
                )}
            />
            <span class="codicon codicon-file-code"></span>
            <span class="item-label" title="${(x) => x.Path}">${(x) => x.Name}</span>
          </div>
        `
      )}
    </div>
  </div>
`;

const styles = css`
  .tree-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    font-size: 12px;

    .tree-header {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 6px;
      border-bottom: 1px solid var(--vscode-panelSection-border);
      font-weight: bold;

      .header-label {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }

    .tree-list {
      overflow-y: auto;
      flex: 1;
    }

    .tree-item {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 2px 6px 2px 12px;
      cursor: default;

      &:hover {
        background-color: var(--vscode-list-hoverBackground);
      }

      .codicon {
        font-size: 14px;
        color: var(--vscode-descriptionForeground);
        flex-shrink: 0;
      }

      .item-label {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: 11px;
      }
    }
  }
`;

@customElement({
  name: "project-tree",
  template,
  styles: [codicon, scrollableBase, styles],
})
export class ProjectTree extends FASTElement {
  @observable projects: Array<ProjectViewModel> = [];
  @observable selectedPaths: Array<string> = [];
  @observable allChecked: boolean = true;
  @observable isIndeterminate: boolean = false;

  projectsChanged(): void {
    // When projects change, select all by default
    this.selectedPaths = this.projects.map((p) => p.Path);
    this.syncCheckboxState();
    // Don't emit here - LoadProjects handles LoadProjectsPackages directly
  }

  selectedPathsChanged(): void {
    this.syncCheckboxState();
  }

  private syncCheckboxState(): void {
    const total = this.projects.length;
    const selected = this.selectedPaths.length;
    this.allChecked = total > 0 && selected === total;
    this.isIndeterminate = selected > 0 && selected < total;
  }

  OnSelectAllChanged(_checked: boolean): void {
    // When indeterminate or unchecked: select all. When all selected: deselect all.
    if (this.allChecked) {
      this.selectedPaths = [];
    } else {
      this.selectedPaths = this.projects.map((p) => p.Path);
    }
    this.EmitSelectionChanged();
  }

  OnItemChanged(path: string, checked: boolean): void {
    if (checked) {
      this.selectedPaths = [...this.selectedPaths, path];
    } else {
      this.selectedPaths = this.selectedPaths.filter((p) => p !== path);
    }
    this.EmitSelectionChanged();
  }

  private EmitSelectionChanged(): void {
    this.$emit("selection-changed", this.selectedPaths);
  }
}
