// Script to export trained model for Hugging Face
import fs from 'fs';
import path from 'path';

// Create model export directory
const exportDir = './model-export';
if (!fs.existsSync(exportDir)) {
  fs.mkdirSync(exportDir);
}

// Create model card (README.md for the model repo)
const modelCard = `---
license: mit
base_model: Xenova/clap-htsat-unfused
tags:
- audio-classification
- transformers.js
- clap
- audio-tagging
library_name: transformers.js
---

# clip-tagger Model

This is a personalized audio tagging model based on CLAP (Contrastive Language-Audio Pre-training). It extends the base Xenova/clap-htsat-unfused model with user feedback and custom tags.

## Model Description

- **Base Model**: [Xenova/clap-htsat-unfused](https://huggingface.co/Xenova/clap-htsat-unfused)
- **Framework**: Transformers.js compatible
- **Training**: User feedback and custom tag integration
- **Use Case**: Personalized audio content tagging

## Usage

\`\`\`javascript
import { CLAPProcessor } from './clapProcessor.js';
import { LocalClassifier } from './localClassifier.js';

// Load the model
const processor = new CLAPProcessor();
const classifier = new LocalClassifier();
classifier.loadModel(); // Loads from localStorage or model files

// Process audio
const tags = await processor.processAudio(audioBuffer);
const personalizedTags = classifier.predictAll(features, candidateTags);
\`\`\`

## Files

- \`localClassifier.js\` - Local classifier implementation
- \`clapProcessor.js\` - CLAP model wrapper
- \`userFeedbackStore.js\` - User feedback storage system
- \`model-config.json\` - Model configuration
- \`example-usage.html\` - Usage example

## Demo

Try the live demo: [clip-tagger Space](https://huggingface.co/spaces/sohei1l/clip-tagger)

## Training Data

This model learns from user corrections and custom tags. The base CLAP model provides initial audio understanding, while the local classifier adapts to user preferences.
`;

fs.writeFileSync(path.join(exportDir, 'README.md'), modelCard);

// Create model configuration
const modelConfig = {
  "model_type": "clip-tagger",
  "base_model": "Xenova/clap-htsat-unfused",
  "version": "1.0.0",
  "framework": "transformers.js",
  "feature_dim": 512,
  "learning_rate": 0.01,
  "supported_formats": ["wav", "mp3", "m4a", "ogg"],
  "default_labels": [
    "speech", "music", "singing", "guitar", "piano", "drums", "violin",
    "trumpet", "saxophone", "flute", "classical music", "rock music",
    "pop music", "jazz", "electronic music", "ambient", "nature sounds",
    "rain", "wind", "ocean waves", "birds chirping", "dog barking",
    "cat meowing", "car engine", "traffic", "footsteps", "door closing",
    "applause", "laughter", "crying", "coughing", "sneezing",
    "telephone ringing", "alarm clock", "typing", "water running",
    "fire crackling", "thunder", "helicopter", "airplane", "train",
    "motorcycle", "bell ringing", "whistle", "horn", "siren",
    "explosion", "gunshot", "silence", "noise", "distortion"
  ]
};

fs.writeFileSync(path.join(exportDir, 'model-config.json'), JSON.stringify(modelConfig, null, 2));

// Copy the main model files
const filesToCopy = [
  'src/clapProcessor.js',
  'src/localClassifier.js', 
  'src/userFeedbackStore.js'
];

filesToCopy.forEach(file => {
  if (fs.existsSync(file)) {
    const fileName = path.basename(file);
    fs.copyFileSync(file, path.join(exportDir, fileName));
  }
});

// Create example usage file
const exampleUsage = `<!DOCTYPE html>
<html>
<head>
    <title>clip-tagger Model Usage Example</title>
    <script type="module">
        import { CLAPProcessor } from './clapProcessor.js';
        import { LocalClassifier } from './localClassifier.js';
        
        async function loadModel() {
            const processor = new CLAPProcessor();
            const classifier = new LocalClassifier();
            
            // Initialize
            await processor.initialize();
            classifier.loadModel();
            
            console.log('Model loaded successfully!');
            console.log('Model stats:', classifier.getModelStats());
        }
        
        // Load when page loads
        loadModel();
    </script>
</head>
<body>
    <h1>clip-tagger Model</h1>
    <p>Check the browser console for model loading status.</p>
    <p>See the full demo at: <a href="https://huggingface.co/spaces/sohei1l/clip-tagger">clip-tagger Space</a></p>
</body>
</html>`;

fs.writeFileSync(path.join(exportDir, 'example-usage.html'), exampleUsage);

console.log('Model export created in:', exportDir);
console.log('Files exported:');
fs.readdirSync(exportDir).forEach(file => {
  console.log('-', file);
});