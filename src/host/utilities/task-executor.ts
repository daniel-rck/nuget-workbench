import { Mutex } from "async-mutex";
import * as vscode from "vscode";
import { Logger } from "../../common/logger";

export class TaskExecutor {
  private globalMutex: Mutex = new Mutex();

  async ExecuteTask(task: vscode.Task): Promise<void> {
    Logger.info(`TaskExecutor.ExecuteTask: Executing task ${task.name}`);

    // Log task details if available
    if (task.execution instanceof vscode.ShellExecution) {
      const shellExec = task.execution as vscode.ShellExecution;
      const args = typeof shellExec.args === 'string' ? shellExec.args : (shellExec.args || []).map(a => typeof a === 'string' ? a : a.value).join(' ');
      Logger.debug(`TaskExecutor.ExecuteTask: Shell command: ${shellExec.commandLine || shellExec.command} ${args}`);
    } else if (task.execution instanceof vscode.ProcessExecution) {
      const procExec = task.execution as vscode.ProcessExecution;
      Logger.debug(`TaskExecutor.ExecuteTask: Process: ${procExec.process} ${(procExec.args || []).join(' ')}`);
    }

    const releaser = await this.globalMutex.acquire();
    const mutex = new Mutex();
    mutex.acquire();
    const execution = await vscode.tasks.executeTask(task);
    const callback = vscode.tasks.onDidEndTask((x) => {
      if (x.execution.task == execution.task) {
        Logger.info(`TaskExecutor.ExecuteTask: Task ${task.name} completed`);
        mutex.release();
      }
    });
    await mutex.waitForUnlock();
    releaser();
    callback.dispose();
  }
}

export default new TaskExecutor();
