import { jest } from '@jest/globals';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

// Import the server class
import { PyDepLicensesMCPServer } from '../server.js';

describe('PyDepLicensesMCPServer - Parsing Functions', () => {
  let server;
  let mock;

  beforeEach(() => {
    server = new PyDepLicensesMCPServer();
    mock = new MockAdapter(axios);
  });

  afterEach(() => {
    mock.restore();
  });

  describe('parseRequirementsTxt', () => {
    test('should parse basic requirements.txt', () => {
      const content = `
        requests==2.28.0
        numpy>=1.21.0
        pandas~=1.4.0
        # This is a comment
        flask
        -r other-requirements.txt
      `;

      const result = server.parseRequirementsTxt(content);
      expect(result).toEqual(['requests', 'numpy', 'pandas', 'flask']);
    });

    test('should handle empty requirements.txt', () => {
      const content = `
        # Only comments
        # Another comment
      `;

      const result = server.parseRequirementsTxt(content);
      expect(result).toEqual([]);
    });

    test('should handle requirements with various version specifiers', () => {
      const content = `
        package1==1.0.0
        package2>=2.0.0
        package3<=3.0.0
        package4>4.0.0
        package5<5.0.0
        package6~=6.0.0
      `;

      const result = server.parseRequirementsTxt(content);
      expect(result).toEqual(['package1', 'package2', 'package3', 'package4', 'package5', 'package6']);
    });

    test('should filter out empty lines and comments', () => {
      const content = `
        
        # Comment line
        valid-package==1.0.0
        
        # Another comment
        another-package>=2.0.0
        
      `;

      const result = server.parseRequirementsTxt(content);
      expect(result).toEqual(['valid-package', 'another-package']);
    });
  });

  describe('parsePyprojectToml', () => {
    test('should parse modern project dependencies', () => {
      const content = `
        [project]
        name = "test-project"
        version = "1.0.0"
        dependencies = [
          "requests>=2.28.0",
          "numpy~=1.21.0",
          "pandas",
        ]
      `;

      const result = server.parsePyprojectToml(content);
      expect(result).toEqual(['requests', 'numpy', 'pandas']);
    });

    test('should parse poetry dependencies', () => {
      const content = `
        [tool.poetry.dependencies]
        python = "^3.8"
        requests = "^2.28.0"
        numpy = "~1.21.0"
        pandas = "*"
      `;

      const result = server.parsePyprojectToml(content);
      expect(result).toEqual(['requests', 'numpy', 'pandas']);
    });

    test('should parse setuptools dependencies', () => {
      const content = `
        [tool.setuptools.dependencies]
        requests = ">=2.28.0"
        numpy = "~1.21.0"
        pandas = "*"
      `;

      const result = server.parsePyprojectToml(content);
      expect(result).toEqual(['requests', 'numpy', 'pandas']);
    });

    test('should handle multiple dependency sections', () => {
      const content = `
        [project]
        dependencies = [
          "requests>=2.28.0",
          "numpy~=1.21.0",
        ]
        
        [project.optional-dependencies.dev]
        pytest = "^7.0.0"
        black = "*"
      `;

      const result = server.parsePyprojectToml(content);
      expect(result).toEqual(['requests', 'numpy', 'pytest', 'black']);
    });

    test('should filter out build system requirements', () => {
      const content = `
        [build-system]
        requires = ["setuptools", "wheel"]
        
        [project]
        dependencies = [
          "requests>=2.28.0",
          "setuptools",
          "wheel",
          "build",
        ]
      `;

      const result = server.parsePyprojectToml(content);
      expect(result).toEqual(['requests']);
    });

    test('should handle complex dependency formats', () => {
      const content = `
        [project]
        dependencies = [
          "requests>=2.28.0,<3.0.0",
          "numpy~=1.21.0",
          "pandas",
        ]
      `;

      const result = server.parsePyprojectToml(content);
      expect(result).toEqual(['requests', 'numpy', 'pandas']);
    });

    test('should handle empty pyproject.toml', () => {
      const content = `
        [project]
        name = "test-project"
        version = "1.0.0"
      `;

      const result = server.parsePyprojectToml(content);
      expect(result).toEqual([]);
    });
  });

  describe('parseSetupPy', () => {
    test('should parse setup.py with install_requires', () => {
      const content = `
        from setuptools import setup
        
        setup(
            name="test-package",
            version="1.0.0",
            install_requires=[
                "requests>=2.28.0",
                "numpy~=1.21.0",
                "pandas",
            ],
        )
      `;

      const result = server.parseSetupPy(content);
      expect(result).toEqual(['requests', 'numpy', 'pandas']);
    });

    test('should handle setup.py without install_requires', () => {
      const content = `
        from setuptools import setup
        
        setup(
            name="test-package",
            version="1.0.0",
        )
      `;

      const result = server.parseSetupPy(content);
      expect(result).toEqual([]);
    });

    test('should handle malformed setup.py', () => {
      const content = `
        from setuptools import setup
        
        setup(
            name="test-package",
            version="1.0.0",
            install_requires=[
                "requests>=2.28.0",
                # Missing closing bracket
      `;

      const result = server.parseSetupPy(content);
      expect(result).toEqual([]);
    });
  });

  describe('parseEnvironmentYml', () => {
    test('should parse conda environment.yml', () => {
      const content = `
        name: test-env
        channels:
          - conda-forge
        dependencies:
          - python=3.9
          - requests>=2.28.0
          - numpy=1.21.0
          - pandas
      `;

      const result = server.parseEnvironmentYml(content);
      expect(result).toEqual(['requests', 'numpy', 'pandas']);
    });

    test('should handle environment.yml without dependencies', () => {
      const content = `
        name: test-env
        channels:
          - conda-forge
      `;

      const result = server.parseEnvironmentYml(content);
      expect(result).toEqual([]);
    });

    test('should handle malformed YAML', () => {
      const content = `
        name: test-env
        dependencies:
          - python=3.9
          - requests>=2.28.0
        # Invalid YAML structure
        invalid: [unclosed
      `;

      const result = server.parseEnvironmentYml(content);
      expect(result).toEqual([]);
    });
  });

  describe('parsePipfile', () => {
    test('should parse Pipfile packages', () => {
      const content = `
        [[source]]
        url = "https://pypi.org/simple"
        verify_ssl = true
        name = "pypi"
        
        [packages]
        requests = ">=2.28.0"
        numpy = "~1.21.0"
        pandas = "*"
        
        [dev-packages]
        pytest = "*"
      `;

      const result = server.parsePipfile(content);
      expect(result).toEqual(['requests', 'numpy', 'pandas']);
    });

    test('should handle Pipfile without packages', () => {
      const content = `
        [[source]]
        url = "https://pypi.org/simple"
        verify_ssl = true
        name = "pypi"
      `;

      const result = server.parsePipfile(content);
      expect(result).toEqual([]);
    });
  });

  describe('parseUvLock', () => {
    test('should parse uv.lock file', () => {
      const content = `
        version = 1
        
        [[package]]
        name = "requests"
        version = "2.28.0"
        
        [[package]]
        name = "numpy"
        version = "1.21.0"
        
        [[package]]
        name = "python"
        version = "3.9.0"
      `;

      const result = server.parseUvLock(content);
      expect(result).toEqual(['requests', 'numpy']);
    });

    test('should handle uv.lock without packages', () => {
      const content = `
        version = 1
      `;

      const result = server.parseUvLock(content);
      expect(result).toEqual([]);
    });
  });

  describe('parsePoetryLock', () => {
    test('should parse poetry.lock file', () => {
      const content = `
        [[package]]
        name = "requests"
        version = "2.28.0"
        
        [[package]]
        name = "numpy"
        version = "1.21.0"
        
        [[package]]
        name = "python"
        version = "3.9.0"
      `;

      const result = server.parsePoetryLock(content);
      expect(result).toEqual(['requests', 'numpy']);
    });

    test('should handle poetry.lock without packages', () => {
      const content = `
        # Empty poetry.lock
      `;

      const result = server.parsePoetryLock(content);
      expect(result).toEqual([]);
    });
  });

  describe('parsePipfileLock', () => {
    test('should parse Pipfile.lock JSON', () => {
      const content = JSON.stringify({
        "_meta": {
          "hash": {
            "sha256": "test"
          }
        },
        "default": {
          "requests": {
            "hashes": ["sha256:test"],
            "version": "==2.28.0"
          },
          "numpy": {
            "hashes": ["sha256:test"],
            "version": "==1.21.0"
          },
          "python": {
            "hashes": ["sha256:test"],
            "version": "==3.9.0"
          }
        }
      });

      const result = server.parsePipfileLock(content);
      expect(result).toEqual(['requests', 'numpy']);
    });

    test('should handle Pipfile.lock without default packages', () => {
      const content = JSON.stringify({
        "_meta": {
          "hash": {
            "sha256": "test"
          }
        }
      });

      const result = server.parsePipfileLock(content);
      expect(result).toEqual([]);
    });

    test('should handle malformed JSON', () => {
      const content = `
        {
          "default": {
            "requests": {
              "version": "==2.28.0"
            }
          }
          // Missing closing brace
      `;

      const result = server.parsePipfileLock(content);
      expect(result).toEqual([]);
    });
  });

  describe('parseDependencies', () => {
    test('should route to correct parser based on filename', () => {
      const requirementsContent = 'requests>=2.28.0\nnumpy~=1.21.0';
      const pyprojectContent = '[project]\ndependencies = ["requests>=2.28.0", "numpy~=1.21.0"]';

      expect(server.parseDependencies(requirementsContent, 'requirements.txt')).toEqual(['requests', 'numpy']);
      expect(server.parseDependencies(pyprojectContent, 'pyproject.toml')).toEqual(['requests', 'numpy']);
    });

    test('should handle unknown file types', () => {
      const content = 'some content';
      const result = server.parseDependencies(content, 'unknown.txt');
      expect(result).toEqual([]);
    });

    test('should handle parsing errors gracefully', () => {
      const malformedContent = 'invalid content that will cause parsing errors';
      const result = server.parseDependencies(malformedContent, 'pyproject.toml');
      expect(result).toEqual([]);
    });
  });
});
