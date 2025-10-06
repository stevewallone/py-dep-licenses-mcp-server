# Python Dependencies Licenses MCP Server

A powerful Model Context Protocol (MCP) server that provides comprehensive Python dependency analysis with commercial licensing insights.

[![CI](https://github.com/stevewallone/py-dep-licenses-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/stevewallone/py-dep-licenses-mcp-server/actions)
[![Release](https://img.shields.io/github/v/release/stevewallone/py-dep-licenses-mcp-server)](https://github.com/stevewallone/py-dep-licenses-mcp-server/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
  - [From Source](#from-source)
  - [From npm (when published)](#from-npm-when-published)
- [Running the Server](#running-the-server)
  - [Option 1: Using npm scripts](#option-1-using-npm-scripts)
  - [Option 2: Using startup scripts](#option-2-using-startup-scripts)
  - [Option 3: Direct execution](#option-3-direct-execution)
- [Usage](#usage)
  - [Dependency Analysis Tool](#dependency-analysis-tool)
- [Available Tools](#available-tools)
  - [`list_dependencies`](#list_dependencies)
- [Troubleshooting](#troubleshooting)
  - [Server won't start](#server-wont-start)
  - [Permission issues (macOS/Linux)](#permission-issues-macoslinux)
- [Testing](#testing)
  - [Testing the List Dependencies Tool](#testing-the-list-dependencies-tool)
- [Development](#development)
  - [Key Implementation Details](#key-implementation-details)
- [License](#license)
- [Contributing](#contributing)
- [Issues](#issues)
- [Acknowledgments](#acknowledgments)

## Overview

This MCP server helps developers and businesses understand the licensing implications of Python dependencies in their projects. It analyzes GitHub repositories, fetches license information from PyPI, and provides clear insights into which packages are free for commercial use and which may require payment.

## Features

- **Advanced Python Dependencies Tool**: Analyzes GitHub Python repositories and provides comprehensive dependency analysis
- **Commercial Licensing Analysis**: Identifies which dependencies require payment for commercial use
- **Multiple File Format Support**: Supports requirements.txt, pyproject.toml, setup.py, environment.yml, Pipfile, uv.lock, poetry.lock, and Pipfile.lock
- **License Information**: Fetches license details from PyPI for each dependency
- **Business Intelligence**: Categorizes licenses by commercial use implications
- **MCP Compliant**: Built using the official MCP SDK
- **Cross-Platform**: Works on Windows, macOS, and Linux
- **Easy Setup**: Simple installation and startup process

## Prerequisites

- **Node.js 18+**: Download from [nodejs.org](https://nodejs.org/)
- **npm**: Usually comes with Node.js

## Installation

### From Source
1. **Clone the repository**:
   ```bash
   git clone https://github.com/stevewallone/py-dep-licenses-mcp-server.git
   cd py-dep-licenses-mcp-server
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

### From npm (when published)
```bash
npm install -g py-dep-licenses-mcp-server
```

## Running the Server

### Option 1: Using npm scripts
```bash
npm start
```

### Option 2: Using startup scripts
- **On macOS/Linux**: `./start-server.sh`
- **On Windows**: `start-server.bat`

### Option 3: Direct execution
```bash
node server.js
```

## Usage

### Dependency Analysis Tool
```
Use the list_dependencies tool with github_url "https://github.com/user/repo"
```
The server will provide comprehensive dependency analysis with commercial licensing insights.

## Available Tools

### `list_dependencies`
Comprehensive Python dependency analysis tool that lists dependencies from GitHub repositories with commercial licensing insights.

**Parameters:**
- `github_url` (string, required): The GitHub URL of the Python repository (e.g., https://github.com/user/repo)

**Supported File Formats (in priority order):**
- `requirements.txt` - Standard pip requirements
- `pyproject.toml` - Modern Python packaging (PEP 621, Poetry, setuptools)
- `uv.lock` - UV package manager lock file
- `poetry.lock` - Poetry package manager lock file
- `Pipfile.lock` - Pipenv lock file
- `setup.py` - Legacy setuptools configuration
- `environment.yml` - Conda environment file
- `Pipfile` - Pipenv configuration

**Features:**
- **License Detection**: Automatically fetches license information from PyPI
- **Commercial Use Analysis**: Categorizes licenses by commercial use implications
- **Cost Assessment**: Identifies packages requiring payment for commercial use
- **Business Intelligence**: Provides licensing summary and recommendations

**Example:**
```json
{
  "name": "list_dependencies",
  "arguments": {
    "github_url": "https://github.com/stevewallone/temporal-ai-agent"
  }
}
```

**Response:**

**Dependencies for stevewallone/temporal-ai-agent** (from pyproject.toml):

## FREE for Commercial Use (14)

1. **litellm** (MIT) - Free for commercial use
2. **pyyaml** (MIT) - Free for commercial use
3. **fastapi** (OSI Approved) - Free for commercial use (OSI Approved)
4. **uvicorn** (OSI Approved) - Free for commercial use (OSI Approved)
5. **python-dotenv** (BSD-3-Clause) - Free for commercial use
6. **requests** (Apache-2.0) - Free for commercial use
7. **pandas** (MIT) - Free for commercial use
8. **stripe** (OSI Approved) - Free for commercial use (OSI Approved)
9. **fastmcp** (OSI Approved) - Free for commercial use (OSI Approved)
10. **pytest** (MIT) - Free for commercial use
11. **black** (OSI Approved) - Free for commercial use (OSI Approved)
12. **isort** (OSI Approved) - Free for commercial use (OSI Approved)
13. **mypy** (MIT) - Free for commercial use
14. **poethepoet** (MIT) - Free for commercial use

## PAYMENT REQUIRED for Commercial Use (1)

1. **sourcery** (Proprietary) - Proprietary license - Payment required

## UNKNOWN Commercial Use Status (3)

1. **temporalio** (License unknown) - License information unavailable
2. **gtfs-kit** (License unknown) - License information unavailable
3. **pytest-asyncio** (License unknown) - License information unavailable

## Commercial Use Summary
- Free for commercial use: **14** packages
- Check commercial restrictions: **0** packages
- Payment required: **1** packages
- Unknown status: **3** packages

**IMPORTANT**: 1 package(s) may require payment for commercial use. Review licensing terms carefully!


**License Categories:**
- **FREE**: MIT, Apache-2.0, BSD-3-Clause, OSI Approved licenses
- **WARNING**: GPL, AGPL, and other copyleft licenses requiring careful review
- **PAID**: Proprietary licenses requiring commercial payment
- **UNKNOWN**: Packages where license information is unavailable

## Troubleshooting

### Server won't start
- Ensure Node.js 18+ is installed: `node --version`
- Check if dependencies are installed: `npm list`
- Try reinstalling dependencies: `npm install`


### Permission issues (macOS/Linux)
- Make the startup script executable: `chmod +x start-server.sh`

## Testing

You can test the server manually using MCP client tools or by running it and sending MCP protocol messages via stdin/stdout.

### Testing the List Dependencies Tool
```bash
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "list_dependencies", "arguments": {"github_url": "https://github.com/stevewallone/temporal-ai-agent"}}}' | node server.js
```

## Development

To modify the server:

1. **Edit** `server.js` to add new tools or modify existing ones
2. **Restart** the server (stop with Ctrl+C and run `npm start` again)
3. **Restart Cursor** to pick up the changes
4. **Test** your changes in Cursor

### Key Implementation Details

The `list_dependencies` tool includes:
- **File Detection**: Searches for dependency files in priority order
- **Parsing Logic**: Handles multiple file formats with specific parsers
- **License Fetching**: Batch requests to PyPI API with rate limiting
- **Commercial Analysis**: Categorizes licenses based on commercial use implications
- **Error Handling**: Graceful fallbacks for missing files or API failures



## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Issues

If you encounter any issues or have suggestions, please [open an issue](https://github.com/stevewallone/py-dep-licenses-mcp-server/issues) on GitHub.

## Acknowledgments

- Built with the [Model Context Protocol SDK](https://github.com/modelcontextprotocol/sdk)
- License information fetched from [PyPI](https://pypi.org/)
- Inspired by the need for better dependency management in Python projects

---

**Happy coding!**

