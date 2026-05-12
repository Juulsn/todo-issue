// Lightweight Jest mock for GitHubContext used in tests.
// Avoid importing ESM-only packages here to keep Jest (CJS) happy.

export const getUsername = jest.fn(() => "TestUser");

// In production this returns a unified diff string from GitHub.
// For tests we don't need a real API call — return an empty diff by default.
export const getDiffFile = jest.fn(async () => {
  return "" as any;
});