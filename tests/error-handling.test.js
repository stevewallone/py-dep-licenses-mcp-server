import { jest } from '@jest/globals';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

// Import the server class
import { PyDepLicensesMCPServer } from '../server.js';

describe('PyDepLicensesMCPServer - Error Handling', () => {
  let server;
  let mock;

  beforeEach(() => {
    server = new PyDepLicensesMCPServer();
    mock = new MockAdapter(axios);
  });

  afterEach(() => {
    mock.restore();
  });

  describe('GitHub URL Validation', () => {
    test('should reject invalid GitHub URLs', async () => {
      const invalidUrls = [
        'https://gitlab.com/user/repo',
        'https://bitbucket.org/user/repo',
        'https://github.com',
        'https://github.com/user',
        'not-a-url',
        'ftp://github.com/user/repo',
        'https://github.com/user/repo/path/to/file',
        'https://github.com/user/repo.git/path',
        ''
      ];

      for (const url of invalidUrls) {
        await expect(server.getPythonDependencies(url))
          .rejects.toThrow('Invalid GitHub URL format');
      }
    });

    test('should accept valid GitHub URLs', async () => {
      const validUrls = [
        'https://github.com/user/repo',
        'https://github.com/user/repo.git',
        'https://github.com/user-name/repo-name',
        'https://github.com/user123/repo123',
        'https://github.com/user/repo-name_with_underscores'
      ];

      // Mock successful responses for all valid URLs
      validUrls.forEach(url => {
        const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
        if (match) {
          const [, owner, repo] = match;
          const repoName = repo.replace(/\.git$/, '');
          mock.onGet(`https://raw.githubusercontent.com/${owner}/${repoName}/main/requirements.txt`)
            .reply(404);
          mock.onGet(`https://raw.githubusercontent.com/${owner}/${repoName}/master/requirements.txt`)
            .reply(404);
        }
      });

      for (const url of validUrls) {
        // Should not throw for valid URLs (will fail later due to no dependency files, but URL parsing should work)
        try {
          await server.getPythonDependencies(url);
        } catch (error) {
          // Should fail with "No dependency files found", not "Invalid GitHub URL format"
          expect(error.message).not.toContain('Invalid GitHub URL format');
        }
      }
    });
  });

  describe('Network Error Handling', () => {
    test('should handle GitHub API network errors', async () => {
      const githubUrl = 'https://github.com/user/repo';

      mock.onGet('https://raw.githubusercontent.com/user/repo/main/requirements.txt')
        .networkError();

      await expect(server.getPythonDependencies(githubUrl))
        .rejects.toThrow('Error fetching dependencies');
    });

    test('should handle GitHub API timeout errors', async () => {
      const githubUrl = 'https://github.com/user/repo';

      mock.onGet('https://raw.githubusercontent.com/user/repo/main/requirements.txt')
        .timeout();

      await expect(server.getPythonDependencies(githubUrl))
        .rejects.toThrow('Error fetching dependencies');
    });

    test('should handle PyPI API network errors', async () => {
      const githubUrl = 'https://github.com/user/repo';
      const requirementsContent = 'requests>=2.28.0';

      mock.onGet('https://raw.githubusercontent.com/user/repo/main/requirements.txt')
        .reply(200, requirementsContent);
      mock.onGet('https://pypi.org/pypi/requests/json')
        .networkError();

      const result = await server.getPythonDependencies(githubUrl);

      expect(result).toContain('📦 **Dependencies for user/repo** (from requirements.txt)');
      expect(result).toContain('## ❓ UNKNOWN Commercial Use Status (1)');
      expect(result).toContain('**requests** (License unknown)');
    });

    test('should handle PyPI API timeout errors', async () => {
      const githubUrl = 'https://github.com/user/repo';
      const requirementsContent = 'requests>=2.28.0';

      mock.onGet('https://raw.githubusercontent.com/user/repo/main/requirements.txt')
        .reply(200, requirementsContent);
      mock.onGet('https://pypi.org/pypi/requests/json')
        .timeout();

      const result = await server.getPythonDependencies(githubUrl);

      expect(result).toContain('📦 **Dependencies for user/repo** (from requirements.txt)');
      expect(result).toContain('## ❓ UNKNOWN Commercial Use Status (1)');
      expect(result).toContain('**requests** (License unknown)');
    });

    test('should handle HTTP 500 errors from GitHub', async () => {
      const githubUrl = 'https://github.com/user/repo';

      mock.onGet('https://raw.githubusercontent.com/user/repo/main/requirements.txt')
        .reply(500, 'Internal Server Error');

      await expect(server.getPythonDependencies(githubUrl))
        .rejects.toThrow('Error fetching dependencies');
    });

    test('should handle HTTP 403 errors from GitHub', async () => {
      const githubUrl = 'https://github.com/user/repo';

      mock.onGet('https://raw.githubusercontent.com/user/repo/main/requirements.txt')
        .reply(403, 'Forbidden');

      await expect(server.getPythonDependencies(githubUrl))
        .rejects.toThrow('Error fetching dependencies');
    });
  });

  describe('Parsing Error Handling', () => {
    test('should handle malformed requirements.txt', async () => {
      const githubUrl = 'https://github.com/user/repo';
      const malformedContent = 'requests>=2.28.0\ninvalid line with special chars \x00\x01';

      mock.onGet('https://raw.githubusercontent.com/user/repo/main/requirements.txt')
        .reply(200, malformedContent);

      const result = await server.getPythonDependencies(githubUrl);

      // Should still parse what it can
      expect(result).toContain('📦 **Dependencies for user/repo** (from requirements.txt)');
    });

    test('should handle malformed pyproject.toml', async () => {
      const githubUrl = 'https://github.com/user/repo';
      const malformedContent = `
        [project]
        dependencies = [
          "requests>=2.28.0",
          # Missing closing bracket
      `;

      mock.onGet('https://raw.githubusercontent.com/user/repo/main/requirements.txt')
        .reply(404);
      mock.onGet('https://raw.githubusercontent.com/user/repo/master/requirements.txt')
        .reply(404);
      mock.onGet('https://raw.githubusercontent.com/user/repo/main/pyproject.toml')
        .reply(200, malformedContent);

      const result = await server.getPythonDependencies(githubUrl);

      // Should handle parsing errors gracefully
      expect(result).toContain('📦 Found pyproject.toml in user/repo but no dependencies were parsed');
    });

    test('should handle malformed environment.yml', async () => {
      const githubUrl = 'https://github.com/user/repo';
      const malformedContent = `
        name: test-env
        dependencies:
          - python=3.9
          - requests>=2.28.0
        # Invalid YAML structure
        invalid: [unclosed
      `;

      mock.onGet('https://raw.githubusercontent.com/user/repo/main/requirements.txt')
        .reply(404);
      mock.onGet('https://raw.githubusercontent.com/user/repo/master/requirements.txt')
        .reply(404);
      mock.onGet('https://raw.githubusercontent.com/user/repo/main/pyproject.toml')
        .reply(404);
      mock.onGet('https://raw.githubusercontent.com/user/repo/master/pyproject.toml')
        .reply(404);
      mock.onGet('https://raw.githubusercontent.com/user/repo/main/uv.lock')
        .reply(404);
      mock.onGet('https://raw.githubusercontent.com/user/repo/master/uv.lock')
        .reply(404);
      mock.onGet('https://raw.githubusercontent.com/user/repo/main/poetry.lock')
        .reply(404);
      mock.onGet('https://raw.githubusercontent.com/user/repo/master/poetry.lock')
        .reply(404);
      mock.onGet('https://raw.githubusercontent.com/user/repo/main/Pipfile.lock')
        .reply(404);
      mock.onGet('https://raw.githubusercontent.com/user/repo/master/Pipfile.lock')
        .reply(404);
      mock.onGet('https://raw.githubusercontent.com/user/repo/main/setup.py')
        .reply(404);
      mock.onGet('https://raw.githubusercontent.com/user/repo/master/setup.py')
        .reply(404);
      mock.onGet('https://raw.githubusercontent.com/user/repo/main/environment.yml')
        .reply(200, malformedContent);

      const result = await server.getPythonDependencies(githubUrl);

      // Should handle YAML parsing errors gracefully
      expect(result).toContain('📦 Found environment.yml in user/repo but no dependencies were parsed');
    });

    test('should handle malformed Pipfile.lock JSON', async () => {
      const githubUrl = 'https://github.com/user/repo';
      const malformedContent = `
        {
          "default": {
            "requests": {
              "version": "==2.28.0"
            }
          }
          // Missing closing brace
      `;

      mock.onGet('https://raw.githubusercontent.com/user/repo/main/requirements.txt')
        .reply(404);
      mock.onGet('https://raw.githubusercontent.com/user/repo/master/requirements.txt')
        .reply(404);
      mock.onGet('https://raw.githubusercontent.com/user/repo/main/pyproject.toml')
        .reply(404);
      mock.onGet('https://raw.githubusercontent.com/user/repo/master/pyproject.toml')
        .reply(404);
      mock.onGet('https://raw.githubusercontent.com/user/repo/main/uv.lock')
        .reply(404);
      mock.onGet('https://raw.githubusercontent.com/user/repo/master/uv.lock')
        .reply(404);
      mock.onGet('https://raw.githubusercontent.com/user/repo/main/poetry.lock')
        .reply(404);
      mock.onGet('https://raw.githubusercontent.com/user/repo/master/poetry.lock')
        .reply(404);
      mock.onGet('https://raw.githubusercontent.com/user/repo/main/Pipfile.lock')
        .reply(200, malformedContent);

      const result = await server.getPythonDependencies(githubUrl);

      // Should handle JSON parsing errors gracefully
      expect(result).toContain('📦 Found Pipfile.lock in user/repo but no dependencies were parsed');
    });
  });

  describe('MCP Protocol Error Handling', () => {
    test('should handle missing tool name in call request', async () => {
      const request = {
        method: 'tools/call',
        params: {
          arguments: {
            github_url: 'https://github.com/user/repo'
          }
        }
      };

      const handler = server.server.requestHandlers.get('tools/call');
      
      await expect(handler(request))
        .rejects.toThrow('Unknown tool: undefined');
    });

    test('should handle null arguments in call request', async () => {
      const request = {
        method: 'tools/call',
        params: {
          name: 'list_dependencies',
          arguments: null
        }
      };

      const handler = server.server.requestHandlers.get('tools/call');
      
      await expect(handler(request))
        .rejects.toThrow('GitHub URL is required and must be a string');
    });

    test('should handle undefined arguments in call request', async () => {
      const request = {
        method: 'tools/call',
        params: {
          name: 'list_dependencies',
          arguments: undefined
        }
      };

      const handler = server.server.requestHandlers.get('tools/call');
      
      await expect(handler(request))
        .rejects.toThrow('GitHub URL is required and must be a string');
    });

    test('should handle non-string github_url', async () => {
      const request = {
        method: 'tools/call',
        params: {
          name: 'list_dependencies',
          arguments: {
            github_url: { url: 'https://github.com/user/repo' }
          }
        }
      };

      const handler = server.server.requestHandlers.get('tools/call');
      
      await expect(handler(request))
        .rejects.toThrow('GitHub URL is required and must be a string');
    });

    test('should handle empty string github_url', async () => {
      const request = {
        method: 'tools/call',
        params: {
          name: 'list_dependencies',
          arguments: {
            github_url: ''
          }
        }
      };

      const handler = server.server.requestHandlers.get('tools/call');
      
      await expect(handler(request))
        .rejects.toThrow('GitHub URL is required and must be a string');
    });
  });

  describe('Rate Limiting and Timeout Handling', () => {
    test('should handle PyPI rate limiting', async () => {
      const githubUrl = 'https://github.com/user/repo';
      const requirementsContent = 'requests\nnumpy\npandas';

      mock.onGet('https://raw.githubusercontent.com/user/repo/main/requirements.txt')
        .reply(200, requirementsContent);

      // Mock rate limiting responses
      mock.onGet('https://pypi.org/pypi/requests/json').reply(429, 'Rate limited');
      mock.onGet('https://pypi.org/pypi/numpy/json').reply(429, 'Rate limited');
      mock.onGet('https://pypi.org/pypi/pandas/json').reply(429, 'Rate limited');

      const result = await server.getPythonDependencies(githubUrl);

      expect(result).toContain('📦 **Dependencies for user/repo** (from requirements.txt)');
      expect(result).toContain('## ❓ UNKNOWN Commercial Use Status (3)');
    });

    test('should handle PyPI timeout with retry logic', async () => {
      const githubUrl = 'https://github.com/user/repo';
      const requirementsContent = 'requests';

      mock.onGet('https://raw.githubusercontent.com/user/repo/main/requirements.txt')
        .reply(200, requirementsContent);
      mock.onGet('https://pypi.org/pypi/requests/json')
        .reply(408, 'Request Timeout');

      const result = await server.getPythonDependencies(githubUrl);

      expect(result).toContain('📦 **Dependencies for user/repo** (from requirements.txt)');
      expect(result).toContain('## ❓ UNKNOWN Commercial Use Status (1)');
    });
  });

  describe('Edge Cases', () => {
    test('should handle very large dependency files', async () => {
      const githubUrl = 'https://github.com/user/repo';
      const largeRequirements = Array.from({ length: 1000 }, (_, i) => `package${i}>=1.0.0`).join('\n');

      mock.onGet('https://raw.githubusercontent.com/user/repo/main/requirements.txt')
        .reply(200, largeRequirements);

      // Mock PyPI responses for all packages
      for (let i = 0; i < 1000; i++) {
        mock.onGet(`https://pypi.org/pypi/package${i}/json`).reply(200, {
          info: { name: `package${i}`, license: 'MIT' }
        });
      }

      const result = await server.getPythonDependencies(githubUrl);

      expect(result).toContain('📦 **Dependencies for user/repo** (from requirements.txt)');
      expect(result).toContain('## ✅ FREE for Commercial Use (1000)');
    });

    test('should handle dependencies with special characters', async () => {
      const githubUrl = 'https://github.com/user/repo';
      const requirementsContent = 'requests>=2.28.0\nnumpy~=1.21.0\npandas\npackage-with-dashes\npackage_with_underscores\npackage.with.dots';

      mock.onGet('https://raw.githubusercontent.com/user/repo/main/requirements.txt')
        .reply(200, requirementsContent);

      // Mock PyPI responses
      const packages = ['requests', 'numpy', 'pandas', 'package-with-dashes', 'package_with_underscores', 'package.with.dots'];
      packages.forEach(pkg => {
        mock.onGet(`https://pypi.org/pypi/${pkg}/json`).reply(200, {
          info: { name: pkg, license: 'MIT' }
        });
      });

      const result = await server.getPythonDependencies(githubUrl);

      expect(result).toContain('📦 **Dependencies for user/repo** (from requirements.txt)');
      expect(result).toContain('## ✅ FREE for Commercial Use (6)');
    });

    test('should handle empty repository', async () => {
      const githubUrl = 'https://github.com/user/empty-repo';

      // Mock all dependency files as 404
      const dependencyFiles = [
        'requirements.txt', 'pyproject.toml', 'uv.lock', 'poetry.lock',
        'Pipfile.lock', 'setup.py', 'environment.yml', 'Pipfile'
      ];

      dependencyFiles.forEach(file => {
        mock.onGet(`https://raw.githubusercontent.com/user/empty-repo/main/${file}`)
          .reply(404);
        mock.onGet(`https://raw.githubusercontent.com/user/empty-repo/master/${file}`)
          .reply(404);
      });

      const result = await server.getPythonDependencies(githubUrl);

      expect(result).toContain('❌ No dependency files found in repository user/empty-repo');
    });
  });
});
