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
    marginBottom: '8px',
    borderRadius: '12px',
    border: isDragging ? '2px solid #4da6ff' : '1px solid #333',
    backgroundColor: '#111',
    width: '100%',
    boxSizing: 'border-box'
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div 
        style={estaAbierta ? estilos.headerActivo : estilos.headerNormal} 
        {...attributes} 
        {...listeners}
        onClick={(e) => { if (!isDragging) setCancionAbierta(estaAbierta ? null : c.id); }}
      >
        <div style={{display:'flex', alignItems:'center', flex:1}}>
          {!modoLectura && <span style={{marginRight:'10px', color:'#555'}}>☰</span>}
          <div style={{flex: 1}}>
                <div style={{fontSize: '0.9rem', color: '#fff', fontWeight: 'bold'}}>
                    {c.categoria && <span style={estilos.tag}>{c.categoria}</span>} {c.titulo} 
                </div>
                <div style={{fontSize: '0.75rem', color: '#4da6ff'}}>
                    Tono: {transponerIndividual(c.tono || c.key, misSemitonos)} | {c.cantante || c.vocal || 'Voz'}
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
          <div style={estilos.filaControles} onClick={(e) => e.stopPropagation()}>
                <div style={estilos.grupoControl}>
                    <button onClick={() => setMisSemitonos(s => s - 1)} style={estilos.btnT}>-</button>
                    <span style={{color: '#fff', fontSize:'0.9rem', minWidth:'25px', textAlign:'center'}}>{misSemitonos}</span>
                    <button onClick={() => setMisSemitonos(s => s + 1)} style={estilos.btnT}>+</button>
                </div>
                <div style={estilos.grupoControl}>
                    <button onClick={() => setTamanoLetra(s => s - 2)} style={estilos.btnT}>A-</button>
                    <button onClick={() => setTamanoLetra(s => s + 2)} style={estilos.btnT}>A+</button>
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

export default function App() {
  const [pantalla, setPantalla] = useState('inicio');
  const [fecha, setFecha] = useState(new Date());
  const [director, setDirector] = useState("");
  const [canciones, setCanciones] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cancionAbierta, setCancionAbierta] = useState(null);
  const [setlist, setSetlist] = useState([]);
  const [citaBiblica, setCitaBiblica] = useState('');
  const [textoBiblico, setTextoBiblico] = useState('');

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 1000, tolerance: 10 } })
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
      if (data) {
        setDirector(data.director || "");
        setSetlist(data.canciones || []);
      } else {
        setDirector(""); setSetlist([]);
      }
    };
    cargarPlan();
  }, [fecha]);

  const guardarPlan = async () => {
    const fechaISO = fecha.toISOString().split('T')[0];
    await supabase.from('planes_culto').upsert({ fecha: fechaISO, director, canciones: setlist }, { onConflict: 'fecha' });
    alert("✅ Plan Guardado");
  };

  const borrarPlan = async () => {
    if (window.confirm("¿Deseas borrar el plan de este día?")) {
      const fechaISO = fecha.toISOString().split('T')[0];
      await supabase.from('planes_culto').delete().eq('fecha', fechaISO);
      setSetlist([]); setDirector("");
    }
  };

  const buscarBiblia = async () => {
    if (!citaBiblica) return;
    try {
      const res = await fetch(`https://bible-api.com/${encodeURIComponent(citaBiblica)}?translation=rvr09`);
      const data = await res.json();
      setTextoBiblico(data.text || "Cita no encontrada");
    } catch (e) { alert("Error al buscar"); }
  };

  const enviarWhatsApp = () => {
    let mensaje = `*ITED MONTE ALEGRE*\n*PLAN: ${fecha.toLocaleDateString()}*\n*Dirige:* ${director || '---'}\n\n`;
    const categorias = ["Bienvenida", "Alabanza", "Adoración", "Ofrenda", "Despedida"];
    categorias.forEach(cat => {
      const filtradas = setlist.filter(c => c.categoria === cat);
      if (filtradas.length > 0) {
        mensaje += `*--- ${cat.toUpperCase()} ---*\n`;
        filtradas.forEach(c => {
          mensaje += `• ${c.titulo} (${c.tono || c.key}) - ${c.cantante || 'Voz'}\n`;
        });
        mensaje += `\n`;
      }
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank');
  };

  if (pantalla === 'inicio') {
    return (
      <div style={estilos.fondoInicioClaro}>
        <div style={estilos.capaInstrumentos}>
          <span style={{...estilos.instFlotante, top:'10%', left:'5%', color:'#4da6ff'}}>🎸</span>
          <span style={{...estilos.instFlotante, top:'15%', right:'10%', color:'#ff4d4d'}}>🎹</span>
          <span style={{...estilos.instFlotante, bottom:'15%', left:'8%', color:'#10b981'}}>🥁</span>
          <span style={{...estilos.instFlotante, bottom:'10%', right:'5%', color:'#f59e0b'}}>🎷</span>
        </div>
        <div style={estilos.contenedorCentrado}>
          <h2 style={{color:'#1e40af', fontWeight:'900', margin:0, fontSize:'2.2rem'}}>ITED</h2>
          <div style={estilos.marcoLogo}>
             <img src="https://raw.githubusercontent.com/JC100HN/ODRE-NUEVO/main/src/assets/logo%20odre%20nuevo.png" alt="Logo" style={estilos.imagenLogo} />
          </div>
          <h2 style={{color:'#1e40af', fontWeight:'900', margin:0, fontSize:'1.8rem'}}>MONTE ALEGRE</h2>
          <p style={{color:'#64748b', marginBottom:'35px'}}>Ministerio de Alabanza</p>
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

  return (
    <div style={estilos.fondoGeneral}>
       <div style={estilos.contenedorPrincipal}>
          <div style={{display:'flex', justifyContent:'space-between', marginBottom:'15px'}}>
              <button onClick={() => setPantalla('inicio')} style={estilos.btnAtras}>← Inicio</button>
              {pantalla === 'preparar' && (
                  <div style={{display:'flex', gap:'8px'}}>
                      <button onClick={enviarWhatsApp} style={estilos.btnWA}>WhatsApp</button>
                      <button onClick={borrarPlan} style={estilos.btnBorrar}>Borrar</button>
                  </div>
              )}
          </div>

          {pantalla === 'biblia' && (
            <>
              <h2 style={estilos.logo}>Biblia 📜</h2>
              <div style={{display:'flex', gap:'8px', marginBottom:'15px'}}>
                  <input type="text" placeholder="Ej: Juan 3:16" value={citaBiblica} onChange={(e) => setCitaBiblica(e.target.value)} style={estilos.search} />
                  <button onClick={buscarBiblia} style={estilos.btnP}>🔍</button>
              </div>
              {textoBiblico && <div style={estilos.areaPlan}><p style={{lineHeight:'1.8'}}>{textoBiblico}</p></div>}
            </>
          )}

          {pantalla === 'preparar' && (
            <>
              <div style={estilos.cajaCalendario}>
                  <style>{`.react-calendar__tile { color: black !important; font-weight: bold; }`}</style>
                  <Calendar onChange={setFecha} value={fecha} />
                  <input type="text" placeholder="¿Quién dirige?" value={director} onChange={(e) => setDirector(e.target.value)} style={estilos.inputDirCentrado} />
              </div>
              <div style={estilos.headerPlan}>
                  <h4>PLAN DE CULTO</h4>
                  <button onClick={guardarPlan} style={estilos.btnMiniG}>💾 GUARDAR</button>
              </div>
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
              <div style={estilos.divisor}>BIBLIOTECA</div>
              <input type="text" placeholder="🔍 Buscar..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} style={estilos.search} />
              {canciones.filter(c => (c.titulo||'').toLowerCase().includes(busqueda.toLowerCase())).slice(0, 10).map(c => (
                <div key={c.id} style={estilos.itemRepo}>
                  <div style={{flex: 1}}>
                    <div style={{fontSize: '0.9rem', fontWeight: 'bold'}}>{c.titulo}</div>
                    <div style={{fontSize: '0.7rem', color: '#666'}}>{c.cantante || 'Voz'}</div>
                  </div>
                  <button onClick={() => setSetlist([...setlist, {...c, id: `set-${Date.now()}-${Math.random()}` }])} style={estilos.btnP}>+</button>
                </div>
              ))}
            </>
          )}

          {pantalla === 'ensayo' && (
            <>
              <div style={estilos.navEnsayo}>
                  <div style={{fontSize: '1.2rem', fontWeight: 'bold', color:'#4da6ff'}}>DIRECTOR: {director || '---'}</div>
              </div>
              {setlist.map(c => <ItemSortable key={c.id} c={c} cancionAbierta={cancionAbierta} setCancionAbierta={setCancionAbierta} modoLectura={true} />)}
            </>
          )}
       </div>
    </div>
  );
}

const estilos = {
  fondoInicioClaro: { background: 'linear-gradient(135deg, #f8fafc 0%, #e0f2fe 100%)', minHeight: '100vh', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'fixed', top:0, left:0 },
  capaInstrumentos: { position: 'absolute', width: '100%', height: '100%', pointerEvents: 'none', overflow: 'hidden' },
  instFlotante: { position: 'absolute', fontSize: '6rem', opacity: 0.1 },
  contenedorCentrado: { zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '90%', maxWidth: '400px' },
  marcoLogo: { width: '150px', height: '150px', borderRadius: '40px', overflow: 'hidden', margin: '15px 0', border: '3px solid #fff', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' },
  imagenLogo: { width: '100%', height: '100%', objectFit: 'cover' },
  menuGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', width: '100%' },
  cardMenuClaro: { background: '#fff', border: 'none', borderRadius: '24px', padding: '20px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: '#334155' },
  fondoGeneral: { backgroundColor: '#000', color: '#fff', minHeight: '100vh', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0' },
  contenedorPrincipal: { width: '100%', maxWidth: '450px', padding: '15px', boxSizing: 'border-box' },
  btnAtras: { background: '#222', color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '10px' },
  btnWA: { background: '#25D366', color: '#fff', border: 'none', padding: '10px 12px', borderRadius: '10px', fontSize:'0.75rem', fontWeight:'bold' },
  btnBorrar: { background: '#ef4444', color: '#fff', border: 'none', padding: '10px 12px', borderRadius: '10px', fontSize:'0.75rem', fontWeight:'bold' },
  logo: { color: '#4da6ff', margin: '15px 0', textAlign: 'center' },
  cajaCalendario: { background: '#fff', padding: '15px', borderRadius: '15px', marginBottom: '20px', width:'100%', display:'flex', flexDirection:'column', alignItems:'center' },
  inputDirCentrado: { width: '100%', padding: '14px', marginTop: '15px', borderRadius: '12px', border: '2px solid #ddd', textAlign: 'center', fontWeight: 'bold', color:'#333' },
  headerPlan: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', color:'#4da6ff' },
  btnMiniG: { background: '#3b82f6', color: 'white', padding: '8px 12px', borderRadius: '8px', border: 'none', fontWeight: 'bold' },
  areaPlan: { background: '#0a0a0a', padding: '10px', borderRadius: '15px', marginBottom: '20px' },
  headerNormal: { display: 'flex', padding: '14px', background: '#161616', borderRadius: '12px', marginBottom: '4px' },
  headerActivo: { display: 'flex', padding: '14px', background: '#1e3a8a', borderRadius: '12px 12px 0 0' },
  tag: { background: '#4da6ff', color: '#000', padding: '2px 6px', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 'bold', marginRight:'8px' },
  miniSelect: { background: '#222', color: '#fff', border: '1px solid #444', fontSize: '0.75rem', padding: '4px', borderRadius: '6px' },
  btnX: { background: 'none', border: 'none', color: '#ff4d4d', fontSize: '1.2rem' },
  contenido: { padding: '15px', background: '#050505', border: '1px solid #1e3a8a', borderRadius: '0 0 12px 12px' },
  filaControles: { display: 'flex', justifyContent: 'space-between', marginBottom: '15px' },
  grupoControl: { display: 'flex', alignItems: 'center', gap: '8px', background: '#111', padding: '6px 10px', borderRadius: '10px' },
  btnT: { background: '#222', border: '1px solid #444', color: '#fff', padding: '5px 10px', borderRadius: '6px' },
  letraPre: { whiteSpace: 'pre-wrap', color: '#eee', fontFamily: 'monospace', lineHeight: '1.8' },
  divisor: { margin: '20px 0 10px', color: '#4da6ff', textAlign: 'center', fontWeight: 'bold' },
  search: { width: '100%', padding: '14px', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '12px', marginBottom: '15px', boxSizing: 'border-box' },
  itemRepo: { display: 'flex', justifyContent: 'space-between', padding: '14px', background: '#111', borderRadius: '12px', marginBottom: '10px', alignItems:'center' },
  btnP: { background: '#3b82f6', color: '#fff', width: '35px', height: '35px', borderRadius: '50%', border: 'none', fontSize: '1.2rem' },
  navEnsayo: { textAlign:'center', paddingBottom: '20px', borderBottom: '1px solid #333', marginBottom: '20px' }
}