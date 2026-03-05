import { fake } from "aixyz/model";
import { ToolLoopAgent } from "ai";

export const accepts = {
  scheme: "free",
};

export default new ToolLoopAgent({
  model: fake((message) => {
    return message;
  }),
});
