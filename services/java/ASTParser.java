package services.java;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;

public class ASTParser {

    public static class ASTDiagnostic {
        public String ruleName;
        public int lineNumber;
        public String message;
        public String severity;

        public ASTDiagnostic(String ruleName, int lineNumber, String message, String severity) {
            this.ruleName = ruleName;
            this.lineNumber = lineNumber;
            this.message = message;
            this.severity = severity;
        }

        @Override
        public String toString() {
            return String.format("[%s] Line %d: %s (Severity: %s)", ruleName, lineNumber, message, severity);
        }
    }

    public static void main(String[] args) {
        if (args.length == 0) {
            System.out.println("❌ Java AST Analyzer Error: No target file path specified.");
            System.exit(1);
        }

        String filePath = args[0];
        System.out.println("☕ [Java AST Parser] Compiling and analyzing syntax tree for: " + filePath);

        try {
            List<String> lines = Files.readAllLines(Paths.get(filePath));
            List<ASTDiagnostic> diagnostics = auditASTTree(lines);

            System.out.println("==================================================");
            System.out.println("📊 Java AST Audit Diagnostics: " + diagnostics.size() + " findings");
            System.out.println("==================================================");
            
            for (ASTDiagnostic diag : diagnostics) {
                System.out.println("⚠️  " + diag.toString());
            }
            
            System.out.println("==================================================");
            System.exit(diagnostics.isEmpty() ? 0 : 2);

        } catch (IOException e) {
            System.out.println("❌ Failed to read source file: " + e.getMessage());
            System.exit(1);
        }
    }

    private static List<ASTDiagnostic> auditASTTree(List<String> lines) {
        List<ASTDiagnostic> diagnostics = new ArrayList<>();
        
        for (int i = 0; i < lines.size(); i++) {
            String line = lines.get(i).trim();
            int lineNumber = i + 1;

            // Rule 1: No raw string concatenation inside SQL statements
            if (line.contains("executeQuery") || line.contains("executeUpdate") || line.contains("Statement.execute")) {
                if (line.contains("+") && (line.contains("select") || line.contains("SELECT") || line.contains("where") || line.contains("WHERE"))) {
                    diagnostics.add(new ASTDiagnostic(
                        "no_sql_injection", 
                        lineNumber, 
                        "Raw SQL string concatenation detected inside query execute token. Use PreparedStatement instead.", 
                        "Critical"
                    ));
                }
            }

            // Rule 2: Insecure CORS configurations in Java Controller headers
            if (line.contains("@CrossOrigin") && line.contains("origins") && line.contains("*")) {
                diagnostics.add(new ASTDiagnostic(
                    "secure_cors", 
                    lineNumber, 
                    "Wildcard CORS allowed on RestController mapping annotation.", 
                    "High"
                ));
            }

            // Rule 3: Deprecated Crypto APIs
            if (line.contains("MessageDigest.getInstance") && (line.contains("MD5") || line.contains("SHA-1") || line.contains("SHA1"))) {
                diagnostics.add(new ASTDiagnostic(
                    "no_deprecated_crypto", 
                    lineNumber, 
                    "Insecure MessageDigest hashing algorithm instantiated (MD5/SHA1).", 
                    "Medium"
                ));
            }
        }

        return diagnostics;
    }
}
