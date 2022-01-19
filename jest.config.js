module.exports = {
  clearMocks: true,
  moduleFileExtensions: ['js', 'ts'],
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  //testMatch: ['./src/*.test.+(ts|tsx|js)'],
  verbose: true
}