import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, convertMillimetersToTwip, ImageRun, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, PageBreak, TableOfContents } from 'docx';
import { saveAs } from 'file-saver';
import type { ProjectData } from '@/pages/ProjectEditor';
import type { Lang } from '@/i18n/translations';

async function fetchImageAsBuffer(url: string): Promise<{ buffer: ArrayBuffer; type: 'png' | 'jpg' | 'gif' | 'bmp' } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || '';
    let type: 'png' | 'jpg' | 'gif' | 'bmp' = 'png';
    if (contentType.includes('jpeg') || contentType.includes('jpg') || url.includes('.jpg') || url.includes('.jpeg')) {
      type = 'jpg';
    }
    return { buffer, type };
  } catch (e) {
    console.error('[export-docx] Failed to fetch image:', url, e);
    return null;
  }
}

const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: '000000' };
const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

function parseHtmlTable(tableEl: HTMLTableElement): Table {
  const rows: TableRow[] = [];
  const allRows = tableEl.querySelectorAll('tr');
  
  // Determine column count from first row
  const firstRow = allRows[0];
  const colCount = firstRow ? firstRow.querySelectorAll('th, td').length : 2;
  const colWidth = Math.floor(9360 / Math.max(colCount, 1));
  
  allRows.forEach((tr, rowIdx) => {
    const cells: TableCell[] = [];
    const cellElements = tr.querySelectorAll('th, td');
    const isHeader = rowIdx === 0 || tr.closest('thead') !== null || cellElements[0]?.tagName === 'TH';
    
    cellElements.forEach((cell) => {
      const text = cell.textContent?.trim() || '';
      cells.push(new TableCell({
        borders: cellBorders,
        width: { size: colWidth, type: WidthType.DXA },
        shading: isHeader ? { fill: 'D5E8F0', type: ShadingType.CLEAR } : undefined,
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
        children: [new Paragraph({
          children: [new TextRun({
            text,
            font: 'Times New Roman',
            size: 22,
            bold: isHeader,
          })],
          alignment: AlignmentType.CENTER,
        })],
      }));
    });
    
    if (cells.length > 0) {
      rows.push(new TableRow({ children: cells }));
    }
  });

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: Array(colCount).fill(colWidth),
    rows,
  });
}

async function htmlToDocxParagraphs(html: string): Promise<Paragraph[]> {
  const paragraphs: Paragraph[] = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const nodes = doc.body.firstElementChild?.childNodes;
  if (!nodes) return paragraphs;

  // Collect all image URLs for parallel fetching
  const imageUrls: string[] = [];
  const collectImages = (node: Node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    if (el.tagName?.toLowerCase() === 'img') {
      const src = el.getAttribute('src');
      if (src && src.startsWith('http')) imageUrls.push(src);
    }
    el.childNodes.forEach(collectImages);
  };
  nodes.forEach(collectImages);

  const imageCache = new Map<string, { buffer: ArrayBuffer; type: 'png' | 'jpg' | 'gif' | 'bmp' }>();
  const results = await Promise.all(imageUrls.map(async (url) => {
    const result = await fetchImageAsBuffer(url);
    return { url, result };
  }));
  results.forEach(({ url, result }) => {
    if (result) imageCache.set(url, result);
  });

  // We need to return mixed content (paragraphs + tables), so we'll use a wrapper
  const docxElements: (Paragraph | Table)[] = [];

  const processElement = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) {
        docxElements.push(new Paragraph({
          children: [new TextRun({ text, font: 'Times New Roman', size: 28 })],
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 200, line: 360 },
        }));
      }
      return;
    }

    const el = node as HTMLElement;
    const tag = el.tagName?.toLowerCase();
    const text = el.textContent?.trim() || '';

    if (tag === 'img') {
      const src = el.getAttribute('src') || '';
      const alt = el.getAttribute('alt') || '';
      const imgData = imageCache.get(src);
      if (imgData) {
        docxElements.push(new Paragraph({
          children: [new ImageRun({
            type: imgData.type,
            data: imgData.buffer,
            transformation: { width: 450, height: 300 },
            altText: { title: alt, description: alt, name: alt || 'figure' },
          })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 100 },
        }));
      }
      return;
    }

    if (tag === 'div') {
      el.childNodes.forEach(processElement);
      return;
    }

    // Handle real HTML tables
    if (tag === 'table') {
      try {
        const table = parseHtmlTable(el as HTMLTableElement);
        docxElements.push(table);
        docxElements.push(new Paragraph({ spacing: { after: 200 } })); // spacing after table
      } catch (e) {
        console.error('[export-docx] Table parse error:', e);
        // Fallback: dump as text
        if (text) {
          docxElements.push(new Paragraph({
            children: [new TextRun({ text, font: 'Times New Roman', size: 28 })],
            spacing: { after: 200 },
          }));
        }
      }
      return;
    }

    if (!text) return;

    if (tag === 'h1') {
      docxElements.push(new Paragraph({
        children: [new TextRun({ text, font: 'Times New Roman', size: 44, bold: true })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 200 },
        heading: HeadingLevel.HEADING_1,
      }));
    } else if (tag === 'h2') {
      docxElements.push(new Paragraph({
        children: [new TextRun({ text, font: 'Times New Roman', size: 36, bold: true })],
        spacing: { before: 300, after: 200 },
        heading: HeadingLevel.HEADING_2,
      }));
    } else if (tag === 'h3') {
      docxElements.push(new Paragraph({
        children: [new TextRun({ text, font: 'Times New Roman', size: 32, bold: true, underline: {} })],
        spacing: { before: 200, after: 150 },
        heading: HeadingLevel.HEADING_3,
      }));
    } else {
      const isFigureCaption = el.classList?.contains('figure-caption') ||
        /\[Figure\s+[\d.]+:/.test(text) ||
        /\[شكل\s+[\d.]+:/.test(text);

      const runs: TextRun[] = [];
      const processNode = (n: Node) => {
        if (n.nodeType === Node.TEXT_NODE) {
          const t = n.textContent || '';
          if (t) runs.push(new TextRun({
            text: t,
            font: 'Times New Roman',
            size: isFigureCaption ? 24 : 28,
            italics: isFigureCaption,
          }));
        } else {
          const childEl = n as HTMLElement;
          const childTag = childEl.tagName?.toLowerCase();
          const childText = childEl.textContent || '';
          if (childTag === 'img') {
            const src = childEl.getAttribute('src') || '';
            const alt = childEl.getAttribute('alt') || '';
            const imgData = imageCache.get(src);
            if (imgData) {
              if (runs.length > 0) {
                docxElements.push(new Paragraph({
                  children: [...runs],
                  alignment: isFigureCaption ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
                  spacing: { after: 200, line: 360 },
                }));
                runs.length = 0;
              }
              docxElements.push(new Paragraph({
                children: [new ImageRun({
                  type: imgData.type,
                  data: imgData.buffer,
                  transformation: { width: 450, height: 300 },
                  altText: { title: alt, description: alt, name: alt || 'figure' },
                })],
                alignment: AlignmentType.CENTER,
                spacing: { before: 200, after: 100 },
              }));
            }
            return;
          } else if (childTag === 'strong' || childTag === 'b') {
            runs.push(new TextRun({ text: childText, font: 'Times New Roman', size: isFigureCaption ? 24 : 28, bold: true, italics: isFigureCaption }));
          } else if (childTag === 'em' || childTag === 'i') {
            runs.push(new TextRun({ text: childText, font: 'Times New Roman', size: isFigureCaption ? 24 : 28, italics: true }));
          } else if (childTag === 'u') {
            runs.push(new TextRun({ text: childText, font: 'Times New Roman', size: isFigureCaption ? 24 : 28, underline: {} }));
          } else if (childTag === 'table') {
            // Handle inline table within a paragraph context
            if (runs.length > 0) {
              docxElements.push(new Paragraph({
                children: [...runs],
                alignment: AlignmentType.JUSTIFIED,
                spacing: { after: 200, line: 360 },
              }));
              runs.length = 0;
            }
            try {
              docxElements.push(parseHtmlTable(childEl as HTMLTableElement));
              docxElements.push(new Paragraph({ spacing: { after: 200 } }));
            } catch {}
          } else {
            childEl.childNodes.forEach(processNode);
          }
        }
      };
      el.childNodes.forEach(processNode);
      if (runs.length > 0) {
        docxElements.push(new Paragraph({
          children: runs,
          alignment: isFigureCaption ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
          spacing: { after: 200, line: 360 },
        }));
      }
    }
  };

  nodes.forEach(processElement);
  return docxElements as any[];
}

/** Extract figures list from content */
function extractFigures(html: string, isAr: boolean): string[] {
  const regex = /\[Figure\s+([\d.]+):\s*([^\]]+)\]/gi;
  const matches = [...html.matchAll(regex)];
  return matches.map(m => `${isAr ? 'شكل' : 'Figure'} ${m[1]}: ${m[2].trim()}`);
}

/** Extract tables list from content */
function extractTables(html: string, isAr: boolean): string[] {
  const regex = /<strong>\s*((?:Table|جدول)\s+[\d.]+:\s*[^<]+)<\/strong>/gi;
  const matches = [...html.matchAll(regex)];
  return matches.map(m => m[1].trim());
}

/** Extract abbreviations from content */
function extractAbbreviations(html: string): { abbr: string; full: string }[] {
  // Match patterns like "ESP32", "OLED", "TDS", "IoT", etc.
  const abbrRegex = /\b([A-Z]{2,}[A-Za-z0-9]*)\b/g;
  const found = new Map<string, string>();
  const text = html.replace(/<[^>]+>/g, ' ');
  const matches = [...text.matchAll(abbrRegex)];
  
  for (const m of matches) {
    const abbr = m[1];
    if (abbr.length >= 2 && abbr.length <= 10 && !found.has(abbr)) {
      // Try to find expansion nearby: "Full Name (ABBR)" pattern
      const expandRegex = new RegExp(`([A-Za-z\\u0600-\\u06FF][A-Za-z\\s\\u0600-\\u06FF]{3,})\\s*\\(${abbr}\\)`, 'i');
      const expandMatch = text.match(expandRegex);
      found.set(abbr, expandMatch ? expandMatch[1].trim() : abbr);
    }
  }

  return Array.from(found.entries())
    .map(([abbr, full]) => ({ abbr, full }))
    .sort((a, b) => a.abbr.localeCompare(b.abbr));
}

function buildFrontMatter(project: ProjectData, fullHtml: string, isAr: boolean): (Paragraph | Table)[] {
  const items: (Paragraph | Table)[] = [];

  // Table of Contents
  if (project.include_toc) {
    items.push(new Paragraph({
      children: [new TextRun({ text: isAr ? 'جدول المحتويات' : 'Table of Contents', font: 'Times New Roman', size: 44, bold: true })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 400, after: 300 },
      heading: HeadingLevel.HEADING_1,
    }));
    items.push(new TableOfContents(isAr ? 'جدول المحتويات' : 'Table of Contents', {
      hyperlink: true,
      headingStyleRange: '1-3',
    }));
    items.push(new Paragraph({ children: [new PageBreak()] }));
  }

  // List of Figures
  if (project.include_list_of_figures) {
    const figures = extractFigures(fullHtml, isAr);
    items.push(new Paragraph({
      children: [new TextRun({ text: isAr ? 'قائمة الأشكال' : 'List of Figures', font: 'Times New Roman', size: 44, bold: true })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 400, after: 300 },
    }));
    if (figures.length > 0) {
      const figRows = figures.map((fig) => 
        new TableRow({
          children: [
            new TableCell({
              borders: cellBorders,
              width: { size: 2000, type: WidthType.DXA },
              margins: { top: 60, bottom: 60, left: 100, right: 100 },
              children: [new Paragraph({
                children: [new TextRun({ text: fig.split(':')[0]?.trim() || '', font: 'Times New Roman', size: 24, bold: true })],
                alignment: AlignmentType.CENTER,
              })],
            }),
            new TableCell({
              borders: cellBorders,
              width: { size: 7360, type: WidthType.DXA },
              margins: { top: 60, bottom: 60, left: 100, right: 100 },
              children: [new Paragraph({
                children: [new TextRun({ text: fig.split(':').slice(1).join(':').trim() || '', font: 'Times New Roman', size: 24 })],
              })],
            }),
          ],
        })
      );
      items.push(new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [2000, 7360],
        rows: [
          new TableRow({
            children: [
              new TableCell({
                borders: cellBorders,
                width: { size: 2000, type: WidthType.DXA },
                shading: { fill: 'D5E8F0', type: ShadingType.CLEAR },
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
                children: [new Paragraph({
                  children: [new TextRun({ text: isAr ? 'رقم الشكل' : 'Figure #', font: 'Times New Roman', size: 24, bold: true })],
                  alignment: AlignmentType.CENTER,
                })],
              }),
              new TableCell({
                borders: cellBorders,
                width: { size: 7360, type: WidthType.DXA },
                shading: { fill: 'D5E8F0', type: ShadingType.CLEAR },
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
                children: [new Paragraph({
                  children: [new TextRun({ text: isAr ? 'الوصف' : 'Description', font: 'Times New Roman', size: 24, bold: true })],
                  alignment: AlignmentType.CENTER,
                })],
              }),
            ],
          }),
          ...figRows,
        ],
      }));
    } else {
      items.push(new Paragraph({
        children: [new TextRun({ text: isAr ? 'لا توجد أشكال' : 'No figures found', font: 'Times New Roman', size: 24, italics: true })],
      }));
    }
    items.push(new Paragraph({ children: [new PageBreak()] }));
  }

  // List of Tables
  if (project.include_list_of_tables) {
    const tables = extractTables(fullHtml, isAr);
    items.push(new Paragraph({
      children: [new TextRun({ text: isAr ? 'قائمة الجداول' : 'List of Tables', font: 'Times New Roman', size: 44, bold: true })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 400, after: 300 },
    }));
    if (tables.length > 0) {
      tables.forEach((tbl) => {
        items.push(new Paragraph({
          children: [new TextRun({ text: tbl, font: 'Times New Roman', size: 24 })],
          spacing: { after: 100 },
        }));
      });
    } else {
      items.push(new Paragraph({
        children: [new TextRun({ text: isAr ? 'لا توجد جداول' : 'No tables found', font: 'Times New Roman', size: 24, italics: true })],
      }));
    }
    items.push(new Paragraph({ children: [new PageBreak()] }));
  }

  // List of Abbreviations
  if (project.include_abbreviations) {
    const abbreviations = extractAbbreviations(fullHtml);
    items.push(new Paragraph({
      children: [new TextRun({ text: isAr ? 'قائمة الاختصارات' : 'List of Abbreviations', font: 'Times New Roman', size: 44, bold: true })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 400, after: 300 },
    }));
    if (abbreviations.length > 0) {
      const abbrRows = abbreviations.map(({ abbr, full }) => 
        new TableRow({
          children: [
            new TableCell({
              borders: cellBorders,
              width: { size: 3000, type: WidthType.DXA },
              margins: { top: 60, bottom: 60, left: 100, right: 100 },
              children: [new Paragraph({
                children: [new TextRun({ text: abbr, font: 'Times New Roman', size: 24, bold: true })],
              })],
            }),
            new TableCell({
              borders: cellBorders,
              width: { size: 6360, type: WidthType.DXA },
              margins: { top: 60, bottom: 60, left: 100, right: 100 },
              children: [new Paragraph({
                children: [new TextRun({ text: full, font: 'Times New Roman', size: 24 })],
              })],
            }),
          ],
        })
      );
      items.push(new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [3000, 6360],
        rows: [
          new TableRow({
            children: [
              new TableCell({
                borders: cellBorders,
                width: { size: 3000, type: WidthType.DXA },
                shading: { fill: 'D5E8F0', type: ShadingType.CLEAR },
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
                children: [new Paragraph({
                  children: [new TextRun({ text: isAr ? 'الاختصار' : 'Abbreviation', font: 'Times New Roman', size: 24, bold: true })],
                  alignment: AlignmentType.CENTER,
                })],
              }),
              new TableCell({
                borders: cellBorders,
                width: { size: 6360, type: WidthType.DXA },
                shading: { fill: 'D5E8F0', type: ShadingType.CLEAR },
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
                children: [new Paragraph({
                  children: [new TextRun({ text: isAr ? 'المعنى' : 'Full Form', font: 'Times New Roman', size: 24, bold: true })],
                  alignment: AlignmentType.CENTER,
                })],
              }),
            ],
          }),
          ...abbrRows,
        ],
      }));
    } else {
      items.push(new Paragraph({
        children: [new TextRun({ text: isAr ? 'لا توجد اختصارات' : 'No abbreviations found', font: 'Times New Roman', size: 24, italics: true })],
      }));
    }
    items.push(new Paragraph({ children: [new PageBreak()] }));
  }

  return items;
}

export async function exportToDocx(project: ProjectData, uiLang: Lang) {
  let fullHtml = '';
  if (project.content['abstract']) {
    fullHtml += project.content['abstract'];
  }
  project.chapters.forEach((_, i) => {
    fullHtml += project.content[`chapter_${i}`] || '';
  });
  if (project.content['references']) {
    fullHtml += project.content['references'];
  }
  if (project.content['_full']) {
    fullHtml = project.content['_full'];
  }

  const isAr = project.research_language === 'ar';
  const frontMatter = buildFrontMatter(project, fullHtml, isAr);
  const bodyContent = await htmlToDocxParagraphs(fullHtml);

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Times New Roman', size: 28 },
        },
      },
      paragraphStyles: [
        {
          id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 44, bold: true, font: 'Times New Roman' },
          paragraph: { spacing: { before: 400, after: 200 }, outlineLevel: 0 },
        },
        {
          id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 36, bold: true, font: 'Times New Roman' },
          paragraph: { spacing: { before: 300, after: 200 }, outlineLevel: 1 },
        },
        {
          id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 32, bold: true, font: 'Times New Roman' },
          paragraph: { spacing: { before: 200, after: 150 }, outlineLevel: 2 },
        },
      ],
    },
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertMillimetersToTwip(project.margin_top * 10),
            bottom: convertMillimetersToTwip(project.margin_bottom * 10),
            left: convertMillimetersToTwip(project.margin_left * 10),
            right: convertMillimetersToTwip(project.margin_right * 10),
          },
        },
      },
      children: [...frontMatter, ...bodyContent] as any[],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${project.title || 'research'}.docx`);
}