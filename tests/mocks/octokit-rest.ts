// Jest stub for ESM-only package '@octokit/rest'
// Provides a minimal CommonJS-compatible mock to prevent syntax errors during tests.
export class Octokit {
  constructor(..._args: any[]) {}
  issues: any = {
    create: jest.fn(async () => ({ data: { number: 1 } })),
    listForRepo: jest.fn(async () => ({ data: [] })),
    createLabel: jest.fn(async () => ({})),
  };
  rateLimit: any = {
    get: jest.fn(async () => ({ data: { resources: { core: { remaining: 5000 } } } })),
  };
  repos: any = {
    compareCommitsWithBasehead: jest.fn(async () => ({ data: '' })),
  };
}
