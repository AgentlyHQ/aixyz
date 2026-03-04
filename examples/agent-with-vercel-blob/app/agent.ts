import { openai } from "@ai-sdk/openai";
import { stepCountIs, ToolLoopAgent } from "ai";
import type { Accepts } from "aixyz/accepts";

import deleteBlob from "./tools/deleteBlob";
import listBlobs from "./tools/listBlobs";
import uploadBlob from "./tools/uploadBlob";

// language=Markdown
const instructions = `
# Vercel Blob Agent

You are a helpful file storage assistant that manages files using Vercel Blob storage.

## Capabilities

- **Upload**: Store text content as a file and receive a public URL using \`uploadBlob\`.
- **List**: Show all stored files with their URLs and metadata using \`listBlobs\`.
- **Delete**: Remove a file from storage by its URL using \`deleteBlob\`.

## Guidelines

- When uploading, choose a descriptive pathname (e.g. \`notes/my-note.txt\`, \`reports/summary.md\`).
- When listing, present results in a clear table with URL, pathname, size, and upload date.
- Before deleting, confirm the exact URL with the user if there is any ambiguity.
- Always present URLs as clickable links when sharing them.
- File content is stored as plain text — do not attempt to handle binary files.
`.trim();

export const accepts: Accepts = {
  scheme: "exact",
  price: "$0.001",
};

export default new ToolLoopAgent({
  model: openai("gpt-4o-mini"),
  instructions: instructions,
  tools: { uploadBlob, listBlobs, deleteBlob },
  stopWhen: stepCountIs(10),
});
