/**
 * Memory management for RSIS.
 * Deep port of Python memory.py — vector store, knowledge graph, n-gram vectorizer.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { CONFIG } from './config.js';

// ── Types ──────────────────────────────────────────────────────

export interface KnowledgeNode {
  id: string;
  label: string;
  type: string;
  properties: Record<string, unknown>;
  embedding?: Float32Array;
}

export interface KnowledgeEdge {
  source: string;
  target: string;
  label: string;
  weight: number;
}

export interface KnowledgeGraph {
  nodes: Map<string, KnowledgeNode>;
  edges: KnowledgeEdge[];
}

export interface MemoryEntry {
  type: 'improvement' | 'observation' | 'checkpoint' | 'error' | 'evaluation';
  timestamp: string;
  data: Record<string, unknown>;
  tags: string[];
  embedding?: Float32Array;
}

// ── N-Gram Vectorizer ─────────────────────────────────────────

export class NGramVectorizer {
  private n: number;
  private dims: number;

  constructor(n: number = 3, dims: number = 384) {
    this.n = n;
    this.dims = dims;
  }

  /** Generate n-gram features from string */
  ngrams(text: string): Map<string, number> {
    const features = new Map<string, number>();
    const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');

    for (let i = 0; i <= normalized.length - this.n; i++) {
      const gram = normalized.slice(i, i + this.n);
      if (gram.includes(' ')) continue;
      features.set(gram, (features.get(gram) || 0) + 1);
    }

    return features;
  }

  /** Hash n-grams into a fixed-dimension vector */
  vectorize(text: string): Float32Array {
    const features = this.ngrams(text);
    const vec = new Float32Array(this.dims);

    // Simple hash-based embedding (not as good as ML but deterministic)
    for (const [gram, count] of features) {
      let hash = 0;
      for (let i = 0; i < gram.length; i++) {
        hash = ((hash << 5) - hash) + gram.charCodeAt(i);
        hash |= 0;
      }
      const idx = Math.abs(hash) % this.dims;
      vec[idx] += count / Math.max(1, features.size);
    }

    // Normalize
    let norm = 0;
    for (let i = 0; i < this.dims; i++) norm += vec[i] ** 2;
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < this.dims; i++) vec[i] /= norm;
    }

    return vec;
  }

  /** Cosine similarity between two vectors */
  cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] ** 2;
      normB += b[i] ** 2;
    }
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    if (normA === 0 || normB === 0) return 0;
    return dot / (normA * normB);
  }
}

// ── Vector Store ──────────────────────────────────────────────

export class VectorStore {
  private entries: Map<string, Float32Array> = new Map();
  private vectorizer: NGramVectorizer;
  private storePath: string;

  constructor(storePath: string, vectorizer: NGramVectorizer = new NGramVectorizer()) {
    this.storePath = storePath;
    this.vectorizer = vectorizer;
    this._load();
  }

  private _load(): void {
    try {
      const indexPath = path.join(this.storePath, 'index.json');
      if (fs.existsSync(indexPath)) {
        const data = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
        for (const [key, arr] of Object.entries(data)) {
          this.entries.set(key, new Float32Array(arr as number[]));
        }
      }
    } catch {
      // No stored vectors yet
    }
  }

  private _save(): void {
    try {
      fs.mkdirSync(this.storePath, { recursive: true });
      const obj: Record<string, number[]> = {};
      for (const [key, vec] of this.entries) {
        obj[key] = Array.from(vec);
      }
      fs.writeFileSync(path.join(this.storePath, 'index.json'), JSON.stringify(obj));
    } catch (err) {
      console.error('Failed to save vector store:', err);
    }
  }

  add(key: string, text: string): void {
    this.entries.set(key, this.vectorizer.vectorize(text));
    this._save();
  }

  get(key: string): Float32Array | undefined {
    return this.entries.get(key);
  }

  /** Search by cosine similarity. Returns top-k matches. */
  search(query: string, k: number = 5): Array<{ key: string; score: number }> {
    const queryVec = this.vectorizer.vectorize(query);
    const results: Array<{ key: string; score: number }> = [];

    for (const [key, vec] of this.entries) {
      const score = this.vectorizer.cosineSimilarity(queryVec, vec);
      results.push({ key, score });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, k);
  }

  get size(): number {
    return this.entries.size;
  }
}

// ── Knowledge Graph ───────────────────────────────────────────

export class RSISKnowledgeGraph {
  private nodes: Map<string, KnowledgeNode> = new Map();
  private edges: KnowledgeEdge[] = [];
  private kgPath: string;

  constructor(kgPath: string = CONFIG.memory.knowledgeGraphPath) {
    this.kgPath = path.resolve(kgPath);
    this._load();
  }

  private _load(): void {
    try {
      if (fs.existsSync(this.kgPath)) {
        const data = JSON.parse(fs.readFileSync(this.kgPath, 'utf-8'));
        if (data.nodes) {
          for (const n of data.nodes) {
            this.nodes.set(n.id, n);
          }
        }
        if (data.edges) {
          this.edges = data.edges;
        }
      }
    } catch {
      // No stored graph
    }
  }

  private _save(): void {
    try {
      fs.mkdirSync(path.dirname(this.kgPath), { recursive: true });
      fs.writeFileSync(this.kgPath, JSON.stringify({
        nodes: Array.from(this.nodes.values()),
        edges: this.edges,
      }, null, 2));
    } catch (err) {
      console.error('Failed to save knowledge graph:', err);
    }
  }

  addNode(id: string, label: string, type: string, properties: Record<string, unknown> = {}): void {
    this.nodes.set(id, { id, label, type, properties });
    this._save();
  }

  addEdge(source: string, target: string, label: string, weight: number = 1.0): void {
    // Check if edge already exists
    const existing = this.edges.find(
      e => e.source === source && e.target === target && e.label === label
    );
    if (existing) {
      existing.weight = Math.min(existing.weight + weight, 10);
    } else {
      this.edges.push({ source, target, label, weight });
    }
    this._save();
  }

  getNode(id: string): KnowledgeNode | undefined {
    return this.nodes.get(id);
  }

  /** Find similar nodes by traversing edges */
  findRelated(id: string, maxDepth: number = 2): KnowledgeNode[] {
    const visited = new Set<string>();
    const result: KnowledgeNode[] = [];
    const queue: Array<{ nodeId: string; depth: number }> = [{ nodeId: id, depth: 0 }];

    while (queue.length > 0) {
      const { nodeId, depth } = queue.shift()!;
      if (visited.has(nodeId) || depth > maxDepth) continue;
      visited.add(nodeId);

      const node = this.nodes.get(nodeId);
      if (node && nodeId !== id) result.push(node);

      // Find connected nodes
      for (const edge of this.edges) {
        if (edge.source === nodeId && !visited.has(edge.target)) {
          queue.push({ nodeId: edge.target, depth: depth + 1 });
        }
        if (edge.target === nodeId && !visited.has(edge.source)) {
          queue.push({ nodeId: edge.source, depth: depth + 1 });
        }
      }
    }

    return result;
  }

  /** Get full graph data for export */
  getGraph(): { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] } {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: this.edges,
    };
  }

  get nodeCount(): number {
    return this.nodes.size;
  }

  get edgeCount(): number {
    return this.edges.length;
  }
}

// ── Memory Manager ────────────────────────────────────────────

export class MemoryManager {
  private workspaceDir: string;
  private kg: RSISKnowledgeGraph;
  private vectorStore: VectorStore;
  private vectorizer: NGramVectorizer;
  private memoryLog: MemoryEntry[] = [];
  private static readonly MAX_MEMORY_LOG = 500;

  constructor(workspaceDir: string = CONFIG.memory.repoRoot) {
    this.workspaceDir = path.resolve(workspaceDir);
    this.vectorizer = new NGramVectorizer();
    this.kg = new RSISKnowledgeGraph(path.join(this.workspaceDir, CONFIG.memory.knowledgeGraphPath));
    this.vectorStore = new VectorStore(
      path.join(this.workspaceDir, CONFIG.memory.vectorStorePath),
      this.vectorizer,
    );
    this._loadMemoryLog();
  }

  private _loadMemoryLog(): void {
    try {
      const logPath = path.join(this.workspaceDir, '.rsis', 'memory-log.json');
      if (fs.existsSync(logPath)) {
        this.memoryLog = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
      }
    } catch {
      this.memoryLog = [];
    }
  }

  private _saveMemoryLog(): void {
    try {
      const logPath = path.join(this.workspaceDir, '.rsis', 'memory-log.json');
      fs.mkdirSync(path.dirname(logPath), { recursive: true });
      fs.writeFileSync(logPath, JSON.stringify(this.memoryLog, null, 2));
    } catch (err) {
      console.error('Failed to save memory log:', err);
    }
  }

  recordImprovement(improvement: {
    description: string;
    targetFiles: string[];
    evalScores: Array<{ name: string; score: number; weight: number }>;
    outcome: 'applied' | 'failed' | 'rolled_back';
    goal: string;
  }): void {
    const entry: MemoryEntry = {
      type: 'improvement',
      timestamp: new Date().toISOString(),
      data: improvement as unknown as Record<string, unknown>,
      tags: ['improvement', improvement.outcome, ...improvement.targetFiles],
    };

    this.memoryLog.push(entry);
    if (this.memoryLog.length > MemoryManager.MAX_MEMORY_LOG) {
      this.memoryLog = this.memoryLog.slice(-MemoryManager.MAX_MEMORY_LOG);
    }

    // Add to knowledge graph
    const nodeId = `improvement-${Date.now()}`;
    this.kg.addNode(nodeId, improvement.description.slice(0, 80), 'improvement', improvement);
    this.kg.addEdge('session-current', nodeId, 'produced', 1.0);

    // Add to vector store
    const vectorText = `${improvement.goal} ${improvement.description} ${improvement.targetFiles.join(' ')}`;
    this.vectorStore.add(nodeId, vectorText);

    this._saveMemoryLog();
  }

  recordObservation(observation: string, tags: string[] = []): void {
    const entry: MemoryEntry = {
      type: 'observation',
      timestamp: new Date().toISOString(),
      data: { observation },
      tags,
    };
    this.memoryLog.push(entry);
    if (this.memoryLog.length > MemoryManager.MAX_MEMORY_LOG) {
      this.memoryLog.shift();
    }
    this._saveMemoryLog();
  }

  /** Search memory by similarity to query */
  searchSimilar(query: string, k: number = 5): MemoryEntry[] {
    const results = this.vectorStore.search(query, k);
    return results.map(r => {
      // Try to find matching memory entry
      const entry = this.memoryLog.find(
        e => (e.data as any)?.description?.includes(r.key) ||
             e.timestamp === r.key
      );
      return entry || this.memoryLog[0];
    }).filter(Boolean);
  }

  /** Get recent memory entries */
  getRecent(count: number = 20): MemoryEntry[] {
    return this.memoryLog.slice(-count);
  }

  get knowledgeGraph(): RSISKnowledgeGraph {
    return this.kg;
  }

  getKnowledgeGraph(): RSISKnowledgeGraph {
    return this.kg;
  }
}
