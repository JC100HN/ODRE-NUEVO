import React, { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { Transposer } from 'chord-transposer'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'

import { DndContext, closestCenter, TouchSensor, MouseSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// --- COMPONENTE: ITEM DE CANCIÓN ---
function ItemSortable({ c, cancionAbierta, setCancionAbierta, quitarDelSetlist, cambiarCategoria, modoLectura }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.id });
  const [misSemitonos, setMisSemitonos] = useState(0);
  const [tamanoLetra, setTamanoLetra] = useState(16);
  const estaAbierta = cancionAbierta === c.id;

  const transponerIndividual = (texto, cantidad) => {
    if (!texto || cantidad === 0) return texto;
    try { return Transposer.transpose(texto).up(cantidad).toString(); } 
    catch (e) { return texto; }
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1000 : 1,
    opacity: isDragging ? 0.6 : 1,
    scale: isDragging ? '1.02' : '1',
    marginBottom: '8px',
    borderRadius: '12px',
    border: isDragging ? '2px solid #4da6ff' : '1px solid #333',
    backgroundColor: '#111',
    width: '100%',
    boxSizing: 'border-box',
    touchAction: isDragging ? 'none' : 'pan-y'
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div 
        style={estaAbierta ? estilos.headerActivo : estilos.headerNormal} 
        {...attributes} 
        {...listeners}
        onClick={(e) => { if (!isDragging) setCancionAbierta(estaAbierta ? null : c.id); }}
      >
        <div style={estilos.infoCuerpo}>
          {!modoLectura && <span style={estilos.manubrio}>☰</span>}
          <div style={{flex: 1}}>
                <div style={{fontSize: '0.9rem', color: '#fff', fontWeight: 'bold'}}>
                    {c.categoria && <span style={estilos.tag}>{c.categoria}</span>} {c.titulo} 
                </div>
                <div style={{fontSize: '0.75rem', color: '#4da6ff'}}>
                    Tono: {transponerIndividual(c.tono || c.key, misSemitonos)}
                </div>
          </div>
        </div>
        {!modoLectura && (
            <div style={{display: 'flex', gap: '5px', alignItems: 'center'}} onClick={(e) => e.stopPropagation()}>
                <select value={c.categoria || ""} onChange={(e) => cambiarCategoria(c.id, e.target.value)} style={estilos.miniSelect}>
                    <option value="">Tipo...</option>
                    {["Bienvenida", "Alabanza", "Adoración", "Ofrenda", "Despedida"].map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                <button onClick={() => quitarDelSetlist(c.id)} style={estilos.btnX}>×</button>
            </div>
        )}
      </div>
      {estaAbierta && (
        <div style={estilos.contenido}>
          {/* CONTROLES EN UNA SOLA LÍNEA */}
          <div style={estilos.controlesLetra} onClick={(e) => e.stopPropagation()}>
            <div style={{display:'flex', gap:'10px'}}>
                <div style={estilos.grupoControl}>
                    <button onClick={() => setMisSemitonos(s => s - 1)} style={estilos.btnT}>-</button>
                    <span style={{color: '#fff', fontSize:'0.8rem', minWidth:'20px', textAlign:'center'}}>{misSemitonos}</span>
                    <button onClick={() => setMisSemitonos(s => s + 1)} style={estilos.btnT}>+</button>
                </div>
                <div style={estilos.grupoControl}>
                    <button onClick={() => setTamanoLetra(s => s - 2)} style={estilos.btnT}>A-</button>
                    <button onClick={() => setTamanoLetra(s => s + 2)} style={estilos.btnT}>A+</button>
                </div>
            </div>
          </div>
          <pre style={{...estilos.letraPre, fontSize: `${tamanoLetra}px`}}>
            {transponerIndividual(c.letra || c.lyrics, misSemitonos)}
          </pre>
        </div>
      )}
    </div>
  );
}

// --- APP PRINCIPAL ---
export default function App() {
  const [pantalla, setPantalla] = useState('inicio');
  const [fecha, setFecha] = useState(new Date());
  const [director, setDirector] = useState("");
  const [canciones, setCanciones] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cancionAbierta, setCancionAbierta] = useState(null);
  const [setlist, setSetlist] = useState([]);
  const [filtroTipo, setFiltroTipo] = useState('Alabanza');
  const [planContraido, setPlanContraido] = useState(false);
  const [citaBiblica, setCitaBiblica] = useState('');
  const [textoBiblico, setTextoBiblico] = useState('');
  const [cargandoBiblia, setCargandoBiblia] = useState(false);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 2000, tolerance: 15 } })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setSetlist((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  useEffect(() => {
    const cargarBiblioteca = async () => {
      const { data } = await supabase.from('CANCIONES').select('*').order('titulo', { ascending: true });
      if (data) setCanciones(data.map((c, i) => ({ ...c, id: c.id || `lib-${i}` })));
    };
    cargarBiblioteca();
  }, []);

  useEffect(() => {
    const cargarPlan = async () => {
      const fechaISO = fecha.toISOString().split('T')[0];
      const { data } = await supabase.from('planes_culto').select('*').eq('fecha', fechaISO).maybeSingle();
      if (data && data.canciones) {
        setDirector(data.director || "");
        setSetlist(data.canciones);
      } else {
        setDirector(""); setSetlist([]);
      }
    };
    cargarPlan();
  }, [fecha]);

  const guardarPlan = async () => {
    const fechaISO = fecha.toISOString().split('T')[0];
    const { error } = await supabase.from('planes_culto').upsert({ 
      fecha: fechaISO, director: director, canciones: setlist 
    }, { onConflict: 'fecha' });
    if (error) alert("Error: " + error.message);
    else alert("✅ Sincronizado");
  };

  const enviarWhatsApp = () => {
    let mensaje = `*PLAN DE CULTO - ${fecha.toLocaleDateString()}*\n*Director:* ${director || '---'}\n\n`;
    setlist.forEach((c, i) => { mensaje += `${i+1}. ${c.categoria ? '['+c.categoria+'] ' : ''}${c.titulo} (${c.tono || c.key})\n`; });
    window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank');
  };

  const buscarBiblia = async () => {
    if (!citaBiblica) return;
    setCargandoBiblia(true);
    try {
      const res = await fetch(`https://bible-api.com/${encodeURIComponent(citaBiblica)}?translation=rvr09`);
      const data = await res.json();
      if (data.text) setTextoBiblico(data.text);
      else alert("Cita no encontrada.");
    } catch (e) { alert("Error de conexión."); }
    setCargandoBiblia(false);
  };

  // --- VISTA: INICIO ---
  if (pantalla === 'inicio') {
    const urlLogoGitHub = "https://raw.githubusercontent.com/JC100HN/ODRE-NUEVO/main/src/assets/logo%20odre%20nuevo.png";
    return (
      <div style={estilos.fondoInicioClaro}>
        <div style={estilos.capaInstrumentos}>
          <span style={{...estilos.instFlotante, top:'10%', left:'5%', color:'#4da6ff'}}>🎸</span>
          <span style={{...estilos.instFlotante, top:'15%', right:'10%', color:'#ff4d4d'}}>🎹</span>
          <span style={{...estilos.instFlotante, bottom:'15%', left:'8%', color:'#10b981'}}>🥁</span>
          <span style={{...estilos.instFlotante, bottom:'10%', right:'5%', color:'#f59e0b'}}>🎷</span>
        </div>
        <div style={estilos.contenedorCentrado}>
          <div style={estilos.marcoLogo}>
             <img src={urlLogoGitHub} alt="Logo" style={estilos.imagenLogo} onError={(e) => e.target.src = 'https://via.placeholder.com/150?text=ODRE+NUEVO'} />
          </div>
          <h1 style={estilos.tituloAppClaro}>ODRE NUEVO</h1>
          <p style={estilos.subtituloAppClaro}>Ministerio de Alabanza</p>
          <div style={estilos.menuGrid}>
            <button style={estilos.cardMenuClaro} onClick={() => setPantalla('preparar')}><span>📝</span><b>Preparar</b></button>
            <button style={estilos.cardMenuClaro} onClick={() => setPantalla('ensayo')}><span>📖</span><b>Culto</b></button>
            <button style={estilos.cardMenuClaro} onClick={() => setPantalla('biblia')}><span>📜</span><b>Biblia</b></button>
            <button style={estilos.cardMenuClaro} onClick={() => alert("Próximamente")}><span>⚙️</span><b>Ajustes</b></button>
          </div>
        </div>
      </div>
    );
  }

  // --- VISTAS GENERALES ---
  return (
    <div style={estilos.fondoGeneral}>
       <div style={estilos.contenedor}>
          {pantalla === 'biblia' && (
            <>
              <button onClick={() => setPantalla('inicio')} style={estilos.btnAtras}>← Inicio</button>
              <h2 style={estilos.logo}>Escrituras</h2>
              <div style={{display:'flex', gap:'8px', marginBottom:'15px'}}>
                  <input type="text" placeholder="Ej: Juan 3:16" value={citaBiblica} onChange={(e) => setCitaBiblica(e.target.value)} style={{...estilos.search, marginBottom:0}} />
                  <button onClick={buscarBiblia} style={estilos.btnP}>🔍</button>
              </div>
              {textoBiblico && <div style={estilos.areaPlan}><p style={{lineHeight:'1.8', fontSize:'1.1rem'}}>{textoBiblico}</p></div>}
            </>
          )}

          {pantalla === 'preparar' && (
            <>
              <div style={{display:'flex', justifyContent:'space-between', marginBottom:'15px'}}>
                  <button onClick={() => setPantalla('inicio')} style={estilos.btnAtras}>← Inicio</button>
                  <button onClick={enviarWhatsApp} style={estilos.btnWA}>WhatsApp</button>
              </div>
              <div style={estilos.cajaCalendario}>
                  <Calendar onChange={setFecha} value={fecha} className="custom-calendar" />
                  <div style={{display:'flex', justifyContent:'center', width:'100%'}}>
                    <input type="text" placeholder="Nombre del Director" value={director} onChange={(e) => setDirector(e.target.value)} style={estilos.inputDirCentrado} />
                  </div>
              </div>
              <div style={estilos.headerPlan}>
                  <h4 onClick={() => setPlanContraido(!planContraido)}>PLAN {planContraido ? '[+]' : '[-]'}</h4>
                  <button onClick={guardarPlan} style={estilos.btnMiniG}>💾 GUARDAR</button>
              </div>
              {!planContraido && (
                  <div style={estilos.areaPlan}>
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={setlist.map(i => i.id)} strategy={verticalListSortingStrategy}>
                          {setlist.map(c => (
                              <ItemSortable key={c.id} c={c} cancionAbierta={cancionAbierta} setCancionAbierta={setCancionAbierta}
                                  cambiarCategoria={(id, cat) => setSetlist(setlist.map(item => item.id === id ? { ...item, categoria: cat } : item))}
                                  quitarDelSetlist={(id) => setSetlist(setlist.filter(x => x.id !== id))} 
                              />
                          ))}
                        </SortableContext>
                      </DndContext>
                  </div>
              )}
              <div style={estilos.divisor}>BIBLIOTECA</div>
              <input type="text" placeholder="🔍 Buscar..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} style={estilos.search} />
              <div style={estilos.tabs}>
                  {['Alabanza', 'Adoración'].map(t => (
                      <button key={t} onClick={() => setFiltroTipo(t)} style={filtroTipo === t ? estilos.tabActiva : estilos.tabInactiva}>{t}</button>
                  ))}
              </div>
              {canciones.filter(c => (c.titulo).toLowerCase().includes(busqueda.toLowerCase())).filter(c => (c.tipo || 'Alabanza') === filtroTipo).map(c => (
                <div key={c.id} style={estilos.itemRepo}>
                  <div style={{flex: 1}}><div style={{fontSize: '0.9rem', fontWeight: 'bold'}}>{c.titulo}</div></div>
                  <button onClick={() => setSetlist([...setlist, {...c, id: `set-${Date.now()}`, categoria: ''}])} style={estilos.btnP}>+</button>
                </div>
              ))}
            </>
          )}

          {pantalla === 'ensayo' && (
            <>
              <div style={estilos.navEnsayo}>
                  <button onClick={() => setPantalla('inicio')} style={estilos.btnRegresar}>← Inicio</button>
                  <div style={{textAlign: 'right'}}><div style={{fontSize: '1rem', fontWeight: 'bold'}}>{director || '---'}</div></div>
              </div>
              {setlist.map(c => <ItemSortable key={c.id} c={c} cancionAbierta={cancionAbierta} setCancionAbierta={setCancionAbierta} modoLectura={true} />)}
            </>
          )}
       </div>
    </div>
  );
}

const estilos = {
  fondoInicioClaro: { 
    background: 'linear-gradient(135deg, #f8fafc 0%, #e0f2fe 100%)',
    color: '#334155', minHeight: '100vh', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0 
  },
  capaInstrumentos: { position: 'absolute', width: '100%', height: '100%', pointerEvents: 'none', overflow: 'hidden' },
  instFlotante: { position: 'absolute', fontSize: '6rem', opacity: 0.1, filter: 'blur(1px)' },
  contenedorCentrado: { zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '85%', maxWidth: '400px' },
  marcoLogo: { width: '150px', height: '150px', borderRadius: '40px', overflow: 'hidden', marginBottom: '15px', border: '3px solid #fff', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' },
  imagenLogo: { width: '100%', height: '100%', objectFit: 'cover' },
  tituloAppClaro: { fontSize: '2.5rem', fontWeight: '900', color: '#1e40af', margin: '5px 0' },
  subtituloAppClaro: { fontSize: '1rem', color: '#64748b', marginBottom: '40px', letterSpacing: '2px' },
  menuGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', width: '100%' },
  cardMenuClaro: { background: '#fff', border: 'none', borderRadius: '24px', padding: '25px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', color: '#334155', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' },
  fondoGeneral: { backgroundColor: '#000', color: '#fff', minHeight: '100vh', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0', overflowY: 'auto' },
  contenedor: { width: '92%', maxWidth: '450px' },
  btnAtras: { background: '#222', color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '10px' },
  btnWA: { background: '#25D366', color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '10px', fontWeight: 'bold' },
  logo: { color: '#4da6ff', margin: '15px 0', textAlign: 'center' },
  cajaCalendario: { background: '#fff', padding: '15px', borderRadius: '15px', marginBottom: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  inputDirCentrado: { width: '90%', padding: '14px', marginTop: '15px', borderRadius: '12px', border: '2px solid #e2e8f0', background: '#f8fafc', color: '#1e293b', fontWeight: 'bold', textAlign: 'center', fontSize:'1rem' },
  headerPlan: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', color:'#4da6ff' },
  btnMiniG: { background: '#3b82f6', color: 'white', padding: '10px 15px', borderRadius: '10px', border: 'none', fontWeight: 'bold' },
  areaPlan: { background: '#0a0a0a', padding: '12px', borderRadius: '15px', marginBottom: '20px' },
  headerNormal: { display: 'flex', justifyContent: 'space-between', padding: '16px', background: '#161616', borderRadius: '12px', marginBottom: '6px' },
  headerActivo: { display: 'flex', justifyContent: 'space-between', padding: '16px', background: '#1e3a8a', borderRadius: '12px 12px 0 0' },
  tag: { background: '#4da6ff', color: '#000', padding: '2px 6px', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 'bold', marginRight:'8px' },
  miniSelect: { background: '#222', color: '#fff', border: '1px solid #444', fontSize: '0.75rem', padding: '6px', borderRadius: '8px' },
  btnX: { background: 'none', border: 'none', color: '#ff4d4d', fontSize: '1.5rem' },
  contenido: { padding: '15px', background: '#050505', border: '1px solid #1e3a8a', borderRadius: '0 0 12px 12px' },
  controlesLetra: { display: 'flex', justifyContent: 'flex-start', marginBottom: '15px' },
  grupoControl: { display: 'flex', alignItems: 'center', gap: '8px', background: '#111', padding: '6px 10px', borderRadius: '10px', border:'1px solid #333' },
  btnT: { background: '#222', border: '1px solid #444', color: '#fff', padding: '6px 12px', borderRadius: '6px' },
  letraPre: { whiteSpace: 'pre-wrap', color: '#eee', fontFamily: 'monospace', lineHeight: '1.8' },
  divisor: { margin: '25px 0 15px', color: '#4da6ff', textAlign: 'center', fontWeight: 'bold' },
  search: { width: '100%', padding: '16px', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '15px', marginBottom: '15px', boxSizing: 'border-box' },
  tabs: { display: 'flex', gap: '10px', marginBottom: '20px' },
  tabActiva: { flex: 1, padding: '14px', background: '#4da6ff', color: '#000', fontWeight: 'bold', borderRadius: '15px', border: 'none' },
  tabInactiva: { flex: 1, padding: '14px', background: '#111', color: '#666', borderRadius: '15px', border: '1px solid #333' },
  itemRepo: { display: 'flex', justifyContent: 'space-between', padding: '16px', background: '#111', borderRadius: '15px', marginBottom: '10px' },
  btnP: { background: '#3b82f6', color: '#fff', width: '45px', height: '45px', borderRadius: '50%', border: 'none', fontSize: '1.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  navEnsayo: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingBottom: '20px', borderBottom: '1px solid #333', marginBottom: '20px' },
  btnRegresar: { background: '#222', color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '10px' }
}