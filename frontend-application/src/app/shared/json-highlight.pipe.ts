import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({ name: 'jsonHighlight', standalone: true })
export class JsonHighlightPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(value: unknown): SafeHtml {
    if (value == null) return this.sanitizer.bypassSecurityTrustHtml('');

    const json = JSON.stringify(value, null, 2);

    // HTML-escape before injecting into innerHTML
    const escaped = json
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const html = escaped.replace(
      /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        if (/^"/.test(match)) {
          return /:$/.test(match)
            ? `<span class="jh-key">${match}</span>`
            : `<span class="jh-string">${match}</span>`;
        }
        if (/true|false/.test(match)) return `<span class="jh-bool">${match}</span>`;
        if (/null/.test(match)) return `<span class="jh-null">${match}</span>`;
        return `<span class="jh-number">${match}</span>`;
      }
    );

    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
