import { env, AutoModelForCausalLM, AutoTokenizer } from "@huggingface/transformers";

const MODEL = "HuggingFaceTB/SmolLM2-360M-Instruct";
const CACHE_DIR = "/app/.cache/transformers";

env.cacheDir = CACHE_DIR;
const TIMEOUT_MS = 300_000; // 5 minutes

const timeout = setTimeout(() => {
  console.error("ERROR: Model prewarm timed out after 5 minutes");
  process.exit(1);
}, TIMEOUT_MS);

console.log(`Prewarming model: ${MODEL}`);

const [tokenizer, model] = await Promise.all([
  AutoTokenizer.from_pretrained(MODEL),
  AutoModelForCausalLM.from_pretrained(MODEL, { dtype: "fp32" }),
]);

// Validate: run a tiny inference to prove the cache is usable
console.log("Validating model with test inference...");
const inputs = tokenizer("Hello", { return_tensors: "pt" });
const output = await model.generate({ ...inputs, max_new_tokens: 4 });
const sequences = output as unknown as bigint[][];
const decoded = tokenizer.decode(sequences[0], { skip_special_tokens: true });
console.log(`Validation output: "${decoded}"`);

if (!decoded || decoded.length === 0) {
  console.error("ERROR: Model validation failed - empty output");
  process.exit(1);
}

clearTimeout(timeout);
console.log("Model prewarmed and validated successfully.");
