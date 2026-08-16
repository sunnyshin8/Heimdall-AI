import * as ts from 'typescript';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  cleanCode: string;
}

// Helper to strip markdown formatting
function extractCodeBlock(text: string): string {
  if (text.includes('```')) {
    // Matches ```typescript ... ``` or ```javascript ... ``` or ```js ... ``` or plain ```
    const match = text.match(/```(?:typescript|javascript|js|json)?([\s\S]*?)```/);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return text.trim();
}

export function validateRemediation(codeText: string): ValidationResult {
  const errors: string[] = [];
  const cleanCode = extractCodeBlock(codeText);

  // 1. Check for blank or empty recommendations
  if (!cleanCode) {
    errors.push('The generated code remediation block is empty.');
    return { isValid: false, errors, cleanCode };
  }

  // 2. Scan for LLM Hallucination Signatures (Conversational Leakages outside comments)
  const lines = cleanCode.split('\n');
  let nonCommentTextLinesCount = 0;
  let linesWithNaturalLanguageNotCommented = 0;

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;
    
    // Ignore lines that are clearly comments or imports or brackets or operators
    const isCodeStructural = /^[{}[\]();,.\-+*/%=&|!<>?:~]+$/.test(trimmed);
    const isComment = trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('*/');
    const isCodeKey = /^(import|export|const|let|var|function|return|if|else|switch|case|break|for|while|try|catch|class|interface|type)\b/.test(trimmed);
    
    if (!isComment && !isCodeStructural && !isCodeKey) {
      nonCommentTextLinesCount++;
      // Check if it looks like conversational sentences (multiple words with spaces, no typical code syntax)
      const words = trimmed.split(/\s+/);
      if (words.length > 4 && !trimmed.includes('(') && !trimmed.includes(')') && !trimmed.includes('=') && !trimmed.includes(';')) {
        linesWithNaturalLanguageNotCommented++;
      }
    }
  });

  if (linesWithNaturalLanguageNotCommented > 2 && nonCommentTextLinesCount > lines.length * 0.4) {
    errors.push('AI Hallucination Detected: Conversational chat language leaked inside code block boundaries.');
  }

  // 3. Scan for Placeholder Bugs (e.g. "// insert config here" or "...")
  const PLACEHOLDER_PATTERNS = [
    /\/\/.*(insert|your|code|here|todo|configure)/i,
    /\/\*.*(insert|your|code|here|todo|configure).*\*\//i,
    /^\s*\.\.\.\s*$/m, // A line containing just three dots
    /^\s*\/\/ \.\.\.\s*$/m // A line containing just comment dots
  ];

  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(cleanCode)) {
      errors.push('Placeholder Bug: Code block contains unresolved placeholders (e.g. "// your code here" or "...").');
      break;
    }
  }

  // 4. Run AST Parser to verify Syntax Correctness
  const isJava = cleanCode.includes('class ') && (cleanCode.includes('public static void main') || cleanCode.includes('import java.') || cleanCode.includes('System.out.'));

  if (isJava) {
    try {
      const fs = require('fs');
      const path = require('path');
      const cp = require('child_process');
      
      const scratchDir = 'C:/Users/asus/.gemini/antigravity-ide/brain/a1d4b3c8-7dc4-4b0b-bb27-f9622de099de/scratch';
      if (!fs.existsSync(scratchDir)) {
        fs.mkdirSync(scratchDir, { recursive: true });
      }
      const tempFilePath = path.join(scratchDir, 'TempAudit.java');
      fs.writeFileSync(tempFilePath, cleanCode, 'utf8');

      try {
        cp.execSync(`java -cp g:/YT services.java.ASTParser "${tempFilePath}"`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
      } catch (err: any) {
        const output = err.stdout || err.stderr || '';
        const lines = output.split('\n');
        lines.forEach((line: string) => {
          if (line.includes('⚠️  ')) {
            errors.push(line.replace('⚠️  ', '').trim());
          } else if (line.includes('❌ ')) {
            errors.push(line.replace('❌ ', '').trim());
          }
        });
        if (errors.length === 0 && output) {
          errors.push(`Java AST Parser Error: ${output.split('\n')[0]}`);
        }
      }
    } catch (err: any) {
      errors.push(`Java Execution Error: Failed to run ASTParser.java: ${err.message}`);
    }
  } else {
    // Run original TS AST Parser
    try {
      const sourceFile = ts.createSourceFile(
        'remediation.ts',
        cleanCode,
        ts.ScriptTarget.Latest,
        true
      );
      const diagnostics = (sourceFile as any).parseDiagnostics || [];
      if (diagnostics.length > 0) {
        diagnostics.slice(0, 3).forEach((diag: any) => {
          const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
          errors.push(`Syntax Error: ${message}`);
        });
      }
    } catch (err: any) {
      errors.push(`Parser Error: Failed to parse TS syntax: ${err.message}`);
    }
  }

  // 5. OCR Visual Noise / Gibberish checks
  // If the code has weird character patterns (like corrupt copy-paste or OCR artifacts), flag it
  const highEntropyPattern = /[^\w\s(){}[\];.,\-+=/*&|!<>?:'"`]{4,}/;
  if (highEntropyPattern.test(cleanCode)) {
    errors.push('OCR Visual Noise: Code contains corrupt character blocks or visual copy-paste noise.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    cleanCode
  };
}
