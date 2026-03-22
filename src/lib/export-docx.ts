import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, convertMillimetersToTwip, ImageRun } from 'docx';
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

async function htmlToDocxParagraphs(html: string): Promise<Paragraph[]> {
  const paragraphs: Paragraph[] = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const nodes = doc.body.firstElementChild?.childNodes;
  if (!nodes) return paragraphs;

  // Collect all image URLs first for parallel fetching
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

  // Fetch all images in parallel
  const imageCache = new Map<string, { buffer: ArrayBuffer; type: 'png' | 'jpg' | 'gif' | 'bmp' }>();
  const results = await Promise.all(imageUrls.map(async (url) => {
    const result = await fetchImageAsBuffer(url);
    return { url, result };
  }));
  results.forEach(({ url, result }) => {
    if (result) imageCache.set(url, result);
  });

  const processElement = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) {
        paragraphs.push(new Paragraph({
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

    // Handle img tags - embed actual image
    if (tag === 'img') {
      const src = el.getAttribute('src') || '';
      const alt = el.getAttribute('alt') || '';
      const imgData = imageCache.get(src);
      
      if (imgData) {
        paragraphs.push(new Paragraph({
          children: [
            new ImageRun({
              type: imgData.type,
              data: imgData.buffer,
              transformation: { width: 450, height: 300 },
              altText: { title: alt, description: alt, name: alt || 'figure' },
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 100 },
        }));
      } else if (alt) {
        paragraphs.push(new Paragraph({
          children: [new TextRun({ text: `[${alt}]`, font: 'Times New Roman', size: 24, italics: true, color: '666666' })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 200 },
        }));
      }
      return;
    }

    // Handle div containers (like generated-figure) - process children
    if (tag === 'div') {
      el.childNodes.forEach(processElement);
      return;
    }

    if (!text) return;

    if (tag === 'h1') {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text, font: 'Times New Roman', size: 44, bold: true })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 200 },
        heading: HeadingLevel.HEADING_1,
      }));
    } else if (tag === 'h2') {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text, font: 'Times New Roman', size: 36, bold: true })],
        spacing: { before: 300, after: 200 },
        heading: HeadingLevel.HEADING_2,
      }));
    } else if (tag === 'h3') {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text, font: 'Times New Roman', size: 32, bold: true, underline: {} })],
        spacing: { before: 200, after: 150 },
        heading: HeadingLevel.HEADING_3,
      }));
    } else if (tag === 'table') {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: `[${text}]`, font: 'Times New Roman', size: 28 })],
        spacing: { after: 200 },
      }));
    } else {
      // Handle <p> - check if it's a figure caption
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
            // Process inline images
            const src = childEl.getAttribute('src') || '';
            const alt = childEl.getAttribute('alt') || '';
            const imgData = imageCache.get(src);
            if (imgData) {
              // Flush current runs as a paragraph first
              if (runs.length > 0) {
                paragraphs.push(new Paragraph({
                  children: [...runs],
                  alignment: isFigureCaption ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
                  spacing: { after: 200, line: 360 },
                }));
                runs.length = 0;
              }
              paragraphs.push(new Paragraph({
                children: [
                  new ImageRun({
                    type: imgData.type,
                    data: imgData.buffer,
                    transformation: { width: 450, height: 300 },
                    altText: { title: alt, description: alt, name: alt || 'figure' },
                  }),
                ],
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
          } else {
            childEl.childNodes.forEach(processNode);
          }
        }
      };
      el.childNodes.forEach(processNode);
      if (runs.length > 0) {
        paragraphs.push(new Paragraph({
          children: runs,
          alignment: isFigureCaption ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
          spacing: { after: 200, line: 360 },
        }));
      }
    }
  };

  nodes.forEach(processElement);
  return paragraphs;
}

export async function exportToDocx(project: ProjectData, uiLang: Lang) {
  let fullHtml = '';
  project.chapters.forEach((_, i) => {
    fullHtml += project.content[`chapter_${i}`] || '';
  });
  if (project.content['references']) {
    fullHtml += project.content['references'];
  }
  if (project.content['_full']) {
    fullHtml = project.content['_full'];
  }

  const paragraphs = await htmlToDocxParagraphs(fullHtml);

  const doc = new Document({
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
      children: paragraphs,
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${project.title || 'research'}.docx`);
}
