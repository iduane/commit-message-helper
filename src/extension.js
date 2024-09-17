const vscode = require("vscode");
const { execSync } = require("child_process");
const { ChatGPTClient } = require("./client.js");
const { getConfig, loadPromptTemplate } = require("./config_storage.js");
const {
  normalizeMessage,
  escapeCommitMessage,
  detectVCS,
} = require("./utils.js");
const path = require("path");
const { tmpdir } = require("os");
const { randomUUID } = require("crypto");

// Add this new function to check message length
async function checkMessageLength(message, maxTokens = 8000) {
  const tokenLimit = getConfig("tokenLimit") || maxTokens;

  const estimatedTokens = estimateTokens(message);

  if (estimatedTokens > tokenLimit) {
    const proceed = await vscode.window.showWarningMessage(
      `The generated message is estimated to be longer than ${tokenLimit} tokens (approximately ${estimatedTokens} tokens). This may result in a slower response or incomplete processing. Do you want to continue?`,
      "Yes",
      "No"
    );
    return proceed === "Yes";
  }
  return true;
}

// Add this helper function for token estimation
function estimateTokens(text) {
  // This is a simple approximation of GPT tokenization
  // It's not perfect, but it's closer than just using string length
  const words = text.split(/\s+/);
  let tokenCount = 0;
  for (const word of words) {
    tokenCount += Math.ceil(word.length / 4); // Approximate 4 characters per token
  }
  return tokenCount;
}

function activate(context) {
  console.log("Commit Message Helper is now active!");

  // Add status bar item with custom icon
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.text = "$(git-commit) Commit";
  statusBarItem.tooltip = "Generate Commit Message";
  statusBarItem.command = "extension.generateCommitMessageTerminal";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Initial check for active provider
  let activeProvider = vscode.scm.inputBox?.repository;
  if (activeProvider) {
    configureProvider(
      activeProvider,
      activeProvider.provider.label.toLowerCase()
    );
  } else {
    console.log(
      "No active source control provider found on activation. Waiting for SCM to initialize..."
    );

    // Set up a listener for when an SCM provider becomes available
    const disposable = vscode.window.onDidChangeActiveTextEditor(() => {
      activeProvider = vscode.scm.inputBox?.repository;
      if (activeProvider) {
        configureProvider(
          activeProvider,
          activeProvider.provider.label.toLowerCase()
        );
        disposable.dispose(); // Remove the listener once we've configured a provider
      }
    });

    context.subscriptions.push(disposable);
  }

  const generateCommitMessageTerminalCommand = vscode.commands.registerCommand(
    "extension.generateCommitMessageTerminal",
    async () => {
      await generateCommitMessage({ useTerminal: true });
    }
  );

  const generateCommitMessageCommand = vscode.commands.registerCommand(
    "extension.generateCommitMessageSCM",
    async () => {
      await generateCommitMessage({ useTerminal: false });
    }
  );

  context.subscriptions.push(generateCommitMessageTerminalCommand);
  context.subscriptions.push(generateCommitMessageCommand);
}

// Update the configureProvider function
function configureProvider(repository, vcs) {
  const inputBox = vscode.scm.inputBox;
  if (inputBox) {
    inputBox.placeholder = "Message (press Ctrl+Enter to commit)";
  }
  repository.inputBox.placeholder = "Message (press Ctrl+Enter to commit)";
  repository.inputBox.acceptInputCommand = {
    command: `${vcs}.commit`,
    title: "Commit",
  };
  repository.statusBarCommands = [
    {
      command: "extension.generateCommitMessageSCM",
      title: "$(sparkle) Generate",
      tooltip: "Generate Commit Message",
    },
  ];
}

async function generateCommitMessage({ useTerminal = false }) {
  const diffResult = await getDiff();
  const { diff, vcs } = diffResult || {};

  if (!diffResult || !diff) {
    vscode.window.showInformationMessage("No changes to commit.");
    return;
  }

  const api = new ChatGPTClient();
  const promptTemplate = loadPromptTemplate();
  const userMessage = promptTemplate.replace(
    "{{diff}}",
    ["```", diff, "```"].join("\n")
  );

  try {
    // Show progress bar
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Generating commit message...",
        cancellable: false,
      },
      async (progress) => {
        progress.report({ increment: 0 });

        // Check message length before sending to API
        const shouldProceed = await checkMessageLength(userMessage);
        if (!shouldProceed) {
          vscode.window.showInformationMessage("Operation cancelled by user.");
          return;
        }

        const message = await getMessage(api, userMessage);
        progress.report({ increment: 100 });

        if (message.length > 0) {
          const vcs = await detectVCS(
            vscode.workspace.workspaceFolders[0].uri.fsPath
          );

          if (useTerminal || vcs === "svn") {
            const selectedMessageResult = await openTempFileWithMessage(
              message
            );
            if (selectedMessageResult && selectedMessageResult.result) {
              const terminal = vscode.window.createTerminal(
                vcs === "svn" ? "SVN Commit" : "Git Commit"
              );
              terminal.show();

              // Escape the message for use in a shell command
              const escapedMessage =
                selectedMessageResult.editedMessage.replace(/"/g, '\\"');

              // Use SVN command line to set the commit message
              terminal.sendText(
                vcs === "svn"
                  ? `svn commit -m"${escapedMessage}"`
                  : `git commit -m"${escapedMessage}"`,
                false
              );

              vscode.window.showInformationMessage(
                "SVN commit message set. Please review and commit manually in the terminal."
              );
            }
          } else if (vcs === "git") {
            const gitExtension = vscode.extensions.getExtension("vscode.git");
            if (!gitExtension) {
              vscode.window.showErrorMessage("Git extension not found.");
              return;
            }
            if (!gitExtension.isActive) {
              console.log("Activating git extension");
              await gitExtension.activate();
            }
            const gitApi = gitExtension.exports.getAPI(1);
            if (gitApi.repositories.length > 0) {
              const repository = gitApi.repositories[0];
              repository.inputBox.value = message;
            } else {
              vscode.window.showWarningMessage("No Git repositories found.");
            }
          } else {
            vscode.window.showWarningMessage(
              "Unsupported version control system."
            );
          }
        }
      }
    );
  } catch (error) {
    vscode.window.showErrorMessage(`Error: ${error.message}`);
  }
}

function getCommitCommand(vcs, message) {
  switch (vcs) {
    case "git":
      return `git commit -m "${escapeCommitMessage(message)}"`;
    case "svn":
      return `svn commit -m "${escapeCommitMessage(message)}"`;
    default:
      throw new Error(`Unsupported VCS: ${vcs}`);
  }
}

async function executeVCSCommit(vcs) {
  const terminal =
    vscode.window.activeTerminal ||
    vscode.window.createTerminal(vcs.toUpperCase());
  terminal.show();
  terminal.sendText(vcs === "git" ? "git commit" : "svn commit");
}

async function getDiff() {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  if (!workspaceRoot) {
    vscode.window.showErrorMessage("No workspace folder found.");
    return null;
  }

  const vcs = await detectVCS(workspaceRoot);
  if (!vcs) {
    vscode.window.showErrorMessage(
      "No supported version control system detected."
    );
    return null;
  }

  const diffCMD = vcs === "git" ? "git diff --cached" : "svn diff";

  try {
    return { diff: execSync(diffCMD, { cwd: workspaceRoot }).toString(), vcs };
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to run ${diffCMD}`);
    return null;
  }
}

// Update the getMessage function to accept a progress callback
async function getMessage(api, userMessage, progressCallback) {
  const response = await api.getAnswer(userMessage);
  if (progressCallback) {
    progressCallback({ increment: 50 });
  }
  const message = response
    .split("\n")
    .map(normalizeMessage)
    .filter((l) => l.length > 1)
    .join("\n");

  return message;
}

async function openTempFileWithMessage(message) {
  const uid = randomUUID();
  const tempMessageFile = path.join(
    tmpdir(),
    `vscode-aicommitmessage-${uid}.txt`
  );

  const explainingHeader = `# This is a generated commit message. You can edit it and save to approve it.#\n\n`;
  const tempFileContent = explainingHeader + message;

  await vscode.workspace.fs.writeFile(
    vscode.Uri.file(tempMessageFile),
    Buffer.from(tempFileContent, "utf8")
  );

  const document = await vscode.workspace.openTextDocument(tempMessageFile);
  await vscode.window.showTextDocument(document, { preview: false });

  let saveHandler, closeHandler;

  const result = await new Promise((resolve) => {
    saveHandler = vscode.workspace.onDidSaveTextDocument((doc) => {
      if (doc.fileName === tempMessageFile) {
        const editedText = doc.getText();
        const editedMessage = editedText.replace(/#.*#.*\n/g, "").trim();

        resolve({ result: true, edited: true, editedMessage });
      }
    });

    closeHandler = vscode.window.onDidChangeVisibleTextEditors((editors) => {
      if (
        editors.every((editor) => editor.document.fileName !== tempMessageFile)
      ) {
        resolve({ result: false, edited: false });
      }
    });
  });

  saveHandler?.dispose();
  closeHandler?.dispose();

  // Close the active tab
  await vscode.commands.executeCommand("workbench.action.closeActiveEditor");

  await vscode.workspace.fs.delete(vscode.Uri.file(tempMessageFile));

  return result;
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
