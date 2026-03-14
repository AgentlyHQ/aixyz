import { AutoModelForCausalLM, AutoTokenizer } from "@huggingface/transformers";

console.log("Prewarming local LLM model (onnx-community/Qwen2.5-1.5B-Instruct)...");

await Promise.all([
  AutoTokenizer.from_pretrained("onnx-community/Qwen2.5-1.5B-Instruct"),
  AutoModelForCausalLM.from_pretrained("onnx-community/Qwen2.5-1.5B-Instruct", { dtype: "q4" }),
]);

console.log("Model prewarmed and cached successfully.");
