const vscode = require("vscode");
const fs = require("fs");
const path = require("path");

function getConfig(key) {
  return vscode.workspace.getConfiguration("commitMessageHelper").get(key);
}

function loadPromptTemplate() {
  const defaultTemplate =
    "Please suggest best commit message for the following changes:\n\n{{diff}}\n\nProvide only the commit message, without any additional text or formatting.";

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
