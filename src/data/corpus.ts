import { ExistingProjectSource } from '../types/domain';

export const RESEARCH_AND_OPEN_SOURCE_CORPUS: ExistingProjectSource[] = [
  {
    id: 'corpus-01',
    title: 'BirdNET: Acoustic Bioacoustic Bird Species Monitoring',
    description: 'Deep neural network trained on millions of bird sound recordings to identify thousands of avian species on edge devices and smartphones.',
    domain: 'Bioacoustics & Edge Audio',
    techStack: ['Python', 'TensorFlow Lite', 'Raspberry Pi', 'SQLite'],
    sourceType: 'IEEE/ArXiv',
    sourceUrl: 'https://birdnet.cornell.edu',
    keyDifferentiator: 'High species count acoustic classifier using spectrogram embeddings.'
  },
  {
    id: 'corpus-02',
    title: 'OpenPlantDoctor: Smartphone Crop Disease Identifier',
    description: 'Standard CNN-based leaf image classifier trained on the PlantVillage dataset for detecting pest symptoms from uploaded photos.',
    domain: 'Agriculture Computer Vision',
    techStack: ['PyTorch', 'FastAPI', 'Flutter', 'Docker'],
    sourceType: 'GitHub',
    sourceUrl: 'https://github.com/example/open-plant-doctor',
    keyDifferentiator: 'Single leaf RGB classification against pre-segmented lab images.'
  },
  {
    id: 'corpus-03',
    title: 'Excalidraw & Liveblocks: Collaborative Whiteboarding',
    description: 'Virtual whiteboard for sketching hand-drawn like diagrams with real-time multi-user synchronization over WebSockets.',
    domain: 'Real-time Collaboration',
    techStack: ['TypeScript', 'React', 'Canvas API', 'WebSockets'],
    sourceType: 'Commercial Product',
    keyDifferentiator: 'Frictionless vector canvas with CRDT-based multi-client merge.'
  },
  {
    id: 'corpus-04',
    title: 'MIMIC-ClinicalNotes-Extractor',
    description: 'Named Entity Recognition (NER) pipeline processing hospital discharge summaries to tag patient symptoms, drugs, and lab dosages.',
    domain: 'Clinical NLP',
    techStack: ['Python', 'HuggingFace Transformers', 'BioBERT', 'PostgreSQL'],
    sourceType: 'IEEE/ArXiv',
    keyDifferentiator: 'Static rule-assisted clinical BERT inference on de-identified MIMIC-III database.'
  },
  {
    id: 'corpus-05',
    title: 'AirQualityMesh: LoRaWAN Urban Particle Tracker',
    description: 'Microcontroller network deployed across streetlamps publishing PM2.5 and PM10 sensor values to a central Grafana dashboard.',
    domain: 'IoT & Environmental Tech',
    techStack: ['C++', 'ESP32', 'LoRaWAN', 'InfluxDB', 'Grafana'],
    sourceType: 'GitHub',
    keyDifferentiator: 'Low-power packet telemetry without edge inference or anomaly forecasting.'
  },
  {
    id: 'corpus-06',
    title: 'DevPod & Gitpod: Ephemeral Cloud Dev Environments',
    description: 'Orchestrator that spins up Docker containers containing VS Code web and configured toolchains from git repositories.',
    domain: 'Developer Tooling & Cloud IDE',
    techStack: ['Go', 'Docker', 'Kubernetes', 'WebSockets'],
    sourceType: 'Commercial Product',
    keyDifferentiator: 'Cloud-hosted container workspace isolation.'
  },
  {
    id: 'corpus-07',
    title: 'FedMed: Federated Multi-Hospital Brain Tumor Segmentation',
    description: 'PySyft based horizontal federated learning framework sharing weight gradients instead of raw MRI DICOM scans between medical centers.',
    domain: 'Federated Learning & Medical Imaging',
    techStack: ['Python', 'PyTorch', 'PySyft', 'MONAI'],
    sourceType: 'IEEE/ArXiv',
    keyDifferentiator: 'Privacy-preserving gradient exchange for 3D UNet medical segmentation.'
  },
  {
    id: 'corpus-08',
    title: 'CodeReviewBot: GitHub Action Static Linter and AST Flagger',
    description: 'Automated GitHub action that inspects Pull Request diffs for security antipatterns and cyclomatic complexity warnings.',
    domain: 'Developer Productivity',
    techStack: ['Node.js', 'Babel Parser', 'GitHub Octokit API'],
    sourceType: 'GitHub',
    keyDifferentiator: 'Rule-based AST matching on pull request commits.'
  }
];
