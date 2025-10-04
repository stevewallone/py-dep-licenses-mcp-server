import { jest } from '@jest/globals';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

// Import the server class
import { PyDepLicensesMCPServer } from '../server.js';

describe('PyDepLicensesMCPServer - MCP Protocol Tests', () => {
  let server;
  let mock;

  beforeEach(() => {
    server = new PyDepLicensesMCPServer();
    mock = new MockAdapter(axios);
  });

  afterEach(() => {
    mock.restore();
  });

  describe('Server Initialization', () => {
    test('should initialize with correct server configuration', () => {
      expect(server.server).toBeDefined();
      expect(server.server.name).toBe('py-dep-licenses-mcp-server');
      expect(server.server.version).toBe('1.0.0');
    });

    test('should have tools capability enabled', () => {
      expect(server.server.capabilities.tools).toBeDefined();
    });
  });

  describe('List Tools Request Handler', () => {
    test('should return correct tool definition', async () => {
      const request = {
        method: 'tools/list',
        params: {}
      };

      const handler = server.server.requestHandlers.get('tools/list');
      expect(handler).toBeDefined();

      const response = await handler(request);
      
      expect(response).toEqual({
        tools: [
          {
            name: 'list_dependencies',
            description: 'Lists Python dependencies with license information and commercial use analysis from a GitHub repository',
            inputSchema: {
              type: 'object',
              properties: {
                github_url: {
                  type: 'string',
                  description: 'The GitHub URL of the Python repository (e.g., https://github.com/user/repo)',
                },
              },
              required: ['github_url'],
            },
          },
        ],
      });
    });
  });

  describe('Call Tool Request Handler', () => {
    test('should handle list_dependencies tool call', async () => {
      const githubUrl = 'https://github.com/user/repo';
      const requirementsContent = 'requests>=2.28.0';

      // Mock GitHub API response
      mock.onGet('https://raw.githubusercontent.com/user/repo/main/requirements.txt')
        .reply(200, requirementsContent);

      // Mock PyPI API response
      mock.onGet('https://pypi.org/pypi/requests/json').reply(200, {
        info: { name: 'requests', license: 'MIT' }
      });

      const request = {
        method: 'tools/call',
        params: {
          name: 'list_dependencies',
          arguments: {
            github_url: githubUrl
          }
        }
      };

      const handler = server.server.requestHandlers.get('tools/call');
      expect(handler).toBeDefined();

      const response = await handler(request);

      expect(response).toEqual({
        content: [
          {
            type: 'text',
            text: expect.stringContaining('📦 **Dependencies for user/repo** (from requirements.txt)')
          }
        ]
      });
    });

    test('should validate required parameters', async () => {
      const request = {
        method: 'tools/call',
        params: {
          name: 'list_dependencies',
          arguments: {}
        }
      };

      const handler = server.server.requestHandlers.get('tools/call');
      
      await expect(handler(request))
        .rejects.toThrow('GitHub URL is required and must be a string');
    });

    test('should validate parameter types', async () => {
      const request = {
        method: 'tools/call',
        params: {
          name: 'list_dependencies',
          arguments: {
            github_url: 123
          }
        }
      };

      const handler = server.server.requestHandlers.get('tools/call');
      
      await expect(handler(request))
        .rejects.toThrow('GitHub URL is required and must be a string');
    });

    test('should handle unknown tool names', async () => {
      const request = {
        method: 'tools/call',
        params: {
          name: 'unknown_tool',
          arguments: {}
        }
      };

      const handler = server.server.requestHandlers.get('tools/call');
      
      await expect(handler(request))
        .rejects.toThrow('Unknown tool: unknown_tool');
    });

    test('should handle tool execution errors', async () => {
      const request = {
        method: 'tools/call',
        params: {
          name: 'list_dependencies',
          arguments: {
            github_url: 'https://github.com/user/repo'
          }
        }
      };

      // Mock network error
      mock.onGet('https://raw.githubusercontent.com/user/repo/main/requirements.txt')
        .networkError();

      const handler = server.server.requestHandlers.get('tools/call');
      
      await expect(handler(request))
        .rejects.toThrow('Failed to get dependencies');
    });

    test('should handle missing arguments parameter', async () => {
      const request = {
        method: 'tools/call',
        params: {
          name: 'list_dependencies'
        }
      };

      const handler = server.server.requestHandlers.get('tools/call');
      
      await expect(handler(request))
        .rejects.toThrow('GitHub URL is required and must be a string');
    });
  });

  describe('Error Handling', () => {
    test('should have error handler configured', () => {
      expect(server.server.onerror).toBeDefined();
    });

    test('should handle server errors', () => {
      const error = new Error('Test error');
      
      // Mock console.error to verify error handling
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      server.server.onerror(error);
      
      expect(consoleSpy).toHaveBeenCalledWith('[MCP Error]', error);
      
      consoleSpy.mockRestore();
    });
  });

  describe('Process Signal Handling', () => {
    test('should handle SIGINT signal', async () => {
      const closeSpy = jest.spyOn(server.server, 'close').mockResolvedValue();
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation();

      // Simulate SIGINT signal
      process.emit('SIGINT');

      // Allow async operations to complete
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(closeSpy).toHaveBeenCalled();
      expect(exitSpy).toHaveBeenCalledWith(0);

      closeSpy.mockRestore();
      exitSpy.mockRestore();
    });
  });

  describe('Server Run Method', () => {
    test('should connect to stdio transport', async () => {
      const connectSpy = jest.spyOn(server.server, 'connect').mockResolvedValue();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await server.run();

      expect(connectSpy).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Py Dep Licenses MCP Server running on stdio');

      connectSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    test('should handle connection errors', async () => {
      const connectSpy = jest.spyOn(server.server, 'connect').mockRejectedValue(new Error('Connection failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(server.run()).rejects.toThrow('Connection failed');

      connectSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  describe('Tool Schema Validation', () => {
    test('should have correct input schema for list_dependencies', async () => {
      const request = {
        method: 'tools/list',
        params: {}
      };

      const handler = server.server.requestHandlers.get('tools/list');
      const response = await handler(request);
      
      const tool = response.tools[0];
      expect(tool.inputSchema).toEqual({
        type: 'object',
        properties: {
          github_url: {
            type: 'string',
            description: 'The GitHub URL of the Python repository (e.g., https://github.com/user/repo)',
          },
        },
        required: ['github_url'],
      });
    });

    test('should validate against schema correctly', async () => {
      // Test valid request
      const validRequest = {
        method: 'tools/call',
        params: {
          name: 'list_dependencies',
          arguments: {
            github_url: 'https://github.com/user/repo'
          }
        }
      };

      // Test invalid request (missing required field)
      const invalidRequest = {
        method: 'tools/call',
        params: {
          name: 'list_dependencies',
          arguments: {
            // Missing github_url
          }
        }
      };

      const handler = server.server.requestHandlers.get('tools/call');

      // Valid request should not throw
      mock.onGet('https://raw.githubusercontent.com/user/repo/main/requirements.txt')
        .reply(200, 'requests>=2.28.0');
      mock.onGet('https://pypi.org/pypi/requests/json').reply(200, {
        info: { name: 'requests', license: 'MIT' }
      });

      await expect(handler(validRequest)).resolves.toBeDefined();

      // Invalid request should throw
      await expect(handler(invalidRequest))
        .rejects.toThrow('GitHub URL is required and must be a string');
    });
  });

  describe('Request Handler Registration', () => {
    test('should have all required request handlers registered', () => {
      const expectedHandlers = [
        'tools/list',
        'tools/call'
      ];

      expectedHandlers.forEach(handlerName => {
        expect(server.server.requestHandlers.has(handlerName)).toBe(true);
      });
    });

    test('should have correct handler types', () => {
      const listHandler = server.server.requestHandlers.get('tools/list');
      const callHandler = server.server.requestHandlers.get('tools/call');

      expect(typeof listHandler).toBe('function');
      expect(typeof callHandler).toBe('function');
    });
  });
});
