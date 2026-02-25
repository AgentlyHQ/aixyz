export function handleAction(
  action: (options: Record<string, unknown>) => Promise<void>,
): (options: Record<string, unknown>) => Promise<void> {
  return async (options) => {
    try {
      await action(options);
    } catch (error) {
      if (error instanceof Error && error.name === "ExitPromptError") {
        process.exit(130);
      }
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  };
}
