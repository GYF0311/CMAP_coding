export class CmapCommandError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode = 1) {
    super(message);
    this.name = "CmapCommandError";
    this.exitCode = exitCode;
  }
}
