# Commit Message Helper

Commit Message Helper is a Visual Studio Code extension that generates commit messages using ChatGPT.

## Features

- Generates commit messages using OpenAI's GPT models
- Customizable API settings
- Keyboard shortcut for quick access

## Installation

1. Open Visual Studio Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "Commit Message Helper"
4. Click Install

## Usage

1. Open a project in VS Code
2. Make changes to your files
3. Use the keyboard shortcut Ctrl+Alt+C (Cmd+Alt+C on Mac) or run the "Generate Commit Message" command from the command palette
4. The extension will generate a commit message based on your changes

## Configuration

You can configure the extension in your VS Code settings:

- `commitMessageHelper.apiKey`: Your OpenAI API key
- `commitMessageHelper.customPromptTemplatePath`: Path to a custom prompt template file
- `commitMessageHelper.baseUrl`: Base URL for OpenAI API
- `commitMessageHelper.model`: OpenAI model to use for generating commit messages

## Development

To set up the project for development:

1. Clone the repository
2. Run `npm install` to install dependencies
3. Open the project in VS Code
4. Press F5 to run the extension in a new Extension Development Host window

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

iduane

## Repository

[https://github.com/iduane/commit-message-helper](https://github.com/iduane/commit-message-helper)
