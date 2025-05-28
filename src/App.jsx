import { useState, useRef, useEffect } from 'react'
import CLAPProcessor from './clapProcessor'
import UserFeedbackStore from './userFeedbackStore'
import LocalClassifier from './localClassifier'
import './App.css'

function App() {
  const [audioFile, setAudioFile] = useState(null)
  const [isRecording, setIsRecording] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [tags, setTags] = useState([])
  const [error, setError] = useState(null)
  const [customTags, setCustomTags] = useState([])
  const [newTag, setNewTag] = useState('')
  const [audioHash, setAudioHash] = useState(null)
  const [audioFeatures, setAudioFeatures] = useState(null)
  const fileInputRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const clapProcessorRef = useRef(null)
  const feedbackStoreRef = useRef(null)
  const localClassifierRef = useRef(null)

  useEffect(() => {
    const initializeStore = async () => {
      feedbackStoreRef.current = new UserFeedbackStore()
      await feedbackStoreRef.current.initialize()
      
      localClassifierRef.current = new LocalClassifier()
      localClassifierRef.current.loadModel()
      
      loadCustomTags()
    }
    initializeStore()
  }, [])

  const loadCustomTags = async () => {
    try {
      const stored = await feedbackStoreRef.current.getCustomTags()
      setCustomTags(stored.map(item => item.tag))
    } catch (error) {
      console.error('Error loading custom tags:', error)
    }
  }

  const handleFileUpload = (event) => {
    const file = event.target.files[0]
    if (file && file.type.startsWith('audio/')) {
      setAudioFile(file)
      processAudio(file)
    }
  }

  const handleDrop = (event) => {
    event.preventDefault()
    const file = event.dataTransfer.files[0]
    if (file && file.type.startsWith('audio/')) {
      setAudioFile(file)
      processAudio(file)
    }
  }

  const handleDragOver = (event) => {
    event.preventDefault()
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorderRef.current = new MediaRecorder(stream)
      chunksRef.current = []

      mediaRecorderRef.current.ondataavailable = (event) => {
        chunksRef.current.push(event.data)
      }

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/wav' })
        const file = new File([blob], 'recording.wav', { type: 'audio/wav' })
        setAudioFile(file)
        processAudio(file)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorderRef.current.start()
      setIsRecording(true)
    } catch (error) {
      console.error('Error accessing microphone:', error)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const processAudio = async (file) => {
    setIsLoading(true)
    setTags([])
    setError(null)
    
    try {
      if (!clapProcessorRef.current) {
        clapProcessorRef.current = new CLAPProcessor()
      }
      
      const hash = await feedbackStoreRef.current.hashAudioFile(file)
      setAudioHash(hash)
      
      console.log('Converting file to audio buffer...')
      const audioBuffer = await clapProcessorRef.current.fileToAudioBuffer(file)
      console.log('Audio buffer created:', {
        duration: audioBuffer.duration,
        sampleRate: audioBuffer.sampleRate,
        channels: audioBuffer.numberOfChannels
      })
      
      console.log('Processing audio with CLAP...')
      const generatedTags = await clapProcessorRef.current.processAudio(audioBuffer)
      console.log('Generated tags:', generatedTags)
      
      // Store basic audio info for later use
      const features = {
        sampleRate: audioBuffer.sampleRate,
        duration: audioBuffer.duration,
        numberOfChannels: audioBuffer.numberOfChannels
      }
      setAudioFeatures(features)
      
      // Apply local classifier adjustments
      let finalTags = generatedTags.map(tag => ({ ...tag, userFeedback: null }))
      
      if (localClassifierRef.current) {
        const simpleFeatures = localClassifierRef.current.extractSimpleFeatures(features)
        const allPossibleTags = [...generatedTags.map(t => t.label), ...customTags]
        const localPredictions = localClassifierRef.current.predictAll(simpleFeatures, allPossibleTags)
        
        // Merge CLAP predictions with local classifier predictions
        const mergedTags = new Map()
        
        // Add CLAP tags
        for (const tag of generatedTags) {
          mergedTags.set(tag.label, { ...tag, source: 'clap' })
        }
        
        // Add or adjust with local predictions
        for (const pred of localPredictions) {
          if (mergedTags.has(pred.tag)) {
            // Blend CLAP and local predictions
            const existing = mergedTags.get(pred.tag)
            existing.confidence = (existing.confidence + pred.confidence) / 2
            existing.source = 'blended'
          } else if (pred.confidence > 0.6) {
            // Add high-confidence local predictions
            mergedTags.set(pred.tag, {
              label: pred.tag,
              confidence: pred.confidence,
              source: 'local',
              userFeedback: null
            })
          }
        }
        
        finalTags = Array.from(mergedTags.values())
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, 8) // Keep top 8 tags
      }
      
      setTags(finalTags)
    } catch (err) {
      console.error('Error processing audio:', err)
      setError('Failed to process audio. Using fallback tags.')
      // Fallback tags
      setTags([
        { label: 'audio', confidence: 0.9, userFeedback: null },
        { label: 'sound', confidence: 0.8, userFeedback: null },
        { label: 'recording', confidence: 0.7, userFeedback: null }
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleTagFeedback = async (tagIndex, feedback) => {
    const updatedTags = [...tags]
    updatedTags[tagIndex].userFeedback = feedback
    setTags(updatedTags)

    try {
      await feedbackStoreRef.current.saveTagFeedback(
        updatedTags[tagIndex].label,
        feedback,
        audioHash
      )

      // Train local classifier on this feedback
      if (localClassifierRef.current && audioFeatures) {
        const simpleFeatures = localClassifierRef.current.extractSimpleFeatures(audioFeatures)
        localClassifierRef.current.trainOnFeedback(
          simpleFeatures,
          updatedTags[tagIndex].label,
          feedback
        )
        localClassifierRef.current.saveModel()
      }
    } catch (error) {
      console.error('Error saving tag feedback:', error)
    }
  }

  const handleAddCustomTag = async () => {
    if (!newTag.trim()) return

    const customTag = { 
      label: newTag.trim(), 
      confidence: 1.0, 
      userFeedback: 'custom',
      isCustom: true,
      source: 'custom'
    }

    setTags(prev => [...prev, customTag])
    
    try {
      await feedbackStoreRef.current.saveCustomTag(newTag.trim())
      await feedbackStoreRef.current.saveTagFeedback(newTag.trim(), 'custom', audioHash)
      
      // Train local classifier on custom tag
      if (localClassifierRef.current && audioFeatures) {
        const simpleFeatures = localClassifierRef.current.extractSimpleFeatures(audioFeatures)
        localClassifierRef.current.trainOnFeedback(
          simpleFeatures,
          newTag.trim(),
          'custom'
        )
        localClassifierRef.current.saveModel()
      }
      
      loadCustomTags()
    } catch (error) {
      console.error('Error saving custom tag:', error)
    }

    setNewTag('')
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleAddCustomTag()
    }
  }

  const exportModel = async () => {
    try {
      const modelStats = localClassifierRef.current?.getModelStats()
      const feedbackData = await feedbackStoreRef.current.getAudioFeedback()
      const customTagsData = await feedbackStoreRef.current.getCustomTags()
      
      const exportData = {
        modelStats,
        feedbackData: feedbackData.slice(0, 50), // Limit for size
        customTags: customTagsData,
        exportDate: new Date().toISOString(),
        version: '1.0'
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `clip-tagger-model-${Date.now()}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting model:', error)
      setError('Failed to export model')
    }
  }

  const exportTags = () => {
    if (tags.length === 0) return

    const tagData = {
      audioFile: audioFile?.name || 'recorded-audio',
      audioHash,
      timestamp: new Date().toISOString(),
      tags: tags.map(tag => ({
        label: tag.label,
        confidence: tag.confidence,
        source: tag.source || 'clap',
        userFeedback: tag.userFeedback
      }))
    }

    const blob = new Blob([JSON.stringify(tagData, null, 2)], {
      type: 'application/json'
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tags-${audioFile?.name || 'audio'}-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const clearAllData = async () => {
    if (confirm('Are you sure you want to clear all training data? This cannot be undone.')) {
      try {
        await feedbackStoreRef.current.clearAllData()
        localClassifierRef.current?.clearModel()
        setCustomTags([])
        setTags([])
        setAudioFile(null)
        setError(null)
      } catch (error) {
        console.error('Error clearing data:', error)
        setError('Failed to clear data')
      }
    }
  }

  return (
    <div className="app">
      <header>
        <h1>🎵 clip-tagger</h1>
        <p>Custom audio tagging in the browser</p>
      </header>

      <main>
        <div 
          className="upload-area"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            hidden
          />
          <div className="upload-content">
            {audioFile ? (
              <div>
                <p>📁 {audioFile.name}</p>
                <audio controls src={URL.createObjectURL(audioFile)} />
              </div>
            ) : (
              <div>
                <p>🎵 Drop an audio file here or click to upload</p>
                <p>Supports WAV, MP3, and other audio formats</p>
              </div>
            )}
          </div>
        </div>

        <div className="controls">
          <button 
            onClick={isRecording ? stopRecording : startRecording}
            className={isRecording ? 'recording' : ''}
          >
            {isRecording ? '⏹️ Stop Recording' : '🎤 Record Audio'}
          </button>
        </div>

        {isLoading && (
          <div className="loading">
            <p>🧠 Analyzing audio with CLAP model...</p>
            <p style={{fontSize: '0.9em', opacity: 0.8}}>
              {tags.length === 0 ? 'Loading model (~45MB)...' : 'Processing audio...'}
            </p>
          </div>
        )}

        {error && (
          <div className="error">
            <p>⚠️ {error}</p>
          </div>
        )}

        {tags.length > 0 && (
          <div className="tags-section">
            <h3>Generated Tags</h3>
            <div className="tags">
              {tags.map((tag, index) => (
                <div key={index} className={`tag-item ${tag.userFeedback ? 'has-feedback' : ''}`}>
                  <span className={`tag ${tag.isCustom ? 'custom' : ''} ${tag.userFeedback === 'negative' ? 'negative' : ''} ${tag.source || 'clap'}`}>
                    {tag.label} ({Math.round(tag.confidence * 100)}%)
                    {tag.source === 'local' && <span className="source-indicator">🧠</span>}
                    {tag.source === 'blended' && <span className="source-indicator">⚡</span>}
                    {tag.source === 'custom' && <span className="source-indicator">✨</span>}
                  </span>
                  {!tag.isCustom && (
                    <div className="tag-controls">
                      <button 
                        onClick={() => handleTagFeedback(index, 'positive')}
                        className={`feedback-btn ${tag.userFeedback === 'positive' ? 'active' : ''}`}
                        title="Good tag"
                      >
                        ✓
                      </button>
                      <button 
                        onClick={() => handleTagFeedback(index, 'negative')}
                        className={`feedback-btn ${tag.userFeedback === 'negative' ? 'active' : ''}`}
                        title="Bad tag"
                      >
                        ✗
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <div className="add-tag">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Add custom tag..."
                className="tag-input"
              />
              <button onClick={handleAddCustomTag} className="add-tag-btn">
                Add Tag
              </button>
            </div>

            {customTags.length > 0 && (
              <div className="frequent-tags">
                <h4>Frequent Tags:</h4>
                <div className="frequent-tag-list">
                  {customTags.slice(0, 10).map((tag, index) => (
                    <button
                      key={index}
                      onClick={() => setNewTag(tag)}
                      className="frequent-tag"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {(tags.length > 0 || customTags.length > 0) && (
          <div className="export-section">
            <h3>Export & Management</h3>
            <div className="export-controls">
              {tags.length > 0 && (
                <button onClick={exportTags} className="export-btn">
                  📁 Export Current Tags
                </button>
              )}
              {localClassifierRef.current?.getModelStats().trainedTags > 0 && (
                <button onClick={exportModel} className="export-btn">
                  🧠 Export Trained Model
                </button>
              )}
              <button onClick={clearAllData} className="clear-btn">
                🗑️ Clear All Data
              </button>
            </div>
            
            {localClassifierRef.current && (
              <div className="model-stats">
                <p>Trained tags: {localClassifierRef.current.getModelStats().trainedTags}</p>
                <p>Custom tags: {customTags.length}</p>
              </div>
            )}
          </div>
        )}
      </main>
      
      <footer>
        <p>
          Powered by <a href="https://github.com/xenova/transformers.js" target="_blank" rel="noopener">Transformers.js</a> 
          {' '} • CLAP model: <a href="https://huggingface.co/Xenova/clap-htsat-unfused" target="_blank" rel="noopener">Xenova/clap-htsat-unfused</a>
          {' '} • Everything runs locally in your browser
        </p>
      </footer>
    </div>
  )
}

export default App
