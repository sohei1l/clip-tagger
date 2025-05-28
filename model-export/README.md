---
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

```javascript
import { CLAPProcessor } from './clapProcessor.js';
import { LocalClassifier } from './localClassifier.js';

// Load the model
const processor = new CLAPProcessor();
const classifier = new LocalClassifier();
classifier.loadModel(); // Loads from localStorage or model files

// Process audio
const tags = await processor.processAudio(audioBuffer);
const personalizedTags = classifier.predictAll(features, candidateTags);
```

## Files

- `localClassifier.js` - Local classifier implementation
- `clapProcessor.js` - CLAP model wrapper
- `userFeedbackStore.js` - User feedback storage system
- `model-config.json` - Model configuration
- `example-usage.html` - Usage example

## Demo

Try the live demo: [clip-tagger Space](https://huggingface.co/spaces/sohei1l/clip-tagger)

## Training Data

This model learns from user corrections and custom tags. The base CLAP model provides initial audio understanding, while the local classifier adapts to user preferences.
