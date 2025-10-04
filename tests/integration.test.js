import { jest } from '@jest/globals';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

// Import the server class
import { PyDepLicensesMCPServer } from '../server.js';

describe('PyDepLicensesMCPServer - Integration Tests', () => {
  let server;
  let mock;

  beforeEach(() => {
    server = new PyDepLicensesMCPServer();
    mock = new MockAdapter(axios);
  });

  afterEach(() => {
    mock.restore();
  });

  describe('getPythonDependencies', () => {
    test('should handle valid GitHub URL with requirements.txt', async () => {
      const githubUrl = 'https://github.com/user/repo';
      const requirementsContent = 'requests>=2.28.0\nnumpy~=1.21.0\npandas';

      // Mock GitHub API response
      mock.onGet('https://raw.githubusercontent.com/user/repo/main/requirements.txt')
        .reply(200, requirementsContent);

      // Mock PyPI API responses
      mock.onGet('https://pypi.org/pypi/requests/json').reply(200, {
        info: { name: 'requests', license: 'Apache 2.0' }
      });
      mock.onGet('https://pypi.org/pypi/numpy/json').reply(200, {
        info: { name: 'numpy', license: 'BSD' }
      });
      mock.onGet('https://pypi.org/pypi/pandas/json').reply(200, {
        info: { name: 'pandas', license: 'BSD' }
      });

      const result = await server.getPythonDependencies(githubUrl);

      expect(result).toContain('📦 **Dependencies for user/repo** (from requirements.txt)');
      expect(result).toContain('## ✅ FREE for Commercial Use (3)');
      expect(result).toContain('**requests** (Apache 2.0)');
      expect(result).toContain('**numpy** (BSD)');
      expect(result).toContain('**pandas** (BSD)');
      expect(result).toContain('## 📊 Commercial Use Summary');
    });

    test('should handle GitHub URL with .git suffix', async () => {
      const githubUrl = 'https://github.com/user/repo.git';
      const requirementsContent = 'requests>=2.28.0';

      mock.onGet('https://raw.githubusercontent.com/user/repo/main/requirements.txt')
        .reply(200, requirementsContent);
      mock.onGet('https://pypi.org/pypi/requests/json').reply(200, {
        info: { name: 'requests', license: 'MIT' }
      });

      const result = await server.getPythonDependencies(githubUrl);

      expect(result).toContain('📦 **Dependencies for user/repo** (from requirements.txt)');
    });

    test('should try master branch when main fails', async () => {
      const githubUrl = 'https://github.com/user/repo';
      const requirementsContent = 'requests>=2.28.0';

      // Mock main branch 404, master branch success
      mock.onGet('https://raw.githubusercontent.com/user/repo/main/requirements.txt')
        .reply(404);
      mock.onGet('https://raw.githubusercontent.com/user/repo/master/requirements.txt')
        .reply(200, requirementsContent);
      mock.onGet('https://pypi.org/pypi/requests/json').reply(200, {
        info: { name: 'requests', license: 'MIT' }
      });

      const result = await server.getPythonDependencies(githubUrl);

      expect(result).toContain('📦 **Dependencies for user/repo** (from requirements.txt)');
    });

    test('should handle pyproject.toml when requirements.txt not found', async () => {
      const githubUrl = 'https://github.com/user/repo';
      const pyprojectContent = `
        [project]
        dependencies = [
          "requests>=2.28.0",
          "numpy~=1.21.0",
        ]
      `;

      // Mock requirements.txt 404, pyproject.toml success
      mock.onGet('https://raw.githubusercontent.com/user/repo/main/requirements.txt')
        .reply(404);
      mock.onGet('https://raw.githubusercontent.com/user/repo/master/requirements.txt')
        .reply(404);
      mock.onGet('https://raw.githubusercontent.com/user/repo/main/pyproject.toml')
        .reply(200, pyprojectContent);

      mock.onGet('https://pypi.org/pypi/requests/json').reply(200, {
        info: { name: 'requests', license: 'MIT' }
      });
      mock.onGet('https://pypi.org/pypi/numpy/json').reply(200, {
        info: { name: 'numpy', license: 'BSD' }
      });

      const result = await server.getPythonDependencies(githubUrl);

      expect(result).toContain('📦 **Dependencies for user/repo** (from pyproject.toml)');
    });

    test('should handle mixed license types in output', async () => {
      const githubUrl = 'https://github.com/user/repo';
      const requirementsContent = 'requests\nnumpy\ngpl-package\nunknown-package';

      mock.onGet('https://raw.githubusercontent.com/user/repo/main/requirements.txt')
        .reply(200, requirementsContent);

      mock.onGet('https://pypi.org/pypi/requests/json').reply(200, {
        info: { name: 'requests', license: 'MIT' }
      });
      mock.onGet('https://pypi.org/pypi/numpy/json').reply(200, {
        info: { name: 'numpy', license: 'Apache 2.0' }
      });
      mock.onGet('https://pypi.org/pypi/gpl-package/json').reply(200, {
        info: { name: 'gpl-package', license: 'GPL' }
      });
      mock.onGet('https://pypi.org/pypi/unknown-package/json').reply(404);

      const result = await server.getPythonDependencies(githubUrl);

      expect(result).toContain('## ✅ FREE for Commercial Use (2)');
      expect(result).toContain('## 💰 PAYMENT REQUIRED for Commercial Use (1)');
      expect(result).toContain('## ❓ UNKNOWN Commercial Use Status (1)');
      expect(result).toContain('⚠️ **IMPORTANT**: 1 package(s) may require payment for commercial use');
    });

    test('should handle no dependency files found', async () => {
      const githubUrl = 'https://github.com/user/repo';

      // Mock all dependency files as 404
      const dependencyFiles = [
        'requirements.txt', 'pyproject.toml', 'uv.lock', 'poetry.lock',
        'Pipfile.lock', 'setup.py', 'environment.yml', 'Pipfile'
      ];

      dependencyFiles.forEach(file => {
        mock.onGet(`https://raw.githubusercontent.com/user/repo/main/${file}`)
          .reply(404);
        mock.onGet(`https://raw.githubusercontent.com/user/repo/master/${file}`)
          .reply(404);
      });

      const result = await server.getPythonDependencies(githubUrl);

      expect(result).toContain('❌ No dependency files found in repository user/repo');
      expect(result).toContain('Searched for: requirements.txt, pyproject.toml, uv.lock, poetry.lock, Pipfile.lock, setup.py, environment.yml, Pipfile');
    });

    test('should handle empty dependencies in found file', async () => {
      const githubUrl = 'https://github.com/user/repo';
      const emptyRequirements = '# No dependencies\n# Just comments';

      mock.onGet('https://raw.githubusercontent.com/user/repo/main/requirements.txt')
        .reply(200, emptyRequirements);

      const result = await server.getPythonDependencies(githubUrl);

      expect(result).toContain('📦 Found requirements.txt in user/repo but no dependencies were parsed');
    });

    test('should handle invalid GitHub URL', async () => {
      const invalidUrl = 'https://gitlab.com/user/repo';

      await expect(server.getPythonDependencies(invalidUrl))
        .rejects.toThrow('Invalid GitHub URL format');
    });

    test('should handle network errors gracefully', async () => {
      const githubUrl = 'https://github.com/user/repo';

      mock.onGet('https://raw.githubusercontent.com/user/repo/main/requirements.txt')
        .networkError();

      await expect(server.getPythonDependencies(githubUrl))
        .rejects.toThrow('Error fetching dependencies');
    });

    test('should handle timeout errors', async () => {
      const githubUrl = 'https://github.com/user/repo';

      mock.onGet('https://raw.githubusercontent.com/user/repo/main/requirements.txt')
        .timeout();

      await expect(server.getPythonDependencies(githubUrl))
        .rejects.toThrow('Error fetching dependencies');
    });

    test('should handle PyPI API failures gracefully', async () => {
      const githubUrl = 'https://github.com/user/repo';
      const requirementsContent = 'requests\nnumpy';

      mock.onGet('https://raw.githubusercontent.com/user/repo/main/requirements.txt')
        .reply(200, requirementsContent);

      // Mock PyPI API failures
      mock.onGet('https://pypi.org/pypi/requests/json').networkError();
      mock.onGet('https://pypi.org/pypi/numpy/json').reply(500);

      const result = await server.getPythonDependencies(githubUrl);

      expect(result).toContain('📦 **Dependencies for user/repo** (from requirements.txt)');
      expect(result).toContain('## ❓ UNKNOWN Commercial Use Status (2)');
      expect(result).toContain('**requests** (License unknown)');
      expect(result).toContain('**numpy** (License unknown)');
    });

    test('should prioritize dependency files in correct order', async () => {
      const githubUrl = 'https://github.com/user/repo';
      const requirementsContent = 'requests>=2.28.0';
      const pyprojectContent = '[project]\ndependencies = ["numpy>=1.21.0"]';

      // Mock both files to exist, but requirements.txt should be found first
      mock.onGet('https://raw.githubusercontent.com/user/repo/main/requirements.txt')
        .reply(200, requirementsContent);
      mock.onGet('https://raw.githubusercontent.com/user/repo/main/pyproject.toml')
        .reply(200, pyprojectContent);

      mock.onGet('https://pypi.org/pypi/requests/json').reply(200, {
        info: { name: 'requests', license: 'MIT' }
      });

      const result = await server.getPythonDependencies(githubUrl);

      expect(result).toContain('📦 **Dependencies for user/repo** (from requirements.txt)');
      expect(result).toContain('**requests** (MIT)');
      expect(result).not.toContain('**numpy**');
    });

    test('should handle complex pyproject.toml with multiple sections', async () => {
      const githubUrl = 'https://github.com/user/repo';
      const pyprojectContent = `
        [project]
        name = "test-project"
        dependencies = [
          "requests>=2.28.0",
          "numpy~=1.21.0",
        ]
        
        [project.optional-dependencies.dev]
        pytest = "^7.0.0"
        black = "*"
        
        [tool.poetry.group.test.dependencies]
        pytest-cov = "^4.0.0"
      `;

      mock.onGet('https://raw.githubusercontent.com/user/repo/main/requirements.txt')
        .reply(404);
      mock.onGet('https://raw.githubusercontent.com/user/repo/master/requirements.txt')
        .reply(404);
      mock.onGet('https://raw.githubusercontent.com/user/repo/main/pyproject.toml')
        .reply(200, pyprojectContent);

      // Mock PyPI responses
      const packages = ['requests', 'numpy', 'pytest', 'black', 'pytest-cov'];
      packages.forEach(pkg => {
        mock.onGet(`https://pypi.org/pypi/${pkg}/json`).reply(200, {
          info: { name: pkg, license: 'MIT' }
        });
      });

      const result = await server.getPythonDependencies(githubUrl);

      expect(result).toContain('📦 **Dependencies for user/repo** (from pyproject.toml)');
      expect(result).toContain('## ✅ FREE for Commercial Use (5)');
      packages.forEach(pkg => {
        expect(result).toContain(`**${pkg}** (MIT)`);
      });
    });
  });
});
