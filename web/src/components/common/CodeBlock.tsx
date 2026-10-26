import React, { useMemo, useState } from 'react';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';

// Prism 언어 확장팩
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-json';

function getLanguageFromFilePath(filePath?: string): string {
  if (!filePath) return 'javascript';
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'java':
      return 'java';
    case 'ts':
      return 'typescript';
    case 'tsx':
      return 'tsx';
    case 'jsx':
      return 'jsx';
    case 'js':
    case 'mjs':
    case 'cjs':
      return 'javascript';
    case 'html':
    case 'xml':
      return 'markup';
    case 'css':
      return 'css';
    case 'sql':
      return 'sql';
    case 'yaml':
    case 'yml':
      return 'yaml';
    case 'json':
      return 'json';
    default:
      return 'javascript';
  }
}

export interface CodeBlockProps {
  code: string;
  filePath?: string;
  language?: string;
  startLine?: number;
  maxLines?: number;
  showLineNumbers?: boolean;
  className?: string;
  headerTitle?: string;
  badge?: {
    text: string;
    variant: 'danger' | 'info' | 'neutral';
  };
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  filePath,
  language,
  startLine = 1,
  maxLines,
  showLineNumbers = true,
  className = '',
  headerTitle,
  badge,
}) => {
  const [copied, setCopied] = useState(false);

  const lang = useMemo(() => language || getLanguageFromFilePath(filePath), [language, filePath]);

  const lines = useMemo(() => {
    const grammar = Prism.languages[lang] || Prism.languages.javascript || Prism.languages.clike;
    const rawLines = (code || '').split('\n');
    const targetLines = maxLines ? rawLines.slice(0, maxLines) : rawLines;

    return targetLines.map((lineStr, idx) => {
      const safeLine = lineStr === '' ? ' ' : lineStr;
      const html = grammar ? Prism.highlight(safeLine, grammar, lang) : safeLine;
      return {
        lineNumber: startLine + idx,
        html,
      };
    });
  }, [code, lang, startLine, maxLines]);

  const totalLines = (code || '').split('\n').length;
  const isTruncated = maxLines && totalLines > maxLines;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const badgeClasses = {
    danger: 'bg-red-500/20 text-red-400 border border-red-500/30',
    info: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
    neutral: 'bg-slate-700 text-slate-300 border border-slate-600',
  };

  return (
    <div className={`rounded-lg overflow-hidden border border-slate-700 bg-[#1d1f21] text-slate-200 font-mono text-[13px] shadow-sm ${className}`}>
      {/* Header bar */}
      {(headerTitle || filePath || badge) && (
        <div className="flex items-center justify-between px-3.5 py-2 bg-[#282a2e] border-b border-slate-700/80 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-500/60" />
            <span className="font-semibold text-slate-200 truncate" title={headerTitle || filePath}>
              {headerTitle || filePath}
            </span>
            {badge && (
              <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${badgeClasses[badge.variant]}`}>
                {badge.text}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider">{lang}</span>
            <button
              type="button"
              onClick={handleCopy}
              className="px-2 py-0.5 rounded bg-slate-700/80 hover:bg-slate-600 text-slate-200 text-xs transition-colors cursor-pointer flex items-center gap-1.5"
              title="코드 복사"
            >
              {copied ? (
                <>
                  <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-emerald-400 font-medium">복사됨</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span>복사</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Code body */}
      <div className="overflow-x-auto p-3.5 leading-relaxed selection:bg-blue-500/30 selection:text-white">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line) => (
              <tr key={line.lineNumber} className="hover:bg-slate-800/40 transition-colors">
                {showLineNumbers && (
                  <td className="w-10 pr-4 text-right select-none text-slate-400 text-xs font-mono align-top border-r border-slate-700/50">
                    {line.lineNumber}
                  </td>
                )}
                <td className="pl-4 font-mono text-[13px] whitespace-pre align-top">
                  <span dangerouslySetInnerHTML={{ __html: line.html }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {isTruncated && (
          <div className="mt-2 pt-2 border-t border-slate-700/60 text-center text-xs text-slate-400">
            ... 외 {totalLines - (maxLines || 0)}줄 생략됨 ...
          </div>
        )}
      </div>
    </div>
  );
};
