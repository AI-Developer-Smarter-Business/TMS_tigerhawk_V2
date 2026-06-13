import nextJest from "next/jest.js"

const createJestConfig = nextJest({
  dir: "./",
})

/** @type {import("jest").Config} */
const config = {
  clearMocks: true,
  coverageProvider: "v8",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  setupFilesAfterEnv: ["<rootDir>/setupTests.ts"],
  testEnvironment: "jsdom",
  testMatch: ["**/*.test.ts", "**/*.test.tsx"],
}

export default createJestConfig(config)
