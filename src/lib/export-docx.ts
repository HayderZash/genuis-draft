import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, convertMillimetersToTwip } from 'docx';
import { saveAs } from 'file-saver';
import type { ProjectData } from '@/pages/ProjectEditor';
import type { Lang } from '@/i18n/translations';

function htmlToDocxParagraphs(html: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const nodes = doc.body.firstElementChild?.childNodes;
  if (!nodes) return paragraphs;

  nodes.forEach((node) => {
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
    } else {
      // Handle <p> and everything else
      const runs: TextRun[] = [];
      const processNode = (n: Node) => {
        if (n.nodeType === Node.TEXT_NODE) {
          const t = n.textContent || '';
          if (t) runs.push(new TextRun({ text: t, font: 'Times New Roman', size: 28 }));
        } else {
          const childEl = n as HTMLElement;
          const childTag = childEl.tagName?.toLowerCase();
          const childText = childEl.textContent || '';
          if (childTag === 'strong' || childTag === 'b') {
            runs.push(new TextRun({ text: childText, font: 'Times New Roman', size: 28, bold: true }));
          } else if (childTag === 'em' || childTag === 'i') {
            runs.push(new TextRun({ text: childText, font: 'Times New Roman', size: 28, italics: true }));
          } else if (childTag === 'u') {
            runs.push(new TextRun({ text: childText, font: 'Times New Roman', size: 28, underline: {} }));
          } else {
            childEl.childNodes.forEach(processNode);
          }
        }
      };
      el.childNodes.forEach(processNode);
      if (runs.length > 0) {
        paragraphs.push(new Paragraph({
          children: runs,
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 200, line: 360 },
        }));
      }
    }
  });

  return paragraphs;
}

export function exportToDocx(project: ProjectData, uiLang: Lang) {
  let fullHtml = '';
  project.chapters.forEach((_, i) => {
    fullHtml += project.content[`chapter_${i}`] || '';
  });
  if (project.content['references']) {
    fullHtml += project.content['references'];
  }
  // Use _full if available (edited by user)
  if (project.content['_full']) {
    fullHtml = project.content['_full'];
  }

  const paragraphs = htmlToDocxParagraphs(fullHtml);

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

  Packer.toBlob(doc).then((blob) => {
    saveAs(blob, `${project.title || 'research'}.docx`);
  });
}
