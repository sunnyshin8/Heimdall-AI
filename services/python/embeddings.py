import os
import json
import hashlib
import math
from flask import Flask, request, jsonify

app = Flask(__name__)

# Initialize boto3 Bedrock client if credentials are configured
BEDROCK_AVAILABLE = False
try:
    import boto3
    from botocore.config import Config
    
    if os.environ.get("AWS_ACCESS_KEY_ID") and "your-" not in os.environ.get("AWS_ACCESS_KEY_ID", ""):
        config = Config(region_name=os.environ.get("AWS_REGION", "us-east-1"))
        bedrock_client = boto3.client("bedrock-runtime", config=config)
        BEDROCK_AVAILABLE = True
except Exception as e:
    print(f"[Warning] AWS Bedrock SDK client initialization skipped: {e}")


def generate_deterministic_vector(text: str, dims: int = 1536) -> list:
    """Generates a stable, normalized mock vector based on string hash (for offline runs)."""
    # Create seed value from text MD5 hash
    hasher = hashlib.md5(text.encode("utf-8"))
    seed_hash = int(hasher.hexdigest()[:8], 16)
    
    # Seeded Linear Congruential Generator (LCG)
    seed = seed_hash if seed_hash else 12345
    vector = []
    sum_sq = 0
    
    for i in range(dims):
        seed = (1103515245 * seed + 12345) % 2147483648
        val = (seed / 2147483648) * 2 - 1
        vector.append(val)
        sum_sq += val * val
        
    # Normalize vector to unit length
    magnitude = math.sqrt(sum_sq)
    return [v / magnitude for v in vector]


@app.route("/embeddings", methods=["POST"])
def get_embeddings():
    """Generates text embedding vectors (Titan Embeddings Model)."""
    data = request.json or {}
    text = data.get("text", "").strip()
    
    if not text:
        return jsonify({"error": "No text provided"}), 400
        
    if BEDROCK_AVAILABLE:
        try:
            body = json.dumps({"inputText": text})
            response = bedrock_client.invoke_model(
                modelId="amazon.titan-embed-text-v1",
                contentType="application/json",
                accept="application/json",
                body=body
            )
            response_body = json.loads(response.get("body").read().decode("utf-8"))
            embedding = response_body.get("embedding")
            return jsonify({"success": True, "embedding": embedding, "source": "aws-bedrock"})
        except Exception as err:
            print(f"[Warning] Bedrock call failed: {err}")
            
    # Fallback to local offline vector generation
    embedding = generate_deterministic_vector(text)
    return jsonify({"success": True, "embedding": embedding, "source": "local-fallback"})


@app.route("/ocr", methods=["POST"])
def verify_ocr_visual():
    """Verifies OCR diagram text logs for LLM visual hallucinations or parsing noise."""
    data = request.json or {}
    ocr_text = data.get("text", "")
    
    # Check for corrupt visual formatting or OCR characters blocks
    suspicious_chars = ["|", "_", "]", "[", "ø", "æ", "©", "¢"]
    corruption_count = sum(ocr_text.count(char) for char in suspicious_chars)
    
    is_corrupt = corruption_count > (len(ocr_text) * 0.05) or "[?]" in ocr_text
    
    return jsonify({
        "success": True,
        "is_corrupt_layout": is_corrupt,
        "suspicious_char_count": corruption_count,
        "recommendation": "Reject change if layout corruption exceeds 5%." if is_corrupt else "Passed layout validation."
    })


if __name__ == "__main__":
    port = int(os.environ.get("PYTHON_SERVICE_PORT", 5001))
    print(f"[Python] Starting Python AI/ML Embeddings Service on port {port}...")
    app.run(host="0.0.0.0", port=port)
