class LocalClassifier {
  constructor() {
    this.weights = new Map(); // tag -> weight vector
    this.biases = new Map(); // tag -> bias
    this.learningRate = 0.01;
    this.featureDim = 512; // CLAP embedding dimension
    this.isInitialized = false;
  }

  initialize(featureDim = 512) {
    this.featureDim = featureDim;
    this.isInitialized = true;
  }

  // Simple logistic regression training
  trainOnFeedback(features, tag, feedback) {
    if (!this.isInitialized) {
      this.initialize();
    }

    // Convert feedback to target value
    let target;
    switch (feedback) {
      case 'positive':
        target = 1.0;
        break;
      case 'negative':
        target = 0.0;
        break;
      case 'custom':
        target = 1.0;
        break;
      default:
        return; // Skip unknown feedback
    }

    // Initialize weights for new tag
    if (!this.weights.has(tag)) {
      this.weights.set(tag, new Array(this.featureDim).fill(0).map(() => 
        (Math.random() - 0.5) * 0.01
      ));
      this.biases.set(tag, 0);
    }

    const weights = this.weights.get(tag);
    const bias = this.biases.get(tag);

    // Forward pass
    let logit = bias;
    for (let i = 0; i < features.length; i++) {
      logit += weights[i] * features[i];
    }

    // Sigmoid activation
    const prediction = 1 / (1 + Math.exp(-logit));

    // Compute gradient
    const error = prediction - target;
    
    // Update weights and bias
    for (let i = 0; i < features.length; i++) {
      weights[i] -= this.learningRate * error * features[i];
    }
    this.biases.set(tag, bias - this.learningRate * error);

    // Store updated weights
    this.weights.set(tag, weights);
  }

  // Predict confidence for a tag given features
  predict(features, tag) {
    if (!this.weights.has(tag)) {
      return null; // No training data for this tag
    }

    const weights = this.weights.get(tag);
    const bias = this.biases.get(tag);

    let logit = bias;
    for (let i = 0; i < Math.min(features.length, weights.length); i++) {
      logit += weights[i] * features[i];
    }

    // Sigmoid activation
    return 1 / (1 + Math.exp(-logit));
  }

  // Get all predictions for given features
  predictAll(features, candidateTags) {
    const predictions = [];
    
    for (const tag of candidateTags) {
      const confidence = this.predict(features, tag);
      if (confidence !== null) {
        predictions.push({ tag, confidence });
      }
    }

    return predictions.sort((a, b) => b.confidence - a.confidence);
  }

  // Retrain on batch of feedback data
  retrainOnBatch(feedbackData) {
    for (const item of feedbackData) {
      if (item.audioFeatures && item.correctedTags) {
        // Create simple features from audio metadata
        const features = this.extractSimpleFeatures(item.audioFeatures);
        
        // Train on corrected tags
        for (const tagData of item.correctedTags) {
          this.trainOnFeedback(features, tagData.tag, tagData.feedback);
        }
      }
    }
  }

  // Extract simple features from audio metadata
  extractSimpleFeatures(audioFeatures) {
    // Create a simple feature vector from audio metadata
    // In a real implementation, this would use actual CLAP embeddings
    const features = new Array(this.featureDim).fill(0);
    
    if (audioFeatures) {
      // Use basic audio properties to create pseudo-features
      features[0] = audioFeatures.duration / 60; // Duration in minutes
      features[1] = audioFeatures.sampleRate / 48000; // Normalized sample rate
      features[2] = audioFeatures.numberOfChannels; // Number of channels
      
      // Fill remaining with small random values based on hash of properties
      const seed = this.simpleHash(JSON.stringify(audioFeatures));
      for (let i = 3; i < this.featureDim; i++) {
        features[i] = this.seededRandom(seed + i) * 0.1;
      }
    }
    
    return features;
  }

  // Simple hash function for seeded random
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  // Seeded random number generator
  seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  // Save model to localStorage
  saveModel() {
    const modelData = {
      weights: Object.fromEntries(this.weights),
      biases: Object.fromEntries(this.biases),
      featureDim: this.featureDim,
      learningRate: this.learningRate
    };
    
    localStorage.setItem('clipTaggerModel', JSON.stringify(modelData));
  }

  // Load model from localStorage
  loadModel() {
    const saved = localStorage.getItem('clipTaggerModel');
    if (saved) {
      try {
        const modelData = JSON.parse(saved);
        this.weights = new Map(Object.entries(modelData.weights));
        this.biases = new Map(Object.entries(modelData.biases));
        this.featureDim = modelData.featureDim || 512;
        this.learningRate = modelData.learningRate || 0.01;
        this.isInitialized = true;
        return true;
      } catch (error) {
        console.error('Error loading model:', error);
      }
    }
    return false;
  }

  // Get model statistics
  getModelStats() {
    return {
      trainedTags: this.weights.size,
      featureDim: this.featureDim,
      learningRate: this.learningRate,
      tags: Array.from(this.weights.keys())
    };
  }

  // Clear the model
  clearModel() {
    this.weights.clear();
    this.biases.clear();
    localStorage.removeItem('clipTaggerModel');
  }
}

export default LocalClassifier;