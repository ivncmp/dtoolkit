export class LineBuffer {
  private buffer = '';

  push(chunk: string): string[] {
    this.buffer += chunk;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop()!;
    return lines.filter((l) => l.trim());
  }

  flush(): string | undefined {
    const remaining = this.buffer.trim();
    this.buffer = '';
    return remaining || undefined;
  }
}
