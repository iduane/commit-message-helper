const { execSync } = require("child_process");
const path = require("path");

function normalizeMessage(line) {
  return line
    .trim()
    .replace(/^(\d+\.|-|\*)\s+/, "")
    .replace(/^[`"']/, "")
    .replace(/[`"']$/, "")
    .replace(/[`"']:/, ":")
    .replace(/:[`"']/, ":")
    .replace(/\\n/g, "")
    .trim();
}

function escapeCommitMessage(message) {
  return message.replace(/'/gm, `''`);
}

function detectVCS(workspacePath) {
  try {
    execSync("git status", { cwd: workspacePath, stdio: "ignore" });
    return "git";
  } catch (e) {
    try {
      execSync("svn status", { cwd: workspacePath, stdio: "ignore" });
      return "svn";
    } catch (e) {
      return null;
    }
  }
}

module.exports = {
  normalizeMessage,
  escapeCommitMessage,
  detectVCS,
};
