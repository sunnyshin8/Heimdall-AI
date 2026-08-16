import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

export async function getEmbedding(text: string): Promise<number[]> {
  const pythonPort = process.env.PYTHON_SERVICE_PORT || '5001';
  const url = `http://localhost:${pythonPort}/embeddings`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.embedding) {
        console.log(`[IPC] Successfully retrieved vector embedding from Python service (${data.source}).`);
        return data.embedding;
      }
    }
  } catch (err) {
    console.warn(`⚠️ Python Embeddings Service on port ${pythonPort} unreachable. Falling back to local JS generator.`);
  }

  // Deterministic Mock Vector Fallback (generates a normalized 1536-dimensional vector based on the string)
  return generateDeterministicMockVector(text);
}

function generateDeterministicMockVector(text: string): number[] {
  const dims = 1536;
  const vector: number[] = new Array(dims);
  
  // Calculate a seed from the text
  let seed = 0;
  for (let i = 0; i < text.length; i++) {
    seed = (seed + text.charCodeAt(i) * (i + 1)) % 1000000;
  }

  // Simple Seeded LCG Random Generator
  let currentSeed = seed || 12345;
  const lcg = () => {
    currentSeed = (1103515245 * currentSeed + 12345) % 2147483648;
    return currentSeed / 2147483648;
  };

  // Generate floats
  let sumSq = 0;
  for (let i = 0; i < dims; i++) {
    const val = lcg() * 2 - 1; // Between -1 and 1
    vector[i] = val;
    sumSq += val * val;
  }

  // Normalize the vector (magnitude = 1.0)
  const magnitude = Math.sqrt(sumSq);
  for (let i = 0; i < dims; i++) {
    vector[i] = vector[i] / magnitude;
  }

  return vector;
}
