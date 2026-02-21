function safeJsonParse(v, fallback) {
  if (!v) return fallback;
  if (typeof v !== "string") return fallback;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
}

/**
 * filterColumn bisa berupa:
 * - JSON array: [{ id: "Code", value: "BU-001" }, { id:"Active", value:true }]
 * - JSON object: { Code:"BU-001", Active:true }
 */
function parseFilters(filterColumn) {
  const parsed = safeJsonParse(filterColumn, null);
  if (!parsed) return [];

  if (Array.isArray(parsed)) {
    return parsed
      .filter((x) => x && typeof x === "object" && x.id)
      .map((x) => ({ id: String(x.id), value: x.value }));
  }

  if (typeof parsed === "object") {
    return Object.entries(parsed).map(([id, value]) => ({ id, value }));
  }

  return [];
}

/**
 * orderBy bisa berupa:
 * - JSON array: [{ id: "Code", desc: false }]
 * - JSON object: { id:"Code", desc:false }
 */
function parseOrder(orderBy) {
  const parsed = safeJsonParse(orderBy, null);
  if (!parsed) return [];

  if (Array.isArray(parsed)) {
    return parsed
      .filter((x) => x && typeof x === "object" && x.id)
      .map((x) => ({ id: String(x.id), desc: !!x.desc }));
  }

  if (typeof parsed === "object" && parsed.id) {
    return [{ id: String(parsed.id), desc: !!parsed.desc }];
  }

  return [];
}

module.exports = { safeJsonParse, parseFilters, parseOrder };
