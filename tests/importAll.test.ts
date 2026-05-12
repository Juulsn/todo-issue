import {importEverything} from "../src/AllImporter";
import {argumentContext} from "../src/ArgumentContext";
import * as cp from "child_process";
import * as fs from "fs";

// Mock child_process to allow safe assertions without redefining properties
jest.mock('child_process', () => ({
  execSync: jest.fn().mockReturnValue("")
}));

// Mock fs to control file reads without spying on built-ins
jest.mock('fs', () => ({
  readFileSync: jest.fn().mockReturnValue("")
}));

// Helper to set keywords and sensitivity per test
function configureContext(keywords: string[], caseSensitive: boolean) {
  // mutate the exported object so AllImporter reads updated values
  (argumentContext as any).keywords = keywords;
  (argumentContext as any).caseSensitive = caseSensitive;
}

describe("AllImporter.importEverything", () => {
  const originalWorkspace = process.env.GITHUB_WORKSPACE;

  afterEach(() => {
    jest.restoreAllMocks();
    process.env.GITHUB_WORKSPACE = originalWorkspace;
  });

  it("adds -i when caseSensitive=false and quotes the keyword", () => {
    configureContext(["TODO+BUG"], false);

    (cp.execSync as unknown as jest.Mock).mockReturnValue("fileA.txt\n");
    (fs.readFileSync as unknown as jest.Mock).mockReturnValue("line1\nline2\n");

    const files = importEverything();

    expect((cp.execSync as unknown as jest.Mock)).toHaveBeenCalledTimes(1);
    const cmd = ((cp.execSync as unknown as jest.Mock).mock.calls[0][0] as string);
    expect(cmd).toContain("git grep -i -I -l -F");
    expect(cmd).toContain(" -- 'TODO+BUG'");
    expect(files.length).toBe(1);
    expect(files[0].to).toBe("fileA.txt");
  });

  it("does not add -i when caseSensitive=true", () => {
    configureContext(["todo"], true);

    (cp.execSync as unknown as jest.Mock).mockReturnValue("one.txt\n");
    (fs.readFileSync as unknown as jest.Mock).mockReturnValue("content\n");

    importEverything();

    const cmd = ((cp.execSync as unknown as jest.Mock).mock.calls[0][0] as string);
    expect(cmd).toContain("git grep -I -l -F");
    expect(cmd).not.toContain(" -i ");
  });

  it("deduplicates paths across multiple keywords", () => {
    configureContext(["TODO", "FIXME"], false);

    const mock = (cp.execSync as unknown as jest.Mock);
    mock
      .mockReturnValueOnce("a.txt\nb.txt\n")
      .mockReturnValueOnce("b.txt\nc.txt\n");

    jest.spyOn(fs, "readFileSync").mockImplementation((p: any) => {
      return `content for ${p}`;
    });

    const files = importEverything();

    expect(mock).toHaveBeenCalledTimes(2);
    expect(files.map(f => f.to).sort()).toEqual(["a.txt", "b.txt", "c.txt"]);
  });

  it("falls back to process.cwd() when GITHUB_WORKSPACE is unset", () => {
    delete process.env.GITHUB_WORKSPACE;
    configureContext(["TODO"], true);

    (cp.execSync as unknown as jest.Mock).mockReturnValue(Buffer.from("x.txt\n"));
    jest.spyOn(fs, "readFileSync").mockReturnValue("x\n");

    importEverything();

    const cmd = ((cp.execSync as unknown as jest.Mock).mock.calls[0][0] as string);
    expect(cmd.startsWith(`cd ${process.cwd()} && git grep`)).toBe(true);
  });
});
