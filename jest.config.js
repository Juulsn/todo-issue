module.exports = {
  clearMocks: true,
  moduleFileExtensions: ['js', 'ts'],
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  setupFiles: ['<rootDir>/tests/setupEnv.ts'],
  modulePathIgnorePatterns: ['<rootDir>/lib/'],
  moduleNameMapper: {
    '^@octokit/rest$': '<rootDir>/tests/mocks/octokit-rest.ts'
  },
  //testMatch: ['./src/*.test.+(ts|tsx|js)'],
  verbose: false
}