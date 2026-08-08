import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import { Browser } from '@capacitor/browser';
import { App as CapApp } from '@capacitor/app';
import { checkForAppUpdates } from './services/updater';
import {
  Shield, Clock, Smartphone, Globe, MapPin, AlertTriangle, 
  Battery, Wifi, Lock, Unlock, Moon, BookOpen, CheckCircle, 
  XCircle, Plus, Search, Filter, RefreshCw, ChevronRight, User, QrCode, X, Download
} from 'lucide-react';

const SERVER_URLS = [
  import.meta.env.VITE_BACKEND_URL,
  'http://192.168.1.114:3001',
  'http://localhost:3001',
  'http://10.0.2.2:3001'
].filter(Boolean);

export default function App() {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [state, setState] = useState(null);
  const [activeTab, setActiveTab] = useState('time');
  const [newDomain, setNewDomain] = useState('');
  const [appSearch, setAppSearch] = useState('');
  const [connectionStatusText, setConnectionStatusText] = useState('Iniciando conexão...');
  const [updateInfo, setUpdateInfo] = useState(null);
  
  // Modal de Pareamento QR Code
  const [showPairModal, setShowPairModal] = useState(false);
  const [pairingData, setPairingData] = useState(null);
  const [isGeneratingPairing, setIsGeneratingPairing] = useState(false);

  // Tratamento nativo do botão Voltar do Android (não fecha o app ao voltar)
  useEffect(() => {
    const handleBack = () => {
      if (showPairModal) {
        setShowPairModal(false);
      } else if (activeTab !== 'time') {
        setActiveTab('time');
      }
    };

    const backListener = CapApp.addListener('backButton', handleBack);
    document.addEventListener('backButton', handleBack);

    return () => {
      backListener.then(l => l.remove());
      document.removeEventListener('backButton', handleBack);
    };
  }, [showPairModal, activeTab]);

  const handleOpenDownload = (url) => {
    console.log('Iniciando download do APK:', url);
    try {
      window.open(url, '_system') || (window.location.href = url);
    } catch (e) {
      window.location.href = url;
    }
  };

  useEffect(() => {
    checkForAppUpdates().then(info => {
      if (info?.hasUpdate) setUpdateInfo(info);
    });
  }, []);

  useEffect(() => {
    let activeSocket = null;

    const tryConnect = (index) => {
      if (index >= SERVER_URLS.length) {
        setConnectionStatusText('Tentando reconectar ao servidor...');
        setTimeout(() => tryConnect(0), 3000);
        return;
      }

      const targetUrl = SERVER_URLS[index];
      setConnectionStatusText(`Conectando ao backend em ${targetUrl}...`);

      const s = io(targetUrl, {
        reconnectionAttempts: 2,
        timeout: 3000,
        transports: ['websocket', 'polling']
      });

      s.on('connect', () => {
        setIsConnected(true);
        setSocket(s);
        activeSocket = s;
      });

      s.on('state:update', (updatedState) => {
        setState(updatedState);
      });

      s.on('parent:pair_code_generated', (data) => {
        if (data.success) {
          setPairingData(data);
          setShowPairModal(true);
        }
        setIsGeneratingPairing(false);
      });

      s.on('device:paired', (newDevice) => {
        alert(`🎉 Novo dispositivo pareado: ${newDevice.name} (${newDevice.model})!`);
        setShowPairModal(false);
      });

      s.on('connect_error', () => {
        s.close();
        tryConnect(index + 1);
      });
    };

    tryConnect(0);

    return () => {
      activeSocket?.close();
    };
  }, []);

  const handleGeneratePairingCode = () => {
    setIsGeneratingPairing(true);
    socket?.emit('parent:request_pair_code', { serverUrl: 'http://192.168.1.114:3001' });
  };

  if (!state) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '16px', padding: '20px', textAlign: 'center' }}>
        <RefreshCw size={42} style={{ color: 'var(--accent-blue)', animation: 'spin 1s linear infinite' }} />
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>GuardianShield Pai</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{connectionStatusText}</p>
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const { deviceInfo, screenTime, blockedApps, contentFilter, location, geofences, timeRequests, pairedDevices = [] } = state;
  const pendingRequests = timeRequests.filter(r => r.status === 'pending');

  const handleSetDailyLimit = (minutes) => {
    socket?.emit('parent:set_daily_limit', Number(minutes));
  };

  const handleTogglePauseAll = () => {
    socket?.emit('parent:toggle_pause_all', !screenTime.isPauseAllActive);
  };

  const handleToggleAppBlock = (appId, currentStatus) => {
    socket?.emit('parent:toggle_app_block', { appId, isBlocked: !currentStatus });
  };

  const handleAddBlockedDomain = (e) => {
    e.preventDefault();
    if (newDomain.trim()) {
      socket?.emit('parent:add_blocked_domain', newDomain.trim().toLowerCase());
      setNewDomain('');
    }
  };

  const handleRespondRequest = (requestId, approved, bonusMinutes = 15) => {
    socket?.emit('parent:respond_time_request', { requestId, approved, bonusMinutes });
  };

  const filteredApps = blockedApps.filter(a => 
    a.name.toLowerCase().includes(appSearch.toLowerCase()) || 
    (a.category && a.category.toLowerCase().includes(appSearch.toLowerCase()))
  );

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 16px' }}>
      
      {/* HEADER / STATUS DA CRIANÇA */}
      <header className="glass-panel" style={{ padding: '20px', marginBottom: '24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-blue))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <User size={28} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>{deviceInfo.name}</h1>
              <span className={`badge ${deviceInfo.isOnline ? 'badge-success' : 'badge-danger'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Wifi size={12} /> {deviceInfo.isOnline ? 'Online' : 'Desconectado'}
              </span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {deviceInfo.model} • Bateria Real: <strong>{deviceInfo.batteryLevel}%</strong>
            </p>
          </div>
        </div>

        {/* BOTOES DE ACAO E PAREAMENTO */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn btn-primary" onClick={handleGeneratePairingCode} disabled={isGeneratingPairing}>
            <QrCode size={18} /> {isGeneratingPairing ? 'Gerando QR...' : 'Parear Novo Aparelho'}
          </button>
          
          <button 
            className={`btn ${screenTime.isPauseAllActive ? 'btn-danger' : 'btn-ghost'}`}
            onClick={handleTogglePauseAll}
          >
            {screenTime.isPauseAllActive ? <Lock size={18} /> : <Unlock size={18} />}
            {screenTime.isPauseAllActive ? 'PAUSA GERAL ATIVA' : 'Bloquear Tudo'}
          </button>
        </div>
      </header>

      {/* BANNER DE ATUALIZAÇÃO DIRETA */}
      {updateInfo && (
        <div style={{
          padding: '16px 20px', borderRadius: '16px', marginBottom: '24px',
          background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
          color: 'white', display: 'flex', flexWrap: 'wrap', alignItems: 'center',
          justifyContent: 'space-between', gap: '12px', boxShadow: '0 8px 24px rgba(59, 130, 246, 0.3)'
        }}>
          <div>
            <h4 style={{ fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Download size={20} /> Nova versão {updateInfo.latestVersion} disponível!
            </h4>
            <p style={{ fontSize: '0.85rem', opacity: 0.9, marginTop: '2px' }}>{updateInfo.releaseNotes}</p>
          </div>
          <button 
            onClick={() => handleOpenDownload(updateInfo.downloadUrl)} 
            className="btn" 
            style={{ background: 'white', color: '#0f172a', fontWeight: 800, cursor: 'pointer' }}
          >
            Baixar e Atualizar APK
          </button>
        </div>
      )}

      {/* MODAL DE PAREAMENTO QR CODE */}
      {showPairModal && pairingData && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div className="glass-panel" style={{ padding: '28px', maxWidth: '420px', width: '100%', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Parear Aparelho do Filho</h3>
              <button onClick={() => setShowPairModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={22} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Abra o app <strong>GuardianShield Filho</strong> no outro celular e escaneie o QR Code abaixo ou digite o código de pareamento:
            </p>

            <div style={{ background: 'white', padding: '16px', borderRadius: '16px', display: 'inline-block', marginBottom: '20px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
              <QRCodeSVG value={pairingData.qrPayload} size={200} />
            </div>

            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '12px', marginBottom: '16px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>CÓDIGO DE PAREAMENTO</span>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '4px', color: 'var(--accent-cyan)' }}>
                {pairingData.pairingCode}
              </div>
            </div>

            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Aguardando o outro aparelho escanear...</p>
          </div>
        </div>
      )}

      {/* ABAS DE NAVEGAÇÃO */}
      <nav style={{ display: 'flex', gap: '10px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '4px' }}>
        {[
          { id: 'time', label: 'Controle de Tempo', icon: Clock },
          { id: 'apps', label: `Apps Instalados (${blockedApps.length})`, icon: Smartphone },
          { id: 'content', label: 'Filtro Web', icon: Globe },
          { id: 'location', label: 'GPS Real', icon: MapPin },
          { id: 'requests', label: `Pedidos (${pendingRequests.length})`, icon: AlertTriangle, badge: pendingRequests.length > 0 }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="btn"
              style={{
                background: isActive ? 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))' : 'rgba(255,255,255,0.04)',
                color: isActive ? 'white' : 'var(--text-secondary)',
                border: isActive ? 'none' : '1px solid var(--border-color)',
                padding: '12px 18px',
                borderRadius: '12px'
              }}
            >
              <Icon size={18} /> {tab.label}
            </button>
          );
        })}
      </nav>

      {/* CONTEÚDO DA ABA SELECIONADA */}
      <main>
        {/* TAB: CONTROLE DE TEMPO */}
        {activeTab === 'time' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            <div className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
                  <Clock size={20} style={{ color: 'var(--accent-cyan)' }} /> Limite de Tempo Diário
                </h3>
                <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                  {Math.floor(screenTime.dailyLimitMinutes / 60)}h {screenTime.dailyLimitMinutes % 60}m
                </span>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  <span>Uso Real Hoje: {screenTime.usedMinutesToday}m</span>
                  <span>Restante: {Math.max(0, screenTime.dailyLimitMinutes - screenTime.usedMinutesToday)}m</span>
                </div>
                <div style={{ height: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '5px', overflow: 'hidden' }}>
                  <div style={{ 
                    height: '100%', 
                    width: `${Math.min(100, (screenTime.usedMinutesToday / screenTime.dailyLimitMinutes) * 100)}%`,
                    background: 'linear-gradient(90deg, var(--accent-cyan), var(--accent-blue))',
                    borderRadius: '5px'
                  }} />
                </div>
              </div>

              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Ajustar limite diário:
              </label>
              <input 
                type="range" 
                min="30" 
                max="360" 
                step="15"
                value={screenTime.dailyLimitMinutes} 
                onChange={(e) => handleSetDailyLimit(e.target.value)}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                <span>30 min</span>
                <span>2h</span>
                <span>4h</span>
                <span>6h</span>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', marginBottom: '20px' }}>
                <Moon size={20} style={{ color: 'var(--accent-purple)' }} /> Rotinas de Descanso e Estudo
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Moon size={22} style={{ color: 'var(--accent-purple)' }} />
                    <div>
                      <h4 style={{ fontSize: '0.95rem' }}>Hora de Dormir</h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {screenTime.bedtimeSchedule.start} às {screenTime.bedtimeSchedule.end}
                      </p>
                    </div>
                  </div>
                  <label className="switch">
                    <input type="checkbox" defaultChecked={screenTime.bedtimeSchedule.enabled} />
                    <span className="slider"></span>
                  </label>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <BookOpen size={22} style={{ color: 'var(--accent-amber)' }} />
                    <div>
                      <h4 style={{ fontSize: '0.95rem' }}>Hora de Estudo</h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {screenTime.studySchedule.start} às {screenTime.studySchedule.end}
                      </p>
                    </div>
                  </div>
                  <label className="switch">
                    <input type="checkbox" defaultChecked={screenTime.studySchedule.enabled} />
                    <span className="slider"></span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: GESTÃO DE APPS */}
        {activeTab === 'apps' && (
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Aplicativos Reais Instalados no Celular</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Bloqueie ou libere os aplicativos detectados em tempo real no aparelho pareado.
                </p>
              </div>

              <div style={{ position: 'relative', width: '260px' }}>
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  placeholder="Buscar aplicativo..." 
                  value={appSearch}
                  onChange={(e) => setAppSearch(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px 10px 38px', borderRadius: '10px',
                    border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.05)',
                    color: 'white', outline: 'none', fontSize: '0.9rem'
                  }}
                />
              </div>
            </div>

            {filteredApps.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>
                Nenhum aplicativo encontrado. Conecte o celular do filho para sincronizar a lista de aplicativos instalados.
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
                {filteredApps.map(app => (
                  <div 
                    key={app.id} 
                    style={{ 
                      padding: '16px', borderRadius: '14px', 
                      background: app.isBlocked ? 'rgba(244, 63, 94, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                      border: `1px solid ${app.isBlocked ? 'rgba(244, 63, 94, 0.3)' : 'var(--border-color)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ 
                        width: '42px', height: '42px', borderRadius: '12px', 
                        background: app.isBlocked ? 'rgba(244, 63, 94, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: app.isBlocked ? 'var(--accent-rose)' : 'var(--accent-blue)'
                      }}>
                        <Smartphone size={22} />
                      </div>
                      <div>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{app.name}</h4>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{app.category || 'Aplicativo'}</span>
                      </div>
                    </div>

                    <label className="switch">
                      <input 
                        type="checkbox" 
                        checked={app.isBlocked} 
                        onChange={() => handleToggleAppBlock(app.id, app.isBlocked)} 
                      />
                      <span className="slider"></span>
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: FILTRO WEB */}
        {activeTab === 'content' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={20} style={{ color: 'var(--accent-emerald)' }} /> Regras de Filtro de Conteúdo
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}>
                  <div>
                    <h4 style={{ fontSize: '0.95rem' }}>Bloquear Conteúdo Adulto</h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Filtro de sites impróprios e nocivos via DNS</p>
                  </div>
                  <label className="switch">
                    <input type="checkbox" defaultChecked={contentFilter.blockAdultContent} />
                    <span className="slider"></span>
                  </label>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}>
                  <div>
                    <h4 style={{ fontSize: '0.95rem' }}>Forçar SafeSearch</h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Google, YouTube e Bing em modo seguro</p>
                  </div>
                  <label className="switch">
                    <input type="checkbox" defaultChecked={contentFilter.forceSafeSearch} />
                    <span className="slider"></span>
                  </label>
                </div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Globe size={20} style={{ color: 'var(--accent-blue)' }} /> Lista de Sites Bloqueados
              </h3>

              <form onSubmit={handleAddBlockedDomain} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <input 
                  type="text" 
                  placeholder="ex: siteimproprio.com" 
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  style={{
                    flex: 1, padding: '10px 14px', borderRadius: '10px',
                    border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.05)',
                    color: 'white', outline: 'none', fontSize: '0.9rem'
                  }}
                />
                <button type="submit" className="btn btn-primary">
                  <Plus size={18} /> Adicionar
                </button>
              </form>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {contentFilter.blockedDomains.map((dom, idx) => (
                  <span key={idx} style={{ 
                    padding: '6px 12px', borderRadius: '8px', 
                    background: 'rgba(244, 63, 94, 0.12)', color: 'var(--accent-rose)', 
                    border: '1px solid rgba(244, 63, 94, 0.3)', fontSize: '0.85rem',
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}>
                    {dom}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB: GPS REAL */}
        {activeTab === 'location' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={20} style={{ color: 'var(--accent-rose)' }} /> Localização GPS em Tempo Real
              </h3>

              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', marginBottom: '16px' }}>
                <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'white' }}>
                  {location.address || 'Carregando coordenadas...'}
                </p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Lat: {location.latitude ? location.latitude.toFixed(5) : '-'} | Long: {location.longitude ? location.longitude.toFixed(5) : '-'}
                </p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Última atualização: {new Date(location.lastUpdated || Date.now()).toLocaleTimeString()}
                </p>
              </div>

              <h4 style={{ fontSize: '0.95rem', marginBottom: '12px', fontWeight: 600 }}>Cercas Virtuais (Geofences)</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {geofences.map(gf => (
                  <div key={gf.id} style={{ padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <h5 style={{ fontSize: '0.9rem' }}>{gf.name}</h5>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Raio: {gf.radiusMeters}m</span>
                    </div>
                    <span className="badge badge-success">DENTRO DA CERCA</span>
                  </div>
                ))}
              </div>
            </div>

            {/* INTERACTIVE MAP FRAME */}
            <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', height: '360px', borderRadius: '16px' }}>
              <iframe 
                title="OpenStreetMap Live GPS"
                width="100%" 
                height="100%" 
                frameBorder="0" 
                scrolling="no"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${(location.longitude||-46.633308)-0.01}%2C${(location.latitude||-23.550520)-0.01}%2C${(location.longitude||-46.633308)+0.01}%2C${(location.latitude||-23.550520)+0.01}&layer=mapnik&marker=${location.latitude||-23.550520}%2C${location.longitude||-46.633308}`}
              />
            </div>
          </div>
        )}

        {/* TAB: CENTRAL DE PEDIDOS */}
        {activeTab === 'requests' && (
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={22} style={{ color: 'var(--accent-amber)' }} /> Solicitações de Tempo Extra
            </h3>

            {timeRequests.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px 0' }}>
                Nenhuma solicitação pendente no momento.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {timeRequests.map(req => (
                  <div 
                    key={req.id} 
                    style={{ 
                      padding: '18px', borderRadius: '14px', 
                      background: req.status === 'pending' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                      border: `1px solid ${req.status === 'pending' ? 'rgba(245, 158, 11, 0.3)' : 'var(--border-color)'}`,
                      display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontWeight: 700, fontSize: '1rem' }}>+ {req.requestedMinutes} minutos</span>
                        <span className={`badge ${req.status === 'pending' ? 'badge-warning' : req.status === 'approved' ? 'badge-success' : 'badge-danger'}`}>
                          {req.status === 'pending' ? 'PENDENTE' : req.status === 'approved' ? 'APROVADO' : 'RECUSADO'}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        Motivo: "{req.reason}"
                      </p>
                    </div>

                    {req.status === 'pending' && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-ghost" onClick={() => handleRespondRequest(req.id, false)}>
                          <XCircle size={18} /> Recusar
                        </button>
                        <button className="btn btn-primary" onClick={() => handleRespondRequest(req.id, true, 15)}>
                          <CheckCircle size={18} /> Aprovar +15m
                        </button>
                        <button className="btn btn-primary" onClick={() => handleRespondRequest(req.id, true, 30)}>
                          <CheckCircle size={18} /> Aprovar +30m
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
