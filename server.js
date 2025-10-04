#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import { parse as parseYaml } from 'yaml';

class PyDepLicensesMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'py-dep-licenses-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
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
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (name === 'list_dependencies') {
        const { github_url } = args;
        
        if (!github_url || typeof github_url !== 'string') {
          throw new Error('GitHub URL is required and must be a string');
        }

        try {
          const dependencies = await this.getPythonDependencies(github_url);
          return {
            content: [
              {
                type: 'text',
                text: dependencies,
              },
            ],
          };
        } catch (error) {
          throw new Error(`Failed to get dependencies: ${error.message}`);
        }
      }

      throw new Error(`Unknown tool: ${name}`);
    });
  }

  async getPythonDependencies(githubUrl) {
    try {
      // Parse GitHub URL to get owner and repo
      const urlMatch = githubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (!urlMatch) {
        throw new Error('Invalid GitHub URL format');
      }
      
      const [, owner, repo] = urlMatch;
      const repoName = repo.replace(/\.git$/, ''); // Remove .git suffix if present
      
      console.error(`Fetching dependencies for ${owner}/${repoName}`);
      
      // Try to find dependency files in order of preference
      const dependencyFiles = [
        'requirements.txt',
        'pyproject.toml',
        'uv.lock',
        'poetry.lock',
        'Pipfile.lock',
        'setup.py',
        'environment.yml',
        'Pipfile'
      ];
      
      let dependencies = [];
      let foundFile = null;
      
      for (const fileName of dependencyFiles) {
        try {
          const fileUrl = `https://raw.githubusercontent.com/${owner}/${repoName}/main/${fileName}`;
          console.error(`Trying ${fileName}...`);
          
          const response = await axios.get(fileUrl, {
            timeout: 10000,
            headers: {
              'Accept': 'application/vnd.github.v3.raw'
            }
          });
          
          if (response.status === 200 && response.data) {
            foundFile = fileName;
            dependencies = this.parseDependencies(response.data, fileName);
            break;
          }
        } catch (error) {
          // Try master branch if main doesn't work
          if (error.response?.status === 404) {
            try {
              const fileUrl = `https://raw.githubusercontent.com/${owner}/${repoName}/master/${fileName}`;
              console.error(`Trying ${fileName} on master branch...`);
              
              const response = await axios.get(fileUrl, {
                timeout: 10000,
                headers: {
                  'Accept': 'application/vnd.github.v3.raw'
                }
              });
              
              if (response.status === 200 && response.data) {
                foundFile = fileName;
                dependencies = this.parseDependencies(response.data, fileName);
                break;
              }
            } catch (masterError) {
              console.error(`File ${fileName} not found on master either`);
            }
          }
        }
      }
      
      if (!foundFile) {
        return `❌ No dependency files found in repository ${owner}/${repoName}.\n\nSearched for: ${dependencyFiles.join(', ')}`;
      }
      
      if (dependencies.length === 0) {
        return `📦 Found ${foundFile} in ${owner}/${repoName} but no dependencies were parsed.`;
      }
      
      // Fetch license information for each dependency
      console.error(`Fetching license information for ${dependencies.length} dependencies...`);
      const dependenciesWithLicenses = await this.fetchLicenseInformation(dependencies);
      
      let result = `📦 **Dependencies for ${owner}/${repoName}** (from ${foundFile}):\n\n`;
      
      // Categorize dependencies by commercial use status
      const freeCommercial = dependenciesWithLicenses.filter(dep => dep.commercialUse.status === 'free');
      const paidCommercial = dependenciesWithLicenses.filter(dep => dep.commercialUse.status === 'paid');
      const warningCommercial = dependenciesWithLicenses.filter(dep => dep.commercialUse.status === 'warning');
      const unknownCommercial = dependenciesWithLicenses.filter(dep => dep.commercialUse.status === 'unknown');
      
      // Show free commercial use dependencies first
      if (freeCommercial.length > 0) {
        result += `## ✅ FREE for Commercial Use (${freeCommercial.length})\n\n`;
        freeCommercial.forEach((dep, index) => {
          result += `${index + 1}. **${dep.name}** (${dep.license}) - ${dep.commercialUse.note}\n`;
        });
        result += `\n`;
      }
      
      // Show warning/complex licenses
      if (warningCommercial.length > 0) {
        result += `## ⚠️ WARNING - Check Commercial Use (${warningCommercial.length})\n\n`;
        warningCommercial.forEach((dep, index) => {
          result += `${index + 1}. **${dep.name}** (${dep.license}) - ${dep.commercialUse.note}\n`;
        });
        result += `\n`;
      }
      
      // Show paid commercial use dependencies
      if (paidCommercial.length > 0) {
        result += `## 💰 PAYMENT REQUIRED for Commercial Use (${paidCommercial.length})\n\n`;
        paidCommercial.forEach((dep, index) => {
          result += `${index + 1}. **${dep.name}** (${dep.license}) - ${dep.commercialUse.note}\n`;
        });
        result += `\n`;
      }
      
      // Show unknown licenses
      if (unknownCommercial.length > 0) {
        result += `## ❓ UNKNOWN Commercial Use Status (${unknownCommercial.length})\n\n`;
        unknownCommercial.forEach((dep, index) => {
          result += `${index + 1}. **${dep.name}** (${dep.license || 'License unknown'}) - ${dep.commercialUse.note}\n`;
        });
        result += `\n`;
      }
      
      // Add summary
      result += `## 📊 Commercial Use Summary\n`;
      result += `- ✅ Free for commercial use: **${freeCommercial.length}** packages\n`;
      result += `- ⚠️ Check commercial restrictions: **${warningCommercial.length}** packages\n`;
      result += `- 💰 Payment required: **${paidCommercial.length}** packages\n`;
      result += `- ❓ Unknown status: **${unknownCommercial.length}** packages\n`;
      
      if (paidCommercial.length > 0) {
        result += `\n⚠️ **IMPORTANT**: ${paidCommercial.length} package(s) may require payment for commercial use. Review licensing terms carefully!\n`;
      }
      
      return result;
      
    } catch (error) {
      throw new Error(`Error fetching dependencies: ${error.message}`);
    }
  }
  
  parseDependencies(content, fileName) {
    const dependencies = [];
    
    try {
      switch (fileName) {
        case 'requirements.txt':
          return this.parseRequirementsTxt(content);
        case 'pyproject.toml':
          return this.parsePyprojectToml(content);
        case 'uv.lock':
          return this.parseUvLock(content);
        case 'poetry.lock':
          return this.parsePoetryLock(content);
        case 'Pipfile.lock':
          return this.parsePipfileLock(content);
        case 'setup.py':
          return this.parseSetupPy(content);
        case 'environment.yml':
          return this.parseEnvironmentYml(content);
        case 'Pipfile':
          return this.parsePipfile(content);
        default:
          return [];
      }
    } catch (error) {
      console.error(`Error parsing ${fileName}:`, error.message);
      return [];
    }
  }
  
  parseRequirementsTxt(content) {
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#') && !line.startsWith('-'))
      .map(line => line.split('==')[0].split('>=')[0].split('<=')[0].split('>')[0].split('<')[0].split('~')[0].trim())
      .filter(dep => dep);
  }
  
  parsePyprojectToml(content) {
    try {
      const lines = content.split('\n');
      const dependencies = [];
      let inDependenciesSection = false;
      let inOptionalDependencies = false;
      let currentSection = '';
      
      for (const line of lines) {
        const trimmed = line.trim();
        
        // Check for various dependency sections
        if (trimmed === '[project.dependencies]' || 
            trimmed === '[tool.poetry.dependencies]' ||
            trimmed === '[build-system.requires]' ||
            trimmed === '[tool.setuptools.dependencies]' ||
            trimmed === '[dependency-groups]') {
          inDependenciesSection = true;
          currentSection = trimmed;
          continue;
        }
        
        // Check for project section (modern format) - but we need to wait for dependencies array
        if (trimmed === '[project]') {
          currentSection = trimmed;
          continue;
        }
        
        // Check for optional dependencies
        if (trimmed.startsWith('[project.optional-dependencies.') ||
            trimmed.startsWith('[tool.poetry.group.') ||
            trimmed.startsWith('[tool.poetry.extras.')) {
          inDependenciesSection = true;
          inOptionalDependencies = true;
          currentSection = trimmed;
          continue;
        }
        
        // Handle dependencies array format (modern project section) - check this BEFORE the inDependenciesSection check
        if (trimmed.startsWith('dependencies = [')) {
          // Multi-line array - continue until we find the closing bracket
          inDependenciesSection = true;
          continue;
        }
        
        // Handle dependency-groups dev dependencies
        if (trimmed.startsWith('dev = [')) {
          inDependenciesSection = true;
          continue;
        }
        
        // Also handle when we're in [project] section and see dependencies
        if (currentSection === '[project]' && trimmed.startsWith('dependencies = [')) {
          inDependenciesSection = true;
          continue;
        }
        
        // Handle when we see dependencies line directly (not in a specific section)
        if (trimmed.startsWith('dependencies = [')) {
          inDependenciesSection = true;
          continue;
        }

        if (inDependenciesSection) {
          // Check if we've moved to a new section
          if (trimmed.startsWith('[') && trimmed !== currentSection) {
            inDependenciesSection = false;
            inOptionalDependencies = false;
            continue;
          }
          
          // Skip comments and empty lines
          if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) {
            continue;
          }
          
          // Handle individual dependency lines in array format
          if ((trimmed.startsWith('"') && (trimmed.endsWith(',') || trimmed.endsWith('"'))) || 
              (trimmed.startsWith("'") && (trimmed.endsWith(',') || trimmed.endsWith("'")))) {
            const match = trimmed.match(/^["']([^"']+)["']/);
            if (match) {
              const dep = match[1];
              // Only process if it looks like a package dependency (contains version constraints or is a valid package name)
              if (dep.includes('>=') || dep.includes('<=') || dep.includes('==') || dep.includes('~') || 
                  /^[a-zA-Z0-9_-]+$/.test(dep)) {
                const cleanDep = dep
                  .split('==')[0]
                  .split('>=')[0]
                  .split('<=')[0]
                  .split('>')[0]
                  .split('<')[0]
                  .split('~')[0]
                  .split('^')[0]
                  .split('*')[0]
                  .split('!')[0]
                  .replace(/[{}]/g, '')
                  .trim();
                
                if (cleanDep && cleanDep !== 'python' && !cleanDep.startsWith('#') && 
                    cleanDep !== 'name' && cleanDep !== 'version' && cleanDep !== 'description' &&
                    cleanDep !== 'authors' && cleanDep !== 'readme' && cleanDep !== 'license') {
                  dependencies.push(cleanDep);
                }
              }
            }
            continue;
          }
          
          // Stop parsing when we hit a closing bracket, but allow for multiple dependency sections
          if (trimmed === ']') {
            inDependenciesSection = false;
            // Don't break here - continue to look for more dependency sections
            continue;
          }
          
          // Handle different dependency formats (legacy)
          let dep = '';
          
          // Format: "package>=1.0.0" or 'package>=1.0.0'
          if (trimmed.includes('"') || trimmed.includes("'")) {
            const match = trimmed.match(/["']([^"']+)["']/);
            if (match) {
              dep = match[1];
            }
          }
          // Format: package = ">=1.0.0" or package = {version = ">=1.0.0"}
          else if (trimmed.includes('=') && !trimmed.includes('==')) {
            const match = trimmed.match(/^([^=\s]+)\s*=/);
            if (match) {
              dep = match[1].trim();
            }
          }
          // Format: package>=1.0.0 (direct format)
          else if (trimmed.match(/^[a-zA-Z0-9_-]+/)) {
            dep = trimmed;
          }
          
          if (dep) {
            // Clean up version constraints and extract package name
            const cleanDep = dep
              .split('==')[0]
              .split('>=')[0]
              .split('<=')[0]
              .split('>')[0]
              .split('<')[0]
              .split('~')[0]
              .split('^')[0]
              .split('*')[0]
              .split('!')[0]
              .replace(/[{}]/g, '')
              .trim();
            
            if (cleanDep && cleanDep !== 'python' && !cleanDep.startsWith('#')) {
              dependencies.push(cleanDep);
            }
          }
        }
      }
      
      // Remove duplicates and filter out build system requirements
      const uniqueDeps = [...new Set(dependencies)].filter(dep => 
        dep && 
        dep !== 'python' && 
        dep !== 'setuptools' && 
        dep !== 'wheel' &&
        dep !== 'build' &&
        dep !== 'pip'
      );
      
      return uniqueDeps;
    } catch (error) {
      console.error('Error parsing pyproject.toml:', error.message);
      return [];
    }
  }
  
  parseSetupPy(content) {
    const dependencies = [];
    const installRequiresMatch = content.match(/install_requires\s*=\s*\[([\s\S]*?)\]/);
    
    if (installRequiresMatch) {
      const depsContent = installRequiresMatch[1];
      const depMatches = depsContent.match(/"([^"]+)"/g);
      
      if (depMatches) {
        depMatches.forEach(match => {
          const dep = match.replace(/"/g, '').split('==')[0].split('>=')[0].split('<=')[0].split('>')[0].split('<')[0].trim();
          if (dep) dependencies.push(dep);
        });
      }
    }
    
    return dependencies;
  }
  
  parseEnvironmentYml(content) {
    try {
      const yamlData = parseYaml(content);
      const dependencies = [];
      
      if (yamlData.dependencies) {
        yamlData.dependencies.forEach(dep => {
          if (typeof dep === 'string' && dep !== 'python') {
            dependencies.push(dep.split('=')[0].split('>=')[0].split('<=')[0].split('>')[0].split('<')[0].trim());
          }
        });
      }
      
      return dependencies;
    } catch (error) {
      return [];
    }
  }
  
  parsePipfile(content) {
    const dependencies = [];
    const lines = content.split('\n');
    let inPackagesSection = false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed === '[packages]') {
        inPackagesSection = true;
        continue;
      }
      
      if (inPackagesSection) {
        if (trimmed.startsWith('[')) {
          break;
        }
        
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const packageName = trimmed.split('=')[0].trim().replace(/"/g, '').replace(/'/g, '');
          if (packageName) {
            dependencies.push(packageName);
          }
        }
      }
    }
    
    return dependencies;
  }

  parseUvLock(content) {
    try {
      // uv.lock is a TOML file with package information
      const dependencies = [];
      const lines = content.split('\n');
      let inPackageSection = false;
      
      for (const line of lines) {
        const trimmed = line.trim();
        
        // Look for package sections
        if (trimmed.startsWith('[[package]]')) {
          inPackageSection = true;
          continue;
        }
        
        if (inPackageSection) {
          // If we hit another section, stop
          if (trimmed.startsWith('[') && !trimmed.startsWith('[[')) {
            inPackageSection = false;
            continue;
          }
          
          // Look for name field
          if (trimmed.startsWith('name =')) {
            const match = trimmed.match(/name\s*=\s*["']([^"']+)["']/);
            if (match) {
              const packageName = match[1];
              // Skip Python itself and build tools
              if (packageName !== 'python' && 
                  packageName !== 'pip' && 
                  packageName !== 'setuptools' && 
                  packageName !== 'wheel' &&
                  packageName !== 'build') {
                dependencies.push(packageName);
              }
            }
          }
        }
      }
      
      return [...new Set(dependencies)];
    } catch (error) {
      console.error('Error parsing uv.lock:', error.message);
      return [];
    }
  }

  parsePoetryLock(content) {
    try {
      // poetry.lock is a TOML file
      const dependencies = [];
      const lines = content.split('\n');
      let inPackageSection = false;
      
      for (const line of lines) {
        const trimmed = line.trim();
        
        if (trimmed.startsWith('[[package]]')) {
          inPackageSection = true;
          continue;
        }
        
        if (inPackageSection) {
          if (trimmed.startsWith('[') && !trimmed.startsWith('[[')) {
            inPackageSection = false;
            continue;
          }
          
          if (trimmed.startsWith('name =')) {
            const match = trimmed.match(/name\s*=\s*["']([^"']+)["']/);
            if (match) {
              const packageName = match[1];
              if (packageName !== 'python' && packageName !== 'pip') {
                dependencies.push(packageName);
              }
            }
          }
        }
      }
      
      return [...new Set(dependencies)];
    } catch (error) {
      console.error('Error parsing poetry.lock:', error.message);
      return [];
    }
  }

  parsePipfileLock(content) {
    try {
      // Pipfile.lock is a JSON file
      const lockData = JSON.parse(content);
      const dependencies = [];
      
      if (lockData.default) {
        Object.keys(lockData.default).forEach(packageName => {
          if (packageName !== 'python') {
            dependencies.push(packageName);
          }
        });
      }
      
      return dependencies;
    } catch (error) {
      console.error('Error parsing Pipfile.lock:', error.message);
      return [];
    }
  }

  async fetchLicenseInformation(dependencies) {
    const dependenciesWithLicenses = [];
    
    // Process dependencies in batches to avoid overwhelming PyPI
    const batchSize = 5;
    for (let i = 0; i < dependencies.length; i += batchSize) {
      const batch = dependencies.slice(i, i + batchSize);
      const batchPromises = batch.map(depName => this.fetchPackageLicense(depName));
      
      try {
        const batchResults = await Promise.allSettled(batchPromises);
        batchResults.forEach((result, index) => {
          const depName = batch[index];
          if (result.status === 'fulfilled') {
            const licenseInfo = result.value;
            const commercialAnalysis = this.analyzeCommercialLicense(licenseInfo);
            dependenciesWithLicenses.push({
              name: depName,
              license: licenseInfo,
              commercialUse: commercialAnalysis
            });
          } else {
            console.error(`Failed to fetch license for ${depName}:`, result.reason);
            dependenciesWithLicenses.push({
              name: depName,
              license: null,
              commercialUse: { status: 'unknown', note: 'License information unavailable' }
            });
          }
        });
      } catch (error) {
        console.error('Batch processing error:', error);
        // Fallback: add dependencies without license info
        batch.forEach(depName => {
          dependenciesWithLicenses.push({
            name: depName,
            license: null,
            commercialUse: { status: 'unknown', note: 'License information unavailable' }
          });
        });
      }
      
      // Small delay between batches to be respectful to PyPI
      if (i + batchSize < dependencies.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    return dependenciesWithLicenses;
  }
  
  analyzeCommercialLicense(license) {
    if (!license) {
      return { status: 'unknown', note: 'License information unavailable' };
    }
    
    const licenseLower = license.toLowerCase();
    
    // Licenses that are FREE for commercial use
    const freeCommercialLicenses = {
      'mit': { status: 'free', note: '✅ Free for commercial use' },
      'apache': { status: 'free', note: '✅ Free for commercial use' },
      'apache 2.0': { status: 'free', note: '✅ Free for commercial use' },
      'apache-2.0': { status: 'free', note: '✅ Free for commercial use' },
      'bsd': { status: 'free', note: '✅ Free for commercial use' },
      'bsd-3-clause': { status: 'free', note: '✅ Free for commercial use' },
      'bsd-2-clause': { status: 'free', note: '✅ Free for commercial use' },
      'isc': { status: 'free', note: '✅ Free for commercial use' },
      'mpl': { status: 'free', note: '✅ Free for commercial use' },
      'mozilla public license': { status: 'free', note: '✅ Free for commercial use' },
      'unlicense': { status: 'free', note: '✅ Free for commercial use' },
      'cc0': { status: 'free', note: '✅ Free for commercial use' },
      'zlib': { status: 'free', note: '✅ Free for commercial use' },
      'osi approved': { status: 'free', note: '✅ Free for commercial use (OSI Approved)' }
    };
    
    // Licenses that REQUIRE PAYMENT for commercial use
    const paidCommercialLicenses = {
      'gpl': { status: 'paid', note: '⚠️ GPL - May require payment for commercial use' },
      'gplv2': { status: 'paid', note: '⚠️ GPL v2 - May require payment for commercial use' },
      'gplv3': { status: 'paid', note: '⚠️ GPL v3 - May require payment for commercial use' },
      'gpl-2.0': { status: 'paid', note: '⚠️ GPL v2 - May require payment for commercial use' },
      'gpl-3.0': { status: 'paid', note: '⚠️ GPL v3 - May require payment for commercial use' },
      'agpl': { status: 'paid', note: '⚠️ AGPL - May require payment for commercial use' },
      'agplv3': { status: 'paid', note: '⚠️ AGPL v3 - May require payment for commercial use' },
      'copyleft': { status: 'paid', note: '⚠️ Copyleft license - May require payment for commercial use' },
      'commercial': { status: 'paid', note: '💰 Commercial license - Payment required' },
      'proprietary': { status: 'paid', note: '💰 Proprietary license - Payment required' },
      'trial': { status: 'paid', note: '💰 Trial license - Payment required for production' },
      'evaluation': { status: 'paid', note: '💰 Evaluation license - Payment required for production' }
    };
    
    // Check for exact matches first
    if (freeCommercialLicenses[licenseLower]) {
      return freeCommercialLicenses[licenseLower];
    }
    
    if (paidCommercialLicenses[licenseLower]) {
      return paidCommercialLicenses[licenseLower];
    }
    
    // Check for partial matches
    for (const [key, value] of Object.entries(freeCommercialLicenses)) {
      if (licenseLower.includes(key)) {
        return value;
      }
    }
    
    for (const [key, value] of Object.entries(paidCommercialLicenses)) {
      if (licenseLower.includes(key)) {
        return value;
      }
    }
    
    // Special cases and warnings
    if (licenseLower.includes('gnu')) {
      return { status: 'warning', note: '⚠️ GNU license - Check commercial use restrictions' };
    }
    
    if (licenseLower.includes('copyleft')) {
      return { status: 'warning', note: '⚠️ Copyleft license - Check commercial use restrictions' };
    }
    
    if (licenseLower.includes('commercial') || licenseLower.includes('proprietary')) {
      return { status: 'paid', note: '💰 Commercial/Proprietary license - Payment likely required' };
    }
    
    // Default case - assume free but with warning
    return { status: 'unknown', note: '❓ Unknown license - Verify commercial use terms' };
  }

  async fetchPackageLicense(packageName) {
    try {
      // Use PyPI's JSON API
      const response = await axios.get(`https://pypi.org/pypi/${packageName}/json`, {
        timeout: 5000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'MCP-Dependencies-Tool/1.0.0'
        }
      });
      
      if (response.status === 200 && response.data) {
        const packageInfo = response.data.info;
        
        // Try to get license from multiple possible fields
        let license = packageInfo.license || 
                     packageInfo.license_text || 
                     packageInfo.classifiers?.find(c => c.startsWith('License :: '))?.split(':: ')[1] ||
                     null;
        
        // Clean up license information
        if (license) {
          // Remove common prefixes/suffixes
          license = license
            .replace(/^License :: /, '')
            .replace(/^License: /, '')
            .replace(/^License/, '')
            .trim();
          
          // Handle some common license formats
          if (license.includes('MIT License')) license = 'MIT';
          if (license.includes('Apache License')) license = 'Apache 2.0';
          if (license.includes('BSD License')) license = 'BSD';
          if (license.includes('GNU General Public License')) license = 'GPL';
          if (license.includes('Mozilla Public License')) license = 'MPL';
          
          // Limit license string length
          if (license.length > 50) {
            license = license.substring(0, 47) + '...';
          }
        }
        
        return license;
      }
      
      return null;
    } catch (error) {
      if (error.response?.status === 404) {
        console.error(`Package ${packageName} not found on PyPI`);
      } else {
        console.error(`Error fetching license for ${packageName}:`, error.message);
      }
      return null;
    }
  }

  setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Py Dep Licenses MCP Server running on stdio');
  }
}

// Start the server
const server = new PyDepLicensesMCPServer();
server.run().catch(console.error);

