const vscode = require("vscode");
const fs = require("fs");
const path = require("path");

function getConfig(key) {
  return vscode.workspace.getConfiguration("commitMessageHelper").get(key);
}

function loadPromptTemplate() {
  let defaultTemplate = `As an AI assistant, analyze the following Git diff and generate a concise, informative commit message:

{{diff}}

Your commit message should be a brief summary (50 characters or less) and follow the format: <type>(optional scope): <subject-description>

The <type> should be one of the following:
  - feat: A new feature
  - fix: A bug fix
  - docs: Documentation changes
  - style: Code style changes (e.g., formatting, missing semi-colons, etc.)
  - refactor: A code change that neither fixes a bug nor adds a feature
  - test: Adding missing tests or correcting existing tests
  - chore: Changes to the build process or auxiliary tools and libraries such as documentation generation
`;

  const customTemplatePath = getConfig("customPromptTemplatePath");
  if (customTemplatePath) {
    try {
      const fullPath = path.resolve(customTemplatePath);
      return fs.readFileSync(fullPath, "utf8");
    } catch (error) {
      console.error(`Error reading custom prompt template: ${error.message}`);
      return defaultTemplate;
    }
  }

  return defaultTemplate;
}

function getOpenAIConfig() {
  return {
    apiKey: getConfig("apiKey"),
    baseUrl: getConfig("baseUrl") || "https://api.openai.com/v1",
    model: getConfig("model") || "gpt-4o-mini",
  };
}

module.exports = { getConfig, loadPromptTemplate, getOpenAIConfig };
