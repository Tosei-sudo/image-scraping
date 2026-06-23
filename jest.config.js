module.exports = {
    testEnvironment: 'jest-environment-jsdom',
    transform: { '^.+\\.js$': 'babel-jest' },
    setupFiles: ['<rootDir>/src/__tests__/setup.js'],
    setupFilesAfterEnv: ['<rootDir>/src/__tests__/setupAfterEnv.js'],
    testMatch: ['<rootDir>/src/__tests__/**/*.test.js'],
};
