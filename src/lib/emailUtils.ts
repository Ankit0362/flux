interface ExtractedBodies {
  text: string;
  html: string;
}

/**
 * Extracts and decodes plain-text and HTML bodies from a nested Gmail message part.
 */
export function extractBodies(part: any): ExtractedBodies {
  let text = "";
  let html = "";

  if (part.body?.data) {
    try {
      const decoded = Buffer.from(part.body.data, "base64").toString("utf-8");
      if (part.mimeType === "text/plain") {
        text = decoded;
      } else if (part.mimeType === "text/html") {
        html = decoded;
      }
    } catch (err) {
      console.error("Error decoding body part:", err);
    }
  }

  if (part.parts && part.parts.length > 0) {
    for (const subPart of part.parts) {
      const subBodies = extractBodies(subPart);
      if (subBodies.text) {
        text = text ? text + "\n" + subBodies.text : subBodies.text;
      }
      if (subBodies.html) {
        html = html ? html + "\n" + subBodies.html : subBodies.html;
      }
    }
  }

  return { text, html };
}

/**
 * Parses raw header arrays to extract values by case-insensitive name.
 */
export function getHeader(
  headers: Array<{ name?: string; value?: string }> | undefined,
  name: string
): string | undefined {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value;
}

/**
 * Parses a standard sender header (e.g. "Jane Doe <jane@example.com>") into
 * clean name and email address.
 */
export function parseEmailAddress(raw: string): { name: string; email: string } {
  const cleanRaw = raw.trim();
  const match = cleanRaw.match(/^(?:"?([^"<]*)"?\s)?(?:<(.+)>)$/);
  if (match) {
    return {
      name: (match[1] || "").trim(),
      email: match[2].trim().toLowerCase(),
    };
  }
  return {
    name: "",
    email: cleanRaw.toLowerCase(),
  };
}
