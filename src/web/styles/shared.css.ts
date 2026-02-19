import { css } from "lit";

export const sharedStyles = css`
  /* --- Spinner --- */
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .spinner {
    display: inline-block;
    border: 2px solid var(--vscode-progressBar-background);
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  .spinner.small {
    width: 12px;
    height: 12px;
  }
  .spinner.medium {
    width: 16px;
    height: 16px;
  }
  .spinner.large {
    width: 20px;
    height: 20px;
  }

  /* --- Icon button --- */
  button.icon-btn {
    background: transparent;
    border: none;
    color: var(--vscode-icon-foreground);
    cursor: pointer;
    padding: 2px;
    display: flex;
    align-items: center;
  }

  /* --- Primary button --- */
  button.primary-btn {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    padding: 4px 12px;
    cursor: pointer;
  }

  button.primary-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }

  /* --- Select / Dropdown --- */
  select {
    appearance: none;
    -webkit-appearance: none;
    background-color: var(--vscode-dropdown-background);
    color: var(--vscode-dropdown-foreground);
    border: 1px solid var(--vscode-dropdown-border);
    padding: 4px 24px 4px 8px;
    font-size: inherit;
    font-family: inherit;
    border-radius: 2px;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath d='M1 3 L5 7 L9 3' stroke='%23808080' stroke-width='1.5' fill='none'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 6px center;
    cursor: pointer;
    outline: none;
  }
  select:focus {
    border-color: var(--vscode-focusBorder);
  }

  /* --- Toolbar --- */
  .toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px;
    margin-bottom: 6px;
  }
  .toolbar .status-text {
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    flex: 1;
  }
  .toolbar .toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* --- State views --- */
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

  /* --- Package list container --- */
  .package-list {
    overflow-y: auto;
    flex: 1;
  }
`;
