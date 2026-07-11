import React, { useState, useRef, useEffect } from 'react';
import * as htmlToImage from 'html-to-image';
import {
  Sparkles,
  Upload,
  Download,
  RefreshCw,
  ArrowLeft,
  AlertCircle,
  Check,
  Image,
  Users,
  ChevronRight,
  Zap,
  Target,
  FileJson,
  Clock,
  Trash2,
  Eye,
  X,
  Grid,
  Play,
  ShieldAlert,
} from 'lucide-react';

// ──────────────────────────────────────────────────────────
// SCREEN STATES
// ──────────────────────────────────────────────────────────
// 'upload'       → Drop JSON file
// 'personas'     → Pick a persona from the JSON
// 'loading'      → Generating avatar via HeyGen
// 'result'       → Display the generated persona board image
// 'history'      → Browse all previously generated boards
// 'historyView'  → View a single board from history

export default function App() {
  const [screen, setScreen] = useState('upload');
  const [brandData, setBrandData] = useState(null);
  const [brandName, setBrandName] = useState('');
  const [personas, setPersonas] = useState([]);
  const [selectedPersona, setSelectedPersona] = useState(0);
  const [generatedImage, setGeneratedImage] = useState(null); // { avatar, background, hasBackground, historyId, ... }
  const [errorMessage, setErrorMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);

  // History state
  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [viewingHistoryItem, setViewingHistoryItem] = useState(null); // metadata object
  const [videoStatus, setVideoStatus] = useState('none'); // 'none', 'processing', 'completed', 'failed'
  const [videoUrl, setVideoUrl] = useState(null);
  const [videoError, setVideoError] = useState(null);

  // DOM references for dynamic HTML board scaling & image export
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [previewTab, setPreviewTab] = useState('composite'); // 'composite', 'avatar', 'background'
  const [selectedGenderRep, setSelectedGenderRep] = useState('Female');

  const fileInputRef = useRef(null);

  // ── File handling ──────────────────────────────────────

  const processJsonFile = (file) => {
    if (!file) return;
    if (!file.name.endsWith('.json')) {
      setErrorMessage('Please upload a valid .json file.');
      return;
    }
    setErrorMessage('');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        setBrandData(data);

        // Extract brand info
        const bi = data.brandIdentity || {};
        setBrandName(bi.brandName || file.name.replace('.json', ''));

        // Extract personas
        const profiles = data.idealClientProfiles || [];
        setPersonas(profiles);
        setSelectedPersona(0);

        if (profiles.length === 0) {
          setErrorMessage('No ideal client profiles found in this JSON file.');
          return;
        }

        // Go to persona selection
        setScreen('personas');
      } catch (err) {
        setErrorMessage('Failed to parse JSON file. Please ensure it is valid JSON.');
      }
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    processJsonFile(e.dataTransfer.files?.[0]);
  };
  const handleFileChange = (e) => processJsonFile(e.target.files?.[0]);

  // ── Generation ─────────────────────────────────────────

  const generateBoard = async () => {
    if (!brandData) return;
    setScreen('loading');
    setErrorMessage('');
    setLoadingStep(0);
    setGeneratedImage(null);
    setVideoStatus('none');
    setVideoUrl(null);
    setVideoError(null);

    // Simulate step progression
    const stepTimer1 = setTimeout(() => setLoadingStep(1), 800);
    const stepTimer2 = setTimeout(() => setLoadingStep(2), 2500);
    const stepTimer3 = setTimeout(() => setLoadingStep(3), 5000);

    try {
      const res = await fetch('/api/generate-persona-board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandData,
          personaIndex: selectedPersona,
          representativeGender: (personas[selectedPersona]?.gender || '').toLowerCase().includes('all') ? selectedGenderRep : undefined
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.detail || 'Failed to generate persona board.');

      setGeneratedImage(result);
      setVideoStatus(result.videoStatus || 'none');
      setVideoUrl(result.videoUrl || null);
      setVideoError(result.videoError || null);
      setScreen('result');
    } catch (err) {
      setErrorMessage(err.message);
      setScreen('personas');
    } finally {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      clearTimeout(stepTimer3);
    }
  };

  const handleRegenerate = () => {
    setGeneratedImage(null);
    generateBoard();
  };

  const handleReset = () => {
    setScreen('upload');
    setBrandData(null);
    setBrandName('');
    setPersonas([]);
    setSelectedPersona(0);
    setGeneratedImage(null);
    setErrorMessage('');
    setVideoStatus('none');
    setVideoUrl(null);
    setVideoError(null);
  };

  // ── Helper to extract brand colors ────────────────────
  const getBrandColors = (data) => {
    const defaultColors = { primary: '#6366f1', secondary: '#06b6d4' };
    if (!data) return defaultColors;
    const colors = data.brandIdentity?.brandColors || [];
    let primary = null;
    let secondary = null;

    for (const c of colors) {
      const cl = c.trim().toLowerCase();
      if (cl !== '#ffffff' && cl !== '#fff' && cl !== 'white' && !cl.includes('transparent') && cl.startsWith('#')) {
        if (!primary) {
          primary = c.trim();
        } else if (!secondary && c.trim() !== primary) {
          secondary = c.trim();
          break;
        }
      }
    }
    return {
      primary: primary || defaultColors.primary,
      secondary: secondary || primary || defaultColors.secondary
    };
  };

  // ── Dynamic scaling observer for HTML board canvas ─────
  useEffect(() => {
    const handleResize = () => {
      if (!wrapperRef.current || !canvasRef.current) return;
      const wrapperWidth = wrapperRef.current.clientWidth;
      const canvasWidth = 1080;
      const newScale = Math.min(wrapperWidth / canvasWidth, 1);
      setScale(newScale);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    
    let observer;
    if (wrapperRef.current) {
      observer = new ResizeObserver(handleResize);
      observer.observe(wrapperRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (observer) observer.disconnect();
    };
  }, [screen, generatedImage, viewingHistoryItem]);

  // ── Polling for HeyGen video status ─────────────────────
  useEffect(() => {
    if (videoStatus !== 'processing') return;

    const activeId = screen === 'result' ? generatedImage?.historyId : viewingHistoryItem?.id;
    if (!activeId) return;

    let intervalId;
    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/history/${activeId}/video-status`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.videoStatus === 'completed') {
          setVideoStatus('completed');
          setVideoUrl(data.videoUrl);
          // Also update the active item's cache
          if (screen === 'result') {
            setGeneratedImage(prev => prev ? { ...prev, videoStatus: 'completed', videoUrl: data.videoUrl } : null);
          } else {
            setViewingHistoryItem(prev => prev ? { ...prev, videoStatus: 'completed', videoUrl: data.videoUrl } : null);
          }
        } else if (data.videoStatus === 'failed') {
          setVideoStatus('failed');
          setVideoError(data.videoError || 'Video rendering failed');
        }
      } catch (e) {
        console.error("Error polling video status:", e);
      }
    };

    // Check immediately, then poll every 4 seconds
    checkStatus();
    intervalId = setInterval(checkStatus, 4000);

    return () => clearInterval(intervalId);
  }, [screen, videoStatus, generatedImage?.historyId, viewingHistoryItem?.id]);

  // ── Browser-side PNG Renderer and Exporter ─────────────
  const exportBoardAsPng = () => {
    if (!canvasRef.current) return;
    
    const activeBoardData = screen === 'result' ? generatedImage : viewingHistoryItem;
    const activePersonaName = personas[selectedPersona]?.name || activeBoardData?.personaName || 'persona';
    const activeBrandName = brandName || activeBoardData?.brandName || 'brand';
    
    setErrorMessage('Rendering and exporting high-resolution PNG... Please wait.');
    
    // Temporarily reset zoom/scale transform for crisp rendering
    const originalTransform = canvasRef.current.style.transform;
    canvasRef.current.style.transform = 'none';

    htmlToImage.toPng(canvasRef.current, {
      quality: 0.95,
      pixelRatio: 2, // 2x supersampling for high-quality printing
    })
    .then((dataUrl) => {
      canvasRef.current.style.transform = originalTransform;
      const downloadName = `${activeBrandName.replace(/\s+/g, '_')}_${activePersonaName.replace(/\s+/g, '_')}_persona_board.png`;
      downloadAsset(dataUrl, downloadName);
      setErrorMessage('');
    })
    .catch((err) => {
      canvasRef.current.style.transform = originalTransform;
      setErrorMessage('Export failed: ' + err.message);
    });
  };

  // ── Asset Downloader Helper (Uses Blob URLs for reliability) ──
  const downloadAsset = (urlOrBase64, defaultName) => {
    if (!urlOrBase64) return;
    const link = document.createElement('a');
    
    // Check if it's a relative path or absolute http/https URL
    if (urlOrBase64.startsWith('/') || urlOrBase64.startsWith('http')) {
      link.href = urlOrBase64;
      link.download = defaultName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // It is a base64 string or data URL (convert to Blob to bypass browser security blocks)
    try {
      let base64Data = urlOrBase64;
      if (urlOrBase64.startsWith('data:')) {
        const parts = urlOrBase64.split(',');
        base64Data = parts[1] || parts[0];
      }
      
      const binaryStr = window.atob(base64Data);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      
      const blob = new Blob([bytes], { type: 'image/png' });
      const blobUrl = URL.createObjectURL(blob);
      
      link.href = blobUrl;
      link.download = defaultName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Revoke after download is complete
      setTimeout(() => URL.revokeObjectURL(blobUrl), 200);
    } catch (e) {
      console.error("Blob download failed, falling back to direct navigation:", e);
      link.href = urlOrBase64.startsWith('data:') ? urlOrBase64 : `data:image/png;base64,${urlOrBase64}`;
      link.download = defaultName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // ── History ────────────────────────────────────────────

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      setHistoryItems(data.items || []);
    } catch (err) {
      setErrorMessage('Failed to load history.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const openHistory = () => {
    setScreen('history');
    fetchHistory();
  };

  const viewHistoryItem = (item) => {
    setViewingHistoryItem(item);
    setVideoStatus(item.videoStatus || 'none');
    setVideoUrl(item.videoUrl || null);
    setVideoError(item.videoError || null);
    setScreen('historyView');
  };

  const downloadHistoryImage = (item) => {
    const link = document.createElement('a');
    link.href = `/api/history/${item.id}/image`;
    link.download = `${item.brandName}_${item.personaName}_persona_board.${item.fileName?.split('.').pop() || 'png'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const deleteHistoryItem = async (item, e) => {
    if (e) e.stopPropagation();
    if (!confirm(`Delete the persona board for "${item.personaName}" from ${item.brandName}?`)) return;
    try {
      await fetch(`/api/history/${item.id}`, { method: 'DELETE' });
      setHistoryItems(prev => prev.filter(h => h.id !== item.id));
      // If we're viewing this item, go back to history
      if (viewingHistoryItem?.id === item.id) {
        setViewingHistoryItem(null);
        setScreen('history');
      }
    } catch (err) {
      setErrorMessage('Failed to delete.');
    }
  };

  const formatDate = (isoStr) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes > 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  // ── Helper to get brand accent color ───────────────────

  const getBrandAccent = () => {
    if (!brandData) return 'var(--accent)';
    const colors = brandData.brandIdentity?.brandColors || [];
    for (const c of colors) {
      const cl = c.trim().toLowerCase();
      if (cl.startsWith('#') && cl !== '#ffffff' && cl !== '#fff' && cl.length >= 4) {
        return c.trim();
      }
    }
    return 'var(--accent)';
  };

  // ── Render ─────────────────────────────────────────────

  return (
    <div className="app-shell">

      {/* ═══ HEADER ═══ */}
      <header className="app-header">
        <div className="app-logo">
          <div className="app-logo-icon">
            <Sparkles size={20} />
          </div>
          <div>
            <h1>ADNOVA</h1>
            <span>Persona Board Studio</span>
          </div>
        </div>

        <div className="header-actions">
          {/* History button — always visible */}
          <button
            className={`btn-secondary ${screen === 'history' || screen === 'historyView' ? 'active' : ''}`}
            onClick={openHistory}
          >
            <Clock size={14} />
            History
          </button>

          {screen !== 'upload' && screen !== 'history' && screen !== 'historyView' && (
            <button className="btn-secondary" onClick={handleReset}>
              <ArrowLeft size={14} />
              New Upload
            </button>
          )}

          {(screen === 'history' || screen === 'historyView') && (
            <button className="btn-secondary" onClick={handleReset}>
              <Upload size={14} />
              Generate New
            </button>
          )}
        </div>
      </header>

      {/* ═══ ERROR BANNER ═══ */}
      {errorMessage && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '0 40px', marginTop: '16px' }}>
          <div className="error-banner animate-fade-in">
            <AlertCircle size={18} color="var(--danger)" />
            <div className="error-banner-text">{errorMessage}</div>
            <button className="error-banner-close" onClick={() => setErrorMessage('')}>×</button>
          </div>
        </div>
      )}

      {/* ═══ MAIN ═══ */}
      <main className="app-main">

        {/* ─── UPLOAD SCREEN ─── */}
        {screen === 'upload' && (
          <div className="upload-screen animate-fade-in">
            <div className="upload-hero">
              <div className="upload-hero-icon">
                <Image size={30} />
              </div>
              <h2>Generate Premium<br />Customer Persona Boards</h2>
              <p>
                Upload your brand research JSON file and let AI create stunning, 
                Fortune 500-quality persona boards powered by HeyGen avatar generation.
              </p>
            </div>

            <div
              className={`drop-zone ${isDragging ? 'dragging' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="drop-zone-icon" size={36} />
              <div className="drop-zone-text">
                Drop your <strong>.json</strong> file here, or <strong>click to browse</strong>
              </div>
              <div className="drop-zone-hint">
                Accepts brand research JSON files with idealClientProfiles
              </div>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden-input"
                accept=".json"
                onChange={handleFileChange}
              />
            </div>

            {/* Quick link to history */}
            <button className="btn-secondary" onClick={openHistory} style={{ padding: '10px 24px' }}>
              <Clock size={15} />
              View Previous Generations
            </button>
          </div>
        )}

        {/* ─── PERSONA SELECTION SCREEN ─── */}
        {screen === 'personas' && (
          <div className="persona-screen animate-fade-in">
            {/* Brand summary */}
            <div className="glass-card brand-summary-bar">
              <div
                className="brand-icon"
                style={{ background: `linear-gradient(135deg, ${getBrandAccent()}, var(--accent-3))` }}
              >
                {brandName.charAt(0).toUpperCase()}
              </div>
              <div className="brand-summary-info">
                <h3>{brandName}</h3>
                <div className="brand-summary-meta">
                  <span className="meta-tag">{brandData?.brandIdentity?.industry || 'General'}</span>
                  <span className="meta-tag">{brandData?.brandIdentity?.geography?.country || 'Global'}</span>
                  <span className="meta-tag">{personas.length} Persona{personas.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>

            {/* Persona selection */}
            <div className="persona-section-title">Select a persona to generate</div>

            <div className="persona-cards-grid stagger">
              {personas.map((p, idx) => (
                <div
                  key={idx}
                  className={`glass-card persona-card interactive animate-fade-in ${selectedPersona === idx ? 'selected' : ''}`}
                  onClick={() => setSelectedPersona(idx)}
                >
                  <div className="persona-card-content">
                    <div className="persona-card-header">
                      <span className="persona-label">{p.avatarLabel || 'Persona'}</span>
                      <div className="persona-check">
                        {selectedPersona === idx && <Check size={12} color="#fff" />}
                      </div>
                    </div>
                    <div className="persona-card-name">{p.name || 'Unnamed Persona'}</div>
                    <div className="persona-card-summary">{p.summary || 'No summary available.'}</div>
                    <div className="persona-card-stats">
                      <div className="persona-stat">
                        <div className="persona-stat-label">Age</div>
                        <div className="persona-stat-value">{p.age || 'N/A'}</div>
                      </div>
                      <div className="persona-stat">
                        <div className="persona-stat-label">Gender</div>
                        <div className="persona-stat-value">{p.gender || 'N/A'}</div>
                      </div>
                      <div className="persona-stat">
                        <div className="persona-stat-label">Income</div>
                        <div className="persona-stat-value">{p.incomeLevel || 'N/A'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Representative Gender Selection for Unisex/All Genders profiles */}
            {personas[selectedPersona] && 
             (personas[selectedPersona].gender || '').toLowerCase().includes('all') && (
              <div className="glass-card" style={{ padding: '16px', marginBottom: '24px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', marginBottom: '8px', color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Representative Avatar Selection
                </div>
                <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '14px', lineHeight: '1.4' }}>
                  This target audience accepts <strong>All Genders</strong>. Select the representative demographic to use for synthetic avatar visual generation:
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button 
                    onClick={() => setSelectedGenderRep('Female')}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      background: selectedGenderRep === 'Female' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                      border: selectedGenderRep === 'Female' ? '1px solid #818cf8' : '1px solid rgba(255, 255, 255, 0.05)',
                      color: selectedGenderRep === 'Female' ? '#a5b4fc' : 'var(--text-primary)',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    👩 Female Representative
                  </button>
                  <button 
                    onClick={() => setSelectedGenderRep('Male')}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      background: selectedGenderRep === 'Male' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                      border: selectedGenderRep === 'Male' ? '1px solid #818cf8' : '1px solid rgba(255, 255, 255, 0.05)',
                      color: selectedGenderRep === 'Male' ? '#a5b4fc' : 'var(--text-primary)',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    👨 Male Representative
                  </button>
                </div>
              </div>
            )}

            {/* Generate button */}
            <div className="generate-section">
              <button
                className="btn-generate"
                onClick={generateBoard}
                disabled={personas.length === 0}
              >
                <Zap size={18} />
                Generate Persona Board
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ─── LOADING SCREEN ─── */}
        {screen === 'loading' && (
          <div className="loading-screen animate-scale-in">
            <div className="loading-orb">
              <div className="loading-orb-ring" />
              <div className="loading-orb-ring" />
              <div className="loading-orb-ring" />
              <div className="loading-orb-center" />
            </div>

            <div className="loading-text">
              <h3>Generating Persona Board</h3>
              <p>
                Creating a premium persona board for <strong>{personas[selectedPersona]?.name || 'persona'}</strong> from <strong>{brandName}</strong>
              </p>
            </div>

            <div className="loading-steps">
              <div className={`loading-step ${loadingStep >= 0 ? (loadingStep > 0 ? 'done' : 'active') : ''}`}>
                <span className="loading-step-dot" />
                Extracting brand & persona data
              </div>
              <div className={`loading-step ${loadingStep >= 1 ? (loadingStep > 1 ? 'done' : 'active') : ''}`}>
                <span className="loading-step-dot" />
                Building creative brief heuristics
              </div>
              <div className={`loading-step ${loadingStep >= 2 ? (loadingStep > 2 ? 'done' : 'active') : ''}`}>
                <span className="loading-step-dot" />
                HeyGen is composing the avatar
              </div>
              <div className={`loading-step ${loadingStep >= 3 ? 'active' : ''}`}>
                <span className="loading-step-dot" />
                Queuing talking avatar video
              </div>
            </div>
          </div>
        )}

        {/* ─── RESULT SCREEN ─── */}
        {screen === 'result' && generatedImage && (() => {
          const currentPersona = generatedImage.validatedPersona || personas[selectedPersona];
          return (
            <div className="three-column-layout animate-fade-in">
              
              {/* LEFT COLUMN: Brand, Persona Selector, History access */}
              <div className="left-sidebar">
                {/* Brand Identity Card */}
                <div className="glass-card side-panel-card" style={{ padding: '16px' }}>
                  <h4 style={{ margin: '0 0 10px 0', opacity: 0.6, textTransform: 'uppercase', fontSize: '9px', letterSpacing: '0.05em' }}>Active Brand</h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      background: 'var(--accent-gradient)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '700',
                      fontSize: '16px',
                      color: '#fff'
                    }}>
                      {brandName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '15px' }}>{brandName}</div>
                      <div style={{ fontSize: '11px', opacity: 0.6, textTransform: 'capitalize' }}>{brandData?.brandIdentity?.industry || 'General'}</div>
                    </div>
                  </div>
                </div>

                {/* Persona List / Selector Card */}
                <div className="glass-card side-panel-card" style={{ padding: '16px' }}>
                  <h4 style={{ margin: '0 0 12px 0', opacity: 0.6, textTransform: 'uppercase', fontSize: '9px', letterSpacing: '0.05em' }}>Target Personas</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {personas.map((pers, idx) => {
                      const isActive = idx === selectedPersona;
                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            if (!isActive) {
                              setSelectedPersona(idx);
                              setGeneratedImage(null);
                              setScreen('personas');
                            }
                          }}
                          style={{
                            padding: '10px',
                            borderRadius: '8px',
                            background: isActive ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                            border: isActive ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid rgba(255, 255, 255, 0.05)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <div style={{ fontWeight: '500', fontSize: '12px', color: isActive ? '#818cf8' : 'var(--text-primary)' }}>{pers.name}</div>
                          <div style={{ fontSize: '10px', opacity: 0.6, marginTop: '2px' }}>{pers.avatarLabel || 'Target'}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Quick Navigation Card */}
                <div className="glass-card side-panel-card" style={{ padding: '12px' }}>
                  <button className="btn-action" onClick={() => setScreen('history')} style={{ width: '100%', justifyContent: 'center', fontSize: '12px' }}>
                    <Clock size={13} />
                    View Gallery History
                  </button>
                  <button className="btn-action" onClick={() => { setBrandData(null); setScreen('upload'); }} style={{ width: '100%', justifyContent: 'center', fontSize: '12px', marginTop: '8px', opacity: 0.7 }}>
                    <ArrowLeft size={13} />
                    Upload New Brand
                  </button>
                </div>
              </div>

              {/* CENTER COLUMN: Previews (Composite, Avatar, Background) */}
              <div className="center-preview">
                {/* Tabs */}
                <div className="preview-tabs">
                  <button
                    className={`preview-tab-btn ${previewTab === 'composite' ? 'active' : ''}`}
                    onClick={() => setPreviewTab('composite')}
                  >
                    <Users size={14} /> Composite Board
                  </button>
                  <button
                    className={`preview-tab-btn ${previewTab === 'avatar' ? 'active' : ''}`}
                    onClick={() => setPreviewTab('avatar')}
                  >
                    <Download size={14} /> Persona Avatar
                  </button>
                  <button
                    className={`preview-tab-btn ${previewTab === 'background' ? 'active' : ''}`}
                    onClick={() => setPreviewTab('background')}
                  >
                    <Download size={14} /> Scene Background
                  </button>
                </div>

                {/* Tab Previews */}
                {previewTab === 'composite' && (
                  <div className="glass-card image-viewer" style={{ padding: '20px' }}>
                    <div 
                      ref={wrapperRef} 
                      className="canvas-wrapper"
                      style={{ 
                        height: `${1350 * scale + 40}px`, 
                        display: 'flex', 
                        alignItems: 'flex-start', 
                        justifyContent: 'center', 
                        overflow: 'hidden' 
                      }}
                    >
                      <PersonaBoardRenderer
                        brandData={brandData}
                        persona={currentPersona}
                        avatarUrl={generatedImage.avatar ? `data:image/png;base64,${generatedImage.avatar}` : ''}
                        backgroundUrl={generatedImage.background ? `data:image/png;base64,${generatedImage.background}` : ''}
                        creativeBrief={generatedImage.creativeBrief}
                        canvasRef={canvasRef}
                        scale={scale}
                        videoStatus={videoStatus}
                        videoUrl={videoUrl}
                        videoError={videoError}
                      />
                    </div>
                  </div>
                )}

                {previewTab === 'avatar' && (
                  <div className="glass-card checkerboard-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', borderRadius: '12px', minHeight: '500px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    {generatedImage.avatar ? (
                      <img 
                        src={`data:image/png;base64,${generatedImage.avatar}`} 
                        alt="Transparent Persona Avatar" 
                        style={{ maxWidth: '100%', maxHeight: '600px', objectFit: 'contain', filter: 'drop-shadow(0 12px 24px rgba(0,0,0,0.35))' }}
                      />
                    ) : (
                      <div style={{ opacity: 0.5 }}>No avatar generated</div>
                    )}
                  </div>
                )}

                {previewTab === 'background' && (
                  <div className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0', borderRadius: '12px', minHeight: '500px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
                    {generatedImage.background ? (
                      <img 
                        src={`data:image/png;base64,${generatedImage.background}`} 
                        alt="Scene Background" 
                        style={{ width: '100%', height: 'auto', maxHeight: '600px', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{ opacity: 0.5, padding: '40px' }}>No background generated</div>
                    )}
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN: Validated Persona, Reasoning, Confidence, Prompts, Downloads */}
              <div className="right-details">
                {/* Persona Core Identity */}
                <div className="glass-card side-panel-card" style={{ padding: '16px' }}>
                  <h4 style={{ margin: '0 0 10px 0', opacity: 0.6, textTransform: 'uppercase', fontSize: '9px', letterSpacing: '0.05em' }}><Target size={12} style={{ marginRight: '4px' }} /> Persona Details</h4>
                  <div style={{ fontSize: '18px', fontWeight: '700' }}>{currentPersona?.name}</div>
                  <div style={{ fontSize: '12px', opacity: 0.6, marginTop: '2px', marginBottom: '14px' }}>{currentPersona?.avatarLabel || 'Primary'} customer profile</div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '11px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
                    <div>
                      <span style={{ opacity: 0.5 }}>Age:</span> <strong style={{ marginLeft: '4px' }}>{currentPersona?.age || 'N/A'}</strong>
                    </div>
                    <div>
                      <span style={{ opacity: 0.5 }}>Gender:</span> <strong style={{ marginLeft: '4px' }}>{currentPersona?.gender || 'N/A'}</strong>
                    </div>
                    <div>
                      <span style={{ opacity: 0.5 }}>Income:</span> <strong style={{ marginLeft: '4px' }}>{currentPersona?.incomeLevel || 'N/A'}</strong>
                    </div>
                  </div>
                </div>
                {/* Validation Report Card */}
                {generatedImage.validationReport && (
                  <div className="glass-card side-panel-card" style={{ border: '1px solid rgba(245, 158, 11, 0.25)', background: 'rgba(245, 158, 11, 0.03)', padding: '16px' }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b', margin: '0 0 12px 0', fontSize: '13px' }}>
                      <ShieldAlert size={14} /> Validation & Inference
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {generatedImage.validationReport.map((rep, idx) => (
                        <div key={idx} style={{ padding: '8px 10px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: '600', fontSize: '12px' }}>{rep.field}</span>
                            <span style={{
                              fontSize: '8px',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              fontWeight: '700',
                              textTransform: 'uppercase',
                              background: rep.status === 'corrected' ? 'rgba(245, 158, 11, 0.15)' : rep.status === 'resolved' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(16, 185, 129, 0.12)',
                              color: rep.status === 'corrected' ? '#f59e0b' : rep.status === 'resolved' ? '#a5b4fc' : '#10b981',
                              border: rep.status === 'corrected' ? '1px solid rgba(245, 158, 11, 0.25)' : rep.status === 'resolved' ? '1px solid rgba(99, 102, 241, 0.25)' : '1px solid rgba(16, 185, 129, 0.2)'
                            }}>
                              {rep.status}
                            </span>
                          </div>
                          
                          {(rep.status === 'corrected' || rep.status === 'resolved') ? (
                            <div style={{ marginTop: '6px' }}>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '11px', marginBottom: '4px' }}>
                                <span style={{ opacity: 0.5 }}>Raw:</span>
                                <span style={{ textDecoration: rep.status === 'corrected' ? 'line-through' : 'none', color: rep.status === 'corrected' ? '#ef4444' : 'var(--text-primary)' }}>{rep.raw}</span>
                                {rep.status === 'corrected' && (
                                  <>
                                    <span style={{ opacity: 0.5 }}>➔</span>
                                    <span style={{ color: '#10b981', fontWeight: '600' }}>{rep.validated}</span>
                                  </>
                                )}
                              </div>
                              <p style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.65)', margin: '4px 0', lineHeight: '1.4' }}>
                                {rep.reason}
                              </p>
                              {rep.representative && (
                                <div style={{ marginTop: '6px', marginBottom: '6px', fontSize: '11px', background: 'rgba(99, 102, 241, 0.08)', padding: '6px 8px', borderRadius: '6px', border: '1px solid rgba(99, 102, 241, 0.15)' }}>
                                  <span style={{ opacity: 0.6, marginRight: '4px' }}>Representative:</span>
                                  <strong style={{ color: '#a5b4fc' }}>{rep.representative}</strong>
                                </div>
                              )}
                              <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '9px', opacity: 0.5 }}>Confidence:</span>
                                <div style={{ flex: 1, height: '3px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                                  <div style={{ width: `${rep.confidence}%`, height: '100%', background: rep.status === 'resolved' ? '#818cf8' : '#f59e0b' }} />
                                </div>
                                <span style={{ fontSize: '9px', fontWeight: '600' }}>{rep.confidence}%</span>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '11px', marginTop: '4px', opacity: 0.8 }}>
                              <span style={{ opacity: 0.5 }}>Value:</span>
                              <span style={{ fontWeight: '500' }}>{rep.validated}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Creative Director Specs Card */}
                {generatedImage.creativeBrief && (
                  <div className="glass-card side-panel-card" style={{ padding: '16px' }}>
                    <h4 style={{ margin: '0 0 10px 0', opacity: 0.6, textTransform: 'uppercase', fontSize: '9px', letterSpacing: '0.05em' }}><Sparkles size={12} style={{ marginRight: '4px' }} /> Creative Specs</h4>
                    
                    <div style={{ fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {generatedImage.creativeBrief.climate_wardrobe_direction && (
                        <div>
                          <span style={{ opacity: 0.5, display: 'block', marginBottom: '2px' }}>Wardrobe Direction:</span>
                          <span style={{ fontWeight: '500' }}>{generatedImage.creativeBrief.climate_wardrobe_direction}</span>
                        </div>
                      )}
                      {generatedImage.creativeBrief.background_style && (
                        <div>
                          <span style={{ opacity: 0.5, display: 'block', marginBottom: '2px' }}>Scene Backdrop:</span>
                          <span style={{ fontWeight: '500' }}>{generatedImage.creativeBrief.background_style}</span>
                        </div>
                      )}
                      {generatedImage.creativeBrief.lighting_style && (
                        <div>
                          <span style={{ opacity: 0.5, display: 'block', marginBottom: '2px' }}>Lighting Director Style:</span>
                          <span style={{ fontWeight: '500' }}>{generatedImage.creativeBrief.lighting_style}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Controls & Downloads Card */}
                <div className="glass-card side-panel-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px' }}>
                  <h4 style={{ margin: 0, opacity: 0.6, textTransform: 'uppercase', fontSize: '9px', letterSpacing: '0.05em' }}>Actions & Downloads</h4>
                  
                  <button className="btn-action primary" onClick={exportBoardAsPng} style={{ width: '100%', justifyContent: 'center' }}>
                    <Download size={15} />
                    Export Full Board PNG
                  </button>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <button className="btn-action" onClick={() => downloadAsset(generatedImage.avatar, `${brandName}_${currentPersona?.name || 'persona'}_avatar.png`)} style={{ fontSize: '11px', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <Download size={12} /> Avatar PNG
                    </button>
                    <button className="btn-action" onClick={() => downloadAsset(generatedImage.background, `${brandName}_background.png`)} style={{ fontSize: '11px', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <Download size={12} /> Scene PNG
                    </button>
                  </div>
                  <button className="btn-action" onClick={handleRegenerate} style={{ width: '100%', justifyContent: 'center' }}>
                    <RefreshCw size={13} />
                    Regenerate Creative Visuals
                  </button>
                </div>
              </div>

            </div>
          );
        })()}

        {/* ─── HISTORY SCREEN (Gallery) ─── */}
        {screen === 'history' && (
          <div className="history-screen animate-fade-in">
            <div className="history-header">
              <div className="history-title-area">
                <div className="history-icon-wrap">
                  <Clock size={24} />
                </div>
                <div>
                  <h2>Generated Boards</h2>
                  <p>{historyItems.length} persona board{historyItems.length !== 1 ? 's' : ''} created</p>
                </div>
              </div>
            </div>

            {historyLoading && (
              <div className="history-loading">
                <div className="loading-orb" style={{ width: 60, height: 60 }}>
                  <div className="loading-orb-ring" />
                  <div className="loading-orb-ring" />
                  <div className="loading-orb-ring" />
                  <div className="loading-orb-center" />
                </div>
                <p style={{ color: 'var(--text-secondary)', marginTop: 16 }}>Loading history...</p>
              </div>
            )}

            {!historyLoading && historyItems.length === 0 && (
              <div className="history-empty">
                <div className="history-empty-icon">
                  <Grid size={40} />
                </div>
                <h3>No boards yet</h3>
                <p>Generated persona boards will appear here. Upload a brand JSON to create your first one.</p>
                <button className="btn-generate" onClick={handleReset} style={{ marginTop: 16 }}>
                  <Zap size={16} />
                  Generate First Board
                </button>
              </div>
            )}

            {!historyLoading && historyItems.length > 0 && (
              <div className="history-grid stagger">
                {historyItems.map((item) => (
                  <div
                    key={item.id}
                    className="glass-card history-card interactive animate-fade-in"
                    onClick={() => viewHistoryItem(item)}
                  >
                    {/* Thumbnail */}
                    <div className="history-card-thumb">
                      <img
                        src={`/api/history/${item.id}/image`}
                        alt={`${item.brandName} - ${item.personaName}`}
                        loading="lazy"
                      />
                      <div className="history-card-overlay">
                        <Eye size={20} />
                        <span>View</span>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="history-card-info">
                      <div className="history-card-brand">{item.brandName}</div>
                      <div className="history-card-persona">{item.personaName}</div>
                      <div className="history-card-meta">
                        <span className="meta-tag">{item.industry}</span>
                        <span className="meta-tag">{item.personaLabel}</span>
                      </div>
                      <div className="history-card-footer">
                        <span className="history-card-date">{formatDate(item.createdAt)}</span>
                        <span className="history-card-size">{formatSize(item.sizeBytes)}</span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="history-card-actions">
                      <button
                        className="history-action-btn"
                        title="Download"
                        onClick={(e) => { e.stopPropagation(); downloadHistoryImage(item); }}
                      >
                        <Download size={14} />
                      </button>
                      <button
                        className="history-action-btn danger"
                        title="Delete"
                        onClick={(e) => deleteHistoryItem(item, e)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── HISTORY VIEW (Single Board) ─── */}
        {screen === 'historyView' && viewingHistoryItem && (() => {
          const isOldBoard = !viewingHistoryItem.brandData;
          const validatedPersona = viewingHistoryItem.validatedPersona || viewingHistoryItem.brandData?.idealClientProfiles[viewingHistoryItem.personaIndex] || {};
          return (
            <div className="three-column-layout animate-fade-in">
              
              {/* LEFT COLUMN: Back button, History list quick nav */}
              <div className="left-sidebar">
                <div className="glass-card side-panel-card" style={{ padding: '16px' }}>
                  <button className="btn-action primary" onClick={() => setScreen('history')} style={{ width: '100%', justifyContent: 'center' }}>
                    <ArrowLeft size={14} /> Back to Gallery
                  </button>
                </div>

                <div className="glass-card side-panel-card" style={{ padding: '16px' }}>
                  <h4 style={{ margin: '0 0 10px 0', opacity: 0.6, textTransform: 'uppercase', fontSize: '9px', letterSpacing: '0.05em' }}>Brand Details</h4>
                  <div style={{ fontWeight: '700', fontSize: '15px' }}>{viewingHistoryItem.brandName}</div>
                  <div style={{ fontSize: '11px', opacity: 0.6, textTransform: 'capitalize', marginTop: '2px' }}>{viewingHistoryItem.industry}</div>
                </div>

                {/* Other generation board history items quick switch */}
                <div className="glass-card side-panel-card" style={{ padding: '16px' }}>
                  <h4 style={{ margin: '0 0 10px 0', opacity: 0.6, textTransform: 'uppercase', fontSize: '9px', letterSpacing: '0.05em' }}>Recent Boards</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                    {historyItems.slice(0, 5).map((item) => {
                      const isActive = item.id === viewingHistoryItem.id;
                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            if (!isActive) {
                              setViewingHistoryItem(item);
                            }
                          }}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '6px',
                            background: isActive ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                            border: isActive ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid rgba(255, 255, 255, 0.05)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            fontSize: '11px'
                          }}
                        >
                          <div style={{ fontWeight: '600', color: isActive ? '#818cf8' : 'var(--text-primary)' }}>{item.brandName}</div>
                          <div style={{ opacity: 0.6, fontSize: '10px', marginTop: '2px' }}>{item.personaName}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* CENTER COLUMN: Previews */}
              <div className="center-preview">
                {/* Tabs */}
                <div className="preview-tabs">
                  <button
                    className={`preview-tab-btn ${previewTab === 'composite' ? 'active' : ''}`}
                    onClick={() => setPreviewTab('composite')}
                  >
                    <Users size={14} /> Composite Board
                  </button>
                  <button
                    className={`preview-tab-btn ${previewTab === 'avatar' ? 'active' : ''}`}
                    onClick={() => setPreviewTab('avatar')}
                  >
                    <Download size={14} /> Persona Avatar
                  </button>
                  <button
                    className={`preview-tab-btn ${previewTab === 'background' ? 'active' : ''}`}
                    onClick={() => setPreviewTab('background')}
                  >
                    <Download size={14} /> Scene Background
                  </button>
                </div>

                {/* Tab Previews */}
                {previewTab === 'composite' && (
                  <div className="glass-card image-viewer" style={{ padding: '20px' }}>
                    {isOldBoard ? (
                      <div className="image-frame">
                        <img
                          src={`/api/history/${viewingHistoryItem.id}/image?type=board`}
                          alt={`${viewingHistoryItem.brandName} - ${viewingHistoryItem.personaName}`}
                        />
                      </div>
                    ) : (
                      <div 
                        ref={wrapperRef} 
                        className="canvas-wrapper"
                        style={{ 
                          height: `${1350 * scale + 40}px`, 
                          display: 'flex', 
                          alignItems: 'flex-start', 
                          justifyContent: 'center', 
                          overflow: 'hidden' 
                        }}
                      >
                        <PersonaBoardRenderer
                          brandData={viewingHistoryItem.brandData}
                          persona={validatedPersona}
                          avatarUrl={`/api/history/${viewingHistoryItem.id}/image?type=avatar`}
                          backgroundUrl={viewingHistoryItem.hasBackground ? `/api/history/${viewingHistoryItem.id}/image?type=background` : ''}
                          creativeBrief={viewingHistoryItem.creativeBrief}
                          canvasRef={canvasRef}
                          scale={scale}
                          videoStatus={videoStatus}
                          videoUrl={videoUrl}
                          videoError={videoError}
                        />
                      </div>
                    )}
                  </div>
                )}

                {previewTab === 'avatar' && (
                  <div className="glass-card checkerboard-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', borderRadius: '12px', minHeight: '500px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <img 
                      src={`/api/history/${viewingHistoryItem.id}/image?type=avatar`} 
                      alt="Transparent Persona Avatar" 
                      style={{ maxWidth: '100%', maxHeight: '600px', objectFit: 'contain', filter: 'drop-shadow(0 12px 24px rgba(0,0,0,0.35))' }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  </div>
                )}

                {previewTab === 'background' && (
                  <div className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0', borderRadius: '12px', minHeight: '500px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
                    {viewingHistoryItem.hasBackground ? (
                      <img 
                        src={`/api/history/${viewingHistoryItem.id}/image?type=background`} 
                        alt="Scene Background" 
                        style={{ width: '100%', height: 'auto', maxHeight: '600px', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{ opacity: 0.5, padding: '40px' }}>No background generated for this board</div>
                    )}
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN: Validated Persona details, Validation Report, Board Info, Downloads */}
              <div className="right-details">
                {/* Persona Identity details */}
                <div className="glass-card side-panel-card" style={{ padding: '16px' }}>
                  <h4 style={{ margin: '0 0 10px 0', opacity: 0.6, textTransform: 'uppercase', fontSize: '9px', letterSpacing: '0.05em' }}><Target size={12} style={{ marginRight: '4px' }} /> Persona Details</h4>
                  <div style={{ fontSize: '18px', fontWeight: '700' }}>{viewingHistoryItem.personaName}</div>
                  <div style={{ fontSize: '11px', opacity: 0.6, marginTop: '2px', marginBottom: '14px' }}>{viewingHistoryItem.personaLabel || 'Primary'} customer profile</div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '11px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
                    <div>
                      <span style={{ opacity: 0.5 }}>Age:</span> <strong style={{ marginLeft: '4px' }}>{viewingHistoryItem.age || 'N/A'}</strong>
                    </div>
                    <div>
                      <span style={{ opacity: 0.5 }}>Gender:</span> <strong style={{ marginLeft: '4px' }}>{viewingHistoryItem.gender || 'N/A'}</strong>
                    </div>
                    <div>
                      <span style={{ opacity: 0.5 }}>Income:</span> <strong style={{ marginLeft: '4px' }}>{validatedPersona.incomeLevel || 'N/A'}</strong>
                    </div>
                    <div>
                      <span style={{ opacity: 0.5 }}>Location:</span> <strong style={{ marginLeft: '4px' }}>{viewingHistoryItem.brandData?.brandIdentity?.geography?.country || 'Global'}</strong>
                    </div>
                  </div>
                </div>

                {/* Validation Report */}
                {viewingHistoryItem.validationReport && (
                  <div className="glass-card side-panel-card" style={{ border: '1px solid rgba(245, 158, 11, 0.25)', background: 'rgba(245, 158, 11, 0.03)', padding: '16px' }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b', margin: '0 0 12px 0', fontSize: '13px' }}>
                      <ShieldAlert size={14} /> Validation & Inference
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {viewingHistoryItem.validationReport.map((rep, idx) => (
                        <div key={idx} style={{ padding: '8px 10px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: '600', fontSize: '12px' }}>{rep.field}</span>
                            <span style={{
                              fontSize: '8px',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              fontWeight: '700',
                              textTransform: 'uppercase',
                              background: rep.status === 'corrected' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.12)',
                              color: rep.status === 'corrected' ? '#f59e0b' : '#10b981',
                              border: rep.status === 'corrected' ? '1px solid rgba(245, 158, 11, 0.25)' : '1px solid rgba(16, 185, 129, 0.2)'
                            }}>
                              {rep.status}
                            </span>
                          </div>
                          
                          {rep.status === 'corrected' ? (
                            <div style={{ marginTop: '6px' }}>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '11px', marginBottom: '4px' }}>
                                <span style={{ opacity: 0.5 }}>Raw:</span>
                                <span style={{ textDecoration: 'line-through', color: '#ef4444' }}>{rep.raw}</span>
                                <span style={{ opacity: 0.5 }}>➔</span>
                                <span style={{ color: '#10b981', fontWeight: '600' }}>{rep.validated}</span>
                              </div>
                              <p style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.65)', margin: '4px 0', lineHeight: '1.4' }}>
                                {rep.reason}
                              </p>
                              <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '9px', opacity: 0.5 }}>Confidence:</span>
                                <div style={{ flex: 1, height: '3px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                                  <div style={{ width: `${rep.confidence}%`, height: '100%', background: '#f59e0b' }} />
                                </div>
                                <span style={{ fontSize: '9px', fontWeight: '600' }}>{rep.confidence}%</span>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '11px', marginTop: '4px', opacity: 0.8 }}>
                              <span style={{ opacity: 0.5 }}>Value:</span>
                              <span style={{ fontWeight: '500' }}>{rep.validated}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Creative Specs */}
                {viewingHistoryItem.creativeBrief && (
                  <div className="glass-card side-panel-card" style={{ padding: '16px' }}>
                    <h4 style={{ margin: '0 0 10px 0', opacity: 0.6, textTransform: 'uppercase', fontSize: '9px', letterSpacing: '0.05em' }}><Sparkles size={12} style={{ marginRight: '4px' }} /> Creative Specs</h4>
                    
                    <div style={{ fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {viewingHistoryItem.creativeBrief.climate_wardrobe_direction && (
                        <div>
                          <span style={{ opacity: 0.5, display: 'block', marginBottom: '2px' }}>Wardrobe Direction:</span>
                          <span style={{ fontWeight: '500' }}>{viewingHistoryItem.creativeBrief.climate_wardrobe_direction}</span>
                        </div>
                      )}
                      {viewingHistoryItem.creativeBrief.background_style && (
                        <div>
                          <span style={{ opacity: 0.5, display: 'block', marginBottom: '2px' }}>Scene Backdrop:</span>
                          <span style={{ fontWeight: '500' }}>{viewingHistoryItem.creativeBrief.background_style}</span>
                        </div>
                      )}
                      {viewingHistoryItem.creativeBrief.lighting_style && (
                        <div>
                          <span style={{ opacity: 0.5, display: 'block', marginBottom: '2px' }}>Lighting Style:</span>
                          <span style={{ fontWeight: '500' }}>{viewingHistoryItem.creativeBrief.lighting_style}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions & Delete Card */}
                <div className="glass-card side-panel-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px' }}>
                  <h4 style={{ margin: 0, opacity: 0.6, textTransform: 'uppercase', fontSize: '9px', letterSpacing: '0.05em' }}>Actions & Settings</h4>
                  
                  <button className="btn-action primary" onClick={exportBoardAsPng} style={{ width: '100%', justifyContent: 'center' }}>
                    <Download size={15} />
                    Export Full Board PNG
                  </button>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <button className="btn-action" onClick={() => downloadAsset(`/api/history/${viewingHistoryItem.id}/image?type=avatar`, `${viewingHistoryItem.brandName}_avatar.png`)} style={{ fontSize: '11px', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <Download size={12} /> Avatar PNG
                    </button>
                    {viewingHistoryItem.hasBackground && (
                      <button className="btn-action" onClick={() => downloadAsset(`/api/history/${viewingHistoryItem.id}/image?type=background`, `${viewingHistoryItem.brandName}_background.png`)} style={{ fontSize: '11px', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <Download size={12} /> Scene PNG
                      </button>
                    )}
                  </div>
                  
                  <button className="btn-action danger-btn" onClick={(e) => deleteHistoryItem(viewingHistoryItem, e)} style={{ width: '100%', justifyContent: 'center', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', height: '36px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '500' }}>
                    <Trash2 size={13} />
                    Delete Generation
                  </button>
                </div>
              </div>

            </div>
          );
        })()}

      </main>
    </div>
  );
}

// Helper to parse CSS color strings into RGB components
function parseColor(colorStr) {
  const c = colorStr.trim().toLowerCase();
  
  if (c === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  if (c === 'white') return { r: 255, g: 255, b: 255, a: 1 };
  if (c === 'black') return { r: 0, g: 0, b: 0, a: 1 };
  
  if (c.startsWith('rgb')) {
    const matches = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (matches) {
      return {
        r: parseInt(matches[1], 10),
        g: parseInt(matches[2], 10),
        b: parseInt(matches[3], 10),
        a: matches[4] !== undefined ? parseFloat(matches[4]) : 1
      };
    }
  }
  
  if (c.startsWith('#')) {
    let hex = c.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map(x => x + x).join('');
    }
    const num = parseInt(hex, 16);
    if (!isNaN(num)) {
      return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255,
        a: 1
      };
    }
  }
  
  return null;
}

function extractBrandColors(brandData) {
  const defaultColors = { primary: '#6366f1', secondary: '#06b6d4' };
  if (!brandData) return defaultColors;
  const colors = brandData.brandIdentity?.brandColors || [];
  
  const parsedColors = colors
    .map(c => ({ original: c, parsed: parseColor(c) }))
    .filter(item => {
      if (!item.parsed) return false;
      const { r, g, b, a } = item.parsed;
      if (a < 0.2) return false; // Filter transparent
      if (r > 245 && g > 245 && b > 245) return false; // Filter white/bright backgrounds
      if (r < 25 && g < 25 && b < 25) return false; // Filter black/near-black text
      return true;
    });

  const primary = parsedColors[0]?.original || defaultColors.primary;
  const secondaryItem = parsedColors.find(item => item.original !== primary);
  const secondary = secondaryItem ? secondaryItem.original : defaultColors.secondary;

  return { primary, secondary };
}

// ──────────────────────────────────────────────────────────────
// HTML/CSS/FIGMA CANVAS RENDERER COMPONENT
// ──────────────────────────────────────────────────────────────

function PersonaBoardRenderer({ brandData, persona, avatarUrl, backgroundUrl, creativeBrief, canvasRef, scale, videoStatus, videoUrl, videoError }) {
  const colors = extractBrandColors(brandData);
  const brandName = brandData?.brandIdentity?.brandName || 'Brand';
  const industry = brandData?.brandIdentity?.industry || 'General';
  const country = brandData?.brandIdentity?.geography?.country || 'Global';
  const primaryProduct = brandData?.brandIdentity?.productInfo?.primary || brandData?.brandIdentity?.productCategories?.primary || '';
  
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const videoRef = useRef(null);

  // If videoUrl changes or status updates, reset playback state
  useEffect(() => {
    setIsPlayingVideo(false);
  }, [videoUrl, videoStatus]);

  return (
    <div 
      className="persona-board-canvas"
      style={{
        '--brand-primary': colors.primary,
        '--brand-secondary': colors.secondary,
        transform: `scale(${scale})`,
        transformOrigin: 'top center'
      }}
      ref={canvasRef}
    >
      {/* Left Visual Column */}
      <div className="board-left-column">
        {/* Background layer */}
        {backgroundUrl ? (
          <div className="board-bg-layer" style={{ backgroundImage: `url(${backgroundUrl})` }} />
        ) : (
          <div className="board-bg-gradient" />
        )}
        <div className="board-bg-glow" />
        
        {/* Avatar layer */}
        <div className="board-avatar-container">
          {isPlayingVideo && videoUrl ? (
            <video 
              ref={videoRef}
              src={videoUrl} 
              autoPlay 
              controls 
              className="board-avatar"
              style={{ objectFit: 'contain', maxHeight: '90%', borderRadius: '16px', zIndex: 12 }}
              onEnded={() => setIsPlayingVideo(false)}
            />
          ) : (
            <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
              <img src={avatarUrl} alt="Avatar" className="board-avatar" />
              {videoStatus === 'processing' && (
                <div 
                  style={{
                    position: 'absolute',
                    bottom: '20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(15, 23, 42, 0.85)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                    borderRadius: '50px',
                    padding: '8px 16px',
                    fontSize: '11px',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    zIndex: 10,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <RefreshCw size={12} className="animate-spin" />
                  Generating Video...
                </div>
              )}
              {videoStatus === 'completed' && videoUrl && (
                <button 
                  className="play-avatar-btn"
                  onClick={() => setIsPlayingVideo(true)}
                  style={{
                    position: 'absolute',
                    bottom: '20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(99, 102, 241, 0.95)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '50px',
                    padding: '10px 20px',
                    fontSize: '13px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    boxShadow: '0 8px 24px rgba(99, 102, 241, 0.3)',
                    zIndex: 10,
                    transition: 'all 0.2s ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Play size={14} fill="#fff" />
                  Play Talking Avatar
                </button>
              )}
            </div>
          )}
        </div>

        {/* Header */}
        <div className="board-left-header">
          <div className="board-brand-logo">
            {brandName.charAt(0).toUpperCase()}
          </div>
          <div className="board-brand-info">
            <h2>{brandName}</h2>
            <span>{country}</span>
          </div>
        </div>

        {/* Footer info badge */}
        <div className="board-left-footer">
          {primaryProduct && (
            <div className="board-product-card">
              <span>Primary Product Focus</span>
              <h3>{primaryProduct}</h3>
            </div>
          )}
          
          <div className="board-cta-row">
            <span className="board-cta-badge">{brandData?.brandIdentity?.ctaPreference || 'Learn More'}</span>
            <span className="board-industry-badge">{industry}</span>
          </div>
        </div>
      </div>

      {/* Right Information Column */}
      <div className="board-right-column">
        <div className="board-right-header">
          <div className="board-persona-subtitle">
            {persona?.avatarLabel || 'Primary'} Target Persona
          </div>
          <div className="board-persona-title">
            {persona?.name || 'Ideal Customer'}
          </div>
          {persona?.summary && (
            <p className="board-persona-summary">
              "{persona.summary}"
            </p>
          )}
        </div>

        <div className="board-cards-grid">
          {/* Card 1: Demographics */}
          <div className="board-card">
            <div className="board-card-title">
              <Users size={14} />
              Demographics
            </div>
            <div className="board-demo-grid">
              <div className="board-demo-item">
                <span className="board-demo-label">Age</span>
                <span className="board-demo-value">{persona?.age || 'N/A'}</span>
              </div>
              <div className="board-demo-item">
                <span className="board-demo-label">Gender</span>
                <span className="board-demo-value">{persona?.gender || 'N/A'}</span>
              </div>
              <div className="board-demo-item">
                <span className="board-demo-label">Income</span>
                <span className="board-demo-value">{persona?.incomeLevel || 'N/A'}</span>
              </div>
              <div className="board-demo-item">
                <span className="board-demo-label">Location</span>
                <span className="board-demo-value">{country}</span>
              </div>
            </div>
          </div>

          {/* Card 2: Preferred Channels */}
          <div className="board-card">
            <div className="board-card-title">
              <Target size={14} />
              Platforms
            </div>
            <div className="board-tags">
              {(persona?.platformPreference || persona?.preferredChannels || []).map((p, i) => (
                <span key={i} className="board-tag platform">{p.replace('_', ' ')}</span>
              ))}
            </div>
          </div>

          {/* Card 3: Psychographics & Values */}
          {persona?.psychographics?.length > 0 && (
            <div className="board-card board-card-full">
              <div className="board-card-title">
                <Sparkles size={14} />
                Psychographics & Core Values
              </div>
              <div className="board-tags">
                {persona.psychographics.map((p, i) => (
                  <span key={i} className="board-tag">{p}</span>
                ))}
              </div>
            </div>
          )}

          {/* Card 4: Pain Points */}
          {persona?.painPoints?.length > 0 && (
            <div className="board-card">
              <div className="board-card-title">
                <AlertCircle size={14} />
                Pain Points
              </div>
              <ul className="board-bullets">
                {persona.painPoints.slice(0, 3).map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Card 5: Buying Motivations */}
          {persona?.buyingMotivations?.length > 0 && (
            <div className="board-card">
              <div className="board-card-title">
                <Zap size={14} />
                Buying Motivations
              </div>
              <ul className="board-bullets">
                {persona.buyingMotivations.slice(0, 3).map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Card 6: Creative brief details / ad directions */}
          {creativeBrief && (
            <div className="board-card board-card-full">
              <div className="board-card-title">
                <Zap size={14} />
                Brand Voice & Ad Creative Brief
              </div>
              <div className="board-demo-grid" style={{ gridTemplateColumns: '1.2fr 0.8fr' }}>
                <div className="board-voice-style">
                  <div><strong>Tone:</strong> {brandData?.brandIdentity?.tone || 'Premium'}</div>
                  <div style={{ marginTop: '4px' }}><strong>Visual Seed:</strong> {creativeBrief.editorial_style || 'Editorial'}</div>
                </div>
                <div className="board-voice-style">
                  <div><strong>Voice Style:</strong> {persona?.recommendedVoiceStyle || 'Engaging'}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Customer Quote */}
        <div className="board-quote-section">
          <div className="board-quote-icon">“</div>
          <p className="board-quote-text">
            {persona?.productFit ? persona.productFit : `${brandName} fits my daily lifestyle and aesthetic requirements perfectly.`}
          </p>
        </div>

        <div className="board-right-footer">
          <span>Adnova Board Studio</span>
          <span>{new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
        </div>
      </div>
    </div>
  );
}
