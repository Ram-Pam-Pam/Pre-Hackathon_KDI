import { useState, useRef } from 'react'
import axios from 'axios'
import './App.css'

function App() {
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState({ type: 'idle', message: '' })
  const [responseData, setResponseData] = useState(null)
  const [kaijuMode, setKaijuMode] = useState(false)
  const fileInputRef = useRef(null)

  const handleFileChange = (e) => {
    if (e.target.files?.length) {
      setFile(e.target.files[0])
      setStatus({ type: 'idle', message: '' })
      setResponseData(null)
    }
  }

  const triggerFileInput = () => {
    fileInputRef.current.click()
  }

  const toggleKaijuMode = () => {
    setKaijuMode(!kaijuMode)
  }

  const handleUpload = async () => {
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)

    setStatus({ type: 'loading', message: 'Analyzing payload...' })
    setResponseData(null)

    try {
      const response = await axios.post('http://localhost:8000/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      
      setStatus({ type: 'success', message: 'Payload verified and sanitized.' })
      setResponseData(response.data)
    } catch (error) {
      if (error.response?.status === 415) {
        setStatus({ type: 'error', message: `Critical Threat: ${error.response.data.detail}` })
      } else {
        setStatus({ type: 'error', message: 'Connection timeout.' })
      }
    }
  }

  return (
    <div className={`app-wrapper ${kaijuMode ? 'kaiju-theme' : 'standard-theme'}`}>
      
      {kaijuMode && (
        <div className="godzilla-container">
           <div className="css-godzilla">
             <div className="gz-tail"></div>
             <div className="gz-spike spike1"></div>
             <div className="gz-spike spike2"></div>
             <div className="gz-spike spike3"></div>
             <div className="gz-body"></div>
             <div className="gz-leg back-leg"></div>
             <div className="gz-leg front-leg"></div>
             <div className="gz-arm"></div>
             <div className="gz-head">
               <div className="gz-eye"></div>
               <div className="gz-jaw"></div>
               <div className="gz-fire"></div>
             </div>
           </div>
           <div className="flames"></div>
        </div>
      )}

      <div className="layout-container">
        <header className="header">
          <div className="header-top">
            <h1>The Data Refinery</h1>
            <button className="mode-toggle" onClick={toggleKaijuMode}>
              {kaijuMode ? 'DISABLE KAIJU' : 'INIT KAIJU MODE'}
            </button>
          </div>
          <p className="subtitle">Secure Unstructured Data Gateway</p>
        </header>

        <main className="main-content">
          <div className="card upload-section">
            <div 
              className={`drop-zone ${file ? 'has-file' : ''}`} 
              onClick={triggerFileInput}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                style={{ display: 'none' }} 
              />
              
              <svg className="upload-icon" width="64" height="64" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
              </svg>
              
              {file ? (
                <span className="file-name">{file.name} ({(file.size / 1024).toFixed(2)} KB)</span>
              ) : (
                <span className="placeholder-text">Insert payload or drag and drop</span>
              )}
            </div>

            <button 
              className="btn-primary" 
              onClick={handleUpload} 
              disabled={!file || status.type === 'loading'}
            >
              {status.type === 'loading' ? 'Processing...' : 'Execute Protocol'}
            </button>

            {status.message && (
              <div className={`alert alert-${status.type}`}>
                {status.message}
              </div>
            )}
          </div>

          {responseData && (
            <div className="card results-section">
              <div className="results-header">
                <h3>Refinery Output</h3>
                <span className="badge-success">Cleared</span>
              </div>
              <div className="json-viewer">
                <pre>{JSON.stringify(responseData, null, 2)}</pre>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default App