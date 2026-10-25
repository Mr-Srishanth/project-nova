import { ProjectIdea, ExistingProjectSource, NoveltyReport, SimilarityEvidence } from '../../types/domain';

export class NoveltyEngine {
  private static stopWords = new Set([
    'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'as', 'at',
    'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'could', 'did', 'do',
    'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has', 'have', 'having',
    'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it',
    'its', 'itself', 'just', 'me', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off', 'on',
    'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'should',
    'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these',
    'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were', 'what',
    'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you', 'your', 'yours', 'yourself'
  ]);

  public static tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !this.stopWords.has(w));
  }

  public static computeTfIdfVector(tokens: string[], allDocTokens: string[][]): Map<string, number> {
    const tf = new Map<string, number>();
    for (const t of tokens) {
      tf.set(t, (tf.get(t) || 0) + 1);
    }

    const vector = new Map<string, number>();
    const totalDocs = allDocTokens.length;

    for (const [term, count] of tf.entries()) {
      let docsWithTerm = 0;
      for (const doc of allDocTokens) {
        if (doc.includes(term)) docsWithTerm++;
      }
      const idf = Math.log(1 + (totalDocs / (1 + docsWithTerm)));
      vector.set(term, (count / tokens.length) * idf);
    }

    return vector;
  }

  public static cosineSimilarity(vecA: Map<string, number>, vecB: Map<string, number>): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (const val of vecA.values()) {
      normA += val * val;
    }
    for (const val of vecB.values()) {
      normB += val * val;
    }

    if (normA === 0 || normB === 0) return 0;

    for (const [term, valA] of vecA.entries()) {
      const valB = vecB.get(term) || 0;
      dotProduct += valA * valB;
    }

    return Number((dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))).toFixed(4));
  }

  public static evaluateNovelty(project: ProjectIdea, corpus: ExistingProjectSource[]): NoveltyReport {
    const projectText = `${project.title} ${project.problemStatement} ${project.proposedSolution} ${project.domain} ${Object.values(project.suggestedStack).join(' ')}`;
    const projectTokens = this.tokenize(projectText);

    const corpusTokenized = corpus.map(item => ({
      item,
      tokens: this.tokenize(`${item.title} ${item.description} ${item.domain} ${item.techStack.join(' ')} ${item.keyDifferentiator}`)
    }));

    const allDocs = [projectTokens, ...corpusTokenized.map(c => c.tokens)];
    const projectVector = this.computeTfIdfVector(projectTokens, allDocs);

    const similarities: SimilarityEvidence[] = [];

    for (const entry of corpusTokenized) {
      const entryVector = this.computeTfIdfVector(entry.tokens, allDocs);
      const score = this.cosineSimilarity(projectVector, entryVector);

      const common = projectTokens.filter(t => entry.tokens.includes(t));
      const uniqueCommon = Array.from(new Set(common)).slice(0, 4);

      const distinct = projectTokens.filter(t => !entry.tokens.includes(t));
      const uniqueDistinct = Array.from(new Set(distinct)).slice(0, 4);

      similarities.push({
        sourceProjectId: entry.item.id,
        sourceTitle: entry.item.title,
        similarityScore: score,
        commonPatterns: uniqueCommon.length > 0 ? uniqueCommon : ['General domain overlap'],
        distinguishingGaps: uniqueDistinct.length > 0 ? uniqueDistinct : ['Specific execution architecture'],
        sourceType: entry.item.sourceType,
      });
    }

    similarities.sort((a, b) => b.similarityScore - a.similarityScore);
    const topMatches = similarities.slice(0, 3);
    const maxSimilarity = topMatches.length > 0 ? topMatches[0].similarityScore : 0;

    let rawNovelty = Math.round((1 - Math.min(1, maxSimilarity * 1.35)) * 100);
    rawNovelty = Math.max(10, Math.min(95, rawNovelty));

    let verdict: NoveltyReport['noveltyVerdict'] = 'Iterative Improvement';
    if (rawNovelty >= 80) verdict = 'High Novelty';
    else if (rawNovelty >= 55) verdict = 'Iterative Improvement';
    else verdict = 'Standard Template';

    const differentiationOps = [
      'Implement real-time streaming inference instead of batch processing',
      'Add client-side on-device privacy guarantee with local zero-knowledge proofs or WebAssembly execution',
      'Incorporate multi-modal sensory fusion (e.g. audio + vision signals) rather than unimodal classification',
      'Design adaptive feedback loop where user corrections continuously fine-tune local models',
    ];

    return {
      overallNoveltyScore: rawNovelty,
      methodUsed: 'TF-IDF Lexical Cosine Vectorizer',
      topSimilarProjects: topMatches,
      noveltyVerdict: verdict,
      limitations: 'Evaluated against the curated academic & open-source corpus. Does not account for proprietary private enterprise repositories or unindexed preprints.',
      differentiationOpportunities: differentiationOps.slice(0, 3),
    };
  }
}
