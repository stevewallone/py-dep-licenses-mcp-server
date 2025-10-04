import { jest } from '@jest/globals';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

// Import the server class
import { PyDepLicensesMCPServer } from '../server.js';

describe('PyDepLicensesMCPServer - License Analysis', () => {
  let server;
  let mock;

  beforeEach(() => {
    server = new PyDepLicensesMCPServer();
    mock = new MockAdapter(axios);
  });

  afterEach(() => {
    mock.restore();
  });

  describe('analyzeCommercialLicense', () => {
    test('should identify free commercial use licenses', () => {
      const freeLicenses = [
        'MIT',
        'Apache 2.0',
        'Apache-2.0',
        'BSD',
        'BSD-3-Clause',
        'BSD-2-Clause',
        'ISC',
        'MPL',
        'Mozilla Public License',
        'Unlicense',
        'CC0',
        'Zlib',
        'OSI Approved'
      ];

      freeLicenses.forEach(license => {
        const result = server.analyzeCommercialLicense(license);
        expect(result.status).toBe('free');
        expect(result.note).toContain('Free for commercial use');
      });
    });

    test('should identify paid commercial use licenses', () => {
      const paidLicenses = [
        'GPL',
        'GPLv2',
        'GPLv3',
        'GPL-2.0',
        'GPL-3.0',
        'AGPL',
        'AGPLv3',
        'Copyleft',
        'Commercial',
        'Proprietary',
        'Trial',
        'Evaluation'
      ];

      paidLicenses.forEach(license => {
        const result = server.analyzeCommercialLicense(license);
        expect(result.status).toBe('paid');
        expect(result.note).toContain('Payment required');
      });
    });

    test('should identify warning licenses', () => {
      const warningLicenses = [
        'GNU General Public License',
        'GNU Lesser General Public License',
        'Copyleft License'
      ];

      warningLicenses.forEach(license => {
        const result = server.analyzeCommercialLicense(license);
        expect(result.status).toBe('warning');
        expect(result.note).toContain('Check commercial use restrictions');
      });
    });

    test('should handle unknown licenses', () => {
      const unknownLicenses = [
        'Custom License',
        'Internal License',
        'Special License',
        null,
        undefined,
        ''
      ];

      unknownLicenses.forEach(license => {
        const result = server.analyzeCommercialLicense(license);
        expect(result.status).toBe('unknown');
        expect(result.note).toContain('Unknown license');
      });
    });

    test('should handle case insensitive matching', () => {
      const testCases = [
        { input: 'mit', expected: 'free' },
        { input: 'MIT', expected: 'free' },
        { input: 'Mit', expected: 'free' },
        { input: 'gpl', expected: 'paid' },
        { input: 'GPL', expected: 'paid' },
        { input: 'Gpl', expected: 'paid' }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = server.analyzeCommercialLicense(input);
        expect(result.status).toBe(expected);
      });
    });

    test('should handle partial matches', () => {
      const testCases = [
        { input: 'MIT License', expected: 'free' },
        { input: 'Apache License 2.0', expected: 'free' },
        { input: 'GPL v3', expected: 'paid' },
        { input: 'GNU GPL', expected: 'warning' }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = server.analyzeCommercialLicense(input);
        expect(result.status).toBe(expected);
      });
    });
  });

  describe('fetchPackageLicense', () => {
    test('should fetch license from PyPI API', async () => {
      const mockResponse = {
        info: {
          name: 'requests',
          version: '2.28.0',
          license: 'Apache 2.0',
          classifiers: [
            'License :: OSI Approved :: Apache Software License'
          ]
        }
      };

      mock.onGet('https://pypi.org/pypi/requests/json').reply(200, mockResponse);

      const result = await server.fetchPackageLicense('requests');
      expect(result).toBe('Apache 2.0');
    });

    test('should handle license from classifiers', async () => {
      const mockResponse = {
        info: {
          name: 'numpy',
          version: '1.21.0',
          license: null,
          classifiers: [
            'License :: OSI Approved :: BSD License'
          ]
        }
      };

      mock.onGet('https://pypi.org/pypi/numpy/json').reply(200, mockResponse);

      const result = await server.fetchPackageLicense('numpy');
      expect(result).toBe('BSD License');
    });

    test('should handle missing license information', async () => {
      const mockResponse = {
        info: {
          name: 'unknown-package',
          version: '1.0.0',
          license: null,
          classifiers: []
        }
      };

      mock.onGet('https://pypi.org/pypi/unknown-package/json').reply(200, mockResponse);

      const result = await server.fetchPackageLicense('unknown-package');
      expect(result).toBeNull();
    });

    test('should handle 404 errors', async () => {
      mock.onGet('https://pypi.org/pypi/nonexistent-package/json').reply(404);

      const result = await server.fetchPackageLicense('nonexistent-package');
      expect(result).toBeNull();
    });

    test('should handle network errors', async () => {
      mock.onGet('https://pypi.org/pypi/network-error/json').networkError();

      const result = await server.fetchPackageLicense('network-error');
      expect(result).toBeNull();
    });

    test('should handle timeout errors', async () => {
      mock.onGet('https://pypi.org/pypi/timeout-package/json').timeout();

      const result = await server.fetchPackageLicense('timeout-package');
      expect(result).toBeNull();
    });

    test('should clean up license strings', async () => {
      const testCases = [
        {
          input: { license: 'License :: OSI Approved :: MIT License' },
          expected: 'MIT License'
        },
        {
          input: { license: 'License: Apache 2.0' },
          expected: 'Apache 2.0'
        },
        {
          input: { license: 'License' },
          expected: 'License'
        }
      ];

      for (const testCase of testCases) {
        const mockResponse = {
          info: {
            name: 'test-package',
            version: '1.0.0',
            ...testCase.input
          }
        };

        mock.onGet('https://pypi.org/pypi/test-package/json').reply(200, mockResponse);

        const result = await server.fetchPackageLicense('test-package');
        expect(result).toBe(testCase.expected);
      }
    });

    test('should handle long license strings', async () => {
      const longLicense = 'This is a very long license string that should be truncated because it exceeds the maximum length limit';
      const mockResponse = {
        info: {
          name: 'long-license-package',
          version: '1.0.0',
          license: longLicense
        }
      };

      mock.onGet('https://pypi.org/pypi/long-license-package/json').reply(200, mockResponse);

      const result = await server.fetchPackageLicense('long-license-package');
      expect(result).toBe('This is a very long license string that should...');
      expect(result.length).toBeLessThanOrEqual(50);
    });

    test('should normalize common license formats', async () => {
      const testCases = [
        { input: 'MIT License', expected: 'MIT' },
        { input: 'Apache License 2.0', expected: 'Apache 2.0' },
        { input: 'BSD License', expected: 'BSD' },
        { input: 'GNU General Public License', expected: 'GPL' },
        { input: 'Mozilla Public License', expected: 'MPL' }
      ];

      for (const testCase of testCases) {
        const mockResponse = {
          info: {
            name: 'test-package',
            version: '1.0.0',
            license: testCase.input
          }
        };

        mock.onGet('https://pypi.org/pypi/test-package/json').reply(200, mockResponse);

        const result = await server.fetchPackageLicense('test-package');
        expect(result).toBe(testCase.expected);
      }
    });
  });

  describe('fetchLicenseInformation', () => {
    test('should fetch licenses for multiple packages', async () => {
      const dependencies = ['requests', 'numpy', 'pandas'];

      mock.onGet('https://pypi.org/pypi/requests/json').reply(200, {
        info: { name: 'requests', license: 'Apache 2.0' }
      });
      mock.onGet('https://pypi.org/pypi/numpy/json').reply(200, {
        info: { name: 'numpy', license: 'BSD' }
      });
      mock.onGet('https://pypi.org/pypi/pandas/json').reply(200, {
        info: { name: 'pandas', license: 'BSD' }
      });

      const result = await server.fetchLicenseInformation(dependencies);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        name: 'requests',
        license: 'Apache 2.0',
        commercialUse: { status: 'free', note: '✅ Free for commercial use' }
      });
      expect(result[1]).toEqual({
        name: 'numpy',
        license: 'BSD',
        commercialUse: { status: 'free', note: '✅ Free for commercial use' }
      });
      expect(result[2]).toEqual({
        name: 'pandas',
        license: 'BSD',
        commercialUse: { status: 'free', note: '✅ Free for commercial use' }
      });
    });

    test('should handle mixed license types', async () => {
      const dependencies = ['requests', 'gpl-package', 'unknown-package'];

      mock.onGet('https://pypi.org/pypi/requests/json').reply(200, {
        info: { name: 'requests', license: 'MIT' }
      });
      mock.onGet('https://pypi.org/pypi/gpl-package/json').reply(200, {
        info: { name: 'gpl-package', license: 'GPL' }
      });
      mock.onGet('https://pypi.org/pypi/unknown-package/json').reply(404);

      const result = await server.fetchLicenseInformation(dependencies);

      expect(result).toHaveLength(3);
      expect(result[0].commercialUse.status).toBe('free');
      expect(result[1].commercialUse.status).toBe('paid');
      expect(result[2].commercialUse.status).toBe('unknown');
    });

    test('should handle batch processing with delays', async () => {
      const dependencies = Array.from({ length: 10 }, (_, i) => `package${i}`);

      // Mock all requests
      dependencies.forEach(pkg => {
        mock.onGet(`https://pypi.org/pypi/${pkg}/json`).reply(200, {
          info: { name: pkg, license: 'MIT' }
        });
      });

      const startTime = Date.now();
      const result = await server.fetchLicenseInformation(dependencies);
      const endTime = Date.now();

      expect(result).toHaveLength(10);
      // Should have some delay between batches (2 batches of 5, with 200ms delay)
      expect(endTime - startTime).toBeGreaterThan(150);
    });

    test('should handle partial failures in batch', async () => {
      const dependencies = ['success1', 'success2', 'fail1', 'success3'];

      mock.onGet('https://pypi.org/pypi/success1/json').reply(200, {
        info: { name: 'success1', license: 'MIT' }
      });
      mock.onGet('https://pypi.org/pypi/success2/json').reply(200, {
        info: { name: 'success2', license: 'Apache 2.0' }
      });
      mock.onGet('https://pypi.org/pypi/fail1/json').networkError();
      mock.onGet('https://pypi.org/pypi/success3/json').reply(200, {
        info: { name: 'success3', license: 'BSD' }
      });

      const result = await server.fetchLicenseInformation(dependencies);

      expect(result).toHaveLength(4);
      expect(result[0].commercialUse.status).toBe('free');
      expect(result[1].commercialUse.status).toBe('free');
      expect(result[2].commercialUse.status).toBe('unknown');
      expect(result[3].commercialUse.status).toBe('free');
    });

    test('should handle empty dependencies list', async () => {
      const result = await server.fetchLicenseInformation([]);
      expect(result).toEqual([]);
    });
  });
});
