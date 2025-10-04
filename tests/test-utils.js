import { jest } from '@jest/globals';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

/**
 * Test utilities for PyDepLicensesMCPServer
 */

export class TestUtils {
  /**
   * Create a mock adapter for axios
   * @returns {MockAdapter}
   */
  static createMockAdapter() {
    return new MockAdapter(axios);
  }

  /**
   * Mock GitHub API responses for dependency files
   * @param {MockAdapter} mock - The mock adapter
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} fileName - Dependency file name
   * @param {string} content - File content
   * @param {number} statusCode - HTTP status code (default: 200)
   */
  static mockGitHubFile(mock, owner, repo, fileName, content, statusCode = 200) {
    const mainUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/${fileName}`;
    const masterUrl = `https://raw.githubusercontent.com/${owner}/${repo}/master/${fileName}`;
    
    if (statusCode === 200) {
      mock.onGet(mainUrl).reply(200, content);
    } else {
      mock.onGet(mainUrl).reply(statusCode);
      mock.onGet(masterUrl).reply(statusCode);
    }
  }

  /**
   * Mock PyPI API responses for packages
   * @param {MockAdapter} mock - The mock adapter
   * @param {string} packageName - Package name
   * @param {string} license - License name
   * @param {number} statusCode - HTTP status code (default: 200)
   */
  static mockPyPIPackage(mock, packageName, license, statusCode = 200) {
    const url = `https://pypi.org/pypi/${packageName}/json`;
    
    if (statusCode === 200) {
      mock.onGet(url).reply(200, {
        info: { name: packageName, license }
      });
    } else {
      mock.onGet(url).reply(statusCode);
    }
  }

  /**
   * Mock multiple PyPI packages
   * @param {MockAdapter} mock - The mock adapter
   * @param {Array} packages - Array of {name, license} objects
   */
  static mockPyPIPackages(mock, packages) {
    packages.forEach(pkg => {
      this.mockPyPIPackage(mock, pkg.name, pkg.license);
    });
  }

  /**
   * Create a sample requirements.txt content
   * @param {Array} packages - Array of package strings
   * @returns {string}
   */
  static createRequirementsTxt(packages) {
    return packages.join('\n');
  }

  /**
   * Create a sample pyproject.toml content
   * @param {Array} packages - Array of package strings
   * @returns {string}
   */
  static createPyprojectToml(packages) {
    const deps = packages.map(pkg => `"${pkg}"`).join(',\n          ');
    return `
[project]
name = "test-project"
version = "1.0.0"
dependencies = [
          ${deps}
        ]
    `;
  }

  /**
   * Create a sample environment.yml content
   * @param {Array} packages - Array of package strings
   * @returns {string}
   */
  static createEnvironmentYml(packages) {
    const deps = packages.map(pkg => `  - ${pkg}`).join('\n');
    return `
name: test-env
channels:
  - conda-forge
dependencies:
  - python=3.9
${deps}
    `;
  }

  /**
   * Create a sample Pipfile content
   * @param {Array} packages - Array of package strings
   * @returns {string}
   */
  static createPipfile(packages) {
    const deps = packages.map(pkg => `${pkg} = "*"`).join('\n');
    return `
[[source]]
url = "https://pypi.org/simple"
verify_ssl = true
name = "pypi"

[packages]
${deps}
    `;
  }

  /**
   * Create a sample setup.py content
   * @param {Array} packages - Array of package strings
   * @returns {string}
   */
  static createSetupPy(packages) {
    const deps = packages.map(pkg => `"${pkg}"`).join(',\n                ');
    return `
from setuptools import setup

setup(
    name="test-package",
    version="1.0.0",
    install_requires=[
                ${deps}
            ],
)
    `;
  }

  /**
   * Create a sample uv.lock content
   * @param {Array} packages - Array of package strings
   * @returns {string}
   */
  static createUvLock(packages) {
    const packageSections = packages.map(pkg => `
[[package]]
name = "${pkg}"
version = "1.0.0"`).join('');
    
    return `version = 1${packageSections}
    `;
  }

  /**
   * Create a sample poetry.lock content
   * @param {Array} packages - Array of package strings
   * @returns {string}
   */
  static createPoetryLock(packages) {
    const packageSections = packages.map(pkg => `
[[package]]
name = "${pkg}"
version = "1.0.0"`).join('');
    
    return packageSections;
  }

  /**
   * Create a sample Pipfile.lock content
   * @param {Array} packages - Array of package strings
   * @returns {string}
   */
  static createPipfileLock(packages) {
    const defaultPackages = {};
    packages.forEach(pkg => {
      defaultPackages[pkg] = {
        hashes: ["sha256:test"],
        version: "==1.0.0"
      };
    });

    return JSON.stringify({
      "_meta": {
        "hash": {
          "sha256": "test"
        }
      },
      "default": defaultPackages
    });
  }

  /**
   * Assert that a result contains expected commercial use categories
   * @param {string} result - The result string
   * @param {Object} expected - Expected counts for each category
   */
  static assertCommercialUseCategories(result, expected) {
    if (expected.free > 0) {
      expect(result).toContain(`## ✅ FREE for Commercial Use (${expected.free})`);
    }
    if (expected.warning > 0) {
      expect(result).toContain(`## ⚠️ WARNING - Check Commercial Use (${expected.warning})`);
    }
    if (expected.paid > 0) {
      expect(result).toContain(`## 💰 PAYMENT REQUIRED for Commercial Use (${expected.paid})`);
    }
    if (expected.unknown > 0) {
      expect(result).toContain(`## ❓ UNKNOWN Commercial Use Status (${expected.unknown})`);
    }
  }

  /**
   * Assert that a result contains expected summary counts
   * @param {string} result - The result string
   * @param {Object} expected - Expected counts for each category
   */
  static assertSummaryCounts(result, expected) {
    expect(result).toContain(`- ✅ Free for commercial use: **${expected.free}** packages`);
    expect(result).toContain(`- ⚠️ Check commercial restrictions: **${expected.warning}** packages`);
    expect(result).toContain(`- 💰 Payment required: **${expected.paid}** packages`);
    expect(result).toContain(`- ❓ Unknown status: **${expected.unknown}** packages`);
  }

  /**
   * Create a mock console.error spy
   * @returns {jest.SpyInstance}
   */
  static createConsoleErrorSpy() {
    return jest.spyOn(console, 'error').mockImplementation();
  }

  /**
   * Create a mock process.exit spy
   * @returns {jest.SpyInstance}
   */
  static createProcessExitSpy() {
    return jest.spyOn(process, 'exit').mockImplementation();
  }

  /**
   * Wait for async operations to complete
   * @param {number} ms - Milliseconds to wait
   * @returns {Promise}
   */
  static async wait(ms = 0) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a test GitHub URL
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {string}
   */
  static createGitHubUrl(owner, repo) {
    return `https://github.com/${owner}/${repo}`;
  }

  /**
   * Extract owner and repo from GitHub URL
   * @param {string} url - GitHub URL
   * @returns {Object} - {owner, repo}
   */
  static parseGitHubUrl(url) {
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      throw new Error('Invalid GitHub URL format');
    }
    const [, owner, repo] = match;
    return {
      owner,
      repo: repo.replace(/\.git$/, '')
    };
  }
}

export default TestUtils;
