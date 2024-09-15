const vscode = require("vscode");
const https = require("https");
const { getOpenAIConfig } = require("./config_storage");

class ChatGPTClient {
  constructor() {
    const config = getOpenAIConfig();
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl;
    this.model = config.model;

    if (!this.apiKey) {
      throw new Error(
        "API key not found. Please set it in the extension settings."
      );
    }
  }

  getAnswer(message) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        model: this.model,
        messages: [{ role: "user", content: message }],
        temperature: 0.7,
      });

      const baseUrl = new URL(this.baseUrl);
      const options = {
        hostname: baseUrl.hostname,
        port: 443,
        path: baseUrl.pathname + "/chat/completions",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
      };

      const req = https.request(options, (res) => {
        let responseData = "";

        res.on("data", (chunk) => {
          responseData += chunk;
        });

        res.on("end", () => {
          try {
            const jsonResponse = JSON.parse(responseData);
            if (jsonResponse.choices && jsonResponse.choices.length > 0) {
              resolve(jsonResponse.choices[0].message.content.trim());
            } else {
              reject(new Error("No response from ChatGPT"));
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on("error", (error) => {
        reject(error);
      });

      req.write(data);
      req.end();
    });
  }
}

module.exports = { ChatGPTClient };
