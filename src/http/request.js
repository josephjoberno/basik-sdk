"use strict";

// ─── HTTP Client (zero dependencies) ─────────────────────────────────────────

/**
 * Minimal fetch wrapper.
 * @param {string} url
 * @param {RequestInit & { timeout?: number }} options
 * @returns {Promise<{ status: number, data: * }>}
 */
async function request(url, options = {}) {
  const { timeout = 30_000, ...fetchOptions } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });

    let data;
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      data = await res.json();
    } else {
      data = await res.text();
    }

    return { status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = request;
