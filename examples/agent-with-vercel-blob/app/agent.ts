import { stepCountIs, ToolLoopAgent } from "ai";
import type { Accepts } from "aixyz/accepts";
import { fake } from "aixyz/model";

import deleteBlob from "./tools/deleteBlob";
import listBlobs from "./tools/listBlobs";
import uploadBlob from "./tools/uploadBlob";

/**
 * A fake model that points to the appropriate Vercel Blob tool call
 * based on the user's request — no API key required.
 */
export const model = fake((lastMessage) => {
  const msg = lastMessage.toLowerCase();
  if (msg.includes("upload") || msg.includes("store") || msg.includes("save")) {
    return `uploadBlob(pathname="notes/example.txt", content=<user content>)`;
  }
  if (msg.includes("list") || msg.includes("show") || msg.includes("files")) {
    return `listBlobs()`;
  }
  const urlMatch = lastMessage.match(/https?:\/\/\S+/);
  if (msg.includes("delete") || msg.includes("remove")) {
    const url = urlMatch ? urlMatch[0] : "<blob-url>";
    return `deleteBlob(url="${url}")`;
  }
  return `I can upload, list, or delete files in Vercel Blob. Try: "upload my note", "list files", or "delete a file".`;
});

export const accepts: Accepts = {
  scheme: "exact",
  price: "$0.001",
};

export default new ToolLoopAgent({
  model,
  instructions: "You are a file storage assistant that manages files using Vercel Blob storage.",
  tools: { uploadBlob, listBlobs, deleteBlob },
  stopWhen: stepCountIs(10),
});
