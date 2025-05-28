import { pipeline, AutoProcessor, ClapAudioModelWithProjection } from '@xenova/transformers';

class CLAPProcessor {
  constructor() {
    this.model = null;
    this.processor = null;
    this.defaultLabels = [
      'speech', 'music', 'singing', 'guitar', 'piano', 'drums', 'violin',
      'trumpet', 'saxophone', 'flute', 'classical music', 'rock music',
      'pop music', 'jazz', 'electronic music', 'ambient', 'nature sounds',
      'rain', 'wind', 'ocean waves', 'birds chirping', 'dog barking',
      'cat meowing', 'car engine', 'traffic', 'footsteps', 'door closing',
      'applause', 'laughter', 'crying', 'coughing', 'sneezing',
      'telephone ringing', 'alarm clock', 'typing', 'water running',
      'fire crackling', 'thunder', 'helicopter', 'airplane', 'train',
      'motorcycle', 'bell ringing', 'whistle', 'horn', 'siren',
      'explosion', 'gunshot', 'silence', 'noise', 'distortion'
    ];
  }

  async initialize() {
    if (this.model && this.processor) return;

    try {
      // Load the CLAP model and processor
      this.processor = await AutoProcessor.from_pretrained('Xenova/clap-htsat-unfused');
      this.model = await ClapAudioModelWithProjection.from_pretrained('Xenova/clap-htsat-unfused');
      
      console.log('CLAP model loaded successfully');
    } catch (error) {
      console.error('Failed to load CLAP model:', error);
      throw error;
    }
  }

  async processAudio(audioBuffer) {
    if (!this.model || !this.processor) {
      await this.initialize();
    }

    try {
      // Convert audio to the format expected by CLAP
      const audio = await this.preprocessAudio(audioBuffer);
      
      // Process audio through the model
      const audioInputs = await this.processor(audio);
      const audioFeatures = await this.model.get_audio_features(audioInputs);
      
      // Process text labels
      const textInputs = await this.processor.text(this.defaultLabels);
      const textFeatures = await this.model.get_text_features(textInputs);
      
      // Calculate similarities
      const similarities = await this.calculateSimilarities(audioFeatures, textFeatures);
      
      // Return top tags with confidence scores
      return this.getTopTags(similarities, 5);
    } catch (error) {
      console.error('Error processing audio:', error);
      throw error;
    }
  }

  async preprocessAudio(audioBuffer) {
    // Convert to mono if stereo
    let audioData;
    if (audioBuffer.numberOfChannels > 1) {
      audioData = new Float32Array(audioBuffer.length);
      for (let i = 0; i < audioBuffer.length; i++) {
        let sum = 0;
        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
          sum += audioBuffer.getChannelData(channel)[i];
        }
        audioData[i] = sum / audioBuffer.numberOfChannels;
      }
    } else {
      audioData = audioBuffer.getChannelData(0);
    }

    // Resample to 48kHz if needed (CLAP expects 48kHz)
    const targetSampleRate = 48000;
    if (audioBuffer.sampleRate !== targetSampleRate) {
      audioData = await this.resampleAudio(audioData, audioBuffer.sampleRate, targetSampleRate);
    }

    return audioData;
  }

  async resampleAudio(audioData, originalRate, targetRate) {
    // Simple linear interpolation resampling
    const ratio = originalRate / targetRate;
    const newLength = Math.round(audioData.length / ratio);
    const resampled = new Float32Array(newLength);
    
    for (let i = 0; i < newLength; i++) {
      const originalIndex = i * ratio;
      const indexFloor = Math.floor(originalIndex);
      const indexCeil = Math.min(indexFloor + 1, audioData.length - 1);
      const fraction = originalIndex - indexFloor;
      
      resampled[i] = audioData[indexFloor] * (1 - fraction) + audioData[indexCeil] * fraction;
    }
    
    return resampled;
  }

  async calculateSimilarities(audioFeatures, textFeatures) {
    // Calculate cosine similarity between audio and text features
    const audioVector = audioFeatures.data;
    const similarities = [];

    for (let i = 0; i < this.defaultLabels.length; i++) {
      const textVector = textFeatures.data.slice(
        i * audioVector.length, 
        (i + 1) * audioVector.length
      );
      
      const similarity = this.cosineSimilarity(audioVector, textVector);
      similarities.push(similarity);
    }

    return similarities;
  }

  cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  getTopTags(similarities, topK = 5) {
    const tagged = this.defaultLabels.map((label, index) => ({
      label,
      confidence: Math.max(0, similarities[index]) // Ensure non-negative
    }));

    return tagged
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, topK);
  }

  // Convert file to AudioBuffer
  async fileToAudioBuffer(file) {
    const arrayBuffer = await file.arrayBuffer();
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    return await audioContext.decodeAudioData(arrayBuffer);
  }
}

export default CLAPProcessor;