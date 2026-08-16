#!/usr/bin/env python3
"""
Heimdall AI: LLM Agnostic Gateway (Python Flask)
===============================================
Unified layer for LLM routing. Allows easy swapping between
OpenAI, Anthropic, Bedrock, or Ollama without changing TS code.
"""

import os
from flask import Flask, request, jsonify

app = Flask(__name__)

# Providers: bedrock | openai | ollama
PROVIDER = os.environ.get("LLM_PROVIDER", "mock")

@app.route("/v1/chat/completions", methods=["POST"])
def completions():
    data = request.json or {}
    messages = data.get("messages", [])
    model = data.get("model", "default")
    
    # In a full implementation, this routes to the respective SDK
    print(f"[LLM Gateway] Routing request to provider: {PROVIDER}")
    
    if PROVIDER == "mock":
        # Mock completion for rapid testing without keys
        prompt = messages[-1]["content"] if messages else ""
        response_text = ""
        
        if "remediation" in prompt.lower():
            response_text = '{"codeFix": "// Patched code here", "explanation": "Fixed vulnerabilities based on rules"}'
        else:
            response_text = "I am a mock response from the LLM Gateway."

        return jsonify({
            "choices": [{
                "message": {
                    "role": "assistant",
                    "content": response_text
                }
            }]
        })
        
    # Example placeholder for OpenAI routing
    elif PROVIDER == "openai":
        return jsonify({"error": "OpenAI provider not fully implemented in MVP"}), 501
        
    return jsonify({"error": "Unknown provider"}), 400

@app.route("/health")
def health():
    return jsonify({"status": "ok", "service": "llm-gateway"})

if __name__ == "__main__":
    port = int(os.environ.get("LLM_GATEWAY_PORT", 5004))
    print(f"[LLM Gateway] Starting on port {port} (Provider: {PROVIDER})")
    app.run(host="0.0.0.0", port=port)
