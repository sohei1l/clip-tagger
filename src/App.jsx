import { useState, useRef, useEffect } from 'react'
import CLAPProcessor from './clapProcessor'
import UserFeedbackStore from './userFeedbackStore'
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

  useEffect(() => {
    const initializeStore = async () => {
      feedbackStoreRef.current = new UserFeedbackStore()
      await feedbackStoreRef.current.initialize()
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
      
      const audioBuffer = await clapProcessorRef.current.fileToAudioBuffer(file)
      const generatedTags = await clapProcessorRef.current.processAudio(audioBuffer)
      
      // Store basic audio info for later use
      setAudioFeatures({
        sampleRate: audioBuffer.sampleRate,
        duration: audioBuffer.duration,
        numberOfChannels: audioBuffer.numberOfChannels
      })
      
      setTags(generatedTags.map(tag => ({ ...tag, userFeedback: null })))
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
      isCustom: true 
    }

    setTags(prev => [...prev, customTag])
    
    try {
      await feedbackStoreRef.current.saveCustomTag(newTag.trim())
      await feedbackStoreRef.current.saveTagFeedback(newTag.trim(), 'custom', audioHash)
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
                  <span className={`tag ${tag.isCustom ? 'custom' : ''} ${tag.userFeedback === 'negative' ? 'negative' : ''}`}>
                    {tag.label} ({Math.round(tag.confidence * 100)}%)
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
      </main>
    </div>
  )
}

export default App
