# Test Suite for Py Dep Licenses MCP Server

This directory contains comprehensive test cases for the Py Dep Licenses MCP Server.

## Test Structure

### Test Files

- **`parsing.test.js`** - Unit tests for all parsing functions (requirements.txt, pyproject.toml, etc.)
- **`license-analysis.test.js`** - Tests for license analysis and commercial use categorization
- **`integration.test.js`** - Integration tests for GitHub URL parsing and dependency fetching
- **`mcp-protocol.test.js`** - Tests for MCP protocol compliance and tool registration
- **`error-handling.test.js`** - Tests for error handling scenarios (invalid URLs, network failures, etc.)
- **`e2e.test.js`** - End-to-end tests covering complete workflows
- **`test-utils.js`** - Test utilities and helper functions
- **`setup.js`** - Test setup and configuration

### Test Categories

#### 1. Unit Tests (`parsing.test.js`)
- Tests for `parseRequirementsTxt()`
- Tests for `parsePyprojectToml()`
- Tests for `parseSetupPy()`
- Tests for `parseEnvironmentYml()`
- Tests for `parsePipfile()`
- Tests for `parseUvLock()`
- Tests for `parsePoetryLock()`
- Tests for `parsePipfileLock()`
- Tests for `parseDependencies()` routing

#### 2. License Analysis Tests (`license-analysis.test.js`)
- Tests for `analyzeCommercialLicense()`
- Tests for `fetchPackageLicense()`
- Tests for `fetchLicenseInformation()`
- License categorization (free, paid, warning, unknown)
- PyPI API integration
- Batch processing and rate limiting

#### 3. Integration Tests (`integration.test.js`)
- GitHub URL parsing and validation
- Dependency file discovery and fetching
- Complete dependency analysis workflow
- Mixed license type handling
- Error scenarios and fallbacks

#### 4. MCP Protocol Tests (`mcp-protocol.test.js`)
- Server initialization and configuration
- Tool registration and schema validation
- Request/response handling
- Error handling and validation
- Protocol compliance

#### 5. Error Handling Tests (`error-handling.test.js`)
- Invalid GitHub URL handling
- Network error scenarios
- Parsing error recovery
- MCP protocol error handling
- Rate limiting and timeout handling
- Edge cases and malformed data

#### 6. End-to-End Tests (`e2e.test.js`)
- Complete workflow testing
- Real-world scenario simulation
- Performance and scalability testing
- Concurrent request handling
- All supported file format testing

## Running Tests

### Prerequisites
```bash
npm install
```

### Run All Tests
```bash
npm test
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Run Tests with Coverage
```bash
npm run test:coverage
```

### Run Specific Test Files
```bash
# Run only parsing tests
npx jest tests/parsing.test.js

# Run only integration tests
npx jest tests/integration.test.js

# Run tests matching a pattern
npx jest --testNamePattern="should parse"
```

## Test Utilities

The `test-utils.js` file provides helper functions for:

- Creating mock adapters for HTTP requests
- Mocking GitHub and PyPI API responses
- Generating test data for different file formats
- Assertion helpers for commercial use categories
- Common test setup and teardown

### Example Usage
```javascript
import { TestUtils } from './test-utils.js';

// Create mock adapter
const mock = TestUtils.createMockAdapter();

// Mock GitHub file
TestUtils.mockGitHubFile(mock, 'user', 'repo', 'requirements.txt', 'requests>=2.28.0');

// Mock PyPI package
TestUtils.mockPyPIPackage(mock, 'requests', 'MIT');

// Assert commercial use categories
TestUtils.assertCommercialUseCategories(result, { free: 1, warning: 0, paid: 0, unknown: 0 });
```

## Test Coverage

The test suite aims for comprehensive coverage of:

- **Functionality**: All public methods and functions
- **Error Handling**: All error scenarios and edge cases
- **Integration**: External API interactions
- **Protocol**: MCP protocol compliance
- **Performance**: Batch processing and scalability

### Coverage Reports

After running `npm run test:coverage`, view the coverage report:

- **Text**: Displayed in terminal
- **HTML**: Open `coverage/index.html` in browser
- **LCOV**: For CI/CD integration

## Mocking Strategy

### HTTP Requests
- **GitHub API**: Mocked using `axios-mock-adapter`
- **PyPI API**: Mocked with realistic response structures
- **Network Errors**: Simulated with various error types

### External Dependencies
- **MCP SDK**: Tested with actual SDK instances
- **YAML Parser**: Tested with real YAML content
- **Axios**: Mocked for all HTTP requests

## Test Data

### Sample Files
- Realistic dependency file content
- Various license types and formats
- Edge cases and malformed data
- Large datasets for performance testing

### Test Repositories
- Valid GitHub URLs with different formats
- Invalid URLs for error testing
- Repositories with different dependency file types

## Continuous Integration

The test suite is designed to run in CI environments:

- **Fast Execution**: Optimized for quick feedback
- **Deterministic**: No flaky tests or timing dependencies
- **Comprehensive**: Covers all critical functionality
- **Maintainable**: Clear structure and documentation

## Debugging Tests

### Verbose Output
```bash
npx jest --verbose
```

### Debug Mode
```bash
npx jest --detectOpenHandles --forceExit
```

### Single Test Debugging
```bash
npx jest --testNamePattern="specific test name" --verbose
```

## Contributing

When adding new tests:

1. **Follow Naming Conventions**: Use descriptive test names
2. **Group Related Tests**: Use `describe` blocks appropriately
3. **Use Test Utilities**: Leverage helper functions from `test-utils.js`
4. **Mock External Dependencies**: Don't make real HTTP requests
5. **Test Edge Cases**: Include error scenarios and boundary conditions
6. **Update Documentation**: Keep this README current

## Test Maintenance

### Regular Tasks
- Update test data to reflect real-world scenarios
- Add tests for new features and bug fixes
- Review and update mock responses
- Ensure test coverage remains high
- Remove obsolete tests

### Performance Monitoring
- Monitor test execution time
- Optimize slow tests
- Ensure tests scale with codebase growth
- Track coverage trends
