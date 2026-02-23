const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const INTERVAL = 80;

export interface Spinner {
  pause(): void;
  stop(finalMessage?: string): void;
}

export function startSpinner(message: string): Spinner {
  if (!process.stderr.isTTY) {
    process.stderr.write(`${message}\n`);
    return { pause() {}, stop() {} };
  }

  let i = 0;
  let timer: ReturnType<typeof setInterval> | null = setInterval(() => {
    process.stderr.write(`\r${FRAMES[i++ % FRAMES.length]} ${message}`);
  }, INTERVAL);

  return {
    pause() {
      if (timer) {
        clearInterval(timer);
        timer = null;
        process.stderr.write(`\r\x1b[2K`);
      }
    },
    stop(finalMessage?: string) {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      process.stderr.write(`\r\x1b[2K`);
      if (finalMessage) {
        process.stderr.write(`${finalMessage}\n`);
      }
    },
  };
}
