import { StudentProfile, ProjectIdea, SkillGapReport, SkillGapItem, ExistingProjectSource, NoveltyReport, SimilarityEvidence, FeasibilityAssessment, RecommendationBreakdown, ProjectBlueprint, RoadmapMilestone, EvaluationComparison } from '../../types/domain';

export class AIGenerationService {
  /**
   * Generates tailored project ideas for a student profile.
   * If the local AI Gateway with live Gemini is reachable, it uses live generative inference.
   * Otherwise, it seamlessly falls back to domain-informed rule-based synthesis.
   */
  public static async generateProjectIdeas(
    student: StudentProfile,
    customPrompt?: string
  ): Promise<{ ideas: ProjectIdea[]; source: 'Live Gemini API' | 'Deterministic Offline Synthesis' }> {
    try {
      const response = await fetch('http://localhost:4000/api/ai/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idea: customPrompt || `Generate specialized project ideas tailored for ${student.name}, a ${student.academicLevel} student majoring in ${student.major}. Skills: ${student.existingSkills.join(', ')}. Interests: ${student.primaryInterests.join(', ')}. Career Goal: ${student.careerGoal}. Budget: ${student.budgetConstraint}. Available weeks: ${student.targetDeadlineWeeks}.`,
          studentProfile: student,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data && (data.name || data.title)) {
          const liveIdea: ProjectIdea = {
            id: `idea-gemini-${Date.now()}`,
            title: data.name || data.title || 'AI Personalized Project Idea',
            tagline: data.summary ? data.summary.slice(0, 110) + '...' : 'Generated via live Gemini 3.8 inference.',
            domain: student.preferredDomain || student.primaryInterests[0] || 'Applied Software Systems',
            problemStatement: data.problemStatement || 'Target domain problem identified by AI inference.',
            measurableObjectives: data.keyFeatures || [
              'Build and deploy responsive user client',
              'Implement secure backend processing service',
              'Validate accuracy against open benchmarks'
            ],
            proposedSolution: data.proposedSolution || 'Modular architecture designed to solve the target problem efficiently.',
            suggestedStack: {
              frontend: data.suggestedTechnologies?.find((t: any) => t.layer?.toLowerCase().includes('front'))?.tech || 'React + TypeScript',
              backend: data.suggestedTechnologies?.find((t: any) => t.layer?.toLowerCase().includes('back'))?.tech || 'FastAPI / Node.js',
              database: data.suggestedTechnologies?.find((t: any) => t.layer?.toLowerCase().includes('data'))?.tech || 'PostgreSQL',
              aiOrSpecialized: data.suggestedTechnologies?.find((t: any) => t.layer?.toLowerCase().includes('ai') || t.layer?.toLowerCase().includes('engine') || t.layer?.toLowerCase().includes('graph'))?.tech || 'PyTorch / ONNX',
            },
            complexity: (data.complexity as any) || 'Intermediate',
            estimatedWeeks: data.estimatedMVPWeeks || Math.min(student.targetDeadlineWeeks, 10),
            estimatedCost: student.budgetConstraint.includes('Zero') ? '$0 (Free Tier)' : '$25 - $40 (API credits)',
            prerequisites: student.existingSkills.slice(0, 3),
          };

          const complementaryIdeas = this.synthesizeDomainIdeas(student);
          return {
            ideas: [liveIdea, ...complementaryIdeas.slice(1, 4)],
            source: 'Live Gemini API',
          };
        }
      }
    } catch {
      // Local gateway offline or request failed; fall back gracefully
    }

    // High-quality deterministic fallback
    const offlineIdeas = this.synthesizeDomainIdeas(student);
    return {
      ideas: offlineIdeas,
      source: 'Deterministic Offline Synthesis',
    };
  }

  public static synthesizeDomainIdeas(student: StudentProfile): ProjectIdea[] {
    const isML = student.existingSkills.some((s: string) => ['python', 'pytorch', 'tensorflow', 'pandas', 'scikit-learn'].includes(s.toLowerCase()));
    const isWeb = student.existingSkills.some((s: string) => ['typescript', 'react', 'node.js', 'vue', 'javascript'].includes(s.toLowerCase()));

    if (isML && student.primaryInterests.some((i: string) => i.toLowerCase().includes('edge') || i.toLowerCase().includes('audio') || i.toLowerCase().includes('vision'))) {
      return [
        {
          id: 'idea-edge-audio-01',
          title: 'ResonantEdge: Micro-Acoustic Bio-Diversity Sentinel',
          tagline: 'Ultra-low-power edge audio classifier detecting endangered avian and amphibian bio-signals on microcontrollers.',
          domain: 'Edge AI & Environmental Tech',
          problemStatement: 'Ecologists currently gather field audio cards manually months after deployment, preventing real-time conservation alerts for rapid habitat disruptions.',
          measurableObjectives: [
            'Achieve > 89% F1-score on 25 localized target species audio signatures',
            'Sustain continuous duty cycle under 1.2W average power draw on battery/solar',
            'Provide LoRaWAN packet telemetry transmission of detection timestamps'
          ],
          proposedSolution: 'Quantized 8-bit MobileNet spectrogram classifier running on on-device microcontrollers with solar harvesting and emergency anomaly mesh packet broadcasting.',
          suggestedStack: {
            frontend: 'React + Tailwind CSS (Offline PWA)',
            backend: 'FastAPI (Telemetry Ingest Service)',
            database: 'PostgreSQL + TimescaleDB',
            aiOrSpecialized: 'TensorFlow Lite / Edge Audio',
          },
          complexity: 'Intermediate',
          estimatedWeeks: Math.min(student.targetDeadlineWeeks, 10),
          estimatedCost: student.budgetConstraint.includes('Zero') ? '$0 (Simulated Device)' : '$35 (Hardware kit)',
          prerequisites: ['Python', 'Audio Preprocessing', 'FastAPI'],
        },
        {
          id: 'idea-vision-crop-02',
          title: 'SpectralShield: Multi-Spectral UAV Crop Pathogen Mapper',
          tagline: 'Autonomous aerial image anomaly detection localizing fungal infections before visible canopy wilting.',
          domain: 'Precision Agriculture & Computer Vision',
          problemStatement: 'Standard RGB cameras only identify crop disease after leaf tissue necrosis has already compromised yield across wide agricultural sectors.',
          measurableObjectives: [
            'Detect pre-symptomatic stress indices with 92% sensitivity',
            'Generate georeferenced GeoTIFF prescription heatmaps under 30 seconds',
            'Reduce pesticide spray coverage requirements by up to 40%'
          ],
          proposedSolution: 'Lightweight attention-guided convolutional pipeline fusing NDVI spectral bands with spatial neighborhood features for sub-meter disease mapping.',
          suggestedStack: {
            frontend: 'React + Mapbox GL',
            backend: 'Python FastAPI',
            database: 'PostgreSQL + PostGIS',
            aiOrSpecialized: 'PyTorch (Custom Vision Transformers)',
          },
          complexity: 'Advanced',
          estimatedWeeks: Math.min(student.targetDeadlineWeeks, 14),
          estimatedCost: student.budgetConstraint.includes('Zero') ? '$0 (Public Kaggle Data)' : '$45 (Cloud GPU)',
          prerequisites: ['Python', 'PyTorch', 'Computer Vision Basics'],
        },
        {
          id: 'idea-privacy-voice-03',
          title: 'WhisperVault: Zero-Knowledge Voice Biometric Authenticator',
          tagline: 'Cryptographically shielded on-device voice authentication with zero cloud audio leakage.',
          domain: 'Cybersecurity & Acoustic AI',
          problemStatement: 'Cloud-hosted voice identification engines introduce substantial privacy vulnerabilities and susceptibility to biometric leakage.',
          measurableObjectives: [
            'Equal Error Rate (EER) under 1.8% on noisy verification test sets',
            'Zero raw audio or plain vector embeddings stored outside enclave memory',
            'End-to-end verification latency under 350ms on commodity client hardware'
          ],
          proposedSolution: 'On-device speaker verification producing homomorphic encrypted voice hashes verified through zero-knowledge range proofs.',
          suggestedStack: {
            frontend: 'React + Web Audio API',
            backend: 'Node.js (Secure Enclave Gate)',
            database: 'PostgreSQL',
            aiOrSpecialized: 'PyTorch + PyCryptodome (ZKP)',
          },
          complexity: 'Advanced',
          estimatedWeeks: Math.min(student.targetDeadlineWeeks, 12),
          estimatedCost: '$0 (Local Hardware)',
          prerequisites: ['Python', 'Signal Processing', 'Cryptography Fundamentals'],
        }
      ];
    }

    if (isWeb) {
      return [
        {
          id: 'idea-collab-crdt-01',
          title: 'SynapseCanvas: Local-First Deterministic CRDT Collaborative Board',
          tagline: 'Offline-first, peer-to-peer infinite canvas engine with cryptographic peer verification.',
          domain: 'Distributed Systems & Web Engineering',
          problemStatement: 'Most collaborative whiteboards lock teams into closed cloud proprietary databases and break completely during spotty connectivity.',
          measurableObjectives: [
            'Support 50+ concurrent multi-user cursor updates with zero conflict divergency',
            '100% offline local-first editing with sub-50ms peer reconciliation upon reconnect',
            'Cryptographically signed change logs for tamper-evident revision history'
          ],
          proposedSolution: 'Hybrid state-based Conflict-free Replicated Data Type (CRDT) implemented over WebSockets and WebRTC with IndexedDB client persistence.',
          suggestedStack: {
            frontend: 'React + TypeScript + Canvas API',
            backend: 'Node.js (Signaling & Presence Hub)',
            database: 'PostgreSQL (Cold Storage Archive)',
            aiOrSpecialized: 'WebSockets & CRDT Algorithms (Yjs / Automerge)',
          },
          complexity: 'Intermediate',
          estimatedWeeks: Math.min(student.targetDeadlineWeeks, 10),
          estimatedCost: '$0 (Free Vercel & Supabase Tier)',
          prerequisites: ['TypeScript', 'React', 'Data Structures (Trees/Graphs)'],
        },
        {
          id: 'idea-dev-ast-02',
          title: 'TraceGuard: Semantic AST Static Security Gate for Pull Requests',
          tagline: 'Developer tool that analyzes full-call graphs to block secrets and vulnerable dependencies before merge.',
          domain: 'Developer Tooling & AppSec',
          problemStatement: 'Basic regex linter bots inundate engineers with false alarms while missing taint flows between decoupled files.',
          measurableObjectives: [
            'Scan 100k lines of code in under 4 seconds in GitHub Action CI runner',
            'Maintain false-positive warning rate strictly under 5% on benchmark repos',
            'Generate interactive visual taint-flow DAGs for discovered vulnerabilities'
          ],
          proposedSolution: 'Inter-procedural taint analysis engine using Babel/Tree-sitter AST traversal with visual graph rendering.',
          suggestedStack: {
            frontend: 'React + D3.js (Taint Graph Visualizer)',
            backend: 'FastAPI / Node.js Engine',
            database: 'PostgreSQL',
            aiOrSpecialized: 'Tree-sitter AST Parsers',
          },
          complexity: 'Advanced',
          estimatedWeeks: Math.min(student.targetDeadlineWeeks, 12),
          estimatedCost: '$0 (GitHub Actions Free Tier)',
          prerequisites: ['TypeScript / Node.js', 'Compilers / AST Basics'],
        },
        {
          id: 'idea-wasm-db-03',
          title: 'AegisDB: Browser-Embedded In-Memory Relational Engine',
          tagline: 'WebAssembly-compiled SQL execution engine with reactive frontend subscribers.',
          domain: 'Systems & WebAssembly',
          problemStatement: 'Modern web applications repeatedly fetch identical relational datasets over high-latency networks instead of executing queries locally.',
          measurableObjectives: [
            'Execute complex JOIN queries over 200,000 rows under 15ms in browser main thread',
            'Sub-1MB compressed WASM binary footprint with zero external runtime dependencies',
            'Reactive React Hook API with automatic view re-render on database mutations'
          ],
          proposedSolution: 'Minimalist columnar database compiled to WebAssembly via Rust/C++, integrated into React via shared array buffers.',
          suggestedStack: {
            frontend: 'React + TypeScript',
            backend: 'Node.js (Sync Hub)',
            database: 'PostgreSQL',
            aiOrSpecialized: 'WebAssembly (WASM) / Rust Engine',
          },
          complexity: 'Advanced',
          estimatedWeeks: Math.min(student.targetDeadlineWeeks, 14),
          estimatedCost: '$0 (Zero Cloud Infrastructure)',
          prerequisites: ['TypeScript', 'Systems / Memory Layout Basics'],
        }
      ];
    }

    // Default Fallback: Applied Health & Clinical AI
    return [
      {
        id: 'idea-clinical-nlp-01',
        title: 'CliniTrace: Explainable Medical Entity Extractor & Dosage Checker',
        tagline: 'Transparent clinical note analyzer highlighting drug interactions with citation back-links.',
        domain: 'Healthcare & Explainable AI',
        problemStatement: 'Black-box medical language models often hallucinate pharmacological recommendations without verifiable provenance.',
        measurableObjectives: [
          'Achieve 93% precision on clinical entity recognition against MIMIC guidelines',
          'Every dosage alert paired with exact sentence span highlighting and medical guidelines link',
          'Strict HIPAA compliance via client-side de-identification pipeline'
        ],
        proposedSolution: 'Domain-adapted Transformer model with attention-weight explainability maps and deterministic drug-interaction rule verification.',
        suggestedStack: {
          frontend: 'React + Tailwind CSS',
          backend: 'Python FastAPI',
          database: 'PostgreSQL',
          aiOrSpecialized: 'BioBERT / Clinical NLP',
        },
        complexity: 'Intermediate',
        estimatedWeeks: Math.min(student.targetDeadlineWeeks, 10),
        estimatedCost: '$0 (Local CPU inference with ONNX)',
        prerequisites: ['Python', 'NLP Fundamentals', 'FastAPI'],
      },
      {
        id: 'idea-federated-health-02',
        title: 'SiloShield: Multi-Hospital Federated Survival Analysis',
        tagline: 'Collaborative oncology risk modeling without transmitting confidential patient EHR records.',
        domain: 'Federated Learning & Medical AI',
        problemStatement: 'Hospitals cannot pool oncology patient data due to strict GDPR and HIPAA regulations, limiting sample sizes for rare diseases.',
        measurableObjectives: [
          'Train Cox proportional hazards model matching centralized performance within 2% margin',
          'Differential privacy guarantee with epsilon <= 1.0 per round',
          'Tolerate asynchronous hospital node dropouts without training crash'
        ],
        proposedSolution: 'Flower/PySyft based federated aggregator with secure multi-party gradient verification.',
        suggestedStack: {
          frontend: 'React + Recharts',
          backend: 'Python FastAPI',
          database: 'PostgreSQL',
          aiOrSpecialized: 'Federated Learning (Flower/PySyft)',
        },
        complexity: 'Advanced',
        estimatedWeeks: Math.min(student.targetDeadlineWeeks, 14),
        estimatedCost: '$0 (Local Simulated Cluster)',
        prerequisites: ['Python', 'PyTorch', 'Distributed Systems Basics'],
      }
    ];
  }
}
