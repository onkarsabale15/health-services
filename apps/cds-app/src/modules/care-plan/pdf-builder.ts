import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb, type Color } from 'pdf-lib';

/**
 * Reusable PDF builder using pdf-lib (zero native deps, no fontkit/SWC issues).
 * Provides composable rendering primitives for clinical documents.
 */

// ── Colors ──────────────────────────────────────────────────

const COLORS = {
  brand: rgb(0, 0.204, 0.369), // #00345E
  white: rgb(1, 1, 1),
  critical: rgb(0.863, 0.149, 0.149), // #DC2626
  warning: rgb(0.851, 0.467, 0.024), // #D97706
  info: rgb(0.145, 0.388, 0.922), // #2563EB
  text: rgb(0.122, 0.161, 0.216), // #1F2937
  secondary: rgb(0.42, 0.451, 0.498), // #6B7280
  border: rgb(0.82, 0.835, 0.855), // #D1D5DB
  amberBg: rgb(0.996, 0.953, 0.78), // #FEF3C7
  amberBorder: rgb(0.961, 0.62, 0.043), // #F59E0B
  amberTitle: rgb(0.573, 0.251, 0.055), // #92400E
  amberText: rgb(0.471, 0.208, 0.059), // #78350F
};

const SEVERITY_CONFIG: Record<string, { label: string; color: Color }> = {
  critical: { label: 'CRITICAL', color: COLORS.critical },
  warning: { label: 'WARNING', color: COLORS.warning },
  info: { label: 'INFO', color: COLORS.info },
};

const CATEGORY_LABELS: Record<string, string> = {
  'pcp-suggestion': 'PCP Suggestion',
  'allergy-caution': 'Allergy Caution',
  'drug-interaction': 'Drug Interaction',
  'missing-screening': 'Missing Screening',
  'care-gap': 'Care Gap',
  'patient-safety': 'Patient Safety',
};

// ── Page Context ────────────────────────────────────────────

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

interface DrawContext {
  doc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  boldFont: PDFFont;
  y: number; // current Y position (top-down, but pdf-lib is bottom-up)
}

function cursorY(ctx: DrawContext): number {
  // Convert top-down cursor to pdf-lib bottom-up coordinate
  return PAGE_HEIGHT - ctx.y;
}

function ensureSpace(ctx: DrawContext, needed: number): void {
  if (ctx.y + needed > PAGE_HEIGHT - MARGIN) {
    ctx.page = ctx.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    ctx.y = MARGIN;
  }
}

// ── Text Helpers ────────────────────────────────────────────

function drawText(
  ctx: DrawContext,
  text: string,
  x: number,
  opts: { size?: number; color?: Color; font?: PDFFont; maxWidth?: number },
): void {
  const size = opts.size ?? 10;
  const font = opts.font ?? ctx.font;
  const color = opts.color ?? COLORS.text;
  const maxWidth = opts.maxWidth ?? CONTENT_WIDTH;

  // Simple word-wrap
  const lines = wrapText(text, font, size, maxWidth);
  for (const line of lines) {
    ensureSpace(ctx, size + 4);
    ctx.page.drawText(line, { x, y: cursorY(ctx), size, font, color });
    ctx.y += size + 4;
  }
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    const width = font.widthOfTextAtSize(test, size);
    if (width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

// ── Composable Renderers ────────────────────────────────────

export function renderBrandedHeader(ctx: DrawContext, subtitle: string): void {
  // Blue header bar
  ctx.page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 80,
    width: PAGE_WIDTH,
    height: 80,
    color: COLORS.brand,
  });

  ctx.page.drawText('HEALTH SERVICES', {
    x: MARGIN,
    y: PAGE_HEIGHT - 38,
    size: 20,
    font: ctx.boldFont,
    color: COLORS.white,
  });
  ctx.page.drawText(subtitle, {
    x: MARGIN,
    y: PAGE_HEIGHT - 58,
    size: 11,
    font: ctx.font,
    color: COLORS.white,
  });

  ctx.y = 95;
}

export function renderSectionTitle(ctx: DrawContext, title: string): void {
  ensureSpace(ctx, 22);
  ctx.page.drawText(title, {
    x: MARGIN,
    y: cursorY(ctx),
    size: 10,
    font: ctx.boldFont,
    color: COLORS.brand,
  });
  ctx.y += 18;
}

export function renderDivider(ctx: DrawContext): void {
  ensureSpace(ctx, 8);
  ctx.page.drawLine({
    start: { x: MARGIN, y: cursorY(ctx) },
    end: { x: PAGE_WIDTH - MARGIN, y: cursorY(ctx) },
    thickness: 0.5,
    color: COLORS.border,
  });
  ctx.y += 8;
}

export function renderKeyValueGrid(ctx: DrawContext, fields: [string, string][]): void {
  const leftX = MARGIN;
  const rightX = 300;

  for (let i = 0; i < fields.length; i++) {
    const [label, value] = fields[i];
    const x = i % 2 === 0 ? leftX : rightX;

    ensureSpace(ctx, 28);
    ctx.page.drawText(label.toUpperCase(), {
      x,
      y: cursorY(ctx),
      size: 8,
      font: ctx.font,
      color: COLORS.secondary,
    });
    ctx.page.drawText(value || '—', {
      x,
      y: cursorY(ctx) - 12,
      size: 10,
      font: ctx.font,
      color: COLORS.text,
    });

    if (i % 2 === 1 || i === fields.length - 1) ctx.y += 30;
  }
}

export function renderCalloutBox(ctx: DrawContext, title: string, content: string): void {
  const lines = wrapText(content, ctx.font, 10, CONTENT_WIDTH - 30);
  const boxHeight = 30 + lines.length * 14;

  ensureSpace(ctx, boxHeight + 10);

  // Background
  ctx.page.drawRectangle({
    x: MARGIN,
    y: cursorY(ctx) - boxHeight + 14,
    width: CONTENT_WIDTH,
    height: boxHeight,
    color: COLORS.amberBg,
    borderColor: COLORS.amberBorder,
    borderWidth: 1,
  });

  // Title
  ctx.page.drawText(title, {
    x: MARGIN + 10,
    y: cursorY(ctx),
    size: 8,
    font: ctx.boldFont,
    color: COLORS.amberTitle,
  });
  ctx.y += 16;

  // Content
  for (const line of lines) {
    ctx.page.drawText(`"${line}"`, {
      x: MARGIN + 10,
      y: cursorY(ctx),
      size: 10,
      font: ctx.font,
      color: COLORS.amberText,
    });
    ctx.y += 14;
  }
  ctx.y += 10;
}

export function renderCdsCards(ctx: DrawContext, cards: any[]): void {
  const sorted = [...cards].sort((a, b) => {
    const order: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    return (order[a.severity] ?? 2) - (order[b.severity] ?? 2);
  });

  renderSectionTitle(ctx, 'CLINICAL RECOMMENDATIONS');
  ctx.y += 4;

  const groups: Record<string, any[]> = { critical: [], warning: [], info: [] };
  for (const card of sorted) {
    (groups[card.severity || 'info'] ??= []).push(card);
  }

  for (const severity of ['critical', 'warning', 'info'] as const) {
    const group = groups[severity];
    if (!group || group.length === 0) continue;

    const sevInfo = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.info;

    ensureSpace(ctx, 24);
    ctx.page.drawText(`— ${sevInfo.label} (${group.length}) —`, {
      x: MARGIN,
      y: cursorY(ctx),
      size: 10,
      font: ctx.boldFont,
      color: sevInfo.color,
    });
    ctx.y += 18;

    for (const card of group) {
      renderSingleCard(ctx, card, sevInfo.color);
    }
  }
}

function renderSingleCard(ctx: DrawContext, card: any, color: Color): void {
  ensureSpace(ctx, 50);

  // Color indicator bar
  ctx.page.drawRectangle({
    x: MARGIN,
    y: cursorY(ctx) - 12,
    width: 3,
    height: 14,
    color,
  });

  // Category
  const categoryLabel = CATEGORY_LABELS[card.category] || card.category;
  ctx.page.drawText(categoryLabel, {
    x: MARGIN + 10,
    y: cursorY(ctx),
    size: 8,
    font: ctx.font,
    color: COLORS.secondary,
  });
  ctx.y += 14;

  // Summary (bold)
  drawText(ctx, card.summary || '', MARGIN + 10, {
    size: 10,
    font: ctx.boldFont,
    color: COLORS.text,
    maxWidth: CONTENT_WIDTH - 10,
  });
  ctx.y += 2;

  // Detail
  if (card.detail) {
    drawText(ctx, card.detail, MARGIN + 10, {
      size: 9,
      color: COLORS.secondary,
      maxWidth: CONTENT_WIDTH - 10,
    });
    ctx.y += 2;
  }

  // Suggestions
  const suggestions: string[] = card.suggestions || [];
  if (suggestions.length > 0) {
    ensureSpace(ctx, 14);
    ctx.page.drawText('Suggestions:', {
      x: MARGIN + 10,
      y: cursorY(ctx),
      size: 8,
      font: ctx.font,
      color: COLORS.secondary,
    });
    ctx.y += 12;

    for (let i = 0; i < suggestions.length; i++) {
      drawText(ctx, `${i + 1}. ${suggestions[i]}`, MARGIN + 20, {
        size: 9,
        color: COLORS.text,
        maxWidth: CONTENT_WIDTH - 20,
      });
    }
  }

  ctx.y += 8;
}

export function renderDisclaimer(ctx: DrawContext, documentId: string): void {
  ensureSpace(ctx, 60);
  renderDivider(ctx);

  drawText(
    ctx,
    [
      'DISCLAIMER: This report was generated by Health Services Clinical Decision Support and is intended as a clinical aid only.',
      'All recommendations should be reviewed by a qualified healthcare provider before clinical action.',
      'This document does not constitute medical advice.',
    ].join(' '),
    MARGIN,
    { size: 7, color: COLORS.secondary },
  );

  ctx.y += 4;
  drawText(ctx, `Generated: ${new Date().toISOString()}`, MARGIN, { size: 7, color: COLORS.secondary });
  drawText(ctx, `Document ID: ${documentId}`, MARGIN, { size: 7, color: COLORS.secondary });
}

// ── Document Factory ──────────────────────────────────────────

export type PdfBuilderContext = DrawContext;

/**
 * Creates a PDF document with standard fonts and returns a context for composable rendering.
 * Call `finalize()` on the result to get the PDF bytes.
 */
export async function createPdfContext(): Promise<{
  ctx: PdfBuilderContext;
  finalize: () => Promise<Uint8Array>;
}> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  const ctx: PdfBuilderContext = { doc, page, font, boldFont, y: MARGIN };

  return {
    ctx,
    finalize: () => doc.save(),
  };
}
