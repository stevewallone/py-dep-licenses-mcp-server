import { jest } from '@jest/globals';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

// Import the server class and test utilities
import { PyDepLicensesMCPServer } from '../server.js';
import { TestUtils } from './test-utils.js';

describe('PyDepLicensesMCPServer - End-to-End Tests', () => {
  let server;
  let mock;

  beforeEach(() => {
    server = new PyDepLicensesMCPServer();
    mock = TestUtils.createMockAdapter();
  });

  afterEach(() => {
    mock.restore();
  });

  describe('Complete Workflow Tests', () => {
    test('should handle complete workflow with requirements.txt', async () => {
      const githubUrl = TestUtils.createGitHubUrl('user', 'repo');
      const packages = ['requests', 'numpy', 'pandas', 'flask'];
      const requirementsContent = TestUtils.createRequirementsTxt(packages);

      // Mock GitHub API
      TestUtils.mockGitHubFile(mock, 'user', 'repo', 'requirements.txt', requirementsContent);

      // Mock PyPI API
      TestUtils.mockPyPIPackages(mock, [
        { name: 'requests', license: 'Apache 2.0' },
        { name: 'numpy', license: 'BSD' },
        { name: 'pandas', license: 'BSD' },
        { name: 'flask', license: 'BSD' }
      ]);

      const result = await server.getPythonDependencies(githubUrl);

      // Verify structure
      expect(result).toContain('📦 **Dependencies for user/repo** (from requirements.txt)');
      expect(result).toContain('## ✅ FREE for Commercial Use (4)');
      expect(result).toContain('## 📊 Commercial Use Summary');

      // Verify packages
      packages.forEach(pkg => {
        expect(result).toContain(`**${pkg}**`);
      });

      // Verify summary
      TestUtils.assertSummaryCounts(result, { free: 4, warning: 0, paid: 0, unknown: 0 });
    });

    test('should handle complete workflow with pyproject.toml', async () => {
      const githubUrl = TestUtils.createGitHubUrl('user', 'project');
      const packages = ['requests', 'numpy', 'pytest'];
      const pyprojectContent = TestUtils.createPyprojectToml(packages);

      // Mock GitHub API - requirements.txt not found, pyproject.toml found
      TestUtils.mockGitHubFile(mock, 'user', 'project', 'requirements.txt', '', 404);
      TestUtils.mockGitHubFile(mock, 'user', 'project', 'pyproject.toml', pyprojectContent);

      // Mock PyPI API
      TestUtils.mockPyPIPackages(mock, [
        { name: 'requests', license: 'MIT' },
        { name: 'numpy', license: 'BSD' },
        { name: 'pytest', license: 'MIT' }
      ]);

      const result = await server.getPythonDependencies(githubUrl);

      expect(result).toContain('📦 **Dependencies for user/project** (from pyproject.toml)');
      expect(result).toContain('## ✅ FREE for Commercial Use (3)');
      TestUtils.assertSummaryCounts(result, { free: 3, warning: 0, paid: 0, unknown: 0 });
    });

    test('should handle mixed license types', async () => {
      const githubUrl = TestUtils.createGitHubUrl('user', 'mixed-repo');
      const packages = ['requests', 'gpl-package', 'unknown-package'];
      const requirementsContent = TestUtils.createRequirementsTxt(packages);

      // Mock GitHub API
      TestUtils.mockGitHubFile(mock, 'user', 'mixed-repo', 'requirements.txt', requirementsContent);

      // Mock PyPI API with mixed responses
      TestUtils.mockPyPIPackage(mock, 'requests', 'MIT');
      TestUtils.mockPyPIPackage(mock, 'gpl-package', 'GPL');
      TestUtils.mockPyPIPackage(mock, 'unknown-package', null, 404);

      const result = await server.getPythonDependencies(githubUrl);

      // Verify all categories are present
      TestUtils.assertCommercialUseCategories(result, { free: 1, warning: 0, paid: 1, unknown: 1 });
      TestUtils.assertSummaryCounts(result, { free: 1, warning: 0, paid: 1, unknown: 1 });

      // Verify warning message
      expect(result).toContain('⚠️ **IMPORTANT**: 1 package(s) may require payment for commercial use');
    });

    test('should handle large dependency list', async () => {
      const githubUrl = TestUtils.createGitHubUrl('user', 'large-repo');
      const packages = Array.from({ length: 50 }, (_, i) => `package${i}`);
      const requirementsContent = TestUtils.createRequirementsTxt(packages);

      // Mock GitHub API
      TestUtils.mockGitHubFile(mock, 'user', 'large-repo', 'requirements.txt', requirementsContent);

      // Mock PyPI API for all packages
      packages.forEach(pkg => {
        TestUtils.mockPyPIPackage(mock, pkg, 'MIT');
      });

      const result = await server.getPythonDependencies(githubUrl);

      expect(result).toContain('📦 **Dependencies for user/large-repo** (from requirements.txt)');
      expect(result).toContain('## ✅ FREE for Commercial Use (50)');
      TestUtils.assertSummaryCounts(result, { free: 50, warning: 0, paid: 0, unknown: 0 });
    });

    test('should handle all supported file formats', async () => {
      const githubUrl = TestUtils.createGitHubUrl('user', 'multi-format-repo');
      const packages = ['requests', 'numpy'];

      const testCases = [
        { file: 'requirements.txt', content: TestUtils.createRequirementsTxt(packages) },
        { file: 'pyproject.toml', content: TestUtils.createPyprojectToml(packages) },
        { file: 'environment.yml', content: TestUtils.createEnvironmentYml(packages) },
        { file: 'Pipfile', content: TestUtils.createPipfile(packages) },
        { file: 'setup.py', content: TestUtils.createSetupPy(packages) },
        { file: 'uv.lock', content: TestUtils.createUvLock(packages) },
        { file: 'poetry.lock', content: TestUtils.createPoetryLock(packages) },
        { file: 'Pipfile.lock', content: TestUtils.createPipfileLock(packages) }
      ];

      for (const testCase of testCases) {
        // Reset mock
        mock.restore();
        mock = TestUtils.createMockAdapter();

        // Mock GitHub API - only the current file exists
        TestUtils.mockGitHubFile(mock, 'user', 'multi-format-repo', testCase.file, testCase.content);

        // Mock PyPI API
        TestUtils.mockPyPIPackages(mock, [
          { name: 'requests', license: 'MIT' },
          { name: 'numpy', license: 'BSD' }
        ]);

        const result = await server.getPythonDependencies(githubUrl);

        expect(result).toContain(`📦 **Dependencies for user/multi-format-repo** (from ${testCase.file})`);
        expect(result).toContain('## ✅ FREE for Commercial Use (2)');
      }
    });
  });

  describe('MCP Protocol Integration Tests', () => {
    test('should handle complete MCP tool call workflow', async () => {
      const githubUrl = TestUtils.createGitHubUrl('user', 'mcp-repo');
      const packages = ['requests', 'numpy'];
      const requirementsContent = TestUtils.createRequirementsTxt(packages);

      // Mock GitHub API
      TestUtils.mockGitHubFile(mock, 'user', 'mcp-repo', 'requirements.txt', requirementsContent);

      // Mock PyPI API
      TestUtils.mockPyPIPackages(mock, [
        { name: 'requests', license: 'MIT' },
        { name: 'numpy', license: 'BSD' }
      ]);

      // Simulate MCP tool call
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
      const response = await handler(request);

      // Verify MCP response format
      expect(response).toEqual({
        content: [
          {
            type: 'text',
            text: expect.stringContaining('📦 **Dependencies for user/mcp-repo** (from requirements.txt)')
          }
        ]
      });

      // Verify content
      expect(response.content[0].text).toContain('## ✅ FREE for Commercial Use (2)');
      expect(response.content[0].text).toContain('**requests** (MIT)');
      expect(response.content[0].text).toContain('**numpy** (BSD)');
    });

    test('should handle MCP tool list request', async () => {
      const request = {
        method: 'tools/list',
        params: {}
      };

      const handler = server.server.requestHandlers.get('tools/list');
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

  describe('Performance and Scalability Tests', () => {
    test('should handle batch processing efficiently', async () => {
      const githubUrl = TestUtils.createGitHubUrl('user', 'batch-repo');
      const packages = Array.from({ length: 20 }, (_, i) => `package${i}`);
      const requirementsContent = TestUtils.createRequirementsTxt(packages);

      // Mock GitHub API
      TestUtils.mockGitHubFile(mock, 'user', 'batch-repo', 'requirements.txt', requirementsContent);

      // Mock PyPI API with delays to test batching
      packages.forEach((pkg, index) => {
        mock.onGet(`https://pypi.org/pypi/${pkg}/json`).reply(200, {
          info: { name: pkg, license: 'MIT' }
        });
      });

      const startTime = Date.now();
      const result = await server.getPythonDependencies(githubUrl);
      const endTime = Date.now();

      expect(result).toContain('📦 **Dependencies for user/batch-repo** (from requirements.txt)');
      expect(result).toContain('## ✅ FREE for Commercial Use (20)');

      // Should complete within reasonable time (allowing for batch delays)
      expect(endTime - startTime).toBeLessThan(5000);
    });

    test('should handle concurrent requests', async () => {
      const githubUrls = [
        TestUtils.createGitHubUrl('user1', 'repo1'),
        TestUtils.createGitHubUrl('user2', 'repo2'),
        TestUtils.createGitHubUrl('user3', 'repo3')
      ];

      const packages = ['requests', 'numpy'];

      // Mock GitHub API for all repos
      githubUrls.forEach((url, index) => {
        const { owner, repo } = TestUtils.parseGitHubUrl(url);
        const requirementsContent = TestUtils.createRequirementsTxt(packages);
        TestUtils.mockGitHubFile(mock, owner, repo, 'requirements.txt', requirementsContent);
      });

      // Mock PyPI API
      TestUtils.mockPyPIPackages(mock, [
        { name: 'requests', license: 'MIT' },
        { name: 'numpy', license: 'BSD' }
      ]);

      // Execute concurrent requests
      const promises = githubUrls.map(url => server.getPythonDependencies(url));
      const results = await Promise.all(promises);

      // Verify all results
      results.forEach((result, index) => {
        const { owner, repo } = TestUtils.parseGitHubUrl(githubUrls[index]);
        expect(result).toContain(`📦 **Dependencies for ${owner}/${repo}** (from requirements.txt)`);
        expect(result).toContain('## ✅ FREE for Commercial Use (2)');
      });
    });
  });

  describe('Real-world Scenario Tests', () => {
    test('should handle a typical Python web application', async () => {
      const githubUrl = TestUtils.createGitHubUrl('developer', 'web-app');
      const packages = [
        'fastapi',
        'uvicorn',
        'pydantic',
        'sqlalchemy',
        'alembic',
        'pytest',
        'black',
        'mypy'
      ];
      const requirementsContent = TestUtils.createRequirementsTxt(packages);

      // Mock GitHub API
      TestUtils.mockGitHubFile(mock, 'developer', 'web-app', 'requirements.txt', requirementsContent);

      // Mock PyPI API with realistic licenses
      TestUtils.mockPyPIPackages(mock, [
        { name: 'fastapi', license: 'MIT' },
        { name: 'uvicorn', license: 'BSD' },
        { name: 'pydantic', license: 'MIT' },
        { name: 'sqlalchemy', license: 'MIT' },
        { name: 'alembic', license: 'MIT' },
        { name: 'pytest', license: 'MIT' },
        { name: 'black', license: 'MIT' },
        { name: 'mypy', license: 'MIT' }
      ]);

      const result = await server.getPythonDependencies(githubUrl);

      expect(result).toContain('📦 **Dependencies for developer/web-app** (from requirements.txt)');
      expect(result).toContain('## ✅ FREE for Commercial Use (8)');
      TestUtils.assertSummaryCounts(result, { free: 8, warning: 0, paid: 0, unknown: 0 });

      // Verify no payment warnings
      expect(result).not.toContain('⚠️ **IMPORTANT**:');
    });

    test('should handle a project with GPL dependencies', async () => {
      const githubUrl = TestUtils.createGitHubUrl('developer', 'gpl-project');
      const packages = ['requests', 'gpl-library', 'numpy'];
      const requirementsContent = TestUtils.createRequirementsTxt(packages);

      // Mock GitHub API
      TestUtils.mockGitHubFile(mock, 'developer', 'gpl-project', 'requirements.txt', requirementsContent);

      // Mock PyPI API with GPL license
      TestUtils.mockPyPIPackages(mock, [
        { name: 'requests', license: 'MIT' },
        { name: 'gpl-library', license: 'GPL' },
        { name: 'numpy', license: 'BSD' }
      ]);

      const result = await server.getPythonDependencies(githubUrl);

      expect(result).toContain('📦 **Dependencies for developer/gpl-project** (from requirements.txt)');
      TestUtils.assertCommercialUseCategories(result, { free: 2, warning: 0, paid: 1, unknown: 0 });
      TestUtils.assertSummaryCounts(result, { free: 2, warning: 0, paid: 1, unknown: 0 });

      // Verify payment warning
      expect(result).toContain('⚠️ **IMPORTANT**: 1 package(s) may require payment for commercial use');
    });

    test('should handle a project with unknown licenses', async () => {
      const githubUrl = TestUtils.createGitHubUrl('developer', 'unknown-licenses');
      const packages = ['requests', 'unknown-package1', 'unknown-package2'];
      const requirementsContent = TestUtils.createRequirementsTxt(packages);

      // Mock GitHub API
      TestUtils.mockGitHubFile(mock, 'developer', 'unknown-licenses', 'requirements.txt', requirementsContent);

      // Mock PyPI API - one success, two failures
      TestUtils.mockPyPIPackage(mock, 'requests', 'MIT');
      TestUtils.mockPyPIPackage(mock, 'unknown-package1', null, 404);
      TestUtils.mockPyPIPackage(mock, 'unknown-package2', null, 500);

      const result = await server.getPythonDependencies(githubUrl);

      expect(result).toContain('📦 **Dependencies for developer/unknown-licenses** (from requirements.txt)');
      TestUtils.assertCommercialUseCategories(result, { free: 1, warning: 0, paid: 0, unknown: 2 });
      TestUtils.assertSummaryCounts(result, { free: 1, warning: 0, paid: 0, unknown: 2 });
    });
  });
});
