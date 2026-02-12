import { describe, expect, test } from "bun:test";
import { escapeHtml, safeJsonEmbed, buildHtml } from "./browser";

describe("escapeHtml", () => {
  test("escapes ampersand", () => {
    expect(escapeHtml("a&b")).toBe("a&amp;b");
  });

  test("escapes less-than", () => {
    expect(escapeHtml("a<b")).toBe("a&lt;b");
  });

  test("escapes greater-than", () => {
    expect(escapeHtml("a>b")).toBe("a&gt;b");
  });

  test("escapes double quote", () => {
    expect(escapeHtml('a"b')).toBe("a&quot;b");
  });

  test("escapes single quote", () => {
    expect(escapeHtml("a'b")).toBe("a&#039;b");
  });

  test("escapes combined XSS string", () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
  });

  test("returns empty string unchanged", () => {
    expect(escapeHtml("")).toBe("");
  });

  test("returns plain string unchanged", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
  });
});

describe("safeJsonEmbed", () => {
  test("escapes </script> in strings", () => {
    const result = safeJsonEmbed("</script>");
    expect(result).not.toContain("<");
    expect(result).toContain("\\u003c");
  });

  test("encodes a simple string", () => {
    expect(safeJsonEmbed("hello")).toBe('"hello"');
  });

  test("encodes an object", () => {
    const result = safeJsonEmbed({ key: "value" });
    expect(JSON.parse(result)).toEqual({ key: "value" });
  });

  test("escapes strings containing <", () => {
    const result = safeJsonEmbed("a < b");
    expect(result).not.toContain("<");
    expect(result).toContain("\\u003c");
  });
});

describe("buildHtml", () => {
  const baseParams = {
    registryAddress: "0x1234567890abcdef1234567890abcdef12345678",
    calldata: "0xdeadbeef",
    chainId: 11155111,
    chainName: "sepolia",
    nonce: "test-nonce-123",
  };

  test("returns valid HTML document", () => {
    const html = buildHtml(baseParams);
    expect(html).toStartWith("<!DOCTYPE html>");
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
  });

  test("embeds chain name and ID", () => {
    const html = buildHtml(baseParams);
    expect(html).toContain("sepolia");
    expect(html).toContain("11155111");
  });

  test("embeds registry address", () => {
    const html = buildHtml(baseParams);
    expect(html).toContain(baseParams.registryAddress);
  });

  test("embeds nonce in result endpoint", () => {
    const html = buildHtml(baseParams);
    expect(html).toContain("test-nonce-123");
  });

  test("displays URI when provided", () => {
    const html = buildHtml({ ...baseParams, uri: "https://example.com/agent" });
    expect(html).toContain("https://example.com/agent");
  });

  test("escapes user-provided values in HTML", () => {
    const html = buildHtml({
      ...baseParams,
      chainName: '<script>alert("xss")</script>',
    });
    expect(html).not.toContain('<script>alert("xss")</script>');
    expect(html).toContain("&lt;script&gt;");
  });
});
